/**
 * @module 商店系统/商店会话
 */
import { Instance } from "cs_script/point_script";
import { ShopState, ShopResult, ShopAction, SHOP_ITEMS_PER_PAGE } from "./shop_const";

/**
 * 单玩家商店会话。
 *
 * 维护一个玩家在商店中的全部运行时状态：
 * 打开/关闭、当前选中项索引、HUD 渲染、购买校验链。
 *
 * 商店会话本身不做按键检测，只接收抽象动作（{@link ShopAction}）。
 * 玩家信息获取和奖励发放全部通过外部回调完成。
 *
 * @navigationTitle 商店会话
 */
export class ShopSession {
    /**
     * @param {number} slot - 玩家槽位
     * @param {import("./shop_const").ShopItemConfig[]} items - 商品列表
     * @param {(slot: number) => import("./shop_const").ShopPlayerInfo | null} getPlayerInfo - 获取玩家信息回调
     * @param {(slot: number, item: import("./shop_const").ShopItemConfig, ctx: import("./shop_const").ShopPurchaseContext) => import("./shop_const").ShopGrantResult} grantReward - 发奖回调
     * @param {(slot: number, pawn: import("cs_script/point_script").CSPlayerPawn) => void} openShop - 渲染 HUD 回调
     * @param {(slot: number, pawn: import("cs_script/point_script").CSPlayerPawn, text: string) => void} refreshShop 
     * @param {(slot: number) => void} closeShop - 隐藏 HUD 回调
     */
    constructor(slot, items, getPlayerInfo, grantReward, openShop,refreshShop, closeShop) {
        /**
         * 玩家槽位。
         * @type {number} 
         */
        this.slot = slot;
        /** @type {import("./shop_const").ShopItemConfig[]} */
        this._items = items;
        /** @type {(slot: number) => import("./shop_const").ShopPlayerInfo | null} */
        this._getPlayerInfo = getPlayerInfo;
        /** @type {(slot: number, item: import("./shop_const").ShopItemConfig, ctx: import("./shop_const").ShopPurchaseContext) => import("./shop_const").ShopGrantResult} */
        this._grantReward = grantReward;
        /** @type {(slot: number, pawn: import("cs_script/point_script").CSPlayerPawn) => void} */
        this._openShop = openShop;
        /** @type {(slot: number, pawn: import("cs_script/point_script").CSPlayerPawn, text: string) => void} */
        this._refreshShop = refreshShop;
        /** @type {(slot: number) => void} */
        this._closeShop = closeShop;
        /**
         * 当前商店状态
         * @type {string} 
         */
        this.state = ShopState.CLOSED;
        /**
         * 当前选中项索引
         * @type {number} 
         */
        this.selectedIndex = 0;
        /**
         * 每页显示数量。
         * @type {number}
         */
        this._itemsPerPage = SHOP_ITEMS_PER_PAGE;
        /** 
         * 商店打开时的游戏时间
         * @type {number} 
         */
        this._openedAt = 0;
        /** @type {import("cs_script/point_script").CSPlayerPawn | null} */
        this._pawn = null;
        /**
         * 最近一次操作反馈（显示在 HUD 底部）
         * @type {string} 
         * */
        this._lastMessage = "";
    }

    /**
     * 打开商店。
     *
     * 若已打开则仅刷新 HUD 内容，不重复创建。
     *
     * @param {import("cs_script/point_script").CSPlayerPawn} pawn - 玩家 Pawn
     */
    open(pawn) {
        this._pawn = pawn;
        this._openedAt = Instance.GetGameTime();
        this.selectedIndex = 0;
        this._lastMessage = "";
        this.state = ShopState.OPEN;
        this._openShop(this.slot,pawn);
        this._refreshHud();
    }

    /**
     * 关闭商店，禁用 HUD 并清空会话状态。
     */
    close() {
        this._closeShop(this.slot);
        this.state = ShopState.CLOSED;
        this._pawn = null;
        this._lastMessage = "";
    }

    /**
     * 每 tick 推进一次商店会话。
     *
     * 每 tick 都会重新获取一次玩家信息并刷新页面，
     * 同时保持 HUD 像旧版 hud.js 一样贴脸显示。
     */
    tick() {
        if (this.state !== ShopState.OPEN || !this._pawn) return;
        this._refreshHud();
    }

    /**
     * 接收抽象动作并分发处理。
     *
     * 这是输入层与商店核心逻辑的唯一桥梁。
     * 外部只需把键位映射成 ShopAction 后调用此方法。
     *
     * @param {string} action - {@link ShopAction} 中定义的动作
     * @returns {{ result: string, message?: string }} 操作结果
     */
    handleAction(action) {
        if (this.state !== ShopState.OPEN) {
            return { result: ShopResult.SHOP_NOT_OPEN };
        }

        switch (action) {
            case ShopAction.UP:
                this._moveSelection(-1);
                this._refreshHud();
                return { result: "moved" };

            case ShopAction.DOWN:
                this._moveSelection(1);
                this._refreshHud();
                return { result: "moved" };

            case ShopAction.PAGE_PREV:
                this._movePage(-1);
                this._refreshHud();
                return { result: "page_changed" };

            case ShopAction.PAGE_NEXT:
                this._movePage(1);
                this._refreshHud();
                return { result: "page_changed" };

            case ShopAction.CONFIRM:
                return this._tryPurchase();

            case ShopAction.BACK:
                this.close();
                return { result: "closed" };

            default:
                return { result: "unknown_action" };
        }
    }

