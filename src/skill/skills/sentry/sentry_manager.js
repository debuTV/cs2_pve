/**
 * @module 技能系统/哨戒炮台/炮台管理器
 *
 * 管理当前场景内所有存活的 SentryTurret 实例。
 * 由 SentrySkill 在部署炮台时创建实例并注册进来，内部自动驱动每个炮台的 tick。
 *
 * 使用方式：
 * ```js
 * // 在主遊戏循环里调用
 * sentryManager.tick();
 *
 * // 添加一台炮台
 * sentryManager.register(sentryTurretInstance);
 *
 * // 手动销毁所有炮台（例如波次结束时）
 * sentryManager.destroyAll();
 * ```
 */
import { SentryTurret } from "./sentry_turret";
import { SentryState } from "./sentry_const";

export class SentryManager {
    constructor() {
        /** @type {Set<SentryTurret>} */
        this._turrets = new Set();
        /** @type {() => import("../../../monster/monster/monster").Monster[]} */
        this._monsterProvider = () => [];
    }

    /**
     * @param {() => import("../../../monster/monster/monster").Monster[]} provider
     */
    setMonsterProvider(provider) {
        this._monsterProvider = typeof provider === "function" ? provider : () => [];
    }

    /**
     * @returns {import("../../../monster/monster/monster").Monster[]}
     */
    getActiveMonsters() {
        return this._monsterProvider();
    }

    /**
     * 注册一台炮台实例。
     * 炮台销毁时会通过 onDestroyed 回调自动从集合移除。
     * @param {SentryTurret} turret
     */
    register(turret) {
        turret.getActiveMonsters = () => this.getActiveMonsters();
        this._turrets.add(turret);
    }

    /**
     * 每帧调用一次，驱动所有活跃炮台的 tick。
     * 已销毁的炮台会被惰性清除。
     */
    tick() {
        for (const turret of this._turrets) {
            if (turret.state === SentryState.DESTROYED) {
                this._turrets.delete(turret);
                continue;
            }
            turret.tick();
        }
    }

    /**
     * 立即销毁所有炮台（波次结束等场景使用）。
     */
    destroyAll() {
        for (const turret of this._turrets) {
            turret.destroy();
        }
        this._turrets.clear();
    }

    /**
     * 销毁指定玩家拥有的所有炮台。
     * @param {number} ownerKey
     */
    destroyByOwner(ownerKey) {
        for (const turret of this._turrets) {
            if (turret.ownerKey === ownerKey) {
                turret.destroy();
            }
        }
    }

    /**
     * 返回指定玩家当前拥有的活跃炮台数量。
     * @param {number} ownerKey
     * @returns {number}
     */
    countByOwner(ownerKey) {
        let count = 0;
        for (const turret of this._turrets) {
            if (turret.ownerKey === ownerKey && turret.state !== SentryState.DESTROYED) count++;
        }
        return count;
    }

    destroy() {
        this.destroyAll();
    }
}

/** 全局单例（与其他 manager 一致） */
export const sentryManager = new SentryManager();
