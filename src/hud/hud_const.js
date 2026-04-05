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
 */

/**
 * @typedef {object} HudSession
 * @property {number} slot - 玩家槽位
 * @property {string} entityName - HUD 实体名
 * @property {import("cs_script/point_script").Entity | undefined} entity - HUD 实体引用
 * @property {number} activeChannel - 当前生效的渠道
 * @property {import("cs_script/point_script").CSPlayerPawn | null} pawn - 当前跟随的 Pawn
 * @property {boolean} use - 实体是否处于 Enable 状态
 * @property {string} lastText - 上次渲染的文本（用于去重）
 * @property {Map<number, HudRequest>} requests - 各渠道的显示请求
 */

/**
 * @typedef {object} ShowHudRequest
 * @property {number} slot - 玩家槽位
 * @property {import("cs_script/point_script").CSPlayerPawn} pawn - 关联的玩家 Pawn
 * @property {string} text - HUD 显示内容
 * @property {number} channel - HUD 渠道
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