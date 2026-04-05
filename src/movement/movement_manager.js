/**
 * @module 实体移动/移动管理器
 */
/**
 * 通用实体 Movement 管理器。
 * 由 main 持有，负责注册/注销任意实体的 Movement 实例，
 * 维护内部请求队列并在 tick 内统一消费，
 * 通过内部路径调度队列按频率驱动路径重算。
 * 寻路依赖（findPath）由 main 装配注入。
 */
import { Movement } from "./movement";
import { PathState } from "./movement_const";
import { eventBus } from "../eventBus/event_bus";
import { event, MovementRequestType } from "../util/definition";

/** @typedef {import("cs_script/point_script").Entity} Entity */
/** @typedef {import("cs_script/point_script").Vector} Vector */

/**
 * @typedef {object} MovementEntry
 * @property {Movement} movement        Movement 实例
 * @property {Entity}   entity          引擎实体引用
 * @property {object}   config          注册时的配置快照
 * @property {Entity|null} ignoreEntity 传给 move_probe 的忽略实体
 * @property {boolean}  useNPCSeparation 当前是否启用分离速度
 * @property {boolean}  usePathRefresh  当前任务是否允许刷新路径
 * @property {Entity|null}  targetEntity  追击目标实体（来自最后一次 Move 请求）
 * @property {Vector|null}  targetPosition  目标坐标（来自最后一次 Move 请求）
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
        /** @type {Entity[]} 提供给 move_probe 的忽略实体列表。 */
        this.ignoreEntity = [];

        /** 路径调度最小堆，按上次更新时间排序。 */
        this._pathHeap = new _MinHeap(1000);
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
     * @param {{ speed?: number, mode?: string, physics?: object, useSeparation?: boolean, ignoreEntity?: Entity | null }} config
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
            ignoreEntity: config.ignoreEntity ?? null,
            useNPCSeparation: config.useSeparation ?? true,
            usePathRefresh: false,
            targetEntity: null,
            targetPosition: null,
        });
        this._addIgnoreEntity(config.ignoreEntity ?? null);
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
        this._entries.delete(key);
        this._removeIgnoreEntity(entry.ignoreEntity);
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
     * @returns {Map<Entity, {mode: string, onGround: boolean, currentGoalMode: number|null}>}
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
     * @param {Vector[]} separationPositions
     */
    tick(now,dt, separationPositions) {
        this._consumeRequests();
        this._tickPathRefresh(now);
        this._updateAll(dt, separationPositions);
    }

    /**
     * 向 ignoreEntity 追加一个外部提供的忽略实体。
        * @param {Entity|null} entity
     */
    _addIgnoreEntity(entity) {
        if (!entity) return;
        if (this.ignoreEntity.indexOf(entity) !== -1) return;
        this.ignoreEntity.push(entity);
    }

    /**
     * 从 ignoreEntity 中移除一个忽略实体。
        * @param {Entity|null} entity
     */
    _removeIgnoreEntity(entity) {
        if (!entity) return;
        const idx = this.ignoreEntity.indexOf(entity);
        if (idx === -1) return;
        const last = this.ignoreEntity.length - 1;
        if (idx !== last) {
            this.ignoreEntity[idx] = this.ignoreEntity[last];
        }
        this.ignoreEntity.pop();
    }

    // ═══════════════════════════════════════════════
    // 内部：请求消费
    // ═══════════════════════════════════════════════

    /** 按 entity 合并队列中的请求（保留最高优先级），然后逐条应用。 */
    _consumeRequests() {
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
            this._applyRequest(req);
        }
    }

    /**
     * 应用单条移动请求（Move / Stop / Remove）。
     * 内部按请求字段映射到具体 Movement API，同时更新 entry 长期任务状态。
     * @param {import("../util/definition").MovementRequest} req
     */
    _applyRequest(req) {
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

            if (current.node === first || now - current.cost <= 0.5) {
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
        const s = entry.movement.getState();
        if (s.currentGoalMode === PathState.JUMP ||
            s.currentGoalMode === PathState.LADDER ||
            s.currentGoalMode === PathState.PORTAL) return false;
        return true;
    }

    // ═══════════════════════════════════════════════
    // 内部：批量更新
    // ═══════════════════════════════════════════════

    /**
     * @param {number} dt
     * @param {Vector[]} separationPositions
     */
    _updateAll(dt, separationPositions) {
        for (const [key, entry] of this._entries) {
            const sepCtx = entry.useNPCSeparation
                ? { entities: this.ignoreEntity, positions: separationPositions }
                : { entities: [], positions: []};
            entry.movement.update(dt, sepCtx);
        }
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
        this.ignoreEntity.length = 0;
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
