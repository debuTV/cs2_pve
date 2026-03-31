import { Instance, CSPlayerPawn, CSInputs, CSPlayerController, PointTemplate } from 'cs_script/point_script';

/**
 * @module 游戏系统/游戏配置
 */

/**
 * 游戏状态枚举。
 *
 * - `WAITING`  – 等待玩家加入。
 * - `PREPARE`  – 准备阶段，等待所有玩家 ready。
 * - `PLAYING`  – 游戏进行中。
 * - `WON`      – 所有波次通关，游戏胜利。
 * - `LOST`     – 所有玩家阵亡，游戏失败。
 *
 * @enum {string}
 * @navigationTitle 游戏状态枚举
 */
const GameState = {
    WAITING: 'WAITING',
    PREPARE: 'PREPARE',
    PLAYING: 'PLAYING',
    WON: 'WON',
    LOST: 'LOST'
};

/**
 * @module 游戏系统/游戏管理器
 */


/**
 * 游戏管理器，维护游戏生命周期状态机（WAITING → PREPARE → PLAYING → WON/LOST）。
 *
 * 不直接持有 WaveManager、PlayerManager、MonsterManager 等实例，
 * 只负责游戏状态流转，通过回调通知上层 main.js 驱动其他模块。
 *
 * @navigationTitle 游戏管理器
 */
class GameManager {
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

        // ——— 回调钩子 ———
        /**
         * 游戏准备回调，由 {@link enterPreparePhase} 触发，无参数。
         * @type {(() => void)|null}
         */
        this._onGamePrepare = null;
        /**
         * 游戏开始回调，由 {@link startGame} 触发，无参数。
         * @type {(() => void)|null}
         */
        this._onGameStart = null;
        /**
         * 游戏胜利回调，由 {@link gameWon} 触发，无参数。
         * @type {(() => void)|null}
         */
        this._onGameWin = null;
        /**
         * 游戏失败回调，由 {@link gameLost} 触发，无参数。
         * @type {(() => void)|null}
         */
        this._onGameLost = null;
        /**
         * 游戏重置回调，由 {@link resetGame} 触发，无参数。
         * @type {(() => void)|null}
         */
        this._onResetGame = null;
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
        this._onGamePrepare?.();
    }

    /**
     * 启动游戏。仅在 PREPARE 状态下生效，切换到 PLAYING 并触发 onGameStart 回调。
     */
    startGame() {
        if (this.gameState !== GameState.PREPARE) return;
        this.gameState = GameState.PLAYING;
        this._adapter.broadcast("=== 游戏开始 ===");
        this._onGameStart?.();
    }

    /**
     * 触发游戏失败。将状态切换为 LOST 并广播失败消息。
     */
    gameLost() {
        this.gameState = GameState.LOST;
        this._adapter.broadcast("=== 游戏失败 ===");
        this._onGameLost?.();
    }

    /**
     * 触发游戏胜利。将状态切换为 WON 并广播胜利消息。
     */
    gameWon() {
        this.gameState = GameState.WON;
        this._adapter.broadcast("=== 游戏胜利 ===");
        this._onGameWin?.();
    }

    /**
     * 重置游戏状态，触发 onResetGame 回调通知其他模块。
     */
    resetGame() {
        this.gameState = GameState.WAITING;
        this._adapter.broadcast("重置游戏...");
        this._onResetGame?.();
    }
    /**
     * 检查游戏状态。是否正在游戏
     */
    checkGameState() {
        return this.gameState == GameState.PLAYING;
    }

    // ═══════════════════════════════════════════════
    // 回调设置
    // ═══════════════════════════════════════════════

    /** 设置游戏开始回调。 @param {() => void} callback */
    setOnGameStart(callback) { this._onGameStart = callback; }
    /** 设置游戏胜利回调。 @param {() => void} callback */
    setOnGameWin(callback) { this._onGameWin = callback; }
    /** 设置游戏失败回调。 @param {() => void} callback */
    setOnGameLost(callback) { this._onGameLost = callback; }
    /** 设置游戏准备回调。 @param {() => void} callback */
    setOnGamePrepare(callback) { this._onGamePrepare = callback; }
    /** 设置游戏重置回调。 @param {() => void} callback */
    setOnResetGame(callback) { this._onResetGame = callback; }
}

/**
 * @module 波次系统/波次配置
 */

/**
 * 波次状态枚举。
 *
 * - `IDLE`  – 等待波次开始。
 * - `PREPARING`  – 波次准备阶段。
 * - `ACTIVE`  – 波次进行中。
 * - `COMPLETED` – 当前波次通关。
 *

 * @enum {string}
 * @navigationTitle 波次状态枚举
 */
const WaveState = {
    IDLE: 'IDLE',
    PREPARING: 'PREPARING',
    ACTIVE: 'ACTIVE',
    COMPLETED: 'COMPLETED'
};

/**
 * 内置的默认波次配置列表，包含三波递增难度的演示数据。
 * 实际使用时由 main.js 传入真实配置。
 * @type {import("../util/definition").waveConfig[]}
 * @navigationTitle 默认波次配置
 */
const wavesConfig=[
        { 
            name: "训练波", 
            totalMonsters: 4, 
            reward: 500, 
            spawnInterval: 0.1, 
            preparationTime: 0, //波次开始到第一个怪物出现时间，这段时间可以用来发消息
            aliveMonster:2, //同时存在的怪物数量
            monster_spawn_points_name:["monster_spawnpoint"],//这一波生成点
            monster_breakablemins:{x:-30,y:-30,z:0},//最大怪物的breakable的mins
            monster_breakablemaxs:{x:30,y:30,z:75},//最大怪物的breakable的maxs
            broadcastmessage:[{message:"",delay:1}],
            // monster 系统已独立拆出，主工程仅保留波次元数据。
            monsterTypes:[]
        },{ 
            name: "训练波", 
            totalMonsters: 4, 
            reward: 500, 
            spawnInterval: 0.1, 
            preparationTime: 0, //波次开始到第一个怪物出现时间，这段时间可以用来发消息
            aliveMonster:2, //同时存在的怪物数量
            monster_spawn_points_name:["monster_spawnpoint"],//这一波生成点
            monster_breakablemins:{x:-30,y:-30,z:0},//最大怪物的breakable的mins
            monster_breakablemaxs:{x:30,y:30,z:75},//最大怪物的breakable的maxs
            broadcastmessage:[{message:"",delay:1}],
            monsterTypes:[]
        },
    ];

/**
 * @module 波次系统/波次管理器
 */


/**
 * 独立版波次管理器，维护波次推进状态机（IDLE → PREPARING → ACTIVE → COMPLETED）。
 *
 * 支持预热阶段定时广播、波次开始/完成回调、逐波推进和重置。
 *
 * @navigationTitle 波次管理器
 */
class WaveManager {
    /**
     * @param {import("../util/definition").Adapter} adapter - 外部适配器（日志/广播/时钟）
     */
    constructor(adapter) {
        /** 
         * 当前波次号，从 1 开始计数，0 表示未开始任何波次
         * @type {number} 
         */
        this.currentWave = 0;
        /** 
         * 当前波次状态
         * @type {WaveState} 
         */
        this.waveState = WaveState.IDLE;
        /** 
         * 波次配置列表
         * @type {import("../util/definition").waveConfig[]} 
         */
        this.waves = wavesConfig;
        /**
         * 外部适配器实例，提供日志、广播和游戏时间接口
         * @type {import("../util/definition").Adapter} 
         */
        this._adapter = adapter;

        // ——— 回调钩子 ———
        /** 
         * 波次开始回调，由 {@link startWave} 触发，参数为当前波次号和配置。
         * @type {((waveNumber: number, waveConfig: import("../util/definition").waveConfig) => void) | null} 
         */
        this.onWaveStart = null;
        /**
         *  波次完成回调，由 {@link completeWave} 触发，参数为当前波次号和配置。
         *  @type {((waveNumber: number) => void) | null} 
         */
        this.onWaveComplete = null;

        // ——— 预热阶段内部状态 ———
        /**
         * 预热阶段上下文。
         * @type {{ startTime: number, duration: number, broadcastIndex: number, messages: { message: string, delay: number }[] }}
         */
        this._prepareContext = this._createPrepareContext();
        this.init();
    }
    /**
     * 启用实体监听
     * - endWave: 强制结束当前波次
     * - startWave: 开始指定波次，参数格式 "startWave_1"
     */
    init() {
        //强制结束当前波次
        Instance.OnScriptInput("endWave", () => {
            this.completeWave();
        });
        //开启波次
        Instance.OnScriptInput("startWave", (e) => {
            if (!e.caller) return;
            const parts = e.caller.GetEntityName().split('_');
            //脚本输入 startWave 的 parseInt 可能返回 NaN，需要验证
            const waveNumber = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(waveNumber)) {
                this.startWave(waveNumber);
            }
        });
    }

    /**
     * 创建预热阶段上下文。
     * @returns {{ startTime: number, duration: number, broadcastIndex: number, messages: { message: string, delay: number }[] }}
     */
    _createPrepareContext() {
        return {
            startTime: -1,
            duration: 0,
            broadcastIndex: 0,
            messages: []
        };
    }

    /**
     * 重置预热阶段临时状态。
     */
    _resetPrepareState() {
        this._prepareContext = this._createPrepareContext();
    }

    /**
     * 进入预热阶段。
     * @param {number} waveNumber
     * @param {import("../util/definition").waveConfig} wave
     */
    _enterPreparingState(waveNumber, wave) {
        this.currentWave = waveNumber;
        this.waveState = WaveState.PREPARING;
        this._prepareContext = {
            startTime: this._adapter.getGameTime(),
            duration: wave.preparationTime,
            broadcastIndex: 0,
            messages: wave.broadcastmessage
        };
    }

    /**
     * 结束预热并进入激活阶段。
     * @param {import("../util/definition").waveConfig} wave
     */
    _activateCurrentWave(wave) {
        this.waveState = WaveState.ACTIVE;
        this._resetPrepareState();
        this._adapter.log(`=== 第 ${this.currentWave} 波开始 ===`);
        this.onWaveStart?.(this.currentWave, wave);
    }

    // ═══════════════════════════════════════════════
    // 波次操作
    // ═══════════════════════════════════════════════

    /**
     * 开始指定波次。
     * - 若当前波次正在进行中（ACTIVE 或 PREPARING），则拒绝开始新波次。
     * - 参数 waveNumber 从 1 开始计数，必须在配置范围内。
     * @param {number} waveNumber 
     * @returns {boolean}
     */
    startWave(waveNumber) {
        if (this.waveState === WaveState.ACTIVE || this.waveState === WaveState.PREPARING) {
            this._adapter.log(`无法开始波次 ${waveNumber}，当前波次进行中 (state=${this.waveState})`);
            return false;
        }

        if (waveNumber < 1 || waveNumber > this.waves.length) {
            this._adapter.log(`波次 ${waveNumber} 超出范围 (1-${this.waves.length})`);
            return false;
        }

        const wave = this.getWaveConfig(waveNumber);

        // 广播波次信息
        const message =
            `=== 第 ${waveNumber} 波: ${wave.name ?? "?"} ===\n` +
            `怪物总数: ${wave.totalMonsters ?? "?"}\n` +
            `奖励: $${wave.reward ?? "?"}\n` +
            `准备时间: ${wave.preparationTime} 秒`;
        this._adapter.broadcast(message);

        // 进入预热阶段
        this._enterPreparingState(waveNumber, wave);

        return true;
    }

    /**
     * 波次完成（由外部或调试命令调用）。
     * @returns {boolean}
     */
    completeWave() {
        if (this.waveState !== WaveState.ACTIVE) return false;

        this.waveState = WaveState.COMPLETED;
        this._resetPrepareState();
        const wave = this.getWaveConfig(this.currentWave);

        let message =
            `=== 第 ${this.currentWave} 波完成 ===\n` +
            `奖励: $${wave?.reward ?? "?"}`;
        if (!this.hasNextWave()) {
            message += "\n=== 所有波次完成 ===";
        }
        this._adapter.broadcast(message);

        this.onWaveComplete?.(this.currentWave);
        return true;
    }

    /**
     * 开始下一波。
     * @returns {boolean}
     */
    nextWave() {
        if (!this.hasNextWave()) {
            this._adapter.log("所有波次已完成！");
            return false;
        }
        return this.startWave(this.currentWave + 1);
    }

    /**
     * 重置波次状态。重启游戏或重新进入地图时调用，回到初始状态（currentWave=0, state=IDLE）。
     */
    resetGame() {
        this.currentWave = 0;
        this.waveState = WaveState.IDLE;
        this._resetPrepareState();
        this._adapter.log("波次已重置");
    }

    // ═══════════════════════════════════════════════
    // 查询
    // ═══════════════════════════════════════════════

    /**
     * 获取指定波次的配置对象。
     * @param {number} waveNumber
     * @returns {import("../util/definition").waveConfig}
     */
    getWaveConfig(waveNumber) {
        return this.waves[waveNumber - 1];
    }
    /**
     * 判断是否还有后续波次。
     * @returns {boolean}
     */
    hasNextWave() {
        return this.currentWave < this.waves.length;
    }

    /**
     * 获取配置的波次总数。
     * @returns {number}
     */
    getTotalWaves() {
        return this.waves.length;
    }

    /**
     * 获取当前波次进度快照，包含当前波次号、总波次数、状态和波次配置。
     * @returns {{ current: number, total: number, state: string, wave: import("../util/definition").waveConfig|undefined }}
     */
    getProgress() {
        return {
            current: this.currentWave,
            total: this.waves.length,
            state: this.waveState,
            wave: this.getWaveConfig(this.currentWave)
        };
    }

    // ═══════════════════════════════════════════════
    // Tick（由外部驱动）
    // ═══════════════════════════════════════════════

    /**
     * 每帧由外部驱动调用，处理预热阶段的广播消息播放和倒计时推进。
     * 预热结束后自动切换至 ACTIVE 状态并触发 {@link onWaveStart} 回调。
     */
    tick() {
        if (this.waveState !== WaveState.PREPARING) return;

        const elapsed = this._adapter.getGameTime() - this._prepareContext.startTime;
        const wave = this.getWaveConfig(this.currentWave);
        const messages = this._prepareContext.messages;
        if (!wave) return;
        
        // 播放预热阶段的广播消息
        while (
            this._prepareContext.broadcastIndex < messages.length &&
            elapsed >= messages[this._prepareContext.broadcastIndex].delay
        ) {
            this._adapter.broadcast(messages[this._prepareContext.broadcastIndex].message);
            this._prepareContext.broadcastIndex++;
        }

        // 预热结束 → 进入 ACTIVE
        if (elapsed >= this._prepareContext.duration) {
            this._activateCurrentWave(wave);
        }
    }
    // ═══════════════════════════════════════════════
    // 回调设置
    // ═══════════════════════════════════════════════

    /**
     * 绑定波次开始回调，当波次从 PREPARING 进入 ACTIVE 时触发。
     * @param {(waveNumber: number, waveConfig: import("../util/definition").waveConfig) => void} callback
     */
    setOnWaveStart(callback) {this.onWaveStart = callback;}
    /**
     * 绑定波次完成回调，当 {@link completeWave} 被外部调用时触发。
     * @param {(waveNumber: number) => void} callback
     */
    setOnWaveComplete(callback) {this.onWaveComplete = callback;}
}

