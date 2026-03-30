/**
 * @module 区域效果/单个区域效果
 */
import { Instance } from "cs_script/point_script";
import { vec } from "../util/vector";
import { AreaEffectTargetType } from "./area_const";

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
     * @param {import("./area_manager").AreaEffectManager|null} manager
     * @param {import("./area_const").areaEffectDesc} desc
     */
    constructor(manager, desc) {
        /** 所属管理器。
         * @type {import("./area_manager").AreaEffectManager|null} */
        this._manager = manager;
        /** 自增唯一 ID。 */
        this.id = AreaEffect._nextId++;
        /** 效果类型标识（如 "poisongas"）。 */
        this.effectType = desc.effectType;
        /** 效果中心世界坐标。 */
        this.position = desc.position;
        /** 影响半径。 */
        this.radius = desc.radius;
        /** 总持续时间（秒）。 */
        this.duration = desc.duration;
        /** 对同一目标施加效果的最小间隔（秒）。 */
        this.applyInterval = desc.applyInterval;
        /** Buff 类型 ID。 */
        this.buffTypeId = desc.buffTypeId;
        /** Buff 参数对象。 */
        this.buffParams = desc.buffParams;
        /** 来源信息（怪物 ID、怪物类型、技能 ID）。 */
        this.source = desc.source;
        /** 命中目标类型数组。
         * @type {import("./area_const").areaEffectTargetType[]} */
        this.targetTypes = desc.targetTypes;
        /** 关联的粒子效果 id。
         * @type {string|null} */
        this.particleId = desc.particleId ?? null;
        /** 粒子持续时间。缺省时沿用区域持续时间。
         * @type {number} */
        this.particleLifetime = desc.particleLifetime ?? desc.duration;

        /** 创建时的游戏时间戳。由 `start()` 设置，用于超时判定。 */
        this.startTime = 0;
        /** 是否存活。由 `start()` 置为 true，`stop()` 置为 false。 */
        this.alive = false;

        /**
         * 每个目标的命中冷却记录。键采用：
         * - 玩家：`p:${slot}`
         * - 怪物：`m:${monsterId}`
         * @type {Map<string, number>}
         */
        this._hitCooldowns = new Map();

        /**
         * 关联的粒子效果句柄。销毁时自动调用 stop。
         * @type {import("./area_const").areaEffectParticleHandle|null}
         */
        this._particleHandle = null;
    }

    /**
     * 启动区域效果实例。
     * 由 AreaEffectManager.create 调用。
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

        Instance.Msg(`[AreaEffect] #${this.id} ${this.effectType} 创建于 (${this.position.x.toFixed(0)},${this.position.y.toFixed(0)},${this.position.z.toFixed(0)}) 半径=${this.radius} 持续=${this.duration}s`);
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
        if (this.targetTypes.includes(AreaEffectTargetType.Player)) {
            this._tickPlayers(now, tickContext?.players ?? [], r2);
        }
        if (this.targetTypes.includes(AreaEffectTargetType.Monster)) {
            this._tickMonsters(now, tickContext?.monsters ?? [], r2);
        }
    }

    /**
     * 停止效果并清理粒子句柄。
     */
    stop() {
        if (!this.alive && !this._particleHandle && this._hitCooldowns.size === 0) return;

        this.alive = false;
        this._stopParticle();
        this._hitCooldowns.clear();
        this.startTime = 0;

        Instance.Msg(`[AreaEffect] #${this.id} ${this.effectType} 已停止销毁`);
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
            try {
                this._manager?._emitHitPlayer(pawn, this._createHitPayload());
            } catch (error) {
                Instance.Msg(`AreaEffect: 玩家命中回调失败 #${this.id}: ${error}\n`);
            }

            const name = pawn.GetPlayerController?.()?.GetPlayerName?.() ?? "?";
            Instance.Msg(`[AreaEffect] #${this.id} 命中玩家 ${name}`);
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
            if (typeof monsterId !== "number" || !pos || vec.lengthsq(pos, this.position) > r2) continue;

            const cooldownKey = `m:${monsterId}`;
            if (this._isInCooldown(cooldownKey, now)) continue;

            this._hitCooldowns.set(cooldownKey, now);
            try {
                this._manager?._emitHitMonster(monster, this._createHitPayload());
            } catch (error) {
                Instance.Msg(`AreaEffect: 怪物命中回调失败 #${this.id}: ${error}\n`);
            }
            Instance.Msg(`[AreaEffect] #${this.id} 命中怪物 #${monsterId}`);
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
        return now - lastApply < this.applyInterval;
    }

    /**
     * 构造命中事件负载。每次都返回一份新对象，避免外部修改内部状态。
     * @returns {import("./area_const").areaEffectHitPayload}
     */
    _createHitPayload() {
        return {
            effectId: this.id,
            effectType: this.effectType,
            buffTypeId: this.buffTypeId,
            buffParams: { ...this.buffParams },
            source: this.source && typeof this.source === "object" ? { ...this.source } : this.source,
        };
    }

    /** 按需向管理器请求粒子系统。 */
    _requestParticle() {
        if (!this.particleId || !this._manager) return;

        let handle = null;
        try {
            handle = this._manager._requestParticle({
                particleId: this.particleId,
                position: { ...this.position },
                lifetime: this.particleLifetime,
                effectId: this.id,
                effectType: this.effectType,
                source: this.source && typeof this.source === "object" ? { ...this.source } : this.source,
            });
        } catch (error) {
            Instance.Msg(`AreaEffect: 请求粒子失败 #${this.id}: ${error}\n`);
            return;
        }

        if (handle && typeof handle.stop === "function") {
            this._particleHandle = handle;
        }
    }

    /** 停止并释放粒子句柄。 */
    _stopParticle() {
        if (!this._particleHandle) return;

        try {
            this._particleHandle.stop?.();
        } catch (error) {
            Instance.Msg(`AreaEffect: 停止粒子失败 #${this.id}: ${error}\n`);
        }
        this._particleHandle = null;
    }
}
