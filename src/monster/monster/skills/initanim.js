/**
 * @module 怪物系统/怪物技能/初始动画
 */
import { SkillTemplate } from "../skill_manager";
import { MonsterBuffEvents } from "../monster_state";

/**
 * 初始动画技能。
 *
 * 生成时（默认 OnSpawn）播放一次指定动作，
 * 常用于出场动画（从地面钻出、咕叫起立等）。
 * 一次性主动技能。
 *
 * @navigationTitle 初始动画技能
 */
export class InitAnimSkill extends SkillTemplate {
    /**
     * 创建初始动画技能实例。
        * @param {import("../monster").Monster} monster 
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string;
     * }} params
     */
    constructor(monster,params) {
        super(monster);
        /** @type {string} 技能类型标识，固定为 `"initanim"` */
        this.typeId = "initanim";
        /** @type {number} 冷却时间（秒），-1 表示一次性 */
        this.cooldown = params.cooldown ?? -1;
        /** @type {string|null} 出场动画名称（如从地面钻出等） */
        this.animation = params.animation ?? null;
        /** @type {string[]} 监听的事件类型，默认 [OnSpawn] */
        this.events = params.events ?? [MonsterBuffEvents.Spawn];
    }
    /**
     * 判断当前事件是否满足初始动画触发条件。
     *
     * 检查事件类型匹配、怪物未被占用、冷却就绪。
     * 条件通过但未激活时静默触发动画播放。
     *
     * @param {any} event 技能事件对象
     * @returns {boolean} 是否需要通过动画流程触发
     */
    canTrigger(event) {
        if(!this.events.includes(event.type))return false;
        if (this.monster.isOccupied()) return false;
        if (!this._cooldownReady()) return false;
        if (!this.isActive()) {
            this.trigger();
            return false;
        }
        return true;
    }
    /**
     * 触发初始动画播放。
     *
     * 具体动作由 animation 驱动；此处仅调用 `_markTriggered`
     * 标记触发时间，防止重复播放。
     */
    trigger() 
    {
        this._markTriggered();
    }
}