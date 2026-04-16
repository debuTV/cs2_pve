/**
 * @module 区域效果/单个区域效果
 */
import { Instance } from "cs_script/point_script";
import { vec } from "../util/vector";
import { event } from "../util/definition";
import { eventBus } from "../util/event_bus";
import { areaEffectStatics, Target } from "./area_const";

/**
 * 单个区域效果实例（毒区、燃烧地面等）。
 *
 * 完全独立于怪物生命周期，由 AreaEffectManager 统一驱动。
 * 每个实例包含位置、半径、持续时间、施加间隔和 Buff 参数，
 * 在每帧 tick 中检测半径内的目标，并按冷却时间触发命中回调。
 * 超时后自动销毁并清理关联的粒子效果句柄。
 *
 * @navigationTitle 区域效果实例
 */
export class AreaEffect {
    static _nextId = 1;

    /**
     * 创建区域效果实例。
     * @param {import("./area_const").AreaEffectCreateRequest} desc
     */
    constructor(desc) {
        /** 自增唯一 ID。 */
        this.id = AreaEffect._nextId++;
        /** 效果类型标识（如 "fire"）。 */
        this.effectName = areaEffectStatics[desc.areaEffectStaticKey].effectName;
        /** Buff 配置 id。 */
        this.buffConfigId = areaEffectStatics[desc.areaEffectStaticKey].buffConfigId;
        /** 关联的粒子效果名字。
         * @type {string} */
        this.particleName = areaEffectStatics[desc.areaEffectStaticKey].particleName;
        /** 可选的父实体；有效时区域中心会跟随它的世界坐标。
         * @type {import("cs_script/point_script").Entity | null} */
        this.parentEntity = desc.parentEntity ?? null;

        /** 效果中心世界坐标。 */
        this.position = { ...desc.position };
        /** 影响半径。 */
        this.radius = desc.radius;
        /** 总持续时间（秒）。 */
        this.duration = desc.duration;
        /** 命中目标类型数组。
         * @type {string[]} */
        this.targetTypes = desc.targetTypes;
        /** 创建时的游戏时间戳。由 `start()` 设置，用于超时判定。 */
        this.startTime = 0;
        /** 是否存活。由 `start()` 置为 true，`stop()` 置为 false。 */
        this.alive = false;
        /** 粒子效果 ID，由粒子管理器返回。 */
        this.particleId=-1;
        /**
         * 每个目标的命中冷却记录。键采用：
         * - 玩家：`p:${slot}`
         * - 怪物：`m:${monsterId}`
         * @type {Map<string, number>}
         */
        this._hitCooldowns = new Map();
        /**
         * 每个目标的 Buff ID 记录。键采用：
         * - 玩家：`p:${slot}`
         * - 怪物：`m:${monsterId}`
         * @type {Map<string, number>}
         */
        this._buffid=new Map();
    }

    /**
     * 启动区域效果实例。
     * @returns {boolean}
     */
    start() {
        if (this.alive) {
            this.stop();
        }
        if (!this._syncPositionFromParentEntity()) {
            return false;
        }
        this._buffid.clear();
        this._hitCooldowns.clear();
        this.startTime = Instance.GetGameTime();
        this.alive = true;
        this._requestParticle();
        /** @type {import("./area_const").OnAreaEffectCreated} */
        const payload = {
            effectId: this.id,
        };
        eventBus.emit(event.AreaEffects.Out.OnCreated, payload);
        return true;
    }

    /**
     * 每次由 manager 驱动调用。
     * @param {number} now
     * @param {import("./area_const").areaEffectTickContext} tickContext
     */
    tick(now, tickContext) {
        if (!this.alive) return;

        if (!this._syncPositionFromParentEntity()) {
            this.stop();
            return;
        }

        if (now - this.startTime >= this.duration) {
            this.stop();
            return;
        }

        const r2 = this.radius * this.radius;
        if (this.targetTypes.includes(Target.Player)) {
            this._tickPlayers(now, tickContext?.players ?? [], r2);
        }
        if (this.targetTypes.includes(Target.Monster)) {
            this._tickMonsters(now, tickContext?.monsters ?? [], r2);
        }
    }

    /**
     * 停止效果并清理粒子句柄。
     */
    stop() {
        if (!this.alive && this.particleId < 1) return;

        this.alive = false;
        this._stopParticle();
        this._buffid.clear();
        this._hitCooldowns.clear();
        this.startTime = 0;
        /** @type {import("./area_const").OnAreaEffectStopped} */
        const payload = {
            effectId: this.id,
        };
        eventBus.emit(event.AreaEffects.Out.OnStopped, payload);
    }

    /** @returns {boolean} 当前实例是否仍处于存活状态 */
    isAlive() {
        return this.alive;
    }

