/**
 * @module 玩家系统/玩家/组件/玩家数值
 */
import {
    MAX_LEVEL,
    getExpRequired,
    getMaxHealthForLevel,
    getAttackForLevel,
    getCritChanceForLevel,
    getCritMultiplierForLevel,
    getHealPolicyForLevel,
    scaleOutgoingDamage,
    LevelUpHealPolicy,
} from "../../player_const";

function scalePositiveAmount(amount, multiplier) {
    return amount > 0 ? amount * multiplier : amount;
}

export class PlayerStats {
    constructor(player) {
        this.player = player;

        this.baseMaxHealth = getMaxHealthForLevel(1);
        this.maxHealth = this.baseMaxHealth;
        this.health = this.maxHealth;
        this.armor = 0;

        this.baseAttack = getAttackForLevel(1);
        this.attack = this.baseAttack;
        this.critChance = getCritChanceForLevel(1);
        this.critMultiplier = getCritMultiplierForLevel(1);

        this.baseMoneyGain = 1;
        this.moneyGain = 1;
        this.baseExpGain = 1;
        this.expGain = 1;

        this.money = 0;
        this.exp = 0;
        this.level = 1;

        this.score = 0;
        this.kills = 0;
        this.damageDealt = 0;
        this.headshots = 0;
        this.waveProgress = 0;
    }

    addMoney(amount, reason) {
        return this.applyMoneyDelta(amount, reason, true);
    }

    applyMoneyDelta(amount, reason, applyGain = true) {
        const scaledAmount = scalePositiveAmount(amount, applyGain ? this.moneyGain : 1);
        return this.applyRawMoneyDelta(scaledAmount, reason);
    }

    applyRawMoneyDelta(amount, reason) {
        if (!amount) return 0;

        const old = this.money;
        const next = Math.max(0, Math.round(old + amount));
        const actual = next - old;
        if (!actual) return 0;

        this.money = next;
        this.player.events.OnMoneyChanged?.(old, this.money, actual, reason);
        return actual;
    }

    deductMoney(amount) {
        if (this.money < amount) return false;
        this.applyRawMoneyDelta(-amount);
        return true;
    }

    addExp(amount, reason) {
        return this.applyExpDelta(amount, reason, true);
    }

    applyExpDelta(amount, reason, applyGain = true) {
        const scaledAmount = scalePositiveAmount(amount, applyGain ? this.expGain : 1);
        return this.applyRawExpDelta(scaledAmount, reason);
    }

    applyRawExpDelta(amount, reason) {
        if (!amount) return 0;
        if (this.level >= MAX_LEVEL) return 0;

        const oldExp = this.exp;
        const next = Math.max(0, Math.round(oldExp + amount));
        const actual = next - oldExp;
        if (!actual) return 0;

        this.exp = next;
        this.player.events.OnExpChanged?.(this.exp, actual, reason);

        if (actual > 0) {
            while (this._checkLevelUp()) { /* keep going */ }
        }

        return actual;
    }

    getExpNeeded() {
        return getExpRequired(this.level);
    }

    _checkLevelUp() {
        if (this.level >= MAX_LEVEL) {
            this.exp = 0;
            return false;
        }

        const needed = this.getExpNeeded();
        if (needed <= 0 || this.exp < needed) return false;

        const oldLevel = this.level;
        this.level++;
        this.exp -= needed;

        this._applyLevelDerivedStats();

        this.player.events.OnLevelUp?.(oldLevel, this.level);
        return true;
    }

    _applyLevelDerivedStats() {
        const oldMaxHealth = this.maxHealth;
        const healthRatio = oldMaxHealth > 0 ? this.health / oldMaxHealth : 1;

        this._updateLevelBaseStats();
        this._recomputeBuffDerivedStats();

        const policy = getHealPolicyForLevel(this.level);
        switch (policy) {
            case LevelUpHealPolicy.FULL:
                this.health = this.maxHealth;
                break;
            case LevelUpHealPolicy.PRESERVE_RATIO:
                this.health = Math.round(healthRatio * this.maxHealth);
                break;
            case LevelUpHealPolicy.NONE:
            default:
                break;
        }

        this.health = Math.max(0, Math.min(this.health, this.maxHealth));
        this.player.entityBridge.syncMaxHealth(this.maxHealth);
        this.player.entityBridge.syncHealth(this.health);
    }

    refreshLevelStats() {
        this._updateLevelBaseStats();
        this._recomputeBuffDerivedStats();
    }

    resetGameProgress() {
        this.money = 0;
        this.exp = 0;
        this.level = 1;
        this.score = 0;
        this.kills = 0;
        this.damageDealt = 0;
        this.headshots = 0;
        this.waveProgress = 0;
        this.moneyGain = this.baseMoneyGain;
        this.expGain = this.baseExpGain;
        this.refreshLevelStats();
        this.resetCombatResources(this.maxHealth, 0);
    }

    setHealth(value) {
        this.health = Math.max(0, Math.min(Math.round(value), Math.round(this.maxHealth)));
    }

    setMaxHealth(value) {
        this.maxHealth = Math.max(1, Math.round(value));
        this.setHealth(this.health);
    }

    setArmor(value) {
        this.armor = Math.max(0, Math.min(Math.round(value), 100));
    }

    resetCombatResources(health, armor) {
        this.setHealth(health ?? this.maxHealth);
        this.setArmor(armor ?? 0);
    }

    getAttackRatio() {
        if (this.baseAttack <= 0) return 1;
        return this.attack / this.baseAttack;
    }

    getAttackDamage(baseDamage) {
        const levelScaled = scaleOutgoingDamage(baseDamage, this.level);
        return Math.max(0, Math.round(levelScaled * this.getAttackRatio()));
    }

    getSummary() {
        return {
            id: this.player.id,
            name: this.player.entityBridge.getPlayerName(),
            slot: this.player.slot,
            level: this.level,
            money: this.money,
            health: this.health,
            maxHealth: this.maxHealth,
            armor: this.armor,
            attack: this.attack,
            critChance: this.critChance,
            critMultiplier: this.critMultiplier,
            kills: this.kills,
            score: this.score,
            exp: this.exp,
            expNeeded: this.getExpNeeded(),
        };
    }

    _updateLevelBaseStats() {
        this.baseMaxHealth = getMaxHealthForLevel(this.level);
        this.baseAttack = getAttackForLevel(this.level);
        this.critChance = getCritChanceForLevel(this.level);
        this.critMultiplier = getCritMultiplierForLevel(this.level);
    }

    _recomputeBuffDerivedStats() {
        if (this.player.buffManager?.recomputeModifiers) {
            this.player.buffManager.recomputeModifiers();
            return;
        }

        this.maxHealth = this.baseMaxHealth;
        this.attack = this.baseAttack;
        this.moneyGain = this.baseMoneyGain;
        this.expGain = this.baseExpGain;
        this.health = Math.max(0, Math.min(this.health, this.maxHealth));
    }
}
