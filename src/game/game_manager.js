/**
 * @module 游戏系统/游戏管理器
 */

import { Instance } from "cs_script/point_script";
import { GameState } from "./game_const";

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
        this.events = new GameManagerEvents();
        this.init();
    }

    /**
     * 启用实体监听，强制切换
     * - startGame: 启动游戏（必须先进入准备阶段），切换到 PLAYING 状态
     * - enterPreparePhase: 进入准备阶段，广播等待消息
     * - resetGame: 重置游戏状态
     * - gameWon: 触发游戏胜利
     * - gameLost: 触发游戏失败
     */
    init() {
        //游戏开始
        Instance.OnScriptInput("startGame", () => {
            this.startGame();
        });
        //进入准备阶段
        Instance.OnScriptInput("enterPreparePhase", () => {
            this.enterPreparePhase();
        });
        //重置游戏
        Instance.OnScriptInput("resetGame", () => {
            this.resetGame();
        });
        //强制胜利
        Instance.OnScriptInput("gameWon", () => {
            this.gameWon();
        });
        //强制失败
        Instance.OnScriptInput("gameLost", () => {
            this.gameLost();
        });
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
        this._adapter.broadcast("=== 准备阶段开始 ===");
        this.events.onGamePrepare?.();
    }

    /**
     * 启动游戏。仅在 PREPARE 状态下生效，切换到 PLAYING 并触发 onGameStart 回调。
     */
    startGame() {
        if (this.gameState !== GameState.PREPARE) return;
        this.gameState = GameState.PLAYING;
        this._adapter.broadcast("=== 游戏开始 ===");
        this.events.onGameStart?.();
    }

    /**
     * 触发游戏失败。将状态切换为 LOST 并广播失败消息。
     */
    gameLost() {
        this.gameState = GameState.LOST;
        this._adapter.broadcast("=== 游戏失败 ===");
        this.events.onGameLost?.();
    }

    /**
     * 触发游戏胜利。将状态切换为 WON 并广播胜利消息。
     */
    gameWon() {
        this.gameState = GameState.WON;
        this._adapter.broadcast("=== 游戏胜利 ===");
        this.events.onGameWin?.();
    }

    /**
     * 重置游戏状态，触发 onResetGame 回调通知其他模块。
     */
    resetGame() {
        this.gameState = GameState.WAITING;
        this._adapter.broadcast("重置游戏...");
        this.events.onResetGame?.();
    }
    /**
     * 检查游戏状态。是否正在游戏
     */
    checkGameState() {
        return this.gameState == GameState.PLAYING;
    }
}
export class GameManagerEvents {
    constructor() {
        this.onGameStart = null;
        this.onGameWin = null;
        this.onGameLost = null;
        this.onGamePrepare = null;
        this.onResetGame = null;
    }
    /** 设置游戏开始回调。 @param {() => void} callback */
    setOnGameStart(callback) { this.onGameStart = callback; }
    /** 设置游戏胜利回调。 @param {() => void} callback */
    setOnGameWin(callback) { this.onGameWin = callback; }
    /** 设置游戏失败回调。 @param {() => void} callback */
    setOnGameLost(callback) { this.onGameLost = callback; }
    /** 设置游戏准备回调。 @param {() => void} callback */
    setOnGamePrepare(callback) { this.onGamePrepare = callback; }
    /** 设置游戏重置回调。 @param {() => void} callback */
    setOnResetGame(callback) { this.onResetGame = callback; }
}