/**
 * @module 玩家系统/玩家/组件/实体桥接
 */

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
class PlayerEntityBridge {
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
            this.pawn.GiveNamedItem(itemName, forceCreate);
        }
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

/**
 * @module 玩家系统/玩家常量配置
 */
/**
 * 玩家等级成长配置。
 *
 * 采用"公式默认值 + 等级数组覆盖"的双层结构：
 * - 公式参数可自动生成所有等级的默认配置。
 * - 显式等级数组优先级更高，可覆盖公式生成的值。
 * - 未显式给出的等级由公式自动补全。
 *
 * 经验语义：每升一级扣除当前等级所需经验，剩余经验继续向下一等级积累。
 * 倍率语义：基础值 × 全局倍率，非逐级连乘。
 */
/**
 * 升级回血策略枚举。
 * @enum {string}
 */
const LevelUpHealPolicy = {
    PRESERVE_RATIO: "preserve_ratio",
    FULL: "full",
};
/**
 * 玩家状态枚举。
 *
 * 定义了玩家在整个游戏生命周期中可能处于的所有状态。
 * Player 的 `applyStateTransition()` 方法会根据这些值驱动状态机，
 * 同时通知 Buff 系统和事件总线。
 *
 * 状态流转典型路径：
 * `DISCONNECTED → CONNECTED → PREPARING → READY → ALIVE → DEAD → RESPAWNING → ALIVE`
 *
 * - `DISCONNECTED` (0)：玩家不在线，Player 实例即将或已被清理。
 * - `CONNECTED` (1)：玩家已连接但尚未进入游戏（Controller 已绑定，Pawn 未就绪）。
 * - `PREPARING` (2)：等待玩家点击准备。
 * - `READY` (3)：玩家已准备，等待所有人就绪后开波。
 * - `ALIVE` (4)：正常游戏中，可接收伤害和操作。
 * - `DEAD` (5)：已死亡，等待重生或回合结束。
 * - `RESPAWNING` (6)：正在执行重生流程。
 * - `SHOPPING` (7)：打开商店界面（预留，当前未完全实现）。
 *
 * @navigationTitle 玩家状态枚举
 */
const PlayerState = {
    /** 离线状态 */
    DISCONNECTED: 0,
    /** 在线并已连接 */
    CONNECTED:    1,
    /** 等待准备 */
    PREPARING:    2,
    /** 已准备就绪 */
    READY:        3,
    /** 游戏中存活 */
    ALIVE:        4,
    /** 已死亡 */
    DEAD:         5,
    /** 重生中 */
    RESPAWNING:   6};

/**
 * 单个等级的配置。
 *
 * @typedef {object} LevelConfig
 * @property {number} level
 * @property {number} expRequired
 * @property {number} maxHealthMultiplier
 * @property {number} attackMultiplier
 * @property {string} [healOnLevelUp]
 */

/**
 * 公式参数配置。
 *
 * @typedef {object} FormulaParams
 * @property {number} baseExp
 * @property {number} expPerLevel
 * @property {number} healthGrowth
 * @property {number} attackGrowth
 * @property {number} critChanceGrowth
 * @property {number} critMultiplierGrowth
 */

/**
 * 对实体伤害计算参数。
 *
 * @typedef {object} PlayerDamageOptions
 * @property {number} [flatBonus]
 * @property {number} [multiplier]
 * @property {number} [critChanceBonus]
 * @property {number} [critMultiplierBonus]
 * @property {boolean} [allowCrit]
 */

/**
 * 单次伤害结算结果。
 *
 * @typedef {object} PlayerDamageRoll
 * @property {number} damage
 * @property {number} baseDamage
 * @property {number} critChance
 * @property {number} critMultiplier
 * @property {boolean} isCritical
 */

const MAX_LEVEL = 5;
const BASE_MAX_HEALTH = 100;
const BASE_ATTACK = 10;
const BASE_CRIT_CHANCE = 0.1;
const BASE_CRIT_MULTIPLIER = 1.5;
const DEFAULT_LEVEL_UP_HEAL_POLICY = LevelUpHealPolicy.FULL;

/** @type {FormulaParams} */
const FORMULA_PARAMS = {
    baseExp: 100,
    expPerLevel: 50,
    healthGrowth: 0.1,
    attackGrowth: 0.08,
    critChanceGrowth: 0.005,
    critMultiplierGrowth: 0.02,
};

/** @type {LevelConfig[]} */
const LEVEL_OVERRIDES = [];

/**
 * @param {number} level
 * @returns {LevelConfig}
 */
function buildFormulaConfig(level) {
    const p = FORMULA_PARAMS;
    return {
        level,
        expRequired: level >= MAX_LEVEL ? 0 : p.baseExp + (level - 1) * p.expPerLevel,
        maxHealthMultiplier: 1 + (level - 1) * p.healthGrowth,
        attackMultiplier: 1 + (level - 1) * p.attackGrowth,
    };
}

/**
 * @returns {LevelConfig[]}
 */
function buildLevelConfigs() {
    /** @type {LevelConfig[]} */
    const configs = [];
    for (let lv = 1; lv <= MAX_LEVEL; lv++) {
        configs.push(buildFormulaConfig(lv));
    }
    for (const override of LEVEL_OVERRIDES) {
        const idx = override.level - 1;
        if (idx >= 0 && idx < configs.length) {
            configs[idx] = { ...configs[idx], ...override };
        }
    }
    return configs;
}

const _levelConfigs = buildLevelConfigs();

/**
 * @param {number} level
 * @returns {LevelConfig}
 */
function getLevelConfig(level) {
    const clamped = Math.max(1, Math.min(level, MAX_LEVEL));
    return _levelConfigs[clamped - 1];
}

/**
 * @param {number} level
 * @returns {number}
 */
function getExpRequired(level) {
    if (level >= MAX_LEVEL) return 0;
    return getLevelConfig(level).expRequired;
}

/**
 * @param {number} level
 * @returns {number}
 */
function getMaxHealthForLevel(level) {
    return Math.round(BASE_MAX_HEALTH * getLevelConfig(Math.max(1, level)).maxHealthMultiplier);
}

/**
 * @param {number} level
 * @returns {number}
 */
function getAttackForLevel(level) {
    return Math.round(BASE_ATTACK * getLevelConfig(Math.max(1, level)).attackMultiplier);
}

/**
 * @param {number} level
 * @returns {number}
 */
function getCritChanceForLevel(level) {
    const p = FORMULA_PARAMS;
    return Math.max(0, Math.min(BASE_CRIT_CHANCE + (Math.max(1, level) - 1) * p.critChanceGrowth, 1));
}

/**
 * @param {number} level
 * @returns {number}
 */
function getCritMultiplierForLevel(level) {
    const p = FORMULA_PARAMS;
    return Math.max(1, BASE_CRIT_MULTIPLIER + (Math.max(1, level) - 1) * p.critMultiplierGrowth);
}

/**
 * @param {number} level
 * @returns {string}
 */
function getHealPolicyForLevel(level) {
    const config = getLevelConfig(Math.max(1, level));
    return config.healOnLevelUp ?? DEFAULT_LEVEL_UP_HEAL_POLICY;
}

/**
 * @param {number} baseDamage
 * @param {number} level
 * @returns {number}
 */
function scaleOutgoingDamage(baseDamage, level) {
    const config = getLevelConfig(Math.max(1, level));
    return Math.round(baseDamage * config.attackMultiplier);
}

/**
 * @param {number} level
 * @param {PlayerDamageOptions} [options]
 * @returns {PlayerDamageRoll}
 */
function rollDamageForLevel(level, options) {
    const baseAttack = getAttackForLevel(level);
    const flatBonus = options?.flatBonus ?? 0;
    const multiplier = options?.multiplier ?? 1;
    const allowCrit = options?.allowCrit ?? true;
    const critChance = Math.max(0, Math.min(getCritChanceForLevel(level) + (options?.critChanceBonus ?? 0), 1));
    const critMultiplier = Math.max(1, getCritMultiplierForLevel(level) + (options?.critMultiplierBonus ?? 0));

    let damage = Math.max(0, (baseAttack + flatBonus) * multiplier);
    let isCritical = false;
    if (allowCrit && Math.random() < critChance) {
        damage *= critMultiplier;
        isCritical = true;
    }

    return {
        damage: Math.max(0, Math.round(damage)),
        baseDamage: baseAttack,
        critChance,
        critMultiplier,
        isCritical,
    };
}

/**
 * @module 玩家系统/玩家/组件/玩家数值
 */

function scalePositiveAmount(amount, multiplier) {
    return amount > 0 ? amount * multiplier : amount;
}

class PlayerStats {
    constructor(player) {
        this.player = player;

        this.baseMaxHealth = getMaxHealthForLevel(1);
        this.maxHealth = this.baseMaxHealth;
        this.health = this.maxHealth;
        this.armor = 0;

        this.baseAttack = getAttackForLevel(1);
        this.attack = this.baseAttack;
        this.critChance = getCritChanceForLevel(1);
        this.critMultiplier = getCritMultiplierForLevel(1);

        this.baseMoneyGain = 1;
        this.moneyGain = 1;
        this.baseExpGain = 1;
        this.expGain = 1;

        this.money = 0;
        this.exp = 0;
        this.level = 1;

        this.score = 0;
        this.kills = 0;
        this.damageDealt = 0;
        this.headshots = 0;
        this.waveProgress = 0;
    }

    addMoney(amount, reason) {
        return this.applyMoneyDelta(amount, reason, true);
    }

    applyMoneyDelta(amount, reason, applyGain = true) {
        const scaledAmount = scalePositiveAmount(amount, applyGain ? this.moneyGain : 1);
        return this.applyRawMoneyDelta(scaledAmount, reason);
    }

    applyRawMoneyDelta(amount, reason) {
        if (!amount) return 0;

        const old = this.money;
        const next = Math.max(0, Math.round(old + amount));
        const actual = next - old;
        if (!actual) return 0;

        this.money = next;
        this.player.events.OnMoneyChanged?.(old, this.money, actual, reason);
        return actual;
    }

    deductMoney(amount) {
        if (this.money < amount) return false;
        this.applyRawMoneyDelta(-amount);
        return true;
    }

    addExp(amount, reason) {
        return this.applyExpDelta(amount, reason, true);
    }

    applyExpDelta(amount, reason, applyGain = true) {
        const scaledAmount = scalePositiveAmount(amount, applyGain ? this.expGain : 1);
        return this.applyRawExpDelta(scaledAmount, reason);
    }

    applyRawExpDelta(amount, reason) {
        if (!amount) return 0;
        if (this.level >= MAX_LEVEL) return 0;

        const oldExp = this.exp;
        const next = Math.max(0, Math.round(oldExp + amount));
        const actual = next - oldExp;
        if (!actual) return 0;

        this.exp = next;
        this.player.events.OnExpChanged?.(this.exp, actual, reason);

        if (actual > 0) {
            while (this._checkLevelUp()) { /* keep going */ }
        }

        return actual;
    }

    getExpNeeded() {
        return getExpRequired(this.level);
    }

    _checkLevelUp() {
        if (this.level >= MAX_LEVEL) {
            this.exp = 0;
            return false;
        }

        const needed = this.getExpNeeded();
        if (needed <= 0 || this.exp < needed) return false;

        const oldLevel = this.level;
        this.level++;
        this.exp -= needed;

        this._applyLevelDerivedStats();

        this.player.events.OnLevelUp?.(oldLevel, this.level);
        return true;
    }

    _applyLevelDerivedStats() {
        const oldMaxHealth = this.maxHealth;
        const healthRatio = oldMaxHealth > 0 ? this.health / oldMaxHealth : 1;

        this._updateLevelBaseStats();
        this._recomputeBuffDerivedStats();

        const policy = getHealPolicyForLevel(this.level);
        switch (policy) {
            case LevelUpHealPolicy.FULL:
                this.health = this.maxHealth;
                break;
            case LevelUpHealPolicy.PRESERVE_RATIO:
                this.health = Math.round(healthRatio * this.maxHealth);
                break;
        }

        this.health = Math.max(0, Math.min(this.health, this.maxHealth));
        this.player.entityBridge.syncMaxHealth(this.maxHealth);
        this.player.entityBridge.syncHealth(this.health);
    }

    refreshLevelStats() {
        this._updateLevelBaseStats();
        this._recomputeBuffDerivedStats();
    }

    resetGameProgress() {
        this.money = 0;
        this.exp = 0;
        this.level = 1;
        this.score = 0;
        this.kills = 0;
        this.damageDealt = 0;
        this.headshots = 0;
        this.waveProgress = 0;
        this.moneyGain = this.baseMoneyGain;
        this.expGain = this.baseExpGain;
        this.refreshLevelStats();
        this.resetCombatResources(this.maxHealth, 0);
    }

    setHealth(value) {
        this.health = Math.max(0, Math.min(Math.round(value), Math.round(this.maxHealth)));
    }

    setMaxHealth(value) {
        this.maxHealth = Math.max(1, Math.round(value));
        this.setHealth(this.health);
    }

    setArmor(value) {
        this.armor = Math.max(0, Math.min(Math.round(value), 100));
    }

    resetCombatResources(health, armor) {
        this.setHealth(health ?? this.maxHealth);
        this.setArmor(armor ?? 0);
    }

    getAttackRatio() {
        if (this.baseAttack <= 0) return 1;
        return this.attack / this.baseAttack;
    }

    getAttackDamage(baseDamage) {
        const levelScaled = scaleOutgoingDamage(baseDamage, this.level);
        return Math.max(0, Math.round(levelScaled * this.getAttackRatio()));
    }

    rollDamageAgainstEntity(options) {
        const result = rollDamageForLevel(this.level, options);
        const ratio = this.getAttackRatio();
        return {
            ...result,
            damage: Math.max(0, Math.round(result.damage * ratio)),
            baseDamage: Math.max(0, Math.round(result.baseDamage * ratio)),
        };
    }

    getSummary() {
        return {
            id: this.player.id,
            name: this.player.entityBridge.getPlayerName(),
            slot: this.player.slot,
            level: this.level,
            money: this.money,
            health: this.health,
            maxHealth: this.maxHealth,
            armor: this.armor,
            attack: this.attack,
            critChance: this.critChance,
            critMultiplier: this.critMultiplier,
            kills: this.kills,
            score: this.score,
            exp: this.exp,
            expNeeded: this.getExpNeeded(),
        };
    }

    _updateLevelBaseStats() {
        this.baseMaxHealth = getMaxHealthForLevel(this.level);
        this.baseAttack = getAttackForLevel(this.level);
        this.critChance = getCritChanceForLevel(this.level);
        this.critMultiplier = getCritMultiplierForLevel(this.level);
    }

