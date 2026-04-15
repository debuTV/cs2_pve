/**
 * @module 投掷物系统/投掷物常量
 */

/**
 * 投掷物可命中的目标类型。
 *
 * 约定：
 * - `Player` 表示玩家宿主对象，对应 `Player` 实例。
 * - `Monster` 表示怪物宿主对象，对应 `Monster` 实例。
 * - 创建请求中的 `targetType` 决定本次投掷物只会命中玩家或怪物中的一种。
 */
export const ThrowTarget = {
    Player: "player",
    Monster: "monster",
};

/**
 * 投掷物创建请求。
 *
 * 约定：
 * - `entity` 由调用方负责提供，Throw 模块只接管其飞行、命中和回收。
 * - `gravityScale=0` 表示直线飞行；`gravityScale>0` 表示使用世界重力并按倍率缩放。
 * - `maxTargets<=0` 表示不限制命中数量；否则按距离升序保留最近的若干目标。
 * - `payload.result` 由管理器同步写回，成功返回投掷物 id，失败返回 -1。
 *
 * @typedef {object} ThrowCreateRequest
 * @property {import("cs_script/point_script").Vector} startPos - 投掷起点
 * @property {import("cs_script/point_script").Vector} endPos - 目标点，用于反解初速度或直线方向
 * @property {import("cs_script/point_script").Entity} entity - 已存在的投掷物实体
 * @property {number} speed - 飞行速度
 * @property {number} [gravityScale] - 重力倍率；0 时不受重力影响
 * @property {number} [radius] - 落点命中半径
 * @property {number} [maxLifetime] - 最大存活时间
 * @property {number} [maxTargets] - 最大命中目标数；按距离升序截断
 * @property {string} targetType - 本次投掷物命中的目标类型，使用 `ThrowTarget` 中的值
 * @property {import("cs_script/point_script").Entity | null} [source] - 伤害来源实体或施法实体
 * @property {Record<string, any>} [meta] - 业务自定义扩展字段，原样透传到命中事件
 * @property {number} result - 管理器返回的投掷物 id，失败返回 -1
 */

/**
 * 投掷物停止请求。
 * @typedef {object} ThrowStopRequest
 * @property {number} projectileId - 需要停止的投掷物 id
 * @property {boolean} [removeEntity] - 是否同时移除实体；默认 true
 * @property {boolean} result - 停止是否成功
 */

/**
 * 投掷物每帧检测上下文。
 * @typedef {object} ProjectileTickContext
 * @property {import("../player/player/player").Player[]} players - 当帧可命中的玩家列表
 * @property {import("../monster/monster/monster").Monster[]} monsters - 当帧可命中的怪物列表
 */

/**
 * 单个玩家命中条目。
 *
 * 约定：
 * - `targetType` 固定为 `ThrowTarget.Player`。
 * - `hit` 字段与 AreaEffect 保持一致，玩家使用 `slot`。
 *
 * @typedef {object} ProjectileHitPlayerEntry
 * @property {string} targetType - 命中的目标类型，固定为 player
 * @property {number} hit - 玩家 slot
 * @property {number} distance - 目标距落点的距离
 * @property {import("../player/player/player").Player} player - 命中的玩家实例
 */

/**
 * 单个怪物命中条目。
 *
 * 约定：
 * - `targetType` 固定为 `ThrowTarget.Monster`。
 * - `hit` 字段与 AreaEffect 保持一致，怪物使用 `monsterId`。
 *
 * @typedef {object} ProjectileHitMonsterEntry
 * @property {string} targetType - 命中的目标类型，固定为 monster
 * @property {number} hit - 怪物 monsterId
 * @property {number} distance - 目标距落点的距离
 * @property {import("../monster/monster/monster").Monster} monster - 命中的怪物实例
 */

/**
 * 单个命中目标条目。
 *
 * 约定：
 * - 命中列表已按距离升序排序，并已按 `maxTargets` 截断。
 * - 每条结果只会携带 `player` 或 `monster` 中的一种，不会混成联合 owner 字段。
 *
 * @typedef {ProjectileHitPlayerEntry | ProjectileHitMonsterEntry} ProjectileHitEntry
 */

/**
 * 投掷物创建后事件。
 * @typedef {object} OnProjectileCreated
 * @property {number} projectileId - 投掷物 id
 * @property {import("cs_script/point_script").Entity} entity - 投掷物实体
 * @property {string} targetType - 本次投掷物命中的目标类型
 * @property {import("cs_script/point_script").Entity | null} [source] - 伤害来源实体或施法实体
 * @property {Record<string, any>} [meta] - 业务扩展数据
 */

/**
 * 投掷物命中事件。
 *
 * 约定：
 * - Throw 模块只负责飞行和命中结果采样，不直接结算伤害。
 * - 订阅方应使用 `hitResults` 中的宿主对象自行完成伤害、Buff 或其他业务处理。
 * - `meta` 会原样透传调用方自定义上下文，例如 damage、reason 或技能类型。
 *
 * @typedef {object} OnProjectileHit
 * @property {number} projectileId - 投掷物 id
 * @property {import("cs_script/point_script").Entity} entity - 投掷物实体
 * @property {import("cs_script/point_script").Vector} impactPos - 落点位置
 * @property {number} radius - 命中半径
 * @property {string} targetType - 本次投掷物命中的目标类型
 * @property {import("cs_script/point_script").Entity | null} [source] - 伤害来源实体或施法实体
 * @property {ProjectileHitEntry[]} hitResults - 已排序并截断后的命中列表
 * @property {number} hitCount - 命中数量
 * @property {Record<string, any>} [meta] - 业务扩展数据
 */

/**
 * 投掷物停止事件。
 * @typedef {object} OnProjectileStopped
 * @property {number} projectileId - 投掷物 id
 * @property {import("cs_script/point_script").Entity} entity - 投掷物实体
 * @property {import("cs_script/point_script").Vector | null} impactPos - 落点；若提前清理则可能为空
 * @property {boolean} removedEntity - 是否已移除实体
 * @property {string} targetType - 本次投掷物命中的目标类型
 * @property {import("cs_script/point_script").Entity | null} [source] - 伤害来源实体或施法实体
 * @property {Record<string, any>} [meta] - 业务扩展数据
 */