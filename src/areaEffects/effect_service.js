/**
 * @module 区域效果/单个区域效果
 */
import { Instance } from "cs_script/point_script";
import { vec } from "../util/vector";
import { event } from "../util/definition";
import { eventBus } from "../eventBus/event_bus";
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
     * @param {import("./area_const").areaEffectDesc} desc
     */
    constructor(desc) {
        /** 自增唯一 ID。 */
        this.id = AreaEffect._nextId++;
        /** 效果类型标识（如 "poisongas"）。 */
        this.effectName = areaEffectStatics[desc.areaEffectStaticKey].effectName;
        /** Buff 类型名字。 */
        this.buffName = areaEffectStatics[desc.areaEffectStaticKey].buffName;
        /** 关联的粒子效果名字。
         * @type {string} */
        this.particleName = areaEffectStatics[desc.areaEffectStaticKey].particleName;

        /** 效果中心世界坐标。 */
        this.position = desc.position;
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
    }

    /**
     * 启动区域效果实例。
     * @returns {boolean}
     */
    start() {
        if (this.alive) {
            this.stop();
        }

        this._hitCooldowns.clear();
        this.startTime = Instance.GetGameTime();
        this.alive = true;
        this._requestParticle();
        eventBus.emit(event.AreaEffects.Out.OnCreated, this._createLifecyclePayload());
        return true;
    }

    /**
     * 每次由 manager 驱动调用。
     * @param {number} now
     * @param {import("./area_const").areaEffectTickContext} tickContext
     */
    tick(now, tickContext) {
        if (!this.alive) return;

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
        if (!this.alive && !this.particleId) return;

        this.alive = false;
        this._stopParticle();
        this._hitCooldowns.clear();
        this.startTime = 0;
        eventBus.emit(event.AreaEffects.Out.OnStopped, this._createLifecyclePayload());
        Instance.Msg(`[AreaEffect] #${this.id} ${this.effectName} 已停止销毁`);
    }

    /** @returns {boolean} 当前实例是否仍处于存活状态 */
    isAlive() {
        return this.alive;
    }

    /**
     * 处理玩家命中判定。
     * @param {number} now
     * @param {import("cs_script/point_script").CSPlayerPawn[]} players
     * @param {number} r2
     */
    _tickPlayers(now, players, r2) {
        for (const pawn of players) {
            const pos = pawn?.GetAbsOrigin?.();
            if (!pos || vec.lengthsq(pos, this.position) > r2) continue;

            const slot = pawn.GetPlayerController?.()?.GetPlayerSlot?.() ?? -1;
            if (slot < 0) continue;

            const cooldownKey = `p:${slot}`;
            if (this._isInCooldown(cooldownKey, now)) continue;

            this._hitCooldowns.set(cooldownKey, now);
            eventBus.emit(event.Buff.In.BuffRefreshRequest,{});
            eventBus.emit(event.AreaEffects.Out.OnHitPlayer, { payload: this._createHitPayload(Target.Player, slot) });
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
            const pos = monster?.model?.GetAbsOrigin?.();
            if (!pos || vec.lengthsq(pos, this.position) > r2) continue;

            const cooldownKey = `m:${monsterId}`;
            if (this._isInCooldown(cooldownKey, now)) continue;

            this._hitCooldowns.set(cooldownKey, now);
            eventBus.emit(event.Buff.In.BuffRefreshRequest,{});
            eventBus.emit(event.AreaEffects.Out.OnHitMonster, { payload: this._createHitPayload(Target.Monster, monsterId) });
        }
    }

    /**
     * 判断某个目标是否处于命中冷却中。
     * @param {string} cooldownKey
     * @param {number} now
     * @returns {boolean}
     */
    _isInCooldown(cooldownKey, now) {
        const lastApply = this._hitCooldowns.get(cooldownKey) ?? -Infinity;
        return now - lastApply < 500; // 默认 500ms 冷却时间，避免同一帧多次命中
    }

    /**
     * 构造命中事件负载。每次都返回一份新对象，避免外部修改内部状态。
     * @param {string} targetType
     * @param {number} hit
     * @returns {import("./area_const").areaEffectHitPayload}
     */
    _createHitPayload(targetType,hit) {
        return {
            effectId: this.id,
            targetType: targetType,
            hit:hit,
        };
    }

    /** 按需向管理器请求粒子系统。 */
    _requestParticle() {
        /**@type {import("../particle/particle_const").ParticleCreateRequest} */
        const payload = {
            particleName: this.particleName,
            position: { ...this.position },
            lifetime: this.duration,
            result:-1,
        };
        eventBus.emit(event.Particle.In.CreateRequest, {payload});
        this.particleId = payload.result;
    }

    /** 停止并释放粒子句柄。 */
    _stopParticle() {
        /**@type {import("../particle/particle_const").ParticleStopRequest} */
        const payload = {
            particleId: this.particleId,
            result: false,
        };
        eventBus.emit(event.Particle.In.StopRequest, {payload});
        return payload.result;
    }

    /**
     * 构造区域效果生命周期事件负载。
     * @returns {Record<string, any>}
     */
    _createLifecyclePayload() {
        return {
            effectId: this.id,
            position: { ...this.position },
            radius: this.radius,
            duration: this.duration,
            targetTypes: [...this.targetTypes],
        };
    }
}
