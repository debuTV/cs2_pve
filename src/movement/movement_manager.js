/**
 * @module 实体移动/移动管理器
 */
import { Movement } from "./movement";
import {
    movementMaxAccumulatedDt,
    movementUpdateShardCount,
    PathState,
} from "./movement_const";
import { eventBus } from "../util/event_bus";
import { event, MovementRequestType } from "../util/definition";
import { SpatialHashGrid } from "../util/spatial_hash";

/**
 * 通用实体 Movement 管理器。
 * 由 main 持有，负责注册/注销任意实体的 Movement 实例，
 * 维护内部请求队列并在 tick 内统一消费，
 * 通过内部路径调度队列按频率驱动路径重算。
 * 寻路依赖（findPath）由 main 装配注入。
 */

/** @typedef {import("cs_script/point_script").Entity} Entity */
/** @typedef {import("cs_script/point_script").Vector} Vector */

const EMPTY_SEPARATION_CONTEXT = {
    entities: [],
    spatialIndex: null,
    selfBreakable: null,
};

/**
 * @typedef {object} MovementEntry
 * @property {Movement} movement        Movement 实例
 * @property {Entity}   entity          引擎实体引用
 * @property {object}   config          注册时的配置快照
 * @property {boolean}  useNPCSeparation 当前是否启用分离速度
 * @property {boolean}  usePathRefresh  当前任务是否允许刷新路径
 * @property {Entity|null}  targetEntity  追击目标实体（来自最后一次 Move 请求）
 * @property {Vector|null}  targetPosition  目标坐标（来自最后一次 Move 请求）
 * @property {number}  pendingUpdateDt  尚未消费的累计更新时长
 * @property {number}  lastAccumulatedAt  上次同步累计时长的游戏时间
 * @property {boolean}  isUpdateActive  当前是否允许累计并执行 movement.update
 */

/**
 * 通用实体 MovementManager。
 *
 * 以 entity 为键管理 Movement 实例，路径调度堆中也直接存储 entity。
 * 外部系统通过 submitRequest 提交 MovementRequest，manager 在 tick 开头统一按优先级
 * 合并并消费。tick 内部依次执行：消费请求 → 路径刷新 → 批量 update。
 *
 * 路径刷新逻辑完全基于 entry 自身字段（usePathRefresh、targetEntity、
 * skillMotion），不依赖外部实例方法。
 */