    _recomputeBuffDerivedStats() {
        if (this.player.buffManager?.recomputeModifiers) {
            this.player.buffManager.recomputeModifiers();
            return;
        }

        this.maxHealth = this.baseMaxHealth;
        this.attack = this.baseAttack;
        this.moneyGain = this.baseMoneyGain;
        this.expGain = this.baseExpGain;
        this.health = Math.max(0, Math.min(this.health, this.maxHealth));
    }
}

/**
 * @module 玩家系统/玩家/组件/战斗组件
 */

/**
 * 玩家战斗组件 — 受伤、治疗与死亡判定。
 *
 * 所有对玩家的伤害都应通过 `takeDamage(damage, attacker)` 进入本组件。
 * 内部流程：
 * 1. 从引擎 Pawn 同步当前血量/护甲。
 * 2. 将伤害送入 PlayerBuffManager 的修饰器链（Buff 可减伤/增伤）。
 * 3. 优先扣护甲，再扣血量。
 * 4. 写回引擎并发布事件（DAMAGE_TAKEN / DEATH）。
 *
 * `heal(amount)` 提供治疗入口，受 maxHealth 上限限制。
 *
 * 死亡时：切换状态为 DEAD → 通知 Buff 层 → 切换至旁观者队伍。
 *
 * @navigationTitle 玩家战斗组件
 */
class PlayerHealthCombat {
    /**
     * @param {import("../player.js").Player} player 所属玩家实例
     */
    constructor(player) {
        this.player = player;
    }

    /**
     * 玩家受到伤害（统一入口）
     * @param {number} damage
     * @param {import("cs_script/point_script").Entity|null} [attacker]
     * @returns {boolean} 是否死亡
     */
    takeDamage(damage, attacker) {
        if (this.player.state === PlayerState.DEAD) return true;
        if (!this.player.entityBridge.isPawnValid()) return false;

        // 从引擎同步当前值
        this._syncFromEngine();

        // buff 修饰器链
        const ctx = { damage, attacker };
        // 触发前置事件，允许 buff 修改伤害,例如减伤、增伤、护甲一类的效果
        this.player.buffManager.onBeforeDamageTaken(ctx);
        damage = ctx.damage;

        if (damage <= 0) {
            this.player.buffManager.onAfterDamageTaken({ damage: 0, attacker });
            this.player.events.OnAfterDamageTaken?.(0, attacker);
            return false;
        }

        // 扣血后同步
        this.player.stats.setHealth(this.player.stats.health - damage);
        this.player.entityBridge.syncHealth(this.player.stats.health);

        this.player.buffManager.onAfterDamageTaken({ damage, attacker });

        this.player.events.OnAfterDamageTaken?.(damage, attacker);

        Instance.Msg(`玩家 ${this.player.entityBridge.getPlayerName()} 受到 ${damage} 伤害 (生命: ${this.player.stats.health}, 护甲: ${this.player.stats.armor})`);

        if (this.player.stats.health <= 0) {
            this.die(attacker);
            return true;
        }
        return false;
    }

    /**
     * 引擎伤害事件同步（OnPlayerDamage 回调时调用）
     * 此时引擎已经扣过血，只需同步脚本侧记录并检测死亡。
     * @param {number} damage
     * @param {import("cs_script/point_script").Entity|null} [attacker]
     * @param {import("cs_script/point_script").Entity|null} [inflictor]
     * @returns {boolean} 是否死亡
     */
    syncDamageFromEngine(damage, attacker, inflictor) {
        if (this.player.state === PlayerState.DEAD) return true;

        this._syncFromEngine();

        this.player.buffManager.onAfterDamageTaken({
            damage,
            attacker,
            inflictor,
        });

        this.player.events.OnAfterDamageTaken?.(damage, attacker, inflictor);

        Instance.Msg(`玩家 ${this.player.entityBridge.getPlayerName()} 受到 ${damage} 伤害 (生命: ${this.player.stats.health}, 护甲: ${this.player.stats.armor})`);

        if (this.player.stats.health <= 0) {
            this.die(attacker);
            return true;
        }
        return false;
    }

    /**
     * 治疗
     * @param {number} amount
     * @returns {boolean}
     */
    heal(amount) {
        if (this.player.state === PlayerState.DEAD) return false;
        if (!this.player.entityBridge.isPawnValid()) return false;

        const stats = this.player.stats;
        const newHealth = Math.min(stats.health + amount, stats.maxHealth);
        const actualHeal = newHealth - stats.health;
        if (actualHeal <= 0) return false;

        stats.setHealth(newHealth);
        this.player.entityBridge.syncHealth(stats.health);

        this.player.events.OnHeal?.(actualHeal);
        return true;
    }

    /**
     * 给予护甲
     * @param {number} amount
     * @returns {boolean}
     */
    giveArmor(amount) {
        if (this.player.state === PlayerState.DEAD) return false;
        if (!this.player.entityBridge.isPawnValid()) return false;

        const stats = this.player.stats;
        const newArmor = Math.min(stats.armor + amount, 100);
        const actual = newArmor - stats.armor;
        if (actual <= 0) return false;

        stats.setArmor(newArmor);
        this.player.entityBridge.syncArmor(stats.armor);
        return true;
    }

    /**
     * 死亡流程
     * @param {import("cs_script/point_script").Entity|null} [killer]
     */
    die(killer) {
        if (this.player.state === PlayerState.DEAD) return;

        this.player.applyStateTransition(PlayerState.DEAD);

        // 清理临时战斗 buff
        this.player.buffManager.clearCombatTemporary();

        // 切换到观察者
        this.player.entityBridge.joinTeam(1);

        this.player.events.OnDeath?.(this.player, killer);

        Instance.Msg(`玩家 ${this.player.entityBridge.getPlayerName()} 死亡`);
    }

    // ——— 内部 ———

    /** 从引擎读取 health/armor 到脚本 */
    _syncFromEngine() {
        const bridge = this.player.entityBridge;
        if (!bridge.isPawnValid()) return;
        this.player.stats.health = bridge.readHealth();
        this.player.stats.armor  = bridge.readArmor();
    }
}

/**
 * @typedef {Record<string, any>} EmitEventPayload
 */

class BuffTemplate{
    /**
     * @param {number}id
     * @param {any} target Buff 作用的目标
     * @param {number} duration Buff 持续时间(单位秒，为-1表示无限持续)
     */
    constructor(id,target,duration)
    {
        this.id=id;
        this.target=target;
        this.duration=duration;
        this.startTime=Instance.GetGameTime();
        this.use=false;
    }
    tick()
    {
        const currentTime=Instance.GetGameTime();
        if(this.duration!==-1 && currentTime-this.startTime>=this.duration)this.stop();
    }
    start()
    {
        this.use=true;
        this.startTime=Instance.GetGameTime();
    }
    stop()
    {
        this.use=false;
    }

    /**
     * 事件对外接口
     */
    
    /**
     * 目标每tick调用
     * @param {EmitEventPayload} payload
     * @returns {EmitEventPayload}
     */
    OnTick(payload){return payload;}
    /**
     * 目标对外发起攻击之前调用
     * @param {EmitEventPayload} payload
     * @returns {EmitEventPayload}
     */
    OnAttack(payload){return payload;}
    /**
     * 目标受到伤害之前调用
     * @param {EmitEventPayload} payload
     * @returns {EmitEventPayload}
     */
    OnDamage(payload){return payload;}
    /**
     * 目标死亡之前调用
     * @param {EmitEventPayload} payload
     * @returns {EmitEventPayload}
     */
    OnDeath(payload){return payload;}
    /**
     * 目标出生之后调用
     * @param {EmitEventPayload} payload
     * @returns {EmitEventPayload}
     */
    OnSpawn(payload){return payload;}
}

/**
 * Buff 管理器。
 */
class BuffManager {
    constructor() {
        /**
         * key 为 buff id。
         * value 为 buff 实例。
         * @type {Map<number, BuffTemplate>}
         */
        this.buffMap = new Map();
    }

    /**
     * @param {BuffTemplate} buff
     * @returns {BuffTemplate|null}
     */
    addbuff(buff)
    {
        if(!(buff instanceof BuffTemplate))return null;
        const currentBuff=this.buffMap.get(buff.id);
        if(currentBuff!==undefined)currentBuff.stop();
        buff.start();
        this.buffMap.set(buff.id,buff);
        return buff;
    }

    /**
     * @param {number} buffId
     * @returns {boolean}
     */
    deletebuff(buffId)
    {
        const buff=this.buffMap.get(buffId);
        if(buff===undefined)return false;
        buff.stop();
        this.buffMap.delete(buffId);
        return true;
    }

    tick()
    {
        for(const [buffId,buff] of this.buffMap)
        {
            if(buff.use===false)
            {
                this.buffMap.delete(buffId);
                continue;
            }
            buff.tick();
        }
    }

    clearAll()
    {
        for(const buff of this.buffMap.values())
        {
            buff.stop();
        }
        this.buffMap.clear();
    }

    /**
     * @param {number} buffId
     * @param {EmitEventPayload} payload
     * @returns {EmitEventPayload}
     */
    OnTick(buffId,payload)
    {
        const buff=this.buffMap.get(buffId);
        if(buff===undefined)return payload;
        return buff.OnTick(payload);
    }

    /**
     * @param {number} buffId
     * @param {EmitEventPayload} payload
     * @returns {EmitEventPayload}
     */
    OnAttack(buffId,payload)
    {
        const buff=this.buffMap.get(buffId);
        if(buff===undefined)return payload;
        return buff.OnAttack(payload);
    }

    /**
     * @param {number} buffId
     * @param {EmitEventPayload} payload
     * @returns {EmitEventPayload}
     */
    OnDamage(buffId,payload)
    {
        const buff=this.buffMap.get(buffId);
        if(buff===undefined)return payload;
        return buff.OnDamage(payload);
    }

    /**
     * @param {number} buffId
     * @param {EmitEventPayload} payload
     * @returns {EmitEventPayload}
     */
    OnDeath(buffId,payload)
    {
        const buff=this.buffMap.get(buffId);
        if(buff===undefined)return payload;
        return buff.OnDeath(payload);
    }

    /**
     * @param {number} buffId
     * @param {EmitEventPayload} payload
     * @returns {EmitEventPayload}
     */
    OnSpawn(buffId,payload)
    {
        const buff=this.buffMap.get(buffId);
        if(buff===undefined)return payload;
        return buff.OnSpawn(payload);
    }
}

var BuffManagerModule = /*#__PURE__*/Object.freeze({
    __proto__: null,
    BuffManager: BuffManager
});

const { GenericBuffManager } = /** @type {any} */ (BuffManagerModule);
const BuffTargetType = {
    PLAYER: "player",
};

/**
 * @typedef {{hostKey?: string|null, targetType?: string|null, target?: any, player?: import("../player").Player|null, monster?: any}} PlayerBuffContext
 */

class PlayerBuffManager {
    /** @param {import("../player").Player} player */
    constructor(player) {
        this.player = player;
        this._manager = new GenericBuffManager({
            targetType: BuffTargetType.PLAYER,
            target: player,
            player,
            hostId: player.id,
        });
        /** @type {any|null} */
        this._controller = null;
    }

    /** @param {any|null} controller */
    bindController(controller) {
        if (this._controller === controller) {
            if (controller) {
                controller.registerHost(BuffTargetType.PLAYER, this.player, this);
            }
            return;
        }

        if (this._controller) {
            this._controller.unregisterHost(BuffTargetType.PLAYER, this.player);
        }

        this._controller = controller;
        if (controller) {
            controller.registerHost(BuffTargetType.PLAYER, this.player, this);
        }
    }

    unbindController() {
        if (!this._controller) return;
        this._controller.unregisterHost(BuffTargetType.PLAYER, this.player);
        this._controller = null;
    }

    /**
     * @param {string} typeId
     * @param {Record<string, any>} [params]
     * @param {Record<string, any>|null} [source]
     * @param {PlayerBuffContext|null} [context]
     */
    addBuff(typeId, params, source, context = null) {
        if (this._controller) {
            return this._controller.createBuff({
                typeId,
                params,
                source,
                targetType: BuffTargetType.PLAYER,
                target: this.player,
                player: context?.player ?? this.player,
                monster: context?.monster ?? null,
            });
        }
        return this.addBuffLocal(typeId, params, source, context);
    }

    /**
     * @param {string} typeId
     * @param {Record<string, any>} [params]
     * @param {Record<string, any>|null} [source]
     * @param {PlayerBuffContext|null} [context]
     */
    addBuffLocal(typeId, params, source, context = null) {
        const before = this.getAllBuffsLocal();
        const result = this._manager.addBuff(typeId, params, source, this._normalizeContext(context));
        const after = this.getAllBuffsLocal();
        const { added, removed } = this._emitBuffCollectionChanges(before, after);

        if (result && added.length === 0 && removed.length === 0 && before.includes(result) && after.includes(result)) {
            this.player.events.OnBuffRefreshed?.(result);
        }
        return result;
    }

    /** @param {string|Record<string, any>|null|undefined} typeIdOrFilter */
    removeBuff(typeIdOrFilter) {
        return this.removeBuffLocal(typeIdOrFilter);
    }

    /** @param {string|Record<string, any>|null|undefined} typeIdOrFilter */
    removeBuffLocal(typeIdOrFilter) {
        return this._runWithBuffDiff(() => {
            if (typeIdOrFilter == null) return false;
            if (typeof typeIdOrFilter === "string") {
                return this._manager.removeBuff(typeIdOrFilter);
            }
            return this._manager.removeByFilter(typeIdOrFilter ?? {});
        });
    }

    /** @param {number} id */
    removeById(id) {
        return this.removeByIdLocal(id);
    }

    /** @param {number} id */
    removeByIdLocal(id) {
        return this._runWithBuffDiff(() => this._manager.removeById(id));
    }

    /** @param {string} tag */
    removeByTag(tag) {
        return this.removeByTagLocal(tag);
    }

    /** @param {string} tag */
    removeByTagLocal(tag) {
        return this._runWithBuffDiff(() => this._manager.removeByTag(tag));
    }

    /** @param {Record<string, any>} filter */
    removeByFilter(filter) {
        return this.removeByFilterLocal(filter);
    }

    /** @param {Record<string, any>} filter */
    removeByFilterLocal(filter) {
        return this._runWithBuffDiff(() => this._manager.removeByFilter(filter));
    }

    clearAll() {
        this.clearAllLocal();
    }

    clearAllLocal() {
        this._runWithBuffDiff(() => {
            this._manager.clearAll();
        });
    }

    clearCombatTemporary() {
        this.clearCombatTemporaryLocal();
    }

    clearCombatTemporaryLocal() {
        this._runWithBuffDiff(() => {
            this._manager.clearCombatTemporary();
        });
    }

    /** @param {string} typeId */
    getBuff(typeId) {
        return this.getBuffLocal(typeId);
    }

    /** @param {string} typeId */
    getBuffLocal(typeId) {
        return this._manager.getBuff(typeId);
    }

