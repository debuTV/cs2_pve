/**
 * @module 怪物系统/怪物技能/基础属性增强
 */
import { MonsterBuffEvents } from "../monster_state";
import { SkillTemplate } from "../skill_manager";

export class CoreStats extends SkillTemplate {
    constructor(monster, params) {
        super(monster);
        this.typeId = "corestats";
        this.cooldown = params.cooldown ?? -1;
        this.animation = params.animation ?? null;
        this.events = params.events ?? [MonsterBuffEvents.Spawn];
        this.params = params;
    }

    canTrigger(event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;
        if (!this.isActive()) {
            this.trigger();
            return false;
        }
        return true;
    }

    trigger() {
        if (this.params.health_value) {
            this.monster.baseMaxHealth += this.params.health_value;
            this.monster.health += this.params.health_value;
        }
        if (this.params.health_mult) {
            this.monster.baseMaxHealth *= this.params.health_mult;
            this.monster.health *= this.params.health_mult;
        }
        if (this.monster.baseMaxHealth <= 0) {
            this.monster.baseMaxHealth = 1;
            this.monster.health = Math.max(1, this.monster.health);
        }

        if (this.params.damage_value) this.monster.baseDamage += this.params.damage_value;
        if (this.params.damage_mult) this.monster.baseDamage *= this.params.damage_mult;
        if (this.monster.baseDamage < 0) this.monster.baseDamage = 0;

        if (this.params.speed_value) this.monster.baseSpeed += this.params.speed_value;
        if (this.params.speed_mult) this.monster.baseSpeed *= this.params.speed_mult;
        if (this.monster.baseSpeed < 0) this.monster.baseSpeed = 0;

        if (this.params.reward_value) this.monster.baseReward += this.params.reward_value;
        if (this.params.reward_mult) this.monster.baseReward *= this.params.reward_mult;
        if (this.monster.baseReward < 0) this.monster.baseReward = 0;

        this.monster.buffManager.recomputeModifiers();
        this.monster.health = Math.max(0, Math.min(this.monster.health, this.monster.maxhealth));
        this._markTriggered();
    }
}
