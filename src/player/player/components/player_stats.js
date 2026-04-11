/**
 * @module 玩家系统/玩家/组件/玩家数值
 */
import { PlayerRuntimeEvents } from "../../../util/runtime_events.js";
import { LEVEL_CONFIGS, LevelUpHealPolicy } from "../../player_const";

const MAX_LEVEL = Math.max(LEVEL_CONFIGS.length, 1);

/**
 * 将数值先取整，再约束到给定区间内。
 * @param {number} value 原始数值。
 * @param {number} min 允许的最小值。
 * @param {number} max 允许的最大值。
 * @returns {number} 约束后的整数结果。
 */
function clampRounded(value, min, max) {
    return Math.max(min, Math.min(Math.round(value), Math.round(max)));
}

/**
 * 仅对正向收益应用倍率，负向扣减保持原值。
 * @param {number} amount 原始增减值。
 * @param {number} multiplier 正向收益倍率。
 * @returns {number} 应用倍率后的结果。
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
     * 创建玩家数值组件，并准备所有运行期字段。
     * @param {import("../player").Player} player 所属的玩家对象。
     */
    constructor(player) {
        this.player = player;

        const levelConfig = LEVEL_CONFIGS[0];

        // 等级与成长资源。
        this.level = 1;
        this.money = 0;
        this.exp = 0;

        // 战斗资源。
        this.baseMaxHealth = levelConfig.maxHealth;
        this.maxHealth = this.baseMaxHealth;
        this.health = this.maxHealth;
        this.armor = 0;

        // 输出属性。
        this.baseAttackScale = levelConfig.attackScale;
        this.attackScale = this.baseAttackScale;
        this.baseCritChance = levelConfig.critChance;
        this.critChance = this.baseCritChance;
        this.baseCritMultiplier = levelConfig.critMultiplier;
        this.critMultiplier = this.baseCritMultiplier;

        // 收益倍率。
        this.baseMoneyGain = 1;
        this.moneyGain = this.baseMoneyGain;
        this.baseExpGain = 1;
        this.expGain = this.baseExpGain;

        // 统计字段。
        this.score = 0;
        this.kills = 0;
        this.damageDealt = 0;
        this.lastMonsterDamage = 0;
        this.headshots = 0;
        this.waveProgress = 0;

        this._initializeState();
    }

    // ——— 主 API ———

    /**
     * 增加金钱。正数视为奖励，负数会回落到扣钱逻辑。
     * @param {number} amount 要增加的金钱数量。
     * @returns {number} 实际变动后的金钱数量。
     */
    addMoney(amount) {
        if (amount < 0) {
            return this.deductMoney(-amount) ? -Math.round(-amount) : 0;
        }

        return this._applyRewardDelta("money", amount, this.moneyGain);
    }

    /**
     * 增加经验值，并在需要时连续升级。
     * @param {number} amount 要增加的经验值。
     * @returns {number} 实际变动后的经验值。
     */
    addExp(amount) {
        if (this.level >= MAX_LEVEL) {
            this.exp = 0;
            return 0;
        }

        const actual = this._applyRewardDelta("exp", amount, this.expGain);
        if (actual > 0) {
            this._applyPendingLevelUps();
        }

        return actual;
    }

    /**
     * 扣除指定金钱，余额不足时返回 false。
     * @param {number} amount 要扣除的金钱数量。
     * @returns {boolean} 是否扣除成功。
     */
    deductMoney(amount) {
        const roundedAmount = Math.max(0, Math.round(amount));
        if (!roundedAmount) return true;
        if (this.money < roundedAmount) return false;

        this.money -= roundedAmount;
        return true;
    }

    /**
     * 清空本局成长与统计数据，并回到 1 级初始状态。
     * @returns {void}
     */
    resetGameProgress() {
        this.level = 1;
        this.money = 0;
        this.exp = 0;
        this.score = 0;
        this.kills = 0;
        this.damageDealt = 0;
        this.lastMonsterDamage = 0;
        this.headshots = 0;
        this.waveProgress = 0;

        this._resetIncomeModifiers();
        this.respawn();
    }

    /**
     * 按当前等级刷新基础属性，并通知 Buff 重算增益。
     * @param {number} [health] 重生后要设置的生命值，默认回到当前生命上限。
     * @param {number} [armor] 重生后要设置的护甲值，默认清零。
     * @returns {void}
     */
    respawn(health, armor) {
        this._refreshDerivedStats();
        this._setCombatResources(health ?? this.maxHealth, armor ?? 0);
        this._syncCombatState();
    }

    /**
     * 获取玩家当前数值快照。
     * @returns {any} 当前玩家的主要数值摘要。
     */
    getSummary() {
        return {
            name: this.player.entityBridge.getPlayerName(),
            slot: this.player.slot,
            level: this.level,
            money: this.money,
            health: this.health,
            maxHealth: this.maxHealth,
            armor: this.armor,
            attack: this.attackScale,
            attackScale: this.attackScale,
            critChance: this.critChance,
            critMultiplier: this.critMultiplier,
            kills: this.kills,
            score: this.score,
            lastMonsterDamage: this.lastMonsterDamage,
            exp: this.exp,
            expNeeded: this._getExpNeeded(),
        };
    }

    // ——— 兼容层：为了不改其他文件而保留 ———

    /**
     * 按当前等级重新计算派生属性，并保持当前生命与护甲在合法范围内。
     * @returns {void}
     */
    refreshLevelStats() {
        this._refreshDerivedStats();
        this._setCombatResources(this.health, this.armor);
    }

    /**
     * 重置当前战斗资源。
     * @param {number} [health] 要设置的生命值，默认回满到当前生命上限。
     * @param {number} [armor] 要设置的护甲值，默认清零。
     * @returns {void}
     */
    resetCombatResources(health, armor) {
        this._setCombatResources(health ?? this.maxHealth, armor ?? 0);
    }

    /**
     * 设置当前生命值，并约束到合法区间。
     * @param {number} value 目标生命值。
     * @returns {void}
     */
    setHealth(value) {
        this.health = clampRounded(value, 0, this.maxHealth);
    }

    /**
     * 设置当前最大生命值，并同步修正当前生命值。
     * @param {number} value 目标最大生命值。
     * @returns {void}
     */
    setMaxHealth(value) {
        this.maxHealth = Math.max(1, Math.round(value));
        this.setHealth(this.health);
    }

    /**
     * 设置当前护甲值，并约束到合法区间。
     * @param {number} value 目标护甲值。
     * @returns {void}
     */
    setArmor(value) {
        this.armor = clampRounded(value, 0, 100);
    }

    /**
     * 计算一次攻击伤害，并允许 Buff 参与最终修正。
     * @param {number} baseDamage 原始伤害值。
     * @returns {number} 结算后的最终伤害。
     */
    getAttackDamage(baseDamage) {
        const event = this._rollAttackDamage(baseDamage);
        this.player.emitRuntimeEvent(PlayerRuntimeEvents.Attack, event);
        event.damage = Math.max(0, Math.round(event.damage));
        return event.damage;
    }

    /**
     * 记录一次玩家对怪物造成的最终伤害。
     * @param {number} amount 最终生效伤害。
     * @returns {number} 被记录的伤害值。
     */
    recordMonsterDamage(amount) {
        const finalAmount = Math.max(0, Math.round(amount));
        if (finalAmount <= 0) return 0;

        this.lastMonsterDamage = finalAmount;
        this.damageDealt += finalAmount;
        return finalAmount;
    }

    // ——— 等级链 ———

    /**
     * 获取当前等级对应的配置，不存在时回落到兜底配置。
     * @returns {import("../../player_const").LevelConfig} 当前等级配置。
     */
    _getCurrentLevelConfig() {
        const clampedLevel = Math.max(1, Math.min(this.level, MAX_LEVEL));
        return LEVEL_CONFIGS[clampedLevel - 1];
    }

    /**
     * 获取当前等级升到下一级所需经验。
     * @returns {number} 当前升级所需经验。
     */
    _getExpNeeded() {
        return this._getCurrentLevelConfig().expRequired;
    }

    /**
     * 在经验足够时连续执行升级，并处理升级后的生命值结算。
     * @returns {void}
     */
    _applyPendingLevelUps() {
        let didLevelUp = false;

        while (this.level < MAX_LEVEL) {
            const needed = this._getExpNeeded();
            if (needed <= 0 || this.exp < needed) break;

            const previousHealth = this.health;
            const previousMaxHealth = this.maxHealth;

            this.level++;
            this.exp = Math.max(0, Math.round(this.exp - needed));

            const levelConfig = this._getCurrentLevelConfig();
            this._refreshDerivedStats(levelConfig);
            this.health = this._resolveLevelUpHealth(previousHealth, previousMaxHealth, levelConfig);
            didLevelUp = true;
        }

        if (this.level >= MAX_LEVEL) {
            this.exp = 0;
        }

        if (didLevelUp) {
            this._syncCombatState();
        }
    }

    /**
     * 根据升级回血策略，结算升级后的生命值。
     * @param {number} previousHealth 升级前的生命值。
     * @param {number} previousMaxHealth 升级前的最大生命值。
     * @param {import("../../player_const").LevelConfig} levelConfig 新等级对应的配置。
     * @returns {number} 升级后的生命值。
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

    // ——— 派生属性链 ———

    /**
     * 按等级配置重建基础属性，并重新应用 Buff 的派生修正。
     * @param {import("../../player_const").LevelConfig} [levelConfig] 要应用的等级配置，默认使用当前等级。
     * @returns {void}
     */
    _refreshDerivedStats(levelConfig = this._getCurrentLevelConfig()) {
        this._applyLevelBaseConfig(levelConfig);
        this._resetDerivedStatsToBase();
        this._recomputeBuffModifiers();
    }

    /**
     * 将等级配置写入基础属性字段。
     * @param {import("../../player_const").LevelConfig} levelConfig 要应用的等级配置。
     * @returns {void}
     */
    _applyLevelBaseConfig(levelConfig) {
        this.baseMaxHealth = levelConfig.maxHealth;
        this.baseAttackScale = levelConfig.attackScale;
        this.baseCritChance = levelConfig.critChance;
        this.baseCritMultiplier = levelConfig.critMultiplier;
    }

    /**
     * 用基础属性覆盖当前派生属性，清掉上一轮 Buff 的改写结果。
     * @returns {void}
     */
    _resetDerivedStatsToBase() {
        this.maxHealth = this.baseMaxHealth;
        this.attackScale = this.baseAttackScale;
        this.critChance = this.baseCritChance;
        this.critMultiplier = this.baseCritMultiplier;
        this.moneyGain = this.baseMoneyGain;
        this.expGain = this.baseExpGain;
    }

    /**
     * 通知 Buff 重新计算派生属性，并重新约束当前生命与护甲。
     * @returns {void}
     */
    _recomputeBuffModifiers() {
        this.player.emitRuntimeEvent(PlayerRuntimeEvents.Recompute, { recompute: true });
        this.setHealth(this.health);
        this.setArmor(this.armor);
    }

    /**
     * 将金钱和经验收益倍率恢复为基础值。
     * @returns {void}
     */
    _resetIncomeModifiers() {
        this.moneyGain = this.baseMoneyGain;
        this.expGain = this.baseExpGain;
    }

    // ——— 资源链 ———

    /**
     * 初始化或重置数值组件的默认状态。
     * @returns {void}
     */
    _initializeState() {
        this.level = 1;
        this.baseMoneyGain = 1;
        this.baseExpGain = 1;

        const levelConfig = this._getCurrentLevelConfig();
        this._applyLevelBaseConfig(levelConfig);
        this._resetDerivedStatsToBase();

        this.health = this.maxHealth;
        this.armor = 0;

        this.money = 0;
        this.exp = 0;
        this.score = 0;
        this.kills = 0;
        this.damageDealt = 0;
        this.lastMonsterDamage = 0;
        this.headshots = 0;
        this.waveProgress = 0;
    }

    /**
     * 同时设置当前生命和护甲。
     * @param {number} health 目标生命值。
     * @param {number} armor 目标护甲值。
     * @returns {void}
     */
    _setCombatResources(health, armor) {
        this.setHealth(health);
        this.setArmor(armor);
    }

    /**
     * 将当前生命、最大生命和护甲同步到引擎实体。
     * @returns {void}
     */
    _syncCombatState() {
        this.player.entityBridge.syncMaxHealth(this.maxHealth);
        this.player.entityBridge.syncHealth(this.health);
        this.player.entityBridge.syncArmor(this.armor);
    }

    /**
     * 对奖励类数值应用收益倍率后再落到具体字段上。
     * @param {"money"|"exp"} field 要修改的资源字段。
     * @param {number} amount 原始增减值。
     * @param {number} multiplier 要应用的收益倍率。
     * @returns {number} 实际生效的变动值。
     */
    _applyRewardDelta(field, amount, multiplier) {
        return this._applyRoundedDelta(field, scalePositiveAmount(amount, multiplier));
    }

    /**
     * 将数值变动写入指定字段，并保证结果不会小于 0。
     * @param {"money"|"exp"} field 要修改的资源字段。
     * @param {number} amount 要写入的增减值。
     * @returns {number} 实际生效的变动值。
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

    // ——— 伤害链 ———

    /**
     * 按攻击倍率与暴击配置结算一次基础伤害。
     * @param {number} baseDamage 原始伤害值。
     * @returns {{damage: number, baseDamage: number, scaledDamage: number, critChance: number, critMultiplier: number, isCritical: boolean}} 本次伤害结算明细。
     */
    _rollAttackDamage(baseDamage) {
        const scaledDamage = Math.max(0, baseDamage * this.attackScale);
        const critChance = Math.max(0, Math.min(this.critChance, 1));
        const critMultiplier = Math.max(1, this.critMultiplier);
        const isCritical = critChance > 0 && Math.random() < critChance;

        return {
            damage: Math.max(0, Math.round(scaledDamage * (isCritical ? critMultiplier : 1))),
            baseDamage,
            scaledDamage: Math.max(0, Math.round(scaledDamage)),
            critChance,
            critMultiplier,
            isCritical,
        };
    }
}
