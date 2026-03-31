/**
 * @module 玩家系统/玩家常量配置
 */
/**
 * 玩家等级成长配置。
 *
 * 采用"公式默认值 + 等级数组覆盖"的双层结构：
 * - 公式参数可自动生成所有等级的默认配置。
 * - 显式等级数组优先级更高，可覆盖公式生成的值。
 * - 未显式给出的等级由公式自动补全。
 *
 * 经验语义：每升一级扣除当前等级所需经验，剩余经验继续向下一等级积累。
 * 倍率语义：基础值 × 全局倍率，非逐级连乘。
 */
/**
 * 升级回血策略枚举。
 * @enum {string}
 */
export const LevelUpHealPolicy = {
    NONE: "none",
    PRESERVE_RATIO: "preserve_ratio",
    FULL: "full",
};
/**
 * 玩家状态枚举。
 *
 * 定义了玩家在整个游戏生命周期中可能处于的所有状态。
 * Player 的 `applyStateTransition()` 方法会根据这些值驱动状态机，
 * 同时通知 Buff 系统和事件总线。
 *
 * 状态流转典型路径：
 * `DISCONNECTED → CONNECTED → PREPARING → READY → ALIVE → DEAD → RESPAWNING → ALIVE`
 *
 * - `DISCONNECTED` (0)：玩家不在线，Player 实例即将或已被清理。
 * - `CONNECTED` (1)：玩家已连接但尚未进入游戏（Controller 已绑定，Pawn 未就绪）。
 * - `PREPARING` (2)：等待玩家点击准备。
 * - `READY` (3)：玩家已准备，等待所有人就绪后开波。
 * - `ALIVE` (4)：正常游戏中，可接收伤害和操作。
 * - `DEAD` (5)：已死亡，等待重生或回合结束。
 * - `RESPAWNING` (6)：正在执行重生流程。
 * - `SHOPPING` (7)：打开商店界面（预留，当前未完全实现）。
 *
 * @navigationTitle 玩家状态枚举
 */
export const PlayerState = {
    /** 离线状态 */
    DISCONNECTED: 0,
    /** 在线并已连接 */
    CONNECTED:    1,
    /** 等待准备 */
    PREPARING:    2,
    /** 已准备就绪 */
    READY:        3,
    /** 游戏中存活 */
    ALIVE:        4,
    /** 已死亡 */
    DEAD:         5,
    /** 重生中 */
    RESPAWNING:   6,
    /** 商店界面（预留） */
    SHOPPING:     7,
};

/**
 * 单个等级的配置。
 *
 * @typedef {object} LevelConfig
 * @property {number} level - 等级
 * @property {number} expRequired - 升级所需经验
 * @property {number} maxHealthMultiplier - 生命值倍率
 * @property {number} attackMultiplier - 攻击力倍率
 * @property {string} [healOnLevelUp] - 升级回血策略，取值见 {@link LevelUpHealPolicy}
 */

/**
 * 公式参数配置。
 *
 * @typedef {object} FormulaParams
 * @property {number} baseExp - 基础经验需求
 * @property {number} expPerLevel - 每级额外经验需求
 * @property {number} healthGrowth - 生命值成长率
 * @property {number} attackGrowth - 攻击力成长率
 * @property {number} critChanceGrowth - 暴击率成长率
 * @property {number} critMultiplierGrowth - 暴击伤害倍率成长率
 */

/**
 * 最大等级
 */
export const MAX_LEVEL = 5;
/**
 * 基础属性数值（等级 1 的数值，后续等级通过倍率成长）
 */
export const BASE_MAX_HEALTH = 100;
/**
 * 基础攻击力（等级 1 的数值，后续等级通过倍率成长）
 */
export const BASE_ATTACK = 10;
/**
 * 基础暴击率（等级 1 的数值，后续等级通过成长率提升）
 */
export const BASE_CRIT_CHANCE = 0.1;
/**
 * 基础暴击伤害倍率（等级 1 的数值，后续等级通过成长率提升）
 */
export const BASE_CRIT_MULTIPLIER = 1.5;
/**
 * 默认升级回血策略
 */
export const DEFAULT_LEVEL_UP_HEAL_POLICY = LevelUpHealPolicy.FULL;

/** 
 * 等级成长公式参数配置。
 * @type {FormulaParams}
 */
export const FORMULA_PARAMS = {
    baseExp: 100,
    expPerLevel: 50,
    healthGrowth: 0.1,
    attackGrowth: 0.08,
    critChanceGrowth: 0.005,
    critMultiplierGrowth: 0.02,
};

/** @type {LevelConfig[]} */
export const LEVEL_OVERRIDES = [];

/**
 * @param {number} level
 * @returns {LevelConfig}
 */
function buildFormulaConfig(level) {
    const p = FORMULA_PARAMS;
    return {
        level,
        expRequired: level >= MAX_LEVEL ? 0 : p.baseExp + (level - 1) * p.expPerLevel,
        maxHealthMultiplier: 1 + (level - 1) * p.healthGrowth,
        attackMultiplier: 1 + (level - 1) * p.attackGrowth,
    };
}

/**
 * @returns {LevelConfig[]}
 */
export function buildLevelConfigs() {
    /** @type {LevelConfig[]} */
    const configs = [];
    for (let lv = 1; lv <= MAX_LEVEL; lv++) {
        configs.push(buildFormulaConfig(lv));
    }
    for (const override of LEVEL_OVERRIDES) {
        const idx = override.level - 1;
        if (idx >= 0 && idx < configs.length) {
            configs[idx] = { ...configs[idx], ...override };
        }
    }
    return configs;
}

const _levelConfigs = buildLevelConfigs();

/**
 * @param {number} level
 * @returns {LevelConfig}
 */
export function getLevelConfig(level) {
    const clamped = Math.max(1, Math.min(level, MAX_LEVEL));
    return _levelConfigs[clamped - 1];
}

/**
 * @param {number} level
 * @returns {number}
 */
export function getExpRequired(level) {
    if (level >= MAX_LEVEL) return 0;
    return getLevelConfig(level).expRequired;
}

/**
 * @param {number} level
 * @returns {number}
 */
export function getMaxHealthForLevel(level) {
    return Math.round(BASE_MAX_HEALTH * getLevelConfig(Math.max(1, level)).maxHealthMultiplier);
}

/**
 * @param {number} level
 * @returns {number}
 */
export function getAttackForLevel(level) {
    return Math.round(BASE_ATTACK * getLevelConfig(Math.max(1, level)).attackMultiplier);
}

/**
 * @param {number} level
 * @returns {number}
 */
export function getCritChanceForLevel(level) {
    const p = FORMULA_PARAMS;
    return Math.max(0, Math.min(BASE_CRIT_CHANCE + (Math.max(1, level) - 1) * p.critChanceGrowth, 1));
}

/**
 * @param {number} level
 * @returns {number}
 */
export function getCritMultiplierForLevel(level) {
    const p = FORMULA_PARAMS;
    return Math.max(1, BASE_CRIT_MULTIPLIER + (Math.max(1, level) - 1) * p.critMultiplierGrowth);
}

/**
 * @param {number} level
 * @returns {string}
 */
export function getHealPolicyForLevel(level) {
    const config = getLevelConfig(Math.max(1, level));
    return config.healOnLevelUp ?? DEFAULT_LEVEL_UP_HEAL_POLICY;
}

/**
 * @param {number} baseDamage
 * @param {number} level
 * @returns {number}
 */
export function scaleOutgoingDamage(baseDamage, level) {
    const config = getLevelConfig(Math.max(1, level));
    return Math.round(baseDamage * config.attackMultiplier);
}