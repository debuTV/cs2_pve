/**
 * @module 怪物系统/怪物技能/基础属性增强
 */
import { Monster } from "../../monster/monster/monster";
import { Player } from "../../player/player/player";
import { SkillEvents } from "../skill_const";
import { SkillTemplate } from "../skill_template";

export class CoreStats extends SkillTemplate {
    /**
     * @param {Player|null} player
     * @param {Monster|null} monster
     * @param {number} id
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string | null;
     *   health_mult?: number;
     *   health_value?: number;
     *   damage_mult?: number;
     *   damage_value?: number;
     *   speed_mult?: number;
     *   speed_value?: number;
     *   reward_mult?: number;
     *   reward_value?: number;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "corestats", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [SkillEvents.Spawn];
        this.params = params;
    }

    /**
     * @param {any} event
     */
    canTrigger(event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;
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

        if (this.monster) {
            if (this.params.health_value) {
                this.monster.baseMaxHealth += this.params.health_value;
                this.monster.health += this.params.health_value;
            }
            if (this.params.health_mult) {
                this.monster.baseMaxHealth *= this.params.health_mult;
                this.monster.health *= this.params.health_mult;
            }
            if (this.params.damage_value) this.monster.baseDamage += this.params.damage_value;
            if (this.params.damage_mult) this.monster.baseDamage *= this.params.damage_mult;
            if (this.params.speed_value ) this.monster.baseSpeed += this.params.speed_value;
            if (this.params.speed_mult ) this.monster.baseSpeed *= this.params.speed_mult;
            if (this.params.reward_value ) this.monster.baseReward += this.params.reward_value;
            if (this.params.reward_mult ) this.monster.baseReward *= this.params.reward_mult;
        }
    }
}
