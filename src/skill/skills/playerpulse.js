import { PlayerRuntimeEvents } from "../../util/runtime_events.js";
import { SkillTemplate } from "../skill_template";

export class PlayerPulseSkill extends SkillTemplate {
    /**
     * @param {import("../../player/player/player").Player | null} player
     * @param {import("../../monster/monster/monster").Monster | null} monster
     * @param {string} typeId
     * @param {number} id
     * @param {{
     *   inputKey?: string;
     *   cooldown?: number;
     *   heal?: number;
     *   armor?: number;
     *   events?: string[];
     * }} [params]
     */
    constructor(player, monster, typeId, id, params = {}) {
        super(player, monster, typeId, id, params);
        this.animation = null;
        this.events = params.events ?? [PlayerRuntimeEvents.Input];
        this.inputKey = params.inputKey ?? "InspectWeapon";
        this.heal = params.heal ?? 0;
        this.armor = params.armor ?? 0;
    }

    /**
        * @param {import("../../util/runtime_events.js").RuntimeEvent} event
     * @returns {boolean}
     */
    canTrigger(event) {
        if (!this.player || this.monster) return false;
        if (!this.events.includes(event.type)) return false;
        const inputKey = "key" in event ? event.key : undefined;
        if (event.type === PlayerRuntimeEvents.Input && inputKey !== this.inputKey) return false;
        if (!this._cooldownReady()) return false;

        this.trigger();
        return false;
    }

    trigger() {
        const player = this.player;
        if (!player || this.monster) return;

        let applied = false;
        if (this.heal > 0) {
            applied = player.heal(this.heal) || applied;
        }
        if (this.armor > 0) {
            applied = player.giveArmor(this.armor) || applied;
        }

        if (!applied) return;
        this._markTriggered();
    }
}