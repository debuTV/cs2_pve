/**
 * @module 玩家系统/玩家常量配置
 */
/**
 * 玩家等级配置。
 *
 * 采用唯一的显式等级表作为真源：
 * - 每一级都必须手动填写完整配置。
 * - 经验语义：每升一级扣除当前等级所需经验，剩余经验继续向下一等级积累。
 * - 生命、攻击、暴击率、暴击伤害均为该等级的基础值。
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
 * @property {number} expRequired - 升到下一级所需经验，满级填 0
 * @property {number} maxHealth - 该等级的基础最大生命值
 * @property {number} attack - 该等级的基础攻击力
 * @property {number} critChance - 该等级的基础暴击率
 * @property {number} critMultiplier - 该等级的基础暴击伤害倍率
 * @property {string} healOnLevelUp - 升级回血策略，取值见 {@link LevelUpHealPolicy}
 */

/**
 * 默认升级回血策略
 */
export const DEFAULT_LEVEL_UP_HEAL_POLICY = LevelUpHealPolicy.FULL;

/** @type {LevelConfig[]} */
export const LEVEL_CONFIGS = [
    {
        level: 1,
        expRequired: 100,
        maxHealth: 100,
        attack: 10,
        critChance: 0.1,
        critMultiplier: 1.5,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
    {
        level: 2,
        expRequired: 150,
        maxHealth: 110,
        attack: 11,
        critChance: 0.105,
        critMultiplier: 1.52,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
    {
        level: 3,
        expRequired: 200,
        maxHealth: 120,
        attack: 12,
        critChance: 0.11,
        critMultiplier: 1.54,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
    {
        level: 4,
        expRequired: 250,
        maxHealth: 130,
        attack: 12,
        critChance: 0.115,
        critMultiplier: 1.56,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
    {
        level: 5,
        expRequired: 0,
        maxHealth: 140,
        attack: 13,
        critChance: 0.12,
        critMultiplier: 1.58,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
];