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
        this.event=new AreaEffectManagerEvents();
    }

    /**
     * 创建一个新的区域效果。
     * @param {import("./area_const").areaEffectDesc} desc
     * @returns {AreaEffect}
     */
    create(desc) {
        const normalizedDesc = desc;
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
}

export class AreaEffectManagerEvents {
    constructor() {
        /** @type {import("./area_const").areaEffectHitPlayerCallback|null} */
        this.OnHitPlayer = null;
        /** @type {import("./area_const").areaEffectHitMonsterCallback|null} */
        this.OnHitMonster = null;
        /** @type {import("./area_const").areaEffectParticleRequestCallback|null} */
        this.OnParticleRequest = null;
    }
    /** 注册命中玩家回调。 @param {import("./area_const").areaEffectHitPlayerCallback} callback*/
    setOnHitPlayer(callback) {this.OnHitPlayer = callback;}
    /** 注册命中怪物回调。 @param {import("./area_const").areaEffectHitMonsterCallback} callback*/
    setOnHitMonster(callback) {this.OnHitMonster = callback;}
    /** 注册粒子请求回调。 * @param {import("./area_const").areaEffectParticleRequestCallback} callback */
    setOnParticleRequest(callback) {this.OnParticleRequest = callback;}
}