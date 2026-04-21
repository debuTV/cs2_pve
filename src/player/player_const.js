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

import { CSPlayerPawn } from "cs_script/point_script";
import { Player } from "./player/player";

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
 * `DISCONNECTED → CONNECTED → PREPARING ↔ READY → DEAD → PREPARING → ...`
 *
 * - `DISCONNECTED` (0)：玩家不在线，Player 实例即将或已被清理。
 * - `CONNECTED` (1)：玩家已连接但尚未进入游戏（Controller 已绑定，Pawn 未就绪）。
 * - `PREPARING` (2)：玩家已生成且存活，但还未 ready；玩家停留在准备区，不参与战斗，也不能打开商店。
 * - `READY` (3)：玩家已 ready 且存活。游戏未开始时表示已准备等待开局；游戏进行中时表示场上参战状态。
 * - `DEAD` (4)：已死亡，处于观战席，等待重生或下一波；重生后默认回到 `PREPARING`。
 *
 * @navigationTitle 玩家状态枚举
 */
export const PlayerState = {
    DISCONNECTED: 0,
    CONNECTED:    1,
    PREPARING:    2,
    READY:        3,
    DEAD:         4,
};

/** @type {Record<number, string>} */
export const PLAYER_STATE_LABELS = {
    [PlayerState.DISCONNECTED]: "离线",
    [PlayerState.CONNECTED]: "已连接",
    [PlayerState.PREPARING]: "未准备",
    [PlayerState.READY]: "已准备|游戏中",
    [PlayerState.DEAD]: "已死亡",
};

/**
 * @param {number | null | undefined} state
 * @returns {string}
 */
export function getPlayerStateLabel(state) {
    if (typeof state !== "number") return "未知";
    return PLAYER_STATE_LABELS[state] ?? "未知";
}
/**
 * @typedef {object} OnPlayerStatusChanged
 * @property {Player} player - 状态变化的玩家实例
 * @property {CSPlayerPawn|null} pawn
 * @property {number} slot - 玩家槽位
 * @property {PlayerSummary} summary - 玩家状态摘要
 */
/**
 * @typedef {object} PlayerSummary
 * @property {string} [name]
 * @property {number} [level]
 * @property {string} [professionId]
 * @property {string} [professionDisplayName]
 * @property {number} [state]
 * @property {string} [stateLabel]
 * @property {number} [health]
 * @property {number} [maxHealth]
 * @property {number} [armor]
 * @property {number} [money]
 * @property {number} [exp]
 * @property {number} [expNeeded]
 * @property {number} [lastMonsterDamage]
 * @property {boolean} [buff] - 是否刷新 Buff 列表
 * @property {boolean} [skill] - 是否刷新技能（用于技能冷却显示）
 */
/**
 * 玩家职业配置。
 *
 * @typedef {object} PlayerProfessionConfig
 * @property {string} id
 * @property {string} displayName
 * @property {string | null} skillTypeId
 * @property {Record<string, any>} [skillParams]
 */

/** 默认职业。 */
export const DEFAULT_PLAYER_PROFESSION = "medic";

/** @type {Record<string, PlayerProfessionConfig>} */
export const PLAYER_PROFESSIONS = {
    guardian: {
        id: "guardian",
        displayName: "燃烧兵",
        skillTypeId: "fire",
        skillParams: {
            cooldown: 15,
            zoneRadius: 300,
            zoneDuration: 8,
        },
    },
    medic: {
        id: "medic",
        displayName: "医疗兵",
        skillTypeId: "player_mend_field",
        skillParams: {
            inputKey: "InspectWeapon",
            cooldown: 30,
            zoneRadius: 250,
            zoneDuration: 10,
        },
    },
    vanguard: {
        id: "vanguard",
        displayName: "先锋",
        skillTypeId: "player_vanguard",
        skillParams: {
            inputKey: "InspectWeapon",
            cooldown: 15,
            heal: 20,
            armor: 15,
        },
    },
    engineer: {
        id: "engineer",
        displayName: "工程师",
        skillTypeId: "player_turret",
        skillParams: {
            cooldown: 150,
            damage: 200,
            lifetime: 120,
            searchRadius: 640,
        },
    },
};

/**
 * @param {string | null | undefined} professionId
 * @returns {PlayerProfessionConfig | null}
 */
export function getPlayerProfessionConfig(professionId) {
    if (!professionId) return null;
    return PLAYER_PROFESSIONS[professionId] ?? null;
}

/**
 * @returns {string[]}
 */
export function getPlayerProfessionIds() {
    return Object.keys(PLAYER_PROFESSIONS);
}

/**
 * 单个等级的配置。
 *
 * @typedef {object} LevelConfig
 * @property {number} level - 等级
 * @property {number} expRequired - 升到下一级所需经验，满级填 0
 * @property {number} maxHealth - 该等级的基础最大生命值
 * @property {number} attackScale - 该等级的基础攻击倍率
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
        expRequired: 90,
        maxHealth: 100,
        attackScale: 1.0,
        critChance: 0.1,
        critMultiplier: 1.5,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
    {
        level: 2,
        expRequired: 120,
        maxHealth: 108,
        attackScale: 1.07,
        critChance: 0.104,
        critMultiplier: 1.52,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
    {
        level: 3,
        expRequired: 150,
        maxHealth: 116,
        attackScale: 1.14,
        critChance: 0.108,
        critMultiplier: 1.55,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
    {
        level: 4,
        expRequired: 190,
        maxHealth: 124,
        attackScale: 1.22,
        critChance: 0.113,
        critMultiplier: 1.58,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
    {
        level: 5,
        expRequired: 230,
        maxHealth: 133,
        attackScale: 1.31,
        critChance: 0.118,
        critMultiplier: 1.62,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
    {
        level: 6,
        expRequired: 280,
        maxHealth: 143,
        attackScale: 1.41,
        critChance: 0.124,
        critMultiplier: 1.67,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
    {
        level: 7,
        expRequired: 330,
        maxHealth: 154,
        attackScale: 1.52,
        critChance: 0.131,
        critMultiplier: 1.73,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
    {
        level: 8,
        expRequired: 390,
        maxHealth: 166,
        attackScale: 1.64,
        critChance: 0.139,
        critMultiplier: 1.8,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
    {
        level: 9,
        expRequired: 450,
        maxHealth: 179,
        attackScale: 1.78,
        critChance: 0.148,
        critMultiplier: 1.88,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
    {
        level: 10,
        expRequired: 0,
        maxHealth: 193,
        attackScale: 1.93,
        critChance: 0.158,
        critMultiplier: 1.97,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
];
