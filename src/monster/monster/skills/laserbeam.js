/**
 * @module 怪物系统/怪物技能/激光
 */
import { Instance } from "cs_script/point_script";
import { SkillTemplate } from "../skill_manager";
import { MonsterBuffEvents } from "../monster_state";

/**
 * 激光技能。
 *
 * 向当前目标方向发射激光，支持持续照射（`duration > 0`）
 * 和瞬发两种模式。可配置宽度、穿透、最大目标数、启动延迟。
 * 持续模式下通过 tick 累加器按 tickInterval 间隔造成伤害。
 *
 * @navigationTitle 激光技能
 */
export class LaserBeamSkill extends SkillTemplate {
    /**
     * 创建激光射线技能实例。
     * @param {import("../monster").Monster} monster 
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string;
     *   distance?: number;
     *   duration?: number;
     *   damagePerSecond?: number;
     *   tickInterval?: number;
     *   width?: number;
     *   pierce?: boolean;
     *   maxTargets?: number;
     *   startDelay?: number;
     * }} params
     */
    constructor(monster, params) {
        super(monster);
        /** @type {string} 技能类型标识，固定为 `"laserbeam"` */
        this.typeId = "laserbeam";
        /** @type {number} 冷却时间（秒），-1 表示无冷却 */
        this.cooldown = params.cooldown ?? -1;
        /** @type {string|null} 激光释放动画名称 */
        this.animation = params.animation ?? null;
        /** @type {string[]} 监听的事件类型，默认 [OnTick] */
        this.events = params.events ?? [MonsterBuffEvents.Tick];
        /** @type {number} 激光最大射程（单位距离） */
        this.distance = params.distance ?? 500;
        /** @type {number} 持续时间（秒）；>0 为持续光束，<=0 为瞬时激光 */
        this.duration = params.duration ?? 0;
        /** @type {number} 每秒伤害量 */
        this.damagePerSecond = params.damagePerSecond ?? 20;
        /** @type {number} 持续模式下伤害判定间隔（秒） */
        this.tickInterval = params.tickInterval ?? 0.25;
        /** @type {number} 激光宽度 */
        this.width = params.width ?? 8;
        /** @type {boolean} 是否穿透目标 */
        this.pierce = params.pierce ?? false;
        /** @type {number} 单次发射最大命中目标数 */
        this.maxTargets = params.maxTargets ?? 1;
        /** @type {number} 激光启动延迟（秒） */
        this.startDelay = params.startDelay ?? 0;
        /** tick 累积器，用于控制持续伤害节奏 */
        this._tickAccumulator = 0;
        /** @type {any} tick 上下文缓存 */
        this._tickCtx = null;
    }
    /**
     * 判断当前事件是否满足激光触发条件。
     *
     * 除标准检查（事件类型、冷却、占用、运行中）外，还要求
     * 目标存在且在射程内。通过时缓存 tick 上下文（dt/allmpos）
     * 供后续 tick 使用。
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
        if (distsq > this.distance*this.distance) return false;
        this._tickCtx = { dt: event.dt, allmpos: event.allmpos };
        if (!this.isActive()) {
            this.trigger();
            return false;
        }
        return true;
    }
    /**
     * 持续光束的逐帧更新。
     *
     * 检查光束是否超时结束；后续将在此按 `tickInterval`
     * 累积伤害并执行射线检测。
     */
    tick() {
        if (!this.running) return;
        const now = Instance.GetGameTime();
        // 持续光束超时结束
        if (this.duration > 0 && this.lastTriggerTime + this.duration <= now) {
            this.running = false;
            this._tickAccumulator = 0;
            return;
        }
        // 后续在此按 tickInterval 累积伤害
        // this._tickAccumulator += dt;
        // while (this._tickAccumulator >= this.tickInterval) {
        //     this._tickAccumulator -= this.tickInterval;
        //     // 射线检测 + 造成伤害
        // }
    }
    /**
     * 触发激光发射。
     *
     * 当前为预留逻辑桩——后续将根据 `duration` 区分
     * 瞬时激光（单次命中结算）与持续光束（设置 running=true）。
     */
    trigger() {
        // if (this.duration > 0) this.running = true;  // 持续光束
        // else { /* 瞬时激光：一次性命中结算 */ }
        this._markTriggered();
    }
}
