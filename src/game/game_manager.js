/**
 * @module 游戏系统/游戏管理器
 */

import { GameState } from "./game_const";
import { eventBus } from "../util/event_bus";
import { event } from "../util/definition";
import { formatScopedMessage } from "../util/log";
import { Instance } from "cs_script/point_script";

/**
 * 游戏管理器，维护游戏生命周期状态机（WAITING → PREPARE → PLAYING → WON/LOST）。
 *
 * 不直接持有 WaveManager、PlayerManager、MonsterManager 等实例，
 * 只负责游戏状态流转，通过回调通知上层 main.js 驱动其他模块。
 *
 * @navigationTitle 游戏管理器
 */
export class GameManager {
    /**
     * @param {import("../util/definition").Adapter} adapter
     */
    constructor(adapter) {
        /** 
         * 当前游戏状态
         * @type {string}
         */
        this.gameState = GameState.WAITING;

        /**
         * 外部适配器实例，提供日志和广播接口
         * @type {import("../util/definition").Adapter}
         */
        this._adapter = adapter;
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Game.In.StartGameRequest, () => this.startGame()),
            eventBus.on(event.Game.In.EnterPreparePhaseRequest, () => this.enterPreparePhase()),
            eventBus.on(event.Game.In.ResetGameRequest, () => this.resetGame()),
            eventBus.on(event.Game.In.GameWinRequest, () => this.gameWon()),
            eventBus.on(event.Game.In.GameLoseRequest, () => this.gameLost())
        ];
    }

    // ═══════════════════════════════════════════════
    // 外部事件输入（由 main.js 编排器调用）
    // ═══════════════════════════════════════════════

    /**
     * 玩家加入。
     */
    onPlayerJoin() {
        if (this.gameState === GameState.WAITING) {
            this.enterPreparePhase();
        }
    }

    /**
     * 玩家离开。返回是否正在游戏
     * @param {number} slot
     */
    onPlayerLeave(slot) {
        return this.checkGameState();
    }

    /**
     * 玩家重生。
     */
    onPlayerRespawn() {
        if (this.gameState === GameState.WAITING) {
            this.enterPreparePhase();
        }
    }

    /**
     * 玩家死亡。返回是否正在游戏
     */
    onPlayerDeath() {
        return this.checkGameState();
    }

    // ═══════════════════════════════════════════════
    // 游戏状态流转
    // ═══════════════════════════════════════════════

    /**
     * 进入准备阶段。广播等待消息。
     */
    enterPreparePhase() {
        this.gameState = GameState.PREPARE;
        this._adapter.broadcast(formatScopedMessage("GameManager/enterPreparePhase", "=== 准备阶段开始 ==="));
        eventBus.emit(event.Game.Out.OnEnterPreparePhase);
    }

    /**
     * 启动游戏。仅在 PREPARE 状态下生效，切换到 PLAYING 并触发 onGameStart 回调。
     */
    startGame() {
        if (this.gameState !== GameState.PREPARE) return;
        this.gameState = GameState.PLAYING;
        this._adapter.broadcast(formatScopedMessage("GameManager/startGame", "=== 游戏开始 ==="));
        eventBus.emit(event.Game.Out.OnStartGame);
    }

    /**
     * 触发游戏失败。将状态切换为 LOST 并广播失败消息。
     */
    gameLost() {
        if (this.gameState === GameState.LOST || this.gameState === GameState.WON) return false;
        this.gameState = GameState.LOST;
        this._adapter.broadcast(formatScopedMessage("GameManager/gameLost", "=== 游戏失败 ==="));
        eventBus.emit(event.Game.Out.OnGameLost);
        return true;
    }

    /**
     * 触发游戏胜利。将状态切换为 WON 并广播胜利消息。
     */
    gameWon() {
        if (this.gameState === GameState.LOST || this.gameState === GameState.WON) return false;
        this.gameState = GameState.WON;
        this._adapter.broadcast(formatScopedMessage("GameManager/gameWon", "=== 游戏胜利 ==="));
        eventBus.emit(event.Game.Out.OnGameWin);
        return true;
    }
    clearAll()
    {
        this.gameState = GameState.WAITING;
        this._adapter.broadcast(formatScopedMessage("GameManager/clearAll", "重置游戏..."));
    }
    /**
     * 重置游戏状态，触发 onResetGame 回调通知其他模块。
     */
    resetGame() {
        this.clearAll();
        eventBus.emit(event.Game.Out.OnResetGame);
    }
    /**
     * 检查游戏状态。是否正在游戏
     */
    checkGameState() {
        return this.gameState === GameState.PLAYING;
    }
}
