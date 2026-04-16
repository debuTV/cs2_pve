/**
 * @module 商店系统/商店常量
 */

/** @type {Record<string, string>} */
export const RAW_KEY_TO_ACTION = {
    W: "up",
    S: "down",
    A: "page_prev",
    D: "page_next",
    Use: "confirm",
    Walk: "back",
};

export const SHOP_ITEMS_PER_PAGE = 4;

export const ShopState = {
    CLOSED: "closed",
    OPEN: "open",
};

export const ShopResult = {
    SUCCESS: "success",
    ITEM_NOT_FOUND: "item_not_found",
    LEVEL_NOT_MET: "level_not_met",
    MONEY_NOT_ENOUGH: "money_not_enough",
    GRANT_FAILED: "grant_failed",
    SHOP_NOT_OPEN: "shop_not_open",
    PLAYER_NOT_FOUND: "player_not_found",
};

/**
 * @typedef {object} ShopItemConfig
 * @property {string} id
 * @property {string} displayName
 * @property {number} cost
 * @property {number} requiredLevel
 * @property {Record<string, any>} [payload]
 */

/** @type {ShopItemConfig[]} */
export const BASE_SHOP_ITEMS = [
    { id: "heal_small",  displayName: "治疗30",          cost: 200,  requiredLevel: 1, payload: { type: "heal",  amount: 30 } },
    { id: "heal_large",  displayName: "治疗80",          cost: 500,  requiredLevel: 3, payload: { type: "heal",  amount: 80 } },
    { id: "armor_small", displayName: "一半护甲",         cost: 300,  requiredLevel: 1, payload: { type: "armor", amount: 50 } },
    { id: "armor_full",  displayName: "全部护甲",         cost: 800,  requiredLevel: 5, payload: { type: "armor", amount: 100 } },
    { id: "buff_attack", displayName: "强攻增益",         cost: 600,  requiredLevel: 2, payload: { type: "buff",  buffConfigId: "attack_up" } },
    { id: "weapon_glock", displayName: "格洛克手枪",      cost: 500,  requiredLevel: 1, payload: { type: "weapon", weaponName: "weapon_glock" } },
    { id: "weapon_p250", displayName: "P250 手枪",        cost: 700,  requiredLevel: 2, payload: { type: "weapon", weaponName: "weapon_p250" } },
    { id: "weapon_deagle", displayName: "沙漠之鹰",        cost: 1200, requiredLevel: 3, payload: { type: "weapon", weaponName: "weapon_deagle" } },
    { id: "weapon_usp_silencer", displayName: "USP 消音版", cost: 900,  requiredLevel: 1, payload: { type: "weapon", weaponName: "weapon_usp_silencer" } },
    { id: "weapon_ak47", displayName: "AK-47",             cost: 2700, requiredLevel: 4, payload: { type: "weapon", weaponName: "weapon_ak47" } },
    { id: "weapon_m4a1", displayName: "M4A1 突击步枪",     cost: 2600, requiredLevel: 4, payload: { type: "weapon", weaponName: "weapon_m4a1" } },
    { id: "weapon_aug", displayName: "AUG 突击步枪",       cost: 3100, requiredLevel: 5, payload: { type: "weapon", weaponName: "weapon_aug" } },
    { id: "weapon_awp", displayName: "AWP 狙击枪",         cost: 5000, requiredLevel: 7, payload: { type: "weapon", weaponName: "weapon_awp" } },
    { id: "weapon_p90", displayName: "P90 冲锋枪",         cost: 2200, requiredLevel: 3, payload: { type: "weapon", weaponName: "weapon_p90" } },
    { id: "weapon_mac10", displayName: "MAC-10 冲锋枪",   cost: 1800, requiredLevel: 2, payload: { type: "weapon", weaponName: "weapon_mac10" } },
    { id: "weapon_xm1014", displayName: "XM1014 霰弹枪",  cost: 2500, requiredLevel: 4, payload: { type: "weapon", weaponName: "weapon_xm1014" } },
    { id: "weapon_m249", displayName: "M249 机枪",        cost: 6000, requiredLevel: 8, payload: { type: "weapon", weaponName: "weapon_m249" } },
];

/**
 * @typedef {object} ShopPlayerInfo
 * @property {number} money
 * @property {number} level
 * @property {number} health
 * @property {number} armor
 * @property {string[]} weapons
 */

/**
 * @typedef {object} ShopPurchaseContext
 * @property {number} selectedIndex
 * @property {number} price
 * @property {number} purchasedAt
 * @property {ShopPlayerInfo} playerInfo
 */

/**
 * @typedef {object} ShopGrantResult
 * @property {boolean} success
 * @property {string} [message]
 */

/**
 * @typedef {object} ShopOpenRequest
 * @property {number} slot - 玩家槽位
 * @property {import("cs_script/point_script").CSPlayerPawn} pawn - 玩家 Pawn 引用
 * @property {boolean} result - 输出参数，表示是否成功打开商店
 */
/**
 * @typedef {object} ShopCloseRequest
 * @property {number} slot - 玩家槽位
 * @property {boolean} result - 输出参数，表示是否成功关闭商店
 */
/**
 * @typedef {object} OnShopOpen
 * @property {number} slot - 玩家槽位
 */
/**
 * @typedef {object} OnShopClose
 * @property {number} slot - 玩家槽位
 */
/**
 * @typedef {object} OnBought
 * @property {number} slot - 玩家槽位
 * @property {string} itemId - 购买的商品 id
 * @property {number} price - 本次购买价格
 * @property {ShopPurchaseContext} purchaseContext - 本次购买上下文
 */