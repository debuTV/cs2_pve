/**
 * @module 怪物系统/怪物技能/双倍攻击
 */
import { SkillTemplate } from "../skill_manager";
import { MonsterBuffEvents } from "../monster_state";

/**
 * 双重攻击技能。
 *
 * 在 AttackTrue 事件触发后立即发起第二次攻击。
 * 主动技能，需要动作播放。
 *
 * @navigationTitle 双重攻击技能
 */
export class DoubleAttackSkill extends SkillTemplate {
    /**
     * 创建双重攻击技能实例。
     * @param {import("../monster").Monster} monster 
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string;
     * }} [params]
     */
    constructor(monster, params = {}) {
        super(monster);
        /** @type {string} 技能类型标识，固定为 `"doubleattack"` */
        this.typeId = "doubleattack";
        /** @type {number} 冷却时间（秒），-1 表示无冷却 */
        this.cooldown = params.cooldown ?? -1;
        /** @type {string|null} 第二次攻击播放的动画名 */
        this.animation = params.animation ?? null;
        /** @type {string[]} 监听的事件类型，默认 [AttackTrue] */
        this.events = params.events ?? [MonsterBuffEvents.AttackTrue];
    }
    /**
     * 判断当前事件是否满足双重攻击触发条件。
     *
     * 除标准检查（事件类型、冷却、占用）外，还要求目标存在。
     * 若条件满足但未激活，则静默触发第二次攻击。
     *
     * @param {any} event 技能事件对象
     * @returns {boolean} 是否需要通过动画流程触发
     */
    canTrigger(event) {
        if(!this.events.includes(event.type))return false;
        if (!this.monster.target) return false;
        if (!this._cooldownReady()) return false;
        if (!this.isActive()) {
            this.trigger();
            return false;
        }
        return true;
    }

    /**
     * 执行第二次攻击。
     *
     * 当前为预留逻辑桩——后续在此对目标玩家施加伤害。
     */
    trigger() {
        //这里给与玩家伤害
        this._markTriggered();
    }
}