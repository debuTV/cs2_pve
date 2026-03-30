/**
 * @module 区域效果/区域效果管理器
 */

import { AreaEffectTargetType, DEFAULT_AREA_EFFECT_TARGET_TYPES } from "./area_const";
import { AreaEffect } from "./effect_service";

/**
 * 区域效果管理器级别的服务。
 *
 * 负责创建、驱动和清理所有独立于怪物生命周期的持续区域效果。
 * 模块内部只关心：
 * - 区域效果实例集合
 * - 每帧 tick 统一驱动
 * - 命中回调桥接
 * - 粒子请求桥接
 *
 * @navigationTitle 区域效果服务
 */
export class AreaEffectManager {
    constructor() {
        /** 所有活跃的区域效果实例。尾部追加，失活后在 tick 中移除。
         * @type {AreaEffect[]} */
        this._effects = [];

        /**
         * 命中玩家回调。
         * @type {import("./area_const").areaEffectHitPlayerCallback|null}
         */
        this._onHitPlayer = null;

        /**
         * 命中怪物回调。
         * @type {import("./area_const").areaEffectHitMonsterCallback|null}
         */
        this._onHitMonster = null;

        /**
         * 粒子请求回调。区域效果需要粒子时通过这里向外部请求。
         * @type {import("./area_const").areaEffectParticleRequestCallback|null}
         */
        this._onParticleRequest = null;
    }

    /**
     * 注册命中玩家回调。
     * @param {import("./area_const").areaEffectHitPlayerCallback} callback
     */
    setOnHitPlayer(callback) {
        this._onHitPlayer = callback;
    }

    /**
     * 注册命中怪物回调。
     * @param {import("./area_const").areaEffectHitMonsterCallback} callback
     */
    setOnHitMonster(callback) {
        this._onHitMonster = callback;
    }

    /**
     * 注册粒子请求回调。
     * @param {import("./area_const").areaEffectParticleRequestCallback} callback
     */
    setOnParticleRequest(callback) {
        this._onParticleRequest = callback;
    }

    /**
     * 创建一个新的区域效果。
     * @param {import("./area_const").areaEffectDesc} desc
     * @returns {AreaEffect}
     */
    create(desc) {
        const normalizedDesc = this._normalizeDesc(desc);
        const effect = new AreaEffect(this, normalizedDesc);
        effect.start();
        this._register(effect);
        return effect;
    }

    /**
     * 每帧由外部主循环或上层 manager 调用。
     * @param {number} now
     * @param {import("./area_const").areaEffectTickContext} tickContext
     */
    tick(now, tickContext) {
        const normalizedTickContext = this._normalizeTickContext(tickContext);
        for (let i = this._effects.length - 1; i >= 0; i--) {
            const effect = this._effects[i];
            if (!effect) {
                this._effects.splice(i, 1);
                continue;
            }
            if (!effect.isAlive()) {
                this._unregister(effect);
                continue;
            }

            effect.tick(now, normalizedTickContext);
            if (!effect.isAlive()) {
                this._unregister(effect);
            }
        }
    }

    /** 清理所有区域效果 */
    cleanup() {
        for (let i = this._effects.length - 1; i >= 0; i--) {
            this._effects[i]?.stop();
        }
        this._effects.length = 0;
    }

    /** @returns {number} 当前活跃区域效果数量 */
    get count() {
        return this._effects.length;
    }

    /** @returns {AreaEffect[]} 当前所有活跃效果的只读快照 */
    getAll() {
        return [...this._effects];
    }

    /**
     * 标准化创建描述，补齐默认值并做浅拷贝，避免外部对象被内部修改。
     * @param {import("./area_const").areaEffectDesc} desc
     * @returns {import("./area_const").areaEffectDesc}
     */
    _normalizeDesc(desc) {
        const candidateTargetTypes = Array.isArray(desc.targetTypes) ? desc.targetTypes : DEFAULT_AREA_EFFECT_TARGET_TYPES;
        const normalizedTargetTypes = [...new Set(candidateTargetTypes.filter((targetType) => {
            return targetType === AreaEffectTargetType.Player || targetType === AreaEffectTargetType.Monster;
        }))];

        return {
            ...desc,
            position: desc.position ? { ...desc.position } : { x: 0, y: 0, z: 0 },
            buffParams: desc.buffParams ? { ...desc.buffParams } : {},
            source: desc.source && typeof desc.source === "object" ? { ...desc.source } : desc.source,
            targetTypes: normalizedTargetTypes.length > 0 ? normalizedTargetTypes : [...DEFAULT_AREA_EFFECT_TARGET_TYPES],
        };
    }

    /**
     * 标准化每帧上下文，保证 players / monsters 至少是空数组。
     * @param {import("./area_const").areaEffectTickContext|undefined|null} tickContext
     * @returns {import("./area_const").areaEffectTickContext}
     */
    _normalizeTickContext(tickContext) {
        return {
            players: Array.isArray(tickContext?.players) ? tickContext.players : [],
            monsters: Array.isArray(tickContext?.monsters) ? tickContext.monsters : [],
        };
    }

    /**
     * 注册单个区域效果实例。
     * @param {AreaEffect} effect
     */
    _register(effect) {
        if (effect && !this._effects.includes(effect)) {
            this._effects.push(effect);
        }
    }

    /**
     * 从集合中移除单个区域效果实例。
     * @param {AreaEffect} effect
     */
    _unregister(effect) {
        const idx = this._effects.indexOf(effect);
        if (idx !== -1) this._effects.splice(idx, 1);
    }

    /**
     * 向外转发玩家命中事件。
     * @param {import("cs_script/point_script").CSPlayerPawn} targetPawn
     * @param {import("./area_const").areaEffectHitPayload} payload
     */
    _emitHitPlayer(targetPawn, payload) {
        this._onHitPlayer?.(targetPawn, payload);
    }

    /**
     * 向外转发怪物命中事件。
     * @param {import("../monster/monster/monster").Monster} targetMonster
     * @param {import("./area_const").areaEffectHitPayload} payload
     */
    _emitHitMonster(targetMonster, payload) {
        this._onHitMonster?.(targetMonster, payload);
    }

    /**
     * 向外请求粒子系统句柄。
     * @param {import("./area_const").areaEffectParticleRequest} request
     * @returns {import("./area_const").areaEffectParticleHandle|null}
     */
    _requestParticle(request) {
        if (!this._onParticleRequest) return null;
        return this._onParticleRequest(request) ?? null;
    }
}