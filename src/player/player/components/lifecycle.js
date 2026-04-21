/**
 * @module 玩家系统/玩家/组件/生命周期
 */
import { Instance } from "cs_script/point_script";
import { PlayerState } from "../../player_const";
import { formatScopedMessage } from "../../../util/log";
import { PlayerRuntimeEvents } from "../../../util/runtime_events.js";

/**
 * 玩家生命周期编排器。
 *
 * 将 PlayerState 的状态机转换封装为具名方法，在每个关键节点
 * 协调各组件完成初始化、清理和事件分发。
 *
 * 生命周期阶段：
 * | 方法          | 触发时机               | 核心动作                          |
 * |---------------|------------------------|-----------------------------------|
 * | `connect`     | 玩家首次连接           | 绑定 Controller，状态 → CONNECTED |
 * | `activate`    | Pawn 生成 / 激活       | 绑定 Pawn，发放装备，状态 → PREPARING |
 * | `disconnect`  | 玩家断开               | 清理 Buff，状态 → DISCONNECTED    |
 * | `handleDeath` | HealthCombat 判定死亡  | 切旁观者，状态 → DEAD             |
 * | `respawn`     | 重生触发               | 重置血量/护甲，并回到 PREPARING |
 * | `enterGameStart` | 游戏正式开始         | 同步战斗资源，保持 READY/PREPARING |
 *
 * @navigationTitle 玩家生命周期
 */
export class PlayerLifecycle {
    /**
     * @param {import("../player.js").Player} player 所属玩家实例
     */
    constructor(player) {
        this.player = player;
    }

    /**
     * 玩家首次连接
     * @param {import("cs_script/point_script").CSPlayerController} controller
     */
    connect(controller) {
        this.player.entityBridge.bindController(controller);
        this.player.applyStateTransition(PlayerState.CONNECTED);
    }

    /**
     * 玩家激活（拿到有效 pawn）
     * @param {import("cs_script/point_script").CSPlayerPawn|undefined|null} pawn
     */
    activate(pawn) {
        if(pawn)this.player.entityBridge.bindPawn(pawn);

        // 按当前等级初始化战斗资源
        this.player.stats.refreshLevelStats();
        this.player.entityBridge.syncMaxHealth(this.player.stats.maxHealth);
        this.player.entityBridge.syncHealth(this.player.stats.maxHealth);
        this.player.entityBridge.syncArmor(100);

        this.player.applyStateTransition(PlayerState.PREPARING);
        this.player.startInputTracking();
        this.player.setProfession(this.player.professionId);
        this.player.emitRuntimeEvent(PlayerRuntimeEvents.Spawn, { state: PlayerState.PREPARING });
        
        // 给予初始装备
        this._giveStartingEquipment();
        this.player.emitStatusSnapshot();

        Instance.Msg(formatScopedMessage("PlayerLifecycle/activate", `玩家 ${this.player.entityBridge.getPlayerName()} 已激活`));
    }
    /**
     * 重生，脚本指导玩家重生，需要让玩家加入队伍
     */
    respawn() {
        // 按当前等级初始化战斗资源
        this.player.stats.refreshLevelStats();
        this.player.entityBridge.syncMaxHealth(this.player.stats.maxHealth);
        this.player.entityBridge.syncHealth(this.player.stats.maxHealth);
        this.player.entityBridge.syncArmor(100);

        this.player.applyStateTransition(PlayerState.PREPARING);
        this.player.startInputTracking();
        this.player.setProfession(this.player.professionId);
        this.player.emitRuntimeEvent(PlayerRuntimeEvents.Spawn, { state: PlayerState.PREPARING });
        
        this.player.entityBridge.joinTeam(3); // 切回CT

        // 给予初始装备
        this._giveStartingEquipment();
        this.player.emitStatusSnapshot();
        Instance.Msg(formatScopedMessage("PlayerLifecycle/respawn", `玩家 ${this.player.entityBridge.getPlayerName()} 已重生`));
    }
    /**
     * 游戏正式开始后同步战斗资源，不改变 READY/PREPARING 语义。
     */
    enterGameStart() {
        const stats = this.player.stats;
        stats.refreshLevelStats();
        this.player.entityBridge.syncMaxHealth(stats.maxHealth);
        this.player.entityBridge.syncHealth(stats.health);
        this.player.entityBridge.syncArmor(stats.armor);
        this.player.startInputTracking(this.player.entityBridge.pawn);
        this.player.emitStatusSnapshot();
    }

    /**
     * 断开连接。
     */
    disconnect() {
        this.player.stopInputTracking();
        this.player.clearSkillBinding(true);
        this.player.clearBuffs();
        this.player.entityBridge.disconnect();
        this.player.applyStateTransition(PlayerState.DISCONNECTED);
    }

    /**
     * 重置整局数据并回到等待准备。
     */
    resetGameStatus() {
        const stats = this.player.stats;
        this.player.clearSkillBinding(true);
        this.player.clearBuffs();
        stats.resetGameProgress();
        this.player.entityBridge.syncMaxHealth(stats.maxHealth);
        this.player.entityBridge.syncHealth(stats.health);
        this.player.entityBridge.syncArmor(stats.armor);
        this.player.applyStateTransition(PlayerState.PREPARING);
        this.player.setProfession(this.player.professionId);
        this.player.startInputTracking(this.player.entityBridge.pawn);

        this.player.emitRuntimeEvent(PlayerRuntimeEvents.Spawn, { state: PlayerState.PREPARING });

        this._giveStartingEquipment();
        this.player.emitStatusSnapshot();
    }

    /**
     * 给予基础出生装备。
     */
    _giveStartingEquipment() {
        this.player.entityBridge.giveItem("item_assaultsuit");
        this.player.giveArmor(100);
        this.player.entityBridge.giveItem("weapon_knife");
        this.player.entityBridge.giveItem("weapon_usp_silencer");
        this.player.entityBridge.giveItem("weapon_mp5sd");
    }
}