export class MovementManager {
    constructor() {
        /** @type {Map<Entity, MovementEntry>} */
        this._entries = new Map();
        /** @type {Map<Entity, Entity>} */
        this._modelToBreakable = new Map();
        /** @type {Entity[]} */
        this._breakableIgnoreEntities = [];
        /** @type {Map<Entity, number>} */
        this._breakableIgnoreEntityIndexes = new Map();
        this._separationSpatialHash = new SpatialHashGrid();
        /** @type {Entity[]} */
        this._updateOrder = [];
        /** @type {Map<Entity, number>} */
        this._updateOrderIndexes = new Map();
        this._updateShardCursor = 0;

        /** 路径调度最小堆，按上次更新时间排序。 */
        this._pathHeap = new _MinHeap(256);
        /**
         * 寻路函数，由 main 通过 initPathScheduler 注入。
         * @type {((start: Vector, end: Vector) => {pos: Vector, mode: number}[] | null) | null}
         */
        this._findPath = null;
        /** @type {import("../util/definition").MovementRequest[]} */
        this._pendingRequests = [];
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Movement.In.MoveRequest, (req = {}) => {
                req.type = MovementRequestType.Move;
                this.submitRequest(req);
            }),
            eventBus.on(event.Movement.In.StopRequest, (req = {}) => {
                req.type = MovementRequestType.Stop;
                this.submitRequest(req);
            }),
            eventBus.on(event.Movement.In.RemoveRequest, (req = {}) => {
                req.type = MovementRequestType.Remove;
                this.submitRequest(req);
            }),
            eventBus.on(event.Monster.Out.OnMonsterSpawn, (/** @type {import("../monster/monster_const").OnMonsterSpawn} */ payload) => {
                this._trackMonsterBreakable(payload.monster);
            }),
            eventBus.on(event.Monster.Out.OnMonsterDeath, (/** @type {import("../monster/monster_const").OnMonsterDeath} */ payload) => {
                this._dropEntityBreakable(payload.monster?.model ?? null, payload.monster?.breakable ?? null);
            }),
        ];
    }

    /**
     * 注入路径调度依赖。必须在使用 tick 前调用。
     * @param {(start: Vector, end: Vector) => {pos: Vector, mode: number}[]} findPath 寻路函数
     */
    initPathScheduler(findPath) {
        this._findPath = findPath;
    }

    /**
     * 提交一条移动请求到内部队列。
     * 在下一次 tick 开头按 entity 合并后统一消费。
     * @param {import("../util/definition").MovementRequest} req
     */
    submitRequest(req) {
        if (!req?.entity) return;
        this._pendingRequests.push(req);
    }

    /**
     * 注册一个移动实体的 Movement 实例。
     * @param {Entity} key
     * @param {{ speed?: number, mode?: string, physics?: object, useSeparation?: boolean }} config
     */
    register(key, config) {
        if (this._entries.has(key)) return;
        const movement = new Movement({
            entity: key,
            speed: config.speed ?? 120,
            mode: config.mode ?? "walk",
            usePathfinding: false,
            requestPath: null,
            physics: config.physics,
        });
        this._entries.set(key, {
            movement,
            entity: key,
            config,
            useNPCSeparation: config.useSeparation ?? true,
            usePathRefresh: false,
            targetEntity: null,
            targetPosition: null,
            pendingUpdateDt: 0,
            lastAccumulatedAt: 0,
            isUpdateActive: false,
        });
        this._addUpdateEntity(key);
        this._pathHeap.push(key, 0);
        eventBus.emit(event.Movement.Out.OnRegistered, {
            entity: key,
            config,
        });
    }

    /**
     * 注销一个 Movement。
     * @param {Entity} key
     */
    unregister(key) {
        const entry = this._entries.get(key);
        if (!entry) return;
        entry.movement.stop();
        const breakable = this._modelToBreakable.get(key);
        if (breakable) {
            this._removeBreakableIgnoreEntity(breakable);
            this._separationSpatialHash.remove(breakable);
            this._modelToBreakable.delete(key);
        }
        this._entries.delete(key);
        this._removeUpdateEntity(key);
        this._pathHeap.remove(key);
        eventBus.emit(event.Movement.Out.OnRemoved, {
            entity: key,
        });
    }

    /** @param {any} key */
    has(key) {
        return this._entries.has(key);
    }

    /**
     * 获取所有实体的移动状态摘要。
     * 用于将 movement 层状态回写给 monster 侧。
     * @returns {Map<Entity, string>}
     */
    getAllStates() {
        const result = new Map();
        for (const [key, entry] of this._entries) {
            const s = entry.movement.getState();
            result.set(key, s);
        }
        return result;
    }

    /**
     * @param {Entity} key
     * @param {number} speed
     */
    setSpeed(key, speed) {
        const entry = this._entries.get(key);
        if (!entry) return false;
        entry.movement.setSpeed(speed);
        return true;
    }

    // ═══════════════════════════════════════════════
    // 统一 tick 入口
    // ═══════════════════════════════════════════════

    /**
     * 每帧由 main 调用的唯一入口。依次执行：
     * 1. 消费并合并请求队列
     * 2. 路径刷新调度
     * 3. 批量 movement.update
     * @param {number} now 当前游戏时间
     * @param {number} dt 帧间隔
     */
    tick(now, dt) {
        void dt;
        this._consumeRequests(now);
        this._tickPathRefresh(now);//以上2.5ms
        this._updateAll(now);//5.5ms
    }

    // ═══════════════════════════════════════════════
    // 内部：请求消费
    // ═══════════════════════════════════════════════

    /** @param {number} now 按 entity 合并队列中的请求（保留最高优先级），然后逐条应用。 */
    _consumeRequests(now) {
        if (this._pendingRequests.length === 0) return;
        const merged = new Map();
        for (const req of this._pendingRequests) {
            const prev = merged.get(req.entity);
            if (!prev || req.priority <= prev.priority) {
                merged.set(req.entity, req);
            }
        }
        this._pendingRequests.length = 0;
        for (const [, req] of merged) {
            this._applyRequest(req, now);
        }
    }

    /**
     * 应用单条移动请求（Move / Stop / Remove）。
     * 内部按请求字段映射到具体 Movement API，同时更新 entry 长期任务状态。
     * @param {import("../util/definition").MovementRequest} req
        * @param {number} now
     */
    _applyRequest(req, now) {
        let key = req.entity;
        if (!this._entries.has(key) && req.type === "Move") {
            this.register(key, {
                mode: req.Mode,
                useSeparation: req.useNPCSeparation ?? false,
            });
        }
        if (!this._entries.has(key)) return;

        if (req.type === "Remove") {
            this.unregister(key);
            return;
        }

        const entry = this._entries.get(key);
        if (!entry) return;

        if (req.type === "Stop") {
            entry.movement.stop();
            if (req.clearPath) entry.movement.clearPath();
            entry.usePathRefresh = false;
            entry.targetEntity = null;
            entry.targetPosition = null;
            this._deactivateEntryUpdate(entry, now);
            eventBus.emit(event.Movement.Out.OnStopped, {
                entity: key,
            });
            return;
        }

        // type === "Move"
        entry.targetEntity = req.targetEntity ?? null;
        entry.targetPosition = req.targetPosition ?? null;

        if (req.useNPCSeparation !== undefined) entry.useNPCSeparation = req.useNPCSeparation;
        if (req.usePathRefresh !== undefined) entry.usePathRefresh = req.usePathRefresh;

        if (req.Mode) entry.movement.setMode(req.Mode);
        if (req.Velocity) entry.movement.setVelocity(req.Velocity);
        if (req.maxSpeed !== undefined) entry.movement.setSpeed(req.maxSpeed);
        if (req.clearPath) entry.movement.clearPath();

        if (req.targetEntity) {
            const pos = req.targetEntity.GetAbsOrigin();
            if (pos) entry.movement.setTarget(pos);
        } else if (req.targetPosition) {
            if (req.usePathRefresh) {
                entry.movement.setTarget(req.targetPosition);
            } else {
                entry.movement.startMove({
                    target: req.targetPosition,
                    usePathfinding: false,
                    mode: req.Mode,
                    initialVelocity: req.Velocity,
                });
            }
        }

        entry.movement.resume();
        this._activateEntryUpdate(entry, now);
    }

    // ═══════════════════════════════════════════════
    // 内部：路径刷新调度
    // ═══════════════════════════════════════════════

    /**
     * 从最小堆中取出最久未更新的实体，按 entry 字段判断是否允许刷新，
     * 通过注入的 findPath 重算路径。每帧最多成功更新一个。
     * @param {number} now
     */
    _tickPathRefresh(now) {
        if (!this._findPath) return;

        /** @type {Entity|null} */
        let first = null;
        while (!this._pathHeap.isEmpty()) {
            const current = this._pathHeap.pop();
            if (!current.node) break;

            if (current.node === first || now - current.cost <= 0.2) {
                this._pathHeap.push(current.node, current.cost);
                break;
            }
            if (!first) first = current.node;

            const key = current.node;
            if (!key) continue;
            const entry = this._entries.get(key);
            if (!entry) continue;

            if (!this._canRefreshPath(entry)) {
                this._pathHeap.push(current.node, now);
                continue;
            }

            const start = entry.entity.GetAbsOrigin();
            const target = entry.targetEntity;
            const end = (target&&target.IsAlive()) ? target.GetAbsOrigin() : entry.targetPosition;
            if (!start || !end) {
                this._pathHeap.push(current.node, now);
                continue;
            }

            const path = this._findPath(start, end);
            if (path && path.length > 0) {
                entry.movement.setPath(path);
            }

            this._pathHeap.push(current.node, now);
            break;
        }
    }

    /**
     * 判断 entry 是否允许执行路径刷新。
     * @param {MovementEntry} entry
     * @returns {boolean}
     */
    _canRefreshPath(entry) {
        if (!entry.usePathRefresh) return false;
        if (!entry.targetEntity && !entry.targetPosition) return false;
        const s = entry.movement._pathFollower.getMoveGoal()?.mode;
        if (s === PathState.JUMP ||
            s === PathState.LADDER ||
            s === PathState.PORTAL) return false;
        return true;
    }

    /**
     * 基于怪物生命周期缓存 model -> breakable 映射，避免 main 每帧重建。
     * @param {import("../monster/monster/monster").Monster | null | undefined} monster
     */
    _trackMonsterBreakable(monster) {
        const model = monster?.model;
        const breakable = monster?.breakable;
        if (!model?.IsValid?.() || !breakable?.IsValid?.()) return false;
        return this._trackEntityBreakable(model, breakable);
    }

    /**
     * @param {Entity} model
     * @param {Entity} breakable
     */
    _trackEntityBreakable(model, breakable) {
        if (!model?.IsValid?.() || !breakable?.IsValid?.()) return false;

        const prevBreakable = this._modelToBreakable.get(model);
        if (prevBreakable && prevBreakable !== breakable) {
            this._removeBreakableIgnoreEntity(prevBreakable);
            this._separationSpatialHash.remove(prevBreakable);
        }

        this._modelToBreakable.set(model, breakable);
        this._addBreakableIgnoreEntity(breakable);

        const breakablePos = breakable.GetAbsOrigin();
        if (!breakablePos) return true;

        if (this._separationSpatialHash.has(breakable)) {
            this._separationSpatialHash.update(breakable, breakablePos);
        } else {
            this._separationSpatialHash.insert(breakable, breakablePos);
        }
        return true;
    }

    /**
     * @param {Entity | null | undefined} model
     * @param {Entity | null | undefined} breakable
     */
    _dropEntityBreakable(model, breakable = null) {
        const trackedBreakable = model ? (this._modelToBreakable.get(model) ?? null) : null;
        const nextBreakable = trackedBreakable ?? breakable;
        if (!nextBreakable) return false;

        if (model && trackedBreakable) {
            this._modelToBreakable.delete(model);
        }

        this._removeBreakableIgnoreEntity(nextBreakable);
        this._separationSpatialHash.remove(nextBreakable);
        return true;
    }

    /**
     * @param {Entity} breakable
     */
    _addBreakableIgnoreEntity(breakable) {
        if (!breakable?.IsValid?.() || this._breakableIgnoreEntityIndexes.has(breakable)) return false;
        this._breakableIgnoreEntityIndexes.set(breakable, this._breakableIgnoreEntities.length);
        this._breakableIgnoreEntities.push(breakable);
        return true;
    }

    /**
     * @param {Entity} breakable
     */
    _removeBreakableIgnoreEntity(breakable) {
        const index = this._breakableIgnoreEntityIndexes.get(breakable);
        if (index === undefined) return false;

        const lastIndex = this._breakableIgnoreEntities.length - 1;
        const lastBreakable = this._breakableIgnoreEntities[lastIndex];

        this._breakableIgnoreEntities[index] = lastBreakable;
        this._breakableIgnoreEntities.pop();
        this._breakableIgnoreEntityIndexes.delete(breakable);

        if (lastBreakable && lastBreakable !== breakable) {
            this._breakableIgnoreEntityIndexes.set(lastBreakable, index);
        }
        return true;
    }

    // ═══════════════════════════════════════════════
    // 内部：批量更新
    // ═══════════════════════════════════════════════

    /**
    * @param {number} now
     */
    _updateAll(now) {
        const totalEntries = this._updateOrder.length;
        if (totalEntries === 0) return;

        const shardCount = this._getShardCount(totalEntries);
        if (this._updateShardCursor >= shardCount) {
            this._updateShardCursor = 0;
        }

        const shardIndex = this._updateShardCursor;
        for (let index = shardIndex; index < totalEntries; index += shardCount) {
            const key = this._updateOrder[index];
            const entry = this._entries.get(key);
            if (!entry) continue;

            const updateDt = this._consumeEntryUpdateDt(entry, now);
            if (updateDt <= 0) continue;

            const selfBreakable = this._modelToBreakable.get(key) ?? null;
            const sepCtx = entry.useNPCSeparation
                ? {
                    entities: this._breakableIgnoreEntities,
                    spatialIndex: this._separationSpatialHash,
                    selfBreakable,
                }
                : EMPTY_SEPARATION_CONTEXT;
            const newPos = entry.movement.update(updateDt, sepCtx);
            if (selfBreakable?.IsValid?.() && newPos) {
                this._separationSpatialHash.update(selfBreakable, newPos);
            }
        }

        this._updateShardCursor = (shardIndex + 1) % shardCount;
    }

    /** @param {Entity} key */
    _addUpdateEntity(key) {
        if (!key || this._updateOrderIndexes.has(key)) return false;
        this._updateOrderIndexes.set(key, this._updateOrder.length);
        this._updateOrder.push(key);
        return true;
    }

    /** @param {Entity} key */
    _removeUpdateEntity(key) {
        const index = this._updateOrderIndexes.get(key);
        if (index === undefined) return false;

        const lastIndex = this._updateOrder.length - 1;
        const lastKey = this._updateOrder[lastIndex];

        this._updateOrder[index] = lastKey;
        this._updateOrder.pop();
        this._updateOrderIndexes.delete(key);

        if (lastKey && lastKey !== key) {
            this._updateOrderIndexes.set(lastKey, index);
        }

        return true;
    }

    /** @param {MovementEntry} entry @param {number} now */
    _activateEntryUpdate(entry, now) {
        if (entry.isUpdateActive) return;
        entry.isUpdateActive = true;
        entry.pendingUpdateDt = 0;
        entry.lastAccumulatedAt = now;
    }

    /** @param {MovementEntry} entry @param {number} now */
    _deactivateEntryUpdate(entry, now) {
        entry.isUpdateActive = false;
        entry.pendingUpdateDt = 0;
        entry.lastAccumulatedAt = now;
    }

    /** @param {MovementEntry} entry @param {number} now */
    _consumeEntryUpdateDt(entry, now) {
        if (!entry.isUpdateActive) {
            entry.pendingUpdateDt = 0;
            entry.lastAccumulatedAt = now;
            return 0;
        }

        if (entry.lastAccumulatedAt <= 0) {
            entry.lastAccumulatedAt = now;
            return 0;
        }

        const elapsed = Math.max(0, now - entry.lastAccumulatedAt);
        if (elapsed > 0) {
            entry.pendingUpdateDt = Math.min(
                movementMaxAccumulatedDt,
                entry.pendingUpdateDt + elapsed
            );
            entry.lastAccumulatedAt = now;
        }

        const updateDt = entry.pendingUpdateDt;
        entry.pendingUpdateDt = 0;
        return updateDt;
    }

    /** @param {number} totalEntries */
    _getShardCount(totalEntries) {
        return Math.max(1, Math.min(movementUpdateShardCount, totalEntries));
    }

    // ═══════════════════════════════════════════════
    // 生命周期
    // ═══════════════════════════════════════════════

    /**
     * 释放全部 Movement 实例与路径调度队列。
     */
    cleanup() {
        for (const [, entry] of this._entries) {
            entry.movement.stop();
        }
        this._entries.clear();
        this._modelToBreakable.clear();
        this._breakableIgnoreEntities = [];
        this._breakableIgnoreEntityIndexes.clear();
        this._separationSpatialHash.clear();
        this._updateOrder.length = 0;
        this._updateOrderIndexes.clear();
        this._updateShardCursor = 0;
        this._pathHeap.clear();
        this._pendingRequests.length = 0;
    }

    destroy() {
        this.cleanup();
        for (const unsubscribe of this._unsubscribers) {
            unsubscribe();
        }
        this._unsubscribers.length = 0;
    }
}