    /** @param {string} typeId */
    hasBuff(typeId) {
        return this.hasBuffLocal(typeId);
    }

    /** @param {string} typeId */
    hasBuffLocal(typeId) {
        return this._manager.hasBuff(typeId);
    }

    /** @param {string} tag */
    getBuffsByTag(tag) {
        return this.getBuffsByTagLocal(tag);
    }

    /** @param {string} tag */
    getBuffsByTagLocal(tag) {
        return this._manager.getAllBuffs().filter((/** @type {any} */ buff) => buff.hasTag(tag));
    }

    getAllBuffs() {
        return this.getAllBuffsLocal();
    }

    getAllBuffsLocal() {
        return this._manager.getAllBuffs();
    }

    /** @param {number} dt */
    tick(dt) {
        if (this._controller) return;
        this.tickLocal(dt);
    }

    /** @param {number} dt */
    tickLocal(dt) {
        this._runWithBuffDiff(() => {
            this._manager.tick(dt);
        });
    }

    /** @param {any} ctx */
    onBeforeDamageTaken(ctx) {
        this.onBeforeDamageTakenLocal(ctx);
    }

    /** @param {any} ctx */
    onBeforeDamageTakenLocal(ctx) {
        this._manager.onBeforeDamageTaken(ctx);
    }

    /** @param {any} ctx */
    onAfterDamageTaken(ctx) {
        this.onAfterDamageTakenLocal(ctx);
    }

    /** @param {any} ctx */
    onAfterDamageTakenLocal(ctx) {
        this._manager.onAfterDamageTaken(ctx);
    }

    /**
     * @param {number} oldState
     * @param {number} newState
     */
    onStateChange(oldState, newState) {
        this.onStateChangeLocal(oldState, newState);
    }

    /**
     * @param {number} oldState
     * @param {number} newState
     */
    onStateChangeLocal(oldState, newState) {
        this._runWithBuffDiff(() => {
            this._manager.onStateChange(oldState, newState);
        });
    }

    onRespawn() {
        this.onRespawnLocal();
    }

    onRespawnLocal() {
        this._runWithBuffDiff(() => {
            this._manager.onRespawn();
        });
    }

    recomputeModifiers() {
        this.recomputeModifiersLocal();
    }

    recomputeModifiersLocal() {
        this._manager.recomputeModifiers();
    }

    /**
     * 在本地 Buff 集合发生变化后，统一把 added / removed 事件抛给 Player。
     * 这样 PlayerManager 只需订阅 Player 事件，再由 main 决定如何消费这些运行时变化。
     * @param {any[]} before
     * @param {any[]} after
     * @returns {{added: any[], removed: any[]}}
     */
    _emitBuffCollectionChanges(before, after) {
        const added = after.filter((buff) => !before.includes(buff));
        const removed = before.filter((buff) => !after.includes(buff));

        for (const buff of added) {
            this.player.events.OnBuffAdded?.(buff);
        }
        for (const buff of removed) {
            this.player.events.OnBuffRemoved?.(buff);
        }

        return { added, removed };
    }

    /**
     * 对所有本地会改写 Buff 集合的方法做统一包裹，避免遗漏 removed 事件。
     * @template T
     * @param {() => T} mutation
     * @returns {T}
     */
    _runWithBuffDiff(mutation) {
        const before = this.getAllBuffsLocal();
        const result = mutation();
        const after = this.getAllBuffsLocal();
        this._emitBuffCollectionChanges(before, after);
        return result;
    }

    /** @param {PlayerBuffContext|null} [context] */
    _normalizeContext(context) {
        return {
            targetType: BuffTargetType.PLAYER,
            target: this.player,
            player: context?.player ?? this.player,
            monster: context?.monster ?? null,
            hostKey: context?.hostKey ?? null,
        };
    }
}

/**
 * @module 玩家系统/玩家/组件/生命周期
 */

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
 * | `activate`    | Pawn 生成 / 激活       | 绑定 Pawn，发放装备，状态 → ALIVE |
 * | `disconnect`  | 玩家断开               | 清理 Buff，状态 → DISCONNECTED    |
 * | `handleDeath` | HealthCombat 判定死亡  | 切旁观者，状态 → DEAD             |
 * | `respawn`     | 重生触发               | 重置血量/护甲，通知 Persistent Buff |
 *
 * @navigationTitle 玩家生命周期
 */
