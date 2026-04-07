/**
 * @module 怪物系统/怪物技能/重击
 */
import { SkillEvents } from "../skill_const";
import { SkillTemplate } from "../skill_template";

export class PowerAttackSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string | null;
     *   impulse?: number;
     *   verticalBoost?: number;
     *   buffDuration?: number;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "powerattack", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [SkillEvents.AttackTrue];
        this.buffTypeId = "knockup";
        this.buffParams = {
            impulse: params.impulse ?? 300,
            verticalBoost: params.verticalBoost ?? 400,
            duration: params.buffDuration ?? 0.6,
        };
    }

    canTrigger(/** @type {any} */ event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;

        const monster = this.monster;
        if (monster) {
            if (!monster.target) return false;
            if (monster.isOccupied()) return false;
        }

        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    trigger() {
        if (this.player) {
            this._markTriggered();
            return;
        }
        const monster = this.monster;
        const target = monster?.target;
        if (!monster || !target) return;
        if (monster.distanceTosq(target) > monster.attackdist * monster.attackdist) return;

        this._markTriggered();
        monster.emitAttackEvent(Math.max(1, Math.round(monster.damage * 2)), target);
    }
}