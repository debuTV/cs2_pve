/**
 * @module 怪物系统/怪物组件/动画占用
 */
import { MonsterBuffEvents, MonsterState } from "../monster_state";
import { monstercorpse } from "../../monster_const";

/**
 * 怪物动画控制器。
 *
 * 封装 MonsterAnimator 并在攻击、技能、死亡动作播放期间
 * 设置占用标志，禁止其他动作插入。
 * 动作结束后自动取消占用并触发回调。
 * 同时管理死亡动画/尸体降落流程。
 *
 * @navigationTitle 怪物动画控制器
 */
export class MonsterAnimator {
    /**
     * 创建怪物动画控制器。
     * @param {import("../monster").Monster} monster 所属怪物实例
     * @param {Entity} model Source 2 怪物模型实体
     * @param {import("../../util/definition").animations} animConfig 动画配置表（idle/walk/attack/skill/dead 动画名数组）
     */
    constructor(monster,model,animConfig) {
        /** 所属怪物实例。 */
        this.monster = monster;
        /** Source 2 怪物模型实体。 */
        this.model = model;
        /**
         * 动画配置表。每个键对应一组可随机播放的动画名。
         * @type {import("../../util/definition").animations}
         */
        this.animConfig = animConfig;
        /** 是否处于动作占用期。播放动画时置 true，`OnAnimationDone` 事件触发后置 false。 */
        this.locked = false;
        /** 当前动画对应的 MonsterState 值。由 `tick` / `enter` 设置。 */
        this.currentstats=-1;
        /** 动作结束回调。仅当 type 与当前占用一致时才清除。 */
        this.onStateFinish = null;
        Instance.ConnectOutput(this.model,"OnAnimationDone",(e)=>{
            //动画播放完了
            this.locked = false;
            this.onStateFinish?.(this.currentstats);
        });
    }
    /**
     * 设置动画播放完成回调。当任一动画结束（`OnAnimationDone`）时触发，
     * 传入当时的 MonsterState 值。
     * @param {(state: number) => void} callback 状态回调
     */
    setonStateFinish(callback)
    {
        this.onStateFinish=callback;
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
     * 每帧更新。若 `locked` 则跳过；否则根据当前状态播放对应动画。
     * @param {number} state 当前 MonsterState
     */
    tick(state) {
        if (this.locked) return;
        this.currentstats=state;
        switch (state) {
            case MonsterState.IDLE:
                this.play("idle");
                break;
            case MonsterState.CHASE:
                this.play("walk");
                break;
            case MonsterState.ATTACK:
                this.play("attack");
                break;
            case MonsterState.SKILL:
                this.play("skill");
                break;
            case MonsterState.DEAD:
                this.play("dead");
                break;
        }
    }

    /**
     * 未被占用时始终允许；占用期间仅当当前不是 ATTACK/SKILL 时允许。
     * @returns {boolean}
     */
    canSwitch() {
        if (!this.locked) {
            return true;
        }
        if (this.currentstats==MonsterState.ATTACK||this.currentstats==MonsterState.SKILL) {
            return false;
        }
        return true;
    }

    /**
     * 强制播放指定状态对应的动画，无视 `locked` 状态。
     * 由 `applyStateTransition` 在状态切换成功后调用。
     * @param {number} nextState MonsterState
     */
    enter(nextState) {
        this.currentstats=nextState;
        switch (nextState) {
            case MonsterState.IDLE:
                this.play("idle");
                break;
            case MonsterState.CHASE:
                this.play("walk");
                break;
            case MonsterState.ATTACK:
                this.play("attack");
                break;
            case MonsterState.SKILL:
                this.play("skill");
                break;
            case MonsterState.DEAD:
                this.play("dead");
                break;
        }
    }
    /**
     * 播放指定类型的动画。从配置表中随机选择一个动画名，
     * 通过 `EntFireAtTarget(SetAnimation)` 发送给引擎。
     * @param {string} type 动画类型键（"idle"|"walk"|"attack"|"skill"|"dead"）
     */
    play(type) {
        const list = this.animConfig[type];
        if (!list || list.length === 0) return null;
        const anim = list[Math.floor(Math.random() * list.length)];
        if (!anim) return;
        Instance.EntFireAtTarget({target:this.model,input:"SetAnimation",value:anim});
        this.locked=true;
    }
}