class PlayerLifecycle {
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
        this.player.events.OnJoin?.(this.player);
    }

    /**
     * 玩家激活（拿到有效 pawn）
     * @param {import("cs_script/point_script").CSPlayerPawn} pawn
     */
    activate(pawn) {
        this.player.entityBridge.bindPawn(pawn);

        // 按当前等级初始化战斗资源
        this.player.stats.refreshLevelStats();
        this.player.stats.resetCombatResources(this.player.stats.maxHealth, 0);
        this.player.entityBridge.syncMaxHealth(this.player.stats.maxHealth);
        this.player.entityBridge.syncHealth(this.player.stats.health);

        this.player.applyStateTransition(PlayerState.PREPARING);

        // 给予初始装备
        this._giveStartingEquipment();

        this.player.events.OnActivate?.(this.player);
        Instance.Msg(`玩家 ${this.player.entityBridge.getPlayerName()} 已激活`);
    }

    /**
     * 玩家重置（OnPlayerReset：重生/换队）
     * @param {import("cs_script/point_script").CSPlayerPawn} newPawn
     */
    handleReset(newPawn) {
        this.player.entityBridge.rebindPawn(newPawn);

        // 同步脚本数值到新 pawn
        this.player.entityBridge.syncMaxHealth(this.player.stats.maxHealth);
        this.player.entityBridge.syncHealth(this.player.stats.health);
        this.player.entityBridge.syncArmor(this.player.stats.armor);

        // 如果之前是 DEAD，进入 RESPAWNING
        if (this.player.state === PlayerState.DEAD) {
            this.player.applyStateTransition(PlayerState.RESPAWNING);
            this.respawn();
        } else {
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
     */
    respawn(health, armor) {
        const stats = this.player.stats;
        stats.refreshLevelStats();
        stats.resetCombatResources(health ?? stats.maxHealth, armor);

        this.player.entityBridge.syncMaxHealth(stats.maxHealth);
        this.player.entityBridge.syncHealth(stats.health);
        this.player.entityBridge.syncArmor(stats.armor);
        this.player.entityBridge.joinTeam(3);

        this._giveStartingEquipment();

        // 通知 persistent buff 重生
        this.player.buffManager.onRespawn();

        this.player.applyStateTransition(PlayerState.PREPARING);
        this.player.events.OnRespawned?.(this.player);

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
    }

    /**
     * 断开连接。
     */
    disconnect() {
        this.player.buffManager.clearAll();
        this.player.buffManager.unbindController();
        this.player.entityBridge.disconnect();
        this.player.applyStateTransition(PlayerState.DISCONNECTED);
        this.player.events.OnDisconnect?.(this.player);
    }

    /**
     * 重置整局数据并回到等待准备。
     */
    resetGameStatus() {
        const stats = this.player.stats;
        this.player.buffManager.clearAll();
        stats.resetGameProgress();
        this.player.entityBridge.syncMaxHealth(stats.maxHealth);
        this.player.entityBridge.syncHealth(stats.health);
        this.player.entityBridge.syncArmor(stats.armor);
        this.player.applyStateTransition(PlayerState.PREPARING);
        this.player.lastTick = 0;
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

/**
 * @module 玩家系统/玩家/玩家实体
 */

/**
 * 单玩家聚合根。
 *
 * 每个在线玩家对应一个 Player 实例，它是玩家系统中最核心的类。
 * Player 自身不包含业务逻辑实现，而是将所有行为委托给内部组件：
 *
 * - `entityBridge`  – 维护引擎层 Controller / Pawn 引用，负责血量、护甲同步。
 * - `stats`         – 管理金钱、经验、等级和升级判定。
 * - `healthCombat`  – 处理脚本侧伤害、引擎侧伤害同步、治疗和死亡。
 * - `buffManager`   – 维护 Buff 生命周期，驱动叠层/刷新/过期清理。
 * - `lifecycle`     – 连接、激活、重生、重置、断开时的状态转换。
 * - `tickDispatcher` – 每帧调度入口，推进 Buff tick 等持续逻辑。
 *
 * 外部系统（如 PlayerManager）通过 Player 上的公开方法与组件交互，
 * 通过专用回调事件订阅领域事件（死亡、升级、Buff 变化等）。
 *
 * 状态管理：所有状态变更必须经过 `applyStateTransition()` 统一入口，
 * 该方法会同步通知 Buff 系统和事件总线，确保状态一致性。
 *
 * @navigationTitle 玩家实体
 */
class Player {
    /**
     * @param {number} id 玩家唯一 ID
     * @param {number} slot 引擎 PlayerSlot
     */
    constructor(id, slot) {
        /** @type {number} 玩家唯一 ID */
        this.id = id;
        /** @type {number} 引擎 PlayerSlot */
        this.slot = slot;

        /** @type {number} 玩家当前状态，取值见 {@link PlayerState} */
        this.state = PlayerState.DISCONNECTED;

        /** @type {PlayerEvents} 玩家领域事件集合 */
        this.events = new PlayerEvents();
        /** @type {number} 上一次 tick 的游戏时间（0 表示尚未 tick） */
        this.lastTick = 0;
        // 组件
        /** @type {PlayerEntityBridge} 引擎实体桥接组件 */
        this.entityBridge  = new PlayerEntityBridge(this);
        /** @type {PlayerStats} 玩家成长数据组件 */
        this.stats         = new PlayerStats(this);
        /** @type {PlayerHealthCombat} 生命/战斗组件 */
        this.healthCombat  = new PlayerHealthCombat(this);
        /** @type {PlayerBuffManager} Buff 管理组件 */
        this.buffManager   = new PlayerBuffManager(this);
        /** @type {PlayerLifecycle} 生命周期组件 */
        this.lifecycle     = new PlayerLifecycle(this);
    }

    // ——— 生命周期入口（委托给 Lifecycle） ———

    /**
     * 绑定 Controller，进入 CONNECTED 状态。
     * @param {import("cs_script/point_script").CSPlayerController} controller 玩家控制器
     */
    connect(controller) {
        this.lifecycle.connect(controller);
    }

    /**
     * 绑定 Pawn，进入可游戏状态。
     * @param {import("cs_script/point_script").CSPlayerPawn} pawn 玩家 Pawn 实体
     */
    activate(pawn) {
        this.lifecycle.activate(pawn);
    }

    /**
     * 重置处理（重生/换队），更新 Pawn 引用并恢复状态。
     * @param {import("cs_script/point_script").CSPlayerPawn} newPawn 新的 Pawn 实体
     */
    handleReset(newPawn) {
        this.lifecycle.handleReset(newPawn);
    }

    /**
     * 断开连接，清理资源。
     */
    disconnect() {
        this.lifecycle.disconnect();
        this.events.clear();
    }

    /**
     * 重置局内状态（每局开始时调用）。
     */
    resetGameStatus() {
        this.lifecycle.resetGameStatus();
    }

    // ——— 战斗入口（委托给 HealthCombat） ———

    /**
     * 对玩家造成脚本侧伤害。
     * @param {number} damage 伤害量
     * @param {import("cs_script/point_script").Entity|null} [attacker] 攻击者实体
     * @returns {boolean} 是否导致死亡
     */
    takeDamage(damage, attacker) {
        return this.healthCombat.takeDamage(damage, attacker);
    }

    /**
     * 同步引擎侧伤害到脚本层状态。
     * @param {number} damage 伤害量
     * @param {import("cs_script/point_script").Entity|null} [attacker] 攻击者实体
     * @param {import("cs_script/point_script").Entity|null} [inflictor] 伤害来源实体
     * @returns {boolean} 是否导致死亡
     */
    syncDamageFromEngine(damage, attacker, inflictor) {
        return this.healthCombat.syncDamageFromEngine(damage, attacker, inflictor);
    }

    /**
     * 治疗玩家，恢复指定量的生命值。
     * @param {number} amount 治疗量
     * @returns {boolean} 是否成功
     */
    heal(amount) {
        return this.healthCombat.heal(amount);
    }

    /**
     * 给予玩家护甲。
     * @param {number} amount 护甲量
     * @returns {boolean} 是否成功
     */
    giveArmor(amount) {
        return this.healthCombat.giveArmor(amount);
    }

    /**
     * 复活玩家，可指定初始生命和护甲。
     * @param {number} [health] 复活后生命值
     * @param {number} [armor] 复活后护甲值
     */
    respawn(health, armor) {
        this.lifecycle.respawn(health, armor);
    }

    enterAliveState() {
        this.lifecycle.enterAliveState();
    }

    // ——— 成长入口（委托给 Stats） ———

    /**
     * 增加金钱。
     * @param {number} amount 金额
     * @param {string} [reason] 来源原因
     */
    addMoney(amount, reason) {
        this.stats.addMoney(amount, reason);
    }

    /**
     * 增加经验值。
     * @param {number} amount 经验量
     * @param {string} [reason] 来源原因
     */
    addExp(amount, reason) {
        this.stats.addExp(amount, reason);
    }

    // ——— 输出伤害（基于等级配置缩放） ———

    /**
     * 计算玩家对目标造成的实际伤害（基础伤害 × 等级攻击倍率）。
     * @param {number} baseDamage 基础伤害
     * @returns {number}
     */
    getAttackDamage(baseDamage) {
        return this.stats.getAttackDamage(baseDamage);
    }

    /**
     * 计算玩家对实体的一次伤害值，供外部系统通过 PlayerManager 间接调用。
     *
     * 返回最终数值；若外部需要暴击等细节，可改用 PlayerStats.rollDamageAgainstEntity。
     *
     * @param {import("../player_const").PlayerDamageOptions} [options]
     * @returns {number}
     */
    calculateDamageToEntity(options) {
        return this.stats.rollDamageAgainstEntity(options).damage;
    }

    // ——— Buff 入口（委托给 BuffManager） ———

    /**
     * 添加指定类型的 Buff。
     * @param {string} typeId Buff 类型标识
     * @param {Record<string, any>} [params] Buff 初始化参数
     * @param {Record<string, any>|null} [source] Buff 来源
     * @param {import("./components/buff_manager").PlayerBuffContext|null} [context] Buff 结算上下文
     * @returns {import("../../buff/buff_template").BuffTemplate | null} 创建的 Buff 实例，创建失败返回 null
     */
    addBuff(typeId, params, source, context) {
        return this.buffManager.addBuff(typeId, params, source, context);
    }

    /**
     * 移除指定类型的 Buff。
     * @param {string|Record<string, any>|null|undefined} typeIdOrFilter Buff 类型标识或过滤条件
     * @returns {boolean} 是否成功移除
     */
    removeBuff(typeIdOrFilter) {
        return this.buffManager.removeBuff(typeIdOrFilter);
    }

    /** @param {string} typeId */
    hasBuff(typeId) {
        return this.buffManager.hasBuff(typeId);
    }

    getAllBuffs() {
        return this.buffManager.getAllBuffs();
    }

    // ——— 准备状态 ———

    /** @returns {boolean} */
    get isReady() {
        return this.state === PlayerState.READY;
    }

    /** @returns {boolean} */
    get isAlive() {
        return this.state !== PlayerState.DEAD && this.state !== PlayerState.DISCONNECTED;
    }

    /** @returns {boolean} */
    get isInGame() {
        return this.state >= PlayerState.PREPARING;
    }

    /**
     * 设置玩家准备状态。
     * @param {boolean} ready 是否准备
     */
    setReady(ready) {
        if (ready && this.state === PlayerState.PREPARING) {
            this.applyStateTransition(PlayerState.READY);
            this.events.OnReadyChanged?.(true);
        } else if (!ready && this.state === PlayerState.READY) {
            this.applyStateTransition(PlayerState.PREPARING);
            this.events.OnReadyChanged?.(false);
        }
    }

    // ——— 状态机 ———

    /**
     * 状态迁移统一入口 — 唯一允许写 this.state 的地方。
     * @param {number} nextState
     * @returns {boolean}
     */
    applyStateTransition(nextState) {
        if (this.state === nextState) return true;
        const oldState = this.state;
        this.state = nextState;
        this.buffManager.onStateChange(oldState, nextState);
        this.events.OnStateChanged?.(oldState, nextState);
        return true;
    }

    /** @param {(ready: boolean) => void} callback */
    setOnReadyChanged(callback) {
        this.events.setOnReadyChanged(callback);
    }
    /** @param {(old: number, current: number, delta: number, reason?: string) => void} callback */
    setOnMoneyChanged(callback) {
        this.events.setOnMoneyChanged(callback);
    }
    /** @param {(oldLevel: number, newLevel: number) => void} callback */
    setOnLevelUp(callback) {
        this.events.setOnLevelUp(callback);
    }
    /** @param {(player: Player, killer?: any) => void} callback */
    setOnDeath(callback) {
        this.events.setOnDeath(callback);
    }
    /** @param {(player: Player) => void} callback */
    setOnRespawned(callback) {
        this.events.setOnRespawned(callback);
    }
    /** @param {(oldState: number, newState: number) => void} callback */
    setOnStateChanged(callback) {
        this.events.setOnStateChanged(callback);
    }
    /** @param {(damage: number, attacker?: any, inflictor?: any) => void} callback */
    setOnAfterDamageTaken(callback) {
        this.events.setOnAfterDamageTaken(callback);
    }
    /** @param {(amount: number) => void} callback */
    setOnHeal(callback) {
        this.events.setOnHeal(callback);
    }
    /** @param {(buff: any) => void} callback */
    setOnBuffAdded(callback) {
        this.events.setOnBuffAdded(callback);
    }
    /** @param {(buff: any) => void} callback */
    setOnBuffRemoved(callback) {
        this.events.setOnBuffRemoved(callback);
    }
    /** @param {(buff: any) => void} callback */
    setOnBuffRefreshed(callback) {
        this.events.setOnBuffRefreshed(callback);
    }

    // ——— Tick ———

    /**
     * 每帧调度入口。
     * @param {number} now 当前引擎时间
     */
    tick(now) {
        
        if (this.state === PlayerState.DISCONNECTED) return;
        if (this.state === PlayerState.DEAD) return;

        const dt = this.lastTick > 0 ? now - this.lastTick : 0;
        this.lastTick = now;
        if (dt <= 0) return;

        // 1. buff 计时 & 过期清理
        this.buffManager.tick(dt);
    }

    // ——— 查询 ———

    /**
     * 获取玩家属性快照（委托给 Stats）。
     * @returns {{id: number, name: string, slot: number, level: number, money: number, health: number, maxHealth: number, armor: number, attack: number, critChance: number, critMultiplier: number, kills: number, score: number, exp: number, expNeeded: number,pawn: CSPlayerPawn|null}}
     */
    getSummary() {
        return { ...this.stats.getSummary(), pawn: this.entityBridge.pawn };
    }
}
/**
 * 玩家领域回调集合。
 */
class PlayerEvents {
    constructor() {
        this.clear();
    }
    /** 
     * 玩家连接事件回调。
     * @param {(player: Player) => void} callback 
     */
    setOnJoin(callback) { this.OnJoin = callback; }
    /** 
     * 玩家激活事件回调。
     * @param {(player: Player) => void} callback 
     */
    setOnActivate(callback) { this.OnActivate = callback; }
    /** 
     * 玩家断开连接事件回调。
     * @param {(player: Player) => void} callback 
     */
    setOnDisconnect(callback) { this.OnDisconnect = callback; }
    /** 
     * 玩家准备状态变化事件回调。
     * @param {(ready: boolean) => void} callback 
     */
    setOnReadyChanged(callback) { this.OnReadyChanged = callback; }
    /** 
     * 玩家状态变化事件回调。
     * @param {(oldState: number, newState: number) => void} callback 
     */
    setOnStateChanged(callback) { this.OnStateChanged = callback; }
    /** 
     * 玩家受到伤害后事件回调。
     * @param {(damage: number, attacker?: any, inflictor?: any) => void} callback 
     */
    setOnAfterDamageTaken(callback) { this.OnAfterDamageTaken = callback; }
    /** 
     * 玩家治疗事件回调。
     * @param {(amount: number) => void} callback 
     */
    setOnHeal(callback) { this.OnHeal = callback; }
    /** 
     * 玩家死亡事件回调。
     * @param {(player: Player, killer?: any) => void} callback 
     */
    setOnDeath(callback) { this.OnDeath = callback; }
    /** 
     * 玩家重生事件回调。
     * @param {(player: Player) => void} callback 
     */
    setOnRespawned(callback) { this.OnRespawned = callback; }
    /** 
     * 玩家金钱变化事件回调。
     * @param {(old: number, current: number, delta: number, reason?: string) => void} callback 
     */
    setOnMoneyChanged(callback) { this.OnMoneyChanged = callback; }
    /** 
     * 玩家经验变化事件回调。
     * @param {(exp: number, delta: number, reason?: string) => void} callback 
     */
    setOnExpChanged(callback) { this.OnExpChanged = callback; }
    /** 
     * 玩家升级事件回调。
     * @param {(oldLevel: number, newLevel: number) => void} callback 
     */
    setOnLevelUp(callback) { this.OnLevelUp = callback; }
    /** 
     * 玩家获得Buff事件回调。
     * @param {(buff: any) => void} callback 
     */
    setOnBuffAdded(callback) { this.OnBuffAdded = callback; }
    /** 
     * 玩家失去Buff事件回调。
     * @param {(buff: any) => void} callback 
     */
    setOnBuffRemoved(callback) { this.OnBuffRemoved = callback; }
    /** 
     * 玩家刷新Buff事件回调。
     * @param {(buff: any) => void} callback 
     */
    setOnBuffRefreshed(callback) { this.OnBuffRefreshed = callback; }
    /** 
     * 玩家每个Tick事件回调。
     * @param {(dt: number) => void} callback 
     */
    setOnTick(callback) { this.OnTick = callback; }

    /** 清除所有回调 */
    clear() {
        this.OnJoin = null;
        this.OnActivate = null;
        this.OnDisconnect = null;
        this.OnReadyChanged = null;
        this.OnStateChanged = null;
        this.OnAfterDamageTaken = null;
        this.OnHeal = null;
        this.OnDeath = null;
        this.OnRespawned = null;
        this.OnMoneyChanged = null;
        this.OnExpChanged = null;
        this.OnLevelUp = null;
        this.OnBuffAdded = null;
        this.OnBuffRemoved = null;
        this.OnBuffRefreshed = null;
        this.OnTick = null;
    }
}

/**
 * @module 玩家系统/玩家管理器
 */

/**
 * @typedef {object} TP_playerRewardPayload - 玩家奖励分发载荷
 * @property {"buff"|"money"|"exp"|"heal"|"armor"|"damage"|"ready"|"respawn"|"resetGameStatus"} type - 奖励类型
 * @property {string} [buffTypeId] - Buff 类型 ID（仅 type="buff" 时适用）
 * @property {Record<string, any>} [params] - Buff 参数（仅 type="buff" 时适用）
 * @property {Record<string, any>|null} [source] - Buff 来源（仅 type="buff" 时适用）
 * @property {number} [amount] - 数值（仅 type="money"、"exp"、"heal"、"armor"、"damage" 时适用）
 * @property {string} [reason] - 原因描述（仅 type="money"、"exp" 时适用）
 * @property {boolean} [isReady] - 准备状态（仅 type="ready" 时适用）
 * @property {number} [health] - 生命值（仅 type="respawn" 时适用）
 * @property {number} [armor] - 护甲值（仅 type="respawn" 时适用）
 */
/**
 * @typedef {object} TP_playerBuffApplyContext
 * @property {Player|null} [player] - Buff 的目标玩家
 * @property {any|null} [monster] - Buff 的来源怪物
 */
/**
 * @typedef {object} TP_playerBuffEvent
 * @property {"request"|"added"|"removed"|"refreshed"|"damageTaken"|"heal"} type - Buff 运行时事件类型
 * @property {string} [buffTypeId] - 请求的 Buff 类型
 * @property {Record<string, any>} [params] - 请求参数
 * @property {Record<string, any>|null} [source] - 事件来源
 * @property {TP_playerBuffApplyContext|null} [context] - Buff 上下文
 * @property {any} [buff] - Buff 实例
 * @property {number} [amount] - 治疗或受伤数值
 * @property {any} [attacker] - 攻击者
 * @property {any} [inflictor] - 伤害来源实体
 */
/**
 * 负责所有在线玩家实例的集合管理，以及引擎事件到脚本层的桥接。
 * 它是外部系统与玩家系统交互的唯一入口。
 *
 * 主要职责：
 * - 提供玩家相关引擎事件的路由方法，由 main.js 负责统一注册监听，
 *   再转发到对应的 Player 实例上。
 * - 维护 `players` Map（slot → Player），跟踪在线人数和准备状态。
 * - 提供聚合操作 API：`dispatchReward` 等，
 *   按 slot 定位玩家并委托执行。
 * - 通过回调（`onPlayerJoin`、`onPlayerDeath` 等）向上层暴露关键生命周期事件。
 * - 提供查询方法：`getAllPlayers`、`getAlivePlayers`、`areAllPlayersReady` 等。
 *
 * 使用方式：先构造 `new PlayerManager()`，由 main.js 调用
 * `initializeExistingPlayers()` 完成初始玩家同步，再调用
 * `setupEventListeners()` 注册仅保留在模块内的脚本输入监听，
 * 然后在主循环中每帧调用 `tick(now)` 驱动所有玩家的持续逻辑。
 *
 * @navigationTitle 玩家管理器
 */
class PlayerManager {
    /**
     * @param {import("../util/definition").Adapter} adapter - 外部适配器（日志/广播/时钟）
     */
    constructor(adapter) {
        /** 
         * 玩家实例集合，key 为玩家 slot，value 为 Player 实例
         * @type {Map<number, Player>} 
         */
        this.players = new Map();
        /** 
         * 下一个玩家 ID
         * @type {number} 
         */
        this.nextPlayerId = 1;
        /** 
         * 总玩家数量
         * @type {number} 
         */
        this.totalPlayers = 0;
        /** 
         * 已准备玩家数量
         * @type {number} 
         */
        this.readyCount = 0;
        /**
         * 外部适配器实例，提供日志、广播和游戏时间接口
         * @type {import("../util/definition").Adapter} 
         */
        this._adapter = adapter;
        /** 每个 slot 的hud文本缓存 */
        this._statusTextCache = new Map();
        this._tempDisableLogKeys = new Set();
        /** @type {any|null} */
        this._buffController = null;
        this.events = new PlayerManagerEvents();
        /** @type {Record<string, (player: Player, payload: TP_playerRewardPayload) => void>} */
        this._rewardHandlers = {
            buff: (player, payload) => {
                if (!payload.buffTypeId) return;

                // 玩家模块只负责提出“要给谁什么 Buff”的请求，
                // 实际是否发放、用什么跨模块上下文，统一交给 main.js 决定。
                this.events.OnPlayerBuffEvent?.(player, {
                    type: "request",
                    buffTypeId: payload.buffTypeId,
                    params: payload.params,
                    source: payload.source ?? null,
                    context: {
                        player,
                        monster: null,
                    },
                });
            },
            money: (player, payload) => {
                player.addMoney(payload.amount ?? 0, payload.reason);
            },
            exp: (player, payload) => {
                player.addExp(payload.amount ?? 0, payload.reason);
            },
            heal: (player, payload) => {
                player.heal(payload.amount ?? 0);
            },
            armor: (player, payload) => {
                player.giveArmor(payload.amount ?? 0);
            },
            damage: (player, payload) => {
                player.takeDamage(payload.amount ?? 0, null);
            },
            ready: (player, payload) => {
                player.setReady(payload.isReady ?? false);
            },
            respawn: (player, payload) => {
                player.respawn(payload.health ?? 100, payload.armor ?? 0);
            },
            resetGameStatus: (player) => {
                player.resetGameStatus();
            }
        };
        this.init();
    }
    // ——— 初始化 / 脚本输入监听 ———
    /**
     * 将脚本加载前已存在的玩家同步进管理器。注册实体输入监听。
     *  - ready: 玩家准备状态变化，参数为玩家控制器。
     */
    init() {
        Instance.OnScriptInput("ready",(e)=>{
            const controller = e.activator;
            if(controller && controller instanceof CSPlayerPawn)
            {
                const player = this.getPlayerByPawn(controller);
                if (!player) return;
                player.setReady(player.isReady ? false : true);
            }
        });
    }
    /**
     * 所有类初始化完成后调用
     */
    refresh()
    {
        const players = Instance.FindEntitiesByClass("player");
        for (const player of players) {
            if (player && player instanceof CSPlayerPawn) {
                const controller = player.GetPlayerController();
                this.handlePlayerConnect(controller);
                if (player.IsAlive()) {
                    this.handlePlayerActivate(controller);
                }
            }
        }
    }
    // ——— 事件路由（只做解析 + 转发） ———

    /**
     * 当玩家连接时调用。
     * 参数1：玩家控制器。
     * @param {CSPlayerController|undefined} controller
     */
    handlePlayerConnect(controller) {
        if (!controller) return;

        const slot = controller.GetPlayerSlot();
        const existingPlayer = this.players.get(slot);
        const player = new Player(this.nextPlayerId++, slot);
        player.connect(controller);
        // 订阅玩家领域事件，桥接到 manager 级回调
        this._bindPlayerEvents(player);
        if (existingPlayer) {
            if (existingPlayer.isReady) {
                this.readyCount--;
            }
            existingPlayer.disconnect();
            this.players.delete(slot);
        }
        player.buffManager.bindController(this._buffController);
        this.players.set(slot, player);
        if (!existingPlayer) {
            this.totalPlayers++;
        }

        this._adapter.broadcast(`玩家 ${controller.GetPlayerName()} 加入游戏 (SLOT: ${slot})`);
        this.events.OnPlayerJoin?.(player);
        
        this._adapter.sendMessage(slot, "=== 欢迎加入游戏 ===");
    }

    /**
     * 玩家激活时调用，绑定 Pawn 并将玩家切换到可游戏状态。
     * @param {CSPlayerController|undefined} controller 玩家控制器
     */
    handlePlayerActivate(controller) {
        if (!controller) return;

        const slot = controller.GetPlayerSlot();
        const player = this.players.get(slot);
        if (!player) return;

        const pawn = controller.GetPlayerPawn();
        if(!pawn)return;
        player.activate(pawn);
    }

    /**
     * 玩家断开连接时调用，清理对应 Player 实例并更新计数。
     * @param {number} playerSlot 玩家槽位
     */
    handlePlayerDisconnect(playerSlot) {
        const player = this.players.get(playerSlot);
        if (!player) return;

        this._adapter.broadcast(`玩家 ${player.entityBridge.getPlayerName()} 离开游戏`);

        if (player.isReady) {
            this.readyCount--;
        }

        this.events.OnPlayerLeave?.(player);

        player.disconnect();
        this.players.delete(playerSlot);
        this.totalPlayers--;

        if (!player.isReady && this.areAllPlayersReady()) {
            this.events.OnAllPlayersReady?.();
        }
    }

    /**
     * 玩家重置（重生/换队）时调用，更新 Pawn 引用并触发重生回调。
     * @param {CSPlayerPawn} pawn 玩家 Pawn 实体
     */
    handlePlayerReset(pawn) {
        if (!pawn) return;
        const controller = pawn.GetPlayerController();
        if (!controller) return;
        let player = this.players.get(controller.GetPlayerSlot());

        if (player) {
            const wasDead = player.state === PlayerState.DEAD;
            player.handleReset(pawn);
            // 只有从 DEAD 恢复才是真正的重生，换队等不触发回调
            if (wasDead) {
                this.events.OnPlayerRespawn?.(player);
            }
        } else {
            // 全新未知玩家，走 connect + activate
            const controller = pawn.GetPlayerController();
            this.handlePlayerConnect(controller);
            this.handlePlayerActivate(controller);
        }
    }

    /**
     * 玩家死亡时调用，将玩家设为 DEAD 状态并触发死亡回调。
     * @param {CSPlayerPawn} playerPawn 玩家 Pawn 实体
     */
    handlePlayerDeath(playerPawn) {
        const player = this.getPlayerByPawn(playerPawn);
        if (!player) return;

        // 只在首次进入 DEAD 时触发回调，防止与 handlePlayerDamage 双重触发
        if (player.state !== PlayerState.DEAD) {
            player.healthCombat.die(null);
            this.events.OnPlayerDeath?.(playerPawn);
        }
    }

    /**
     * 处理玩家聊天指令。
     * 目前仅保留与玩家系统直接相关的入口；跨模块行为通过回调交给 main.js 编排。
     * @param {{player: CSPlayerController | undefined;text: string;team: number;}} event 引擎聊天事件
     */
    handlePlayerChat(event) {
        const controller = event.player;
        const text = event.text;
        if (!controller) return;
        const player = this.getPlayerByController(controller);
        if (!player) return;

        const parts = text.trim().toLowerCase().split(/\s+/);
        const command = parts[0];
        Number(parts[1]);

        if (command === "r" || command === "!r") {
            //玩家准备
            player.setReady(true);
        }
    }

    /**
     * 引擎伤害事件前置拦截，若玩家已死亡则中止伤害。
     * @param {import("cs_script/point_script").ModifyPlayerDamageEvent} event 引擎伤害修改事件
     */
    handleBeforePlayerDamage(event) {
        const player = this.getPlayerByPawn(event.player);
        if (!player || !player.isAlive) {
            return { abort: true };
        }
        return;
    }

    /**
     * 同步引擎侧伤害到脚本层，若第一次检测到死亡则触发死亡回调。
     * @param {import("cs_script/point_script").PlayerDamageEvent} event 引擎伤害事件
     */
    handlePlayerDamage(event) {
        const player = this.getPlayerByPawn(event.player);
        if (!player) return;

        const wasDead = player.state === PlayerState.DEAD;
        const died = player.syncDamageFromEngine(event.damage, event.attacker, event.inflictor);
        // 只在本次首次检测到死亡时触发回调，防止与 handlePlayerDeath (OnPlayerKill) 双重触发
        if (died && !wasDead) {
            this.events.OnPlayerDeath?.(event.player);
        }
    }

    // ——— 订阅 Player 领域事件 ———

    /**
     * 订阅玩家领域事件，将准备状态变化、金钱变化、升级等事件桥接到 manager 级回调。
     * @param {Player} player 玩家实例
     */
    _bindPlayerEvents(player) {
        player.setOnReadyChanged((ready) => {
            if (ready) this.readyCount++;
            else this.readyCount--;

            const name = player.entityBridge.getPlayerName();
            this._adapter.broadcast(
                ready
                    ? `${name} 已准备 (${this.readyCount}/${this.totalPlayers})`
                    : `${name} 取消准备 (${this.readyCount}/${this.totalPlayers})`
            );
            this.events.OnPlayerReady?.(player, ready);

            // 检查是否全员准备就绪
            if (ready && this.areAllPlayersReady()) {
                this.events.OnAllPlayersReady?.();
            }
        });

        player.setOnMoneyChanged((old, current, delta, reason) => {
            if (delta > 0) this._adapter.sendMessage(player.slot, `获得 $${delta} ${reason ?? ""}`);
            this.events.OnPlayerMoneyChange?.(player, old, current);
        });

        player.setOnLevelUp((oldLevel, newLevel) => {
            this._adapter.sendMessage(player.slot, `恭喜升级到 ${newLevel} 级！`);
            this.events.OnPlayerLevelUp?.(player, oldLevel, newLevel);
        });

        player.setOnAfterDamageTaken((amount, attacker, inflictor) => {
            this.events.OnPlayerBuffEvent?.(player, {
                type: "damageTaken",
                amount,
                attacker,
                inflictor,
            });
        });

        player.setOnHeal((amount) => {
            this.events.OnPlayerBuffEvent?.(player, {
                type: "heal",
                amount,
            });
        });

        player.setOnBuffAdded((buff) => {
            this.events.OnPlayerBuffEvent?.(player, {
                type: "added",
                buff,
            });
        });

        player.setOnBuffRemoved((buff) => {
            this.events.OnPlayerBuffEvent?.(player, {
                type: "removed",
                buff,
            });
        });

        player.setOnBuffRefreshed((buff) => {
            this.events.OnPlayerBuffEvent?.(player, {
                type: "refreshed",
                buff,
            });
        });
    }

    // ——— 兼容 API ———

    /**
     * 绑定全局 Buff 控制器。
     * main.js 会在这里把玩家 host 注册给全局 buff 编排器，
     * 之后 player 模块只保留本地宿主能力，不再自行决定跨模块的 buff 创建时机。
    * @param {any|null} controller
     */
    setBuffController(controller) {
        this._buffController = controller;
        for (const [, player] of this.players) {
            player.buffManager.bindController(controller);
        }
    }

    /**
     * 计算玩家对实体的最终伤害，提供给外部系统调用。
     * @param {number} playerSlot
     * @param {number} amount
     */
    modifyDamage(playerSlot, amount) {
        const player = this.players.get(playerSlot);
        if (!player) return amount;
        return player.getAttackDamage(amount);
    }

    /**
     * 由 main.js 统一调度的玩家 Buff 应用入口。
     * PlayerManager 不主动决定何时发 Buff；它只负责在 main 给出最终结论后，
     * 把请求路由到对应 Player，并补齐当前目标玩家上下文。
     * @param {number|null} playerSlot null = 全体玩家
     * @param {string} typeId Buff 类型 ID
     * @param {Record<string, any>} [params] Buff 参数
     * @param {Record<string, any>|null} [source] Buff 来源
     * @param {TP_playerBuffApplyContext|null} [context] Buff 上下文
     * @returns {any}
     */
    applyBuff(playerSlot, typeId, params, source, context = null) {
        if (!typeId) return null;

        /** @type {any} */
        let appliedBuff = null;
        this._forEachTargetPlayer(playerSlot, (player) => {
            const buff = player.addBuff(typeId, params, source ?? null, {
                player: context?.player ?? player,
                monster: context?.monster ?? null,
            });
            if (appliedBuff == null) {
                appliedBuff = buff;
            }
        });
        return appliedBuff;
    }

    /**
     * 统一奖励/效果分发入口
     * @param {number|null} playerSlot  null = 全体玩家
     * @param {TP_playerRewardPayload} payload
     */
    dispatchReward(playerSlot, payload) {
        const handler = this._rewardHandlers[payload.type];
        if (!handler) return;
        this._forEachTargetPlayer(playerSlot, (player) => {
            handler(player, payload);
        });
    }

    enterGameStart() {
        this.readyCount = 0;
        for (const [, player] of this.players) {
            if (!player.entityBridge.pawn) continue;
            player.enterAliveState();
        }
    }

    resetAllGameStatus() {
        this.readyCount = 0;
        for (const [, player] of this.players) {
            player.resetGameStatus();
        }
    }

    /**
     * 遍历奖励目标玩家。
     * @param {number|null} playerSlot
     * @param {(player: Player) => void} visitor
     */
    _forEachTargetPlayer(playerSlot, visitor) {
        const slots = playerSlot != null ? [playerSlot] : [...this.players.keys()];
        for (const slot of slots) {
            const player = this.players.get(slot);
            if (!player) continue;
            visitor(player);
        }
    }

    // ——— 查询 ———

    /**
     * 按槽位获取玩家实例。
     * @param {number} playerSlot 玩家槽位
     * @returns {Player|undefined}
     */
    getPlayer(playerSlot) {
        return this.players.get(playerSlot);
    }

    /**
     * 按 Controller 查找玩家实例。
     * @param {CSPlayerController} controller 玩家控制器
     * @returns {Player|null}
     */
    getPlayerByController(controller) {
        if (!controller) return null;
        return this.players.get(controller.GetPlayerSlot()) ?? null;
    }

    /**
     * 按 Pawn 遍历查找玩家实例。
     * @param {CSPlayerPawn} pawn 玩家 Pawn 实体
     * @returns {Player|null}
     */
    getPlayerByPawn(pawn) {
        if (!pawn) return null;
        for (const [, player] of this.players) {
            if (player.entityBridge.pawn === pawn) return player;
        }
        return null;
    }

    /**
     * 获取所有在线玩家列表。
     * @returns {Player[]}
     */
    getAllPlayers() {
        return Array.from(this.players.values());
    }

    /**
     * 获取所有在游戏中且存活的玩家。
     * @returns {Player[]}
     */
    getActivePlayers() {
        return Array.from(this.players.values()).filter(p => p.isInGame && p.isAlive);
    }

    /**
     * 获取所有已准备的玩家。
     * @returns {Player[]}
     */
    getReadyPlayers() {
        return Array.from(this.players.values()).filter(p => p.isReady);
    }

    /**
     * 获取所有存活玩家。
     * @returns {Player[]}
     */
    getAlivePlayers() {
        return Array.from(this.players.values()).filter(p => p.isAlive);
    }

    /**
     * 所有在线玩家是否全部准备就绪。
     * @returns {boolean}
     */
    areAllPlayersReady() {
        if (this.totalPlayers === 0) return false;
        return this.readyCount === this.totalPlayers;
    }

    /**
     * 是否有存活玩家。
     * @returns {boolean}
     */
    hasAlivePlayers() {
        return this.getAlivePlayers().length > 0;
    }

    /**
     * 获取玩家统计概览（总数 / 已准备 / 存活 / 活跃）。
     * @returns {{total: number, ready: number, alive: number, active: number}}
     */
    getPlayerStats() {
        return {
            total: this.totalPlayers,
            ready: this.readyCount,
            alive: this.getAlivePlayers().length,
            active: this.getActivePlayers().length
        };
    }

    // ——— 消息 ———

    /**
     * 向指定玩家发送其属性摘要信息。
     * @param {number} playerSlot 玩家槽位
     */
    sendPlayerStats(playerSlot) {
        const player = this.players.get(playerSlot);
        if (!player) return;
        const s = player.getSummary();
        const message =
            `ID: ${s.id} | 等级: ${s.level} | 金钱: $${s.money}\n` +
            `生命: ${s.health}/${s.maxHealth} | 护甲: ${s.armor} | 攻击: ${s.attack}\n` +
            `击杀: ${s.kills} | 分数: ${s.score}`;
        message.split('\n').forEach(line => this._adapter.sendMessage(playerSlot, line));
    }

    /**
     * 计算指定玩家对实体的最终伤害。
     *
     * 外部只需传入 slot，即可拿到当前玩家在基础攻击、等级倍率、暴击等结算后的伤害值。
     * 若玩家不存在或已不在可战斗状态，返回 0。
     *
     * @param {number} playerSlot 玩家 slot
     * @param {import("./player_const").PlayerDamageOptions} [options] 额外伤害修正参数
     * @returns {number}
     */
    calculatePlayerDamageToEntity(playerSlot, options) {
        const player = this.players.get(playerSlot);
        if (!player || !player.isAlive) return 0;
        return player.calculateDamageToEntity(options);
    }
    
    /**
     * 获取管理器当前状态快照。
     * @returns {{totalPlayers: number, readyCount: number, nextPlayerId: number}}
     */
    getStatus() {
        return {
            totalPlayers: this.totalPlayers,
            readyCount: this.readyCount,
            nextPlayerId: this.nextPlayerId
        };
    }

    /**
     * 每帧驱动所有在线玩家的持续逻辑。
     */
    tick() {
        const nowtime = this._adapter.getGameTime();
        for (const [slot, player] of this.players) {
            player.tick(nowtime);
        }
    }
}

/**
 * PlayerManager 级事件集合。
 */
class PlayerManagerEvents {
    constructor() {
        this.OnPlayerJoin = null;
        this.OnPlayerLeave = null;
        this.OnPlayerReady = null;
        this.OnPlayerDeath = null;
        this.OnPlayerRespawn = null;
        this.OnPlayerMoneyChange = null;
        this.OnPlayerLevelUp = null;
        this.OnPlayerBuffEvent = null;
        this.OnAllPlayersReady = null;
    }
    /** 设置玩家加入回调。 @param {(player: Player) => void} callback */
    setOnPlayerJoin(callback) { this.OnPlayerJoin = callback; }
    /** 设置玩家离开回调。 @param {(player: Player) => void} callback */
    setOnPlayerLeave(callback) { this.OnPlayerLeave = callback; }
    /** 设置玩家准备状态变化回调。 @param {(player: Player, isReady: boolean) => void} callback */
    setOnPlayerReady(callback) { this.OnPlayerReady = callback; }
    /** 设置玩家死亡回调。 @param {(playerPawn: CSPlayerPawn) => void} callback */
    setOnPlayerDeath(callback) { this.OnPlayerDeath = callback; }
    /** 设置玩家重生回调。 @param {(player: Player) => void} callback */
    setOnPlayerRespawn(callback) { this.OnPlayerRespawn = callback; }
    /** 设置玩家金钱变化回调。 @param {(player: Player, old: number, current: number) => void} callback */
    setOnPlayerMoneyChange(callback) { this.OnPlayerMoneyChange = callback; }
    /** 设置玩家升级回调。 @param {(player: Player, oldLevel: number, newLevel: number) => void} callback */
    setOnPlayerLevelUp(callback) { this.OnPlayerLevelUp = callback; }
    /** 设置玩家 Buff 相关事件回调。 @param {(player: Player, event: TP_playerBuffEvent) => void} callback */
    setOnPlayerBuffEvent(callback) { this.OnPlayerBuffEvent = callback; }
    /** 设置全员准备就绪回调。 @param {() => void} callback */
    setOnAllPlayersReady(callback) { this.OnAllPlayersReady = callback; }
}

/**
 * @module 输入系统/输入检测器
 */

/**
 * 当前输入模块要监听的全部键位。
 * 顺序同时决定多键同帧按下时的输出顺序。
 *
 * @type {{ key: string, binding: number }[]}
 */
const MONITORED_INPUTS = [
    { key: "W", binding: CSInputs.FORWARD },
    { key: "A", binding: CSInputs.LEFT },
    { key: "S", binding: CSInputs.BACK },
    { key: "D", binding: CSInputs.RIGHT },
    { key: "Walk", binding: CSInputs.WALK },
    { key: "Duck", binding: CSInputs.DUCK },
    { key: "Jump", binding: CSInputs.JUMP },
    { key: "Use", binding: CSInputs.USE },
    { key: "Attack", binding: CSInputs.ATTACK },
    { key: "Attack2", binding: CSInputs.ATTACK2 },
    { key: "Reload", binding: CSInputs.RELOAD },
    { key: "ShowScores", binding: CSInputs.SHOW_SCORES },
    { key: "InspectWeapon", binding: CSInputs.LOOK_AT_WEAPON },
];

/**
 * 按键边沿检测器。
 *
 * 消费外部传入的 pawn 引用，把"当前是否按下"转换成"本帧刚按下"的一次性事件。
 * 模块本身不持有 Player 或 PlayerManager 引用，只依赖引擎 CSInputs API。
 *
 * @navigationTitle 输入检测器
 */
class InputDetector {
    constructor() {
        /** @type {Record<string, boolean>} */
        this.pressedState = this._createInitialState();
    }

    /**
     * 返回当前支持监听的键位名称。
     * @returns {string[]}
     */
    getSupportedKeys() {
        return MONITORED_INPUTS.map((item) => item.key);
    }

    /**
     * 清空全部锁存状态。
     */
    reset() {
        this.pressedState = this._createInitialState();
    }

    /**
     * 轮询指定 pawn 的输入，返回本帧所有"新按下"的键位。
     *
     * @param {import("cs_script/point_script").CSPlayerPawn | null | undefined} pawn
     * @returns {string[]}
     */
    pollJustPressed(pawn) {
        if (!pawn || !pawn.IsValid() || !pawn.IsAlive()) {
            this.reset();
            return [];
        }

        /** @type {string[]} */
        const justPressed = [];
        for (const item of MONITORED_INPUTS) {
            const isPressed = pawn.IsInputPressed(item.binding);
            if (isPressed && !this.pressedState[item.key]) {
                justPressed.push(item.key);
            }
            this.pressedState[item.key] = isPressed;
        }
        return justPressed;
    }

    /**
     * 创建默认全 false 的按键状态表。
     * @returns {Record<string, boolean>}
     */
    _createInitialState() {
        /** @type {Record<string, boolean>} */
        const state = {};
        for (const item of MONITORED_INPUTS) {
            state[item.key] = false;
        }
        return state;
    }
}

/**
 * @module 输入系统/输入管理器
 */

/**
 * 输入管理器。
 *
 * @navigationTitle 输入管理器
 */
class InputManager {
    constructor() {
        /**
         * 输入源表。slot → 输入源
         * 输入源由 InputDetector + 绑定的 Pawn 组成，Pawn 用于查询当前按键状态（如是否被 UI 锁定）。
         * @type {Map<number, { detector: InputDetector, pawn: import("cs_script/point_script").CSPlayerPawn | null, use: boolean }>}
         */
        this._sources = new Map();

        /** 
         * 输入事件回调。参数为玩家槽位和原始键名，由外部决定如何映射成具体操作。
         * @type {((slot: number, key: string) => void) | null}
         */
        this._onInput = null;
    }
    /**
     * 启用输入检测
     * @param {number} slot - 玩家槽位
     * @param {import("cs_script/point_script").CSPlayerPawn} pawn
     */
    start(slot, pawn)
    {
        const source = this._getOrCreateSource(slot);
        source.pawn = pawn;
        source.use = true;
    }
    /**
     * 停止输入检测
     * @param {number} slot - 玩家槽位
     */
    stop(slot)
    {
        const source = this._getOrCreateSource(slot);
        source.use = false;
        source.pawn = null;
        source.detector.reset();
    }
    /**
     * 每 tick 轮询全部已注册输入源，逐个回调新按键。
     */
    tick() {
        for (const [slot, source] of this._sources) {
            if (!source.use) continue;
            const justPressed = source.detector.pollJustPressed(source.pawn);
            for (const key of justPressed) {
                this._onInput?.(slot, key);
            }
        }
    }

    /**
     * 设置输入事件回调。
     * @param {(slot: number, key: string) => void} callback
     */
    setOnInput(callback) {
        this._onInput = callback;
    }

    /**
     * 获取或创建指定玩家的输入源。
     * @param {number} slot
     * @returns {{ detector: InputDetector, pawn: import("cs_script/point_script").CSPlayerPawn | null, use: boolean }}
     */
    _getOrCreateSource(slot) {
        let source = this._sources.get(slot);
        if (!source) {
            source = {
                detector: new InputDetector(),
                pawn: null,
                use: false,
            };
            this._sources.set(slot, source);
        }
        return source;
    }
}

/**
 * @module 商店系统/商店常量
 */

const ShopAction = {
    UP: "up",
    DOWN: "down",
    PAGE_PREV: "page_prev",
    PAGE_NEXT: "page_next",
    CONFIRM: "confirm",
    BACK: "back",
};

const SHOP_ITEMS_PER_PAGE = 4;

const ShopState = {
    CLOSED: "closed",
    OPEN: "open",
};

const ShopResult = {
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

/**
 * @module 商店系统/商店会话
 */

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
class ShopSession {
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

/**
 * @module 商店系统/商店管理器
 */

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
class ShopManager {
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

        // ——— 外部回调 ———

        /**
         * 获取玩家信息回调。
         *
         * 由外部注入，返回指定 slot 的玩家摘要信息。
         * 返回 null 表示玩家不存在或不可读。
         *
         * @type {((slot: number) => import("./shop_const").ShopPlayerInfo | null) | null}
         */
        this._getPlayerInfo = null;

        /**
         * 发奖回调。
         *
         * 由外部注入，商店层购买校验通过后调用。
         * 外部负责扣钱、发 Buff/武器/治疗等，并返回结果。
         *
         * @type {((slot: number, item: import("./shop_const").ShopItemConfig, ctx: import("./shop_const").ShopPurchaseContext) => import("./shop_const").ShopGrantResult) | null}
         */
        this._grantReward = null;

        /**
         * 打开商店回调
         * @type {((slot: number, pawn: import("cs_script/point_script").CSPlayerPawn) => void) | null}
         */
        this._openshop = null;
        /**
         * 刷新文本回调
         * @type {((slot: number, pawn: import("cs_script/point_script").CSPlayerPawn, text: string) => void) | null}
         */
        this._refreshtext=null;
        /**
         * 关闭商店回调
         * @type {((slot: number) => void) | null}
         */
        this._closeshop = null;
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
        if (!this._getPlayerInfo || !this._grantReward || !this._openshop || !this._closeshop||!this._refreshtext) {
            Instance.Msg(`[ShopManager] 回调未就绪，无法打开商店 (slot=${playerSlot})`);
            return;
        }

        let session = this._sessions.get(playerSlot);
        if (!session) {
            session = new ShopSession(
                playerSlot,
                this._items,
                (slot) => this._getPlayerInfo?.(slot) ?? null,
                (slot, item, ctx) => this._grantReward?.(slot, item, ctx) ?? { success: false, message: "回调未注入" },
                (slot, currentPawn) => this._openshop?.(slot,currentPawn),
                (slot, currentPawn, text) => this._refreshtext?.(slot, currentPawn, text),
                (slot) => this._closeshop?.(slot),
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

    // ——— 回调设置 ———

    /**
     * 设置获取玩家信息回调。
     * @param {(slot: number) => import("./shop_const").ShopPlayerInfo | null} callback
     */
    setGetPlayerInfo(callback) {
        this._getPlayerInfo = callback;
    }

    /**
     * 设置发奖回调。
     * @param {(slot: number, item: import("./shop_const").ShopItemConfig, ctx: import("./shop_const").ShopPurchaseContext) => import("./shop_const").ShopGrantResult} callback
     */
    setGrantReward(callback) {
        this._grantReward = callback;
    }

    /**
     * 设置打开 HUD 回调。
     * @param {(slot: number, pawn: import("cs_script/point_script").CSPlayerPawn) => void} callback
     */
    setOpenShop(callback) {
        this._openshop = callback;
    }

    /**
     * 设置刷新 HUD 回调。
     * @param {(slot: number, pawn: import("cs_script/point_script").CSPlayerPawn, text: string) => void} callback
     */
    setRefreshText(callback) {
        this._refreshtext = callback;
    }
    /**
     * 设置隐藏 HUD 回调。
     * @param {(slot: number) => void} callback
     */
    setCloseShop(callback) {
        this._closeshop = callback;
    }
}

/**
 * @module HUD系统/HUD常量
 */

/**
 * 地图中已存在的 HUD point_template 名称。
 */
const HUD_TEMPLATE_NAME = "hud_template";

/**
 * 运行时生成的 HUD 实体名前缀。
 */
const HUD_ENTITY_PREFIX = "hud";

/**
 *  HUD 贴脸显示参数。
 */
const HUD_FACE_ATTACH = {
    radius: 7,
    // 正值向玩家左侧偏移，负值向右侧偏移。
    lateralOffset: 2,
};

/**
 * HUD 渠道定义。
 */
const CHANNAL = {
    NONE: -1,
    SHOP: 0,
    STATUS: 1,
};

/**
 * 渠道优先级（数值越大越优先）。
 * 同一玩家只显示优先级最高的活跃请求；高优先级释放后自动回退。
 */
const CHANNEL_PRIORITY = {
    [CHANNAL.NONE]: 0,
    [CHANNAL.STATUS]: 1,
    [CHANNAL.SHOP]: 2,
};

/**
 * @module HUD系统/HUD管理器
 */

/**
 * @typedef {object} HudRequest
 * @property {string} text - 待显示文本
 * @property {import("cs_script/point_script").CSPlayerPawn} pawn - 关联的玩家 Pawn
 */

/**
 * @typedef {object} HudSession
 * @property {number} slot - 玩家槽位
 * @property {string} entityName - HUD 实体名
 * @property {import("cs_script/point_script").Entity | undefined} entity - HUD 实体引用
 * @property {number} activeChannel - 当前生效的渠道
 * @property {import("cs_script/point_script").CSPlayerPawn | null} pawn - 当前跟随的 Pawn
 * @property {boolean} use - 实体是否处于 Enable 状态
 * @property {string} lastText - 上次渲染的文本（用于去重）
 * @property {Map<number, HudRequest>} requests - 各渠道的显示请求
 */

/**
 * HUD 管理器（单 HUD 仲裁模式）。
 *
 * 每个玩家槽位只维护一个 HUD 实体。多个 channel 可同时提交显示请求，
 * 但只有优先级最高的 channel 内容会被投影到唯一实体上。
 * 高优先级释放后自动回退到次高优先级。
 *
 * 优先级由 {@link CHANNEL_PRIORITY} 定义：SHOP > STATUS > NONE。
 *
 * 业务模块不直接 import 本模块，而是通过 main.js 注入回调使用。
 *
 * @navigationTitle HUD管理器
 */
class HudManager {
    constructor() {
        /**
         * 玩家槽位 → HUD 会话状态。
         * @type {Map<number, HudSession>}
         */
        this._sessions = new Map();
    }

    /**
     * 提交指定 channel 的显示请求，并重新仲裁当前应显示的内容。
     *
     * @param {number} slot - 玩家槽位
     * @param {import("cs_script/point_script").CSPlayerPawn} pawn - 玩家 Pawn
     * @param {string} text - HUD 文本
     * @param {number} channel - HUD 渠道
     */
    showHud(slot, pawn, text, channel) {
        const session = this._getOrCreateSession(slot);
        session.requests.set(channel, { text, pawn });
        this._arbitrate(session);
    }

    /**
     * 撤销指定 channel 的显示请求（或全部请求），并重新仲裁。
     *
     * @param {number} slot - 玩家槽位
     * @param {number} [channel] - HUD 渠道；不传时撤销该玩家全部渠道请求
     */
    hideHud(slot, channel) {
        const session = this._sessions.get(slot);
        if (!session) return;

        if (channel === undefined) {
            session.requests.clear();
        } else {
            session.requests.delete(channel);
        }

        this._arbitrate(session);
    }

    /**
     * 获取指定玩家当前生效的 channel。
     * @param {number} slot
     * @returns {number}
     */
    getActiveChannel(slot) {
        const session = this._sessions.get(slot);
        return session ? session.activeChannel : CHANNAL.NONE;
    }

    /**
     * 每 tick 刷新全部可见 HUD 的贴脸位置。
     * @param {{ id: number; name: string; slot: number; level: number; money: number; health: number; maxHealth: number; armor: number; attack: number; critChance: number; critMultiplier: number; kills: number; score: number; exp: number; expNeeded: number; pawn: import("cs_script/point_script").CSPlayerPawn | null; }[]} [allAlivePlayersSummary=[]]
     */
    tick(allAlivePlayersSummary=[]) {
        for (const s of allAlivePlayersSummary) {
            if(!s.pawn)continue;
            const text = `Lv.${s.level} HP:${s.health}/${s.maxHealth} 护甲:${s.armor}\n$${s.money} 升级还需:${s.expNeeded - s.exp}EXP`;
            this.showHud(s.slot, s.pawn, text, CHANNAL.STATUS);
        }
        for (const [, session] of this._sessions) {
            if (!session.use) continue;
            const s=this._refreshHudPosition(session);
            if(!s)session.use=false;
        }
    }

    // ——— 内部方法 ———

    /**
     * 获取或创建指定玩家的 HUD 会话。
     * @param {number} slot
     * @returns {HudSession}
     */
    _getOrCreateSession(slot) {
        let session = this._sessions.get(slot);
        if (!session) {
            session = {
                slot,
                entityName: `${HUD_ENTITY_PREFIX}_${slot}`,
                entity: undefined,
                activeChannel: CHANNAL.NONE,
                pawn: null,
                use: false,
                lastText: "",
                requests: new Map(),
            };
            this._sessions.set(slot, session);
        }
        return session;
    }

    /**
     * 根据优先级重新决定当前应显示的 channel 内容。
     * @param {HudSession} session
     */
    _arbitrate(session) {
        // 找出最高优先级的活跃请求
        let winnerChannel = CHANNAL.NONE;
        for (const ch of session.requests.keys()) {
            if ((CHANNEL_PRIORITY[ch] ?? 0) > (CHANNEL_PRIORITY[winnerChannel] ?? 0)) {
                winnerChannel = ch;
            }
        }

        // 无活跃请求 → 隐藏 HUD
        if (winnerChannel === CHANNAL.NONE) {
            if (session.use) this._hideEntity(session);
            session.activeChannel = CHANNAL.NONE;
            return;
        }

        const request = session.requests.get(winnerChannel);
        if(!request)return;
        const channelChanged = session.activeChannel !== winnerChannel;
        const textChanged = session.lastText !== request.text;
        const pawnChanged = session.pawn !== request.pawn;

        // 无变化且已显示 → 跳过
        if (!channelChanged && !textChanged && !pawnChanged && session.use) return;

        session.activeChannel = winnerChannel;
        session.pawn = request.pawn;

        this._ensureEntity(session);
        if (!session.entity) return;

        // 文本更新
        if (textChanged || channelChanged) {
            session.lastText = request.text;
            Instance.EntFireAtTarget({
                target: session.entity,
                input: "SetMessage",
                value: request.text,
            });
        }

        // 首次启用或 Pawn 变更 → 重新绑定
        if (!session.use) {
            Instance.EntFireAtTarget({ target: session.entity, input: "Enable" });
            Instance.EntFireAtTarget({
                target: session.entity,
                input: "Followentity",
                value: "!activator",
                activator: request.pawn,
            });
            session.use = true;
        } else if (pawnChanged) {
            Instance.EntFireAtTarget({
                target: session.entity,
                input: "Followentity",
                value: "!activator",
                activator: request.pawn,
            });
        }

        this._refreshHudPosition(session);
    }

    /**
     * 确保 HUD 实体已创建。
     * @param {HudSession} session
     */
    _ensureEntity(session) {
        if (session.entity?.IsValid()) return;

        session.entity = Instance.FindEntityByName(session.entityName);
        if (session.entity?.IsValid()) return;

        const template = Instance.FindEntityByName(HUD_TEMPLATE_NAME);
        if (template && template instanceof PointTemplate) {
            const spawned = template.ForceSpawn();
            if (spawned && spawned.length > 0) {
                spawned[0].SetEntityName(session.entityName);
                session.entity = spawned[0];
            }
        }

        if (session.entity?.IsValid()) {
            Instance.EntFireAtTarget({target: session.entity,input: session.use?"Enable":"Disable",});
        }
    }

    /**
     * 禁用 HUD 实体。
     * @param {HudSession} session
     */
    _hideEntity(session) {
        if (!session.entity || !session.use) return;

        Instance.EntFireAtTarget({
            target: session.entity,
            input: "Disable",
        });

        session.use = false;
        session.lastText = "";
    }

    /**
     * 刷新 HUD 贴脸位置（基于当前生效 channel 的偏移配置）。
     * @param {HudSession} session
     * @returns {boolean}
     */
    _refreshHudPosition(session) {
        if (!session.entity?.IsValid() || !session.pawn) return false;

        const ps = session.pawn.GetEyePosition();
        const ag = session.pawn.GetEyeAngles();
        if (!ps || !ag) return false;

        const radius = HUD_FACE_ATTACH.radius;
        const lateralOffset = HUD_FACE_ATTACH.lateralOffset;

        const pitchRad = ag.pitch * Math.PI / 180;
        const yawRad = ag.yaw * Math.PI / 180;
        const x = ps.x + radius * Math.cos(pitchRad) * Math.cos(yawRad);
        const y = ps.y + radius * Math.cos(pitchRad) * Math.sin(yawRad);
        const ox = ps.x + radius * Math.cos(0) * Math.cos(yawRad);
        const oy = ps.y + radius * Math.cos(0) * Math.sin(yawRad);

        session.entity.Teleport({
            position: {
                x: x - lateralOffset * (oy - ps.y) / radius,
                y: y + lateralOffset * (ox - ps.x) / radius,
                z: ps.z - radius * Math.sin(pitchRad),
            },
            angles: {
                pitch: 0,
                yaw: 270 + ag.yaw,
                roll: 90 - ag.pitch,
            },
        });

        return true;
    }
}

/**
 * 已知漏洞
 * 怪物正常死亡后引擎实体从不移除 — 实体泄漏
 * fireuser1相关
 */
/**
 * release 版正式入口。
 *
 * 职责：
 * 1. 设置服务器 cvar。
 * 2. 分别实例化 GameManager、WaveManager、PlayerManager、InputManager、
 *    ShopManager、HudManager 与 BuffManager。
 * 3. 在此文件中完成所有跨模块回调绑定——这里是唯一允许出现跨模块业务回调的地方。
 * 4. 注册统一 think 主循环，按固定顺序推进各模块 tick。
 * 5. 怪物系统已独立拆出，本文件不再直接 import 或调度 monster 相关模块。
 *
 * 设计原则：
 * - game、wave、player、input、shop、hud、buff 各模块彼此独立，不互相 import。
 * - 模块之间的数据流动全部通过本文件的回调绑定完成。
 * @module 主入口
 */


// ═══════════════════════════════════════════════
// 1. 服务器初始化
// ═══════════════════════════════════════════════

Instance.ServerCommand("mp_warmup_offline_enabled 1");
Instance.ServerCommand("mp_warmup_pausetimer 1");
Instance.ServerCommand("mp_roundtime 60");
Instance.ServerCommand("mp_freezetime 1");
Instance.ServerCommand("mp_ignore_round_win_conditions 1");
Instance.ServerCommand("weapon_accuracy_nospread 1");

// ═══════════════════════════════════════════════
// 2. 实例化各模块（平级，互不持有）
// ═══════════════════════════════════════════════

/** @type {import("./util/definition").Adapter} */
const adapter = {
    log: (/** @type {string} */ msg) => Instance.Msg(msg),
    broadcast: (/** @type {string} */ msg) => Instance.Msg(`${msg}`),
    sendMessage: (/** @type {number} */ playerSlot, /** @type {string} */ msg) => Instance.Msg(`${playerSlot} "${msg}"`),//////????
    getGameTime: () => Instance.GetGameTime()
};

const gameManager = new GameManager(adapter);
const waveManager = new WaveManager(adapter);
const playerManager = new PlayerManager(adapter);
const inputManager = new InputManager();
const shopManager = new ShopManager();
const hudManager = new HudManager();
const buffManager = new BuffManager();

// ═══════════════════════════════════════════════
// 3. 跨模块回调绑定（全部集中在此）
// ═══════════════════════════════════════════════

// ——— 3.1 波次结算 → 玩家 / 游戏 ———

waveManager.setOnWaveComplete((waveNumber) => {
    const waveConfig = waveManager.getWaveConfig(waveNumber);

    // 给予玩家波次奖励
    playerManager.dispatchReward(null, {
        type: "money",
        amount: waveConfig?.reward ?? 0,
        reason: `第${waveNumber}波通关奖励`
    });

    // 推进下一波或胜利
    if (waveManager.hasNextWave()) {
        waveManager.nextWave();
    } else {
        gameManager.gameWon();
    }
});

/**
 * 玩家 Buff 的最终创建统一留在 main。
 * player 模块只负责抛出请求与运行时事件，真正的创建时机由 main 统一决定。
 * @param {number} playerSlot
 * @param {string} buffTypeId
 * @param {Record<string, any>} [params]
 * @param {Record<string, any>|null} [source]
 */
function grantPlayerBuff(playerSlot, buffTypeId, params, source) {
    if (!buffTypeId) return null;

    return playerManager.applyBuff(playerSlot, buffTypeId, params, source ?? null, null);
}

// ——— 3.2 玩家 → 游戏 / Buff ———

playerManager.events.setOnPlayerBuffEvent((player, event) => {
    switch (event.type) {
        case "request":
            grantPlayerBuff(
                player.slot,
                event.buffTypeId ?? "",
                event.params,
                event.source
            );
            return;
        case "added":
        case "removed":
        case "refreshed":
        case "damageTaken":
        case "heal":
        default:
            // Buff 运行时事件已经统一回到 main，后续若要接 HUD、日志或统计，
            // 直接在这里扩展即可，不再反向修改 player 模块内部流程。
            return;
    }
});

playerManager.events.setOnPlayerJoin((player) => {
    gameManager.onPlayerJoin();
});
playerManager.events.setOnPlayerLeave((player) => {
    shopManager.closeShop(player.slot);
    inputManager.stop(player.slot);
    hudManager.hideHud(player.slot);

    const wasPlaying = gameManager.onPlayerLeave(player.slot);
    if (wasPlaying && !playerManager.hasAlivePlayers()) {
        gameManager.gameLost();
    }
});

playerManager.events.setOnPlayerDeath((playerPawn) => {
    const controller = playerPawn.GetPlayerController();
    if (controller) {
        const slot = controller.GetPlayerSlot();
        shopManager.closeShop(slot);
        inputManager.stop(slot);
        hudManager.hideHud(slot);

        const wasPlaying = gameManager.onPlayerDeath();
        if (wasPlaying && !playerManager.hasAlivePlayers()) {
            gameManager.gameLost();
        }
    }
});

playerManager.events.setOnPlayerRespawn((player) => {
    gameManager.onPlayerRespawn();
});

// ——— 3.3 全员准备 → 开始游戏 → 开始波次 ———

playerManager.events.setOnAllPlayersReady(() => {
    gameManager.startGame();
});

gameManager.setOnGamePrepare(() => {
    playerManager.dispatchReward(null, {
        type: "ready",
        isReady: false
    });
});

gameManager.setOnGameStart(() => {
    playerManager.enterGameStart();
    waveManager.startWave(1);
});

gameManager.setOnGameLost(() => {
    shopManager.closeAll();
});
//游戏胜利
gameManager.setOnGameWin(() => {
    shopManager.closeAll();
});
// ——— 3.4 游戏重置 → 联动各模块 ———

gameManager.setOnResetGame(() => {
    shopManager.closeAll();
    waveManager.resetGame();
    playerManager.resetAllGameStatus();
    Instance.ServerCommand("mp_restartgame 5");
});

// ——— 3.5 输入 → 商店 ———

inputManager.setOnInput((slot, key) => {
    shopManager.handleRawKey(slot, key);
});

// ——— 3.6 商店 ← 玩家 ———

shopManager.setOpenShop((slot, pawn) => {
    hudManager.showHud(slot, pawn, "", CHANNAL.SHOP);
    inputManager.start(slot,pawn);
});
shopManager.setRefreshText((slot, pawn, text) => {
    hudManager.showHud(slot, pawn, text, CHANNAL.SHOP);
});
shopManager.setCloseShop((slot) => {
    hudManager.hideHud(slot, CHANNAL.SHOP);
    inputManager.stop(slot);
});

shopManager.setGetPlayerInfo((slot) => {
    const player = playerManager.getPlayer(slot);
    if (!player) return null;
    const s = player.getSummary();
    return {
        money: s.money,
        level: s.level,
        health: s.health,
        armor: s.armor,
        weapons: [],
    };
});

shopManager.setGrantReward((slot, item, ctx) => {
    const player = playerManager.getPlayer(slot);
    if (!player) return { success: false, message: "玩家不存在" };

    const payload = item.payload;
    
    if (!payload) return { success: false, message: "商品无效果定义" };

    player.addMoney(-ctx.price, `购买 ${item.displayName}`);

    switch (payload.type) {
        case "heal":
            player.heal(payload.amount ?? 0);
            break;
        case "armor":
            player.giveArmor(payload.amount ?? 0);
            break;
        case "buff":
            playerManager.dispatchReward(slot, {
                type: "buff",
                buffTypeId: payload.buffTypeId,
                params: payload.params,
                source: {
                    sourceType: "shop",
                    sourceId: item.id,
                    itemId: item.id,
                },
            });
            break;
        case "weapon":
            // 暂无武器系统集成，待添加
            break;
        case "money":
            player.addMoney(payload.amount ?? 0, "商店奖励");
            break;
        default:
            return { success: false, message: `未知效果类型: ${payload.type}` };
    }

    return { success: true, message: `购买成功: ${item.displayName}` };
});

// ═══════════════════════════════════════════════
// 4. 引擎事件注册
// ═══════════════════════════════════════════════
Instance.OnPlayerConnect((event) => {
    playerManager.handlePlayerConnect(event.player);
});

Instance.OnPlayerActivate((event) => {
    playerManager.handlePlayerActivate(event.player);
});

Instance.OnPlayerDisconnect((event) => {
    playerManager.handlePlayerDisconnect(event.playerSlot);
});

Instance.OnPlayerReset((event) => {
    playerManager.handlePlayerReset(event.player);
});

Instance.OnPlayerKill((event) => {
    playerManager.handlePlayerDeath(event.player);
});

Instance.OnModifyPlayerDamage((event) => {
    return playerManager.handleBeforePlayerDamage(event);
});

Instance.OnPlayerDamage((event) => {
    playerManager.handlePlayerDamage(event);
});

Instance.OnPlayerChat((event) => {
    playerManager.handlePlayerChat(event);
    const controller = event.player;
    const text = event.text;
    if (!controller) return;

    const parts = text.trim().toLowerCase().split(/\s+/);
    const command = parts[0];
    Number(parts[1]);

    if (command === "shop" || command === "!shop") {
        const pawn = controller.GetPlayerPawn();
        if (pawn) {
             shopManager.openShop(controller.GetPlayerSlot(), pawn);
        }
    }
});

// ═══════════════════════════════════════════════
// 5. 主循环（统一 think）
// ═══════════════════════════════════════════════

/** 上一帧时间戳，用于计算 dt */
Instance.GetGameTime();

Instance.SetThink(() => {
    const now = Instance.GetGameTime();

    // ── 5.1 输入 / 玩家 / 波次 / Buff ──
    inputManager.tick();
    playerManager.tick();
    waveManager.tick();
    buffManager.tick();

    // ── 5.2 其他模块 tick ──
    shopManager.tick();
    hudManager.tick(playerManager.getActivePlayers().map(p => p.getSummary()));

    // ── 5.3 玩家状态 HUD 同步 ──
    Instance.SetNextThink(now + 1 / 64);
});
Instance.SetNextThink(Instance.GetGameTime() + 1 / 64);

Instance.Msg("=== PvE Release 已启动 ===");

playerManager.refresh();
