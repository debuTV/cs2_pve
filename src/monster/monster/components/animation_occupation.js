/**
 * @module 怪物系统/怪物组件/动画占用
 */
import { MonsterAnimator } from "../animator";
import { MonsterBuffEvents, MonsterState } from "../monster_state";
import { monstercorpse } from "../../monster_const";

/**
 * 怪物动画占用组件。
 *
 * 封装 MonsterAnimator 并在攻击、技能、死亡动作播放期间
 * 设置占用标志，禁止其他动作插入。
 * 动作结束后自动取消占用并触发回调。
 * 同时管理死亡动画/尸体降落流程。
 *
 * @navigationTitle 怪物动画占用
 */
export class MonsterAnimationOccupation {
    /**
     * 创建怪物动画占用组件。
     * @param {import("../monster").Monster} monster 所属怪物实例
     */
    constructor(monster) {
        /** 所属怪物实例。 */
        this.monster = monster;
    }

    /**
     * 初始化动画控制器，并注册动画完成回调处理占用释放和死亡流程。
     * @param {import("../../../util/definition").animations} animations 动画配置表
     */
    init(animations) {
        this.monster.animator = new MonsterAnimator(this.monster.model, animations);
        this.monster.animator.setonStateFinish((/** @type {number} */ state) => {
            if (state == MonsterState.ATTACK) this.monster.onOccupationEnd("attack");
            else if (state == MonsterState.SKILL) this.monster.onOccupationEnd("skill");
            else if (state == MonsterState.DEAD) {
                this.monster.emitEvent({ type: MonsterBuffEvents.ModelRemove });
                this.monster.entityBridge.removeAfterDeath(monstercorpse);
            }
        });
    }

    /**
     * 当前是否被占用。
     * @returns {boolean}
     */
    isOccupied() {
        return this.monster.occupation != "";
    }

    /**
     * 设置占用标记。占用期间状态切换被禁止。
     * @param {string} type 占用类型（"attack" | "skill" | "pounce"）
     */
    setOccupation(type) {
        this.monster.occupation = type;
    }

    /**
     * 占用结束回调。仅当 type 与当前占用一致时才清除。
     * @param {string} type 占用类型
     */
    onOccupationEnd(type) {
        if (this.monster.occupation !== type) return;
        this.monster.occupation = "";
    }

    /**
     * 每帧动画同步。委托 Animator。
     * @param {number} state 当前 MonsterState
     */
    tick(state) {
        this.monster.animator.tick(state);
    }

    /**
     * 判断动画是否允许切换到目标状态。委托 Animator。
     * @returns {boolean}
     */
    canSwitch() {
        return this.monster.animator.canSwitch();
    }

    /**
     * 强制播放指定状态动画。委托 Animator。
     * @param {number} nextState 目标 MonsterState
     */
    enter(nextState) {
        this.monster.animator.enter(nextState);
    }
}
