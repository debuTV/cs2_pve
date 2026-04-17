/**
 * @module 怪物系统/怪物组件/AI状态机
 */

import { MonsterState } from "../../monster_const";
import { MonsterRuntimeEvents } from "../../../util/runtime_events.js";
import { Player } from "../../../player/player/player";

/**
 * 怪物 AI 决策组件。
 *
 * 每帧评估当前意图并解析为 MonsterState 转换：
 * 1. `updateTarget` — 选择最近玩家作为目标。
 * 2. `evaluateIntent` — 根据距离和冷却判断意图（Idle/Chase/Attack/Skill）。
 * 3. `resolveState` — 将意图转化为实际状态，考虑占用锁和当前待执行技能。
 *
 * @navigationTitle 怪物 AI 决策
 */
export class MonsterBrainState {
    /**
     * 创建怪物 AI 决策组件。
     * @param {import("../monster").Monster} monster 所属怪物实例
     */
    constructor(monster) {
        /** 所属怪物实例。 */
        this.monster = monster;
    }

    /**
     * 更新追击目标：选择最近的存活玩家。同时发布 `TargetUpdate` 事件。
     * @param {Player[]} allplayers 
     */
    updateTarget(allplayers) {
        const previousTarget = this.monster.target;
        let best = null;
        let bestDistsq = Infinity;
        for (const player of allplayers) {
            const dist = this.monster.distanceTosq(player.pos);
            if (dist < bestDistsq) {
                best = player;
                bestDistsq = dist;
            }
        }
        this.monster.target = best;
        this.monster.emitRuntimeEvent(MonsterRuntimeEvents.TargetUpdate, {
            previousTarget,
            target: best,
        });
    }

    /**
     * 评估当前意图。只判断“想做什么”，不修改 `monster.state`。
     *
     * 优先级：被锁定→CHASE，有技能请求→SKILL，攻击距离内且无冷却→ATTACK，否则→CHASE。
     * @returns {number} MonsterState 枚举值
     */
    evaluateIntent() {
        if (!this.monster.target) return MonsterState.IDLE;
        const distsq = this.monster.distanceTosq(this.monster.target.pos);
        if (this.monster.movementStateMovemode === "ladder") return MonsterState.CHASE;
        if (this.monster.skillsManager.hasRequestedSkill()) return MonsterState.SKILL;
        if (distsq <= this.monster.attackdist*this.monster.attackdist && this.monster.attackCooldown <= 0) return MonsterState.ATTACK;
        return MonsterState.CHASE;
    }

    /**
     * 根据意图评估结果执行状态切换。ATTACK/SKILL 切换成功后会调用对应入口方法。
     * @param {number} intent 目标状态（MonsterState 枚举值）
     */
    resolveIntent(intent) {
        switch (intent) {
            case MonsterState.IDLE:
                this.trySwitchState(MonsterState.IDLE);
                break;
            case MonsterState.CHASE:
                this.trySwitchState(MonsterState.CHASE);
                break;
            case MonsterState.ATTACK:
                if (this.trySwitchState(MonsterState.ATTACK)) {
                    this.monster.enterAttack();
                }
                break;
            case MonsterState.SKILL:
                if (this.trySwitchState(MonsterState.SKILL)) {
                    this.monster.enterSkill();
                }
                break;
        }
    }

    /**
     * 尝试状态迁移。委托 `monster.applyStateTransition`。
     * @param {number} nextState 目标 MonsterState
     * @returns {boolean} 是否切换成功
     */
    trySwitchState(nextState) {
        return this.monster.applyStateTransition(nextState);
    }
}
