/**
 * @module 商店系统/商店常量
 */

import { TEMP_DISABLE } from "../runtime_flags";

export const ShopAction = {
    UP: "up",
    DOWN: "down",
    PAGE_PREV: "page_prev",
    PAGE_NEXT: "page_next",
    CONFIRM: "confirm",
    BACK: "back",
};

export const SHOP_KEY_MAP = {
    W: "up",
    A: "page_prev",
    S: "down",
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
const BASE_SHOP_ITEMS = [
    { id: "heal_small",  displayName: "小型治疗包", cost: 200,  requiredLevel: 1, payload: { type: "heal",  amount: 30 } },
    { id: "heal_large",  displayName: "大型治疗包", cost: 500,  requiredLevel: 3, payload: { type: "heal",  amount: 80 } },
    { id: "armor_small", displayName: "轻型护甲",   cost: 300,  requiredLevel: 1, payload: { type: "armor", amount: 50 } },
    { id: "armor_full",  displayName: "重型护甲",   cost: 800,  requiredLevel: 5, payload: { type: "armor", amount: 100 } },
    { id: "buff_attack", displayName: "强攻增益",   cost: 600,  requiredLevel: 2, payload: { type: "buff",  buffTypeId: "attack_up", params: { duration: 30, multiplier: 1.35 } } },
    { id: "weapon_ak47", displayName: "AK-47",      cost: 2700, requiredLevel: 4, payload: { type: "weapon", weaponName: "weapon_ak47" } },
];

export const DEFAULT_SHOP_ITEMS = BASE_SHOP_ITEMS.filter((item) => {
    if (TEMP_DISABLE.playerBuffs && item.payload?.type === "buff") {
        return false;
    }
    return true;
});

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
 * @property {number} openedAt
 * @property {number} purchasedAt
 * @property {ShopPlayerInfo} playerInfo
 */

/**
 * @typedef {object} ShopGrantResult
 * @property {boolean} success
 * @property {string} [message]
 */
