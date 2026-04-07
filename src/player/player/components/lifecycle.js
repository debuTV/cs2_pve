/**
 * @module 玩家系统/玩家/组件/生命周期
 */
import { Instance } from "cs_script/point_script";
import { SkillEvents } from "../../../skill/skill_const";
import { PlayerState } from "../../player_const";

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
 * | `respawn`     | 重生触发               | 重置血量/护甲，并进入外部指定状态 |
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
     * @param {import("cs_script/point_script").CSPlayerPawn} pawn
     * @param {number} targetState
     */
    activate(pawn, targetState) {
        this.player.entityBridge.bindPawn(pawn);
        const nextState = targetState === PlayerState.ALIVE ? PlayerState.ALIVE : PlayerState.PREPARING;

        // 按当前等级初始化战斗资源
        this.player.stats.refreshLevelStats();
        this.player.stats.resetCombatResources(this.player.stats.maxHealth, 0);
        this.player.entityBridge.syncMaxHealth(this.player.stats.maxHealth);
        this.player.entityBridge.syncHealth(this.player.stats.health);
        this.player.entityBridge.syncArmor(this.player.stats.armor);

        this.player.applyStateTransition(nextState);
        this.player.startInputTracking(pawn);
        this.player.ensureProfessionSkillBound();
        this.player.emitSkillEvent(SkillEvents.Spawn, { state: nextState });

        // 给予初始装备
        this._giveStartingEquipment();

        Instance.Msg(`玩家 ${this.player.entityBridge.getPlayerName()} 已激活`);
    }

    /**
     * 玩家重置（OnPlayerReset：重生/换队）
     * @param {import("cs_script/point_script").CSPlayerPawn} newPawn
     * @param {number} respawnState
     */
    handleReset(newPawn, respawnState = PlayerState.PREPARING) {
        this.player.entityBridge.rebindPawn(newPawn);

        // 同步脚本数值到新 pawn
        this.player.entityBridge.syncMaxHealth(this.player.stats.maxHealth);
        this.player.entityBridge.syncHealth(this.player.stats.health);
        this.player.entityBridge.syncArmor(this.player.stats.armor);

        // 如果之前是 DEAD，进入 RESPAWNING
        if (this.player.state === PlayerState.DEAD) {
            this.player.applyStateTransition(PlayerState.RESPAWNING);
            this.respawn(undefined, undefined, respawnState);
        } else {
            this.player.startInputTracking(newPawn);
            this.player.ensureProfessionSkillBound();
            // 非死亡状态的重置（换队等），保持原脚本生命值
            if (this.player.stats.health <= 0) {
                this.player.healthCombat.die(null);
            }
        }
    }

    /**
     * 重生流程
     * @param {number} [health]
     * @param {number} [armor]
     * @param {number} [targetState]
     */
    respawn(health, armor, targetState = PlayerState.PREPARING) {
        const stats = this.player.stats;
        const nextState = targetState === PlayerState.ALIVE ? PlayerState.ALIVE : PlayerState.PREPARING;
        stats.refreshLevelStats();
        stats.resetCombatResources(health ?? stats.maxHealth, armor);

        this.player.entityBridge.syncMaxHealth(stats.maxHealth);
        this.player.entityBridge.syncHealth(stats.health);
        this.player.entityBridge.syncArmor(stats.armor);
        this.player.entityBridge.joinTeam(3);

        this._giveStartingEquipment();

        this.player.applyStateTransition(nextState);
        this.player.startInputTracking(this.player.entityBridge.pawn);
        this.player.ensureProfessionSkillBound();
        this.player.emitSkillEvent(SkillEvents.Spawn, { state: nextState });

        Instance.Msg(`玩家 ${this.player.entityBridge.getPlayerName()} 已重生 (HP: ${stats.health})`);
    }

    /**
     * 游戏正式开始后切入 ALIVE。
     */
    enterAliveState() {
        const stats = this.player.stats;
        stats.refreshLevelStats();
        this.player.entityBridge.syncMaxHealth(stats.maxHealth);
        this.player.entityBridge.syncHealth(stats.health);
        this.player.entityBridge.syncArmor(stats.armor);
        this.player.applyStateTransition(PlayerState.ALIVE);
        this.player.startInputTracking(this.player.entityBridge.pawn);
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
        const rebound = this.player.rebindProfessionSkill();
        this.player.startInputTracking(this.player.entityBridge.pawn);
        if (rebound) {
            this.player.emitSkillEvent(SkillEvents.Spawn, { state: PlayerState.PREPARING });
        }
        this._giveStartingEquipment();
    }

    /**
     * 给予基础出生装备。
     */
    _giveStartingEquipment() {
        this.player.entityBridge.giveItem("weapon_knife");
        this.player.entityBridge.giveItem("weapon_glock");
    }
}
