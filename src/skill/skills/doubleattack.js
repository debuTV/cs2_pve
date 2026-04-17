/**
 * @module 怪物系统/怪物技能/双倍攻击
 */
import { MonsterRuntimeEvents } from "../../util/runtime_events.js";
import { SkillTemplate } from "../skill_template";

export class DoubleAttackSkill extends SkillTemplate {
    /**
    * @param {import("../../player/player/player.js").Player|null} player
    * @param {import("../../monster/monster/monster.js").Monster|null} monster
     * @param {number} id
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string | null;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "doubleattack", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [MonsterRuntimeEvents.AttackTrue];
    }
    /**
        * @param {import("../../util/runtime_events.js").RuntimeEvent} event
     */
    canTrigger(event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;
        if (this.monster && !this.monster.target) return false;
        if (!this.monster)return false;
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
        if (monster.distanceTosq(target.pos) > monster.attackdist * monster.attackdist) return;

        this._markTriggered();
        const pawn=target.entityBridge?.pawn;
        if(pawn)monster.emitAttackEvent(monster.damage, pawn);
    }
}