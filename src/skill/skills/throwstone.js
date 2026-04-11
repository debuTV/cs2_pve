/**
 * @module 怪物系统/怪物技能/投掷石头
 */
import { MonsterRuntimeEvents } from "../../util/runtime_events.js";
import { SkillTemplate } from "../skill_template";

export class ThrowStoneSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string | null;
     *   distanceMin?: number;
     *   distanceMax?: number;
     *   damage?: number;
     *   projectileSpeed?: number;
     *   gravityScale?: number;
     *   radius?: number;
     *   maxTargets?: number;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "throwstone", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [MonsterRuntimeEvents.Tick];
        this.distanceMin = params.distanceMin ?? 0;
        this.distanceMax = params.distanceMax ?? 600;
        this.damage = params.damage ?? 10;
        this.projectileSpeed = params.projectileSpeed ?? 500;
        this.gravityScale = params.gravityScale ?? 1;
        this.radius = params.radius ?? 32;
        this.maxTargets = params.maxTargets ?? 1;
    }

    canTrigger(/** @type {any} */ event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;

        const monster = this.monster;
        if (monster) {
            if (!monster.target) return false;
            if (this.running) return false;
            if (monster.isOccupied()) return false;

            const distsq = monster.distanceTosq(monster.target);
            const minDistSq = this.distanceMin * this.distanceMin;
            const maxDistSq = this.distanceMax * this.distanceMax;
            if (distsq < minDistSq || distsq > maxDistSq) return false;
        }

        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    tick() {
        if (this.player) return;
        this.running = false;
    }

    trigger() {
        if (this.player) {
            this._markTriggered();
            return;
        }
        const monster = this.monster;
        const target = monster?.target;
        if (!monster || !target) return;

        const distsq = monster.distanceTosq(target);
        const minDistSq = this.distanceMin * this.distanceMin;
        const maxDistSq = this.distanceMax * this.distanceMax;
        if (distsq < minDistSq || distsq > maxDistSq) return;

        this.running = true;
        this._markTriggered();
        monster.emitAttackEvent(this.damage, target);
        this.running = false;
    }
}
