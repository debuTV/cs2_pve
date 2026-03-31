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
import { PlayerBuffEvents } from "./buff_manager";

/**
 * 仅对正向收益应用倍率，负向扣减保持原值。
 * 这样增益类修正只会放大奖励，不会意外放大惩罚。
 * @param {number} amount
 * @param {number} multiplier
 * @returns {number}
 */
function scalePositiveAmount(amount, multiplier) {
    return amount > 0 ? amount * multiplier : amount;
}

/**
 * 玩家数值组件。
 *
 * 负责维护玩家的核心成长与资源状态，包括：
 * - 等级、经验、升级后的基础属性刷新。
 * - 金钱、经验的增减与收益倍率结算。
 * - 血量、护甲等战斗资源的约束与重置。
 * - Buff 对派生属性的二次修正。
 *
 * 该组件只负责“数值本身”的维护；
 * 与引擎实体同步、死亡处理、Buff 生命周期等逻辑分别由其他组件承担。
 *
 * @navigationTitle 玩家数值组件
 */
export class PlayerStats {
    /**
     * @param {import("../player").Player} player
     */
    constructor(player) {
        this.player = player;

        // 基础生命相关属性。
        this.baseMaxHealth = getMaxHealthForLevel(1);
        this.maxHealth = this.baseMaxHealth;
        this.health = this.maxHealth;
        this.armor = 0;

        // 基础输出相关属性。
        this.baseAttack = getAttackForLevel(1);
        this.attack = this.baseAttack;
        this.critChance = getCritChanceForLevel(1);
        this.critMultiplier = getCritMultiplierForLevel(1);

        // 收益倍率，默认均为 1，由 Buff 等系统修改。
        this.baseMoneyGain = 1;
        this.moneyGain = 1;
        this.baseExpGain = 1;
        this.expGain = 1;

        // 成长主资源。
        this.money = 0;
        this.exp = 0;
        this.level = 1;

        // 战斗统计字段，供战绩或 UI 汇总使用。
        this.score = 0;
        this.kills = 0;
        this.damageDealt = 0;
        this.headshots = 0;
        this.waveProgress = 0;
    }

    /**
     * 给玩家增加金钱，并应用当前金钱收益倍率。
     * @param {number} amount
     * @param {string} [reason]
     * @returns {number}
     */
    addMoney(amount, reason) {
        return this.applyMoneyDelta(amount, reason, true);
    }

    /**
     * 处理金钱变化，可选是否套用收益倍率。
     * @param {number} amount
     * @param {string} [reason]
     * @param {boolean} [applyGain=true]
     * @returns {number}
     */
    applyMoneyDelta(amount, reason, applyGain = true) {
        const scaledAmount = scalePositiveAmount(amount, applyGain ? this.moneyGain : 1);
        return this.applyRawMoneyDelta(scaledAmount, reason);
    }

    /**
     * 直接写入金钱变化，不再重复套用任何倍率。
     * @param {number} amount
     * @param {string} [reason]
     * @returns {number}
     */
    applyRawMoneyDelta(amount, reason) {
        if (!amount) return 0;

        const old = this.money;
        const next = Math.max(0, Math.round(old + amount));
        const actual = next - old;
        if (!actual) return 0;

        this.money = next;
        return actual;
    }

    /**
     * 扣除指定金钱，余额不足时返回 false。
     * @param {number} amount
     * @returns {boolean}
     */
    deductMoney(amount) {
        if (this.money < amount) return false;
        this.applyRawMoneyDelta(-amount);
        return true;
    }

    /**
     * 给玩家增加经验，并应用当前经验收益倍率。
     * @param {number} amount
     * @param {string} [reason]
     * @returns {number}
     */
    addExp(amount, reason) {
        return this.applyExpDelta(amount, reason, true);
    }

    /**
     * 处理经验变化，可选是否套用收益倍率。
     * @param {number} amount
     * @param {string} [reason]
     * @param {boolean} [applyGain=true]
     * @returns {number}
     */
    applyExpDelta(amount, reason, applyGain = true) {
        const scaledAmount = scalePositiveAmount(amount, applyGain ? this.expGain : 1);
        return this.applyRawExpDelta(scaledAmount, reason);
    }

