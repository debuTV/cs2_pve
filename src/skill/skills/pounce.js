/**
 * @module 怪物系统/怪物技能/飞扑
 */
import { DEFAULT_WORLD_GRAVITY, MovementPriority, MovementRequestType } from "../skill_const";
import { MonsterRuntimeEvents } from "../../util/runtime_events.js";
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
        this.events = params.events ?? [MonsterRuntimeEvents.Tick];
        this._duration = params.duration ?? 1;
        this._hitDistance = params.hitDistance ?? 0;
        this._impactVelocity = null;
        this._impactTarget = null;
        this.asyncOccupation = "pounce";
    }

    canTrigger(/** @type {any} */ event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;

        const monster = this.monster;
        if (monster) {
            if (!monster.target) return false;
            if (monster.isOccupied()) return false;

            const distsq = monster.distanceTosq(monster.target.pos);
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

        if (monster.movementStateMovemode==="walk") {
            this._applyLandingImpact(monster);
            this.running = false;
            monster.onOccupationEnd("pounce");
            this._resetImpactState();
        }
    }

    /**
     * @param {import("../../monster/monster/monster").Monster} monster
     */
    _applyLandingImpact(monster) {
        const target = this._impactTarget;
        const pawn = target?.entityBridge?.pawn;
        if (!target || !pawn?.IsValid?.()) return;

        const hitDistance = this._hitDistance > 0 ? this._hitDistance : monster.attackdist;
        if (!(hitDistance > 0)) return;

        const targetPos = pawn.GetAbsOrigin?.() ?? target.pos;
        if (!targetPos) return;
        if (monster.distanceTosq(targetPos) > hitDistance * hitDistance) return;

        const damage = Math.max(1, Math.round(monster.damage * 2));
        const attacker = monster.model?.IsValid?.() ? monster.model : null;
        const killed = target.takeDamage(damage, attacker);

        if (!killed && this._impactVelocity) {
            pawn.Teleport({
                velocity: { ...this._impactVelocity },
            });
        }
    }

    _resetImpactState() {
        this._impactVelocity = null;
        this._impactTarget = null;
    }

    trigger() {
        if (this.player) {
            this._markTriggered();
            return;
        }

        const monster = this.monster;
        if (!monster) return;

        const model = monster.model;
        const target = monster.target;
        if (!model?.IsValid?.() || !target) return;

        const start = monster.pos;
        const targetPos = target.pos;

        const duration = this._duration > 0 ? this._duration : 1;
        const velocity = {
            x: (targetPos.x - start.x) / duration,
            y: (targetPos.y - start.y) / duration,
            z: (targetPos.z - start.z + 0.5 * DEFAULT_WORLD_GRAVITY * duration * duration) / duration,
        };

        const horizontalSpeed = Math.hypot(velocity.x, velocity.y);
        const impactHorizontalScale = horizontalSpeed > 1e-6 ? 200 / horizontalSpeed : 0;
        this._impactVelocity = {
            x: velocity.x * impactHorizontalScale,
            y: velocity.y * impactHorizontalScale,
            z: 400,
        };
        this._impactTarget = target;

        monster.animation.setOccupation("pounce");
        this.running = true;

        const submitted = monster.submitMovementEvent({
            type: MovementRequestType.Move,
            entity: model,
            priority: MovementPriority.Skill,
            targetPosition: targetPos,
            usePathRefresh: false,
            useNPCSeparation: true,
            Mode: "air",
            Velocity: velocity,
            preserveVelocityInAir: true,
        });

        if (!submitted) {
            this.running = false;
            this._resetImpactState();
            monster.onOccupationEnd("pounce");
            return;
        }

        this._markTriggered();
    }
}