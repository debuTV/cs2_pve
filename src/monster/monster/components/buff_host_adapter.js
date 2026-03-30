import { Instance } from "cs_script/point_script";
import { BuffEffectType, BuffTargetType } from "../../../buff/buff_const";
import { BuffHostAdapter } from "../../../buff/buff_host_adapter";
import { MonsterState } from "../monster_state";

const MONSTER_RESOURCE_KEYS = new Set(["health"]);
const MONSTER_STAT_KEYS = new Set(["maxHealth", "attack", "speed"]);

export class MonsterBuffHostAdapter extends BuffHostAdapter {
    constructor(monster) {
        super();
        this.monster = monster;
        this.hostType = BuffTargetType.MONSTER;
        this.hostId = monster.id;
    }

    getNow() {
        return Instance.GetGameTime();
    }

    isAlive() {
        return this.monster.state !== MonsterState.DEAD;
    }

    getState() {
        return this.monster.state;
    }

    getResource(key) {
        switch (key) {
            case "health":
                return this.monster.health;
            default:
                return 0;
        }
    }

    setResource(key, value) {
        return this.addResource(key, value - this.getResource(key), {
            reason: `buff:set:${key}`,
        });
    }

    addResource(key, delta, meta = null) {
        switch (key) {
            case "health":
                return this._addHealth(delta, meta);
            default:
                return 0;
        }
    }

    clampResource(key, value) {
        switch (key) {
            case "health":
                return Math.max(0, Math.min(value, this.monster.maxhealth));
            default:
                return value;
        }
    }

    getBaseStat(key) {
        switch (key) {
            case "maxHealth":
                return this.monster.baseMaxHealth;
            case "attack":
                return this.monster.baseDamage;
            case "speed":
                return this.monster.baseSpeed;
            default:
                return 0;
        }
    }

    setDerivedStat(key, value) {
        switch (key) {
            case "maxHealth":
                this.monster.maxhealth = Math.max(1, value);
                break;
            case "attack":
                this.monster.damage = Math.max(0, value);
                break;
            case "speed":
                this.monster.speed = Math.max(0, value);
                break;
            default:
                break;
        }
    }

    recomputeDerivedStats() {
        this.monster.maxhealth = Math.max(1, this.monster.maxhealth);
        this.monster.damage = Math.max(0, this.monster.damage);
        this.monster.speed = Math.max(0, this.monster.speed);
        this.monster.health = this.clampResource("health", this.monster.health);
    }

    emitBuffEvent(eventType, payload) {
        void eventType;
        void payload;
    }

    supportsEffect(effect) {
        if (!effect) return false;

        switch (effect.type) {
            case BuffEffectType.INSTANT_RESOURCE:
            case BuffEffectType.PERIODIC_RESOURCE:
                return MONSTER_RESOURCE_KEYS.has(effect.key);
            case BuffEffectType.STAT_MODIFIER:
                return MONSTER_STAT_KEYS.has(effect.key);
            case BuffEffectType.GAIN_MODIFIER:
            default:
                return false;
        }
    }

    _addHealth(delta, meta) {
        if (!delta) return 0;
        if (this.monster.state === MonsterState.DEAD) return 0;

        if (delta > 0) {
            const oldHealth = this.monster.health;
            const nextHealth = this.clampResource("health", oldHealth + delta);
            const actual = nextHealth - oldHealth;
            if (!actual) return 0;
            this.monster.health = nextHealth;
            return actual;
        }

        this.monster.healthCombat.takeDamage(-delta, null, meta);
        return delta;
    }
}