    /**
     * 处理玩家命中判定。
     * @param {number} now
     * @param {import("../player/player/player").Player[]} players
     * @param {number} r2
     */
    _tickPlayers(now, players, r2) {
        for (const player of players) {
            const pawn = player?.entityBridge?.pawn;
            if (!pawn?.IsValid?.()) continue;
            const pos = pawn.GetAbsOrigin();
            if (!pos || vec.lengthsq(pos, this.position) > r2) continue;

            const slot = pawn?.GetPlayerController?.()?.GetPlayerSlot?.() ?? -1;
            if (slot < 0) continue;

            const cooldownKey = `p:${slot}`;
            if (this._isInCooldown(cooldownKey, now)) continue;

            this._hitCooldowns.set(cooldownKey, now);
            this._ensureBuff(cooldownKey, player, Target.Player);
            /** @type {import("./area_const").OnAreaEffectHitPlayer} */
            const payload = { player, 
                effectId: this.id,
                targetType: Target.Player,
                hit: slot,
                buffConfigId: this.buffConfigId,
            };
            eventBus.emit(event.AreaEffects.Out.OnHitPlayer, payload);
        }
    }

    /**
     * 处理怪物命中判定。
     * @param {number} now
     * @param {import("../monster/monster/monster").Monster[]} monsters
     * @param {number} r2
     */
    _tickMonsters(now, monsters, r2) {
        for (const monster of monsters) {
            const monsterId = monster?.id;
            const model = monster?.model;
            if (!model?.IsValid?.()) continue;
            const pos = model.GetAbsOrigin();
            if (!pos || vec.lengthsq(pos, this.position) > r2) continue;

            const cooldownKey = `m:${monsterId}`;
            if (this._isInCooldown(cooldownKey, now)) continue;

            this._hitCooldowns.set(cooldownKey, now);
            this._ensureBuff(cooldownKey, monster, Target.Monster);
            /** @type {import("./area_const").OnAreaEffectHitMonster} */
            const payload = { monster, 
                effectId: this.id,
                targetType: Target.Monster,
                hit: monsterId,
                buffConfigId: this.buffConfigId
            };
            eventBus.emit(event.AreaEffects.Out.OnHitMonster, payload);
        }
    }

    /**
     * 优先刷新目标当前缓存的 Buff；若缓存失效则当场回退到重新创建。
     *
     * 这里只在命中路径消费 _buffid，因此采用懒修复即可：
     * refresh 失败说明本地缓存已过期，立刻删掉并重新 add。
     *
     * @param {string} cooldownKey
     * @param {import("../player/player/player").Player | import("../monster/monster/monster").Monster} target
     * @param {string} targetType
     * @returns {number} 成功时返回有效 buffId，失败返回 -1
     */
    _ensureBuff(cooldownKey, target, targetType) {
        const cachedBuffId = this._buffid.get(cooldownKey);
        if (cachedBuffId&& cachedBuffId > 0) {
            /** @type {import("../buff/buff_const").BuffRefreshRequest} */
            const refreshRequest = { buffId: cachedBuffId, result: false };
            eventBus.emit(event.Buff.In.BuffRefreshRequest, refreshRequest);
            if (refreshRequest.result) {
                return cachedBuffId;
            }
            this._buffid.delete(cooldownKey);
        }

        /** @type {import("../buff/buff_const").BuffAddRequest} */
        const addRequest = {
            configid: this.buffConfigId,
            target,
            targetType,
            result: -1,
        };
        eventBus.emit(event.Buff.In.BuffAddRequest, addRequest);
        if (addRequest.result > 0) {
            this._buffid.set(cooldownKey, addRequest.result);
            return addRequest.result;
        }

        this._buffid.delete(cooldownKey);
        return -1;
    }

    /**
     * 判断某个目标是否处于命中冷却中。
     * @param {string} cooldownKey
     * @param {number} now
     * @returns {boolean}
     */
    _isInCooldown(cooldownKey, now) {
        const lastApply = this._hitCooldowns.get(cooldownKey) ?? -Infinity;
        return now - lastApply < 0.5; // 默认 500ms 冷却时间，避免同一帧多次命中
    }

    /** 按需向管理器请求粒子系统。 */
    _requestParticle() {
        /**@type {import("../particle/particle_const").ParticleCreateRequest} */
        const payload = {
            particleName: this.particleName,
            position: { ...this.position },
            parentEntity: this.parentEntity,
            lifetime: this.duration,
            result:-1,
        };
        eventBus.emit(event.Particle.In.CreateRequest, payload);
        this.particleId = payload.result;
    }

    /**
     * 若存在父实体，则用其同步当前位置。
     * @returns {boolean}
     */
    _syncPositionFromParentEntity() {
        if (!this.parentEntity) {
            return true;
        }

        if (!this.parentEntity.IsValid?.()) {
            return false;
        }

        const nextPosition = this.parentEntity.GetAbsOrigin?.();
        if (!nextPosition) {
            return false;
        }

        this.position = {
            x: nextPosition.x,
            y: nextPosition.y,
            z: nextPosition.z,
        };
        return true;
    }

    /** 停止并释放粒子句柄。 */
    _stopParticle() {
        if (this.particleId < 1) return false;
        /**@type {import("../particle/particle_const").ParticleStopRequest} */
        const payload = {
            particleId: this.particleId,
            result: false,
        };
        eventBus.emit(event.Particle.In.StopRequest, payload);
        this.particleId = -1;
        return payload.result;
    }

}
