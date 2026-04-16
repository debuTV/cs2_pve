/**
 * @module 技能系统/哨戒炮台/常量配置
 */

/**
 * 哨戒炮台静态配置。
 *
 * 每个字段均可在 `player_turret` 技能的 params 中覆盖。
 *
 * @typedef {Object} SentryConfig
 * @property {number} searchRadius     - 搜敌半径（游戏单位）
 * @property {number} targetLostRange  - 目标超出此距离后丢失（游戏单位）
 * @property {number} damage           - 每次 tick 造成的伤害
 * @property {number} lifetime         - 炮台存活秒数，到期自动销毁
 * @property {number} attackInterval   - 炮台直接伤害判定间隔（秒）
 * @property {number} turnSpeed        - 炮台每秒最大水平转向角速度（度）
 */

/** @type {SentryConfig} */
export const SENTRY_DEFAULTS = {
    searchRadius:    640,
    targetLostRange: 768,
    damage:          50,
    lifetime:        120,
    attackInterval:  2,
    turnSpeed:       360,
};

/** 哨戒炮台 PointTemplate 默认实体名。 */
export const SENTRY_DEFAULT_TEMPLATE_NAME = "sentry_template";

/** 激光发射点围绕底座中心的水平半径。 */
export const SENTRY_LASER_ORBIT_RADIUS = 25;

/** 激光发射点高于底座中心的高度。 */
export const SENTRY_LASER_ORBIT_HEIGHT = 43.5;

/** 玩家触发技能时默认放置在当前位置。 */
export const SENTRY_DEFAULT_PLACEMENT_DISTANCE = 0;

/** 放置检测用的近似占位包围盒。 */
export const SENTRY_PLACEMENT_BOUNDS = {
    mins: { x: -24, y: -24, z: 0 },
    maxs: { x: 24, y: 24, z: 72 },
};

/**
 * 炮台内部状态枚举。
 * @enum {string}
 */
export const SentryState = {
    /** 空闲：无目标，正在扫描 */
    IDLE:     "idle",
    /** 战斗：已锁定目标并开火 */
    COMBAT:   "combat",
    /** 已销毁 */
    DESTROYED: "destroyed",
};

/**
 * @typedef {Object} SentryTurretOptions
 * @property {import("cs_script/point_script").Entity}  turretBase        - 底座实体（EntityGroup[0]）
 * @property {import("cs_script/point_script").Entity}  turretYaw         - 偏航旋转体（EntityGroup[1]）
 * @property {number} ownerKey                                              - 部署炮台的玩家槽位
 * @property {number} [turnSpeed]                                            - 炮台每秒最大水平转向角速度（度）
 * @property {import("cs_script/point_script").Entity[]} [spawnedEntities] - 本次模板生成出的全部实体
 */
