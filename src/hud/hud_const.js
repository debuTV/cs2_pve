/**
 * @module HUD系统/HUD常量
 */

/**
 * 地图中已存在的 HUD point_template 名称。
 */
export const HUD_TEMPLATE_NAME = "hud_template";

/**
 * 运行时生成的 HUD 实体名前缀。
 */
export const HUD_ENTITY_PREFIX = "hud";

/**
 *  HUD 贴脸显示参数。
 */
export const HUD_FACE_ATTACH = {
    radius: 7,
    // 正值向玩家左侧偏移，负值向右侧偏移。
    lateralOffset: 2,
};
/**
 * HUD 总是显示参数。
 * true: HUD 在所有游戏状态下显示
 * false: HUD 只在游戏进行中显示
 */
export const HUD_ALWAYS_VISIBLE = true;
/**
 * HUD 渠道定义。
 */
export const CHANNAL = {
    NONE: -1,
    SHOP: 0,
    STATUS: 1,
};

/**
 * 渠道优先级（数值越大越优先）。
 * 同一玩家只显示优先级最高的活跃请求；高优先级释放后自动回退。
 */
export const CHANNEL_PRIORITY = {
    [CHANNAL.NONE]: 0,
    [CHANNAL.STATUS]: 1,
    [CHANNAL.SHOP]: 2,
};
/**
 * @typedef {object} HudRequest
 * @property {string} text - 待显示文本
 * @property {import("cs_script/point_script").CSPlayerPawn} pawn - 关联的玩家 Pawn
 * @property {boolean} [alwaysVisible] - 是否总是显示HUD（可选，默认false）
 */

/**
 * @typedef {object} HudSession
 * @property {number} slot - 玩家槽位
 * @property {string} entityName - HUD 实体名
 * @property {import("cs_script/point_script").Entity | undefined} entity - HUD 实体引用
 * @property {number} activeChannel - 当前生效的渠道
 * @property {import("cs_script/point_script").CSPlayerPawn | null} pawn - 当前跟随的 Pawn
 * @property {boolean} use - 实体是否处于 Enable 状态
 * @property {Map<number, HudRequest>} requests - 各渠道的显示请求
 * @property {HudPlayerSummary} [playerInfo] - 玩家信息
 * @property {string} [renderedText] - 最近一次已渲染的文本
 */
/**
 * @typedef {object} HudPlayerSummary
 * @property {number} slot
 * @property {import("cs_script/point_script").CSPlayerPawn | null} [pawn]
 * @property {number} [health]
 * @property {number} [maxHealth]
 * @property {number} [level]
 * @property {string} [professionId]
 * @property {string} [professionDisplayName]
 * @property {number} [armor]
 * @property {number} [money]
 * @property {number} [exp]
 * @property {number} [expNeeded]
 * @property {number} [lastMonsterDamage]
 * @property {HudBuffSummary[]} [buffs]
 * @property {HudSkillSummary | null} [skill]
 */
/**
 * @typedef {object} HudBuffSummary
 * @property {number} id - buff 实例 id
 * @property {string} typeId - buff 类型 id
 * @property {number} remaining - buff 剩余时间（秒）
 */
/**
 * @typedef {object} HudSkillSummary
 * @property {number} id - 技能实例 id
 * @property {string} typeId - 技能类型 id
 * @property {number} cooldown - 技能冷却时间（秒）
 * @property {number} remainingCooldown - 技能剩余冷却时间（秒）
 * @property {boolean} isReady - 技能是否可用（不在冷却中且未被消耗）
 * @property {boolean} isConsumed - 技能是否已被消耗（一次性技能触发后即为 true）
 */
/**
 * @typedef {object} HudWaveSummary
 * @property {number} [currentWave] - 当前波数
 * @property {number} [totalWaves] - 总波数
 * @property {number} [monstersRemaining] - 本波剩余怪物数量
 * @property {number} [prepareTime] - 准备开始时间
 */
/**
 * @typedef {object} ShowHudRequest
 * @property {number} slot - 玩家槽位
 * @property {import("cs_script/point_script").CSPlayerPawn} pawn - 关联的玩家 Pawn
 * @property {string} text - HUD 显示内容
 * @property {number} channel - HUD 渠道
 * @property {boolean} [alwaysVisible] - 是否总是显示HUD（可选，默认false）
 * @property {boolean} result - 请求结果（是否成功提交）
 */
/**
 * @typedef {object} HideHudRequest
 * @property {number} slot - 玩家槽位
 * @property {number} [channel] - HUD 渠道
 * @property {boolean} result - 请求结果（是否成功提交）
 */
/**
 * @typedef {object} OnHudShown
 * @property {number} slot - 玩家槽位
 * @property {number} channel - 当前生效的 HUD 渠道
 * @property {string} text - 当前显示的 HUD 文本
 */
/**
 * @typedef {object} OnHudUpdated
 * @property {number} slot - 玩家槽位
 * @property {number} channel - 当前生效的 HUD 渠道
 * @property {string} text - 当前显示的 HUD 文本
 * @property {number} [previousChannel] - 更新前的 HUD 渠道
 */
/**
 * @typedef {object} OnHudHidden
 * @property {number} slot - 玩家槽位
 * @property {number} channel - 隐藏前的 HUD 渠道
 */