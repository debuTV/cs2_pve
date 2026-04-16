/**
 * @module 玩家系统/玩家/组件/实体桥接
 */
import { CSPlayerController, CSPlayerPawn, Instance } from "cs_script/point_script";
/** @type {Record<string, number>} */
const weaponSlots = {
    // --- 0: RIFLE (主武器：步枪、狙击、冲锋枪、重型武器) ---
    "weapon_ak47": 0,
    "weapon_aug":0,
    "weapon_awp": 0,
    "weapon_bizon": 0,
    "weapon_famas": 0,
    "weapon_g3sg1":0,
    "weapon_galilar": 0,
    "weapon_m249": 0,
    "weapon_m4a1": 0,
    "weapon_m4a1_silencer": 0,
    "weapon_mac10": 0,
    "weapon_mag7": 0,
    "weapon_mp5sd": 0,
    "weapon_mp7": 0,
    "weapon_mp9": 0,
    "weapon_negev": 0,
    "weapon_nova": 0,
    "weapon_p90": 0,
    "weapon_sawedoff":0,
    "weapon_scar20":0,
    "weapon_sg556": 0,
    "weapon_ssg08": 0,
    "weapon_ump45": 0,
    "weapon_xm1014": 0,

    // --- 1: PISTOL (副武器：手枪) ---
    "weapon_cz75a": 1,
    "weapon_deagle": 1,
    "weapon_elite": 1,
    "weapon_fiveseven": 1,
    "weapon_glock": 1,
    "weapon_hkp2000": 1,
    "weapon_p250": 1,
    "weapon_revolver": 1,
    "weapon_tec9": 1,
    "weapon_usp_silencer": 1,

    // --- 2: KNIFE (刀具) ---
    "weapon_knife": 2,
    "weapon_knife_t": 2
};
/**
 * Player 脚本层与 Source 2 引擎实体之间的桥接组件。
 *
 * Source 2 中每个真人玩家对应两个引擎实体：
 * - **CSPlayerController** — 持久存在于整个连接期间，不随死亡销毁。
 * - **CSPlayerPawn** — 可操控的物理身体，死亡/换队/重生时可能被销毁重建。
 *
 * 本组件负责：
 * 1. 绑定 Controller（首次连接）和 Pawn（每次激活/重生）。
 * 2. Pawn 切换时自动清理旧引用并建立新连接。
 * 3. 提供便捷方法同步血量/护甲、发放装备、Join Team、判定 Pawn 有效性。
 *
 * @navigationTitle 玩家实体桥接
 */
export class PlayerEntityBridge {
    /**
     * @param {import("../player.js").Player} player 所属玩家实例
     */
    constructor(player) {
        this.player = player;
        /** @type {CSPlayerController | null} */
        this.controller = null;
        /** @type {CSPlayerPawn | null} */
        this.pawn = null;
    }

    /**
     * 绑定 controller（首次连接时）
     * @param {CSPlayerController} controller
     */
    bindController(controller) {
        this.controller = controller;
    }

    /**
     * 绑定 pawn（激活/重生时）
     * @param {CSPlayerPawn} pawn
     */
    bindPawn(pawn) {
        // 清理旧 pawn（如果有）
        if (this.pawn && this.pawn !== pawn) {
            this._cleanupPawn();
        }
        this.pawn = pawn;
    }

    /**
     * 重绑 pawn（OnPlayerReset 时调用）
     * 会先清理旧 pawn，再绑定新 pawn
     * @param {CSPlayerPawn} newPawn
     */
    rebindPawn(newPawn) {
        this.bindPawn(newPawn);
    }

    /**
     * 断开连接时清理
     */
    disconnect() {
        this._cleanupPawn();
        this.controller = null;
        this.pawn = null;
    }

    // ——— 实体操作便捷方法 ———

    /** Pawn 是否有效。 @returns {boolean} */
    isPawnValid() {
        return !!this.pawn && this.pawn.IsValid();
    }

    /** Controller 是否有效。 @returns {boolean} */
    isControllerValid() {
        return !!this.controller && this.controller.IsValid();
    }

    /** 获取玩家名称。 @returns {string} */
    getPlayerName() {
        return this.controller?.GetPlayerName() ?? "Unknown";
    }

    /** 获取玩家槽位。 @returns {number} */
    getSlot() {
        return this.controller?.GetPlayerSlot() ?? -1;
    }

    /**
     * 同步生命值到引擎实体
     * @param {number} health
     */
    syncHealth(health) {
        if (this.pawn && this.pawn.IsValid()) {
            this.pawn.SetHealth(health);
        }
    }

    /**
     * 同步最大生命值
     * @param {number} maxHealth
     */
    syncMaxHealth(maxHealth) {
        if (this.pawn && this.pawn.IsValid()) {
            this.pawn.SetMaxHealth(maxHealth);
        }
    }

    /**
     * 同步护甲到引擎实体
     * @param {number} armor
     */
    syncArmor(armor) {
        if (this.pawn && this.pawn.IsValid()) {
            this.pawn.SetArmor(armor);
        }
    }

    /**
     * 从引擎实体读取当前生命值
     * @returns {number}
     */
    readHealth() {
        return (this.pawn && this.pawn.IsValid()) ? this.pawn.GetHealth() : 0;
    }

    /**
     * 从引擎实体读取护甲
     * @returns {number}
     */
    readArmor() {
        return (this.pawn && this.pawn.IsValid()) ? this.pawn.GetArmor() : 0;
    }

    /**
     * 切换队伍
     * @param {number} team
     */
    joinTeam(team) {
        if (this.controller && this.controller.IsValid()) {
            this.controller.JoinTeam(team);
        }
    }

    /**
     * 给予物品。
     * @param {string} itemName 物品名称
     * @param {boolean} [forceCreate] 是否强制创建
     */
    giveItem(itemName, forceCreate = true) {
        if (this.pawn && this.pawn.IsValid()) {
            const itemslot=weaponSlots[itemName]??-1;
            const preweapon=this.pawn.FindWeaponBySlot(itemslot);
            if(preweapon)this.pawn.DestroyWeapon(preweapon);
            this.pawn.GiveNamedItem(itemName, forceCreate);
        }
        return true;
    }

    /**
     * 向对应玩家发送客户端命令。
     * @param {string} command
     * @returns {boolean}
     */
    clientCommand(command) {
        const slot = this.getSlot();
        if (!this.isControllerValid() || slot < 0 || !command) return false;
        Instance.ClientCommand(slot, command);
        return true;
    }

    /** 清除所有武器 */
    destroyWeapons() {
        if (this.pawn && this.pawn.IsValid()) {
            this.pawn.DestroyWeapons();
        }
    }

    /** @returns {boolean} pawn 是否存活 */
    isPawnAlive() {
        return !!(this.pawn && this.pawn.IsValid() && this.pawn.IsAlive());
    }

    // ——— 内部 ———

    /**
     * 清理旧 Pawn 引用。
     */
    _cleanupPawn() {
        // 旧 pawn 的 output 监听在 CS2 脚本 API 中无法手动解绑，
        // 但通过替换 pawn 引用可以防止旧回调继续影响逻辑。
        this.pawn = null;
    }
}
