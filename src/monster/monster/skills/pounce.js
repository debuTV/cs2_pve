/**
 * @module 怪物系统/怪物技能/飞扑
 */
import { SkillTemplate } from "../skill_manager";
import { MonsterBuffEvents } from "../monster_state";
import { gravity } from "../../monster_const";
import { MovementPriority, MovementRequestType } from "../../../util/definition";

/**
 * 飞扑技能。
 *
 * 当目标距离介于攻击距离和 `distance` 之间时，
 * 怪物向目标发起抛物线跳跃。
 * Monster 内部计算最终 velocity，通过移动事件发给 main 执行。
 *
 * @navigationTitle 飞扑技能
 */
export class PounceSkill extends SkillTemplate {
    /**
     * @param {import("../monster").Monster} monster 
     * @param {{
     *   cooldown?: number;
     *   distance: number;
     *   events?: string[];
     *   animation?: string;
     *   duration?: number;
     * }} params
     */
    constructor(monster,params) {
        super(monster);
        this.typeId = "pounce";
        this.cooldown = params.cooldown ?? -1;
        this.distance = params.distance;
        this.animation = params.animation ?? null;
        this.events = params.events ?? [MonsterBuffEvents.Tick];
        /** 飞扑总时长（秒）。 */
        this._duration = params.duration ?? 1;
        /** 异步占用：飞扑由技能自行在落地时释放，动画结束不提前归还控制权。 */
        this.asyncOccupation = "pounce";
    }

    /**
     * 判断当前事件是否满足飞扑触发条件。
     * @param {any} event
     * @returns {boolean}
     */
    canTrigger(event) {
        if (!this.events.includes(event.type)) return false;
        if (!this.monster.target) return false;
        if (this.monster.isOccupied()) return false;
        if (!this._cooldownReady()) return false;
        const distsq = this.monster.distanceTosq(this.monster.target);
        if (!(distsq > this.monster.attackdist*this.monster.attackdist && distsq < this.distance*this.distance)) return false;
        if (!this.isActive()) {
            this.trigger();
            return false;
        }
        return true;
    }

    /**
     * 飞扑逐帧更新。
     * 在新架构下，pounce 的物理推进由 main 侧 Movement 执行。
     * Monster 侧只需检查状态摘要判断飞扑是否结束。
     */
    tick() {
        if (!this.running) return;
        if (this.monster.movementStateSnapshot.onGround) {
            this.running = false;
            this.monster.onOccupationEnd("pounce");
        }
    }

    /**
     * 发起飞扑。
     * 计算抛物线初速度，通过移动事件提交给 main 执行 setVelocity + setMode。
     */
    trigger() {
        if (!this.monster.target) return;
        this.running = true;
        this.monster.animationOccupation.setOccupation("pounce");
        const start = this.monster.model.GetAbsOrigin();
        const targetPos = this.monster.target.GetAbsOrigin();
        const T = this._duration;

        // 反解抛物线初速度
        const velocity = {
            x: (targetPos.x - start.x) / T,
            y: (targetPos.y - start.y) / T,
            z: (targetPos.z - start.z + 0.5 * gravity * T * T) / T,
        };

        this.monster.submitMovementEvent({
            type: MovementRequestType.Move,
            entity: this.monster.model,
            priority: MovementPriority.Skill,
            targetPosition: targetPos,
            usePathRefresh: false,
            useNPCSeparation: true,
            Mode: "air",
            Velocity: velocity,
        });

        this._markTriggered();
    }
}