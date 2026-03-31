/**
 * @module 商店系统/商店管理器
 */
import { CSPlayerController, Instance } from "cs_script/point_script";
import { ShopSession } from "./shop_session";
import { BASE_SHOP_ITEMS, ShopAction } from "./shop_const";

/**
 * 商店管理器。
 *
 * 对外暴露两个接口（{@link openShop} / {@link closeShop}），
 * 依赖两个外部回调（getPlayerInfo / grantReward）。
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
    constructor() {
        /**
         * 商店商品列表。
         * @type {import("./shop_const").ShopItemConfig[]}
         */
        this._items = BASE_SHOP_ITEMS;

        /**
         *  玩家槽位 → 商店会话 映射表
         *  @type {Map<number, ShopSession>}
         */
        this._sessions = new Map();
        this.events = new ShopManagerEvents();
        this.init();
    }
    init()
    {
        Instance.OnScriptInput("openshop", (event) => {
            const controller = event.activator;
            if (controller && controller instanceof CSPlayerController) {
                const slot = controller.GetPlayerSlot();
                const pawn = controller.GetPlayerPawn();
                if (!pawn) return;
                this.openShop(slot, pawn);
            }
        });
        Instance.OnScriptInput("closeshop", (event) => {
            const controller = event.activator;
            if (controller && controller instanceof CSPlayerController) {
                const slot = controller.GetPlayerSlot();
                this.closeShop(slot);
            }
        });
    }
    // ——— 对外接口 ———

    /**
     * 打开商店。
     *
     * 若该玩家已有会话且处于打开状态，则只刷新内容。
     * 若不存在会话则创建新会话。
     *
     * @param {number} playerSlot - 玩家槽位
     * @param {import("cs_script/point_script").CSPlayerPawn} pawn - 玩家 Pawn
     */
    openShop(playerSlot, pawn) {
        if (!this.events.getPlayerInfo || !this.events.grantReward || !this.events.openshop || !this.events.closeshop || !this.events.refreshtext) {
            Instance.Msg(`[ShopManager] 回调未就绪，无法打开商店 (slot=${playerSlot})`);
            return;
        }

        let session = this._sessions.get(playerSlot);
        if (!session) {
            session = new ShopSession(
                playerSlot,
                this._items,
                (slot) => this.events.getPlayerInfo?.(slot) ?? null,
                (slot, item, ctx) => this.events.grantReward?.(slot, item, ctx) ?? { success: false, message: "回调未注入" },
                (slot, currentPawn) => this.events.openshop?.(slot,currentPawn),
                (slot, currentPawn, text) => this.events.refreshtext?.(slot, currentPawn, text),
                (slot) => this.events.closeshop?.(slot),
            );
            this._sessions.set(playerSlot, session);
        }

        session.open(pawn);
        Instance.Msg(`[ShopManager] 商店已打开 (slot=${playerSlot})`);
    }

    /**
     * 关闭商店。
     *
     * 若商店未打开则静默跳过。
     *
     * @param {number} playerSlot - 玩家槽位
     */
    closeShop(playerSlot) {
        const session = this._sessions.get(playerSlot);
        if (!session || !session.isOpen) return;

        session.close();
        Instance.Msg(`[ShopManager] 商店已关闭 (slot=${playerSlot})`);
    }

    /**
     * 向指定玩家的商店会话发送原始按键。
     *
     * 商店管理器内部负责将 raw key 映射成 ShopAction。
     *
     * @param {number} playerSlot - 玩家槽位
     * @param {string} rawKey - InputDetector 返回的原始键名
     * @returns {{ result: string, message?: string } | null}
     */
    handleRawKey(playerSlot, rawKey) {
        const session = this._sessions.get(playerSlot);
        if (!session || !session.isOpen) return null;
        // @ts-ignore
        const action = ShopAction[rawKey];
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
    }
}
export class ShopManagerEvents {
    constructor()
    {
        this.getPlayerInfo = null;
        this.grantReward = null;
        this.openshop = null;
        this.refreshtext=null;
        this.closeshop = null;
    }
    /** 设置获取玩家信息回调。 @param {(slot: number) => import("./shop_const").ShopPlayerInfo | null} callback*/
    setGetPlayerInfo(callback) {this.getPlayerInfo = callback;}
    /** 设置发奖回调。 @param {(slot: number, item: import("./shop_const").ShopItemConfig, ctx: import("./shop_const").ShopPurchaseContext) => import("./shop_const").ShopGrantResult} callback*/
    setGrantReward(callback) {this.grantReward = callback;}
    /** 设置打开 HUD 回调。 @param {(slot: number, pawn: import("cs_script/point_script").CSPlayerPawn) => void} callback*/
    setOpenShop(callback) {this.openshop = callback;}
    /** 设置刷新 HUD 回调。 @param {(slot: number, pawn: import("cs_script/point_script").CSPlayerPawn, text: string) => void} callback*/
    setRefreshText(callback) {this.refreshtext = callback;}
    /** 设置隐藏 HUD 回调。 @param {(slot: number) => void} callback*/
    setCloseShop(callback) {this.closeshop = callback;}
}