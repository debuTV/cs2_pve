/**
 * @module 怪物系统/怪物技能/初始动画
 */
import { MonsterRuntimeEvents } from "../../util/runtime_events.js";
import { SkillTemplate } from "../skill_template";

export class InitAnimSkill extends SkillTemplate {
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
        super(player, monster, "initanim", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [MonsterRuntimeEvents.Spawn];
    }
    /**
        * @param {import("../../util/runtime_events.js").RuntimeEvent} event
     */
    canTrigger(event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;
        // 怪物专属技能
        if (!this.monster)return false;
        if (this.monster && !this.monster.isOccupied()) return false;
        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    trigger() {
        this._markTriggered();
        if (this.player) {
            return;
        }
        if (this.monster)
        {
            return;
        }
    }
}