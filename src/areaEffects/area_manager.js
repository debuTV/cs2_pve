/**
 * @module 区域效果/区域效果管理器
 */
import { AreaEffect } from "./effect_service";
import { eventBus } from "../eventBus/event_bus";
import { event } from "../util/definition";
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
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.AreaEffects.In.CreateRequest, (payload = {}) => {
                payload.result = this.create(payload);
            }),
            eventBus.on(event.AreaEffects.In.StopRequest, (payload = {}) => {
                payload.result = this.stop(payload.areaEffectId ?? payload.effectId ?? null);
            })
        ];
    }

    /**
     * 创建一个新的区域效果。
     * @param {import("./area_const").areaEffectDesc} desc
     * @returns {boolean} 是否成功创建
     */
    create(desc) {
        const effect = new AreaEffect(desc);
        effect.start();
        this._register(effect);
        return true;
    }

    /**
     * 停止指定区域效果。
     * @param {number} areaEffectId
     * @returns {boolean}
     */
    stop(areaEffectId) {
        for (const effect of this._effects) {
            if (!effect || effect.id !== areaEffectId) continue;
            effect.stop();
            this._unregister(effect);
            return true;
        }

        return false;
    }

    /**
     * 每帧由外部主循环或上层 manager 调用。
     * @param {number} now
     * @param {import("./area_const").areaEffectTickContext} tickContext
     */
    tick(now, tickContext) {
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

            effect.tick(now, tickContext);
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

    /** 销毁服务并注销事件监听。 */
    destroy() {
        this.cleanup();
        for (const unsubscribe of this._unsubscribers) {
            unsubscribe();
        }
        this._unsubscribers.length = 0;
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