/**
 * @module 玩家系统/玩家/组件/玩家数值
 */
import { LEVEL_CONFIGS, LevelUpHealPolicy } from "../../player_const";
import { PlayerBuffEvents } from "./buff_manager";

const FALLBACK_LEVEL_CONFIG = {
    level: 1,
    expRequired: 0,
    maxHealth: 100,
    attack: 10,
    critChance: 0,
    critMultiplier: 1,
    healOnLevelUp: LevelUpHealPolicy.FULL,
};

const BASE_LEVEL_CONFIG = LEVEL_CONFIGS[0] ?? FALLBACK_LEVEL_CONFIG;
const MAX_LEVEL = LEVEL_CONFIGS.length || 1;
const BASE_ATTACK = BASE_LEVEL_CONFIG.attack ?? 0;

/**
 * 仅对正向收益应用倍率，负向扣减保持原值。
 * @param {number} amount
 * @param {number} multiplier
 * @returns {number}
 */
function scalePositiveAmount(amount, multiplier) {
    return amount > 0 ? amount * multiplier : amount;
}

/**
 * 将数值先取整，再约束到给定区间内。
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clampRounded(value, min, max) {
    return Math.max(min, Math.min(Math.round(value), Math.round(max)));
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
        this.level = 1;

        const levelConfig = this._getCurrentLevelConfig();

        // 基础生命相关属性。
        this.baseMaxHealth = levelConfig.maxHealth;
        this.maxHealth = this.baseMaxHealth;
        this.health = this.maxHealth;
        this.armor = 0;

        // 基础输出相关属性。
        this.baseAttack = levelConfig.attack;
        this.attack = this.baseAttack;
        this.critChance = levelConfig.critChance;
        this.critMultiplier = levelConfig.critMultiplier;

        // 收益倍率，默认均为 1，由 Buff 等系统修改。
        this.baseMoneyGain = 1;
        this.moneyGain = 1;
        this.baseExpGain = 1;
        this.expGain = 1;

        // 成长主资源。
        this.money = 0;
        this.exp = 0;

        this._resetCombatStats();
    }

    /**
     * 给玩家增加金钱，并应用当前金钱收益倍率。
     * @param {number} amount
     * @returns {number}
     */
    addMoney(amount) {
        return this.applyMoneyDelta(amount, true);
    }

    /**
     * 处理金钱变化，可选是否套用收益倍率。
     * 兼容旧调用，外部通常应优先使用 addMoney。
     * @param {number} amount
     * @param {boolean} [applyGain=true]
     * @returns {number}
     */
    applyMoneyDelta(amount, applyGain = true) {
        return this._applyMoneyChange(amount, applyGain ? this.moneyGain : 1);
    }

    /**
     * 直接写入金钱变化，不再重复套用任何倍率。
     * 兼容旧调用，外部通常不需要直接使用。
     * @param {number} amount
     * @returns {number}
     */
    applyRawMoneyDelta(amount) {
        return this._applyMoneyChange(amount, 1);
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
     * @returns {number}
     */
    addExp(amount) {
        return this.applyExpDelta(amount, true);
    }

    /**
     * 处理经验变化，可选是否套用收益倍率。
     * 兼容旧调用，外部通常应优先使用 addExp。
     * @param {number} amount
     * @param {boolean} [applyGain=true]
     * @returns {number}
     */
    applyExpDelta(amount, applyGain = true) {
        return this._applyExpChange(amount, applyGain ? this.expGain : 1);
    }

    /**
     * 直接写入经验变化，并在正向增长后持续检测升级。
     * 兼容旧调用，外部通常不需要直接使用。
     * @param {number} amount
     * @returns {number}
     */
    applyRawExpDelta(amount) {
        return this._applyExpChange(amount, 1);
    }

    /**
     * 获取当前等级升级所需经验值。
     * @returns {number}
     */
    getExpNeeded() {
        return this._getCurrentLevelConfig().expRequired;
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

        this.level++;
        this.exp -= needed;

        this._applyLevelDerivedStats();

        return true;
    }

    /**
     * 升级后刷新等级基础属性，并按照配置决定是否回满或保留血量比例。
     */
    _applyLevelDerivedStats() {
        const previousHealth = this.health;
        const previousMaxHealth = this.maxHealth;
        const levelConfig = this._getCurrentLevelConfig();

        this._applyLevelBaseConfig(levelConfig);
        this._recomputeBuffDerivedStats();
        this.health = this._resolveLevelUpHealth(previousHealth, previousMaxHealth, levelConfig);
        this._syncHealthState();
    }

    /**
     * 按当前等级重新计算基础属性，并重新叠加 Buff 修正。
     */
    refreshLevelStats() {
        this._applyLevelBaseConfig();
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
        this._resetCombatStats();
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
        this.health = clampRounded(value, 0, this.maxHealth);
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
        this.armor = clampRounded(value, 0, 100);
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
     * 获取当前攻击相对 1 级基准攻击的倍率关系。
     * 供最终伤害计算阶段叠乘使用。
     * @returns {number}
     */
    getAttackScale() {
        if (BASE_ATTACK <= 0) return 1;
        return this.attack / BASE_ATTACK;
    }

    /**
     * 计算玩家的最终攻击伤害。
     * 直接按当前攻击相对 1 级基准攻击的倍率缩放，再交给 Buff 事件做二次修正。
     * @param {number} baseDamage
     * @returns {number}
     */
    getAttackDamage(baseDamage) {
        const event = {
            damage: Math.max(0, Math.round(baseDamage * this.getAttackScale())),
        };
        this.player.buffManager.emitEvent(PlayerBuffEvents.Attack, event);
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
     * 获取当前等级的手动配置项。
     */
    _getCurrentLevelConfig() {
        const clamped = Math.max(1, Math.min(this.level, MAX_LEVEL));
        return LEVEL_CONFIGS[clamped - 1] ?? BASE_LEVEL_CONFIG;
    }

    /**
     * 根据当前等级应用手动配置表中的基础属性。
     * @param {import("../../player_const").LevelConfig} [levelConfig]
     */
    _applyLevelBaseConfig(levelConfig = this._getCurrentLevelConfig()) {
        this.baseMaxHealth = levelConfig.maxHealth;
        this.baseAttack = levelConfig.attack;
        this.critChance = levelConfig.critChance;
        this.critMultiplier = levelConfig.critMultiplier;
    }

    /**
     * 重新计算 Buff 对属性和收益倍率的影响。
     * 若当前没有可用 Buff 管理器，则回退到纯等级基础值。
     */
    _recomputeBuffDerivedStats() {
        this._resetDerivedStatsToBase();
        this.player.buffManager?.emitEvent(PlayerBuffEvents.Spawn, { recompute: true });
        this.setHealth(this.health);
    }

    /**
     * @param {number} amount
     * @param {number} multiplier
     * @returns {number}
     */
    _applyMoneyChange(amount, multiplier) {
        return this._applyRoundedDelta("money", scalePositiveAmount(amount, multiplier));
    }

    /**
     * @param {number} amount
     * @param {number} multiplier
     * @returns {number}
     */
    _applyExpChange(amount, multiplier) {
        const scaledAmount = scalePositiveAmount(amount, multiplier);
        if (!scaledAmount) return 0;
        if (this.level >= MAX_LEVEL) return 0;

        const actual = this._applyRoundedDelta("exp", scaledAmount);
        if (actual > 0) {
            while (this._checkLevelUp()) { /* keep going */ }
        }

        return actual;
    }

    /**
     * @param {"money"|"exp"} field
     * @param {number} amount
     * @returns {number}
     */
    _applyRoundedDelta(field, amount) {
        if (!amount) return 0;

        const oldValue = this[field];
        const nextValue = Math.max(0, Math.round(oldValue + amount));
        const actual = nextValue - oldValue;
        if (!actual) return 0;

        this[field] = nextValue;
        return actual;
    }

    _resetCombatStats() {
        this.score = 0;
        this.kills = 0;
        this.damageDealt = 0;
        this.headshots = 0;
        this.waveProgress = 0;
    }

    _resetDerivedStatsToBase() {
        this.maxHealth = this.baseMaxHealth;
        this.attack = this.baseAttack;
        this.moneyGain = this.baseMoneyGain;
        this.expGain = this.baseExpGain;
    }

    _syncHealthState() {
        this.player.entityBridge.syncMaxHealth(this.maxHealth);
        this.player.entityBridge.syncHealth(this.health);
    }

    /**
     * @param {number} previousHealth
     * @param {number} previousMaxHealth
     * @param {import("../../player_const").LevelConfig} levelConfig
     * @returns {number}
     */
    _resolveLevelUpHealth(previousHealth, previousMaxHealth, levelConfig) {
        switch (levelConfig.healOnLevelUp ?? LevelUpHealPolicy.FULL) {
            case LevelUpHealPolicy.FULL:
                return this.maxHealth;
            case LevelUpHealPolicy.PRESERVE_RATIO: {
                const healthRatio = previousMaxHealth > 0 ? previousHealth / previousMaxHealth : 1;
                return clampRounded(healthRatio * this.maxHealth, 0, this.maxHealth);
            }
            case LevelUpHealPolicy.NONE:
            default:
                return clampRounded(previousHealth, 0, this.maxHealth);
        }
    }
}
