/**
 * @module 区域效果/区域效果管理器
 */
import { AreaEffect } from "./effect_service";
import { eventBus } from "../util/event_bus";
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
         * @type {Map<number, AreaEffect>} */
        this._effects = new Map();
        this._nextEffectId = 1;
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.AreaEffects.In.CreateRequest, (/** @type {import("./area_const").AreaEffectCreateRequest} */ payload) => {
                payload.result = this.create(payload);
            }),
            eventBus.on(event.AreaEffects.In.StopRequest, (/** @type {import("./area_const").AreaEffectStopRequest} */ payload) => {
                payload.result = this.stop(payload.areaEffectId);
            })
        ];
    }

    /**
     * 创建一个新的区域效果。
     * @param {import("./area_const").AreaEffectCreateRequest} desc
     * @returns {number} 成功时返回区域效果实例 id，失败返回 -1
     */
    create(desc) {
        const effect = new AreaEffect(desc);
        if (!effect.start()) {
            return -1;
        }
        this._effects.set(effect.id, effect);
        return effect.id;
    }

    /**
     * 停止指定区域效果。
     * @param {number} areaEffectId
     * @returns {boolean}
     */
    stop(areaEffectId) {
        const effect = this._effects.get(areaEffectId);
        if (!effect) return false;
        effect.stop();
        this._effects.delete(areaEffectId);
        return true;
    }

    /**
     * 每帧由外部主循环或上层 manager 调用。
     * @param {number} now
     * @param {import("./area_const").areaEffectTickContext} tickContext
     */
    tick(now, tickContext) {
        for (const [id,effect] of this._effects.entries()) {
            if (!effect) continue;

            if (!effect.isAlive()) {
                this._effects.delete(id);
                continue;
            }

            effect.tick(now, tickContext);
            if (!effect.isAlive()) {
                this._effects.delete(id);
            }
        }
    }

    /** 清理所有区域效果 */
    cleanup() {
        for (const effect of this._effects.values()) {
            effect?.stop();
        }
        this._effects.clear();
    }

    /** 销毁服务并注销事件监听。 */
    destroy() {
        this.cleanup();
        for (const unsubscribe of this._unsubscribers) {
            unsubscribe();
        }
        this._unsubscribers.length = 0;
    }
}