/**
 * 路径调度内部最小堆。
 * 按 cost（上次更新时间）排序，每次 pop 取出最久未更新的怪物。
 * @private
 */
class _MinHeap {
    /** @param {number} capacity 固定容量 */
    constructor(capacity) {
        this.capacity = capacity;
        /** @type {Entity[]} */
        this.nodes = [];
        /** @type {number[]} */
        this.costs = [];
        /** @type {Map<Entity, number>} */
        this.index = new Map();
        this.size = 0;
    }
    clear() {
        this.nodes.length = 0;
        this.costs.length = 0;
        this.index.clear();
        this.size = 0;
    }
    isEmpty() { return this.size === 0; }
    /** @param {Entity} node @param {number} cost @returns {boolean} */
    push(node, cost) {
        if (!node) return false;
        if (this.size >= this.capacity) return false;
        let i = this.size++;
        this.nodes[i] = node;
        this.costs[i] = cost;
        this.index.set(node, i);
        this._up(i);
        return true;
    }
    /** @param {Entity} node @returns {boolean} */
    remove(node) {
        const idx = this.index.get(node);
        if (idx === undefined) return false;

        this.index.delete(node);
        this.size--;

        if (idx === this.size) {
            this.nodes.length = this.size;
            this.costs.length = this.size;
            return true;
        }

        this.nodes[idx] = this.nodes[this.size];
        this.costs[idx] = this.costs[this.size];
        this.nodes.length = this.size;
        this.costs.length = this.size;
        this.index.set(this.nodes[idx], idx);

        const parent = (idx - 1) >> 1;
        if (idx > 0 && this.costs[idx] < this.costs[parent]) this._up(idx);
        else this._down(idx);
        return true;
    }
    /** @returns {{node: Entity | null, cost: number}} */
    pop() {
        if (this.size === 0) return { node: null, cost: -1 };
        const n = this.nodes[0], c = this.costs[0];
        this.index.delete(n);
        this.size--;
        if (this.size > 0) {
            this.nodes[0] = this.nodes[this.size];
            this.costs[0] = this.costs[this.size];
            this.nodes.length = this.size;
            this.costs.length = this.size;
            this.index.set(this.nodes[0], 0);
            this._down(0);
        } else {
            this.nodes.length = 0;
            this.costs.length = 0;
        }
        return { node: n, cost: c };
    }
    /** @param {number} i */
    _up(i) {
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.costs[p] <= this.costs[i]) break;
            this._swap(i, p); i = p;
        }
    }
    /** @param {number} i */
    _down(i) {
        const n = this.size;
        while (true) {
            let l = i * 2 + 1, r = l + 1, m = i;
            if (l < n && this.costs[l] < this.costs[m]) m = l;
            if (r < n && this.costs[r] < this.costs[m]) m = r;
            if (m === i) break;
            this._swap(i, m); i = m;
        }
    }
    /** @param {number} a @param {number} b */
    _swap(a, b) {
        const ca = this.costs[a], na = this.nodes[a];
        this.costs[a] = this.costs[b]; this.costs[b] = ca;
        this.nodes[a] = this.nodes[b]; this.nodes[b] = na;
        this.index.set(na, b);
        this.index.set(this.nodes[a], a);
    }
}
