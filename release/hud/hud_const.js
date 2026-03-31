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