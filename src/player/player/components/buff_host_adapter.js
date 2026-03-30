import { Instance } from "cs_script/point_script";
import { BuffEffectType, BuffTargetType } from "../../../buff/buff_const";
import { BuffHostAdapter } from "../../../buff/buff_host_adapter";
import { PlayerState } from "../../player_const";

const PLAYER_RESOURCE_KEYS = new Set(["health", "armor", "money", "exp"]);
const PLAYER_STAT_KEYS = new Set(["maxHealth", "attack"]);
const PLAYER_GAIN_KEYS = new Set(["moneyGain", "expGain"]);

export class PlayerBuffHostAdapter extends BuffHostAdapter {
    constructor(player) {
        super();
        this.player = player;
        this.hostType = BuffTargetType.PLAYER;
        this.hostId = player.id;
    }

    getNow() {
        return Instance.GetGameTime();
    }

    isAlive() {
        return this.player.isAlive;
    }

    getState() {
        return this.player.state;
    }

    getPawn() {
        return this.player.entityBridge.pawn;
    }

    getResource(key) {
        const stats = this.player.stats;
        switch (key) {
            case "health":
                return stats.health;
            case "armor":
                return stats.armor;
            case "money":
                return stats.money;
            case "exp":
                return stats.exp;
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
            case "armor":
                return this._addArmor(delta);
            case "money":
                return this.player.stats.applyRawMoneyDelta(delta, meta?.reason);
            case "exp":
                return this.player.stats.applyRawExpDelta(delta, meta?.reason);
            default:
                return 0;
        }
    }

    clampResource(key, value) {
        switch (key) {
            case "health":
                return Math.max(0, Math.min(Math.round(value), Math.round(this.player.stats.maxHealth)));
            case "armor":
                return Math.max(0, Math.min(Math.round(value), 100));
            case "money":
            case "exp":
                return Math.max(0, Math.round(value));
            default:
                return value;
        }
    }

    getBaseStat(key) {
        const stats = this.player.stats;
        switch (key) {
            case "maxHealth":
                return stats.baseMaxHealth;
            case "attack":
                return stats.baseAttack;
            default:
                return 0;
        }
    }

    setDerivedStat(key, value) {
        const stats = this.player.stats;
        switch (key) {
            case "maxHealth":
                stats.maxHealth = Math.max(1, Math.round(value));
                break;
            case "attack":
                stats.attack = Math.max(0, value);
                break;
            default:
                break;
        }
    }

    recomputeDerivedStats() {
        const stats = this.player.stats;
        stats.maxHealth = Math.max(1, Math.round(stats.maxHealth));
        stats.attack = Math.max(0, stats.attack);
        stats.health = this.clampResource("health", stats.health);

        this.player.entityBridge.syncMaxHealth(stats.maxHealth);
        this.player.entityBridge.syncHealth(stats.health);
    }

    getGainModifier(key) {
        const stats = this.player.stats;
        switch (key) {
            case "moneyGain":
                return stats.moneyGain;
            case "expGain":
                return stats.expGain;
            default:
                return 1;
        }
    }

    getBaseGainModifier(key) {
        const stats = this.player.stats;
        switch (key) {
            case "moneyGain":
                return stats.baseMoneyGain;
            case "expGain":
                return stats.baseExpGain;
            default:
                return 1;
        }
    }

    setGainModifier(key, value) {
        const nextValue = Math.max(0, value);
        switch (key) {
            case "moneyGain":
                this.player.stats.moneyGain = nextValue;
                break;
            case "expGain":
                this.player.stats.expGain = nextValue;
                break;
            default:
                break;
        }
    }

    recomputeGainModifiers() {
        this.player.stats.moneyGain = Math.max(0, this.player.stats.moneyGain);
        this.player.stats.expGain = Math.max(0, this.player.stats.expGain);
    }

    emitBuffEvent(eventType, payload) {
        switch (eventType) {
            case "added":
                this.player.events.OnBuffAdded?.(payload);
                break;
            case "removed":
                this.player.events.OnBuffRemoved?.(payload);
                break;
            case "refreshed":
                this.player.events.OnBuffRefreshed?.(payload);
                break;
            default:
                break;
        }
    }

    supportsEffect(effect) {
        if (!effect) return false;

        switch (effect.type) {
            case BuffEffectType.INSTANT_RESOURCE:
            case BuffEffectType.PERIODIC_RESOURCE:
                return PLAYER_RESOURCE_KEYS.has(effect.key);
            case BuffEffectType.STAT_MODIFIER:
                return PLAYER_STAT_KEYS.has(effect.key);
            case BuffEffectType.GAIN_MODIFIER:
                return PLAYER_GAIN_KEYS.has(effect.key);
            default:
                return false;
        }
    }

    _addHealth(delta, meta) {
        if (!delta) return 0;

        const stats = this.player.stats;
        const oldHealth = stats.health;
        const nextHealth = this.clampResource("health", oldHealth + delta);
        const actual = nextHealth - oldHealth;
        if (!actual) return 0;

        stats.setHealth(nextHealth);
        this.player.entityBridge.syncHealth(stats.health);

        if (actual > 0) {
            this.player.events.OnHeal?.(actual);
            return actual;
        }

        const damage = -actual;
        const ctx = {
            damage,
            attacker: null,
            source: meta?.source ?? null,
            reason: meta?.reason,
        };

        this.player.buffManager.onAfterDamageTaken(ctx);
        this.player.events.OnAfterDamageTaken?.(damage, null);

        if (stats.health <= 0 && this.player.state !== PlayerState.DEAD) {
            this.player.healthCombat.die(null);
        }

        return actual;
    }

    _addArmor(delta) {
        if (!delta) return 0;

        const stats = this.player.stats;
        const oldArmor = stats.armor;
        const nextArmor = this.clampResource("armor", oldArmor + delta);
        const actual = nextArmor - oldArmor;
        if (!actual) return 0;

        stats.setArmor(nextArmor);
        this.player.entityBridge.syncArmor(stats.armor);
        return actual;
    }
}
