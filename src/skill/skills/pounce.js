/**
 * @module 怪物系统/怪物技能/飞扑
 */
import { DEFAULT_WORLD_GRAVITY, MovementPriority, MovementRequestType, SkillEvents } from "../skill_const";
import { SkillTemplate } from "../skill_template";

export class PounceSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
    * @param {Record<string, any>} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "pounce", id, params);
        this.distance = params.distance ?? 0;
        this.animation = params.animation ?? null;
        this.events = params.events ?? [SkillEvents.Tick];
        this._duration = params.duration ?? 1;
        this.asyncOccupation = "pounce";
    }

    canTrigger(/** @type {any} */ event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;

        const monster = this.monster;
        if (monster) {
            if (!monster.target) return false;
            if (monster.isOccupied()) return false;

            const distsq = monster.distanceTosq(monster.target);
            const attackDistSq = monster.attackdist * monster.attackdist;
            const triggerDistSq = this.distance * this.distance;
            if (!(distsq > attackDistSq && distsq < triggerDistSq)) return false;
        }

        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    tick() {
        if (this.player) return;

        const monster = this.monster;
        if (!this.running || !monster) return;

        if (monster.movementStateSnapshot.onGround) {
            this.running = false;
            monster.onOccupationEnd("pounce");
        }
    }

    trigger() {
        if (this.player) {
            this._markTriggered();
            return;
        }

        const monster = this.monster;
        if (!monster) return;

        const target = monster.target;
        if (!target) return;

        this.running = true;
        monster.animationOccupation.setOccupation("pounce");

        const start = monster.model.GetAbsOrigin();
        const targetPos = target.GetAbsOrigin();
        const duration = this._duration > 0 ? this._duration : 1;
        const velocity = {
            x: (targetPos.x - start.x) / duration,
            y: (targetPos.y - start.y) / duration,
            z: (targetPos.z - start.z + 0.5 * DEFAULT_WORLD_GRAVITY * duration * duration) / duration,
        };

        monster.submitMovementEvent({
            type: MovementRequestType.Move,
            entity: monster.model,
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