/**
 * @module 商店系统/商店管理器
 */
import { Instance } from "cs_script/point_script";
import { eventBus } from "../util/event_bus";
import { event } from "../util/definition";
import { formatScopedMessage } from "../util/log";
import { ShopSession } from "./shop_session";
import { BASE_SHOP_ITEMS ,RAW_KEY_TO_ACTION} from "./shop_const";

/**
 * 商店管理器。
 *
 * 对外暴露两个接口（{@link openShop} / {@link closeShop}），
 * 并通过 eventBus 接收打开/关闭请求和输入事件。
 *
 * 管理器维护每个玩家 slot 的 {@link ShopSession}，
 * 负责创建/复用会话、转发抽象动作、以及批量关闭。
 *
 * 商店层不直接操作 Buff、武器或玩家经济系统，
 * 所有实际效果均通过 {@link _grantReward} 回调由外部决定。
 *
 * @navigationTitle 商店管理器
 */
export class ShopManager {
    /**
     * @param {{ (shopOpenRequest: import("./shop_const").ShopOpenRequest): boolean; (shopOpenRequest: import("./shop_const").ShopOpenRequest): boolean; }} canOpenShop
     */
    constructor(canOpenShop) {
        /**
         * 商店商品列表。
         * @type {import("./shop_const").ShopItemConfig[]}
         */
        this._items = BASE_SHOP_ITEMS;
        /** @type {(shopOpenRequest: import("./shop_const").ShopOpenRequest) => boolean} */
        this._canOpenShop = canOpenShop

        /**
         *  玩家槽位 → 商店会话 映射表
         *  @type {Map<number, ShopSession>}
         */
        this._sessions = new Map();
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Shop.In.ShopOpenRequest, (/**@type {import("./shop_const").ShopOpenRequest} */ payload) => {
                payload.result = this.openShop(payload);
            }),
            eventBus.on(event.Shop.In.ShopCloseRequest, (/**@type {import("./shop_const").ShopCloseRequest} */ payload) => {
                payload.result = this.closeShop(payload);
            }),
            eventBus.on(event.Input.Out.OnInput, (/** @type {import("../input/input_const").OnInput} */ payload) => {
                this.handleRawKey(payload.slot, payload.key);
            })
        ];
    }

    destroy()
    {
        for (const unsubscribe of this._unsubscribers) {
            unsubscribe();
        }
        this._unsubscribers.length = 0;
    }

    // ——— 对外接口 ———

    /**
     * 打开商店。
     *
     * 若该玩家已有会话且处于打开状态，则只刷新内容。
     * 若不存在会话则创建新会话。
     *
     * @param {import("./shop_const").ShopOpenRequest} shopOpenRequest - 打开商店请求
     * @returns {boolean}
     */
    openShop(shopOpenRequest) {
        if (!shopOpenRequest.pawn) {
            Instance.Msg(formatScopedMessage("ShopManager/openShop", `玩家 Pawn 不存在，无法打开商店 (slot=${shopOpenRequest.slot})`));
            return false;
        }

        if (!this._canOpenShop(shopOpenRequest)) {
            Instance.Msg(formatScopedMessage("ShopManager/openShop", `玩家不满足打开商店条件 (slot=${shopOpenRequest.slot})`));
            return false;
        }

        let session = this._sessions.get(shopOpenRequest.slot);
        if (!session) {
            session = new ShopSession(shopOpenRequest.slot, this._items);
            this._sessions.set(shopOpenRequest.slot, session);
        }

        session.open(shopOpenRequest.pawn);
        Instance.Msg(formatScopedMessage("ShopManager/openShop", `商店已打开 (slot=${shopOpenRequest.slot})`));
        return true;
    }

    /**
     * 关闭商店。
     *
     * 若商店未打开则静默跳过。
     *
     * @param {import("./shop_const").ShopCloseRequest} shopCloseRequest - 关闭商店请求
     * @returns {boolean}
     */
    closeShop(shopCloseRequest) {
        const session = this._sessions.get(shopCloseRequest.slot);
        if (!session || !session.isOpen) return false;

        session.close();
        Instance.Msg(formatScopedMessage("ShopManager/closeShop", `商店已关闭 (slot=${shopCloseRequest.slot})`));
        return true;
    }

    /**
     * 向指定玩家的商店会话发送原始按键。
     *
     * 商店管理器内部负责将 raw key 映射成 ShopAction。
     *
     * @param {number} playerSlot - 玩家槽位
     * @param {string} rawKey - InputDetector 返回的原始键名
     */
    handleRawKey(playerSlot, rawKey) {
        const session = this._sessions.get(playerSlot);
        if (!session || !session.isOpen) return null;
        const action = RAW_KEY_TO_ACTION[rawKey] ?? null;
        if (!action) return null;

        return session.handleAction(action);
    }

    /**
     * 每 tick 推进全部已打开的商店会话。
     */
    tick() {
        for (const [, session] of this._sessions) {
            if (!session.isOpen) continue;
            session.tick();
        }
    }

    /**
     * 关闭所有已打开的商店会话。
     */
    closeAll() {
        for (const [slot, session] of this._sessions) {
            if (session.isOpen) {
                session.close();
            }
        }
        this._sessions.clear();
    }
}