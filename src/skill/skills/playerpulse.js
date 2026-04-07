import { SkillEvents } from "../skill_const";
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
        this.events = params.events ?? [SkillEvents.Input];
        this.inputKey = params.inputKey ?? "InspectWeapon";
        this.heal = params.heal ?? 0;
        this.armor = params.armor ?? 0;
    }

    /**
     * @param {{ type: string, key?: string }} event
     * @returns {boolean}
     */
    canTrigger(event) {
        if (!this.player || this.monster) return false;
        if (!this.events.includes(event.type)) return false;
        if (event.type === SkillEvents.Input && event.key !== this.inputKey) return false;
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