    // ——— 内部方法 ———

    /**
     * 移动当前选中索引（循环滚动）。
     * @param {number} delta - 移动量（-1 上移，+1 下移）
     */
    _moveSelection(delta) {
        if (this._items.length === 0) return;
        this.selectedIndex = (this.selectedIndex + delta + this._items.length) % this._items.length;
    }

    /**
     * 按页移动，并尽量保留页内光标位置。
     * @param {number} deltaPage
     */
    _movePage(deltaPage) {
        if (this._items.length === 0) return;

        const pageCount = this._getPageCount();
        const currentPage = this._getCurrentPageIndex();
        const pageOffset = this.selectedIndex % this._itemsPerPage;
        const nextPage = (currentPage + deltaPage + pageCount) % pageCount;
        const nextPageStart = nextPage * this._itemsPerPage;
        const nextPageEnd = Math.min(nextPageStart + this._itemsPerPage, this._items.length) - 1;
        this.selectedIndex = Math.min(nextPageStart + pageOffset, nextPageEnd);
    }

    _getPageCount() {
        return Math.max(1, Math.ceil(this._items.length / this._itemsPerPage));
    }

    _getCurrentPageIndex() {
        return Math.floor(this.selectedIndex / this._itemsPerPage);
    }

    /**
     * 执行购买校验链并调用外部发奖回调。
     *
     * 校验顺序：商品存在 → 玩家信息有效 → 等级 → 金币 → 调用 grantReward。
     *
     * @returns {{ result: string, message?: string }}
     */
    _tryPurchase() {
        const item = this._items[this.selectedIndex];
        if (!item) {
            this._lastMessage = "商品不存在";
            this._refreshHud();
            return { result: ShopResult.ITEM_NOT_FOUND, message: this._lastMessage };
        }

        const info = this._getPlayerInfo(this.slot);
        if (!info) {
            this._lastMessage = "无法获取玩家信息";
            this._refreshHud();
            return { result: ShopResult.PLAYER_NOT_FOUND, message: this._lastMessage };
        }

        if (info.level < item.requiredLevel) {
            this._lastMessage = `等级不足: 需要 ${item.requiredLevel} 级 (当前 ${info.level} 级)`;
            this._refreshHud();
            return { result: ShopResult.LEVEL_NOT_MET, message: this._lastMessage };
        }

        if (info.money < item.cost) {
            this._lastMessage = `金币不足: 需要 $${item.cost} (当前 $${info.money})`;
            this._refreshHud();
            return { result: ShopResult.MONEY_NOT_ENOUGH, message: this._lastMessage };
        }

        /** @type {import("./shop_const").ShopPurchaseContext} */
        const ctx = {
            selectedIndex: this.selectedIndex,
            price: item.cost,
            openedAt: this._openedAt,
            purchasedAt: Instance.GetGameTime(),
            playerInfo: { ...info },
        };

        const grantResult = this._grantReward(this.slot, item, ctx);

        if (!grantResult || !grantResult.success) {
            this._lastMessage = grantResult?.message ?? "购买失败";
            this._refreshHud();
            return { result: ShopResult.GRANT_FAILED, message: this._lastMessage };
        }

        this._lastMessage = grantResult.message ?? `购买成功: ${item.displayName}`;
        this._refreshHud();
        return { result: ShopResult.SUCCESS, message: this._lastMessage };
    }

    /**
     * 刷新 HUD 文本。
     *
     * 文案固定分为四段：玩家摘要、商店标题、商品列表、操作反馈/提示。
     */
    _refreshHud() {
        if (!this._pawn || this.state !== ShopState.OPEN) return;

        const info = this._getPlayerInfo(this.slot);

        // —— 玩家摘要 ——
        let text = "";
        if (info) {
            text += `等级: ${info.level}  金币: $${info.money}  `;
            text += `生命: ${info.health}  护甲: ${info.armor}\n`;
        }

        // —— 商店标题 ——
        text += `═══ 商  店 ═══\n`;
        text += `第 ${this._getCurrentPageIndex() + 1}/${this._getPageCount()} 页\n`;

        // —— 商品列表 ——
        if (this._items.length === 0) {
            text += `(无商品)\n`;
        } else {
            const pageStart = this._getCurrentPageIndex() * this._itemsPerPage;
            const pageEnd = Math.min(pageStart + this._itemsPerPage, this._items.length);
            for (let i = pageStart; i < pageEnd; i++) {
                const item = this._items[i];
                const prefix = i === this.selectedIndex ? "► " : "  ";
                const levelTag = item.requiredLevel > 1 ? ` [Lv${item.requiredLevel}]` : "";
                text += `${prefix}${item.displayName}  $${item.cost}${levelTag}\n`;
            }
        }

        // —— 操作反馈 / 提示 ——
        if (this._lastMessage) {
            text += `\n${this._lastMessage}\n`;
        }
        text += `\n[W/S 选中] [A/D 翻页] [E 确认] [SHIFT 返回]`;

        this._refreshShop(this.slot, this._pawn, text);
    }

    /**
     * 当前是否打开中。
     * @returns {boolean}
     */
    get isOpen() {
        return this.state === ShopState.OPEN;
    }
}
