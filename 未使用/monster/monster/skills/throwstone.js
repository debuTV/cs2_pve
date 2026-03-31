/**
 * @module 怪物系统/怪物技能/投掷石头
 */
import { SkillTemplate } from "../skill_manager";
import { MonsterBuffEvents } from "../monster_state";

/**
 * 抛射技能。
 *
 * 向目标投掷抛射物，支持重力影响和爆炸半径。
 * 当目标在 distanceMin – distanceMax 范围内时触发。
 * 主动技能，trigger 待实现。
 *
 * @navigationTitle 抛射技能
 */
export class ThrowStoneSkill extends SkillTemplate {
    /**
     * 创建投石技能实例。
     * @param {import("../monster").Monster} monster 
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string;
     *   distanceMin?: number;
     *   distanceMax?: number;
     *   damage?: number;
     *   projectileSpeed?: number;
     *   gravityScale?: number;
     *   radius?: number;
     *   maxTargets?: number;
     * }} params
     */
    constructor(monster, params) {
        super(monster);
        /** @type {string} 技能类型标识，固定为 `"throwstone"` */
        this.typeId = "throwstone";
        /** @type {number} 冷却时间（秒），-1 表示无冷却 */
        this.cooldown = params.cooldown ?? -1;
        /** @type {string|null} 抛射动画名称 */
        this.animation = params.animation ?? null;
        /** @type {string[]} 监听的事件类型，默认 [OnTick] */
        this.events = params.events ?? [MonsterBuffEvents.Tick];
        /** @type {number} 触发最小距离 */
        this.distanceMin = params.distanceMin ?? 0;
        /** @type {number} 触发最大距离 */
        this.distanceMax = params.distanceMax ?? 600;
        /** @type {number} 抛射物伤害值 */
        this.damage = params.damage ?? 10;
        /** @type {number} 抛射物速度 */
        this.projectileSpeed = params.projectileSpeed ?? 500;
        /** @type {number} 重力缩放系数 */
        this.gravityScale = params.gravityScale ?? 1;
        /** @type {number} 爆炸半径 */
        this.radius = params.radius ?? 32;
        /** @type {number} 单次最大命中目标数 */
        this.maxTargets = params.maxTargets ?? 1;
        /** @type {any} 后续接入独立投掷类实例 */
        this._projectile = null;
        /** @type {any} tick 上下文缓存 */
        this._tickCtx = null;
    }
    /**
     * 判断当前事件是否满足抛射触发条件。
     *
     * 除标准检查外，要求目标存在且距离在 `distanceMin` – `distanceMax`
     * 范围内。通过时缓存 tick 上下文。
     *
     * @param {any} event 技能事件对象
     * @returns {boolean} 是否需要通过动画流程触发
     */
    canTrigger(event) {
        if (!this.events.includes(event.type)) return false;
        if (!this.monster.target) return false;
        if (this.running) return false;
        if (this.monster.isOccupied()) return false;
        if (!this._cooldownReady()) return false;
        const distsq = this.monster.distanceTosq(this.monster.target);
        if (distsq < this.distanceMin*this.distanceMin || distsq > this.distanceMax*this.distanceMax) return false;
        this._tickCtx = { dt: event.dt, allmpos: event.allmpos };
        if (!this.isActive()) {
            this.trigger();
            return false;
        }
        return true;
    }
    /**
     * 抛射物逐帧更新。
     *
     * 当前为预留逻辑桩——后续将在此驱动投掷类实例的 update，
     * 并收集命中结果。
     */
    tick() {
        if (!this.running) return;
        // 后续在此驱动投掷类实例的 update，并收集命中结果
        // if (this._projectile) {
        //     this._projectile.update(dt);
        //     if (this._projectile.isFinished()) {
        //         const hitTargets = this._projectile.getHitTargets();
        //         // 处理命中回调
        //         this.running = false;
        //         this._projectile = null;
        //     }
        // }
    }
    /**
     * 触发抛射。
     *
     * 当前为预留逻辑桩——后续将创建投掷类实例并设置 running=true。
     */
    trigger() {
        // this._projectile = new ProjectileRunner({ ... });
        // this.running = true;
        this._markTriggered();
    }
}