    /**
     * 直接写入经验变化，并在正向增长后持续检测升级。
     * @param {number} amount
     * @param {string} [reason]
     * @returns {number}
     */
    applyRawExpDelta(amount, reason) {
        if (!amount) return 0;
        if (this.level >= MAX_LEVEL) return 0;

        const oldExp = this.exp;
        const next = Math.max(0, Math.round(oldExp + amount));
        const actual = next - oldExp;
        if (!actual) return 0;

        this.exp = next;

        if (actual > 0) {
            while (this._checkLevelUp()) { /* keep going */ }
        }

        return actual;
    }

    /**
     * 获取当前等级升级所需经验值。
     * @returns {number}
     */
    getExpNeeded() {
        return getExpRequired(this.level);
    }

    /**
     * 检查当前经验是否足够升级。
     * 若满足条件，则执行升级、扣除经验并刷新派生属性。
     * @returns {boolean}
     */
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

        return true;
    }

    /**
     * 升级后刷新等级基础属性，并按照配置决定是否回满或保留血量比例。
     */
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

    /**
     * 按当前等级重新计算基础属性，并重新叠加 Buff 修正。
     */
    refreshLevelStats() {
        this._updateLevelBaseStats();
        this._recomputeBuffDerivedStats();
    }

    /**
     * 重置整局成长进度，但保留组件实例本身。
     * 常用于新开一局或整局重置时恢复默认状态。
     */
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

    /**
     * 设置当前生命值，并强制约束到 0 ~ maxHealth 之间。
     * @param {number} value
     */
    setHealth(value) {
        this.health = Math.max(0, Math.min(Math.round(value), Math.round(this.maxHealth)));
    }

    /**
     * 设置最大生命值，并同步约束当前生命值不超过新上限。
     * @param {number} value
     */
    setMaxHealth(value) {
        this.maxHealth = Math.max(1, Math.round(value));
        this.setHealth(this.health);
    }

    /**
     * 设置护甲值，并约束到 0 ~ 100。
     * @param {number} value
     */
    setArmor(value) {
        this.armor = Math.max(0, Math.min(Math.round(value), 100));
    }

    /**
     * 重置战斗资源到指定值。
     * 未传值时分别回到当前最大生命和 0 护甲。
     * @param {number} [health]
     * @param {number} [armor]
     */
    resetCombatResources(health, armor) {
        this.setHealth(health ?? this.maxHealth);
        this.setArmor(armor ?? 0);
    }

    /**
     * 获取当前攻击与基础攻击的倍率关系。
     * 供最终伤害计算阶段叠乘使用。
     * @returns {number}
     */
    getAttackRatio() {
        if (this.baseAttack <= 0) return 1;
        return this.attack / this.baseAttack;
    }

    /**
     * 计算玩家的最终攻击伤害。
     * 先应用等级成长缩放，再叠乘当前攻击倍率，最后交给 Buff 事件做二次修正。
     * @param {number} baseDamage
     * @returns {number}
     */
    getAttackDamage(baseDamage) {
        const levelScaled = scaleOutgoingDamage(baseDamage, this.level);
        let event={damage: Math.max(0, Math.round(levelScaled * this.getAttackRatio()))};
        this.player.buffManager.emitEvent(PlayerBuffEvents.Attack, event)
        return event.damage;
    }

    /**
     * 获取玩家当前数值快照，供 HUD、调试或外部系统读取。
     * @returns {{id: number, name: string, slot: number, level: number, money: number, health: number, maxHealth: number, armor: number, attack: number, critChance: number, critMultiplier: number, kills: number, score: number, exp: number, expNeeded: number}}
     */
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

    /**
     * 根据当前等级刷新基础属性表中的原始值。
     */
    _updateLevelBaseStats() {
        this.baseMaxHealth = getMaxHealthForLevel(this.level);
        this.baseAttack = getAttackForLevel(this.level);
        this.critChance = getCritChanceForLevel(this.level);
        this.critMultiplier = getCritMultiplierForLevel(this.level);
    }

    /**
     * 重新计算 Buff 对属性和收益倍率的影响。
     * 若当前没有可用 Buff 管理器，则回退到纯等级基础值。
     */
    _recomputeBuffDerivedStats() {
        if (this.player.buffManager?.recomputeModifiers) {
            this.player.buffManager.emitEvent(PlayerBuffEvents.OnSpawn, { recompute: true });
            return;
        }

        this.maxHealth = this.baseMaxHealth;
        this.attack = this.baseAttack;
        this.moneyGain = this.baseMoneyGain;
        this.expGain = this.baseExpGain;
        this.health = Math.max(0, Math.min(this.health, this.maxHealth));
    }
}
