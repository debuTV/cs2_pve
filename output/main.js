import { Instance, PointTemplate, CSPlayerPawn, BaseModelEntity, CSInputs } from 'cs_script/point_script';

/**
 * @module EventBus/EventBus
 */

/**
 * @typedef {(...args: any[]) => void} EventListener
 */

/**
 * 断言事件名称是否合法。
 * 如果 eventName 不是字符串或为空字符串，则抛出 TypeError。
 * @param {string} eventName
 */
function assertEventName(eventName) {
    if (typeof eventName !== "string" || eventName.length === 0) {
        throw new TypeError("Event name must be a non-empty string.");
    }
}

/**
 * 断言监听器是否合法。
 * 如果 listener 不是函数类型，则抛出 TypeError。
 * @param {EventListener} listener
 */
function assertListener(listener) {
    if (typeof listener !== "function") {
        throw new TypeError("Listener must be a function.");
    }
}

/**
 * 同步事件总线类。
 * 使用 Set 进行监听器管理，遍历时采用实时迭代语义
 * （即在 emit 过程中对监听器的增删会影响当前遍历周期）。
 *
 * @navigationTitle EventBus
 */
class EventBus {
    /** 构造函数，初始化内部的监听器映射表。 */
    constructor() {
        /** @type {Map<string, Set<EventListener>>} */
        this._listeners = new Map();
    }

    /**
     * 注册事件监听器。
     * 为指定事件名称添加一个监听回调，如果该事件尚无监听器集合则自动创建。
     * @param {string} eventName
     * @param {EventListener} listener
     * @returns {() => boolean} 返回一个取消订阅的函数，调用后可移除该监听器。
     */
    on(eventName, listener) {
        assertEventName(eventName);
        assertListener(listener);

        let listeners = this._listeners.get(eventName);
        if (!listeners) {
            listeners = new Set();
            this._listeners.set(eventName, listeners);
        }

        listeners.add(listener);
        return () => this.off(eventName, listener);
    }

    /**
     * 注册一次性事件监听器。
     * 该监听器最多只会被触发一次，触发后自动移除。
     * 如果需要在首次触发前取消，可保留并调用返回的取消订阅函数。
     * @param {string} eventName
     * @param {EventListener} listener
     * @returns {() => boolean} 返回一个取消订阅的函数。
     */
    once(eventName, listener) {
        assertEventName(eventName);
        assertListener(listener);

        const wrappedListener = (/** @type {any[]} */ ...args) => {
            this.off(eventName, wrappedListener);
            listener(...args);
        };

        return this.on(eventName, wrappedListener);
    }

    /**
     * 移除事件监听器。
     * 从指定事件中移除一个监听回调，仅支持精确的函数引用匹配。
     * 当某事件的监听器集合清空时，会自动清理该事件的条目。
     * @param {string} eventName
     * @param {EventListener} listener
     * @returns {boolean} 如果监听器存在并被成功移除则返回 true，否则返回 false。
     */
    off(eventName, listener) {
        assertEventName(eventName);
        assertListener(listener);

        const listeners = this._listeners.get(eventName);
        if (!listeners) {
            return false;
        }

        const removed = listeners.delete(listener);

        if (listeners.size === 0) {
            this._listeners.delete(eventName);
        }

        return removed;
    }

    /**
     * 同步触发（发射）事件。
     * 依次调用该事件下所有已注册的监听器，并传入参数。
     * 遍历是实时的，因此在触发过程中对监听器的增删会影响当前遍历周期。
     * @param {string} eventName
     * @param {...any} args
     * @returns {boolean} 如果至少有一个监听器被调用则返回 true，否则返回 false。
     */
    emit(eventName, ...args) {
        assertEventName(eventName);

        const listeners = this._listeners.get(eventName);
        if (!listeners || listeners.size === 0) {
            return false;
        }

        for (const listener of listeners) {
            listener(...args);
        }

        return true;
    }

    /**
     * 清除监听器。
     * 如果传入事件名称，则清除该事件下的所有监听器；
     * 如果不传参数，则清除所有事件的全部监听器。
     * @param {string} [eventName]
     * @returns {number} 返回被移除的监听器数量。
     */
    clear(eventName) {
        if (typeof eventName === "undefined") {
            const total = this.listenerCount();
            this._listeners.clear();
            return total;
        }

        assertEventName(eventName);

        const listeners = this._listeners.get(eventName);
        if (!listeners) {
            return 0;
        }

        const count = listeners.size;
        this._listeners.delete(eventName);
        return count;
    }

    /**
     * 检查指定事件当前是否存在监听器。
     * @param {string} eventName
     * @returns {boolean} 如果存在至少一个监听器则返回 true，否则返回 false。
     */
    hasListeners(eventName) {
        assertEventName(eventName);
        return (this._listeners.get(eventName)?.size ?? 0) > 0;
    }

    /**
     * 统计监听器数量。
     * 如果传入事件名称，返回该事件的监听器数量；
     * 如果不传参数，返回所有事件的监听器总数。
     * @param {string} [eventName]
     * @returns {number} 监听器数量。
     */
    listenerCount(eventName) {
        if (typeof eventName === "undefined") {
            let total = 0;
            for (const listeners of this._listeners.values()) {
                total += listeners.size;
            }
            return total;
        }

        assertEventName(eventName);
        return this._listeners.get(eventName)?.size ?? 0;
    }
}
const eventBus=new EventBus();

/**
 * @module 工具/定义
 */
/**
 * @typedef {Object} broadcastMessage - 广播消息对象
 * @property {string} message - 发送的信息
 * @property {number} delay - 距波次开始的延迟时间（秒）
 */
/**
 * @typedef {object} skill_pool - 技能池配置对象。同类型技能可重复出现多次。所有技能均支持：params.events（触发事件数组，可选）, params.cooldown（可选，默认-1一次性）, params.animation（可选）。
 * @property {string} id - 技能类型名称，必须在 SkillFactory 中注册（同类型可重复出现多次）
 * @property {number} chance - 技能获得概率（0~1）
 * @property {object} params - 技能参数（各技能自定义，详见 skill_factory.js 注释）
 */
/**
 * 通用动画集合类型：任意键对应动画名数组。
 * 例如 `{ idle: string[], walk: string[] }`。"idle"、"walk"、"attack"、"skill"、"dead" 在对应状态切换时播放。
 * @typedef {{ [key: string]: string[] }} animations
 */
/**
 * @typedef {object} monsterTypes - 怪物类型配置对象。每个怪物实例对应一个 monsterTypes 配置项，包含其属性、技能池和动画列表。
 * @property {string} template_name - 怪物模板名称，对应地图中 PointTemplate 的实体名称
 * @property {string} model_name - 模型名称，对应游戏内模型资源路径（不含前缀 "models/" 和后缀 ".mdl"）
 * @property {string} name - 怪物名称（仅作记录/展示）
 * @property {number} baseHealth - 基础生命值
 * @property {number} baseDamage - 基础伤害
 * @property {number} speed - 移动速度
 * @property {number} reward - 击杀奖励
 * @property {number} attackdist - 攻击距离
 * @property {number} attackCooldown - 攻击冷却时间（秒）
 * @property {string} movementmode - 移动模式（例如 "walk"、"fly" 等，具体逻辑由怪物系统实现）
 * @property {skill_pool[]} skill_pool - 技能池配置数组
 * @property {animations} animations - 动画配置对象，键为状态名（如 "idle"、"walk"、"attack"、"skill"、"dead" 等），值为对应动画名数组
 */
/**
 * @typedef {object} waveConfig - 波次配置对象。每波包含一个或多个 monsterTypes 配置项，定义该波次的怪物类型和属性。
 * @property {string} name - 波次名称
 * @property {number} totalMonsters - 怪物总数（仅作记录/展示）
 * @property {number} reward - 波次奖励（仅作记录/展示）
 * @property {number} spawnInterval - 怪物生成间隔（秒）
 * @property {number} preparationTime - 波次准备时间（秒）
 * @property {number} aliveMonster - 同时存在的怪物数量（仅作记录/展示）
 * @property {string[]} monster_spawn_points_name - 怪物生成点名称数组，对应地图中 PointTemplate 的实体名称
 * @property {{x: number, y: number, z: number}} monster_breakablemins - 怪物破坏物最小边界坐标（相对于生成点位置的偏移）
 * @property {{x: number, y: number, z: number}} monster_breakablemaxs - 怪物破坏物最大边界坐标（相对于生成点位置的偏移）
 * @property {broadcastMessage[]} broadcastmessage - 准备阶段广播消息
 * @property {monsterTypes[]} monsterTypes - 怪物类型配置数组，定义该波次的怪物类型和属性
 */
/**
 * @typedef {object} particleConfig - 粒子配置项。每个粒子对应一个地图中的 PointTemplate，ForceSpawn 后生成 info_particle_system。
 * @property {string} id - 业务粒子 id（代码中引用的 key）
 * @property {string} spawnTemplateName - 地图中 PointTemplate 的实体名称
 * @property {string} middleEntityName - PointTemplate 内目标 info_particle_system 的实体名称，如果是范围特效，选择范围中心点的实体，用于精确匹配
 */
/**
 * @typedef {object} Adapter - 外部适配器接口
 * @property {(msg: string) => void} log - 输出日志
 * @property {(msg: string) => void} broadcast - 广播消息给玩家
 * @property {(playerSlot: number, msg: string) => void} sendMessage - 发送消息给指定玩家
 * @property {() => number} getGameTime - 获取当前游戏时间（秒）
 */
/**
 * 移动请求类型常量。
 *
 * 统一移动请求模型：Monster 侧只提交 MoveRequest / StopRequest / RemoveMovement，
 * main 侧按 priority 合并后统一消费。
 */
const MovementRequestType$1 = {
    /** 移动请求：追击实体或移动到坐标 */
    Move:   "Move",
    /** 停止请求 */
    Stop:   "Stop",
    /** 注销 Movement 实例 */
    Remove: "Remove",
};
/**@typedef {import("cs_script/point_script").Entity} Entity */
/**@typedef {import("cs_script/point_script").Vector} Vector */
/**
 * @typedef {object} MovementRequest
 * @property {string}  type - MovementRequestType 值
 * @property {Entity}  entity - 移动实体，也是请求合并与定位 Movement 的主键
 * @property {number}  priority - MovementPriority 值
 * @property {Entity}  [targetEntity] - 追击目标实体（与 targetPosition 互斥）
 * @property {Vector}  [targetPosition] - 目标坐标（与 targetEntity 互斥）
 * @property {boolean} [usePathRefresh] - 是否允许刷新路径（默认 true）
 * @property {boolean} [useNPCSeparation] - 是否启用NPC分离速度；false 时每 tick 传空分离上下文
 * @property {string}  [Mode] - 切换移动模式（walk / air / fly 等）
 * @property {Vector}  [Velocity] - 设置速度向量（技能位移用,例如飞扑就需要）
 * @property {number}  [maxSpeed] - 速度上限
 * @property {boolean} [clearPath] - 是否清空现有路径
 */

/**
 * 移动请求优先级。数值越小优先级越高。
 * main 每帧按 priority 合并同一 entity 的请求，保留最高优先级。
 */
const MovementPriority$1 = {
    StateChange: 1,
    Chase:       2,
};

const event={
    AreaEffects:{
        In:{
            CreateRequest:"AreaEffects_OnCreateRequest",    //请求创建区域效果，payload 包含 {effectType: string, position: Vector, radius: number, duration: number, applyInterval: number, buffTypeId: string, buffParams: any, source: {monsterId: number, monsterType: string, skillId: string}, targetTypes: areaEffectTargetType[]}
            StopRequest:"AreaEffects_OnStopRequest",        //请求停止区域效果，payload 包含 {areaEffectId: number}
        },
        Out:{
            OnCreated:"AreaEffects_OnCreated",                    //区域效果创建后
            OnHitPlayer:"AreaEffects_OnHitPlayer",                //玩家被范围伤害击中
            OnHitMonster:"AreaEffects_OnHitMonster",              //怪物被范围伤害击中
            OnStopped:"AreaEffects_OnStopped",                    //区域效果停止后
        }
    },
    Buff:{
        In:{
            BuffAddRequest:"Buff_OnBuffAddRequest",                //请求Buff 添加
            BuffRefreshRequest:"Buff_OnBuffRefreshRequest",        //请求Buff 刷新
            BuffRemoveRequest:"Buff_OnBuffRemoveRequest",          //请求Buff 移除
            BuffEmitRequest:"Buff_OnBuffEmitRequest",              //其他模块发生事件告诉buff
        },
        Out:{
            OnBuffAdded:"Buff_OnBuffAdded",                //Buff 添加后
            OnBuffRefreshed:"Buff_OnBuffRefreshed",        //Buff 刷新后
            OnBuffRemoved:"Buff_OnBuffRemoved",            //Buff 移除后
        }
    },
    Game:{
        In:{
            StartGameRequest:"Game_OnStartGameRequest",    //请求开始游戏
            EnterPreparePhaseRequest:"Game_OnEnterPreparePhaseRequest",    //请求进入准备阶段
            ResetGameRequest:"Game_OnResetGameRequest",    //请求重置游戏
            GameWinRequest:"Game_OnGameWinRequest",    //请求游戏胜利
            GameLoseRequest:"Game_OnGameLoseRequest",    //请求游戏失败
        },
        Out:{
            OnStartGame:"Game_OnStartGame",    //开始游戏后
            OnEnterPreparePhase:"Game_OnEnterPreparePhase",    //进入准备阶段后
            OnResetGame:"Game_OnResetGame",    //重置游戏后
            OnGameWin:"Game_OnGameWin",    //游戏胜利后
            OnGameLost:"Game_OnGameLost",    //游戏失败后
        }
    },
    Hud:{
        In:{
            ShowHudRequest:"Hud_OnShowHudRequest",    //显示 Hud 请求，payload 包含 {slot: number, pawn: CSPlayerPawn, text: string, channel: number}
            HideHudRequest:"Hud_OnHideHudRequest",    //隐藏 Hud 请求，payload 包含 {slot: number, channel?: number}
        },
        Out:{
            OnHudShown:"Hud_OnHudShown",    //Hud 显示后，payload 包含 {slot: number, channel: number, text: string}
            OnHudUpdated:"Hud_OnHudUpdated",    //Hud 文本或渠道更新后，payload 包含 {slot: number, channel: number, text: string, previousChannel?: number}
            OnHudHidden:"Hud_OnHudHidden",    //Hud 隐藏后，payload 包含 {slot: number, channel: number}
        }
    },
    Input:{
        In:{
            StartRequest:"Input_OnStartRequest",    //请求开始输入检测，payload 包含 {slot: number, pawn: CSPlayerPawn}
            StopRequest:"Input_OnStopRequest",    //请求停止输入检测，payload 包含 {slot: number}
        },
        Out:{
            OnInput:"Input_OnInput",    //输入事件，payload 包含 {slot: number, key: string}
        }
    },
    Monster:{
        In:{
            SpawnRequest:"Monster_OnSpawnRequest",    //请求由怪物施法者触发产卵，payload 使用 MonsterSpawnRequest
            BeforeTakeDamageRequest:"Monster_OnBeforeTakeDamageRequest",    //请求怪物受伤前修正伤害，payload 使用 MonsterBeforeTakeDamageRequest
        },
        Out:{
            OnMonsterSpawn:"Monster_OnMonsterSpawn",    //怪物创建并注册后，payload 使用 OnMonsterSpawn
            OnMonsterDeath:"Monster_OnMonsterDeath",    //怪物死亡后，payload 使用 OnMonsterDeath
            OnAllMonstersDead:"Monster_OnAllMonstersDead",    //当前波次全部怪物死亡后
            OnAttack:"Monster_OnAttack",    //怪物普攻命中后，payload 使用 OnMonsterAttack
        }
    },
    Movement:{
        In:{
            MoveRequest:"Movement_OnMoveRequest",    //请求移动，payload 使用 MovementRequest
            StopRequest:"Movement_OnStopRequest",    //请求停止移动，payload 使用 MovementRequest
            RemoveRequest:"Movement_OnRemoveRequest",    //请求移除 Movement 实例，payload 使用 MovementRequest
        },
        Out:{
            OnRegistered:"Movement_OnRegistered",    //Movement 实例注册后
            OnStopped:"Movement_OnStopped",          //Movement 停止后
            OnRemoved:"Movement_OnRemoved",          //Movement 实例移除后
        }
    },
    Particle:{
        In:{
            CreateRequest:"Particle_OnCreateRequest",    //粒子特效创建请求
            StopRequest:"Particle_OnStopRequest",        //粒子特效停止请求
        },
        Out:{
            OnCreated:"Particle_OnCreated",    //粒子特效创建成功后
            OnStopped:"Particle_OnStopped",    //粒子特效停止后
        }
    },
    Player:{
        In:{
            GetPlayerSummaryRequest:"Player_OnGetPlayerSummaryRequest",    //请求玩家信息摘要，payload 包含 {slot: number, result?: any}
            DispatchRewardRequest:"Player_OnDispatchRewardRequest",    //请求分发玩家奖励，payload 包含 {slot: number|null, reward?: any, rewards?: any[], result?: boolean}
        },
        Out:{
            OnPlayerJoin:"Player_OnPlayerJoin",    //玩家加入后，payload 包含 {player: Player, slot: number}
            OnPlayerLeave:"Player_OnPlayerLeave",  //玩家离开后，payload 包含 {player: Player, slot: number}
            OnPlayerReadyChanged:"Player_OnPlayerReadyChanged",    //玩家准备状态变化后
            OnAllPlayersReady:"Player_OnAllPlayersReady",    //全员准备后
            OnPlayerDeath:"Player_OnPlayerDeath",  //玩家死亡后
            OnPlayerRespawn:"Player_OnPlayerRespawn",    //玩家重生后
        }
    },
    Shop:{
        In:{
            ShopOpenRequest:"Shop_OnShopOpenRequest",    //请求打开商店，payload 包含 {slot: number, pawn?: CSPlayerPawn, result?: boolean}
            ShopCloseRequest:"Shop_OnShopCloseRequest",  //请求关闭商店，payload 包含 {slot: number, result?: boolean}
        },
        Out:{
            OnShopOpen:"Shop_OnShopOpen",    //商店打开后，payload 包含 {slot: number}
            OnShopClose:"Shop_OnShopClose",  //商店关闭后，payload 包含 {slot: number}
            OnBought:"Shop_OnBought",    //购买商品后，payload 包含 {slot: number, itemId: string, price: number}
        }
    },
    Skill:{
        In:{
            SkillAddRequest:"Skill_OnSkillAddRequest",    //请求为目标添加技能，payload 使用 SkillAddRequest
            SkillRemoveRequest:"Skill_OnSkillRemoveRequest",    //请求移除技能，payload 使用 SkillRemoveRequest
            SkillUseRequest:"Skill_OnSkillUseRequest",    //请求直接触发技能，payload 使用 SkillUseRequest
            SkillEmitRequest:"Skill_OnSkillEmitRequest",    //请求向技能转发运行时事件，payload 使用 SkillEmitRequest
        }},
    Wave:{
        In:{
            WaveStartRequest:"Wave_OnWaveStartRequest",    //请求开始波次，payload 包含 {waveIndex: number}
            WaveEndRequest:"Wave_OnWaveEndRequest",        //请求结束波次，payload 包含 {waveIndex: number, survived: boolean}
        },
        Out:{
            OnWaveStart:"Wave_OnWaveStart",    //波次开始后，payload 包含 {waveIndex: number}
            OnWaveEnd:"Wave_OnWaveEnd",        //波次结束后，payload 包含 {waveIndex: number, survived: boolean}
        }
    }
};

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
        this._adapter.broadcast("=== 准备阶段开始 ===");
        eventBus.emit(event.Game.Out.OnEnterPreparePhase);
    }

    /**
     * 启动游戏。仅在 PREPARE 状态下生效，切换到 PLAYING 并触发 onGameStart 回调。
     */
    startGame() {
        if (this.gameState !== GameState.PREPARE) return;
        this.gameState = GameState.PLAYING;
        this._adapter.broadcast("=== 游戏开始 ===");
        eventBus.emit(event.Game.Out.OnStartGame);
    }

    /**
     * 触发游戏失败。将状态切换为 LOST 并广播失败消息。
     */
    gameLost() {
        if (this.gameState === GameState.LOST || this.gameState === GameState.WON) return false;
        this.gameState = GameState.LOST;
        this._adapter.broadcast("=== 游戏失败 ===");
        eventBus.emit(event.Game.Out.OnGameLost);
        return true;
    }

    /**
     * 触发游戏胜利。将状态切换为 WON 并广播胜利消息。
     */
    gameWon() {
        if (this.gameState === GameState.LOST || this.gameState === GameState.WON) return false;
        this.gameState = GameState.WON;
        this._adapter.broadcast("=== 游戏胜利 ===");
        eventBus.emit(event.Game.Out.OnGameWin);
        return true;
    }

    /**
     * 重置游戏状态，触发 onResetGame 回调通知其他模块。
     */
    resetGame() {
        this.gameState = GameState.WAITING;
        this._adapter.broadcast("重置游戏...");
        eventBus.emit(event.Game.Out.OnResetGame);
    }
    /**
     * 检查游戏状态。是否正在游戏
     */
    checkGameState() {
        return this.gameState === GameState.PLAYING;
    }
}

/**
 * @module 怪物系统/脚本全局配置
 */

/** 观赏模式下，玩家是否受到怪物基础伤害（直接造成原始伤害，不进行修改）。 */
//export const playerDamage=true;
/** 是否在新回合开始或结束时重置脚本。观赏模式（ZE 模式）推荐开启。 */
//export const clearbyRound=true;
/** 怪物生成点到最近玩家的距离阈值，大于此值则关闭该生成点。`-1` 表示不检测。 */
const spawnPointsDistance=-1;
/**
 * 怪物死亡后，是否在死亡动画播放完成时删除模型。
 * - `true`：动画结束后删除模型。
 * - `false`：动画结束后保留模型，不删除。
 */
const removeModelAfterDeathAnimation=false;
/** 地面摩擦力系数，影响怪物减速效果。 */
//export const friction=6;
/** 怪物可攀爬的最大台阶高度（单位），建议与 NavMesh 设置保持一致。 */
//export const stepHeight=13;
/** 路径节点切换距离——怪物距下一个导航点小于此值时切换到再下一个点。 */
//export const goalTolerance=8;
/** 到达最后一个导航点后的停止距离——距目标小于此值后怪物不再前进。 */
//export const arriveDistance=1;
/** 移动判定阈值——单帧位移小于此值时视为怪物未移动。 */
//export const moveEpsilon=0.5;
/** 卡死判定时间（秒）——连续无移动超过此时长视为怪物卡死。 */
//export const timeThreshold=2;

/** 怪物移动碰撞盒最小角（负半尺寸）。盒子过大容易过不去门，过小则怪物看起来会穿墙。 */
//export const Tracemins={x:-4,y:-4,z:1};
/** 怪物移动碰撞盒最大角（正半尺寸）。 */
//export const Tracemaxs={x:4,y:4,z:4};
/** 地面检测射线向下延伸的距离（单位）。 */
//export const groundCheckDist=8;
/** 每次移动后与碰撞面保持的安全距离（单位）。 */
//export const surfaceEpsilon=4;

/**
 * 怪物状态枚举。
 *
 * 定义了怪物在战斗循环中可能处于的所有状态。
 * Monster 的 `brainState` 组件和 `tickDispatcher` 会根据这些值
 * 决定每帧应该执行的行为（移动、攻击、施法或待机）。
 *
 * 状态流转典型路径：
 * `IDLE → CHASE → ATTACK → CHASE` 或 `IDLE → CHASE → SKILL → CHASE`，
 * 死亡后进入 `DEAD` 终态。
 *
 * - `IDLE` (0)：空闲状态，刚生成或无目标时的默认状态。
 * - `CHASE` (1)：追击状态，正在寻路并移动向目标玩家。
 * - `ATTACK` (2)：攻击状态，到达攻击距离后执行普通攻击动作。
 * - `SKILL` (3)：技能状态，正在施放主动技能，此时移动和普攻被暂停。
 * - `DEAD` (4)：死亡终态，怪物已被击杀，等待清理。
 */
const MonsterState = {
    IDLE: 0,//空闲
    CHASE: 1,//追人
    ATTACK: 2,//攻击
    SKILL:  3,//技能
    DEAD: 4//死亡
};
/**
 * 怪物事件类型常量。
 *
 * 收录怪物技能内部事件名称字符串。
 * 使用统一常量替代散落的字符串，防止拼写错误导致事件丢失。
 *
 * 事件按职责分为四组：
 * - **生命周期**：生成（Spawn）、死亡（Die）、模型移除（ModelRemove）。
 * - **战斗**：受伤（TakeDamage）、攻击命中（AttackTrue）、攻击未命中（AttackFalse）。
 * - **AI**：每帧心跳（Tick）、目标更新（TargetUpdate）。
 * - **技能**：技能施放（SkillCast）。
 *
 */
const MonsterBuffEvents = {
    // 生命周期
    Spawn:        "OnSpawn",
    Die:          "OnDie",
    ModelRemove:  "OnModelRemove",
    // 战斗
    BeforeTakeDamage: "BeforeTakeDamage", // 受伤前事件，允许修改伤害
    TakeDamage:   "OnTakeDamage",        // 受伤后事件，提供最终伤害值
    AttackTrue:   "OnAttackTrue",
    AttackFalse:  "OnAttackFalse",
    // AI
    Tick:         "OnTick",
    TargetUpdate: "OnupdateTarget"};

/**
 * @typedef {object} OnMonsterSpawn
 * @property {import("./monster/monster").Monster} monster
 */
/**
 * @typedef {object} OnMonsterDeath
 * @property {import("./monster/monster").Monster} monster
 * @property {import("cs_script/point_script").Entity|null|undefined} killer
 * @property {number} reward
 */
/**
 * @typedef {object} OnMonsterAttack
 * @property {import("./monster/monster").Monster} monster
 * @property {number} damage
 * @property {import("cs_script/point_script").CSPlayerPawn} target
 */
/**
 * @typedef {object} MonsterBeforeTakeDamageRequest
 * @property {import("./monster/monster").Monster} monster
 * @property {number} amount
 * @property {import("cs_script/point_script").CSPlayerPawn|null} attacker
 * @property {number|void} result
 */
/**
 * @typedef {object} MonsterSpawnRequest
 * @property {import("./monster/monster").Monster} monster
 * @property {{typeName?: string, radiusMin?: number, radiusMax?: number, tries?: number}} options
 * @property {boolean} result
 */
/**
 * @typedef {object} MonsterSkillAddRequest
 * @property {import("./monster/monster").Monster} monster
 * @property {string} typeId
 * @property {Record<string, any>} params
 * @property {number|null} result
 */
/**
 * @typedef {object} MonsterSkillUseRequest
 * @property {import("./monster/monster").Monster} monster
 * @property {number} skillId
 * @property {Record<string, any>} params
 * @property {boolean} result
 */
/**
 * @typedef {object} MonsterSkillEmitRequest
 * @property {import("./monster/monster").Monster} monster
 * @property {number} skillId
 * @property {string} eventName
 * @property {Record<string, any>} params
 * @property {boolean} result
 */

/**
 * 怪物配置
 * @type {{ [key: string]: import("../util/definition").monsterTypes }} 
 */
const MonsterType={
    "Zombie":{            
            template_name:"headcrab_classic_template",
            model_name:"headcrab_classic_model",//模型本体，animations播放的是这个模型的动画
            name: "Zombie",
            baseHealth: 100,
            baseDamage: 10,
            speed: 150,
            reward: 100,
            attackdist:80,
            attackCooldown:0.1,
            movementmode:"walk",
            skill_pool:[
                //// 示例：同类型技能重复（分别叠加不同属性）
                //{
                //    id:"corestats",
                //    chance: 1,
                //    params:{ health_value:200 }          // 实例 id=0
                //},
                //{
                //    id:"corestats",
                //    chance: 1,
                //    params:{ speed_mult:1.5 }            // 实例 id=1，两个 corestats 独立生效
                //},
                //// 示例：单个技能绑定多个触发事件
                //{
                //    id:"spawn",
                //    chance: 1,
                //    params:{ events:["OnSpawn","OnTakeDamage"], count:1, typeName:"Zombie", maxSummons:3 }
                //},
                //// 示例：有动画的 pounce
                //{
                //    id:"pounce",
                //    chance: 1,
                //    params:{ cooldown:5, distance:250, animation:"pounce" }
                //},
                //// 示例：无动画的 pounce（在 canTrigger 内直接执行）
                //{
                //    id:"pounce",
                //    chance: 1,
                //    params:{ cooldown:10, distance:400 }  // 无 animation → 无动画直触发
                //},
                //// 示例：护盾
                //{
                //    id: "shield",
                //    chance: 1,
                //    params: { cooldown:15, runtime:-1, value:50 }
                //},
                //// 示例：急速（5秒内速度×1.8，冷却10秒，可选发光）
                //{
                //    id: "speedboost",
                //    chance: 1,
                //    params: { cooldown:10, runtime:5, speed_mult:1.8, glow:{r:255,g:128,b:0} }
                //},
                //// 示例：投掷石头（trigger 待实现）
                //{
                //    id: "throwstone",
                //    chance: 1,
                //    params: { cooldown:6, distanceMin:100, distanceMax:500, damage:15, projectileSpeed:600 }
                //},
                //// 示例：持续激光（trigger 待实现，2秒持续，每0.25秒结算一次）
                //{
                //    id: "laserbeam",
                //    chance: 1,
                //    params: { cooldown:8, distance:400, duration:2, damagePerSecond:30, tickInterval:0.25 }
                //},
                //// 示例：死亡时产卵
                //{
                //    id: "spawn",
                //    chance: 1,
                //    params: { count:1, typeName:"Zombie", maxSummons:3, radiusMin:24, radiusMax:96, tries:6 }
                //}
            ],
            animations:{
                "idle":[
                    "headcrab_classic_idle",
                    "headcrab_classic_idle_b",
                    "headcrab_classic_idle_c"
                ],
                "walk":[
                    "headcrab_classic_walk",
                    "headcrab_classic_run"
                ],
                "attack":[
                    "headcrab_classic_attack_antic_02",
                    "headcrab_classic_attack_antic_03",
                    "headcrab_classic_attack_antic_04"
                ],
                "skill":[
                    "headcrab_classic_attack_antic_02",
                    "headcrab_classic_attack_antic_03",
                    "headcrab_classic_attack_antic_04"
                ],
                "pounce":[
                    "headcrab_classic_jumpattack"
                ]
            }
        }
};

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
 * @typedef {object} WaveStartRequest - 请求开始波次的消息载荷
 * @property {number} waveIndex - 要开始的波次索引
 * @property {boolean} result - 结果回填字段
 */
/**
 * @typedef {object} WaveEndRequest - 请求结束波次的消息载荷
 * @property {boolean} result - 结果回填字段
 */
/**
 * @typedef {object} OnWaveStart
 * @property {number} waveIndex - 已开始的波次索引
 * @property {import("../util/definition").waveConfig} waveConfig - 当前波次配置
 */
/**
 * @typedef {object} OnWaveEnd
 * @property {number} waveIndex - 已结束的波次索引
 */
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
            monsterTypes:[MonsterType.Zombie]
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
            monsterTypes:[MonsterType.Zombie]
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
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Wave.In.WaveStartRequest, (/**@type {import("./wave_const").WaveStartRequest}*/ payload) => {
                payload.result = this.startWave(payload);
            }),
            eventBus.on(event.Wave.In.WaveEndRequest, (/**@type {import("./wave_const").WaveEndRequest}*/ payload) => {
                payload.result = this.completeWave();
            })
        ];
        // ——— 预热阶段内部状态 ———
        /**
         * 预热阶段上下文。
         * @type {{ startTime: number, duration: number, broadcastIndex: number, messages: { message: string, delay: number }[] }}
         */
        this._prepareContext = this._createPrepareContext();
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
        /** @type {import("./wave_const").OnWaveStart} */
        const payload = {
            waveIndex: this.currentWave,
            waveConfig: wave,
        };
        eventBus.emit(event.Wave.Out.OnWaveStart, payload);
    }

    // ═══════════════════════════════════════════════
    // 波次操作
    // ═══════════════════════════════════════════════

    /**
     * 开始指定波次。
     * - 若当前波次正在进行中（ACTIVE 或 PREPARING），则拒绝开始新波次。
     * - 参数 waveNumber 从 1 开始计数，必须在配置范围内。
     * @param {import("./wave_const").WaveStartRequest} waveStartRequest 
     * @returns {boolean}
     */
    startWave(waveStartRequest) {
        if (this.waveState === WaveState.ACTIVE || this.waveState === WaveState.PREPARING) {
            this._adapter.log(`无法开始波次 ${waveStartRequest.waveIndex}，当前波次进行中 (state=${this.waveState})`);
            return false;
        }

        if (waveStartRequest.waveIndex < 1 || waveStartRequest.waveIndex > this.waves.length) {
            this._adapter.log(`波次 ${waveStartRequest.waveIndex} 超出范围 (1-${this.waves.length})`);
            return false;
        }

        const wave = this.getWaveConfig(waveStartRequest.waveIndex);

        // 广播波次信息
        const message =
            `=== 第 ${waveStartRequest.waveIndex} 波: ${wave.name} ===\n` +
            `怪物总数: ${wave.totalMonsters}\n` +
            `奖励: $${wave.reward}\n` +
            `准备时间: ${wave.preparationTime} 秒`;
        this._adapter.broadcast(message);

        // 进入预热阶段
        this._enterPreparingState(waveStartRequest.waveIndex, wave);

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
            `奖励: $${wave.reward}`;
        if (!this.hasNextWave()) {
            message += "\n=== 所有波次完成 ===";
        }
        this._adapter.broadcast(message);

        /** @type {import("./wave_const").OnWaveEnd} */
        const payload = { waveIndex: this.currentWave};
        eventBus.emit(event.Wave.Out.OnWaveEnd, payload);
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
        return this.startWave({ waveIndex: this.currentWave + 1 ,result: false});
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
}

/**
 * @module 怪物系统/怪物组件/实体桥接
 */

const BREAKABLE_HEALTH_SCALE = 10000;

/**
 * 怪物实体桥接组件。
 *
 * 负责生成 model / breakable，并把 breakable 受到的引擎伤害
 * 单向折算到脚本侧生命，不再把脚本生命反向同步给 breakable。
 * 
 * @navigationTitle 怪物实体桥接
 */
class MonsterEntityBridge {
    /**
     * 创建怪物实体桥接组件。
     * @param {import("../monster").Monster} monster 所属怪物实例
     */
    constructor(monster) {
        /** 所属怪物实例。 */
        this.monster = monster;
    }
    /**
     * 根据怪物配置生成引擎实体（breakable + model）。
     *
     * 通过 `PointTemplate.ForceSpawn` 在指定位置创建模板实体，
     * 并监听 breakable 的 `OnHealthChanged` 将引擎伤害转发给 `healthCombat`。
     *
     * @param {import("cs_script/point_script").Vector} position 出生世界坐标
     * @param {import("../../../util/definition").monsterTypes} typeConfig 怪物类型配置
     */
    init(position, typeConfig) {
        const template = Instance.FindEntityByName(typeConfig.template_name);
        if (template && template instanceof PointTemplate) {
            const spawned = template.ForceSpawn(position);
            if (spawned && spawned.length > 0) {
                spawned.forEach((element) => {
                    if (element.GetClassName() == "func_breakable") {
                        this.monster.breakable = element;
                    }
                    if (element.GetClassName() == "prop_dynamic" && element.GetEntityName() == typeConfig.model_name) {
                        this.monster.model = element;
                    }
                });
            }
        }

        if (this.monster.breakable) {
            this.monster.preBreakableHealth = BREAKABLE_HEALTH_SCALE;
            Instance.ConnectOutput(this.monster.breakable, "OnHealthChanged", (e) => {
                if (typeof e.value !== "number") return;

                const currentBreakableHealth = Math.max(
                    0,
                    Math.min(BREAKABLE_HEALTH_SCALE, BREAKABLE_HEALTH_SCALE * e.value)
                );
                const damage = this.monster.preBreakableHealth - currentBreakableHealth;
                this.monster.preBreakableHealth = currentBreakableHealth;

                if (damage <= 1) return;

                const attacker = e.activator instanceof CSPlayerPawn ? e.activator : null;
                this.monster.takeDamage(damage, attacker);
            });
        }

        if (this.monster.model) {
            this.monster.model.Teleport({ position: { x: position.x, y: position.y, z: position.z + 50 } });
        }
    }

    /**
     * 死亡后移除引擎实体。breakable 始终移除，model 是否删除由参数控制。
     * @param {boolean} [removeModelAfterDeathAnimation=true] 是否删除怪物模型
     */
    removeAfterDeath(removeModelAfterDeathAnimation = true) {
        if (this.monster.breakable?.IsValid()) {
            this.monster.breakable.Remove();
        }
        if (removeModelAfterDeathAnimation && this.monster.model?.IsValid()) {
            this.monster.model.Remove();
        }
    }
}

/**
 * @module 怪物系统/怪物组件/生命与战斗
 */

class MonsterHealthCombat {
    /**
     * @param {import("../monster").Monster} monster
     */
    constructor(monster) {
        this.monster = monster;
        /** @type {((amount: number) => number)[]} */
        this._damageModifiers = [];
    }

    /**
     * @param {(amount: number) => number} modifier
     */
    addDamageModifier(modifier) {
        this._damageModifiers.push(modifier);
    }

    /**
     * @param {(amount: number) => number} modifier
     */
    removeDamageModifier(modifier) {
        const idx = this._damageModifiers.indexOf(modifier);
        if (idx !== -1) this._damageModifiers.splice(idx, 1);
    }

    /**
     * @param {number} amount
     * @param {import("cs_script/point_script").CSPlayerPawn | null} attacker
     * @param {{ source?: import("cs_script/point_script").Entity | null, reason?: string } | null} [meta]
     * @returns {boolean}
     */
    takeDamage(amount, attacker, meta = null) {
        if (this.monster.state === MonsterState.DEAD) return true;

        const modifiedAmount = this.monster.requestBeforeTakeDamage(amount, attacker);
        if (typeof modifiedAmount === "number") {
            amount = modifiedAmount;
        }

        const ctx = {
            damage: amount,
            attacker,
            source: meta?.source ?? null,
            reason: meta?.reason,
        };
        this.monster.emitBuffEvent(MonsterBuffEvents.BeforeTakeDamage, ctx);
        amount = ctx.damage;

        if (amount <= 0) {
            this.monster.emitBuffEvent(MonsterBuffEvents.TakeDamage, { ...ctx, damage: 0 });
            this.monster.emitEvent({ type: MonsterBuffEvents.TakeDamage, value: 0, health: this.monster.health });
            return false;
        }

        let finalAmount = amount;
        for (const mod of this._damageModifiers) {
            finalAmount = mod(finalAmount);
            if (finalAmount <= 0) {
                this.monster.emitBuffEvent(MonsterBuffEvents.TakeDamage, { ...ctx, damage: 0 });
                this.monster.emitEvent({ type: MonsterBuffEvents.TakeDamage, value: 0, health: this.monster.health });
                return false;
            }
        }

        const previousHealth = this.monster.health;
        this.monster.health = Math.max(0, Math.min(this.monster.health - finalAmount, this.monster.maxhealth));
        this.monster.emitBuffEvent(MonsterBuffEvents.TakeDamage, { ...ctx, damage: finalAmount });
        this.monster.emitEvent({ type: MonsterBuffEvents.TakeDamage, value: finalAmount, health: this.monster.health });
        Instance.Msg(`鎬墿 #${this.monster.id} 鍙楀埌 ${finalAmount} 鐐逛激瀹?(鍘熷:${amount}) (${previousHealth} -> ${this.monster.health})`);

        if (this.monster.health <= 0) {
            this.die(attacker);
            return true;
        }
        return false;
    }

    /**
     * @param {import("cs_script/point_script").Entity | null | undefined} killer
     */
    die(killer) {
        if (this.monster.state === MonsterState.DEAD) return;

        const breakable = this.monster.breakable;
        if (breakable?.IsValid()) {
            Instance.EntFireAtTarget({
                target: breakable,
                input: "fireuser1",
                activator: killer ?? this.monster.target ?? undefined,
            });
        }

        const prevState = this.monster.state;
        this.monster.state = MonsterState.DEAD;
        this.monster.emitBuffEvent("OnStateChange", { oldState: prevState, nextState: MonsterState.DEAD });
        this.monster.clearBuffs();
        if (this.monster.model instanceof BaseModelEntity) {
            this.monster.model.Unglow();
        }
        this.monster.emitEvent({ type: MonsterBuffEvents.Die });
        this.monster.killer = killer instanceof CSPlayerPawn ? killer : null;
        this.monster.emitDeathEvent(killer);
        this.monster.animation.enter(MonsterState.DEAD);
        Instance.Msg(`鎬墿 #${this.monster.id} 姝讳骸`);
    }

    enterAttack() {
        const model = this.monster.model;
        const target = this.monster.target;
        if (!model?.IsValid() || !target) return;

        this.monster.animation.setOccupation("attack");
        this.monster.movementPath.onOccupationChanged();
        this.monster.attackCooldown = this.monster.atc;

        const origin = model.GetAbsOrigin();
        const targetPos = target.GetAbsOrigin();
        const distsq = this.monster.distanceTosq(target);
        if (distsq > this.monster.attackdist * this.monster.attackdist) {
            this.monster.emitEvent({ type: MonsterBuffEvents.AttackFalse });
            return;
        }

        this.monster.emitEvent({ type: MonsterBuffEvents.AttackTrue });
        this.monster.emitAttackEvent(this.monster.damage, target);

        300 / Math.hypot(targetPos.x - origin.x, targetPos.y - origin.y);
    }
}

/**
 * @module 怪物系统/怪物组件/AI状态机
 */


/**
 * 怪物 AI 决策组件。
 *
 * 每帧评估当前意图并解析为 MonsterState 转换：
 * 1. `updateTarget` — 选择最近玩家作为目标。
 * 2. `evaluateIntent` — 根据距离和冷却判断意图（Idle/Chase/Attack/Skill）。
 * 3. `resolveState` — 将意图转化为实际状态，考虑占用锁和当前待执行技能。
 *
 * @navigationTitle 怪物 AI 决策
 */
class MonsterBrainState {
    /**
     * 创建怪物 AI 决策组件。
     * @param {import("../monster").Monster} monster 所属怪物实例
     */
    constructor(monster) {
        /** 所属怪物实例。 */
        this.monster = monster;
    }

    /**
     * 更新追击目标：选择最近的存活玩家。同时发布 `TargetUpdate` 事件。
     * @param {import("cs_script/point_script").CSPlayerPawn[]} allppos 所有存活玩家
     */
    updateTarget(allppos) {
        let best = null;
        let bestDistsq = Infinity;
        for (const player of allppos) {
            const dist = this.monster.distanceTosq(player);
            if (dist < bestDistsq) {
                best = player;
                bestDistsq = dist;
            }
        }
        this.monster.target = best;
        this.monster.emitEvent({ type: MonsterBuffEvents.TargetUpdate });
    }

    /**
     * 评估当前意图。只判断“想做什么”，不修改 `monster.state`。
     *
     * 优先级：被锁定→CHASE，有技能请求→SKILL，攻击距离内且无冷却→ATTACK，否则→CHASE。
     * @returns {number} MonsterState 枚举值
     */
    evaluateIntent() {
        if (!this.monster.target) return MonsterState.IDLE;
        const distsq = this.monster.distanceTosq(this.monster.target);
        if (this.monster.movementStateSnapshot.mode === "ladder") return MonsterState.CHASE;
        if (this.monster.skillsManager.hasRequestedSkill()) return MonsterState.SKILL;
        if (distsq <= this.monster.attackdist*this.monster.attackdist && this.monster.attackCooldown <= 0) return MonsterState.ATTACK;
        return MonsterState.CHASE;
    }

    /**
     * 根据意图评估结果执行状态切换。ATTACK/SKILL 切换成功后会调用对应入口方法。
     * @param {number} intent 目标状态（MonsterState 枚举值）
     */
    resolveIntent(intent) {
        switch (intent) {
            case MonsterState.IDLE:
                this.trySwitchState(MonsterState.IDLE);
                break;
            case MonsterState.CHASE:
                this.trySwitchState(MonsterState.CHASE);
                break;
            case MonsterState.ATTACK:
                if (this.trySwitchState(MonsterState.ATTACK)) {
                    this.monster.enterAttack();
                }
                break;
            case MonsterState.SKILL:
                if (this.trySwitchState(MonsterState.SKILL)) {
                    this.monster.enterSkill();
                }
                break;
        }
    }

    /**
     * 尝试状态迁移。委托 `monster.applyStateTransition`。
     * @param {number} nextState 目标 MonsterState
     * @returns {boolean} 是否切换成功
     */
    trySwitchState(nextState) {
        return this.monster.applyStateTransition(nextState);
    }
}

/**
 * @module 技能系统/共享常量
 */

/**
 * 技能统一事件键。
 *
 * 约定：monster、player 与输入系统都向 skill 层发送这些字符串值，
 * 这样 skill 模块不必再直接依赖具体宿主模块的事件常量文件。
 */
const SkillEvents = {
    Spawn: "OnSpawn",
    Die: "OnDie",
    AttackTrue: "OnAttackTrue",
    Tick: "OnTick",
    Input: "OnInput",
};

/** 与技能位移交互兼容的移动请求类型。 */
const MovementRequestType = {
    Move: "Move"};

/** 与技能位移交互兼容的移动请求优先级。 */
const MovementPriority = {
    Skill: 0};

/** 默认世界重力加速度。 */
const DEFAULT_WORLD_GRAVITY = 800;

/**
 * 技能 运行时事件负载。
 * 当前仅作为 JSDoc 类型占位，供 skill_manager / skill_template 引用。
 * @typedef {Record<string, any>} EmitEventPayload
 */

/**
 * @typedef {Object} SkillAddRequest
 * @property {import("../player/player/player").Player|import("../monster/monster/monster").Monster} target
 * @property {string} typeId
 * @property {Record<string, any>} params
 * @property {number|null} result
 */

/**
 * @typedef {Object} SkillRemoveRequest
 * @property {number} skillId
 * @property {import("../player/player/player").Player|import("../monster/monster/monster").Monster|null} [target]
 * @property {boolean} result
 */

/**
 * @typedef {Object} SkillUseRequest
 * @property {number} skillId
 * @property {import("../player/player/player").Player|import("../monster/monster/monster").Monster} target
 * @property {boolean} result
 */

/**
 * @typedef {Object} SkillEmitRequest
 * @property {number} skillId
 * @property {string} eventName
 * @property {EmitEventPayload} params
 * @property {import("../player/player/player").Player|import("../monster/monster/monster").Monster|null} [target]
 * @property {boolean} result
 */

/**
 * @module 怪物系统/技能基类
 */
/*
技能分类规则（唯一权威）：
  有 animation 字段（非 null/undefined）= 主动技能：canTrigger 通过后占用当前待执行槽，
    Monster 进入 SKILL 状态，skills_manager 先播放 animation 动作，再调用 trigger()。
  无 animation 字段（null）           = 被动技能：在 canTrigger 内直接执行业务并返回 false，
    不占用待执行槽，不触发状态切换。

冷却语义：
  cooldown > 0  → 间隔触发（秒）
  cooldown = 0  → 无限制
  cooldown = -1 → 一次性：仅首次触发一次，之后永久失效
  默认值为 -1（一次性），可在子类构造函数或 params.cooldown 中覆盖。

实例 id 语义：
  skill.id  = 运行时实例 id，由 MonsterSkillsManager.addSkill 按添加顺序分配（0,1,2,...）。
             同一怪物上 id 越小，优先级越高；同一轮事件结算时，先遇到可触发的技能会直接截断后续主动技能。
  skill.typeId = 技能类型标识，对应 SkillFactory 注册键（如 "corestats"），子类在构造函数里设置。
             同一怪物可同时拥有多个相同 typeId 的技能实例，各实例独立运行互不干扰。

多事件触发：
  子类构造函数中设置 this.events 数组，列出该技能响应的事件类型。
  可在配置 params.events 中直接指定（如 ["OnSpawn","OnDie"]），未提供则使用技能类的默认值。
  对 spawn 等技能：旧的单值 params.event 仍向后兼容（会被包装为单元素数组）。

原 onAdd() 生命周期已移除；需要在生成时执行的初始化逻辑，
请在 canTrigger 中响应 MonsterEvents.Spawn 并 return false。

新增技能时不要手写 this.id（实例 id 由 addSkill 自动分配）；
在子类构造函数里设置 this.typeId（技能类型标识）；
isActive() 由基类根据 this.animation 自动判断。

事件大全（统一使用 MonsterEvents 常量，见 monster_events.js）
//怪物生成完后
MonsterEvents.Spawn        → "OnSpawn"

//当受到伤害后(伤害值，最后血量)
MonsterEvents.TakeDamage   → "OnTakeDamage"   { value, health }

//怪物死亡前，这时候实体还未销毁
MonsterEvents.Die          → "OnDie"

//当前TICK(tick间隔，所有怪物breakable实体)
MonsterEvents.Tick         → "OnTick"          { dt, allmpos }

//目标更新后
MonsterEvents.TargetUpdate → "OnupdateTarget"

//没有攻击到目标
MonsterEvents.AttackFalse  → "OnAttackFalse"

//对目标造成伤害后
MonsterEvents.AttackTrue   → "OnAttackTrue"

//模型移除后（动画结束）
MonsterEvents.ModelRemove  → "OnModelRemove"
 */
/**
 * 技能基类。所有具体技能继承此类，并在子类中按宿主类型重写专用入口。
 *
 * 技能分为两大类：
 * - **主动技能**（`animation` 非 null）— `canTrigger` 返回 true 后占用当前待执行槽，
 *   Monster 进入 SKILL 状态，播放动作后调用 `trigger()`。
 * - **被动技能**（`animation` 为 null）— 在 `canTrigger` 内直接执行并返回 false。
 *
 * 冷却语义：
 * - `-1` = 一次性（默认），触发过一次后永久失效。
 * - `0` = 无限制。
 * - `> 0` = 按秒间隔触发。
 *
 * 子类在构造函数中设置 `this.typeId`，运行时实例 id `this.id` 由
 * MonsterSkillsManager.addSkill 自动分配，id 越小优先级越高。
 *
 * @navigationTitle 技能基类
 */
class SkillTemplate
{
    /**
     * 创建技能基类实例，绑定所属施法者。
     * @param {Player|null} player
     * @param {Monster|null} monster
     * @param {string} typeid 
     * @param {number} id
     * @param {any} params
     */
    constructor(player = null, monster = null,typeid,id,params={}) {
        /** 玩家施法者；只有玩家技能实例会设置。 */
        this.player = player;
        /** 怪物施法者；只有怪物技能实例会设置。 */
        this.monster = monster;
        /** 技能类型标识，对应 SkillFactory 注册键（如 "corestats"）。子类在构造函数里设置。 */
        this.typeId = typeid;
        /** 运行时实例 id，由 addSkill 按添加顺序分配（0,1,2,...）。id 越小优先级越高。 */
        this.id = id;
        /** 冷却（秒）。-1=一次性，0=无限制，>0=按秒冷却。默认 -1。 */
        this.cooldown = params.cooldown ?? -1;
        /** 上次触发的游戏时间。初始值 -999。由 `_markTriggered` 更新，供 `_cooldownReady` 判断冷却。 */
        this.lastTriggerTime = -999;
        /** 技能是否正在后台运行中（限时技能的执行期间为 true）。由子类 `tick` 逻辑控制。 */
        this.running=false;
    }
    onSkillAdd(){}
    onSkillDelete(){}
    /**
     * @param {string} eventType
     * @param {import("./skill_const").EmitEventPayload} payload
     */
    _emitEvent(eventType, payload = {}) {
        if(this.canTrigger({ type: eventType, ...payload })) {
            this._request();
        }
    }
    /**
     * 这个事件能否执行。
    * - 有 animation（isActive=true）：做条件判断通过后返回 true，由 emitEvent 调用 request 锁定当前待执行技能。
    * - 无 animation（isActive=false）：在此处直接执行业务逻辑并返回 false，不占用待执行槽也不切换状态。
     * @param {any} event
     */
    canTrigger(event) {
        if(this.player)return false;
        if(this.monster)return false;
        return false;
    }
    /**
     * 请求执行（基类默认实现，子类无需重写）。
     * 仅由 isActive()=true 的技能在 canTrigger 返回 true 后被 emitEvent 调用。
     */
    _request(){
        //if(this.player)this.player.requestSkill(this);
        if(this.monster)this.monster.requestSkill(this);
    }
    /**
     * 执行技能主体逻辑。仅对主动技能有效——动画播放完毕后由 MonsterSkillsManager 调用。
     * 子类必须重写此方法以实现具体技能效果。
     */
    trigger() {}
    /**
     * 后台限时技能的每帧执行入口。
     * 对于有持续时间的技能（如护盾、急速），在 `running` 为 true 期间每帧调用。
     * 子类按需重写以实现持续效果或到期清理。
     */
    tick(){}
    /**
     * 检查冷却是否就绪。
     * - `cooldown = -1`（一次性）：仅当从未触发过时返回 true。
     * - `cooldown <= 0`（无限制）：始终返回 true。
     * - `cooldown > 0`：当前时间距上次触发超过冷却秒数时返回 true。
     * @returns {boolean}
     */
    _cooldownReady() {
        // -1 = 一次性：只要触发过一次（lastTriggerTime 不再是初始值 -999）就永久失效
        if (this.cooldown === -1) return this.lastTriggerTime === -999;
        if (this.cooldown <= 0) return true;
        const now = Instance.GetGameTime();
        return now - this.lastTriggerTime >= this.cooldown;
    }

    /**
     * 标记技能已触发——更新 `lastTriggerTime` 为当前游戏时间。
     * 若技能配置了 `buffTypeId` 且怪物当前有目标，还会通过事件系统发布 `SkillCast` 事件，
     * 携带构建好的 buff 负载供玩家 buff 系统接收。
     */
    _markTriggered() {
        this.lastTriggerTime = Instance.GetGameTime();
    }
}

/**
 * @module 怪物系统/怪物技能/基础属性增强
 */

class CoreStats extends SkillTemplate {
    /**
     * @param {Player|null} player
     * @param {Monster|null} monster
     * @param {number} id
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string | null;
     *   health_mult?: number;
     *   health_value?: number;
     *   damage_mult?: number;
     *   damage_value?: number;
     *   speed_mult?: number;
     *   speed_value?: number;
     *   reward_mult?: number;
     *   reward_value?: number;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "corestats", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [SkillEvents.Spawn];
        this.params = params;
    }

    /**
     * @param {any} event
     */
    canTrigger(event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;
        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    trigger() {
        this._markTriggered();
        if (this.player) {
            return;
        }

        if (this.monster) {
            if (this.params.health_value) {
                this.monster.baseMaxHealth += this.params.health_value;
                this.monster.health += this.params.health_value;
            }
            if (this.params.health_mult) {
                this.monster.baseMaxHealth *= this.params.health_mult;
                this.monster.health *= this.params.health_mult;
            }
            if (this.params.damage_value) this.monster.baseDamage += this.params.damage_value;
            if (this.params.damage_mult) this.monster.baseDamage *= this.params.damage_mult;
            if (this.params.speed_value ) this.monster.baseSpeed += this.params.speed_value;
            if (this.params.speed_mult ) this.monster.baseSpeed *= this.params.speed_mult;
            if (this.params.reward_value ) this.monster.baseReward += this.params.reward_value;
            if (this.params.reward_mult ) this.monster.baseReward *= this.params.reward_mult;
            this.monster.recomputeDerivedStats();
        }
    }
}

/**
 * @module 怪物系统/怪物技能/飞扑
 */

class PounceSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
    * @param {Record<string, any>} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "pounce", id, params);
        this.distance = params.distance ?? 0;
        this.animation = params.animation ?? null;
        this.events = params.events ?? [SkillEvents.Tick];
        this._duration = params.duration ?? 1;
        this.asyncOccupation = "pounce";
    }

    canTrigger(/** @type {any} */ event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;

        const monster = this.monster;
        if (monster) {
            if (!monster.target) return false;
            if (monster.isOccupied()) return false;

            const distsq = monster.distanceTosq(monster.target);
            const attackDistSq = monster.attackdist * monster.attackdist;
            const triggerDistSq = this.distance * this.distance;
            if (!(distsq > attackDistSq && distsq < triggerDistSq)) return false;
        }

        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    tick() {
        if (this.player) return;

        const monster = this.monster;
        if (!this.running || !monster) return;

        if (monster.movementStateSnapshot.onGround) {
            this.running = false;
            monster.onOccupationEnd("pounce");
        }
    }

    trigger() {
        if (this.player) {
            this._markTriggered();
            return;
        }

        const monster = this.monster;
        if (!monster) return;

        const model = monster.model;
        const target = monster.target;
        if (!model?.IsValid() || !target) return;

        const start = model.GetAbsOrigin();
        const targetPos = target.GetAbsOrigin();

        const duration = this._duration > 0 ? this._duration : 1;
        const velocity = {
            x: (targetPos.x - start.x) / duration,
            y: (targetPos.y - start.y) / duration,
            z: (targetPos.z - start.z + 0.5 * DEFAULT_WORLD_GRAVITY * duration * duration) / duration,
        };

        monster.animation.setOccupation("pounce");
        this.running = true;

        const submitted = monster.submitMovementEvent({
            type: MovementRequestType.Move,
            entity: model,
            priority: MovementPriority.Skill,
            targetPosition: targetPos,
            usePathRefresh: false,
            useNPCSeparation: true,
            Mode: "air",
            Velocity: velocity,
        });

        if (!submitted) {
            this.running = false;
            monster.onOccupationEnd("pounce");
            return;
        }

        this._markTriggered();
    }
}

/**
 * @module 怪物系统/怪物技能/初始动画
 */

class InitAnimSkill extends SkillTemplate {
    /**
     * @param {Player|null} player
     * @param {Monster|null} monster
     * @param {number} id
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string | null;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "initanim", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [SkillEvents.Spawn];
    }
    /**
     * @param {any} event
     */
    canTrigger(event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;
        // 怪物专属技能
        if (!this.monster)return false;
        if (this.monster && !this.monster.isOccupied()) return false;
        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    trigger() {
        this._markTriggered();
        if (this.player) {
            return;
        }
        if (this.monster)
        {
            return;
        }
    }
}

/**
 * @module 怪物系统/怪物技能/双倍攻击
 */

class DoubleAttackSkill extends SkillTemplate {
    /**
     * @param {Player|null} player
     * @param {Monster|null} monster
     * @param {number} id
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string | null;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "doubleattack", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [SkillEvents.AttackTrue];
    }
    /**
     * @param {any} event
     */
    canTrigger(event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;
        if (this.monster && !this.monster.target) return false;
        if (!this.monster)return false;
        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    trigger() {
        this._markTriggered();
        if (this.player) {
            return;
        }
        if (this.monster)
        ;
        // TODO: 第二次攻击逻辑后续补齐。
    }
}

/**
 * @module 怪物系统/怪物技能/重击
 */

class PowerAttackSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string | null;
     *   impulse?: number;
     *   verticalBoost?: number;
     *   buffDuration?: number;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "powerattack", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [SkillEvents.AttackTrue];
        this.buffTypeId = "knockup";
        this.buffParams = {
            impulse: params.impulse ?? 300,
            verticalBoost: params.verticalBoost ?? 400,
            duration: params.buffDuration ?? 0.6,
        };
    }

    canTrigger(/** @type {any} */ event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;

        const monster = this.monster;
        if (monster) {
            if (!monster.target) return false;
            if (monster.isOccupied()) return false;
        }

        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    trigger() {
        if (this.player) {
            this._markTriggered();
            return;
        }
        if (!this.monster) return;

        // TODO: 击飞 Buff 的实际施加逻辑后续补齐。
        this._markTriggered();
    }
}

/**
 * @module 怪物系统/怪物技能/毒气
 */

class PoisonGasSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
     * @param {{
     *   areaEffectStaticKey?: string;
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string | null;
     *   zoneDuration?: number;
     *   zoneRadius?: number;
     * }} params
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "poisongas", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [SkillEvents.Die];
        this.areaEffectStaticKey= "poisongas";
        this.zoneDuration = params.zoneDuration ?? 5;
        this.zoneRadius = params.zoneRadius ?? 150;
    }
    /**
     * @param {any} event
     */
    canTrigger(event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;
        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    trigger() {
        this._markTriggered();
        if (this.player) {
            return;
        }

        const monster = this.monster;
        if (!monster) return;

        const pos = monster.model?.GetAbsOrigin?.();
        if (!pos) return;
        /**@type {import("../../areaEffects/area_const").AreaEffectCreateRequest} */
        const payload = {
            areaEffectStaticKey: "poisongas",
            position: { x: pos.x, y: pos.y, z: pos.z },
            radius: this.zoneRadius,
            duration: this.zoneDuration,
            targetTypes: ["player"],
            result: false,
        };
        eventBus.emit(event.AreaEffects.In.CreateRequest, payload);
        return payload.result;
    }
}

/**
 * @module 怪物系统/怪物技能/产卵
 */

class SpawnSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
     * @param {{
     *   events?: string[];
     *   event?: string;
     *   count?: number;
     *   typeName?: string;
     *   cooldown?: number;
     *   maxSummons?: number;
     *   radiusMin?: number;
     *   radiusMax?: number;
     *   tries?: number;
     *   animation?: string | null;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "spawn", id, params);
        this.animation = params.animation ?? null;

        const configuredEvents = params.events ?? (params.event ? [params.event] : [SkillEvents.Die]);
        this.events = Array.isArray(configuredEvents) ? configuredEvents : [configuredEvents];
        this.count = Math.max(1, params.count ?? 1);
        this.typeName = params.typeName ?? monster?.type ?? "";
        this.maxSummons = params.maxSummons ?? 1;
        this.radiusMin = Math.max(0, params.radiusMin ?? 24);
        this.radiusMax = Math.max(this.radiusMin, params.radiusMax ?? 96);
        this.tries = Math.max(1, params.tries ?? 6);
        this.spawnedTotal = 0;
        this._pendingCount = 0;
    }

    canTrigger(/** @type {any} */ event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;

        const monster = this.monster;
        if (monster) {
            if (this.maxSummons >= 0 && this.spawnedTotal >= this.maxSummons) return false;

            const remaining = this.maxSummons < 0
                ? this.count
                : Math.min(this.count, this.maxSummons - this.spawnedTotal);
            if (remaining <= 0) return false;

            this._pendingCount = remaining;
        }

        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    trigger() {
        if (this.player) {
            this._markTriggered();
            return;
        }

        const monster = this.monster;
        if (!monster) return;

        let spawnedNow = 0;
        for (let i = 0; i < this._pendingCount; i++) {
            const ok = monster.requestSpawn({
                typeName: this.typeName,
                radiusMin: this.radiusMin,
                radiusMax: this.radiusMax,
                tries: this.tries,
            });
            if (ok) spawnedNow++;
        }

        this._pendingCount = 0;
        if (spawnedNow > 0) {
            this.spawnedTotal += spawnedNow;
            this._markTriggered();
        }
    }
}

/**
 * @module 怪物系统/怪物技能/护盾
 */

class ShieldSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
    * @param {Record<string, any>} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "shield", id, params);
        this.runtime = params.runtime ?? -1;
        this.maxshield = params.value ?? 0;
        this.shield = 0;
        this.animation = params.animation ?? null;

        const userEvents = params.events ?? [SkillEvents.Spawn, SkillEvents.Tick];
        this.events = userEvents.includes(SkillEvents.Spawn)
            ? userEvents
            : [SkillEvents.Spawn, ...userEvents];

        this._initialized = false;
        this._modFn = null;
    }

    onSkillDelete() {
        const monster = this.monster;
        if (monster && this._modFn) {
            monster.healthCombat.removeDamageModifier(this._modFn);
        }
        this.running = false;
        if (monster && monster.model instanceof BaseModelEntity) {
            monster.model.Unglow();
        }
    }

    canTrigger(/** @type {any} */ event) {
        if (!this.events.includes(event.type)) return false;

        const monster = this.monster;
        if (event.type === SkillEvents.Spawn) {
            if (this.player || !monster) return false;
            if (!this._initialized) {
                this._initialized = true;
                this._modFn = (/** @type {number} */ amount) => {
                    if (!this.running) return amount;

                    const absorbed = Math.min(amount, this.shield);
                    this.shield -= absorbed;
                    if (this.shield <= 0) {
                        this.running = false;
                        if (monster.model instanceof BaseModelEntity) {
                            monster.model.Unglow();
                        }
                    }
                    return amount - absorbed;
                };
                monster.healthCombat.addDamageModifier(this._modFn);
            }
            return false;
        }

        if (!this._cooldownReady()) return false;

        if (monster) {
            if (this.running) return false;
            if (monster.isOccupied()) return false;
        }

        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    tick() {
        if (this.player) return;

        const monster = this.monster;
        if (!this.running || !monster) return;

        if (this.runtime !== -1 && this.lastTriggerTime + this.runtime <= Instance.GetGameTime()) {
            this.running = false;
            if (monster.model instanceof BaseModelEntity) {
                monster.model.Unglow();
            }
        }
    }

    trigger() {
        if (this.player) {
            this._markTriggered();
            return;
        }

        const monster = this.monster;
        if (!monster) return;

        this.shield = this.maxshield;
        if (monster.model instanceof BaseModelEntity) {
            monster.model.Glow({ r: 0, g: 0, b: 255 });
        }
        this.running = true;
        this._markTriggered();
    }
}

/**
 * @module 怪物系统/怪物技能/急速
 */

class SpeedBoostSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
     * @param {{
     *   cooldown?: number;
     *   runtime?: number;
     *   speed_mult?: number;
     *   speed_value?: number;
     *   events?: string[];
     *   animation?: string | null;
     *   glow?: {r:number, g:number, b:number} | null;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "speedboost", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [SkillEvents.Tick];
        this.glow = params.glow ?? null;
    }

    canTrigger(/** @type {any} */ event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;

        const monster = this.monster;
        if (monster) {
            if (this.running) return false;
            if (monster.isOccupied()) return false;
        }

        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    tick() {
        if (this.player) return;

        const monster = this.monster;
        if (!this.running || !monster) return;

        if (!monster.hasBuff("speed_up")) {
            this._endBoost();
        }
    }

    trigger() {
        if (this.player) {
            this._markTriggered();
            return;
        }

        const monster = this.monster;
        if (!monster) return;

        const buff = monster.addBuff("speed_up");

        if (!buff) return;

        if (this.glow && monster.model instanceof BaseModelEntity) {
            monster.model.Glow(this.glow);
        }
        this.running = true;
        this._markTriggered();
    }

    _endBoost() {
        const monster = this.monster;
        this.running = false;
        if (this.glow && monster && monster.model instanceof BaseModelEntity) {
            monster.model.Unglow();
        }
    }
}

/**
 * @module 怪物系统/怪物技能/投掷石头
 */

class ThrowStoneSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string | null;
     *   distanceMin?: number;
     *   distanceMax?: number;
     *   damage?: number;
     *   projectileSpeed?: number;
     *   gravityScale?: number;
     *   radius?: number;
     *   maxTargets?: number;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "throwstone", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [SkillEvents.Tick];
        this.distanceMin = params.distanceMin ?? 0;
        this.distanceMax = params.distanceMax ?? 600;
        this.damage = params.damage ?? 10;
        this.projectileSpeed = params.projectileSpeed ?? 500;
        this.gravityScale = params.gravityScale ?? 1;
        this.radius = params.radius ?? 32;
        this.maxTargets = params.maxTargets ?? 1;
        this._projectile = null;
        this._tickCtx = null;
    }

    canTrigger(/** @type {any} */ event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;

        const monster = this.monster;
        if (monster) {
            if (!monster.target) return false;
            if (this.running) return false;
            if (monster.isOccupied()) return false;

            const distsq = monster.distanceTosq(monster.target);
            const minDistSq = this.distanceMin * this.distanceMin;
            const maxDistSq = this.distanceMax * this.distanceMax;
            if (distsq < minDistSq || distsq > maxDistSq) return false;

            this._tickCtx = { dt: event.dt, allmpos: event.allmpos };
        }

        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    tick() {
        if (this.player) return;
        if (!this.running) return;

        // if (this._projectile) {
        //     this._projectile.update(dt);
        //     if (this._projectile.isFinished()) {
        //         const hitTargets = this._projectile.getHitTargets();
        //         void hitTargets;
        //         this.running = false;
        //         this._projectile = null;
        //     }
        // }
    }

    trigger() {
        if (this.player) {
            this._markTriggered();
            return;
        }
        if (!this.monster) return;

        // this._projectile = new ProjectileRunner({ ... });
        // this.running = true;
        this._markTriggered();
    }
}

/**
 * @module 怪物系统/怪物技能/激光
 */

class LaserBeamSkill extends SkillTemplate {
    /**
     * @param {Player|null} player
     * @param {Monster|null} monster
     * @param {number} id
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string | null;
     *   distance?: number;
     *   duration?: number;
     *   damagePerSecond?: number;
     *   tickInterval?: number;
     *   width?: number;
     *   pierce?: boolean;
     *   maxTargets?: number;
     *   startDelay?: number;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "laserbeam", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [SkillEvents.Tick];
        this.distance = params.distance ?? 500;
        this.duration = params.duration ?? 0;
        this.damagePerSecond = params.damagePerSecond ?? 20;
        this.tickInterval = params.tickInterval ?? 0.25;
        this.width = params.width ?? 8;
        this.pierce = params.pierce ?? false;
        this.maxTargets = params.maxTargets ?? 1;
        this.startDelay = params.startDelay ?? 0;
        this._tickAccumulator = 0;
        this._tickCtx = null;
    }
    /**
     * @param {any} event
     */
    canTrigger(event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;
        if (!this.monster)return false;

        if (!this.monster.target) return false;
        if (this.running) return false;
        if (this.monster.isOccupied()) return false;

        const distsq = this.monster.distanceTosq(this.monster.target);
        if (distsq > this.distance * this.distance) return false;

        this._tickCtx = { dt: event.dt, allmpos: event.allmpos };

        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    tick() {
        if (this.player) return;
        if (!this.running || !this.monster) return;

        const now = Instance.GetGameTime();
        if (this.duration > 0 && this.lastTriggerTime + this.duration <= now) {
            this.running = false;
            this._tickAccumulator = 0;
            return;
        }

        // this._tickAccumulator += dt;
        // while (this._tickAccumulator >= this.tickInterval) {
        //     this._tickAccumulator -= this.tickInterval;
        //     // 射线检测 + 造成伤害
        // }
    }

    trigger() {
        this._markTriggered();
        if (this.player) {
            return;
        }
        if(this.monster)
        {
            if (this.duration > 0) {
                this.running = true;
                this._tickAccumulator = 0;
            }
        }
    }
}

class PlayerPulseSkill extends SkillTemplate {
    /**
     * @param {import("../../player/player/player").Player | null} player
     * @param {import("../../monster/monster/monster").Monster | null} monster
     * @param {string} typeId
     * @param {number} id
     * @param {{
     *   inputKey?: string;
     *   cooldown?: number;
     *   heal?: number;
     *   armor?: number;
     *   events?: string[];
     * }} [params]
     */
    constructor(player, monster, typeId, id, params = {}) {
        super(player, monster, typeId, id, params);
        this.animation = null;
        this.events = params.events ?? [SkillEvents.Input];
        this.inputKey = params.inputKey ?? "InspectWeapon";
        this.heal = params.heal ?? 0;
        this.armor = params.armor ?? 0;
    }

    /**
     * @param {{ type: string, key?: string }} event
     * @returns {boolean}
     */
    canTrigger(event) {
        if (!this.player || this.monster) return false;
        if (!this.events.includes(event.type)) return false;
        if (event.type === SkillEvents.Input && event.key !== this.inputKey) return false;
        if (!this._cooldownReady()) return false;

        this.trigger();
        return false;
    }

    trigger() {
        const player = this.player;
        if (!player || this.monster) return;

        let applied = false;
        if (this.heal > 0) {
            applied = player.heal(this.heal) || applied;
        }
        if (this.armor > 0) {
            applied = player.giveArmor(this.armor) || applied;
        }

        if (!applied) return;
        this._markTriggered();
    }
}

/**
 * @module 怪物系统/技能工厂
 */
/*
技能分类规则（唯一权威）：
  有 animation 参数（非 null）= 有动作：canTrigger 返回 true 后 request 占用当前待执行槽，
    Monster 进入 SKILL 状态，管理器先播放 animation，再调用 trigger()。
  无 animation（null）       = 无动作：canTrigger 内直接执行业务并返回 false。
  cooldown = -1              = 一次性：仅首次触发后永久失效。默认为 -1。
  cooldown = 0               = 无冷却。
  cooldown > 0               = 按秒间隔触发。

实例 id 语义：
  skill.typeId 是技能类型标识（即下方的 id 字段）。
  skill.id 是运行时实例 id，由 MonsterSkillsManager.addSkill 按添加顺序分配，
  id 越小优先级越高。同一怪物可同时拥有多个相同 typeId 的技能实例。

所有技能均支持 params.events（string[]）配置多个触发事件，未提供则使用各技能自身默认。
每个技能均支持可选 animation 参数，不传则默认 null（无动作）。
每个技能均支持可选 cooldown 参数，不传则默认 -1（一次性）。

技能列表（typeId 均为小写无前缀）：

corestats   基础属性增加（默认 OnSpawn 执行一次，cooldown=-1）
  { health_mult?, health_value?, damage_mult?, damage_value?,
    speed_mult?, speed_value?, reward_mult?, reward_value?,
    cooldown?, events?, animation? }

pounce      飞扑（默认 OnTick 判断距离和冷却）
  { distance: number, cooldown?, events?, animation? }

initanim    初始动画（默认 OnSpawn 一次性）
  { cooldown?, events?, animation? }

doubleattack  双倍攻击（默认 AttackTrue 触发）
  { cooldown?, events?, animation? }

powerattack   重击（默认 AttackTrue 触发，可击飞玩家）
  { cooldown?, events?, animation? }

poisongas     毒气（默认 Die 触发，可释放毒气粒子）
  { cooldown?, events?, animation? }

shield      能量护盾（默认 [OnSpawn, OnTick]，Spawn 始终保留以初始化修饰器）
  { runtime: number, value: number, cooldown?, events?, animation? }

speedboost  急速（默认 OnTick，临时提升移动速度，超时后恢复）
  { runtime: number, speed_mult?, speed_value?, cooldown?, events?, animation?,
    glow?: {r,g,b} }

throwstone  投掷石头（默认 OnTick，距离判定后投掷，trigger 待实现）
  { distanceMin?, distanceMax?, damage?, projectileSpeed?, gravityScale?,
    radius?, maxTargets?, cooldown?, events?, animation? }

laserbeam   发射激光（默认 OnTick，distance 内判定，trigger 待实现）
  { distance?, duration?, damagePerSecond?, tickInterval?, width?,
    pierce?, maxTargets?, startDelay?, cooldown?, events?, animation? }

spawn       事件触发产卵（默认 OnDie）
  { events?, event?(旧单值兄容), count?, typeName?, cooldown?,
    maxSummons?, radiusMin?, radiusMax?, tries?, animation? }

player_guard    玩家守护脉冲（InspectWeapon 触发，加护甲）
player_mend     玩家治疗脉冲（InspectWeapon 触发，回血）
player_vanguard 玩家先锋脉冲（InspectWeapon 触发，回血+护甲）
 */
/**
 * 技能工厂。根据 typeId 创建对应的技能实例。
 *
 * 当前支持的 typeId：
 * corestats、pounce、initanim、doubleattack、powerattack、
 * poisongas、spawn、shield、speedboost、throwstone、laserbeam、
 * player_guard、player_mend、player_vanguard。
 *
 * 所有技能均支持 `params.events`、`params.animation`、`params.cooldown`。
 * 详细参数见各技能类的 JSDoc。
 */
const SkillFactory = {
    /**
     * 根据 typeId 创建对应的技能实例。未识别的 id 返回 null。
     * @param {Player|null} player 施法玩家
     * @param {Monster|null} monster 施法怪物
     * @param {string} typeid 技能类型标识（如 "corestats"、"pounce"）
     * @param {number} id 技能实例 id
     * @param {any} params 技能配置参数
     * @returns {SkillTemplate|null}
     */
  create(player, monster, typeid, id, params = {}) {
        switch (typeid) {
            case "corestats":
        return new CoreStats(player, monster,id, params);
            case "pounce":
        return new PounceSkill(player, monster,id, params);
            case "initanim":
        return new InitAnimSkill(player, monster,id, params);
            case "doubleattack":
        return new DoubleAttackSkill(player, monster,id, params);
            case "powerattack":
        return new PowerAttackSkill(player, monster,id, params);
            case "poisongas":
        return new PoisonGasSkill(player, monster,id, params);
            case "spawn":
        return new SpawnSkill(player, monster,id, params);
            case "shield":
        return new ShieldSkill(player, monster,id, params);
            case "speedboost":
        return new SpeedBoostSkill(player, monster,id, params);
            case "throwstone":
        return new ThrowStoneSkill(player, monster,id, params);
            case "laserbeam":
        return new LaserBeamSkill(player, monster,id, params);
            case "player_guard":
          return new PlayerPulseSkill(player, monster, "player_guard", id, { inputKey: "InspectWeapon", cooldown: 8, armor: 25, ...params });
            case "player_mend":
          return new PlayerPulseSkill(player, monster, "player_mend", id, { inputKey: "InspectWeapon", cooldown: 8, heal: 35, ...params });
            case "player_vanguard":
          return new PlayerPulseSkill(player, monster, "player_vanguard", id, { inputKey: "InspectWeapon", cooldown: 10, heal: 20, armor: 15, ...params });
            default:
                return null;
        } 
    }
};

/** @typedef {import("../../../skill/skill_template").SkillTemplate & { animation?: string | null }} MonsterSkill */

class MonsterSkillsManager {
    /**
     * @param {import("../monster").Monster} monster
     */
    constructor(monster) {
        this.monster = monster;
        /** @type {MonsterSkill | null} */
        this._requestedSkill = null;
    }

    /**
     * @param {import("../../../util/definition").skill_pool[] | undefined} skillPool
     */
    initSkills(skillPool) {
        if (!skillPool) return;

        for (const cfg of skillPool) {
            if (Math.random() > cfg.chance) continue;
            const skill = SkillFactory.create(null, this.monster, cfg.id, this.monster.skills.length, cfg.params);
            if (!skill) continue;
            this.addSkill(skill);
        }
    }

    /**
     * @param {MonsterSkill} skill
     */
    addSkill(skill) {
        skill.id = this.monster.skills.length;
        this.monster.skills.push(skill);
    }

    /**
     * @param {import("../../../skill/skill_const").EmitEventPayload & { type: string }} event
     */
    emitEvent(event) {
        for (const skill of this.monster.skills) {
            if (!skill.canTrigger(event)) continue;
            skill._request();
            break;
        }
    }

    tickRunningSkills() {
        for (const skill of this.monster.skills) {
            if (!skill.running) continue;
            skill.tick();
        }
    }

    /**
     * @param {MonsterSkill} skill
     */
    requestSkill(skill) {
        if (this.monster.movementStateSnapshot.mode === "ladder") {
            this._requestedSkill = null;
            return false;
        }
        if (this._requestedSkill) return false;
        this._requestedSkill = skill;
        return true;
    }

    hasRequestedSkill() {
        if (this.monster.movementStateSnapshot.mode === "ladder") {
            this._requestedSkill = null;
            return false;
        }
        return this._requestedSkill !== null;
    }

    triggerRequestedSkill() {
        if (this.monster.movementStateSnapshot.mode === "ladder") {
            this._requestedSkill = null;
            return;
        }

        const skill = this._requestedSkill;
        this._requestedSkill = null;
        if (!skill) return;

        if (skill.animation) this.monster.animation.play(skill.animation);
        skill.trigger();
    }
}

/**
 * @module 怪物系统/怪物组件/移动意图适配
 */


/**
 * 怪物移动意图适配器（事件驱动）。
 *
 * 不再每帧推送 Move 请求，而是在状态变化点发出请求：
 * - activate()   — 进入追击态时提交 Move
 * - deactivate() — 进入技能/空闲/死亡时提交 Stop
 * - onTargetChanged()      — 追击目标更换时重新提交
 * - onOccupationChanged()  — 动画占用开始/结束时重新提交 Chase 请求，更新 usePathRefresh
 *
 * MovementManager 持有长期任务，无需每帧重复推送。
 *
 * @navigationTitle 怪物移动意图适配器
 */
class MonsterMovementPathAdapter {
    /**
     * @param {import("../monster").Monster} monster 所属怪物实例
     */
    constructor(monster) {
        /** 所属怪物实例。 */
        this.monster = monster;
        /** 注册时的默认移动模式。由 init 保存。 */
        this._defaultMode = "walk";
        /** 当前是否有活跃的追击任务。 */
        this._active = false;
    }

    /**
     * 初始化：仅记录配置，不创建运动执行器。
     * @param {import("../../../util/definition").monsterTypes} typeConfig 怪物类型配置
     */
    init(typeConfig) {
        switch (typeConfig.movementmode) {
            case "fly":
                this._defaultMode = "fly";
                break;
            default:
                this._defaultMode = "walk";
                break;
        }
    }

    /**
     * 激活追击。进入 CHASE / ATTACK 等需要持续移动的状态时调用。
     */
    activate() {
        if (!this._getMovementEntity() || !this.monster.target) return;
        this._active = true;
        this._submitChase();
    }

    /**
     * 停止移动。进入 SKILL / IDLE / DEAD 或丢失目标时调用。
     */
    deactivate() {
        if (!this._active) return;
        const entity = this._getMovementEntity();
        this._active = false;
        if (!entity) return;
        this.monster.submitMovementEvent({
            type: MovementRequestType$1.Stop,
            entity,
            priority: MovementPriority$1.StateChange,
            clearPath: false,
        });
    }

    /**
     * 追击目标实体变化时调用。若当前活跃则重新提交 Move；
     * 若新目标为 null 则自动停止。
     */
    onTargetChanged() {
        if (!this._active) return;
        if (!this.monster.target) {
            this.deactivate();
            return;
        }
        this._submitChase();
    }

    /**
     * 动画占用状态变化时调用（开始/结束）。
     * 重新提交 Chase 请求，用 usePathRefresh 直接表达“当前是否允许刷新路径”。
     */
    onOccupationChanged() {
        if (!this._active) return;
        this._submitChase();
    }

    refreshMovement() {
        if (!this._active) return;
        if (this.monster.state === MonsterState.DEAD) {
            this.deactivate();
            return;
        }
        if (!this.monster.target) {
            this.deactivate();
            return;
        }
        this._submitChase();
    }

    /** 内部：提交一次 Chase Move 请求。 */
    _submitChase() {
        const entity = this._getMovementEntity();
        const target = this.monster.target;
        if (!entity || !target) return;

        this.monster.submitMovementEvent({
            type: MovementRequestType$1.Move,
            entity,
            priority: MovementPriority$1.Chase,
            targetEntity: target,
            usePathRefresh: !this.monster.isOccupied(),
            useNPCSeparation: true,
            maxSpeed: this.monster.speed,
            Mode: this._defaultMode,
        });
    }

    /** @returns {import("cs_script/point_script").Entity | null} */
    _getMovementEntity() {
        const entity = this.monster.model;
        if (!entity?.IsValid()) return null;
        return entity;
    }

    /** 获取注册用的默认模式。 */
    getDefaultMode() {
        return this._defaultMode;
    }
}

/**
 * @module 怪物系统/怪物组件/动画占用
 */

/**
 * 怪物动画控制器。
 *
 * 封装 MonsterAnimator 并在攻击、技能、死亡动作播放期间
 * 设置占用标志，禁止其他动作插入。
 * 动作结束后自动取消占用并触发回调。
 * 同时管理死亡动画/尸体降落流程。
 *
 * @navigationTitle 怪物动画控制器
 */
class MonsterAnimator {
    /**
     * 创建怪物动画控制器。
     * @param {import("../monster").Monster} monster 所属怪物实例
     * @param {Entity | null} model Source 2 怪物模型实体
     * @param {import("../../../util/definition").animations} animConfig 动画配置表（idle/walk/attack/skill/dead 动画名数组）
     */
    constructor(monster,model,animConfig) {
        /** 所属怪物实例。 */
        this.monster = monster;
        /** Source 2 怪物模型实体。 */
        this.model = model;
        /**
         * 动画配置表。每个键对应一组可随机播放的动画名。
         * @type {import("../../../util/definition").animations}
         */
        this.animConfig = animConfig;
        /** 是否处于动作占用期。播放动画时置 true，`OnAnimationDone` 事件触发后置 false。 */
        this.locked = false;
        /** 当前动画对应的 MonsterState 值。由 `tick` / `enter` 设置。 */
        this.currentstats=-1;
        /** 动作结束回调。仅当 type 与当前占用一致时才清除。 */
        this.onStateFinish = null;
        /** @type {Entity | null} */
        this._boundModel = null;

        this._bindModelOutput();
    }

    _bindModelOutput() {
        this.model = this.monster.model ?? this.model;
        if (!this.model || this._boundModel === this.model) return;

        this._boundModel = this.model;
        Instance.ConnectOutput(this.model,"OnAnimationDone",()=>{
            this.locked = false;
            this.onStateFinish?.(this.currentstats);
        });
    }
    /**
     * 设置动画播放完成回调。当任一动画结束（`OnAnimationDone`）时触发，
     * 传入当时的 MonsterState 值。
     * @param {(state: number) => void} callback 状态回调
     */
    setonStateFinish(callback)
    {
        this.onStateFinish=callback;
    }
    /**
     * 初始化动画控制器，并注册动画完成回调处理占用释放和死亡流程。
     * @param {import("../../../util/definition").animations} animations 动画配置表
     */
    init(animations) {
        this.animConfig = animations;
        this._bindModelOutput();
        this.setonStateFinish((/** @type {number} */ state) => {
            if (state == MonsterState.ATTACK) this.monster.onOccupationEnd("attack");
            else if (state == MonsterState.SKILL) this.monster.onOccupationEnd("skill");
            else if (state == MonsterState.DEAD) {
                this.monster.emitEvent({ type: MonsterBuffEvents.ModelRemove });
                this.monster.entityBridge.removeAfterDeath(removeModelAfterDeathAnimation);
            }
        });
    }

    /**
     * 当前是否被占用。
     * @returns {boolean}
     */
    isOccupied() {
        return this.monster.occupation != "";
    }

    /**
     * 设置占用标记。占用期间状态切换被禁止。
     * @param {string} type 占用类型（"attack" | "skill" | "pounce"）
     */
    setOccupation(type) {
        this.monster.occupation = type;
    }

    /**
     * 占用结束回调。仅当 type 与当前占用一致时才清除。
     * @param {string} type 占用类型
     */
    onOccupationEnd(type) {
        if (this.monster.occupation !== type) return;
        this.monster.occupation = "";
    }

    /**
     * 每帧更新。若 `locked` 则跳过；否则根据当前状态播放对应动画。
     * @param {number} state 当前 MonsterState
     */
    tick(state) {
        if (this.locked) return;
        this.currentstats=state;
        switch (state) {
            case MonsterState.IDLE:
                this.play("idle");
                break;
            case MonsterState.CHASE:
                this.play("walk");
                break;
            case MonsterState.ATTACK:
                this.play("attack");
                break;
            case MonsterState.SKILL:
                this.play("skill");
                break;
            case MonsterState.DEAD:
                this.play("dead");
                break;
        }
    }

    /**
     * 未被占用时始终允许；占用期间仅当当前不是 ATTACK/SKILL 时允许。
     * @returns {boolean}
     */
    canSwitch() {
        if (!this.locked) {
            return true;
        }
        if (this.currentstats==MonsterState.ATTACK||this.currentstats==MonsterState.SKILL) {
            return false;
        }
        return true;
    }

    /**
     * 强制播放指定状态对应的动画，无视 `locked` 状态。
     * 由 `applyStateTransition` 在状态切换成功后调用。
     * @param {number} nextState MonsterState
     */
    enter(nextState) {
        this.currentstats=nextState;
        switch (nextState) {
            case MonsterState.IDLE:
                this.play("idle");
                break;
            case MonsterState.CHASE:
                this.play("walk");
                break;
            case MonsterState.ATTACK:
                this.play("attack");
                break;
            case MonsterState.SKILL:
                this.play("skill");
                break;
            case MonsterState.DEAD:
                this.play("dead");
                break;
        }
    }
    /**
     * 播放指定类型的动画。从配置表中随机选择一个动画名，
     * 通过 `EntFireAtTarget(SetAnimation)` 发送给引擎。
     * @param {string} type 动画类型键（"idle"|"walk"|"attack"|"skill"|"dead"）
     */
    play(type) {
        this._bindModelOutput();
        const list = this.animConfig[type];
        if (!this.model || !list || list.length === 0) return null;
        const anim = list[Math.floor(Math.random() * list.length)];
        if (!anim) return;
        Instance.EntFireAtTarget({target:this.model,input:"SetAnimation",value:anim});
        this.locked=true;
        return anim;
    }
}

/**
 * @module 工具/向量工具
 */
/**
 * 向量工具类，提供 2D/3D 向量的静态运算方法（加减、点积、叉积、归一化、插值等）。
 * @navigationTitle 向量工具
 */
let vec$1 = class vec{
    /**
     * 返回向量vec1+vec2
     * @param {import("cs_script/point_script").Vector} a
     * @param {import("cs_script/point_script").Vector} b
     * @returns {import("cs_script/point_script").Vector}
     */
    static add(a, b) {
        return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
    }
    /**
     * 添加 2D 分量
     * @param {import("cs_script/point_script").Vector} a
     * @param {import("cs_script/point_script").Vector} b
     * @returns {import("cs_script/point_script").Vector}
     */
    static add2D(a, b) {
        return { x: a.x + b.x, y: a.y + b.y, z: a.z};
    }
    /**
     * 返回向量vec1-vec2
     * @param {import("cs_script/point_script").Vector} a
     * @param {import("cs_script/point_script").Vector} b
     * @returns {import("cs_script/point_script").Vector}
     */
    static sub(a, b) {
        return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
    }
    /**
     * 返回向量vec1*s
     * @param {import("cs_script/point_script").Vector} a
     * @param {number} s
     * @returns {import("cs_script/point_script").Vector}
     */
    static scale(a,s)
    {
        return {x:a.x*s,y:a.y*s,z:a.z*s}
    }
    /**
     * 返回向量vec1*s
     * @param {import("cs_script/point_script").Vector} a
     * @param {number} s
     * @returns {import("cs_script/point_script").Vector}
     */
    static scale2D(a,s) {
        return {
            x:a.x * s,
            y:a.y * s,
            z:a.z
        };
    }
    /**
     * 得到vector
     * @param {number} [x]
     * @param {number} [y]
     * @param {number} [z]
     * @returns {import("cs_script/point_script").Vector}
     */
    static get(x=0,y=0,z=0)
    {
        return {x,y,z};
    }
    /**
     * 深复制
     * @param {import("cs_script/point_script").Vector} a
     * @returns {import("cs_script/point_script").Vector}
     */
    static clone(a)
    {
        return {x:a.x,y:a.y,z:a.z};
    }
    /**
     * 计算空间两点之间的距离
     * @param {import("cs_script/point_script").Vector} a
     * @param {import("cs_script/point_script").Vector} [b]
     * @returns {number}
     */
    static length(a, b={x:0,y:0,z:0}) {
        const dx = a.x - b.x; const dy = a.y - b.y; const dz = a.z - b.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    /**
     * 计算xy平面两点之间的距离
     * @param {import("cs_script/point_script").Vector} a
     * @param {import("cs_script/point_script").Vector} [b]
     * @returns {number}
     */
    static length2D(a, b={x:0,y:0,z:0}) {
        const dx = a.x - b.x; const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    /**
     * 计算空间两点之间的距离平方（无平方根，更快）
     * @param {import("cs_script/point_script").Vector} a
     * @param {import("cs_script/point_script").Vector} [b]
     * @returns {number}
     */
    static lengthsq(a, b={x:0,y:0,z:0}) {
        const dx = a.x - b.x; const dy = a.y - b.y; const dz = a.z - b.z;
        return dx * dx + dy * dy + dz * dz;
    }
    /**
     * 计算xy平面两点之间的距离平方（无平方根，更快）
     * @param {import("cs_script/point_script").Vector} a
     * @param {import("cs_script/point_script").Vector} [b]
     * @returns {number}
     */
    static length2Dsq(a, b={x:0,y:0,z:0}) {
        const dx = a.x - b.x; const dy = a.y - b.y;
        return dx * dx + dy * dy;
    }
    /**
     * 返回pos上方height高度的点
     * @param {import("cs_script/point_script").Vector} pos
     * @param {number} height
     * @returns {import("cs_script/point_script").Vector}
     */
    static Zfly(pos, height) {
        return { x: pos.x, y: pos.y, z: pos.z + height };
    }
    /**
     * 输出点pos的坐标
     * @param {import("cs_script/point_script").Vector} pos
     */
    static msg(pos) {
        Instance.Msg(`{${pos.x} ${pos.y} ${pos.z}}`);
    }
    /**
     * 计算两个三维向量的点积。
     * @param {import("cs_script/point_script").Vector} a
     * @param {import("cs_script/point_script").Vector} b
     */
    static dot(a,b) {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    /**
     * 计算两个向量在 XY 平面上的点积。
     * @param {import("cs_script/point_script").Vector} a
     * @param {import("cs_script/point_script").Vector} b
     */
    static dot2D(a,b) {
        return a.x * b.x + a.y * b.y;
    }

    /**
     * 计算两个三维向量的叉积。
     * @param {import("cs_script/point_script").Vector} a
     * @param {import("cs_script/point_script").Vector} b
     */
    static cross(a,b) {
        return {
            x:a.y * b.z - a.z * b.y,
            y:a.z * b.x - a.x * b.z,
            z:a.x * b.y - a.y * b.x
        };
    }
    /**
     * 返回三维向量的单位向量，零向量时返回原点。
     * @param {import("cs_script/point_script").Vector} a
     */
    static normalize(a) {
        const len = this.length(a);
        if (len < 1e-6) {
            return {x:0,y:0,z:0};
        }
        return this.scale(a,1 / len);
    }
    /**
     * 返回向量在 XY 平面上的单位向量（z 置零），零向量时返回原点。
     * @param {import("cs_script/point_script").Vector} a
     */
    static normalize2D(a) {
        const len = this.length2D(a);
        if (len < 1e-6) {
            return {x:0,y:0,z:0};
        }
        return {
            x:a.x / len,
            y:a.y / len,
            z:0
        };
    }
    /**
     * 判断向量是否为零向量（各分量绝对值小于 1e-6）。
     * @param {import("cs_script/point_script").Vector} a
     */
    static isZero(a) {
        return (
            Math.abs(a.x) < 1e-6 &&
            Math.abs(a.y) < 1e-6 &&
            Math.abs(a.z) < 1e-6
        );
    }
};

/**
 * @module 怪物系统/怪物实体
 */

/** @typedef {import("../../skill/skill_template").SkillTemplate} MonsterSkill */
/** @typedef {import("../../util/definition").MovementRequest} MovementRequest */
/**
 * @typedef {{
 *   buffId: number;
 *   typeId: string;
 *   params: Record<string, any>;
 *   groupKey: string | null;
 *   source: Record<string, any> | null;
 *   context: Record<string, any> | null;
 * }} MonsterBuffRuntime
 */
/** @typedef {{ type: string, [key: string]: any }} MonsterRuntimeEvent */

class Monster {
    /**
     * @param {number} id
     * @param {import("cs_script/point_script").Vector} position
     * @param {import("../../util/definition").monsterTypes} typeConfig
     */
    constructor(id, position, typeConfig) {
        this.id = id;

        /** @type {Entity | null} */
        this.model = null;
        /** @type {Entity | null} */
        this.breakable = null;
        /** @type {MonsterSkill[]} */
        this.skills = [];

        this.type = typeConfig.name;

        this.baseMaxHealth = typeConfig.baseHealth;
        this.maxhealth = this.baseMaxHealth;
        this.health = this.baseMaxHealth;
        this.preBreakableHealth = 10000;

        this.baseDamage = typeConfig.baseDamage;
        this.damage = this.baseDamage;

        this.baseSpeed = typeConfig.speed;
        this.speed = this.baseSpeed;

        this.attackdist = typeConfig.attackdist;
        this.baseReward = typeConfig.reward;
        this.atc = typeConfig.attackCooldown;

        this.occupation = "";
        /** @type {CSPlayerPawn | null} */
        this.killer = null;

        this.entityBridge = new MonsterEntityBridge(this);
        this.healthCombat = new MonsterHealthCombat(this);
        this.brainState = new MonsterBrainState(this);
        this.skillsManager = new MonsterSkillsManager(this);
        this.movementPath = new MonsterMovementPathAdapter(this);
        /**
         * key 为 buff 类型。
         * value 为 buff id。
         * @type {Map<string, number>}
         */
        this.buffMap = new Map();
        /** @type {Map<string, MonsterBuffRuntime>} */
        this.buffStateMap = new Map();
        /** @type {Array<() => boolean>} */
        this._buffUnsubscribers = [
            eventBus.on(event.Buff.Out.OnBuffRemoved, (/** @type {import("../../buff/buff_const").OnBuffRemoved} */ payload) => {
                this._removeRuntimeByBuffId(payload.buffId);
            }),
        ];

        this.initEntities(position, typeConfig);
        this.animation = new MonsterAnimator(this, this.model, typeConfig.animations);

        this.state = MonsterState.IDLE;
        /** @type {CSPlayerPawn | null} */
        this.target = null;
        this.lastTargetUpdate = 0;
        this.attackCooldown = 0;
        this.lasttick = 0;

        /** @type {{ mode: string; onGround: boolean; currentGoalMode: number | null; }} */
        this.movementStateSnapshot = {
            mode: "walk",
            onGround: true,
            currentGoalMode: null,
        };

        this.initSkills(typeConfig.skill_pool);
        this.movementPath.init(typeConfig);
        this.animation.init(typeConfig.animations);
        this.recomputeDerivedStats();
    }

    init() {
        this.emitEvent({ type: MonsterBuffEvents.Spawn });
    }

    /**
     * @param {import("../../util/definition").skill_pool[] | undefined} skillPool
     */
    initSkills(skillPool) {
        this.skillsManager.initSkills(skillPool);
    }

    /**
     * @param {MonsterSkill} skill
     */
    addSkill(skill) {
        this.skillsManager.addSkill(skill);
    }

    /**
     * @param {import("cs_script/point_script").Vector} position
     * @param {import("../../util/definition").monsterTypes} typeConfig
     */
    initEntities(position, typeConfig) {
        this.entityBridge.init(position, typeConfig);
    }

    /**
     * @param {number} amount
     * @param {CSPlayerPawn | null} attacker
     * @param {{ source?: Entity | null, reason?: string } | null} [meta]
     * @returns {boolean}
     */
    takeDamage(amount, attacker, meta = null) {
        return this.healthCombat.takeDamage(amount, attacker, meta);
    }

    /**
     * @param {string} typeId
     * @param {Record<string, any>} [params]
     * @param {Record<string, any> | null} [source]
     * @param {Record<string, any> | null} [context]
     * @returns {boolean}
     */
    addBuff(typeId, params = {}, source = null, context = null) {
        if (this.buffMap.has(typeId)) return false;
        const normalizedParams = { ...(params ?? {}) };
        /** @type {import("../../buff/buff_const").BuffAddRequest} */
        const addRequest = {
            configid: typeId,
            target: this,
            targetType: "monster",
            result: -1,
        };
        eventBus.emit(event.Buff.In.BuffAddRequest, addRequest);
        if (addRequest.result <= 0) return false;

        this.buffMap.set(typeId, addRequest.result);
        this.buffStateMap.set(typeId, {
            buffId: addRequest.result,
            typeId,
            params: normalizedParams,
            groupKey: typeof normalizedParams.groupKey === "string" ? normalizedParams.groupKey : null,
            source,
            context,
        });
        this.recomputeDerivedStats();
        return true;
    }

    /**
     * @param {string} typeId
     * @param {Record<string, any>} [params]
     * @returns {boolean}
     */
    refreshBuff(typeId, params = {}) {
        const id = this.buffMap.get(typeId);
        if (id == null) return this.addBuff(typeId, params);

        /** @type {import("../../buff/buff_const").BuffRefreshRequest} */
        const refreshRequest = {
            buffId: id,
            result: false,
        };
        eventBus.emit(event.Buff.In.BuffRefreshRequest, refreshRequest);
        if (!refreshRequest.result) return false;

        const runtime = this.buffStateMap.get(typeId);
        if (runtime) {
            runtime.params = { ...(params ?? runtime.params) };
            runtime.groupKey = typeof runtime.params.groupKey === "string" ? runtime.params.groupKey : null;
        }
        this.recomputeDerivedStats();
        return true;
    }

    /**
     * @param {string | ((buff: MonsterBuffRuntime) => boolean)} typeIdOrFilter
     * @returns {boolean}
     */
    removeBuff(typeIdOrFilter) {
        if (typeof typeIdOrFilter === "string") {
            return this._removeBuffByTypeId(typeIdOrFilter);
        }

        let removed = false;
        for (const buff of this.getAllBuffs()) {
            if (!typeIdOrFilter(buff)) continue;
            removed = this._removeBuffByTypeId(buff.typeId) || removed;
        }
        return removed;
    }

    /**
     * @param {string} typeId
     * @returns {boolean}
     */
    hasBuff(typeId) {
        return this.buffMap.has(typeId);
    }

    /**
     * @returns {MonsterBuffRuntime[]}
     */
    getAllBuffs() {
        return Array.from(this.buffStateMap.values());
    }

    clearBuffs() {
        for (const [typeId] of this.buffMap.entries()) {
            this._removeBuffByTypeId(typeId);
        }
    }

    /**
     * @param {string} eventName
     * @param {any} params
     */
    emitBuffEvent(eventName, params) {
        for (const id of this.buffMap.values()) {
            /** @type {import("../../buff/buff_const").BuffEmitRequest} */
            const emitRequest = {
                buffId: id,
                eventName,
                params,
                result: { result: false },
            };
            eventBus.emit(event.Buff.In.BuffEmitRequest, emitRequest);
        }
    }

    /**
     * @param {string} typeId
     * @returns {boolean}
     */
    _removeBuffByTypeId(typeId) {
        const id = this.buffMap.get(typeId);
        if (id == null) return false;

        /** @type {import("../../buff/buff_const").BuffRemoveRequest} */
        const removeRequest = {
            buffId: id,
            result: false,
        };
        eventBus.emit(event.Buff.In.BuffRemoveRequest, removeRequest);
        if (!removeRequest.result) return false;

        this.buffMap.delete(typeId);
        this.buffStateMap.delete(typeId);
        this.recomputeDerivedStats();
        return true;
    }

    recomputeDerivedStats() {
        this.damage = this.baseDamage;
        this.speed = this.baseSpeed;
        this.emitBuffEvent("OnRecompute", { recompute: true });
        this.movementPath.refreshMovement();
    }

    /**
     * @param {number} buffId
     */
    _removeRuntimeByBuffId(buffId) {
        for (const [typeId, id] of this.buffMap.entries()) {
            if (id !== buffId) continue;
            this.buffMap.delete(typeId);
            this.buffStateMap.delete(typeId);
            this.recomputeDerivedStats();
            break;
        }
    }

    /**
     * @param {Entity | null | undefined} killer
     */
    die(killer) {
        this.healthCombat.die(killer);
    }

    /**
     * @param {import("../monster_const").MonsterSpawnRequest["options"]} options
     * @returns {boolean}
     */
    requestSpawn(options) {
        /** @type {import("../monster_const").MonsterSpawnRequest} */
        const payload = {
            monster: this,
            options,
            result: false,
        };
        eventBus.emit(event.Monster.In.SpawnRequest, payload);
        return payload.result;
    }

    /**
     * @param {number} amount
     * @param {CSPlayerPawn|null|undefined} attacker
     * @returns {number|void}
     */
    requestBeforeTakeDamage(amount, attacker) {
        /** @type {import("../monster_const").MonsterBeforeTakeDamageRequest} */
        const payload = {
            monster: this,
            amount,
            attacker: attacker ?? null,
            result: amount,
        };
        eventBus.emit(event.Monster.In.BeforeTakeDamageRequest, payload);
        return payload.result;
    }

    /**
     * @param {number} damage
     * @param {CSPlayerPawn} target
     */
    emitAttackEvent(damage, target) {
        /** @type {import("../monster_const").OnMonsterAttack} */
        const payload = { monster: this, damage, target };
        eventBus.emit(event.Monster.Out.OnAttack, payload);
    }

    /**
     * @param {Entity|null|undefined} killer
     */
    emitDeathEvent(killer) {
        /** @type {import("../monster_const").OnMonsterDeath} */
        const payload = { monster: this, killer, reward: this.baseReward };
        eventBus.emit(event.Monster.Out.OnMonsterDeath, payload);
    }

    /**
     * @param {Entity[]} allmpos
     * @param {CSPlayerPawn[]} allppos
     */
    tick(allmpos, allppos) {
        if (!this.model || !this.breakable?.IsValid()) return;
        if (this.state === MonsterState.DEAD) return;

        const now = Instance.GetGameTime();
        const dt = this.lasttick > 0 ? now - this.lasttick : 0;
        this.lasttick = now;

        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }

        if (dt > 0) {
            this.emitBuffEvent(MonsterBuffEvents.Tick, { dt, allmpos });
        }
        if (this.state === MonsterState.DEAD) return;

        this.emitEvent({ type: MonsterBuffEvents.Tick, dt, allmpos });
        this.skillsManager.tickRunningSkills();

        if (now - this.lastTargetUpdate > 3.0 || !this.target) {
            this.updateTarget(allppos);
            this.lastTargetUpdate = now;
        }
        if (!this.target) return;
        if (this.isOccupied()) return;

        const intent = this.evaluateIntent();
        this.resolveIntent(intent);
        this.animation.tick(this.state);
    }

    /**
     * @param {CSPlayerPawn[]} allppos
     */
    updateTarget(allppos) {
        const prevTarget = this.target;
        this.brainState.updateTarget(allppos);
        if (this.target !== prevTarget) {
            this.movementPath.onTargetChanged();
        }
    }

    isOccupied() {
        return this.animation.isOccupied();
    }

    /**
     * @param {MonsterRuntimeEvent} event
     */
    emitEvent(event) {
        this.skillsManager.emitEvent(event);
    }

    /**
     * @returns {number}
     */
    evaluateIntent() {
        return this.brainState.evaluateIntent();
    }

    /**
     * @param {number} intent
     */
    resolveIntent(intent) {
        this.brainState.resolveIntent(intent);
    }

    /**
     * @param {number} nextState
     * @returns {boolean}
     */
    trySwitchState(nextState) {
        return this.brainState.trySwitchState(nextState);
    }

    /**
     * @param {number} nextState
     * @returns {boolean}
     */
    applyStateTransition(nextState) {
        if (this.state === nextState) return true;
        if (this.state === MonsterState.DEAD) return false;
        if (this.isOccupied()) return false;
        if (!this.animation.canSwitch()) return false;

        const prevState = this.state;
        this.state = nextState;
        this.emitBuffEvent("OnStateChange", { oldState: prevState, nextState });
        this.animation.enter(nextState);

        if (nextState === MonsterState.CHASE || nextState === MonsterState.ATTACK) {
            this.movementPath.activate();
        } else if (prevState === MonsterState.CHASE || prevState === MonsterState.ATTACK) {
            this.movementPath.deactivate();
        }
        return true;
    }

    enterSkill() {
        this.movementPath.deactivate();
        this.animation.setOccupation("skill");
        this.skillsManager.triggerRequestedSkill();
    }

    enterAttack() {
        this.healthCombat.enterAttack();
    }

    /**
     * @param {Entity} ent
     * @returns {number}
     */
    distanceTosq(ent) {
        if(!this.model)return Infinity;
        const a = this.model.GetAbsOrigin();
        const b = ent.GetAbsOrigin();
        return vec$1.lengthsq(a, b);
    }

    /**
     * @param {string} type
     */
    onOccupationEnd(type) {
        this.animation.onOccupationEnd(type);
        this.movementPath.onOccupationChanged();
    }

    /**
     * @param {MonsterSkill} skill
     */
    requestSkill(skill) {
        this.skillsManager.requestSkill(skill);
    }

    /**
     * @param {MovementRequest} request
     * @returns {boolean}
     */
    submitMovementEvent(request) {
        switch (request?.type) {
            case MovementRequestType$1.Move:
                eventBus.emit(event.Movement.In.MoveRequest, request);
                return true;
            case MovementRequestType$1.Stop:
                eventBus.emit(event.Movement.In.StopRequest, request);
                return true;
            case MovementRequestType$1.Remove:
                eventBus.emit(event.Movement.In.RemoveRequest, request);
                return true;
            default:
                return false;
        }
    }

    /**
     * @param {{ mode: string; onGround: boolean; currentGoalMode: number | null; }} snapshot
     */
    updateMovementSnapshot(snapshot) {
        this.movementStateSnapshot = snapshot;
    }
}

/**
 * @module Buff 系统/配置
 */


/**
 * 玩家侧 Buff 运行时事件名。
 * 统一放在 Buff 常量模块，避免 Player 再维护一层薄包装组件。
 */
const PlayerBuffEvents = {
	Recompute: "OnRecompute",
	Die: "OnDeath",
	StateChange: "OnStateChange",
	BeforeTakeDamage: "OnDamage",
	Attack: "OnAttack",
	Tick: "OnTick",
};

/**
 * @typedef {Object} BuffConfig
 * @property {string} configid Buff 配置 id
 * @property {string} typeid Buff 种类
 * @property {Object} params Buff 参数
 */
/**
 * @typedef {Object} BuffAddRequest
 * @property {string} configid Buff 配置 id
 * @property {Monster|Player} target Buff 作用的目标
 * @property {string} targetType Buff 作用的目标类型
 * @property {number} result - 结果，返回buffid，失败返回-1
 */
/**
 * @typedef {Object} BuffRemoveRequest
 * @property {number} buffId Buff id
 * @property {boolean} result - 结果，成功返回true，失败返回false
 */
/**
 * @typedef {Object} BuffRefreshRequest
 * @property {number} buffId Buff id
 * @property {boolean} result - 结果，成功返回true，失败返回false
 */
/**
 * @typedef {Object} BuffEmitRequest
 * @property {number} buffId Buff id
 * @property {string} eventName 事件名称
 * @property {object} params - 事件参数
 * @property {object} result - 结果
 */
/**
 * @typedef {Object} OnBuffAdded
 * @property {number} buffId Buff id
 */
/**
 * @typedef {Object} OnBuffRefreshed
 * @property {number} buffId Buff id
 */
/**
 * @typedef {Object} OnBuffRemoved
 * @property {number} buffId Buff id
 */
//=====================预制buff配置====================
// Buff 构建参数的唯一来源。运行时只按 configid 查这里的预设，不接受外部附加参数。
/**@type {Record<string, BuffConfig>} */
const buffconfig={
	poison:{
		configid:"poison",
		typeid:"poison",
		params:{
			duration:1,
			tickInterval:0.5,
			dps:8,
		}
	},
	attack_up:{
		configid:"attack_up",
		typeid:"attack_up",
		params:{
			duration:30,
			multiplier:1.35,
		}
	},
	speed_up:{
		configid:"speed_up",
		typeid:"speed_up",
		params:{
			duration:5,
			multiplier:1.8,
			flatBonus:0,
		}
	},
	aaa:{
		configid:"aaa",
		typeid:"bbb",
		params:{}
	}
};

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

/**
 * @module 玩家系统/玩家常量配置
 */
/**
 * 玩家等级配置。
 *
 * 采用唯一的显式等级表作为真源：
 * - 每一级都必须手动填写完整配置。
 * - 经验语义：每升一级扣除当前等级所需经验，剩余经验继续向下一等级积累。
 * - 生命、攻击、暴击率、暴击伤害均为该等级的基础值。
 */
/**
 * 升级回血策略枚举。
 * @enum {string}
 */
const LevelUpHealPolicy = {
    NONE: "none",
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
 * 玩家职业配置。
 *
 * @typedef {object} PlayerProfessionConfig
 * @property {string} id
 * @property {string} displayName
 * @property {string | null} skillTypeId
 * @property {Record<string, any>} [skillParams]
 */

/** 默认职业。 */
const DEFAULT_PLAYER_PROFESSION = "guardian";

/** @type {Record<string, PlayerProfessionConfig>} */
const PLAYER_PROFESSIONS = {
    guardian: {
        id: "guardian",
        displayName: "守护者",
        skillTypeId: "player_guard",
        skillParams: {
            inputKey: "InspectWeapon",
            cooldown: 8,
            armor: 25,
        },
    },
    medic: {
        id: "medic",
        displayName: "医疗兵",
        skillTypeId: "player_mend",
        skillParams: {
            inputKey: "InspectWeapon",
            cooldown: 8,
            heal: 35,
        },
    },
    vanguard: {
        id: "vanguard",
        displayName: "先锋",
        skillTypeId: "player_vanguard",
        skillParams: {
            inputKey: "InspectWeapon",
            cooldown: 10,
            heal: 20,
            armor: 15,
        },
    },
};

/**
 * @param {string | null | undefined} professionId
 * @returns {PlayerProfessionConfig | null}
 */
function getPlayerProfessionConfig(professionId) {
    if (!professionId) return null;
    return PLAYER_PROFESSIONS[professionId] ?? null;
}

/**
 * @returns {string[]}
 */
function getPlayerProfessionIds() {
    return Object.keys(PLAYER_PROFESSIONS);
}

/**
 * 单个等级的配置。
 *
 * @typedef {object} LevelConfig
 * @property {number} level - 等级
 * @property {number} expRequired - 升到下一级所需经验，满级填 0
 * @property {number} maxHealth - 该等级的基础最大生命值
 * @property {number} attackScale - 该等级的基础攻击倍率
 * @property {number} critChance - 该等级的基础暴击率
 * @property {number} critMultiplier - 该等级的基础暴击伤害倍率
 * @property {string} healOnLevelUp - 升级回血策略，取值见 {@link LevelUpHealPolicy}
 */

/**
 * 默认升级回血策略
 */
const DEFAULT_LEVEL_UP_HEAL_POLICY = LevelUpHealPolicy.FULL;

/** @type {LevelConfig[]} */
const LEVEL_CONFIGS = [
    {
        level: 1,
        expRequired: 100,
        maxHealth: 100,
        attackScale: 1.0,
        critChance: 0.1,
        critMultiplier: 1.5,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
    {
        level: 2,
        expRequired: 150,
        maxHealth: 110,
        attackScale: 1.1,
        critChance: 0.105,
        critMultiplier: 1.52,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
    {
        level: 3,
        expRequired: 200,
        maxHealth: 120,
        attackScale: 1.2,
        critChance: 0.11,
        critMultiplier: 1.54,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
    {
        level: 4,
        expRequired: 250,
        maxHealth: 130,
        attackScale: 1.3,
        critChance: 0.115,
        critMultiplier: 1.56,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
    {
        level: 5,
        expRequired: 0,
        maxHealth: 140,
        attackScale: 1.4,
        critChance: 0.12,
        critMultiplier: 1.58,
        healOnLevelUp: DEFAULT_LEVEL_UP_HEAL_POLICY,
    },
];

/**
 * @module 玩家系统/玩家/组件/玩家数值
 */

const MAX_LEVEL = Math.max(LEVEL_CONFIGS.length, 1);

/**
 * 将数值先取整，再约束到给定区间内。
 * @param {number} value 原始数值。
 * @param {number} min 允许的最小值。
 * @param {number} max 允许的最大值。
 * @returns {number} 约束后的整数结果。
 */
function clampRounded(value, min, max) {
    return Math.max(min, Math.min(Math.round(value), Math.round(max)));
}

/**
 * 仅对正向收益应用倍率，负向扣减保持原值。
 * @param {number} amount 原始增减值。
 * @param {number} multiplier 正向收益倍率。
 * @returns {number} 应用倍率后的结果。
 */
function scalePositiveAmount(amount, multiplier) {
    return amount > 0 ? amount * multiplier : amount;
}

/**
 * 玩家数值组件。
 *
 * 负责维护玩家的核心成长与资源状态，包括：
 * - 等级、经验、升级后的基础属性刷新。
 * - 金钱、经验的增减与收益倍率结算。
 * - 血量、护甲等战斗资源的约束与重置。
 * - Buff 对派生属性的二次修正。
 *
 * 该组件只负责“数值本身”的维护；
 * 与引擎实体同步、死亡处理、Buff 生命周期等逻辑分别由其他组件承担。
 *
 * @navigationTitle 玩家数值组件
 */
class PlayerStats {
    /**
     * 创建玩家数值组件，并准备所有运行期字段。
     * @param {import("../player").Player} player 所属的玩家对象。
     */
    constructor(player) {
        this.player = player;

        const levelConfig = LEVEL_CONFIGS[0];

        // 等级与成长资源。
        this.level = 1;
        this.money = 0;
        this.exp = 0;

        // 战斗资源。
        this.baseMaxHealth = levelConfig.maxHealth;
        this.maxHealth = this.baseMaxHealth;
        this.health = this.maxHealth;
        this.armor = 0;

        // 输出属性。
        this.baseAttackScale = levelConfig.attackScale;
        this.attackScale = this.baseAttackScale;
        this.baseCritChance = levelConfig.critChance;
        this.critChance = this.baseCritChance;
        this.baseCritMultiplier = levelConfig.critMultiplier;
        this.critMultiplier = this.baseCritMultiplier;

        // 收益倍率。
        this.baseMoneyGain = 1;
        this.moneyGain = this.baseMoneyGain;
        this.baseExpGain = 1;
        this.expGain = this.baseExpGain;

        // 统计字段。
        this.score = 0;
        this.kills = 0;
        this.damageDealt = 0;
        this.headshots = 0;
        this.waveProgress = 0;

        this._initializeState();
    }

    // ——— 主 API ———

    /**
     * 增加金钱。正数视为奖励，负数会回落到扣钱逻辑。
     * @param {number} amount 要增加的金钱数量。
     * @returns {number} 实际变动后的金钱数量。
     */
    addMoney(amount) {
        if (amount < 0) {
            return this.deductMoney(-amount) ? -Math.round(-amount) : 0;
        }

        return this._applyRewardDelta("money", amount, this.moneyGain);
    }

    /**
     * 增加经验值，并在需要时连续升级。
     * @param {number} amount 要增加的经验值。
     * @returns {number} 实际变动后的经验值。
     */
    addExp(amount) {
        if (this.level >= MAX_LEVEL) {
            this.exp = 0;
            return 0;
        }

        const actual = this._applyRewardDelta("exp", amount, this.expGain);
        if (actual > 0) {
            this._applyPendingLevelUps();
        }

        return actual;
    }

    /**
     * 扣除指定金钱，余额不足时返回 false。
     * @param {number} amount 要扣除的金钱数量。
     * @returns {boolean} 是否扣除成功。
     */
    deductMoney(amount) {
        const roundedAmount = Math.max(0, Math.round(amount));
        if (!roundedAmount) return true;
        if (this.money < roundedAmount) return false;

        this.money -= roundedAmount;
        return true;
    }

    /**
     * 清空本局成长与统计数据，并回到 1 级初始状态。
     * @returns {void}
     */
    resetGameProgress() {
        this.level = 1;
        this.money = 0;
        this.exp = 0;
        this.score = 0;
        this.kills = 0;
        this.damageDealt = 0;
        this.headshots = 0;
        this.waveProgress = 0;

        this._resetIncomeModifiers();
        this.respawn();
    }

    /**
     * 按当前等级刷新基础属性，并通知 Buff 重算增益。
     * @param {number} [health] 重生后要设置的生命值，默认回到当前生命上限。
     * @param {number} [armor] 重生后要设置的护甲值，默认清零。
     * @returns {void}
     */
    respawn(health, armor) {
        this._refreshDerivedStats();
        this._setCombatResources(health ?? this.maxHealth, armor ?? 0);
        this._syncCombatState();
    }

    /**
     * 获取玩家当前数值快照。
     * @returns {any} 当前玩家的主要数值摘要。
     */
    getSummary() {
        return {
            name: this.player.entityBridge.getPlayerName(),
            slot: this.player.slot,
            level: this.level,
            money: this.money,
            health: this.health,
            maxHealth: this.maxHealth,
            armor: this.armor,
            attack: this.attackScale,
            attackScale: this.attackScale,
            critChance: this.critChance,
            critMultiplier: this.critMultiplier,
            kills: this.kills,
            score: this.score,
            exp: this.exp,
            expNeeded: this._getExpNeeded(),
        };
    }

    // ——— 兼容层：为了不改其他文件而保留 ———

    /**
     * 按当前等级重新计算派生属性，并保持当前生命与护甲在合法范围内。
     * @returns {void}
     */
    refreshLevelStats() {
        this._refreshDerivedStats();
        this._setCombatResources(this.health, this.armor);
    }

    /**
     * 重置当前战斗资源。
     * @param {number} [health] 要设置的生命值，默认回满到当前生命上限。
     * @param {number} [armor] 要设置的护甲值，默认清零。
     * @returns {void}
     */
    resetCombatResources(health, armor) {
        this._setCombatResources(health ?? this.maxHealth, armor ?? 0);
    }

    /**
     * 设置当前生命值，并约束到合法区间。
     * @param {number} value 目标生命值。
     * @returns {void}
     */
    setHealth(value) {
        this.health = clampRounded(value, 0, this.maxHealth);
    }

    /**
     * 设置当前最大生命值，并同步修正当前生命值。
     * @param {number} value 目标最大生命值。
     * @returns {void}
     */
    setMaxHealth(value) {
        this.maxHealth = Math.max(1, Math.round(value));
        this.setHealth(this.health);
    }

    /**
     * 设置当前护甲值，并约束到合法区间。
     * @param {number} value 目标护甲值。
     * @returns {void}
     */
    setArmor(value) {
        this.armor = clampRounded(value, 0, 100);
    }

    /**
     * 计算一次攻击伤害，并允许 Buff 参与最终修正。
     * @param {number} baseDamage 原始伤害值。
     * @returns {number} 结算后的最终伤害。
     */
    getAttackDamage(baseDamage) {
        const event = this._rollAttackDamage(baseDamage);
        this.player.emitBuffEvent(PlayerBuffEvents.Attack, event);
        event.damage = Math.max(0, Math.round(event.damage));
        return event.damage;
    }

    // ——— 等级链 ———

    /**
     * 获取当前等级对应的配置，不存在时回落到兜底配置。
     * @returns {import("../../player_const").LevelConfig} 当前等级配置。
     */
    _getCurrentLevelConfig() {
        const clampedLevel = Math.max(1, Math.min(this.level, MAX_LEVEL));
        return LEVEL_CONFIGS[clampedLevel - 1];
    }

    /**
     * 获取当前等级升到下一级所需经验。
     * @returns {number} 当前升级所需经验。
     */
    _getExpNeeded() {
        return this._getCurrentLevelConfig().expRequired;
    }

    /**
     * 在经验足够时连续执行升级，并处理升级后的生命值结算。
     * @returns {void}
     */
    _applyPendingLevelUps() {
        let didLevelUp = false;

        while (this.level < MAX_LEVEL) {
            const needed = this._getExpNeeded();
            if (needed <= 0 || this.exp < needed) break;

            const previousHealth = this.health;
            const previousMaxHealth = this.maxHealth;

            this.level++;
            this.exp = Math.max(0, Math.round(this.exp - needed));

            const levelConfig = this._getCurrentLevelConfig();
            this._refreshDerivedStats(levelConfig);
            this.health = this._resolveLevelUpHealth(previousHealth, previousMaxHealth, levelConfig);
            didLevelUp = true;
        }

        if (this.level >= MAX_LEVEL) {
            this.exp = 0;
        }

        if (didLevelUp) {
            this._syncCombatState();
        }
    }

    /**
     * 根据升级回血策略，结算升级后的生命值。
     * @param {number} previousHealth 升级前的生命值。
     * @param {number} previousMaxHealth 升级前的最大生命值。
     * @param {import("../../player_const").LevelConfig} levelConfig 新等级对应的配置。
     * @returns {number} 升级后的生命值。
     */
    _resolveLevelUpHealth(previousHealth, previousMaxHealth, levelConfig) {
        switch (levelConfig.healOnLevelUp ?? LevelUpHealPolicy.FULL) {
            case LevelUpHealPolicy.FULL:
                return this.maxHealth;
            case LevelUpHealPolicy.PRESERVE_RATIO: {
                const healthRatio = previousMaxHealth > 0 ? previousHealth / previousMaxHealth : 1;
                return clampRounded(healthRatio * this.maxHealth, 0, this.maxHealth);
            }
            case LevelUpHealPolicy.NONE:
            default:
                return clampRounded(previousHealth, 0, this.maxHealth);
        }
    }

    // ——— 派生属性链 ———

    /**
     * 按等级配置重建基础属性，并重新应用 Buff 的派生修正。
     * @param {import("../../player_const").LevelConfig} [levelConfig] 要应用的等级配置，默认使用当前等级。
     * @returns {void}
     */
    _refreshDerivedStats(levelConfig = this._getCurrentLevelConfig()) {
        this._applyLevelBaseConfig(levelConfig);
        this._resetDerivedStatsToBase();
        this._recomputeBuffModifiers();
    }

    /**
     * 将等级配置写入基础属性字段。
     * @param {import("../../player_const").LevelConfig} levelConfig 要应用的等级配置。
     * @returns {void}
     */
    _applyLevelBaseConfig(levelConfig) {
        this.baseMaxHealth = levelConfig.maxHealth;
        this.baseAttackScale = levelConfig.attackScale;
        this.baseCritChance = levelConfig.critChance;
        this.baseCritMultiplier = levelConfig.critMultiplier;
    }

    /**
     * 用基础属性覆盖当前派生属性，清掉上一轮 Buff 的改写结果。
     * @returns {void}
     */
    _resetDerivedStatsToBase() {
        this.maxHealth = this.baseMaxHealth;
        this.attackScale = this.baseAttackScale;
        this.critChance = this.baseCritChance;
        this.critMultiplier = this.baseCritMultiplier;
        this.moneyGain = this.baseMoneyGain;
        this.expGain = this.baseExpGain;
    }

    /**
     * 通知 Buff 重新计算派生属性，并重新约束当前生命与护甲。
     * @returns {void}
     */
    _recomputeBuffModifiers() {
        this.player.emitBuffEvent(PlayerBuffEvents.Recompute, { recompute: true });
        this.setHealth(this.health);
        this.setArmor(this.armor);
    }

    /**
     * 将金钱和经验收益倍率恢复为基础值。
     * @returns {void}
     */
    _resetIncomeModifiers() {
        this.moneyGain = this.baseMoneyGain;
        this.expGain = this.baseExpGain;
    }

    // ——— 资源链 ———

    /**
     * 初始化或重置数值组件的默认状态。
     * @returns {void}
     */
    _initializeState() {
        this.level = 1;
        this.baseMoneyGain = 1;
        this.baseExpGain = 1;

        const levelConfig = this._getCurrentLevelConfig();
        this._applyLevelBaseConfig(levelConfig);
        this._resetDerivedStatsToBase();

        this.health = this.maxHealth;
        this.armor = 0;

        this.money = 0;
        this.exp = 0;
        this.score = 0;
        this.kills = 0;
        this.damageDealt = 0;
        this.headshots = 0;
        this.waveProgress = 0;
    }

    /**
     * 同时设置当前生命和护甲。
     * @param {number} health 目标生命值。
     * @param {number} armor 目标护甲值。
     * @returns {void}
     */
    _setCombatResources(health, armor) {
        this.setHealth(health);
        this.setArmor(armor);
    }

    /**
     * 将当前生命、最大生命和护甲同步到引擎实体。
     * @returns {void}
     */
    _syncCombatState() {
        this.player.entityBridge.syncMaxHealth(this.maxHealth);
        this.player.entityBridge.syncHealth(this.health);
        this.player.entityBridge.syncArmor(this.armor);
    }

    /**
     * 对奖励类数值应用收益倍率后再落到具体字段上。
     * @param {"money"|"exp"} field 要修改的资源字段。
     * @param {number} amount 原始增减值。
     * @param {number} multiplier 要应用的收益倍率。
     * @returns {number} 实际生效的变动值。
     */
    _applyRewardDelta(field, amount, multiplier) {
        return this._applyRoundedDelta(field, scalePositiveAmount(amount, multiplier));
    }

    /**
     * 将数值变动写入指定字段，并保证结果不会小于 0。
     * @param {"money"|"exp"} field 要修改的资源字段。
     * @param {number} amount 要写入的增减值。
     * @returns {number} 实际生效的变动值。
     */
    _applyRoundedDelta(field, amount) {
        if (!amount) return 0;

        const oldValue = this[field];
        const nextValue = Math.max(0, Math.round(oldValue + amount));
        const actual = nextValue - oldValue;
        if (!actual) return 0;

        this[field] = nextValue;
        return actual;
    }

    // ——— 伤害链 ———

    /**
     * 按攻击倍率与暴击配置结算一次基础伤害。
     * @param {number} baseDamage 原始伤害值。
     * @returns {{damage: number, baseDamage: number, scaledDamage: number, critChance: number, critMultiplier: number, isCritical: boolean}} 本次伤害结算明细。
     */
    _rollAttackDamage(baseDamage) {
        const scaledDamage = Math.max(0, baseDamage * this.attackScale);
        const critChance = Math.max(0, Math.min(this.critChance, 1));
        const critMultiplier = Math.max(1, this.critMultiplier);
        const isCritical = critChance > 0 && Math.random() < critChance;

        return {
            damage: Math.max(0, Math.round(scaledDamage * (isCritical ? critMultiplier : 1))),
            baseDamage,
            scaledDamage: Math.max(0, Math.round(scaledDamage)),
            critChance,
            critMultiplier,
            isCritical,
        };
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
 * 2. 将伤害送入玩家 Buff 事件链（Buff 可减伤/增伤）。
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
        this.player.emitBuffEvent(PlayerBuffEvents.BeforeTakeDamage, ctx);
        damage = ctx.damage;

        if (damage <= 0) return false;
        // 优先扣护甲
        const armor = this.player.stats.armor;
        const damageToArmor = Math.min(armor, damage);
        const damageToHealth = damage - damageToArmor;
        // 扣护甲
        this.player.stats.setArmor(armor - damageToArmor);
        this.player.entityBridge.syncArmor(this.player.stats.armor);

        // 扣血后同步
        this.player.stats.setHealth(this.player.stats.health - damageToHealth);
        this.player.entityBridge.syncHealth(this.player.stats.health);

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
        this.player.emitBuffEvent(PlayerBuffEvents.Die, { killer });
        this.player.emitSkillEvent(SkillEvents.Die, { killer });
        this.player.stopInputTracking();

        // 切换到观察者
        this.player.entityBridge.joinTeam(1);

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
 * | `activate`    | Pawn 生成 / 激活       | 绑定 Pawn，发放装备，状态 → PREPARING |
 * | `disconnect`  | 玩家断开               | 清理 Buff，状态 → DISCONNECTED    |
 * | `handleDeath` | HealthCombat 判定死亡  | 切旁观者，状态 → DEAD             |
 * | `respawn`     | 重生触发               | 重置血量/护甲，并进入外部指定状态 |
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
        this.player.clearBuffs();
        stats.resetGameProgress();
        this.player.entityBridge.syncMaxHealth(stats.maxHealth);
        this.player.entityBridge.syncHealth(stats.health);
        this.player.entityBridge.syncArmor(stats.armor);
        this.player.applyStateTransition(PlayerState.PREPARING);
        this.player.rebindProfessionSkill();
        this.player.startInputTracking(this.player.entityBridge.pawn);
        this.player.emitSkillEvent(SkillEvents.Spawn, { state: PlayerState.PREPARING });
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
 * - `lifecycle`     – 连接、激活、重生、重置、断开时的状态转换。
 * - Buff 状态       – 由 Player 内部直接维护，并通过 eventBus 驱动全局 Buff 系统。
 *
 * 外部系统（如 PlayerManager）通过 Player 上的公开方法与组件交互，
 * Player 的生命周期事件统一由 PlayerManager 通过 eventBus 向外发出。
 *
 * 状态管理：所有状态变更必须经过 `applyStateTransition()` 统一入口，
 * 该方法会同步通知 Buff 系统，PlayerManager 再基于状态变化向外发出 eventBus 生命周期事件。
 *
 * @navigationTitle 玩家实体
 */
class Player {
    /**
     * @param {number} slot 引擎 PlayerSlot
     */
    constructor(slot) {
        /** @type {number} 引擎 PlayerSlot */
        this.slot = slot;

        /** @type {number} 玩家当前状态，取值见 {@link PlayerState} */
        this.state = PlayerState.DISCONNECTED;

        // 组件
        /** @type {PlayerEntityBridge} 引擎实体桥接组件 */
        this.entityBridge  = new PlayerEntityBridge(this);
        /** @type {PlayerStats} 玩家成长数据组件 */
        this.stats         = new PlayerStats(this);
        /** @type {PlayerHealthCombat} 生命/战斗组件 */
        this.healthCombat  = new PlayerHealthCombat(this);
        /** @type {PlayerLifecycle} 生命周期组件 */
        this.lifecycle     = new PlayerLifecycle(this);
        /**
         * key 为 buff 类型。
         * value 为 buff id。
         * @type {Map<string, number>}
         */
        this.buffMap = new Map();
        /** @type {Array<() => boolean>} */
        this._buffUnsubscribers = [
            eventBus.on(event.Buff.Out.OnBuffRemoved, (/** @type {import("../../buff/buff_const").OnBuffRemoved} */ payload) => {
                this._removeRuntimeByBuffId(payload.buffId);
            }),
        ];
        /** @type {string} */
        this.professionId = DEFAULT_PLAYER_PROFESSION;
        /** @type {number | null} */
        this.skillId = null;
        /** @type {string | null} */
        this.skillTypeId = null;
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
     * @param {number} targetState 激活后要进入的目标状态
     */
    activate(pawn, targetState) {
        this.lifecycle.activate(pawn, targetState);
    }

    /**
     * 重置处理（重生/换队），更新 Pawn 引用并恢复状态。
     * @param {import("cs_script/point_script").CSPlayerPawn} newPawn 新的 Pawn 实体
     * @param {number} respawnState 重生后要进入的目标状态
     */
    handleReset(newPawn, respawnState) {
        this.lifecycle.handleReset(newPawn, respawnState);
    }

    /**
     * 断开连接，清理资源。
     */
    disconnect() {
        this.lifecycle.disconnect();
        for (const unsubscribe of this._buffUnsubscribers) {
            unsubscribe();
        }
        this._buffUnsubscribers.length = 0;
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
     * @param {number} [targetState] 复活后要进入的目标状态
     */
    respawn(health, armor, targetState = PlayerState.PREPARING) {
        this.lifecycle.respawn(health, armor, targetState);
    }

    enterAliveState() {
        this.lifecycle.enterAliveState();
    }

    // ——— 成长入口（委托给 Stats） ———

    /**
     * 增加金钱。
     * @param {number} amount 金额
     * @returns {number}
     */
    addMoney(amount) {
        return this.stats.addMoney(amount);
    }

    /**
     * 增加经验值。
     * @param {number} amount 经验量
     * @returns {number}
     */
    addExp(amount) {
        return this.stats.addExp(amount);
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
     * 通过客户端命令给予玩家武器。
     * @param {string} weaponName
     * @returns {boolean}
     */
    giveWeapon(weaponName) {
        return this.entityBridge.clientCommand(`give ${weaponName}`);
    }

    // ——— Buff 入口（直接驱动全局 Buff 系统） ———

    /**
     * 添加指定类型的 Buff。
     * @param {string} typeId Buff 类型标识
     * @returns {boolean} 是否成功添加 Buff
     */
    addBuff(typeId) {
        if (this.buffMap.has(typeId)) return false;
        /** @type {import("../../buff/buff_const").BuffAddRequest} */
        const addRequest = {
            configid: typeId,
            target: this,
            targetType: "player",
            result: -1,
        };
        eventBus.emit(event.Buff.In.BuffAddRequest, addRequest);
        if (addRequest.result <= 0) return false;
        this.buffMap.set(typeId, addRequest.result);
        this.recomputeDerivedStats();
        return true;
    }

    /**
     * 移除指定类型的 Buff。
     * @param {string} typeId Buff 类型标识
     * @returns {boolean} 是否成功移除
     */
    removeBuff(typeId) {
        const id = this.buffMap.get(typeId);
        if (id == null) return false;
        /** @type {import("../../buff/buff_const").BuffRemoveRequest} */
        const removeRequest = {
            buffId: id,
            result: false,
        };
        eventBus.emit(event.Buff.In.BuffRemoveRequest, removeRequest);
        if (!removeRequest.result) return false;
        this.buffMap.delete(typeId);
        this.recomputeDerivedStats();
        return true;
    }

    /**
     * 刷新指定类型的 Buff；若不存在则尝试直接添加。
     * @param {string} typeId Buff 类型标识
     * @returns {boolean} 是否成功
     */
    refreshBuff(typeId) {
        const id = this.buffMap.get(typeId);
        if (id == null) return this.addBuff(typeId);
        /** @type {import("../../buff/buff_const").BuffRefreshRequest} */
        const refreshRequest = {
            buffId: id,
            result: false,
        };
        eventBus.emit(event.Buff.In.BuffRefreshRequest, refreshRequest);
        if (!refreshRequest.result) return false;
        this.recomputeDerivedStats();
        return true;
    }

    /**
     * 清空当前玩家身上的全部 Buff。
     */
    clearBuffs() {
        for (const [typeId] of this.buffMap.entries()) {
            this.removeBuff(typeId);
        }
    }

    /**
     * @param {number} buffId
     */
    _removeRuntimeByBuffId(buffId) {
        for (const [typeId, id] of this.buffMap.entries()) {
            if (id !== buffId) continue;
            this.buffMap.delete(typeId);
            this.recomputeDerivedStats();
            break;
        }
    }

    recomputeDerivedStats() {
        this.stats.refreshLevelStats();
        this.entityBridge.syncMaxHealth(this.stats.maxHealth);
        this.entityBridge.syncHealth(this.stats.health);
        this.entityBridge.syncArmor(this.stats.armor);
    }

    /**
     * 向当前玩家持有的所有 Buff 广播运行时事件。
     * @param {string} eventName 事件名
     * @param {any} params 事件参数
     */
    emitBuffEvent(eventName, params) {
        for (const id of this.buffMap.values()) {
            /** @type {import("../../buff/buff_const").BuffEmitRequest} */
            const emitRequest = {
                buffId: id,
                eventName,
                params,
                result: { result: false },
            };
            eventBus.emit(event.Buff.In.BuffEmitRequest, emitRequest);
        }
    }

    /**
     * @param {import("../../input/input_const").InputKey} key
     * @returns {boolean}
     */
    handleInputKey(key) {
        if (this.state !== PlayerState.ALIVE) return false;
        return this.emitSkillEvent(SkillEvents.Input, { key });
    }

    /**
     * @param {string} eventName
     * @param {Record<string, any>} [params]
     * @returns {boolean}
     */
    emitSkillEvent(eventName, params = {}) {
        if (this.skillId == null) return false;

        /** @type {import("../../skill/skill_const").SkillEmitRequest} */
        const emitRequest = {
            skillId: this.skillId,
            eventName,
            params,
            target: this,
            result: false,
        };
        eventBus.emit(event.Skill.In.SkillEmitRequest, emitRequest);
        return emitRequest.result;
    }

    /**
     * @param {CSPlayerPawn | null} [pawn]
     * @returns {boolean}
     */
    startInputTracking(pawn = this.entityBridge.pawn) {
        if (!(pawn instanceof CSPlayerPawn)) return false;

        /** @type {import("../../input/input_const").StartRequest} */
        const startRequest = {
            slot: this.slot,
            pawn,
            result: false,
        };
        eventBus.emit(event.Input.In.StartRequest, startRequest);
        return startRequest.result;
    }

    /**
     * @returns {boolean}
     */
    stopInputTracking() {
        /** @type {import("../../input/input_const").StopRequest} */
        const stopRequest = {
            slot: this.slot,
            result: false,
        };
        eventBus.emit(event.Input.In.StopRequest, stopRequest);
        return stopRequest.result;
    }

    /**
     * @param {string} professionId
     * @param {{ forceRecreate?: boolean; allowMissingPrevious?: boolean }} [options]
     * @returns {boolean}
     */
    setProfession(professionId, options = {}) {
        const config = getPlayerProfessionConfig(professionId);
        if (!config) return false;

        const forceRecreate = options.forceRecreate ?? false;
        const allowMissingPrevious = options.allowMissingPrevious ?? false;
        if (!forceRecreate && this.professionId === professionId && this.skillId != null) {
            return true;
        }

        let nextSkillId = null;
        if (config.skillTypeId) {
            nextSkillId = this._addSkillFromProfession(config);
            if (nextSkillId == null) return false;
        }

        const previousSkillId = this.skillId;
        if (previousSkillId != null) {
            const removed = this._removeSkillById(previousSkillId);
            if (!removed && !allowMissingPrevious) {
                if (nextSkillId != null) {
                    this._removeSkillById(nextSkillId);
                }
                return false;
            }
        }

        this.professionId = professionId;
        this.skillId = nextSkillId;
        this.skillTypeId = config.skillTypeId ?? null;
        return true;
    }

    /**
     * @returns {boolean}
     */
    ensureProfessionSkillBound() {
        return this.setProfession(this.professionId ?? DEFAULT_PLAYER_PROFESSION, {
            forceRecreate: this.skillId == null,
            allowMissingPrevious: true,
        });
    }

    /**
     * @returns {boolean}
     */
    rebindProfessionSkill() {
        return this.setProfession(this.professionId ?? DEFAULT_PLAYER_PROFESSION, {
            forceRecreate: true,
            allowMissingPrevious: true,
        });
    }

    /**
     * @param {boolean} [allowMissing=false]
     * @returns {boolean}
     */
    clearSkillBinding(allowMissing = false) {
        if (this.skillId == null) {
            this.skillTypeId = null;
            return true;
        }

        const currentSkillId = this.skillId;
        const removed = this._removeSkillById(currentSkillId);
        if (!removed && !allowMissing) return false;

        this.skillId = null;
        this.skillTypeId = null;
        return true;
    }

    /**
     * @param {import("../player_const").PlayerProfessionConfig} config
     * @returns {number | null}
     */
    _addSkillFromProfession(config) {
        if (!config.skillTypeId) return null;

        /** @type {import("../../skill/skill_const").SkillAddRequest} */
        const addRequest = {
            target: this,
            typeId: config.skillTypeId,
            params: {
                ...(config.skillParams ?? {}),
                professionId: config.id,
            },
            result: null,
        };
        eventBus.emit(event.Skill.In.SkillAddRequest, addRequest);
        return addRequest.result;
    }

    /**
     * @param {number} skillId
     * @returns {boolean}
     */
    _removeSkillById(skillId) {
        /** @type {import("../../skill/skill_const").SkillRemoveRequest} */
        const removeRequest = {
            skillId,
            target: this,
            result: false,
        };
        eventBus.emit(event.Skill.In.SkillRemoveRequest, removeRequest);
        return removeRequest.result;
    }

    // ——— 准备状态 ———

    /** @returns {boolean} */
    get isReady() {
        return this.state === PlayerState.READY;
    }

    /** @returns {boolean} */
    get isAlive() {
        return this.state === PlayerState.ALIVE;
    }

    /** @returns {boolean} */
    get isInGame() {
        return this.state >= PlayerState.PREPARING;
    }

    /**
     * 设置玩家准备状态。
     * @param {boolean} ready 是否准备
     * @returns {boolean}
     */
    setReady(ready) {
        if (ready && this.state === PlayerState.PREPARING) {
            this.applyStateTransition(PlayerState.READY);
            return true;
        } else if (!ready && this.state === PlayerState.READY) {
            this.applyStateTransition(PlayerState.PREPARING);
            return true;
        }
        return false;
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
        this.emitBuffEvent(PlayerBuffEvents.StateChange, { oldState, nextState });
        return true;
    }
    // ——— Tick ———
    /**
     * 每帧调度入口。
     */
    tick() {
        
        if (this.state === PlayerState.DISCONNECTED) return;
        if (this.state === PlayerState.DEAD) return;

        // 1. buff 计时 & 过期清理
        this.emitBuffEvent(PlayerBuffEvents.Tick, {});
        this.emitSkillEvent(SkillEvents.Tick, {});
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
 * @module 玩家系统/玩家管理器
 */

/**
 * @typedef {object} TP_playerRewardPayload - 玩家奖励分发载荷
 * @property {"buff"|"money"|"exp"|"heal"|"armor"|"damage"|"weapon"|"ready"|"respawn"|"resetGameStatus"} type - 奖励类型
 * @property {string} [buffTypeId] - Buff 类型 ID（仅 type="buff" 时适用）
 * @property {Record<string, any>} [params] - Buff 参数（仅 type="buff" 时适用）
 * @property {Record<string, any>|null} [source] - Buff 来源（仅 type="buff" 时适用）
 * @property {number} [amount] - 数值（仅 type="money"、"exp"、"heal"、"armor"、"damage" 时适用）
 * @property {string} [weaponName] - 武器名称（仅 type="weapon" 时适用）
 * @property {string} [reason] - 原因描述（仅 type="money"、"exp" 时适用）
 * @property {boolean} [isReady] - 准备状态（仅 type="ready" 时适用）
 * @property {number} [health] - 生命值（仅 type="respawn" 时适用）
 * @property {number} [armor] - 护甲值（仅 type="respawn" 时适用）
 * @property {number} [targetState] - 重生后的目标状态（仅 type="respawn" 时适用）
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
 * - 通过 eventBus 发出 Player.Out 生命周期事件，供其他模块编排。
 * - 提供查询方法：`getAllPlayers`、`getAlivePlayers`、`areAllPlayersReady` 等。
 *
 * 使用方式：先构造 `new PlayerManager()`；
 * 之后由 main.js 统一注册玩家相关脚本输入与引擎监听，再调用 `refresh()` 完成已有玩家同步，
 * 并在主循环中每帧调用 `tick()` 驱动所有玩家的持续逻辑。
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
        //this._statusTextCache = new Map();
        //this._tempDisableLogKeys = new Set();
        this.ingame = false;
        /** @type {Record<string, (player: Player, payload: TP_playerRewardPayload) => boolean>} */
        this._rewardHandlers = {
            buff: (player, payload) => {
                if (!payload.buffTypeId) return false;
                return player.addBuff(payload.buffTypeId);
            },
            money: (player, payload) => {
                return player.addMoney(payload.amount ?? 0) !== 0;
            },
            exp: (player, payload) => {
                return player.addExp(payload.amount ?? 0) !== 0;
            },
            heal: (player, payload) => {
                return player.heal(payload.amount ?? 0);
            },
            armor: (player, payload) => {
                return player.giveArmor(payload.amount ?? 0);
            },
            damage: (player, payload) => {
                player.takeDamage(payload.amount ?? 0, null);
                return true;
            },
            weapon: (player, payload) => {
                if (!payload.weaponName) return false;
                return player.giveWeapon(payload.weaponName);
            },
            ready: (player, payload) => {
                return this._setPlayerReady(player, payload.isReady ?? false);
            },
            respawn: (player, payload) => {
                player.respawn(
                    payload.health ?? 100,
                    payload.armor ?? 0,
                    payload.targetState ?? (this.ingame ? PlayerState.ALIVE : PlayerState.PREPARING)
                );
                return true;
            },
            resetGameStatus: (player) => {
                player.resetGameStatus();
                return true;
            }
        };
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Player.In.GetPlayerSummaryRequest, (payload = {}) => {
                payload.result = typeof payload.slot === "number"
                    ? this.getPlayerSummary(payload.slot)
                    : null;
            }),
            eventBus.on(event.Player.In.DispatchRewardRequest, (payload = {}) => {
                const rewards = Array.isArray(payload.rewards)
                    ? payload.rewards
                    : payload.reward
                        ? [payload.reward]
                        : [];
                const targetSlot = typeof payload.slot === "number"
                    ? payload.slot
                    : payload.slot == null
                        ? null
                        : null;

                payload.result = this.dispatchRewardRequest(targetSlot, rewards);
            })
        ];
    }
    /**
     * 所有类初始化完成后调用
     */
    refresh() {
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

    destroy() {
        for (const unsubscribe of this._unsubscribers) {
            unsubscribe();
        }
        this._unsubscribers.length = 0;
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
        if (existingPlayer) {
            if (existingPlayer.isReady) this.readyCount--;
            existingPlayer.disconnect();
            this.players.delete(slot);
            this.totalPlayers--;
        }

        const player = new Player(slot);
        player.connect(controller);
        this.players.set(slot, player);
        this.totalPlayers++;

        this._adapter.broadcast(`玩家 ${controller.GetPlayerName()} 加入游戏 (SLOT: ${slot})`);
        eventBus.emit(event.Player.Out.OnPlayerJoin, {
            player,
            slot,
        });

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
        if (!pawn) return;

        player.activate(pawn, this.ingame ? PlayerState.ALIVE : PlayerState.PREPARING);
    }

    /**
     * 玩家断开连接时调用，清理对应 Player 实例并更新计数。
     * @param {number} playerSlot 玩家槽位
     */
    handlePlayerDisconnect(playerSlot) {
        const player = this.players.get(playerSlot);
        if (!player) return;
        const wasReady = player.isReady;
        const wasLobbyState = player.state === PlayerState.PREPARING || player.state === PlayerState.READY;

        this._adapter.broadcast(`玩家 ${player.entityBridge.getPlayerName()} 离开游戏`);

        if (wasReady) {
            this.readyCount--;
        }

        player.disconnect();
        this.players.delete(playerSlot);
        this.totalPlayers--;

        eventBus.emit(event.Player.Out.OnPlayerLeave, {
            player,
            slot: playerSlot,
            wasReady,
            wasLobbyState,
        });

        if (wasLobbyState && this.areAllPlayersReady()) {
            eventBus.emit(event.Player.Out.OnAllPlayersReady, {
                readyCount: this.readyCount,
                totalPlayers: this.totalPlayers,
            });
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

            player.handleReset(pawn, this.ingame ? PlayerState.ALIVE : PlayerState.PREPARING);
            eventBus.emit(event.Player.Out.OnPlayerRespawn, {
                player,
                slot: controller.GetPlayerSlot(),
                pawn,
            });

        } else {
            // 全新未知玩家，走 connect + activate
            this.handlePlayerConnect(controller);
            this.handlePlayerActivate(controller);
        }
    }

    /**
     * 玩家死亡时调用，将玩家设为 DEAD 状态并触发死亡回调。
     * @param {CSPlayerPawn} playerPawn 玩家 Pawn 实体
     */
    handlePlayerDeath(playerPawn) {
        const controller = playerPawn.GetPlayerController();
        if (!controller) return;
        const slot = controller.GetPlayerSlot();
        const player = this.players.get(slot);
        if (!player) return;

        eventBus.emit(event.Player.Out.OnPlayerDeath, {
            player,
            slot,
            playerPawn,
        });
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
        const player = this.players.get(controller.GetPlayerSlot());
        if (!player) return;

        const parts = text.trim().toLowerCase().split(/\s+/);
        const command = parts[0];
        Number(parts[1]);

        if (command === "r" || command === "!r") {
            //玩家准备
            this._setPlayerReady(player, true);
            return;
        }

        if (command === "profession" || command === "!profession" || command === "class" || command === "!class") {
            const professionId = parts[1];
            if (!professionId) {
                this._adapter.sendMessage(player.slot, `可用职业: ${getPlayerProfessionIds().join(", ")}`);
                return;
            }

            const config = getPlayerProfessionConfig(professionId);
            if (!config) {
                this._adapter.sendMessage(player.slot, `未知职业 ${professionId}，可用职业: ${getPlayerProfessionIds().join(", ")}`);
                return;
            }

            const changed = this.setProfession(player.slot, professionId);
            this._adapter.sendMessage(
                player.slot,
                changed
                    ? `当前职业已切换为 ${config.displayName} (${config.id})`
                    : `职业切换失败：${config.displayName} (${config.id})`
            );
        }
    }

    /**
     * 引擎伤害事件前置拦截，若玩家已死亡则中止伤害。
     * @param {import("cs_script/point_script").ModifyPlayerDamageEvent} event 引擎伤害修改事件
     */
    handleBeforePlayerDamage(event) {

        return;
    }

    /**
     * 同步引擎侧伤害到脚本层，若第一次检测到死亡则触发死亡回调。
     * @param {import("cs_script/point_script").PlayerDamageEvent} event 引擎伤害事件
     */
    handlePlayerDamage(event) {
        const controller = event.player.GetPlayerController();
        if (!controller) return;
        const slot = controller.GetPlayerSlot();
        const player = this.players.get(slot);
        if (!player) return;

        player.syncDamageFromEngine(event.damage, event.attacker, event.inflictor);
    }

    /**
     * 由 main.js 转发 ready 脚本输入，切换玩家准备状态。
     * @param {CSPlayerPawn|undefined|null} pawn
     * @returns {boolean}
     */
    toggleReadyByPawn(pawn) {
        if (!(pawn instanceof CSPlayerPawn)) return false;
        const controller = pawn.GetPlayerController();
        if (!controller) return false;

        const player = this.players.get(controller.GetPlayerSlot());
        if (!player) return false;

        return this._setPlayerReady(player, !player.isReady);
    }

    /**
     * 统一更新玩家 ready 状态，并在成功切换后发出 Player.Out 事件。
     * @param {Player} player
     * @param {boolean} ready
     * @returns {boolean}
     */
    _setPlayerReady(player, ready) {
        if (!player.setReady(ready)) return false;

        if (ready) this.readyCount++;
        else this.readyCount--;

        const name = player.entityBridge.getPlayerName();
        this._adapter.broadcast(
            ready
                ? `${name} 已准备 (${this.readyCount}/${this.totalPlayers})`
                : `${name} 取消准备 (${this.readyCount}/${this.totalPlayers})`
        );
        eventBus.emit(event.Player.Out.OnPlayerReadyChanged, {
            player,
            slot: player.slot,
            ready,
            readyCount: this.readyCount,
            totalPlayers: this.totalPlayers,
        });

        if (ready && this.areAllPlayersReady()) {
            eventBus.emit(event.Player.Out.OnAllPlayersReady, {
                readyCount: this.readyCount,
                totalPlayers: this.totalPlayers,
            });
        }

        return true;
    }

    // ——— 兼容 API ———

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
     * @param {number} playerSlot
     * @param {string} professionId
     * @returns {boolean}
     */
    setProfession(playerSlot, professionId) {
        const player = this.players.get(playerSlot);
        if (!player) return false;
        return player.setProfession(professionId);
    }

    /**
     * @param {number} playerSlot
     * @param {import("../input/input_const").InputKey} key
     * @returns {boolean}
     */
    handleInput(playerSlot, key) {
        const player = this.players.get(playerSlot);
        if (!player) return false;
        return player.handleInputKey(key);
    }

    /**
     * @param {number} playerSlot
     * @returns {Player | null}
     */
    getPlayer(playerSlot) {
        return this.players.get(playerSlot) ?? null;
    }

    /**
     * @param {number} playerSlot
     * @returns {ReturnType<Player["getSummary"]> | null}
     */
    getPlayerSummary(playerSlot) {
        const player = this.getPlayer(playerSlot);
        return player ? player.getSummary() : null;
    }

    /**
     * @returns {Player[]}
     */
    getActivePlayers() {
        return Array.from(this.players.values());
    }

    /**
     * @returns {boolean}
     */
    hasAlivePlayers() {
        return this.getAlivePlayers().length > 0;
    }

    /**
     * 由 main.js 统一调度的玩家 Buff 应用入口。
     * PlayerManager 不主动决定何时发 Buff；它只负责在 main 给出最终结论后，
     * 把请求路由到对应 Player，并补齐当前目标玩家上下文。
     * @param {number|null} playerSlot null = 全体玩家
     * @param {string} typeId Buff 类型 ID
     * @returns {any}
     */
    applyBuff(playerSlot, typeId) {
        if (!typeId) return null;

        /** @type {any} */
        let appliedBuff = null;
        this._forEachTargetPlayer(playerSlot, (player) => {
            const buff = player.addBuff(typeId);
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
     * @returns {boolean}
     */
    dispatchReward(playerSlot, payload) {
        const handler = this._rewardHandlers[payload.type];
        if (!handler) return false;
        let allSucceeded = true;
        this._forEachTargetPlayer(playerSlot, (player) => {
            allSucceeded = handler(player, payload) && allSucceeded;
        });
        return allSucceeded;
    }

    /**
     * @param {number|null} playerSlot
     * @param {TP_playerRewardPayload[]} rewards
     * @returns {boolean}
     */
    dispatchRewardRequest(playerSlot, rewards) {
        if (!Array.isArray(rewards) || rewards.length === 0) return false;

        for (const reward of rewards) {
            if (!reward || typeof reward.type !== "string" || !this._rewardHandlers[reward.type]) {
                return false;
            }
        }

        const slots = playerSlot != null ? [playerSlot] : [...this.players.keys()];
        if (slots.length === 0) return false;

        for (const slot of slots) {
            if (!this.players.get(slot)) {
                return false;
            }
        }

        for (const reward of rewards) {
            const applied = this.dispatchReward(playerSlot, reward);
            if (!applied) {
                return false;
            }
        }

        return true;
    }

    enterGameStart() {
        this.ingame = true;
        this.readyCount = 0;
        for (const [, player] of this.players) {
            if (!player.entityBridge.pawn) continue;
            player.enterAliveState();
        }
    }

    resetAllGameStatus() {
        this.ingame = false;
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
     * 获取玩家统计概览（总数 / 已准备 / 存活）。
     * @returns {{total: number, ready: number, alive: number}}
     */
    getStats() {
        return {
            total: this.totalPlayers,
            ready: this.readyCount,
            alive: this.getAlivePlayers().length
        };
    }

    /**
     * 每帧驱动所有在线玩家的持续逻辑。
     */
    tick() {
        for (const [slot, player] of this.players) {
            player.tick();
        }
    }
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
 * @typedef {"W"|"A"|"S"|"D"|"Walk"|"Duck"|"Jump"|"Use"|"Attack"|"Attack2"|"Reload"|"ShowScores"|"InspectWeapon"} InputKey
 */
/**
 * @typedef {object} StartRequest
 * @property {number} slot - 玩家槽位
 * @property {import("cs_script/point_script").CSPlayerPawn} pawn - 玩家 Pawn 引用
 * @property {boolean} result - 输出参数，表示是否成功开始检测
 */
/**
 * @typedef {object} StopRequest
 * @property {number} slot - 玩家槽位
 * @property {boolean} result - 输出参数，表示是否成功停止检测
 */
/**
 * @typedef {object} OnInput
 * @property {number} slot - 玩家槽位
 * @property {InputKey} key - 本帧检测到的原始输入键名
 */
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
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Input.In.StartRequest, (/** @type {import("./input_const").StartRequest} */ payload) => {
                payload.result=this.start(payload);
            }),
            eventBus.on(event.Input.In.StopRequest, (/** @type {import("./input_const").StopRequest} */ payload) => {
                payload.result=this.stop(payload);
            })
        ];
    }
    /**
     * 启用输入检测
     * @param {import("./input_const").StartRequest} startRequest
     */
    start(startRequest)
    {
        const source = this._getOrCreateSource(startRequest.slot);
        source.pawn = startRequest.pawn;
        source.use = true;
        return true;
    }
    /**
     * 停止输入检测
     * @param {import("./input_const").StopRequest} stopRequest
     */
    stop(stopRequest)
    {
        const source = this._getOrCreateSource(stopRequest.slot);
        source.use = false;
        source.pawn = null;
        source.detector.reset();
        return true;
    }

    destroy() {
        for (const unsubscribe of this._unsubscribers) {
            unsubscribe();
        }
        this._unsubscribers.length = 0;
    }

    /**
     * 每 tick 轮询全部已注册输入源，逐个回调新按键。
     */
    tick() {
        for (const [slot, source] of this._sources) {
            if (!source.use) continue;
            const justPressed = source.detector.pollJustPressed(source.pawn);
            for (const key of justPressed) {
                /** @type {import("./input_const").OnInput} */
                const payload = {
                    slot,
                    key: /** @type {import("./input_const").InputKey} */ (key),
                };
                eventBus.emit(event.Input.Out.OnInput, payload);
            }
        }
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
 * @typedef {object} ShowHudRequest
 * @property {number} slot - 玩家槽位
 * @property {import("cs_script/point_script").CSPlayerPawn} pawn - 关联的玩家 Pawn
 * @property {string} text - HUD 显示内容
 * @property {number} channel - HUD 渠道
 * @property {boolean} result - 请求结果（是否成功提交）
 */
/**
 * @typedef {object} HideHudRequest
 * @property {number} slot - 玩家槽位
 * @property {number} [channel] - HUD 渠道
 * @property {boolean} result - 请求结果（是否成功提交）
 */
/**
 * @typedef {object} OnHudShown
 * @property {number} slot - 玩家槽位
 * @property {number} channel - 当前生效的 HUD 渠道
 * @property {string} text - 当前显示的 HUD 文本
 */
/**
 * @typedef {object} OnHudUpdated
 * @property {number} slot - 玩家槽位
 * @property {number} channel - 当前生效的 HUD 渠道
 * @property {string} text - 当前显示的 HUD 文本
 * @property {number} [previousChannel] - 更新前的 HUD 渠道
 */
/**
 * @typedef {object} OnHudHidden
 * @property {number} slot - 玩家槽位
 * @property {number} channel - 隐藏前的 HUD 渠道
 */

/**
 * @module 商店系统/商店常量
 */

/** @type {Record<string, string>} */
const RAW_KEY_TO_ACTION = {
    W: "up",
    S: "down",
    A: "page_prev",
    D: "page_next",
    Use: "confirm",
    Walk: "back",
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
    { id: "buff_attack", displayName: "强攻增益",   cost: 600,  requiredLevel: 2, payload: { type: "buff",  buffTypeId: "attack_up" } },
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
 * @property {number} purchasedAt
 * @property {ShopPlayerInfo} playerInfo
 */

/**
 * @typedef {object} ShopGrantResult
 * @property {boolean} success
 * @property {string} [message]
 */

/**
 * @typedef {object} ShopOpenRequest
 * @property {number} slot - 玩家槽位
 * @property {import("cs_script/point_script").CSPlayerPawn} pawn - 玩家 Pawn 引用
 * @property {boolean} result - 输出参数，表示是否成功打开商店
 */
/**
 * @typedef {object} ShopCloseRequest
 * @property {number} slot - 玩家槽位
 * @property {boolean} result - 输出参数，表示是否成功关闭商店
 */
/**
 * @typedef {object} OnShopOpen
 * @property {number} slot - 玩家槽位
 */
/**
 * @typedef {object} OnShopClose
 * @property {number} slot - 玩家槽位
 */
/**
 * @typedef {object} OnBought
 * @property {number} slot - 玩家槽位
 * @property {string} itemId - 购买的商品 id
 * @property {number} price - 本次购买价格
 * @property {ShopPurchaseContext} purchaseContext - 本次购买上下文
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
 * 商店会话本身不做按键检测，只接收抽象动作。
 * 玩家信息获取和奖励发放全部通过外部回调完成。
 *
 * @navigationTitle 商店会话
 */
class ShopSession {
    /**
     * @param {number} slot - 玩家槽位
    * @param {import("./shop_const").ShopItemConfig[]} items - 商品列表
     */
    constructor(slot, items) {
        /**
         * 玩家槽位。
         * @type {number} 
         */
        this.slot = slot;
        /** @type {import("./shop_const").ShopItemConfig[]} */
        this._items = items;
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
        this.selectedIndex = 0;
        this._lastMessage = "";
        this.state = ShopState.OPEN;
        this._refreshHud();
        /** @type {import("./shop_const").OnShopOpen} */
        const payload = { slot: this.slot};
        eventBus.emit(event.Shop.Out.OnShopOpen, payload);
    }

    /**
     * 关闭商店，禁用 HUD 并清空会话状态。
     */
    close() {
        if (this.state !== ShopState.OPEN) return false;

        /** @type {import("../hud/hud_const").HideHudRequest} */
        const hideHudRequest = { slot: this.slot, channel: CHANNAL.SHOP,result:false };
        eventBus.emit(event.Hud.In.HideHudRequest, hideHudRequest);
        this.state = ShopState.CLOSED;
        this._pawn = null;
        this._lastMessage = "";
        /** @type {import("./shop_const").OnShopClose} */
        const payload = { slot: this.slot };
        eventBus.emit(event.Shop.Out.OnShopClose, payload);
        return true;
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
     * @param {string} action - 定义的动作
     */
    handleAction(action) {
        if (this.state !== ShopState.OPEN) {
            return { result: ShopResult.SHOP_NOT_OPEN };
        }

        switch (action) {
            case RAW_KEY_TO_ACTION.W:
                this._moveSelection(-1);
                this._refreshHud();
                return;

            case RAW_KEY_TO_ACTION.S:
                this._moveSelection(1);
                this._refreshHud();
                return;

            case RAW_KEY_TO_ACTION.A:
                this._movePage(-1);
                this._refreshHud();
                return;

            case RAW_KEY_TO_ACTION.D:
                this._movePage(1);
                this._refreshHud();
                return;

            case RAW_KEY_TO_ACTION.Use:
                return this._tryPurchase();

            case RAW_KEY_TO_ACTION.Walk:
                this.close();
                return;

            default:
                return;
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
        const pageOffset = this.selectedIndex % SHOP_ITEMS_PER_PAGE;
        const nextPage = (currentPage + deltaPage + pageCount) % pageCount;
        const nextPageStart = nextPage * SHOP_ITEMS_PER_PAGE;
        const nextPageEnd = Math.min(nextPageStart + SHOP_ITEMS_PER_PAGE, this._items.length) - 1;
        this.selectedIndex = Math.min(nextPageStart + pageOffset, nextPageEnd);
    }

    _getPageCount() {
        return Math.max(1, Math.ceil(this._items.length / SHOP_ITEMS_PER_PAGE));
    }

    _getCurrentPageIndex() {
        return Math.floor(this.selectedIndex / SHOP_ITEMS_PER_PAGE);
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

        const info = this._requestPlayerInfo();
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
            purchasedAt: Instance.GetGameTime(),
            playerInfo: { ...info },
        };

        const rewardBuildResult = this._buildRewardPayload(item);
        if (!rewardBuildResult.reward) {
            this._lastMessage = rewardBuildResult.message ?? "购买失败";
            this._refreshHud();
            return { result: ShopResult.GRANT_FAILED, message: this._lastMessage };
        }

        const rewardGrantResult = this._dispatchRewards([
            rewardBuildResult.reward,
        ]);

        if (!rewardGrantResult.success) {
            this._lastMessage = rewardGrantResult.message ?? "购买失败";
            this._refreshHud();
            return { result: ShopResult.GRANT_FAILED, message: this._lastMessage };
        }

        const costGrantResult = this._dispatchRewards([
            { type: "money", amount: -ctx.price },
        ]);

        if (!costGrantResult.success) {
            this._lastMessage = costGrantResult.message ?? "扣费失败";
            this._refreshHud();
            return { result: ShopResult.GRANT_FAILED, message: this._lastMessage };
        }

        const grantResult = rewardGrantResult.message
            ? rewardGrantResult
            : costGrantResult;

        if (!grantResult.success) {
            this._lastMessage = grantResult.message ?? "购买失败";
            this._refreshHud();
            return { result: ShopResult.GRANT_FAILED, message: this._lastMessage };
        }

        this._lastMessage = grantResult.message ?? `购买成功: ${item.displayName}`;
        this._refreshHud();
        /** @type {import("./shop_const").OnBought} */
        const payload = { slot: this.slot, itemId: item.id, price: item.cost, purchaseContext: ctx };
        eventBus.emit(event.Shop.Out.OnBought, payload);
        return { result: ShopResult.SUCCESS, message: this._lastMessage };
    }

    /**
     * @returns {import("./shop_const").ShopPlayerInfo & { pawn?: import("cs_script/point_script").CSPlayerPawn | null } | null}
     */
    _requestPlayerInfo() {
        const payload = { slot: this.slot, result: null };
        eventBus.emit(event.Player.In.GetPlayerSummaryRequest, payload);
        return payload.result ?? null;
    }

    /**
     * @param {import("./shop_const").ShopItemConfig} item
     * @returns {{ reward: Record<string, any> | null, message?: string }}
     */
    _buildRewardPayload(item) {
        const payload = item.payload;
        if (!payload) {
            return { reward: null, message: "商品无效果定义" };
        }

        switch (payload.type) {
            case "heal":
                return { reward: { type: "heal", amount: payload.amount ?? 0 } };
            case "armor":
                return { reward: { type: "armor", amount: payload.amount ?? 0 } };
            case "buff":
                if (!payload.buffTypeId) {
                    return { reward: null, message: "商品无 Buff 定义" };
                }

                return {
                    reward: {
                        type: "buff",
                        buffTypeId: payload.buffTypeId,
                    },
                };
            case "money":
                return { reward: { type: "money", amount: payload.amount ?? 0 } };
            case "weapon":
                if (!payload.weaponName) {
                    return { reward: null, message: "商品无武器定义" };
                }

                return { reward: { type: "weapon", weaponName: payload.weaponName } };
            default:
                return { reward: null, message: `未知效果类型: ${payload.type}` };
        }
    }

    /**
     * @param {Record<string, any>[]} rewards
     * @returns {import("./shop_const").ShopGrantResult}
     */
    _dispatchRewards(rewards) {
        const payload = {
            slot: this.slot,
            rewards,
            result: false,
        };
        eventBus.emit(event.Player.In.DispatchRewardRequest, payload);

        if (!payload.result) {
            return { success: false, message: "奖励发放失败" };
        }

        const item = this._items[this.selectedIndex];
        return {
            success: true,
            message: item ? `购买成功: ${item.displayName}` : "购买成功",
        };
    }

    /**
     * 刷新 HUD 文本。
     *
     * 文案固定分为四段：玩家摘要、商店标题、商品列表、操作反馈/提示。
     */
    _refreshHud() {
        if (!this._pawn || this.state !== ShopState.OPEN) return;

        const info = this._requestPlayerInfo();

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
            const pageStart = this._getCurrentPageIndex() * SHOP_ITEMS_PER_PAGE;
            const pageEnd = Math.min(pageStart + SHOP_ITEMS_PER_PAGE, this._items.length);
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

        /** @type {import("../hud/hud_const").ShowHudRequest} */
        const payload = {
            slot: this.slot,
            pawn: this._pawn,
            text,
            channel: CHANNAL.SHOP,
            result:false
        };
        eventBus.emit(event.Hud.In.ShowHudRequest, payload);
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
            Instance.Msg(`[ShopManager] 玩家 Pawn 不存在，无法打开商店 (slot=${shopOpenRequest.slot})`);
            return false;
        }

        let session = this._sessions.get(shopOpenRequest.slot);
        if (!session) {
            session = new ShopSession(shopOpenRequest.slot, this._items);
            this._sessions.set(shopOpenRequest.slot, session);
        }

        session.open(shopOpenRequest.pawn);
        Instance.Msg(`[ShopManager] 商店已打开 (slot=${shopOpenRequest.slot})`);
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
        Instance.Msg(`[ShopManager] 商店已关闭 (slot=${shopCloseRequest.slot})`);
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
    }
}

/**
 * @module HUD系统/HUD管理器
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
         * @type {Map<number, import("./hud_const").HudSession>}
         */
        this._sessions = new Map();
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Hud.In.ShowHudRequest, (/** @type {import("./hud_const").ShowHudRequest} */ payload) => {
                payload.result=this.showHud(payload);
            }),
            eventBus.on(event.Hud.In.HideHudRequest, (/** @type {import("./hud_const").HideHudRequest} */ payload) => {
                payload.result=this.hideHud(payload);
            })
        ];
    }

    destroy() {
        for (const unsubscribe of this._unsubscribers) {
            unsubscribe();
        }
        this._unsubscribers.length = 0;
    }

    /**
     * 提交指定 channel 的显示请求，并重新仲裁当前应显示的内容。
     * @param {import("./hud_const").ShowHudRequest}showHudRequest
     */
    showHud(showHudRequest) {
        const session = this._getOrCreateSession(showHudRequest.slot);
        session.requests.set(showHudRequest.channel, { text: showHudRequest.text, pawn: showHudRequest.pawn });
        this._arbitrate(session);
        return true;
    }

    /**
     * 撤销指定 channel 的显示请求（或全部请求），并重新仲裁。
     *
     * @param {import("./hud_const").HideHudRequest} hideHudRequest
     */
    hideHud(hideHudRequest) {
        const session = this._sessions.get(hideHudRequest.slot);
        if (!session) return false;

        if (hideHudRequest.channel === undefined) {
            session.requests.clear();
        } else {
            session.requests.delete(hideHudRequest.channel);
        }
        this._arbitrate(session);

        return true;
    }

    /**
     * 每 tick 刷新全部可见 HUD 的贴脸位置。
     * @param {{ id: number; name: string; slot: number; level: number; money: number; health: number; maxHealth: number; armor: number; attack: number; critChance: number; critMultiplier: number; kills: number; score: number; exp: number; expNeeded: number; pawn: import("cs_script/point_script").CSPlayerPawn | null; }[]} [allAlivePlayersSummary=[]]
     */
    tick(allAlivePlayersSummary=[]) {
        for (const s of allAlivePlayersSummary) {
            if(!s.pawn)continue;
            const text = `Lv.${s.level} HP:${s.health}/${s.maxHealth} 护甲:${s.armor}\n$${s.money} 升级还需:${s.expNeeded - s.exp}EXP`;
            this.showHud({ slot: s.slot, pawn: s.pawn, text, channel: CHANNAL.STATUS, result: true });
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
     * @returns {import("./hud_const").HudSession}
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
     * @param {import("./hud_const").HudSession} session
     */
    _arbitrate(session) {
        // 找出最高优先级的活跃请求
        let winnerChannel = CHANNAL.NONE;
        for (const ch of session.requests.keys()) {
            if ((CHANNEL_PRIORITY[ch] ?? 0) > (CHANNEL_PRIORITY[winnerChannel] ?? 0)) {
                winnerChannel = ch;
            }
        }

        const previousChannel = session.activeChannel;
        const wasVisible = session.use;

        // 无活跃请求 → 隐藏 HUD
        if (winnerChannel === CHANNAL.NONE) {
            if (session.use) {
                this._hideEntity(session);
                /** @type {import("./hud_const").OnHudHidden} */
                const payload = {
                    slot: session.slot,
                    channel: previousChannel,
                };
                eventBus.emit(event.Hud.Out.OnHudHidden, payload);
            }
            session.activeChannel = CHANNAL.NONE;
            session.pawn = null;
            return;
        }

        const request = session.requests.get(winnerChannel);
        if(!request)return;
        const channelChanged = previousChannel !== winnerChannel;
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

        if (!wasVisible && session.use) {
            /** @type {import("./hud_const").OnHudShown} */
            const payload = {
                slot: session.slot,
                channel: winnerChannel,
                text: request.text,
            };
            eventBus.emit(event.Hud.Out.OnHudShown, payload);
        } else if ((channelChanged || textChanged || pawnChanged) && session.use) {
            /** @type {import("./hud_const").OnHudUpdated} */
            const payload = {
                slot: session.slot,
                channel: winnerChannel,
                text: request.text,
                previousChannel,
            };
            eventBus.emit(event.Hud.Out.OnHudUpdated, payload);
        }
    }

    /**
     * 确保 HUD 实体已创建。
     * @param {import("./hud_const").HudSession} session
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
     * @param {import("./hud_const").HudSession} session
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
     * @param {import("./hud_const").HudSession} session
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
 * 技能管理器。
 */
class SkillManager {
    constructor() {
        /**
         * key 为 skill id。
         * value 为 skill 实例。
         * @type {Map<number, SkillTemplate>}
         */
        this.SkillMap = new Map();
        this.id = 0;
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Skill.In.SkillAddRequest, (/** @type {import("./skill_const").SkillAddRequest} */ payload) => {
                payload.result = this.addSkill(payload.target, payload.typeId, payload.params);
            }),
            eventBus.on(event.Skill.In.SkillRemoveRequest, (/** @type {import("./skill_const").SkillRemoveRequest} */ payload) => {
                payload.result = this.deleteSkill(payload.skillId, payload.target ?? null);
            }),
            eventBus.on(event.Skill.In.SkillUseRequest, (/** @type {import("./skill_const").SkillUseRequest} */ payload) => {
                payload.result = this.useSkill(payload);
            }),
            eventBus.on(event.Skill.In.SkillEmitRequest, (/** @type {import("./skill_const").SkillEmitRequest} */ payload) => {
                payload.result = this.emitEvent(payload.skillId, payload.eventName, payload.params, payload.target ?? null);
            })
        ];
    }

    destroy()
    {
        for (const unsubscribe of this._unsubscribers) {
            unsubscribe();
        }
        this._unsubscribers.length = 0;
        this.clearAll();
    }

    /**
     * @param {SkillTemplate} skill
     * @param {Player|Monster|null} target
     * @returns {boolean}
     */
    _matchTarget(skill, target)
    {
        if (target == null) return true;
        return skill.player === target || skill.monster === target;
    }

    /**
     * @param {Player|Monster} target
     * @param {string} typeid 技能类型标识（如 "corestats"、"pounce"）
     * @param {any} params
     * @returns {number|null} 返回 skill 的 id，如果创建失败则返回 null
     */
    addSkill(target,typeid,params)
    {
        const skill = SkillFactory.create(target instanceof Player ? target : null, target instanceof Monster ? target : null, typeid, this.id++, params);
        if(skill)
        {
            this.SkillMap.set(skill.id, skill);
            skill.onSkillAdd();
            return skill.id;
        }
        return null;
    }

    /**
     * @param {number} skillId
     * @param {Player|Monster|null} [target]
     * @returns {boolean}
     */
    deleteSkill(skillId, target = null)
    {
        const skill = this.SkillMap.get(skillId);
        if (skill === undefined) return false;
        if (!this._matchTarget(skill, target)) return false;
        skill.onSkillDelete();
        this.SkillMap.delete(skillId);
        return true;
    }

    /**
     * @param {import("./skill_const").SkillUseRequest} skillUseRequest
     * @returns {boolean}
     */
    useSkill(skillUseRequest)
    {
        const skill = this.SkillMap.get(skillUseRequest.skillId);
        if (skill === undefined) return false;
        if (!this._matchTarget(skill, skillUseRequest.target)) return false;
        skill.trigger();
        return true;
    }

    tick()
    {
        for(const [skillId,skill] of this.SkillMap)
        {
            if(skill.monster==null&&skill.player==null)
            {
                this.SkillMap.delete(skillId);
                continue;
            }
            skill.tick();
        }
    }

    clearAll()
    {
        for(const skill of this.SkillMap.values())
        {
            skill.onSkillDelete();
        }
        this.SkillMap.clear();
    }
    /**
     * @param {number} skillId
     * @param {string} event 
     * @param {import("./skill_const").EmitEventPayload} payload
     * @param {Player|Monster|null} [target]
     * @returns {boolean}
     */
    emitEvent(skillId,event,payload,target = null)
    {
        const skill = this.SkillMap.get(skillId);
        if (skill === undefined) return false;
        if (!this._matchTarget(skill, target)) return false;
        skill._emitEvent(event, payload);
        return true;
    }
}

/**
 * @module 怪物系统/怪物管理器
 */
class MonsterManager {
    constructor() {
        /**
         * 所有怪物实例映射表（id → Monster）。由 SpawnService 添加，LifecycleService 移除。
         * @type {Map<number,Monster>}
         */
        this.monsters = new Map();
        /** 下一个怪物 ID。单调递增，不会回收。
         * @type {number} */
        this.nextMonsterId = 1;
        /** 当前活跃怪物计数。由 lifecycle recordSpawn/recordDeath 更新。
         * @type {number} */
        this.activeMonsters = 0;
        /** 累计击杀数。
         * @type {number} */
        this.totalKills = 0;

        /**
         * 当前波次可用的生成点实体列表。由 `spawnWave` 按配置名称查找并填充，
         * 每次新波次开始时清空重建。
         * @type {Entity[]}
         */
        this.spawnPoints = [];
        /** 上一次成功生成怪物的游戏时间。初始值 -1 表示本波尚未生成过。由 `tick` 更新。 */
        this.spawnpretick = -1;
        /** 当前波次已生成的怪物数量。达到 `spawnconfig.totalMonsters` 时自动停止。由 `tick` 递增。 */
        this.spawnmonstercount = 0;
        /** 当前是否正在刷怪。`spawnWave` 设为 true，`stopWave` 或达到总数时设为 false。 */
        this.spawn = false;
        /**
         * 当前波次的配置数据。由 `spawnWave` 设置，`tick` 和 `spawnMonster` 读取。
         * @type {import("../util/definition").waveConfig | null}
         */
        this.spawnconfig = null;
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Monster.Out.OnMonsterDeath, (/** @type {import("./monster_const").OnMonsterDeath} */ payload) => {
                this.handleMonsterDeath(payload.monster, payload.killer);
            }),
            eventBus.on(event.Monster.In.SpawnRequest, (/** @type {import("./monster_const").MonsterSpawnRequest} */ payload) => {
                payload.result = this.spawnByother(payload.monster, payload.options);
            })
        ];
    }
    /**
     * @param {Monster} monsterInstance 死亡怪物实例
     * @param {import("cs_script/point_script").Entity|null|undefined} killer 击杀者
     */
    handleMonsterDeath(monsterInstance, killer) {
        const monsterId = monsterInstance.id;
        if (!this.monsters.has(monsterId)) return;
        this.activeMonsters = Math.max(0, this.activeMonsters - 1);
        this.totalKills++;
        this.monsters.delete(monsterId);
        if(this.spawnconfig && this.activeMonsters==0 && this.spawnmonstercount>=this.spawnconfig.totalMonsters) {
            eventBus.emit(event.Monster.Out.OnAllMonstersDead, {});
        }
    }
    /**
     * 重置游戏
     */
    resetAllGameStatus() {
        this.nextMonsterId = 1;
        this.spawnPoints = [];
        this.spawnpretick = -1;
        this.spawnmonstercount = 0;
        this.spawn = false;
        this.spawnconfig=null;

        for (const [id, monster] of this.monsters) {
            monster.die(null);//会走handleMonsterDeath，自动从映射表删除
        }

        this.activeMonsters = 0;
        this.totalKills = 0;

        this.monsters = new Map();
    }
    /**
     * 每帧主循环。依次：刷新上下文 → 怪物 tick → 刷怪 tick。
     * 移动的实际推进由 main 在 tick 后统一执行。
     *
     * 返回的 tickContext 是内部复用对象，调用方只读。
     * @param {Entity[]} allmEntities 
     * @param {CSPlayerPawn[]} allppos
     */
    tick(allmEntities,allppos)
    {
        const now=Instance.GetGameTime();
        for (const [id, monster] of this.monsters) {
            monster.tick(allmEntities,allppos);
        }
        this.spawntick(now);
    }
    /**
     * @param {number} now
     */
    spawntick(now)
    {
        if (!this.spawn||!this.spawnconfig) return;
        if (this.spawnmonstercount >= this.spawnconfig.totalMonsters) return this.stopWave();
        if (now - this.spawnpretick < this.spawnconfig.spawnInterval) return;
        if (this.activeMonsters >= this.spawnconfig.aliveMonster) return;
        const monster = this.spawnMonster(this.spawnconfig);
        if (monster) {
            this.spawnmonstercount++;
            this.spawnpretick = now;
            if (this.spawnmonstercount >= this.spawnconfig.totalMonsters) return this.stopWave();
        }
    }
    /**
     * @param {number} monsterId
     * @param {string} typeId
     * @param {Record<string, any>} params
     */
    applyBuff(monsterId,typeId, params) {
        if (!typeId) return null;
        const monster = this.monsters.get(monsterId);
        if (!monster) return null;
        return monster.addBuff(typeId);
    }

    /**
     * @returns {Monster[]}
     */
    getActiveMonsters() {
        return Array.from(this.monsters.values());
    }

    /**
     * @param {Map<Entity, {mode: string, onGround: boolean, currentGoalMode: number|null}>} movementStates
     */
    syncMovementStates(movementStates) {
        for (const monster of this.monsters.values()) {
            const model = monster.model;
            if (!model) continue;
            const snapshot = movementStates.get(model);
            if (!snapshot) continue;
            monster.updateMovementSnapshot(snapshot);
        }
    }

    /**
     * 获取管理器状态快照。
     * @returns {{totalMonsters: number, activeMonsters: number, nextId: number, totalKills: number}}
     */
    getStatus() {
        return {
            totalMonsters: this.monsters.size,
            activeMonsters: this.activeMonsters,
            nextId: this.nextMonsterId,
            totalKills: this.totalKills
        };
    }
    /**
     * 启动一个新波次的刷怪流程。
     *
     * 重置计数器与生成点列表，按配置中的 `monster_spawn_points_name` 查找地图实体，
     * 之后每帧由 `tick` 按间隔和存活上限驱动实际生成。
     *
     * @param {import("../util/definition").waveConfig} waveConfig 波次配置，包含怪物总数、间隔、生成点名称等
     */
    spawnWave(waveConfig) {
        if (!waveConfig || waveConfig.totalMonsters <= 0) return;
        this.spawnpretick = -1;
        this.spawnmonstercount = 0;
        this.spawn = true;
        this.spawnconfig = waveConfig;
        this.spawnPoints = [];
        const spawnPointNames = waveConfig.monster_spawn_points_name;
        spawnPointNames.forEach((/** @type {string} */ name) => {
            const found = Instance.FindEntitiesByName(name);
            this.spawnPoints.push(...found);
        });
    }

    /**
     * 停止当前波次的刷怪。将 `spawn` 标记设为 false，`tick` 不再生成新怪物。
     * 已生成的怪物不受影响。
     */
    stopWave() {
        this.spawn = false;
    }
    /**
     * 在随机生成点创建一只怪物。
     *
     * 流程：
     * 1. 若启用了 `spawnPointsDistance`，从生成点中筛选出离玩家足够近的子集。
     * 2. 随机选取一个生成点，用包围盒射线检测碰撞遮挡。
     * 3. 按怪物 ID 轮询选取怪物类型配置。
     * 4. 调用 `createMonster` 完成实际创建与注册。
     *
     * @param {import("../util/definition").waveConfig} waveConfig 当前波次配置
     * @returns {Monster|null} 成功返回怪物实例，失败返回 null
     */
    spawnMonster(waveConfig) {
        try {
            if (this.spawnPoints.length === 0) {
                const spawnPointNames = waveConfig.monster_spawn_points_name;
                spawnPointNames.forEach((/** @type {string} */ name) => {
                    const found = Instance.FindEntitiesByName(name);
                    this.spawnPoints.push(...found);
                });
                if (this.spawnPoints.length === 0)
                {   
                    Instance.Msg("错误: 未找到怪物生成点");
                    return null;
                }
            }
            let nearbySpawnPoints = this.spawnPoints;
            if (spawnPointsDistance > 0) ;
            if (nearbySpawnPoints.length === 0) {
                Instance.Msg("错误: 未找到怪物生成点");
                return null;
            }
            const spawnPoint = nearbySpawnPoints[Math.floor(Math.random() * nearbySpawnPoints.length)];
            const pos = spawnPoint.GetAbsOrigin();
            const start = { x: pos.x, y: pos.y, z: pos.z + 50 };
            const end = { x: pos.x, y: pos.y, z: pos.z + 50 };
            if (Instance.TraceSphere({ radius:30, start, end, ignorePlayers: true }).hitEntity) {
                Instance.Msg("错误: 生成点有遮挡");
                return null;
            }
            const typeConfig = this.getMonsterType(waveConfig, this.nextMonsterId-1);
            const monster = this.createMonster(typeConfig, end);
            if (!monster) return null;
            Instance.Msg(`生成怪物 #${monster.id} ${monster.type} HP:${monster.health}`);
            return monster;
        } catch (error) {
            Instance.Msg(`生成怪物失败: ${error}`);
            return null;
        }
    }

    /**
     * 由其他情况触发的怪物产卵。在施法者周围随机位置尝试生成一只指定类型的怪物。
     *
     * 在 `radiusMin`~`radiusMax` 范围内随机采样位置，最多尝试 `tries` 次，
     * 每次用包围盒检测碰撞遮挡，通过后调用 `createMonster` 创建。
     *
     * @param {Monster} caster 施法者怪物，用于获取中心坐标和默认类型
     * @param {{typeName?:string,radiusMin?:number,radiusMax?:number,tries?:number}} options 产卵选项
     * @returns {boolean} 是否成功生成
     */
    spawnByother(caster, options) {
        options = options || {};
        const typeName = options.typeName ?? caster.type;
        const typeConfig = this.findMonsterTypeByName(typeName);
        if (!typeConfig) {
            Instance.Msg(`技能产卵失败: 未找到怪物类型 ${typeName}`);
            return false;
        }
        if (!caster.model || !caster.model.IsValid()) return false;

        const center = caster.model.GetAbsOrigin();
        const radiusMin = Math.max(0, options.radiusMin ?? 24);
        const radiusMax = Math.max(radiusMin, options.radiusMax ?? 96);
        const tries = Math.max(1, options.tries ?? 6);
        const mins = this.spawnconfig?.monster_breakablemins ?? { x: -30, y: -30, z: -30 };
        const maxs = this.spawnconfig?.monster_breakablemaxs ?? { x: 30, y: 30, z: 30 };

        for (let i = 0; i < tries; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = radiusMin + Math.random() * (radiusMax - radiusMin);
            const pos = {
                x: center.x + Math.cos(angle) * dist,
                y: center.y + Math.sin(angle) * dist,
                z: center.z
            };
            const start = { x: pos.x, y: pos.y, z: pos.z + 45 };
            const end = { x: pos.x, y: pos.y, z: pos.z + 50 };
            if (Instance.TraceBox({ mins, maxs, start, end, ignorePlayers: true }).hitEntity) continue;
            const monster = this.createMonster(typeConfig, end);
            if (!monster) return false;
            Instance.Msg(`技能产卵成功 #${monster.id} ${monster.type}`);
            return true;
        }

        return false;
    }

    /**
     * 创建一只怪物并完成全部注册流程。
     *
    * 依次执行：分配全局递增 ID → 工厂创建实例 →
     * 注册到 monsters 映射表 → 发布生成事件。
     *
     * @param {import("../util/definition").monsterTypes} typeConfig 怪物类型配置
     * @param {import("cs_script/point_script").Vector} position 生成世界坐标
     * @returns {Monster} 创建好的怪物实例
     */
    createMonster(typeConfig, position) {
        const monsterId = this.nextMonsterId++;
        const monster = new Monster(monsterId, position, typeConfig);
        if(!monster)return monster;
        this.monsters.set(monsterId, monster);
        /** @type {import("./monster_const").OnMonsterSpawn} */
        const payload = { monster };
        eventBus.emit(event.Monster.Out.OnMonsterSpawn, payload);
        this.activeMonsters++;
        monster.init();
        return monster;
    }

    /**
     * 在当前波次配置的怪物类型列表中按名称查找配置。
     * @param {string} typeName 要查找的怪物名称
     * @returns {import("../util/definition").monsterTypes|null} 找到的配置，未找到返回 null
     */
    findMonsterTypeByName(typeName) {
        for (const [name, data] of Object.entries(MonsterType)) {
            if (name == typeName) return data;
        }
        return null;
    }

    /**
     * 按怪物 ID 轮询选取波次中的怪物类型配置（取模分配）。
     * @param {import("../util/definition").waveConfig} waveConfig 波次配置
     * @param {number} monsterId 怪物全局 ID
     * @returns {import("../util/definition").monsterTypes}
     */
    getMonsterType(waveConfig, monsterId) {
        const typeIndex = monsterId % waveConfig.monsterTypes.length;
        return waveConfig.monsterTypes[typeIndex];
    }
}

class BuffTemplate{
    /**
     * @param {number}id
     * @param {import("../monster/monster/monster").Monster|import("../player/player/player").Player} target Buff 作用的目标
     * @param {string} targetType Buff 目标类型
     * @param {string} typeId Buff 类型标识
     * @param {Record<string, any>} params Buff 运行参数
     */
    constructor(id, target, targetType, typeId, params)
    {
        this.id = id;
        this.target = target;
        this.targetType = targetType;
        this.typeId = typeId;
        this.duration = params.duration;
        this.params = { ...(params ?? {}) };
        this.startTime = Instance.GetGameTime();
        this.use = false;
    }
    tick()
    {
        const currentTime=Instance.GetGameTime();
        if(this.duration!==-1 && currentTime-this.startTime>=this.duration)this.stop();
    }
    start()
    {
        if (this.use) return false;
        this.use = true;
        this.startTime = Instance.GetGameTime();
        /** @type {import("./buff_const").OnBuffAdded} */
        const payload = { buffId: this.id };
        eventBus.emit(event.Buff.Out.OnBuffAdded, payload);
        return true;
    }
    stop()
    {
        if (!this.use) return false;
        this.use = false;
        /** @type {import("./buff_const").OnBuffRemoved} */
        const payload = { buffId: this.id };
        eventBus.emit(event.Buff.Out.OnBuffRemoved, payload);
        return true;
    }
    refresh()
    {
        if (typeof this.params.duration === "number") {
            this.duration = this.params.duration;
        }
        this.startTime = Instance.GetGameTime();
        /** @type {import("./buff_const").OnBuffRefreshed} */
        const payload = { buffId: this.id };
        eventBus.emit(event.Buff.Out.OnBuffRefreshed, payload);
        return true;
    }
    /**
     * 事件对外接口
     */
    /**
     * 目标每tick调用
     * @param {string} eventName
     * @param {any} params
     */
    OnBuffEmit(eventName,params)
    {
        return {result:false};
    }
}

class PoisonBuff extends BuffTemplate {
    /**
     * @param {number} id
     * @param {import("../../monster/monster/monster").Monster|import("../../player/player/player").Player} target
     * @param {string} targetType
     * @param {{ duration?: number; tickInterval?: number; dps?: number }} [params]
     */
    constructor(id, target, targetType, params = {}) {
        super(id, target, targetType, "poison", params);
        this.duration = typeof params.duration === "number" ? params.duration : 1;
        this.tickInterval = Math.max(0.1, typeof params.tickInterval === "number" ? params.tickInterval : 0.5);
        this.dps = Math.max(0, typeof params.dps === "number" ? params.dps : 8);
        this._nextTickTime = Instance.GetGameTime() + this.tickInterval;
    }

    start() {
        const started = super.start();
        if (!started) return false;
        this._nextTickTime = Instance.GetGameTime() + this.tickInterval;
        return true;
    }

    refresh() {
        const refreshed = super.refresh();
        if (!refreshed) return false;
        this._nextTickTime = Instance.GetGameTime() + this.tickInterval;
        return true;
    }

    tick() {
        if (!this.use) return;
        if (!this._isTargetAlive()) {
            this.stop();
            return;
        }

        super.tick();
        if (!this.use) return;

        const now = Instance.GetGameTime();
        while (this.use && now >= this._nextTickTime) {
            this._applyTickDamage(this.tickInterval);
            this._nextTickTime += this.tickInterval;
        }
    }

    /**
     * @param {string} eventName
     * @param {{ nextState?: number }} [params]
     */
    OnBuffEmit(eventName, params = {}) {
        if (eventName === "OnDeath") {
            this.stop();
            return { result: true };
        }

        if (eventName === "OnStateChange") {
            if (this.targetType === "player" && params.nextState === PlayerState.DEAD) {
                this.stop();
                return { result: true };
            }
            if (this.targetType === "monster" && params.nextState === MonsterState.DEAD) {
                this.stop();
                return { result: true };
            }
        }

        return { result: false };
    }

    /**
     * @param {number} intervalSeconds
     */
    _applyTickDamage(intervalSeconds) {
        const damage = this.dps * intervalSeconds;
        if (damage <= 0) return;

        if (this.targetType === "player") {
            this.target.takeDamage(damage, null);
        } else if (this.targetType === "monster") {
            this.target.takeDamage(damage, null, { reason: "poison" });
        }

        if (!this._isTargetAlive()) {
            this.stop();
        }
    }

    _isTargetAlive() {
        if (!this.target) return false;
        if (this.targetType === "player") {
            return this.target.state !== PlayerState.DEAD && this.target.state !== PlayerState.DISCONNECTED;
        }
        if (this.targetType === "monster") {
            return this.target.state !== MonsterState.DEAD;
        }
        return false;
    }
}

class AttackUpBuff extends BuffTemplate {
    /**
     * @param {number} id
     * @param {import("../../player/player/player").Player} target
     * @param {string} targetType
     * @param {{ duration?: number; multiplier?: number }} [params]
     */
    constructor(id, target, targetType, params = {}) {
        super(id, target, targetType, "attack_up", params);
        this.duration = typeof params.duration === "number" ? params.duration : 30;
        this.multiplier = typeof params.multiplier === "number" ? params.multiplier : 1.35;
    }

    /**
     * @param {string} eventName
     */
    OnBuffEmit(eventName) {
        if (eventName !== "OnRecompute") {
            return { result: false };
        }
        if (this.targetType !== "player") {
            return { result: false };
        }

        const player = /** @type {import("../../player/player/player").Player} */ (this.target);
        player.stats.attackScale *= this.multiplier;
        return { result: true };
    }
}

class SpeedUpBuff extends BuffTemplate {
    /**
     * @param {number} id
     * @param {import("../../monster/monster/monster").Monster} target
     * @param {string} targetType
     * @param {{ duration?: number; multiplier?: number; flatBonus?: number }} [params]
     */
    constructor(id, target, targetType, params = {}) {
        super(id, target, targetType, "speed_up", params);
        this.duration = typeof params.duration === "number" ? params.duration : 5;
        this.multiplier = typeof params.multiplier === "number" ? params.multiplier : 1.8;
        this.flatBonus = typeof params.flatBonus === "number" ? params.flatBonus : 0;
    }

    /**
     * @param {string} eventName
     */
    OnBuffEmit(eventName) {
        if (eventName !== "OnRecompute") {
            return { result: false };
        }
        if (this.targetType !== "monster") {
            return { result: false };
        }

        const monster = /** @type {import("../../monster/monster/monster").Monster} */ (this.target);
        monster.speed = Math.max(0, monster.speed * this.multiplier + this.flatBonus);
        return { result: true };
    }
}

const BuffFactory = {
    /**
     * 根据 typeId 创建对应的 buff 实例。未识别的 id 返回 null。
     * @param {import("../monster/monster/monster").Monster|import("../player/player/player").Player} target
     * @param {string} targetType
     * @param {string} typeid
     * @param {number} id
     * @param {Record<string, any>} params
     * @returns {import("./buff_template").BuffTemplate|null}
     */
    create(target, targetType, typeid, id, params) {
        switch (typeid) {
            case "poison":
                return new PoisonBuff(id, target, targetType, params);
            case "attack_up":
                return targetType === "player"
                    ? new AttackUpBuff(id, /** @type {import("../player/player/player").Player} */ (target), targetType, params)
                    : null;
            case "speed_up":
                return targetType === "monster"
                    ? new SpeedUpBuff(id, /** @type {import("../monster/monster/monster").Monster} */ (target), targetType, params)
                    : null;
            case "corestats":
                return null;
            default:
                return null;
        }
    }
};

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
        this.id = 1;
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Buff.In.BuffAddRequest, (/**@type {import("./buff_const").BuffAddRequest} */payload) => {
                payload.result = this.addbuff(payload);
            }),
            eventBus.on(event.Buff.In.BuffRemoveRequest, (/**@type {import("./buff_const").BuffRemoveRequest} */payload) => {
                payload.result = this.deletebuff(payload);
            }),
            eventBus.on(event.Buff.In.BuffRefreshRequest, (/**@type {import("./buff_const").BuffRefreshRequest} */payload) => {
                payload.result = this.refreshbuff(payload);
            }),
            eventBus.on(event.Buff.In.BuffEmitRequest, (/**@type {import("./buff_const").BuffEmitRequest} */payload) => {
                payload.result = this.emitBuffEvent(payload);
            })
        ];
    }
    destroy()
    {
        for (const unsubscribe of this._unsubscribers) {
            unsubscribe();
        }
        this._unsubscribers.length = 0;
        this.clearAll();
    }

    /**
     * @param {import("./buff_const").BuffAddRequest} buffAddRequest
     * @returns {number} 返回 buff 的 id，如果创建失败则返回 -1
     */
    addbuff(buffAddRequest)
    {
        const config=buffconfig[buffAddRequest.configid];
        if (!config) {
            return -1;
        }
        const params = { ...(config.params ?? {}) };
        const buff = BuffFactory.create(buffAddRequest.target,buffAddRequest.targetType,config.typeid,this.id++, params);
        if (buff) {
            buff.start();
            this.buffMap.set(buff.id, buff);
            return buff.id;
        }
        return -1;
    }

    /**
     * @param {import("./buff_const").BuffRemoveRequest} buffRemoveRequest
     * @returns {boolean}
     */
    deletebuff(buffRemoveRequest)
    {
        const buff = this.buffMap.get(buffRemoveRequest.buffId);
        if (buff === undefined) return false;
        buff.stop();
        this.buffMap.delete(buffRemoveRequest.buffId);
        return true;
    }

    /**
     * @param {import("./buff_const").BuffRefreshRequest} buffRefreshRequest
     * @returns {boolean}
     */
    refreshbuff(buffRefreshRequest)
    {
        const buff = this.buffMap.get(buffRefreshRequest.buffId);
        if (buff === undefined) return false;
        buff.refresh();
        return true;
    }

    /**
     * 驱动单个 Buff 运行时事件，并在处理后发出 Out 通知。
     * @param {import("./buff_const").BuffEmitRequest} buffEmitRequest
     */
    emitBuffEvent(buffEmitRequest)
    {
        const buff = this.buffMap.get(buffEmitRequest.buffId);
        if (buff === undefined) return {result:false};

        return buff.OnBuffEmit(buffEmitRequest.eventName,buffEmitRequest.params);
    }
    tick()
    {
        for (const [buffId, buff] of this.buffMap)
        {
            if (buff.use === false)
            {
                this.buffMap.delete(buffId);
                continue;
            }
            buff.tick();
        }
    }
    clearAll()
    {
        for (const buff of this.buffMap.values())
        {
            buff.stop();
        }
        this.buffMap.clear();
    }
}

/**
 * @module 粒子系统/粒子配置
 */
/**
 * 区域效果请求粒子系统时的负载。
 * @typedef {object} ParticleCreateRequest
 * @property {string} particleName - 需要创建的粒子系统预制名字
 * @property {{x:number,y:number,z:number}} position - 粒子生成位置
 * @property {number} lifetime - 粒子持续时间
 * @property {number} result - 管理器返回的粒子id
 */
/**
 * 区域效果请求粒子系统时的负载。
 * @typedef {object} ParticleStopRequest
 * @property {number} particleId - 需要停止的粒子系统ID
 * @property {boolean} result - 管理器返回的操作结果
 */
/**
 * 粒子系统创建成功后的通知负载。
 * @typedef {object} OnParticleCreated
 * @property {number} particleId - 创建成功的粒子ID
 * @property {string} particleName - 粒子配置ID
 * @property {{x:number,y:number,z:number}} position - 粒子生成位置
 * @property {number} lifetime - 粒子生命周期
 */
/**
 * 粒子系统停止后的通知负载。
 * @typedef {object} OnParticleStopped
 * @property {number} particleId - 被停止的粒子ID
 * @property {string} particleName - 粒子配置ID
 */
//===================预制粒子配置========================
/** @type {Record<string, import("../util/definition").particleConfig>} */
const particleConfigs = {
    poisongas: {
        id: "poisongas",
        spawnTemplateName: "poisongas_particle_template",
        middleEntityName: "poisongas_particle",
    },
    // 后续在此添加更多粒子，例如：
    // explosion: { id: "explosion", spawnTemplateName: "explosion_particle_template" },
};

/**
 * @module 粒子系统/单个粒子
 */

class Particle {
    /**
     * 创建单个粒子实例。
     * @param {number} id
     * @param {import("../util/definition").particleConfig} config
     * @param {import("../particle/particle_const").ParticleCreateRequest} options
     */
    constructor(id, config, options) {
        /** @type {number} */
        this.id = id;
        /** @type {import("../util/definition").particleConfig} */
        this.config = config;
        /** @type {import("cs_script/point_script").Entity[]} 本次 spawn 产生的全部实体 */
        this._spawnedEntities = [];
        /** @type {import("cs_script/point_script").Entity|null} 目标 info_particle_system */
        this._particleEntity = null;
        /** @type {boolean} 粒子当前是否处于存活状态 */
        this._alive = false;

        /** 活动时间（秒），-1 = 无限期，仅外部 stop */
        this.lifetime = options.lifetime;
        /** 创建时的游戏时间戳 */
        this._startTime = 0;
    }

    /**
     * 在指定位置生成粒子实体。
     * @param {{x:number, y:number, z:number}} position
     * @returns {boolean}
     */
    start(position) {

        const template = Instance.FindEntityByName(this.config.spawnTemplateName);
        if (!template || !(template instanceof PointTemplate)) {
            Instance.Msg(`Particle: 找不到 PointTemplate "${this.config.spawnTemplateName}"\n`);
            return false;
        }

        const spawned = template.ForceSpawn(position);
        if (!spawned || spawned.length === 0) {
            Instance.Msg(`Particle: ForceSpawn 未返回实体 (template="${this.config.spawnTemplateName}")\n`);
            return false;
        }

        this._spawnedEntities = spawned;
        this._particleEntity = this._findParticleEntity(spawned);

        if (!this._particleEntity) {
            Instance.Msg(`Particle: 生成实体中未找到 info_particle_system (template="${this.config.spawnTemplateName}")\n`);
            this._cleanup();
            return false;
        }

        this._startTime = Instance.GetGameTime();
        this._alive = true;
        return true;
    }

    /**
     * 每帧由 ParticleManager 调用。检查有效性与超时。
     * @param {number} now
     */
    tick(now) {
        if (!this._alive) return;

        if (!this._particleEntity || !this._particleEntity.IsValid()) {
            eventBus.emit(event.Particle.In.StopRequest, { particleId: this.id });
            return;
        }

        if (this.lifetime != null && now - this._startTime >= this.lifetime) {
            eventBus.emit(event.Particle.In.StopRequest, { particleId: this.id });
        }
    }

    /**
     * 停止粒子并删除本次 spawn 产生的全部实体。
     * @returns {boolean} 是否成功移除（已停止/不存在返回 false）
     */
    stop() {
        if (!this._alive) return false;

        this._cleanup();

        return true;
    }
    /**
     * 从生成实体列表中识别目标 info_particle_system。
     * @param {import("cs_script/point_script").Entity[]} entities
     * @returns {import("cs_script/point_script").Entity|null}
     */
    _findParticleEntity(entities) {
        const targetName = this.config.middleEntityName;
        let fallback = null;

        for (const ent of entities) {
            if (ent.GetClassName() !== "info_particle_system") continue;
            if (targetName && ent.GetEntityName() === targetName) return ent;
            if (!fallback) fallback = ent;
        }

        if (fallback && targetName) {
            Instance.Msg(`Particle: 未精确匹配 middleEntityName "${targetName}"，使用第一个 info_particle_system\n`);
        }
        return fallback;
    }

    /** 删除本次 spawn 产生的全部实体并重置状态 */
    _cleanup() {
        for (const ent of this._spawnedEntities) {
            if (ent && ent.IsValid()) ent.Remove();
        }
        this._spawnedEntities = [];
        this._particleEntity = null;
        this._startTime = 0;
        this._alive = false;
    }
}

/**
 * @module 粒子系统/粒子管理器
 */
/**
 * 粒子管理器。
 *
 * 只负责管理当前所有活跃的单粒子系统实例：
 * - create: 按粒子配置创建并启动单个 Particle
 * - tickAll: 每帧统一驱动粒子生命周期
 * - stopAll / cleanup: 统一销毁所有活跃粒子
 *
 * 单个粒子的具体逻辑在 `particle.js` 中实现。
 */
class ParticleManager {
    constructor() {
        /**
         * 当前管理器持有的活跃粒子池。
         * @type {Map<number, Particle>}
         */
        this.activeParticles = new Map();
        this._nextParticleId = 1;
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Particle.In.CreateRequest, (/**@type {import("../particle/particle_const").ParticleCreateRequest}*/ payload) => {
                payload.result = this.create(payload);
            }),
            eventBus.on(event.Particle.In.StopRequest, (/**@type {import("../particle/particle_const").ParticleStopRequest}*/ payload) => {
                const particle=this.activeParticles.get(payload.particleId);
                payload.result=particle?.stop()??false;
                if (payload.result && particle) {
                    /** @type {import("../particle/particle_const").OnParticleStopped} */
                    const stoppedPayload = {
                        particleId: payload.particleId,
                        particleName: particle.config.id,
                    };
                    eventBus.emit(event.Particle.Out.OnStopped, stoppedPayload);
                }
                this.activeParticles.delete(payload.particleId);
            })
        ];
    }

    /**
     * 按粒子 id 创建并立即在指定位置生成粒子。
     * @param {import("../particle/particle_const").ParticleCreateRequest} particleCreateRequest
     * @returns {number} 成功时返回粒子 id，失败返回 -1
     */
    create(particleCreateRequest) {
        const config = particleConfigs[particleCreateRequest.particleName];
        if (!config) {
            Instance.Msg(`Particle: 未找到粒子配置 "${particleCreateRequest.particleName}"\n`);
            return -1;
        }

        const p = new Particle(this._nextParticleId++,config, particleCreateRequest);
        if (!p.start(particleCreateRequest.position)) return -1;
        this.activeParticles.set(p.id, p);

        /** @type {import("../particle/particle_const").OnParticleCreated} */
        const createdPayload = {
            particleId: p.id,
            particleName: particleCreateRequest.particleName,
            position: { ...particleCreateRequest.position },
            lifetime: particleCreateRequest.lifetime ?? -1,
        };
        eventBus.emit(event.Particle.Out.OnCreated, createdPayload);
        return p.id;
    }

    /**
     * 每帧调用，驱动所有活跃粒子的生命周期。
     * @param {number} now  当前游戏时间（Instance.GetGameTime()）
     */
    tickAll(now) {
        for (const particle of this.activeParticles.values()) {
            if (particle) {
                particle.tick(now);
            }
        }
    }

    /** 停止并清理当前管理器中的全部粒子。 */
    cleanup() {
        for (const particle of this.activeParticles.values()) {
            if (particle) {
                particle.stop();
            }
        }
        this.activeParticles.clear();
    }

    /** 销毁服务并注销事件监听。 */
    destroy() {
        this.cleanup();
        for (const unsubscribe of this._unsubscribers) {
            unsubscribe();
        }
        this._unsubscribers.length = 0;
    }
}

/**
 * @module 导航网格/常量与工具
 */
/** @typedef {import("cs_script/point_script").Vector} Vector */
/** @typedef {import("cs_script/point_script").Color} Color */
/**
 * 导航路径节点状态枚举，表示到达下一个点时应采用的移动方式。
 * - `WALK(1)`：直线行走
 * - `JUMP(2)`：跳跃
 * - `LADDER(3)`：爬梯子（持续到下一个非梯子点）
 * - `PORTAL(4)`：传送门瞬移
 *
 * NavMesh 寻路结果数组中每个节点的 `mode` 字段即为此类型。
 */
const PathState$1 = {
    WALK: 1,
    JUMP: 2,
    LADDER: 3,
    PORTAL: 4
};
//==============================世界相关设置=====================================
/** NavMesh 世界原点坐标（体素空间的 (0,0,0) 对应的世界坐标）。 */
const origin = { x: -1400, y: -4510, z: 220 };
/** 体素水平方向尺寸（单位）。越小精度越高，构建越慢。 */
const MESH_CELL_SIZE_XY = 8;
/** 体素垂直方向尺寸（单位）。 */
const MESH_CELL_SIZE_Z = 1;
/** 体素化射线方块高度（单位）。设置过高会忽略竖直方向的空隙。 */
const MESH_TRACE_SIZE_Z = 32;
/** NavMesh 世界水平范围大小（单位）。 */
const MESH_WORLD_SIZE_XY = 3200;
/** NavMesh 世界垂直范围大小（单位）。 */
const MESH_WORLD_SIZE_Z = 1100;
//==============================数据结构设置=====================================
/** 多边形最大数量，受 16 位索引限制（不超过 65535）。 */
const MAX_POLYS = 65535;
/** 顶点最大数量。 */
const MAX_VERTS = 65535;
/** 三角形最大数量。 */
const MAX_TRIS = 65535;
/** 特殊连接点（跳点 / 梯子 / 传送门）的最大数量。 */
const MAX_LINKS = 4096;
//==============================Recast设置======================================
//其他参数
/** 最大可行走坡度（度），超过此角度的斜面视为不可行走。 */
const MAX_SLOPE = 65;
/** 怪物最大可行走台阶高度（体素单位）。 */
const MAX_WALK_HEIGHT = 13 / MESH_CELL_SIZE_Z;
/** 怪物最大可跳跃高度（体素单位）。 */
const MAX_JUMP_HEIGHT = 65 / MESH_CELL_SIZE_Z;
/** Agent 半径（体素单位），汽化时用于腐蚀和空间判定。 */
const AGENT_RADIUS = 8 / MESH_CELL_SIZE_XY;
/** Agent 高度（体素单位），用于可行走 span 高度筛选。 */
const AGENT_HEIGHT = 40 / MESH_CELL_SIZE_Z;
//TILE参数
/** 瓦片边长（体素单位）。每个 tile 包含 `TILE_SIZE×TILE_SIZE` 个体素，过大影响性能，过小增加内存开销。 */
const TILE_SIZE = 512 / MESH_CELL_SIZE_XY;
/** 瓦片边界填充体素数，防止边缘寻路穿模。必须大于 `MESH_ERODE_RADIUS`。 */
const TILE_PADDING = AGENT_RADIUS + 1;
/** 优化1：是否修剪 `info_target{name:navmesh}` 无法到达的平台。 */
const TILE_OPTIMIZATION_1 = true;
//体素化参数
/** 开放高度场腐蚀半径（体素单位），用于收缩可行走区域以避开墙壁。 */
const MESH_ERODE_RADIUS = AGENT_RADIUS;
//区域生成参数
/** 小于此面积的相邻区域会被合并（体素单位）。 */
const REGION_MERGE_AREA = 128;
/** 小于此面积的区域将被丢弃（体素单位），0 表示不丢弃。 */
const REGION_MIN_AREA = 0;
//轮廓生成参数
/** 轮廓简化时原始点到简化边的最大偏离距离（体素距离）。 */
const CONT_MAX_ERROR = 1.5;
/** 每个多边形的最大顶点数。 */
const POLY_MAX_VERTS_PER_POLY = 6;
/** 多边形合并时是否优先合并最长公共边。 */
const POLY_MERGE_LONGEST_EDGE_FIRST = true;
/** 细节网格采样间距，值越小精度越高但耗时越多，推荐 3。 */
const POLY_DETAIL_SAMPLE_DIST = 3;
/** 细节网格采样点与计算点的高度差小于此阈值时跳过采样。 */
const POLY_DETAIL_HEIGHT_ERROR = 5;
//==============================Detour设置======================================
//A*寻路参数
/** 特殊连接点的寻路代价系数，越大越不倾向使用特殊点。 */
const OFF_MESH_LINK_COST_SCALE=1;
/** A* 启发式估价缩放系数，推荐 1.0–1.5。 */
const ASTAR_HEURISTIC_SCALE = 1.2;
//Funnel参数
/** Funnel 路径拉直时距多边形边缘的最小距离百分比（0–100，100% 表示只能走边的中点）。 */
const FUNNEL_DISTANCE = 0;
/** 高度修正时每隔此距离插入一个采样点（单位）。 */
const ADJUST_HEIGHT_DISTANCE = 50;
/**
 * 点p到线段ab距离的平方
 * @param {Vector} p
 * @param {Vector} a
 * @param {Vector} b
 */
function distPtSegSq(p, a, b) {
    // 向量 ab 和 ap
    const abX = b.x - a.x;
    const abY = b.y - a.y;
    const apX = p.x - a.x;
    const apY = p.y - a.y;

    // 计算 ab 向量的平方长度
    const abSq = abX * abX + abY * abY;

    // 如果线段的起点和终点重合（abSq 为 0），直接计算点到起点的距离
    if (abSq === 0) {
        return apX * apX + apY * apY;
    }

    // 计算点p在ab上的投影 t
    const t = (apX * abX + apY * abY) / abSq;

    // 计算投影点的位置
    let nearestX, nearestY;

    if (t < 0) {
        // 投影点在a点左侧，最近点是a
        nearestX = a.x;
        nearestY = a.y;
    } else if (t > 1) {
        // 投影点在b点右侧，最近点是b
        nearestX = b.x;
        nearestY = b.y;
    } else {
        // 投影点在线段上，最近点是投影点
        nearestX = a.x + t * abX;
        nearestY = a.y + t * abY;
    }

    // 计算点p到最近点的距离的平方
    const dx = p.x - nearestX;
    const dy = p.y - nearestY;

    return dx * dx + dy * dy;
}
/**
 * xy平面上点abc构成的三角形面积的两倍，>0表示ABC逆时针，<0表示顺时针
 * @param {Vector} a
 * @param {Vector} b
 * @param {Vector} c
 */
function area(a, b, c) {
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const ac = { x: c.x - a.x, y: c.y - a.y };
    const s2 = (ab.x * ac.y - ac.x * ab.y);
    return s2;
}
/**
 * 返回cur在多边形中是否是锐角
 * @param {Vector} prev
 * @param {Vector} cur
 * @param {Vector} next
 */
function isConvex(prev, cur, next) {
    return area(prev, cur, next) > 0;
}
/**
 * xy平面上点p是否在abc构成的三角形内（不包括边上）
 * @param {Vector} p
 * @param {Vector} a
 * @param {Vector} b
 * @param {Vector} c
 */
function pointInTri(p, a, b, c) {
    const ab = area(a, b, p);
    const bc = area(b, c, p);
    const ca = area(c, a, p);
    //内轮廓与外轮廓那里会有顶点位置相同的时候
    return ab > 0 && bc > 0 && ca > 0;
}
/**
 * 点到线段最近点
 * @param {Vector} p
 * @param {Vector} a
 * @param {Vector} b
 */
function closestPointOnSegment(p, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const abz = b.z - a.z;

    const apx = p.x - a.x;
    const apy = p.y - a.y;
    const apz = p.z - a.z;

    const d = abx * abx + aby * aby + abz * abz;
    let t = d > 0 ? (apx * abx + apy * aby + apz * abz) / d : 0;
    t = Math.max(0, Math.min(1, t));

    return {
        x: a.x + abx * t,
        y: a.y + aby * t,
        z: a.z + abz * t,
    };
}
/**
 * 点是否在凸多边形内(xy投影)
 * @param {Vector} p
 * @param {Float32Array} verts
 * @param {number} start
 * @param {number} end
 */
function pointInConvexPolyXY(p, verts, start, end) {
    for (let i = start; i <= end; i++) {
        const a = { x: verts[i * 3], y: verts[i * 3 + 1]};
        const b = { x: verts[((i < end) ? (i + 1) : start) * 3], y: verts[((i < end) ? (i + 1) : start) * 3 + 1]};
        if (area(a, b, p) < 0) return false;
    }
    return true;
}
/**
 * 点到 polygon 最近点(xy投影)
 * @param {Vector} pos
 * @param {Float32Array} verts
 * @param {number} start
 * @param {number} end
 */
function closestPointOnPoly(pos, verts, start, end) {
    // 1. 如果在多边形内部（XY），直接投影到平面
    if (pointInConvexPolyXY(pos, verts, start, end)) {
        // 用平均高度（你也可以用平面方程）
        let maxz = -Infinity, minz = Infinity;
        start*=3;
        end*=3;
        for (let i = start; i <= end; i+=3) {
            const z = verts[i + 2];
            if (z > maxz) maxz = z;
            if (z < minz) minz = z;
        }
        return { x: pos.x, y: pos.y, z: (maxz + minz) >>1, in: true };
    }
    // 2. 否则，找最近边
    let best = null;
    let bestDist = Infinity;
    for (let i = start; i <= end; i++) {
        const ia = i;
        const ib = (i < end) ? (i + 1) : start;
        const a = { x: verts[ia * 3], y: verts[ia * 3 + 1], z: verts[ia * 3 + 2] };
        const b = { x: verts[ib * 3], y: verts[ib * 3 + 1], z: verts[ib * 3 + 2] };
        const c = closestPointOnSegment(pos, a, b);
        const dx = c.x - pos.x;
        const dy = c.y - pos.y;
        const dz = c.z - pos.z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestDist) {
            bestDist = d;
            best = { x: c.x, y: c.y, z: c.z, in: false };
        }
    }
    return best;
}

/**
 * @module 导航网格/漏斗高度修正
 */

/** @typedef {import("./path_manager").NavMeshMesh} NavMeshMesh */
/** @typedef {import("./path_manager").NavMeshDetail} NavMeshDetail */

/**
 * 路径高度修正器。
 *
 * 通过在 Detail Mesh 上采样，使用重心坐标插值
 * 对 Funnel 输出的 2D 路径点进行 Z 坐标修正。
 * 确保路径点精确贴合地形高度。
 *
 * @navigationTitle 高度修正器
 */
class FunnelHeightFixer {
    /**
     * 初始化高度修正器，绑定导航网格与细节网格。
    * @param {NavMeshMesh} navMesh
    * @param {NavMeshDetail} detailMesh
     * @param {number} stepSize
     */
    constructor(navMesh, detailMesh, stepSize = 0.5) {
        /** @type {NavMeshMesh} 导航网格数据引用 */
        this.navMesh = navMesh;
        /** @type {NavMeshDetail} 细节三角网数据引用 */
        this.detailMesh = detailMesh;
        /** @type {number} 分段采样步长（单位） */
        this.stepSize = stepSize;
        const polyCount = this.navMesh.polyslength;
        this.polyTriStart = new Uint16Array(polyCount);
        this.polyTriEnd   = new Uint16Array(polyCount);
        this.polyHasDetail = new Uint8Array(polyCount);
        for (let i = 0; i < polyCount; i++) {
            const baseTri  = detailMesh.baseTri[i];
            const triCount = detailMesh.triCount[i];
            this.polyHasDetail[i] = (triCount > 0) ? 1 : 0;
            this.polyTriStart[i] = baseTri;
            this.polyTriEnd[i]   = baseTri + triCount; // [start, end)
        }
        this.triAabbMinX = new Float32Array(detailMesh.trislength);
        this.triAabbMinY = new Float32Array(detailMesh.trislength);
        this.triAabbMaxX = new Float32Array(detailMesh.trislength);
        this.triAabbMaxY = new Float32Array(detailMesh.trislength);
        this.vert=new Array();
        this.tris=new Array();
        const { verts, tris } = detailMesh;
        for(let i=0;i<detailMesh.vertslength;i++)
        {
            this.vert[i]={x: verts[i * 3], y: verts[i * 3 + 1], z: verts[i * 3 + 2]};
        }
        for (let i = 0; i < detailMesh.trislength; i++) {
            this.tris[i] = { a: tris[i * 3], b: tris[i * 3 + 1], c: tris[i * 3 + 2] };

            const { a, b, c } = this.tris[i];
            const minX = Math.min(this.vert[a].x, this.vert[b].x, this.vert[c].x);
            const minY = Math.min(this.vert[a].y, this.vert[b].y, this.vert[c].y);
            const maxX = Math.max(this.vert[a].x, this.vert[b].x, this.vert[c].x);
            const maxY = Math.max(this.vert[a].y, this.vert[b].y, this.vert[c].y);

            this.triAabbMinX[i] = minX;
            this.triAabbMinY[i] = minY;
            this.triAabbMaxX[i] = maxX;
            this.triAabbMaxY[i] = maxY;
        }

    }

    /* ===============================
       Public API
    =============================== */
    
    /**
     * 添加一个高度修正后的采样点。
     *
     * 将点投射到当前多边形的 Detail Mesh 上获取精确高度，
     * 并追加到输出路径。
     *
     * @param {{ x: number; y: number; z: number; }} pos 采样点
     * @param {number} polyid 当前多边形索引
     * @param {{ id: number; mode: number; }[]} polyPath 多边形序列
     * @param {{ pos: { x: number; y: number; z: number; }; mode: number; }[]} out 输出路径数组
     */
    addpoint(pos,polyid,polyPath,out)
    {
        polyid = this._advancePolyIndex(pos, polyid, polyPath);

        if (polyid >= polyPath.length) return;
        const h = this._getHeightOnDetail(polyPath[polyid].id, pos);
        out.push({
            pos: { x: pos.x, y: pos.y, z: h },
            mode: PathState$1.WALK
        });
        //Instance.DebugSphere({center:{ x: pos.x, y: pos.y, z: h },radius:1,duration:1/32,color:{r:0,g:255,b:0}});
                
    }
    /**
     * 对整条 Funnel 路径进行高度修正。
     *
     * 将相邻航路点分段采样，将每个采样点投射到
     * Detail Mesh 获取精确 Z 坐标。跳跃/梯子点保留原坐标。
     *
     * @param {{pos:{x:number,y:number,z:number},mode:number}[]} funnelPath Funnel 输出的原始路径
     * @param {{id:number,mode:number}[]} polyPath 多边形序列
     * @returns {{pos:{x:number,y:number,z:number},mode:number}[]}
     */
    fixHeight(funnelPath,polyPath) {
        if (funnelPath.length === 0) return [];
        /** @type {{pos:{x:number,y:number,z:number},mode:number}[]} */
        const result = [];
        let polyIndex = 0;
        
        for (let i = 0; i < funnelPath.length - 1; i++) {
            const curr = funnelPath[i];
            const next = funnelPath[i + 1];

            // 梯子点：始终原样保留，不参与地面采样。
            // 否则会把 LADDER 点重写成 WALK，出现“梯子被跳过”的现象。
            if (curr.mode == PathState$1.LADDER) {
                result.push(curr);
                continue;
            }
            // 跳跃落点(next=JUMP)：前一段不做插值，等待下一轮由 curr=JUMP 处理落地点。
            if (next.mode == PathState$1.JUMP) {
                result.push(curr);
                continue;
            }
            if (curr.mode == PathState$1.JUMP) result.push(curr);
            // 分段采样
            const samples = this._subdivide(curr.pos, next.pos);
            //Instance.Msg(samples.length);
            //let preh=curr.pos.z;
            //let prep=curr;
            for (let j = (curr.mode == PathState$1.JUMP)?1:0; j < samples.length; j++) {
                const p = samples[j];
                // 跳过重复首点
                //if (result.length > 0) {
                //    const last = result[result.length - 1].pos;
                //    if (posDistance2Dsqr(last, p) < 1e-4) continue;
                //}
                //const preid=polyIndex;
                // 推进 poly corridor
                polyIndex = this._advancePolyIndex(p, polyIndex, polyPath);

                if (polyIndex >= polyPath.length) break;
                const polyId = polyPath[polyIndex].id;
                const h = this._getHeightOnDetail(polyId, p);
                //如果这个样本点比前一个点高度发生足够变化，就在中间加入一个样本点
                //if(j>0&&Math.abs(preh-h)>5)
                //{
                //    const mid={x:(p.x+prep.pos.x)/2,y:(p.y+prep.pos.y)/2,z:p.z};
                //    this.addpoint(mid,preid,polyPath,result);
                //}
                result.push({
                    pos: { x: p.x, y: p.y, z: h },
                    mode: PathState$1.WALK
                });
                //Instance.DebugSphere({center:{ x: p.x, y: p.y, z: h },radius:1,duration:1/32,color:{r:255,g:0,b:0}});
                //preh=p.z;
                //prep=result[result.length - 1];
            }
        }

        const last = funnelPath[funnelPath.length - 1];
        if (result.length === 0 || result[result.length - 1].pos.x !== last.pos.x || result[result.length - 1].pos.y !== last.pos.y || result[result.length - 1].pos.z !== last.pos.z || result[result.length - 1].mode !== last.mode) {
            result.push(last);
        }

        return result;
    }

    /* ===============================
       Subdivide
    =============================== */

    /**
     * 将线段分割为等距采样点。
     *
     * 根据 stepSize 将 a→b 划分为等间距点列，
     * 若距离小于 stepSize 则只返回起点。
     *
     * @param {{ x: any; y: any; z: any; }} a 起点
     * @param {{ x: any; y: any; z?: number; }} b 终点
     * @returns {import("cs_script/point_script").Vector[]} 采样点数组
     */
    _subdivide(a, b) {
        const out = [];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= this.stepSize) {
            out.push(a);
            return out;
        }

        const n = Math.floor(dist / this.stepSize);
        for (let i = 0; i < n; i++) {
            const t = i / n;
            out.push({
                x: a.x + dx * t,
                y: a.y + dy * t,
                z: a.z
            });
        }
        return out;
    }

    /* ===============================
       Height Query
    =============================== */

    /**
     * 查询点在指定多边形 Detail Mesh 上的高度。
     *
     * 遍历该多边形对应的 Detail 三角形，找到包含该点
     * 的三角形并用重心坐标插值 Z 值。
     *
     * @param {number} polyId 多边形 ID
     * @param {{ z: number; y: number; x: number; }} p 查询点
     * @returns {number} 插值后的高度
     */
    _getHeightOnDetail(polyId, p) {
        const vert=this.vert;
        const tri=this.tris;
        const start = this.polyTriStart[polyId];
        const end   = this.polyTriEnd[polyId];
        if (this.polyHasDetail[polyId] === 0) return p.z;
        for (let i = start; i < end; i++) {
            if (
                p.x < this.triAabbMinX[i] || p.x > this.triAabbMaxX[i] ||
                p.y < this.triAabbMinY[i] || p.y > this.triAabbMaxY[i]
            ) {
                continue;
            }
            if (this._pointInTriXY(p, vert[tri[i].a], vert[tri[i].b], vert[tri[i].c])) {
                return this._baryHeight(p, vert[tri[i].a], vert[tri[i].b], vert[tri[i].c]);
            }
        }
        // fallback（极少发生）
        return p.z;
    }
    /**
     * 三角形内插高度
     * @param {{ x: number; y: number; }} p
     * @param {{ x: any; y: any; z: any; }} a
     * @param {{ x: any; y: any; z: any; }} b
     * @param {{ x: any; y: any; z: any; }} c
     */
    _baryHeight(p, a, b, c) {
        const v0x = b.x - a.x, v0y = b.y - a.y;
        const v1x = c.x - a.x, v1y = c.y - a.y;
        const v2x = p.x - a.x, v2y = p.y - a.y;

        const d00 = v0x * v0x + v0y * v0y;
        const d01 = v0x * v1x + v0y * v1y;
        const d11 = v1x * v1x + v1y * v1y;
        const d20 = v2x * v0x + v2y * v0y;
        const d21 = v2x * v1x + v2y * v1y;

        const denom = d00 * d11 - d01 * d01;
        const v = (d11 * d20 - d01 * d21) / denom;
        const w = (d00 * d21 - d01 * d20) / denom;
        const u = 1.0 - v - w;

        return u * a.z + v * b.z + w * c.z;
    }

    /* ===============================
       Geometry helpers
    =============================== */

    /**
     * 判断点 p 在 XY 平面上是否位于指定凸多边形内。
     * @param {{ y: number; x: number; z:number}} p
     * @param {number} polyId
     */
    _pointInPolyXY(p, polyId) {
        const start = this.navMesh.polys[polyId * 2];
        const end = this.navMesh.polys[polyId * 2 + 1];
        return pointInConvexPolyXY(p, this.navMesh.verts, start, end);
    }
    /**
     * 判断点 p 在 XY 平面上是否位于三角形 abc 内（含边界）。
     * @param {{ y: number; x: number; }} p
     * @param {{ x: number; y: number;}} a
     * @param {{ x: number; y: number;}} b
     * @param {{ x: number; y: number;}} c
     */
    _pointInTriXY(p, a, b, c) {
        const s = (a.x - c.x) * (p.y - c.y) - (a.y - c.y) * (p.x - c.x);
        const t = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
        const u = (c.x - b.x) * (p.y - b.y) - (c.y - b.y) * (p.x - b.x);
        return (s >= 0 && t >= 0 && u >= 0) || (s <= 0 && t <= 0 && u <= 0);
    }

    /**
     * 沿多边形序列推进 corridor 索引。
     *
     * 从 startIndex 开始向前扫描，找到第一个包含点 p
     * 的多边形并返回其索引。
     *
     * @param {{x:number,y:number,z:number}} p 查询点
     * @param {number} startIndex 起始索引
     * @param {{id:number,mode:number}[]} polyPath 多边形序列
     * @returns {number} 包含点 p 的多边形索引
     */
    _advancePolyIndex(p, startIndex, polyPath) {

        let bestIndex = startIndex;

        for (let i = startIndex; i <= polyPath.length-1; i++) {
            const polyId2 = polyPath[i].id<<1;
            const start = this.navMesh.polys[polyId2];
            const end = this.navMesh.polys[polyId2 + 1];
            const cp = closestPointOnPoly(p, this.navMesh.verts, start, end);
            if (!cp||!cp.in) continue;
            return i;
            //cp.z = cp.z;
            //const dx = cp.x - p.x;
            //const dy = cp.y - p.y;
            //const dz = cp.z - p.z;
            //const d = dx * dx + dy * dy + dz * dz;
            //if (d < bestDistSq) {
            //    bestDistSq = d;
            //    bestIndex = i;
            //    return i; // 直接返回第一个找到的点，因为点一定在多边形投影内，不需要继续找了
            //}
        }
        return bestIndex;
    }
}

/**
 * @module 导航网格/工具函数
 */
/** @typedef {import("cs_script/point_script").Vector} Vector */
/** @typedef {import("../path_manager").NavMeshMesh} NavMeshMesh */
// 查询所在多边形优化
let spatialCellSize = 128;

// 压缩网格（CSR）
let gridMinX = 0;
let gridMinY = 0;
let gridW = 0;
let gridH = 0;

// 长度 = gridW * gridH
let cellStart = new Uint32Array(0); // 建议长度 N+1，便于取区间
let cellItems = new Int32Array(0);  // 扁平候选 poly 列表
/**
 * NavMesh 与路径模块共享的纯工具函数集合（无状态静态方法）。
 *
 * 包含：
 * - 数值工具：`clamp`、`lerpVector`、`orderedPairKey`。
 * - 空间索引：`buildSpatialIndex`、`findNearestPoly`。
 * - 数据压缩：`_compactTileData`、`toTypedMesh`、`toTypedDetail`、`toTypedLinks`。
 *
 * @navigationTitle NavMesh 工具集
 */
class Tool {
    /**
        * 数值夹取。
     *
     * @param {number} value
     * @param {number} min
     * @param {number} max
     * @returns {number}
     */
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
        * 三维向量线性插值。
        * t=0 返回 a，t=1 返回 b。
     *
     * @param {Vector} a
     * @param {Vector} b
     * @param {number} t
     * @returns {Vector}
     */
    static lerpVector(a, b, t) {
        return {
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
            z: a.z + (b.z - a.z) * t
        };
    }

    /**
        * 生成“无序点对”稳定 key。
        * (a,b) 与 (b,a) 会得到相同 key。
     *
     * @param {number} a
     * @param {number} b
     * @param {string} [separator]
     * @returns {string}
     */
    static orderedPairKey(a, b, separator = "-") {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        return `${lo}${separator}${hi}`;
    }

    /**
        * 生成二维网格索引 key（x,y）。
     *
     * @param {number} x
     * @param {number} y
     * @param {string} [separator]
     * @returns {string}
     */
    static gridKey2(x, y, separator = "_") {
        return `${x}${separator}${y}`;
    }

    /**
        * Map<string, T[]> 的“取或建”辅助。
        * key 不存在时自动创建空数组并返回。
     *
     * @template T
     * @param {Map<string, T[]>} map
     * @param {string} key
     * @returns {T[]}
     */
    static getOrCreateArray(map, key) {
        let list = map.get(key);
        if (!list) {
            list = [];
            map.set(key, list);
        }
        return list;
    }

    /**
        * 点是否在线段上（XY 平面）。
        * - includeEndpoints=true: 端点算在线段上
        * - includeEndpoints=false: 端点不算在线段上（严格在线段内部）
     *
     * @param {number} px
     * @param {number} py
     * @param {number} x1
     * @param {number} y1
     * @param {number} x2
     * @param {number} y2
     * @param {{includeEndpoints?: boolean, epsilon?: number}} [options]
     * @returns {boolean}
     */
    static pointOnSegment2D(px, py, x1, y1, x2, y2, options) {
        const epsilon = options?.epsilon ?? 1e-6;
        const includeEndpoints = options?.includeEndpoints ?? true;

        const cross = (px - x1) * (y2 - y1) - (py - y1) * (x2 - x1);
        if (Math.abs(cross) > epsilon) return false;

        const dot = (px - x1) * (px - x2) + (py - y1) * (py - y2);
        return includeEndpoints ? dot <= epsilon : dot < -epsilon;
    }
    /**
     * 为多边形网格构建二维空间网格索引（CSR 压缩格式），加速最近多边形查询。
     * @param {NavMeshMesh} mesh
     */
    static buildSpatialIndex(mesh) {
        const polyCount = mesh.polyslength;
        if (polyCount <= 0) {
            gridW = gridH = 0;
            cellStart = new Uint32Array(0);
            cellItems = new Int32Array(0);
            return;
        }
        // 假设mesh.polys为TypedArray，每个poly用起止索引
        // mesh.polys: [start0, end0, start1, end1, ...]，verts为flat xyz数组
        const c0x = new Int32Array(polyCount);
        const c1x = new Int32Array(polyCount);
        const c0y = new Int32Array(polyCount);
        const c1y = new Int32Array(polyCount);

        let minCellX = Infinity;
        let minCellY = Infinity;
        let maxCellX = -Infinity;
        let maxCellY = -Infinity;
        // pass1: 每个 poly 的 cell AABB + 全局边界
        for (let i = 0; i < polyCount; i++) {
            const start = mesh.polys[i << 1];
            const end = mesh.polys[(i << 1) + 1];

            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            for (let vi = start; vi <= end; vi++) {
                const v3 = vi * 3;
                const x = mesh.verts[v3];
                const y = mesh.verts[v3 + 1];
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }

            const x0 = Math.floor(minX / spatialCellSize);
            const x1 = Math.floor(maxX / spatialCellSize);
            const y0 = Math.floor(minY / spatialCellSize);
            const y1 = Math.floor(maxY / spatialCellSize);

            c0x[i] = x0; c1x[i] = x1;
            c0y[i] = y0; c1y[i] = y1;

            if (x0 < minCellX) minCellX = x0;
            if (y0 < minCellY) minCellY = y0;
            if (x1 > maxCellX) maxCellX = x1;
            if (y1 > maxCellY) maxCellY = y1;
        }

        gridMinX = minCellX;
        gridMinY = minCellY;
        gridW = (maxCellX - minCellX + 1) | 0;
        gridH = (maxCellY - minCellY + 1) | 0;

        const N = gridW * gridH;
        const cellCount = new Uint32Array(N);

        // pass2: 统计每个 cell 的候选数量
        for (let i = 0; i < polyCount; i++) {
            for (let y = c0y[i]; y <= c1y[i]; y++) {
                const row = (y - gridMinY) * gridW;
                for (let x = c0x[i]; x <= c1x[i]; x++) {
                    const idx = row + (x - gridMinX);
                    cellCount[idx]++;
                }
            }
        }

        // prefix sum -> cellStart (N+1)
        cellStart = new Uint32Array(N + 1);
        for (let i = 0; i < N; i++) {
            cellStart[i + 1] = cellStart[i] + cellCount[i];
        }

        cellItems = new Int32Array(cellStart[N]);
        const writePtr = new Uint32Array(cellStart.subarray(0, N));

        // pass3: 写入 poly 索引
        for (let i = 0; i < polyCount; i++) {
            for (let y = c0y[i]; y <= c1y[i]; y++) {
                const row = (y - gridMinY) * gridW;
                for (let x = c0x[i]; x <= c1x[i]; x++) {
                    const idx = row + (x - gridMinX);
                    const w = writePtr[idx]++;
                    cellItems[w] = i;
                }
            }
        }
    }
    /**
     * 返回包含点的 poly index，找不到返回 -1
     * @param {Vector} p
     * @param {NavMeshMesh} mesh
     * @param {FunnelHeightFixer}[heightfixer]
     * @param {boolean} [findall=false] 
     */
    static findNearestPoly(p, mesh, heightfixer,findall=false) {
        //Instance.DebugSphere({center:{x:p.x,y:p.y,z:p.z},radius:2,duration:30,color:{r:255,g:255,b:255}});
        if (gridW <= 0 || gridH <= 0 || cellStart.length === 0) {
            return { pos: p, poly: -1 };
        }
        let bestPoly = -1;
        let bestDist = Infinity;
        let bestPos = p;
        const cx = Math.floor(p.x / spatialCellSize);
        const cy = Math.floor(p.y / spatialCellSize);
        for(let ring=0;ring<=1;ring++)
        {
            let inpoly=false;
            for (let i = -ring; i <= ring; i++)
            {
                const x = cx + i;
                if (x < gridMinX || x >= gridMinX + gridW) continue;
                for (let j = -ring; j <= ring; j++) {
                    if(i+j<ring)continue;
                    const y = cy + j;
                    if (y < gridMinY || y >= gridMinY + gridH) continue;
                    const idx = (y - gridMinY) * gridW + (x - gridMinX);
                    const begin = cellStart[idx];
                    const end = cellStart[idx + 1];
                    for (let it = begin; it < end; it++) {
                        const polyIdx = cellItems[it];
                        // TypedArray结构：每个poly用起止索引
                        const start = mesh.polys[polyIdx * 2];
                        const end = mesh.polys[polyIdx * 2 + 1];
                        // 传递顶点索引区间给closestPointOnPoly
                        const cp = closestPointOnPoly(p, mesh.verts, start, end);
                        if (!cp) continue;
                        if (cp.in === true) {
                            const h = heightfixer?._getHeightOnDetail(polyIdx, p);
                            cp.z = h ?? cp.z;
                            inpoly=true;
                        }
                        const dx = cp.x - p.x;
                        const dy = cp.y - p.y;
                        const dz = cp.z - p.z;
                        const d = dx * dx + dy * dy + dz * dz;
                        if (d < bestDist) {
                            bestDist = d;
                            bestPoly = polyIdx;
                            bestPos = cp;
                        }
                    }
                }
            }
            if(inpoly && !findall)break;
        }
        return { pos: bestPos, poly: bestPoly };
    }
    /**
     * 导出时只保留已使用长度，避免打印大量尾部 0。
     * @param {import("../path_tilemanager").TileData} td
     */
    static _compactTileData(td) {
        return {
            tileId: td.tileId,
            tx: td.tx,
            ty: td.ty,
            mesh: this._compactMesh(td.mesh),
            detail: this._compactDetail(td.detail, td.mesh?.polyslength ?? 0),
            links: this._compactLinks(td.links)
        };
    }

    /**
     * 将多边形网格的 TypedArray 按有效长度切片压缩为普通数组，用于 JSON 序列化。
     * @param {import("../path_manager").NavMeshMesh} mesh
     */
    static _compactMesh(mesh) {
        const polyslength = mesh.polyslength;
        const vertslength = mesh.vertslength;
        const polys = this._typedSlice(mesh.polys, polyslength * 2);
        const verts = this._typedSlice(mesh.verts, vertslength * 3);
        const regions = this._typedSlice(mesh.regions, polyslength);
        /** @type {number[][][]} */
        const neighbors = new Array(polyslength);
        for (let p = 0; p < polyslength; p++) {
            const start = polys[p * 2];
            const end = polys[p * 2 + 1];
            const edgeCount = Math.max(0, end - start + 1);
            const edgeLists = new Array(edgeCount);
            const srcEdges = mesh.neighbors[p];
            for (let e = 0; e < edgeCount; e++) {
                const list = srcEdges[e];
                const count = list[0];
                const used = Math.max(1, count + 1);
                edgeLists[e] = this._typedSlice(list, used);
            }
            neighbors[p] = edgeLists;
        }
        return { verts, vertslength, polys, polyslength, regions, neighbors };
    }

    /**
     * 将细节网格的 TypedArray 按有效长度切片压缩为普通数组，用于 JSON 序列化。
     * @param {import("../path_manager").NavMeshDetail} detail
     * @param {number} polyCount
     */
    static _compactDetail(detail, polyCount) {
        const vertslength = detail.vertslength;
        const trislength = detail.trislength;
        return {
            verts: this._typedSlice(detail.verts, vertslength * 3),
            vertslength,
            tris: this._typedSlice(detail.tris, trislength * 3),
            trislength,
            triTopoly: this._typedSlice(detail.triTopoly, trislength),
            baseVert: this._typedSlice(detail.baseVert, polyCount),
            vertsCount: this._typedSlice(detail.vertsCount, polyCount),
            baseTri: this._typedSlice(detail.baseTri, polyCount),
            triCount: this._typedSlice(detail.triCount, polyCount)
        };
    }

    /**
     * 将特殊连接点数据的 TypedArray 按有效长度切片压缩为普通数组，用于 JSON 序列化。
     * @param {import("../path_manager").NavMeshLink} links
     */
    static _compactLinks(links) {
        const len = links.length;
        return {
            poly: this._typedSlice(links.poly, len * 2),
            cost: this._typedSlice(links.cost, len),
            type: this._typedSlice(links.type, len),
            pos: this._typedSlice(links.pos, len * 6),
            length: len
        };
    }

    /**
     * TypedArray / Array 按有效长度切片并转普通数组，便于 JSON 紧凑输出。
     * @param {number} usedLen
     * @param {Uint16Array<ArrayBufferLike> | Float32Array<ArrayBufferLike> | Int32Array<ArrayBufferLike> | Int16Array<ArrayBufferLike> | Uint8Array<ArrayBufferLike>} arr
     */
    static _typedSlice(arr, usedLen) {
        const n = Math.max(0, usedLen | 0);
        if (!arr) return [];
        return Array.from(arr.subarray(0, n));
    }

    /**
     * 把导出的普通对象 mesh 恢复为 TypedArray 结构。
     * @param {{
     *  verts: number[],
     *  vertslength: number,
     *  polys: number[],
     *  polyslength: number,
     *  regions?: number[],
     *  neighbors?: number[][][]
     * }} mesh
     * @returns {import("../path_manager").NavMeshMesh}
     */
    static toTypedMesh(mesh) {
        const polyslength = mesh?.polyslength ?? ((mesh?.polys?.length ?? 0) >> 1);
        const vertslength = mesh?.vertslength ?? Math.floor((mesh?.verts?.length ?? 0) / 3);

        const typedPolys = new Int32Array(mesh?.polys ?? []);
        const typedVerts = new Float32Array(mesh?.verts ?? []);
        const typedRegions = new Int16Array(
            (mesh?.regions && mesh.regions.length > 0) ? mesh.regions : new Array(polyslength).fill(0)
        );

        /** @type {Int16Array[][]} */
        const typedNeighbors = new Array(polyslength);
        for (let p = 0; p < polyslength; p++) {
            const start = typedPolys[p << 1];
            const end = typedPolys[(p << 1) + 1];
            const edgeCount = Math.max(0, end - start + 1);
            const srcEdges = mesh?.neighbors?.[p] ?? [];
            const edgeLists = new Array(edgeCount);

            for (let e = 0; e < edgeCount; e++) {
                const srcList = srcEdges[e] ?? [0];
                const count = Math.max(0, srcList[0] | 0);
                const len = Math.max(1, count + 1);
                const out = new Int16Array(len);
                out[0] = count;
                for (let i = 1; i < len && i < srcList.length; i++) {
                    out[i] = srcList[i] | 0;
                }
                edgeLists[e] = out;
            }

            typedNeighbors[p] = edgeLists;
        }

        return {
            verts: typedVerts,
            vertslength,
            polys: typedPolys,
            polyslength,
            regions: typedRegions,
            neighbors: typedNeighbors
        };
    }

    /**
     * 把导出的普通对象 detail 恢复为 TypedArray 结构。
     * @param {{
     *  verts: number[],
     *  vertslength: number,
     *  tris: number[],
     *  trislength: number,
     *  triTopoly: number[],
     *  baseVert: number[],
     *  vertsCount: number[],
     *  baseTri: number[],
     *  triCount: number[]
     * }} detail
     * @returns {import("../path_manager").NavMeshDetail}
     */
    static toTypedDetail(detail) {
        const vertslength = detail?.vertslength ?? Math.floor((detail?.verts?.length ?? 0) / 3);
        const trislength = detail?.trislength ?? Math.floor((detail?.tris?.length ?? 0) / 3);
        return {
            verts: new Float32Array(detail?.verts ?? []),
            vertslength,
            tris: new Uint16Array(detail?.tris ?? []),
            trislength,
            triTopoly: new Uint16Array(detail?.triTopoly ?? []),
            baseVert: new Uint16Array(detail?.baseVert ?? []),
            vertsCount: new Uint16Array(detail?.vertsCount ?? []),
            baseTri: new Uint16Array(detail?.baseTri ?? []),
            triCount: new Uint16Array(detail?.triCount ?? [])
        };
    }

    /**
     * 把导出的普通对象 links 恢复为 TypedArray 结构。
     * @param {{
     *  poly: number[],
     *  cost: number[],
     *  type: number[],
     *  pos: number[],
     *  length: number
     * }} links
     * @returns {import("../path_manager").NavMeshLink}
     */
    static toTypedLinks(links) {
        const length = links?.length ?? Math.min(
            Math.floor((links?.poly?.length ?? 0) / 2),
            links?.cost?.length ?? 0,
            links?.type?.length ?? 0,
            Math.floor((links?.pos?.length ?? 0) / 6)
        );
        return {
            poly: new Uint16Array(links?.poly ?? []),
            cost: new Float32Array(links?.cost ?? []),
            type: new Uint8Array(links?.type ?? []),
            pos: new Float32Array(links?.pos ?? []),
            length
        };
    }
}

/**
 * @module 导航网格/A星寻路
 */

/** @typedef {import("./path_manager").NavMeshMesh} NavMeshMesh */
/** @typedef {import("./path_manager").NavMeshLink} NavMeshLink */
/** @typedef {import("cs_script/point_script").Vector} Vector */

/**
 * A* 多边形图寻路器。
 *
 * 在多边形邻接图上使用启发式距离执行 A* 搜索，
 * 返回起点到终点的多边形序列路径。
 * 内部使用 MinHeap 作为优先队列，支持跨 Tile 的 Link 连接。
 *
 * @navigationTitle A* 寻路器
 */
class PolyGraphAStar {
    /**
     * 初始化 A* 寻路器，绑定网格数据、链接映射和高度修正器。
    * @param {NavMeshMesh} polys
    * @param {Map<number,import("./path_manager").NavMeshLinkARRAY[]>} links
     * @param {FunnelHeightFixer} heightfixer
     */
    constructor(polys, links, heightfixer) {
        /** @type {NavMeshMesh} 导航网格数据引用 */
        this.mesh = polys;
        /** @type {number} 多边形总数 */
        this.polyCount = polys.polyslength;
        /**@type {Map<number,import("./path_manager").NavMeshLinkARRAY[]>} 特殊连接点映射（跳点/梯子/传送门） */
        this.links = links;
        /** @type {FunnelHeightFixer} 高度修正器引用 */
        this.heightfixer = heightfixer;
        //预计算中心点
        this.centers = new Array(this.polyCount);
        for (let i = 0; i < this.polyCount; i++) {
            const startVert = this.mesh.polys[i * 2];
            const endVert = this.mesh.polys[i * 2 + 1];
            let x = 0, y = 0, z = 0;
            for (let vi = startVert; vi <= endVert; vi++) {
                const base = vi * 3;
                x += this.mesh.verts[base];
                y += this.mesh.verts[base + 1];
                z += this.mesh.verts[base + 2];
            }
            const n = endVert - startVert + 1;
            this.centers[i] = {
                x: x / n,
                y: y / n,
                z: z / n
            };
        }
        /** @type {number} 启发式估价缩放系数的平方 */
        this.heuristicScale = ASTAR_HEURISTIC_SCALE*ASTAR_HEURISTIC_SCALE;
        /** @type {MinHeap} A* 内部优先队列 */
        this.open = new MinHeap(this.polyCount);
    }

    /**
     * 从世界坐标寻路。
     *
     * 将起点/终点投射到最近多边形，然后调用 {@link findPolyPath}
     * 执行 A* 搜索。若起终点在同一多边形则直接返回。
     *
     * @param {import("cs_script/point_script").Vector} start 起点世界坐标
     * @param {import("cs_script/point_script").Vector} end 终点世界坐标
     * @returns {{start: Vector, end: Vector, path: {id: number, mode: number}[]}} 投影后的起终点及多边形序列路径
     */
    findPath(start, end) {
        const startPoly = Tool.findNearestPoly(start, this.mesh,this.heightfixer,true);
        const endPoly = Tool.findNearestPoly(end, this.mesh,this.heightfixer,true);
        //Instance.Msg(startPoly.poly+"   "+endPoly.poly);
        if (startPoly.poly < 0 || endPoly.poly < 0) {
            Instance.Msg(`跑那里去了?`);
            return { start: startPoly.pos, end: endPoly.pos, path: [] };
        }

        if (startPoly.poly == endPoly.poly) {
            return { start: startPoly.pos, end: endPoly.pos, path: [{ id: endPoly.poly, mode: PathState$1.WALK }] };
        }
        return { start: startPoly.pos, end: endPoly.pos, path: this.findPolyPath(startPoly.poly, endPoly.poly) };
    }
    /**
     * A* 多边形图搜索。
     *
     * 在多边形邻接图上执行带启发式的 A* 搜索，同时考虑
     * 普通邻接边和特殊连接点（跳点/梯子/传送门）。
     * 若未找到终点则返回距终点最近的可达多边形路径。
     *
     * @param {number} start 起始多边形 ID
     * @param {number} end 目标多边形 ID
     * @returns {{id: number, mode: number}[]} 多边形序列路径，每项包含多边形 ID 和移动模式
     */
    findPolyPath(start, end) {
        const open = this.open;
        const g = new Float32Array(this.polyCount);
        const parent = new Int32Array(this.polyCount);
        const walkMode = new Uint8Array(this.polyCount);// 0=none,1=walk,2=jump,//待更新3=climb
        const state = new Uint8Array(this.polyCount); // 0=none,1=open,2=closed
        g.fill(Infinity);
        parent.fill(-1);
        open.clear();
        g[start] = 0;
        open.push(start, this.distsqr(start, end) * this.heuristicScale);
        state[start] = 1;

        let closestNode = start;
        let minH = Infinity;

        while (!open.isEmpty()) {
            const current = open.pop();

            if (current === end) return this.reconstruct(parent, walkMode, end);
            state[current] = 2;

            const hToTarget = this.distsqr(current, end);
            if (hToTarget < minH) {
                minH = hToTarget;
                closestNode = current;
            }

            const neighbors = this.mesh.neighbors[current];
            if (neighbors)
            {
                for (let i = 0; i < neighbors.length; i++) {
                    const entry = neighbors[i];
                    if (!entry) continue;
                    const count = entry[0];
                    if (count <= 0) continue;
                    for (let k = 1; k <= count; k++) {
                        const n = entry[k];
                        if (state[n] == 2) continue;
                        const tentative = g[current] + this.distsqr(current, n);
                        if (tentative < g[n]) {
                            parent[n] = current;
                            walkMode[n] = PathState$1.WALK;
                            g[n] = tentative;
                            const f = tentative + this.distsqr(n, end) * this.heuristicScale;
                            if (state[n] != 1) {
                                open.push(n, f);
                                state[n] = 1;
                            } else open.update(n, f);
                        }
                    }
                }
            }
            const linkSet = this.links.get(current);
            if (!linkSet) continue;
            for (const link of linkSet) {
                let v = -1;
                if (link.PolyA == current) v = link.PolyB;
                else if (link.PolyB == current) v = link.PolyA;
                if (v == -1 || state[v] == 2) continue;
                const moveCost = link.cost;
                if (g[current] + moveCost < g[v]) {
                    g[v] = g[current] + moveCost;

                    const f = g[v] + this.distsqr(v, end) * this.heuristicScale;
                    parent[v] = current;
                    walkMode[v] = link.type;
                    if (state[v] != 1) {
                        open.push(v, f);
                        state[v] = 1;
                    }
                    else open.update(v, f);
                }
            }
            //for (let li = 0; li < linkSet.length; li++) {
            //    let v = -1;
            //    const a = linkSet.poly[li * 2];
            //    const b = linkSet.poly[li * 2 + 1];
            //    if (a === current) v = b;
            //    else if (b === current) v = a;
            //    if (state[v] == 2) continue;
            //    const moveCost = linkSet.cost[li];
            //    if (g[current] + moveCost < g[v]) {
            //        g[v] = g[current] + moveCost;
            //        const f = g[v] + this.distsqr(v, end) * this.heuristicScale;
            //        parent[v] = current;
            //        walkMode[v] = linkSet.type[li];
            //        if (state[v] != 1) {
            //            open.push(v, f);
            //            state[v] = 1;
            //        }
            //        else open.update(v, f);
            //    }
            //}
        }
        return this.reconstruct(parent, walkMode, closestNode);
    }
    /**
     * 从 parent 数组重建路径。
     *
     * 沿 parent 链回溯并反转，产生从起点到 cur 的多边形序列。
     *
     * @param {Int32Array} parent 每个多边形的前驱索引
     * @param {Uint8Array} walkMode 每个多边形的移动方式
     * @param {number} cur 终点多边形 ID
     * @returns {{id: number, mode: number}[]}
     */
    reconstruct(parent, walkMode, cur) {
        const path = [];
        while (cur !== -1) {
            path.push({ id: cur, mode: walkMode[cur] });
            cur = parent[cur];
        }
        return path.reverse();
    }

    /**
     * 计算两个多边形中心点的欧氏距离（非平方）。
     *
     * 用作 A* 的边代价和启发式估价。
     *
     * @param {number} a 多边形 ID
     * @param {number} b 多边形 ID
     * @returns {number} 两个多边形中心点的欧氏距离
     */
    distsqr(a, b) {
        const pa = this.centers[a];
        const pb = this.centers[b];
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        const dz = pa.z - pb.z;
        //return Math.sqrt(dx * dx + dy * dy + dz * dz);
        return dx * dx + dy * dy + dz * dz;
    }
}
/**
 * 二叉最小堆，A* 内部使用的优先队列。
 */
class MinHeap {
    /**
     * 创建指定容量的二叉最小堆。
     * @param {number} polyCount
     */
    constructor(polyCount) {
        this.nodes = new Uint16Array(polyCount);
        this.costs = new Float32Array(polyCount);
        this.index = new Int16Array(polyCount).fill(-1);
        this.size = 0;
    }
    clear() {
        this.index.fill(-1);
        this.size = 0;
    }
    isEmpty() {
        return this.size === 0;
    }

    /**
     * 将节点以指定代价插入堆中，并上浮维护堆序。
     * @param {number} node
     * @param {number} cost
     */
    push(node, cost) {
        let i = this.size++;
        this.nodes[i] = node;
        this.costs[i] = cost;
        this.index[node] = i;
        this._up(i);
    }

    pop() {
        if (this.size === 0) return -1;
        const topNode = this.nodes[0];
        this.index[topNode] = -1;
        this.size--;
        if (this.size > 0) {
            this.nodes[0] = this.nodes[this.size];
            this.costs[0] = this.costs[this.size];
            this.index[this.nodes[0]] = 0;
            this._down(0);
        }
        return topNode;
    }

    /**
     * 更新已有节点的代价并上浮调整位置。
     * @param {number} node
     * @param {number} cost
     */
    update(node, cost) {
        const i = this.index[node];
        if (i < 0) return;
        this.costs[i] = cost;
        this._up(i);
    }

    /**
     * 从索引 i 向上冒泡，维护最小堆性质。
     * @param {number} i
     */
    _up(i) {
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.costs[p] <= this.costs[i]) break;
            this._swap(i, p);
            i = p;
        }
    }

    /**
     * 从索引 i 向下筛选，维护最小堆性质。
     * @param {number} i
     */
    _down(i) {
        const n = this.size;
        while (true) {
            let l = i * 2 + 1;
            let r = l + 1;
            let m = i;

            if (l < n && this.costs[l] < this.costs[m]) m = l;
            if (r < n && this.costs[r] < this.costs[m]) m = r;
            if (m === i) break;

            this._swap(i, m);
            i = m;
        }
    }

    /**
     * 交换堆中两个位置的节点、代价及反向索引。
     * @param {number} a
     * @param {number} b
     */
    _swap(a, b) {
        const ca = this.costs[a];
        const cb = this.costs[b];
        const na = this.nodes[a];
        const nb = this.nodes[b];
        this.costs[a] = cb;
        this.costs[b] = ca;
        this.nodes[a] = nb;
        this.nodes[b] = na;
        this.index[na] = b;
        this.index[nb] = a;
    }
}

/**
 * @module 导航网格/向量工具
 */
/** @typedef {import("cs_script/point_script").Vector} Vector */

/**
 * 轻量向量工具类（无状态静态方法）。
 *
 * 所有方法返回新对象，不修改传入参数。
 * `2D` 后缀表示仅计算 XY 分量。
 *
 * @navigationTitle 向量工具
 */
class vec {
    /**
     * 三维向量加法。
     *
     * @param {Vector} a
     * @param {Vector} b
     * @returns {Vector}
     */
    static add(a, b) {
        return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
    }

    /**
     * 二维向量加法（仅累加 XY，z 保留 a.z）。
     *
     * @param {Vector} a
     * @param {Vector} b
     * @returns {Vector}
     */
    static add2D(a, b) {
        return { x: a.x + b.x, y: a.y + b.y, z: a.z };
    }

    /**
     * 三维向量减法。
     *
     * @param {Vector} a
     * @param {Vector} b
     * @returns {Vector}
     */
    static sub(a, b) {
        return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
    }

    /**
     * 三维向量按标量缩放。
     *
     * @param {Vector} a
     * @param {number} s
     * @returns {Vector}
     */
    static scale(a, s) {
        return { x: a.x * s, y: a.y * s, z: a.z * s };
    }

    /**
     * 二维向量按标量缩放（仅缩放 XY，z 保留 a.z）。
     *
     * @param {Vector} a
     * @param {number} s
     * @returns {Vector}
     */
    static scale2D(a, s) {
        return {
            x: a.x * s,
            y: a.y * s,
            z: a.z
        };
    }

    /**
     * 构造一个向量对象。
     *
     * @param {number} [x]
     * @param {number} [y]
     * @param {number} [z]
     * @returns {Vector}
     */
    static get(x = 0, y = 0, z = 0) {
        return { x, y, z };
    }

    /**
     * 克隆向量。
     *
     * @param {Vector} a
     * @returns {Vector}
     */
    static clone(a) {
        return { x: a.x, y: a.y, z: a.z };
    }

    /**
     * 计算三维欧氏距离。
     * b 缺省时按原点处理。
     *
     * @param {Vector} a
     * @param {Vector} [b]
     * @returns {number}
     */
    static length(a, b = { x: 0, y: 0, z: 0 }) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    /**
     * 计算三维欧氏距离平方。
     * b 缺省时按原点处理。
     *
     * @param {Vector} a
     * @param {Vector} [b]
     * @returns {number}
     */
    static lengthsq(a, b = { x: 0, y: 0, z: 0 }) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        return dx * dx + dy * dy + dz * dz;
    }
    /**
     * 计算二维欧氏距离（仅 XY）。
     * b 缺省时按原点处理。
     *
     * @param {Vector} a
     * @param {Vector} [b]
     * @returns {number}
     */
    static length2D(a, b = { x: 0, y: 0, z: 0 }) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    /**
     * 计算二维欧氏距离平方（仅 XY）。
     * b 缺省时按原点处理。
     *
     * @param {Vector} a
     * @param {Vector} [b]
     * @returns {number}
     */
    static length2Dsq(a, b = { x: 0, y: 0, z: 0 }) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return dx * dx + dy * dy;
    }
    /**
     * 返回点在 Z 轴上偏移后的新坐标。
     *
     * @param {Vector} pos
     * @param {number} height
     * @returns {Vector}
     */
    static Zfly(pos, height) {
        return { x: pos.x, y: pos.y, z: pos.z + height };
    }

    /**
     * 输出向量坐标到游戏消息。
     *
     * @param {Vector} pos
     */
    static msg(pos) {
        Instance.Msg(`{${pos.x} ${pos.y} ${pos.z}}`);
    }

    /**
     * 三维点积。
     *
     * @param {Vector} a
     * @param {Vector} b
     * @returns {number}
     */
    static dot(a, b) {
        return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    /**
     * 二维点积（仅 XY）。
     *
     * @param {Vector} a
     * @param {Vector} b
     * @returns {number}
     */
    static dot2D(a, b) {
        return a.x * b.x + a.y * b.y;
    }

    /**
     * 三维叉积。
     *
     * @param {Vector} a
     * @param {Vector} b
     * @returns {Vector}
     */
    static cross(a, b) {
        return {
            x: a.y * b.z - a.z * b.y,
            y: a.z * b.x - a.x * b.z,
            z: a.x * b.y - a.y * b.x
        };
    }

    /**
     * 三维单位化。
     * 当长度过小（<1e-6）时返回零向量，避免除零。
     *
     * @param {Vector} a
     * @returns {Vector}
     */
    static normalize(a) {
        const len = this.length(a);
        if (len < 1e-6) {
            return { x: 0, y: 0, z: 0 };
        }
        return this.scale(a, 1 / len);
    }

    /**
     * 二维单位化（仅 XY，返回 z=0）。
     * 当长度过小（<1e-6）时返回零向量。
     *
     * @param {Vector} a
     * @returns {Vector}
     */
    static normalize2D(a) {
        const len = this.length2D(a);
        if (len < 1e-6) {
            return { x: 0, y: 0, z: 0 };
        }
        return {
            x: a.x / len,
            y: a.y / len,
            z: 0
        };
    }

    /**
     * 判断是否为近似零向量。
     *
     * @param {Vector} a
     * @returns {boolean}
     */
    static isZero(a) {
        return (
            Math.abs(a.x) < 1e-6 &&
            Math.abs(a.y) < 1e-6 &&
            Math.abs(a.z) < 1e-6
        );
    }
}

/**
 * @module 导航网格/漏斗算法
 */
/** @typedef {import("cs_script/point_script").Vector} Vector */
/** @typedef {import("./path_manager").NavMeshMesh} NavMeshMesh */
/** @typedef {import("./path_manager").NavMeshLink} NavMeshLink */
/**
 * 漏斗路径平滑器。
 *
 * 将 A* 返回的多边形序列转换为平滑的航路点列表。
 * 使用字符串拉扯算法（String Pulling）在 Portal 序列上
 * 求出最短路径，支持 Link（跳跃/梯子/传送门）穿越。
 *
 * @navigationTitle 漏斗路径平滑
 */
class FunnelPath {
    /**
     * 初始化漏斗路径平滑器，绑定网格、多边形中心点和链接数据。
    * @param {NavMeshMesh} mesh
     * @param {Vector[]} centers
     * @param {Map<number,import("./path_manager").NavMeshLinkARRAY[]>} links 每个poly映射到typed link容器
     */
    constructor(mesh, centers, links) {
        /** @type {NavMeshMesh} 导航网格数据引用 */
        this.mesh = mesh;
        /** @type {Vector[]} 每个多边形的中心点数组 */
        this.centers = centers;
        /**@type {Map<number,import("./path_manager").NavMeshLinkARRAY[]>} 特殊连接点映射 */
        this.links = links;
        //Instance.Msg(this.links.size);
    }
    /**
     * 查找两个多边形之间的特殊连接点。
     *
     * 返回从 polyA 到 polyB 的跳点/梯子/传送门坐标对。
     *
     * @param {number} polyA 起始多边形 ID
     * @param {number} polyB 目标多边形 ID
     * @returns {{start: Vector, end: Vector}|undefined} 连接点坐标对
     */
    getlink(polyA, polyB) {
        const linkSet = this.links.get(polyA);
        if (!linkSet) return;
        for (const link of linkSet) {
            if (link.PolyB == polyB) return { start: link.PosB, end: link.PosA };
            if(link.PolyA == polyB)return { start: link.PosA, end: link.PosB };
        }
        //for (let i = 0; i < linkSet.length; i++) {
        //    const a = linkSet.poly[i<<1];
        //    const b = linkSet.poly[(i<<1) + 1];
        //    const posBase = i * 6;
        //    if (a === polyA && b === polyB) {
        //        return {
        //            start: {
        //                x: linkSet.pos[posBase + 3],
        //                y: linkSet.pos[posBase + 4],
        //                z: linkSet.pos[posBase + 5]
        //            },
        //            end: {
        //                x: linkSet.pos[posBase],
        //                y: linkSet.pos[posBase + 1],
        //                z: linkSet.pos[posBase + 2]
        //            }
        //        };
        //    }
        //    if (a === polyB && b === polyA) {
        //        return {
        //            start: {
        //                x: linkSet.pos[posBase],
        //                y: linkSet.pos[posBase + 1],
        //                z: linkSet.pos[posBase + 2]
        //            },
        //            end: {
        //                x: linkSet.pos[posBase + 3],
        //                y: linkSet.pos[posBase + 4],
        //                z: linkSet.pos[posBase + 5]
        //            }
        //        };
        //    }
        //}
    }
    /**
     * 构建平滑路径。
     *
     * 将 A* 返回的多边形序列转换为世界坐标航路点列表。
     * 遇到特殊连接点（JUMP/LADDER/PORTAL）时分段处理，
     * 每段通过 Portal 构建 + String Pull 进行路径平滑。
     *
     * @param {{id:number,mode:number}[]} polyPath 多边形序列路径
     * @param {Vector} startPos 起点世界坐标
     * @param {Vector} endPos 终点世界坐标
     * @returns {{pos:Vector,mode:number}[]} 平滑后的航路点列表
     */
    build(polyPath, startPos, endPos) {
        if (!polyPath || polyPath.length === 0) return [];
        if (polyPath.length === 1) return [{pos:startPos,mode:PathState$1.WALK}, {pos:endPos,mode:PathState$1.WALK}];
        const ans = [];
        // 当前这一段行走路径的起点坐标
        let currentSegmentStartPos = startPos;
        // 当前这一段行走路径在 polyPath 中的起始索引
        let segmentStartIndex = 0;
        for (let i = 1; i < polyPath.length; i++) {
            const prevPoly = polyPath[i - 1];
            const currPoly = polyPath[i];
            if (currPoly.mode !=PathState$1.WALK)// 到第 i 个多边形需要特殊过渡（跳跃/梯子/传送）
            {
                // 1. 获取跳点坐标信息
                const linkInfo = this.getlink(currPoly.id,prevPoly.id);
                if (!linkInfo)continue;
                const portals = this.buildPortals(polyPath,segmentStartIndex,i-1, currentSegmentStartPos, linkInfo.start, FUNNEL_DISTANCE);
                const smoothedWalk = this.stringPull(portals);
                for (const p of smoothedWalk) ans.push({pos:p,mode:PathState$1.WALK});
                ans.push({pos:linkInfo.end,mode:currPoly.mode});
                currentSegmentStartPos = linkInfo.end; // 下一段从落地点开始
                segmentStartIndex = i; // 下一段多边形从 currPoly 开始
            }
        }
        const lastPortals = this.buildPortals(polyPath, segmentStartIndex, polyPath.length-1, currentSegmentStartPos, endPos, FUNNEL_DISTANCE);
        const lastSmoothed = this.stringPull(lastPortals);

        for (const p of lastSmoothed) ans.push({pos:p,mode:PathState$1.WALK});
        return this.removeDuplicates(ans);
    }
    /**
     * 移除相邻重复点。
     *
     * 防止相邻航路点坐标完全一致，使用平方距离容差 > 1 进行判定。
     *
     * @param {{pos:Vector,mode:number}[]} path 原始路径
     * @returns {{pos:Vector,mode:number}[]} 去重后的路径
     */
    removeDuplicates(path) {
        if (path.length < 2) return path;
        const res = [path[0]];
        for (let i = 1; i < path.length; i++) {
            const last = res[res.length - 1];
            const curr = path[i];
            const d = (last.pos.x - curr.pos.x) ** 2 + (last.pos.y - curr.pos.y) ** 2 + (last.pos.z - curr.pos.z) ** 2;
            // 容差阈值
            if (d > 1) {
                res.push(curr);
            }
        }
        return res;
    }
    /* ===============================
       Portal Construction
    =============================== */

    /**
     * 构建 Portal 序列。
     *
     * 为多边形序列中每对相邻多边形查找公共边（Portal），
     * 首尾加入起终点作为退化 Portal，供 String Pull 使用。
     *
     * @param {{id:number,mode:number}[]} polyPath 多边形序列
     * @param {number} start 起始索引
     * @param {number} end 结束索引
     * @param {Vector} startPos 起点坐标
     * @param {Vector} endPos 终点坐标
     * @param {number} funnelDistance 收缩比例
     * @returns {{left:Vector,right:Vector}[]} Portal 序列
     */
    buildPortals(polyPath, start, end, startPos, endPos, funnelDistance) {
        const portals = [];

        // 起点
        portals.push({ left: startPos, right: startPos });
        for (let i = start; i < end; i++) {
            const a = polyPath[i].id;
            const b = polyPath[i + 1].id;
            const por = this.findPortal(a, b, funnelDistance);
            if (!por) continue;
            //Instance.DebugLine({start:vec.Zfly(por.left,5),end:vec.Zfly(por.right,5),color:{r:0,g:0,b:255},duration:1/32});
            portals.push(por);
        }
        // 终点
        portals.push({ left: endPos, right: endPos });
        return portals;
    }

    /**
     * 查找两个多边形的公共边（Portal）。
     *
     * 通过邻接表找到连接边，计算重叠段，
     * 并根据多边形中心方向稳定排序左右端点。
     *
     * @param {number} pa 多边形 A 的 ID
     * @param {number} pb 多边形 B 的 ID
     * @param {number} funnelDistance 收缩比例
     * @returns {{left:Vector,right:Vector}|undefined} 公共边的左右端点
     */
    findPortal(pa, pb, funnelDistance) {
        const startA = this.mesh.polys[pa * 2];
        const endA = this.mesh.polys[pa * 2 + 1];
        const countA = endA - startA + 1;
        if (countA <= 0) return;

        const startB = this.mesh.polys[pb * 2];
        const endB = this.mesh.polys[pb * 2 + 1];
        const countB = endB - startB + 1;
        if (countB <= 0) return;

        const neighA = this.mesh.neighbors[pa];
        const neighB = this.mesh.neighbors[pb];
        if (!neighA || !neighB) return;

        // 1) 在 pa 找到通向 pb 的边（找到即用）
        let a0, a1;
        for (let ea = 0; ea < countA; ea++) {
            const entry = neighA[ea];
            if (!entry) continue;
            const n = entry[0] | 0;
            let hit = false;
            for (let k = 1; k <= n; k++) {
                if (entry[k] === pb) { hit = true; break; }
            }
            if (!hit) continue;

            const va0 = startA + ea;
            const va1 = startA + ((ea + 1) % countA);
            a0 = { x: this.mesh.verts[va0 * 3], y: this.mesh.verts[va0 * 3 + 1], z: this.mesh.verts[va0 * 3 + 2] };
            a1 = { x: this.mesh.verts[va1 * 3], y: this.mesh.verts[va1 * 3 + 1], z: this.mesh.verts[va1 * 3 + 2] };
            break;
        }
        if (!a0 || !a1) return;

        // 2) 只从 pb 里“通向 pa”的边里找共线重叠段
        const abx = a1.x - a0.x;
        const aby = a1.y - a0.y;
        const abLen2 = abx * abx + aby * aby;
        if (abLen2 < 1e-6) return;

        let best = null;
        //Instance.DebugLine({start:vec.Zfly(a0,5),end:vec.Zfly(a1,15),color:{r:255,g:255,b:0},duration:1/32});
        
        for (let eb = 0; eb < countB; eb++) {
            const entryB = neighB[eb];
            if (!entryB) continue;
            const nb = entryB[0] | 0;

            let bConnectedToA = false;
            for (let k = 1; k <= nb; k++) {
                if (entryB[k] === pa) { bConnectedToA = true; break; }
            }
            if (!bConnectedToA) continue;

            const vb0 = startB + eb;
            const vb1 = startB + ((eb + 1) % countB);
            const b0 = { x: this.mesh.verts[vb0 * 3], y: this.mesh.verts[vb0 * 3 + 1], z: this.mesh.verts[vb0 * 3 + 2] };
            const b1 = { x: this.mesh.verts[vb1 * 3], y: this.mesh.verts[vb1 * 3 + 1], z: this.mesh.verts[vb1 * 3 + 2] };
            //Instance.DebugLine({start:vec.Zfly(b0,5),end:vec.Zfly(b1,15),color:{r:255,g:255,b:0},duration:1/32});
        

            const tb0 = ((b0.x - a0.x) * abx + (b0.y - a0.y) * aby) / abLen2;
            const tb1 = ((b1.x - a0.x) * abx + (b1.y - a0.y) * aby) / abLen2;

            const tMin = Math.max(0, Math.min(tb0, tb1));
            const tMax = Math.min(1, Math.max(tb0, tb1));
            if (tMax - tMin <= 1e-4) continue;

            const p0 = {
                x: a0.x + abx * tMin,
                y: a0.y + aby * tMin,
                z: a0.z + (a1.z - a0.z) * tMin
            };
            const p1 = {
                x: a0.x + abx * tMax,
                y: a0.y + aby * tMax,
                z: a0.z + (a1.z - a0.z) * tMax
            };

            const dx = p1.x - p0.x;
            const dy = p1.y - p0.y;
            const len2 = dx * dx + dy * dy;
            if (!best || len2 > best.len2) best = { p0, p1, len2 };
        }
        
        // 没找到重叠段就退化
        const v0 = best ? best.p0 : a0;
        const v1 = best ? best.p1 : a1;

        // 左右稳定排序（不要只看一个点）
        const ca = this.centers[pa];
        const cb = this.centers[pb];
        const s0 = area(ca, cb, v0);
        const s1 = area(ca, cb, v1);
        const left = s0 >= s1 ? v0 : v1;
        const right = s0 >= s1 ? v1 : v0;

        return this._applyFunnelDistance(right, left, funnelDistance);
        
    }
    /**
     * 点到直线（ab）在 XY 上距离平方
     * @param {Vector} p
     * @param {Vector} a
     * @param {Vector} b
     */
    _pointLineDistSq2D(p, a, b) {
        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const apx = p.x - a.x;
        const apy = p.y - a.y;
        const den = abx * abx + aby * aby;
        if (den < 1e-6) return Infinity;
        const cross = abx * apy - aby * apx;
        return (cross * cross) / den;
    }
    /**
     * 根据 funnelDistance 收缩 Portal 宽度。
     *
     * 将左右端点向中点插值，t=0 保持原样，t=100% 变为中点。
     *
     * @param {Vector} left 左端点
     * @param {Vector} right 右端点
     * @param {number} distance 收缩比例 0-100
     * @returns {{left:Vector,right:Vector}} 收缩后的端点对
     */
    _applyFunnelDistance(left, right, distance) {
        // 限制在 0-100
        const t = Tool.clamp(distance, 0, 100) / 100.0;

        // 若 t 为 0，保持原样
        if (t === 0) return { left, right };

        // 计算中点
        const midX = (left.x + right.x) * 0.5;
        const midY = (left.y + right.y) * 0.5;
        const midZ = (left.z + right.z) * 0.5;
        const mid = { x: midX, y: midY, z: midZ };

        // 使用线性插值将端点向中点移动
        // t=0 保持端点, t=1 变成中点
        const newLeft = Tool.lerpVector(left, mid, t);
        const newRight = Tool.lerpVector(right, mid, t);

        return { left: newLeft, right: newRight };
    }
    /* ===============================
       Funnel (String Pull)
    =============================== */

    /**
     * 字符串拉扯算法（String Pulling）。
     *
     * 在 Portal 序列上执行漏斗算法，产生最短路径点序列。
     * 通过维护左右边界并在交叉时插入拐点。
     *
     * @param {{left:Vector,right:Vector}[]} portals Portal 序列
     * @returns {Vector[]} 平滑后的路径点序列
     */
    stringPull(portals) {
        const path = [];

        let apex = portals[0].left;
        let left = portals[0].left;
        let right = portals[0].right;

        let apexIndex = 0;
        let leftIndex = 0;
        let rightIndex = 0;

        path.push(apex);

        for (let i = 1; i < portals.length; i++) {
            const pLeft = portals[i].left;
            const pRight = portals[i].right;

            // 更新右边
            if (area(apex, right, pRight) <= 0) {
                if (apex === right || area(apex, left, pRight) > 0) {
                    right = pRight;
                    rightIndex = i;
                } else {
                    path.push(left);
                    apex = left;
                    apexIndex = leftIndex;
                    left = apex;
                    right = apex;
                    leftIndex = apexIndex;
                    rightIndex = apexIndex;
                    i = apexIndex;
                    continue;
                }
            }

            // 更新左边
            if (area(apex, left, pLeft) >= 0) {
                if (apex === left || area(apex, right, pLeft) < 0) {
                    left = pLeft;
                    leftIndex = i;
                } else {
                    path.push(right);
                    apex = right;
                    apexIndex = rightIndex;
                    left = apex;
                    right = apex;
                    leftIndex = apexIndex;
                    rightIndex = apexIndex;
                    i = apexIndex;
                    continue;
                }
            }
        }

        path.push(portals[portals.length - 1].left);
        return path;
    }
}

/**
 * @module 导航网格/静态导航数据
 */

/**
 * 预生成的静态导航数据容器。
 *
 * 内含压缩的 49 个 Tile 数据（tileId 0_0 – 6_6），
 * 可快速加载而无需实时构建。
 *
 * @navigationTitle 静态导航数据
 */
class StaticData
{
    constructor()
    {
        this.Data = ``+`{"tiles":[["0_0",{"tileId":"0_0","tx":0,"ty":0,"mesh":{"verts":[-1392,-4494,406,-888,-4494,404,-888,-3998,288,-1392,-3998,406],"vertslength":4,"polys":[0,3],"polyslength":1,"regions":[1],"neighbors":[[[0],[0],[0],[0]]]},"detail":{"verts":[-1392,-4494,403,-888,-4494,402,-888,-3998,288,-1025.45458984375,-3998,290,-1392,-3998,403],"vertslength":5,"tris":[1,2,3,3,4,0,0,1,3],"trislength":3,"triTopoly":[0,0,0],"baseVert":[0],"vertsCount":[5],"baseTri":[0],"triCount":[3]},"links":{"poly":[],"cost":[],"`
+`type":[],"pos":[],"length":0}}],["1_0",{"tileId":"1_0","tx":1,"ty":0,"mesh":{"verts":[-888,-3998,288,-888,-4494,404,-376,-4494,404,-376,-3998,288],"vertslength":4,"polys":[0,3],"polyslength":1,"regions":[1],"neighbors":[[[0],[0],[0],[0]]]},"detail":{"verts":[-888,-3998,288,-888,-4494,402,-376,-4494,402,-376,-3998,288],"vertslength":4,"tris":[3,0,1,1,2,3],"trislength":2,"triTopoly":[0,0],"baseVert":[0],"vertsCount":[4],"baseTri":[0],"triCount":[2]},"links":{"poly":[],"cost":[],"type":[],"pos":[],`
+`"length":0}}],["2_0",{"tileId":"2_0","tx":2,"ty":0,"mesh":{"verts":[-376,-3998,288,-376,-4494,404,136,-4494,404,136,-3998,288],"vertslength":4,"polys":[0,3],"polyslength":1,"regions":[1],"neighbors":[[[0],[0],[0],[0]]]},"detail":{"verts":[-376,-3998,288,-376,-4494,402,136,-4494,402,136,-3998,288],"vertslength":4,"tris":[3,0,1,1,2,3],"trislength":2,"triTopoly":[0,0],"baseVert":[0],"vertsCount":[4],"baseTri":[0],"triCount":[2]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["3_0",{`
+`"tileId":"3_0","tx":3,"ty":0,"mesh":{"verts":[136,-3998,288,136,-4494,404,648,-4494,404,648,-3998,288],"vertslength":4,"polys":[0,3],"polyslength":1,"regions":[1],"neighbors":[[[0],[0],[0],[0]]]},"detail":{"verts":[136,-3998,288,136,-4494,402,648,-4494,402,648,-3998,288],"vertslength":4,"tris":[3,0,1,1,2,3],"trislength":2,"triTopoly":[0,0],"baseVert":[0],"vertsCount":[4],"baseTri":[0],"triCount":[2]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["4_0",{"tileId":"4_0","tx":4,"ty"`
+`:0,"mesh":{"verts":[824,-4014,292,816,-3998,288,648,-3998,288,648,-4494,404,1160,-3998,354,968,-3998,296,960,-4014,294,1160,-4494,404,960,-4014,294,824,-4014,292,648,-4494,404,1160,-4494,404],"vertslength":12,"polys":[0,3,4,7,8,11],"polyslength":3,"regions":[1,1,1],"neighbors":[[[0],[0],[0],[1,2]],[[0],[0],[1,2],[0]],[[0],[1,0],[0],[1,1]]]},"detail":{"verts":[824,-4014,292,816,-3998,288,648,-3998,288,648,-4494,402,1160,-3998,354,968,-3998,299,960,-4014,296,996.3636474609375,-4101.27294921875,309`
+`,1160,-4494,402,1160,-4281.4287109375,354,960,-4014,296,824,-4014,292,648,-4494,402,1160,-4494,402,996.3636474609375,-4101.27294921875,309,948,-4026,292],"vertslength":16,"tris":[0,1,2,0,2,3,5,6,7,4,5,7,9,4,7,7,8,9,13,14,11,11,12,13,14,10,15,10,11,15,11,14,15],"trislength":11,"triTopoly":[0,0,1,1,1,1,2,2,2,2,2],"baseVert":[0,4,10],"vertsCount":[4,6,6],"baseTri":[0,2,6],"triCount":[2,4,5]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["5_0",{"tileId":"5_0","tx":5,"ty":0,"mesh":{"`
+`verts":[1160,-3998,357,1160,-4494,404,1320,-4494,404,1320,-3998,404],"vertslength":4,"polys":[0,3],"polyslength":1,"regions":[1],"neighbors":[[[0],[0],[0],[0]]]},"detail":{"verts":[1160,-3998,359,1160,-4305.0478515625,359,1160,-4494,402,1320,-4494,404,1320,-3998,404],"vertslength":5,"tris":[1,2,3,4,0,1,1,3,4],"trislength":3,"triTopoly":[0,0,0],"baseVert":[0],"vertsCount":[5],"baseTri":[0],"triCount":[3]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["6_0",{"tileId":"6_0","tx":6,`
+`"ty":0,"mesh":{"verts":[],"vertslength":0,"polys":[],"polyslength":0,"regions":[],"neighbors":[]},"detail":{"verts":[],"vertslength":0,"tris":[],"trislength":0,"triTopoly":[],"baseVert":[],"vertsCount":[],"baseTri":[],"triCount":[]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["0_1",{"tileId":"0_1","tx":0,"ty":1,"mesh":{"verts":[-1392,-3486,406,-1392,-3998,406,-888,-3998,286,-888,-3486,250,-1048,-3486,897,-1048,-3998,897,-888,-3998,897,-888,-3486,897],"vertslength":8,"polys":[0`
+`,3,4,7],"polyslength":2,"regions":[1,2],"neighbors":[[[0],[0],[0],[0]],[[0],[0],[0],[0]]]},"detail":{"verts":[-1392,-3486,403,-1392,-3998,403,-1002.5454711914062,-3998,284,-888,-3998,284,-888,-3835.0908203125,250,-888,-3486,250,-1048,-3486,897,-1048,-3998,897,-888,-3998,897,-888,-3486,897],"vertslength":10,"tris":[2,3,4,2,4,5,0,1,2,0,2,5,9,6,7,7,8,9],"trislength":6,"triTopoly":[0,0,0,0,1,1],"baseVert":[0,6],"vertsCount":[6,4],"baseTri":[0,4],"triCount":[4,2]},"links":{"poly":[],"cost":[],"type":`
+`[],"pos":[],"length":0}}],["1_1",{"tileId":"1_1","tx":1,"ty":1,"mesh":{"verts":[-744,-3590,236,-752,-3486,236,-888,-3486,247,-888,-3998,286,-376,-3998,286,-376,-3590,236,-744,-3590,236,-888,-3998,286,-888,-3486,897,-888,-3998,897,-376,-3998,897,-376,-3486,897,-736,-3574,606,-376,-3574,606,-376,-3486,606,-736,-3486,606,-728,-3566,250,-376,-3566,251,-376,-3486,313,-728,-3486,250,-376,-3494,236,-376,-3486,236,-656,-3486,236],"vertslength":23,"polys":[0,3,4,7,8,11,12,15,16,19,20,22],"polyslength":6,`
+`"regions":[2,2,1,3,4,5],"neighbors":[[[0],[0],[0],[1,1]],[[0],[0],[1,0],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[0]],[[0],[0],[0]]]},"detail":{"verts":[-744,-3590,236,-752,-3486,236,-842.6666870117188,-3486,236,-888,-3486,245,-888,-3835.0908203125,246,-888,-3998,284,-819.7894897460938,-3804.73681640625,238,-852,-3770,236,-852,-3530,236,-376,-3998,284,-376,-3794,236,-376,-3590,236,-744,-3590,236,-819.7894897460938,-3804.73681640625,238,-888,-3998,284,-888,-3486,897,-888,-3998,897,-3`
+`76,-3998,897,-376,-3486,897,-736,-3574,606,-376,-3574,606,-376,-3486,606,-736,-3486,606,-728,-3566,257,-376,-3566,258,-376,-3506,306,-376,-3486,313,-634.1333618164062,-3486,313,-657.5999755859375,-3486,307,-728,-3486,257,-644,-3506,306,-548,-3506,306,-376,-3494,236,-376,-3486,236,-656,-3486,236],"vertslength":35,"tris":[4,5,6,3,4,7,4,6,7,0,6,7,3,7,8,7,0,8,3,2,8,0,1,8,2,1,8,10,11,12,10,12,13,9,10,13,9,13,14,18,15,16,16,17,18,22,19,20,20,21,22,27,28,30,23,29,30,28,29,30,24,25,31,25,26,31,27,26,31,`
+`27,30,31,24,23,31,30,23,31,32,33,34],"trislength":27,"triTopoly":[0,0,0,0,0,0,0,0,0,1,1,1,1,2,2,3,3,4,4,4,4,4,4,4,4,4,5],"baseVert":[0,9,15,19,23,32],"vertsCount":[9,6,4,4,9,3],"baseTri":[0,9,13,15,17,26],"triCount":[9,4,2,2,9,1]},"links":{"poly":[4,5],"cost":[1084.3148193359375],"type":[2],"pos":[-656,-3486,262.8863525390625,-656,-3486,236],"length":1}}],["2_1",{"tileId":"2_1","tx":2,"ty":1,"mesh":{"verts":[64,-3582,237,64,-3486,313,-160,-3486,313,-168,-3590,236,136,-3590,236,64,-3582,237,-168,`
+`-3590,236,-168,-3590,236,-376,-3590,236,-376,-3998,286,136,-3998,286,136,-3590,236,-376,-3486,897,-376,-3998,897,136,-3998,897,136,-3486,897,-376,-3486,606,-376,-3574,606,136,-3574,606,136,-3486,606,-376,-3486,313,-376,-3566,251,-184,-3566,251,-184,-3486,313,-376,-3494,236,-184,-3486,236,-376,-3486,236,88,-3566,251,136,-3566,251,136,-3486,313,88,-3486,313,136,-3494,236,136,-3486,236,88,-3486,236],"vertslength":34,"polys":[0,3,4,6,7,11,12,15,16,19,20,23,24,26,27,30,31,33],"polyslength":9,"regions`
+`":[2,2,2,1,3,4,6,5,8],"neighbors":[[[0],[0],[0],[1,1]],[[0],[1,0],[1,2]],[[0],[0],[0],[0],[1,1]],[[0],[0],[0],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[0]],[[0],[0],[0]],[[0],[0],[0],[0]],[[0],[0],[0]]]},"detail":{"verts":[64,-3582,244,64,-3505.199951171875,306,64,-3486,313,-160,-3486,313,-161.60000610351562,-3506.800048828125,306,-168,-3590,237,40.79999923706055,-3582.800048828125,237,36,-3506,306,136,-3590,236,82,-3584,236,64,-3582,244,40.79999923706055,-3582.800048828125,237,-168,-3590,237,-168,-3`
+`590,237,-376,-3590,236,-376,-3794,236,-376,-3998,284,136,-3998,284,136,-3794,236,136,-3590,236,-268,-3794,236,-376,-3486,897,-376,-3998,897,136,-3998,897,136,-3486,897,-376,-3486,606,-376,-3574,606,136,-3574,606,136,-3486,606,-376,-3486,313,-376,-3506,306,-376,-3566,258,-184,-3566,258,-184,-3506,306,-184,-3486,313,-376,-3494,236,-184,-3486,236,-376,-3486,236,88,-3566,258,136,-3566,258,136,-3506,306,136,-3486,313,88,-3486,313,88,-3506,306,136,-3494,236,136,-3486,236,88,-3486,236],"vertslength":47`
+`,"tris":[4,5,6,4,6,7,2,3,7,4,3,7,2,1,7,6,0,7,1,0,7,9,10,11,8,9,11,8,11,12,18,19,13,16,17,20,16,15,20,13,14,20,15,14,20,17,18,20,13,18,20,24,21,22,22,23,24,28,25,26,26,27,28,34,29,30,33,34,30,33,30,31,31,32,33,35,36,37,40,41,42,40,42,43,43,38,39,39,40,43,44,45,46],"trislength":31,"triTopoly":[0,0,0,0,0,0,0,1,1,1,2,2,2,2,2,2,2,3,3,4,4,5,5,5,5,6,7,7,7,7,8],"baseVert":[0,8,13,21,25,29,35,38,44],"vertsCount":[8,5,8,4,4,6,3,6,3],"baseTri":[0,7,10,17,19,21,25,26,30],"triCount":[7,3,7,2,2,4,1,4,1]},"lin`
+`ks":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["3_1",{"tileId":"3_1","tx":3,"ty":1,"mesh":{"verts":[136,-3590,236,136,-3998,286,648,-3998,286,648,-3590,236,136,-3486,897,136,-3998,897,648,-3998,897,648,-3486,897,136,-3486,606,136,-3574,606,640,-3574,606,640,-3486,606,136,-3486,313,136,-3566,251,632,-3566,251,632,-3486,253,136,-3494,236,560,-3486,236,136,-3486,236],"vertslength":19,"polys":[0,3,4,7,8,11,12,15,16,18],"polyslength":5,"regions":[2,1,3,4,5],"neighbors":[[[0],[0],[0],[0]],`
+`[[0],[0],[0],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[0]],[[0],[0],[0]]]},"detail":{"verts":[136,-3590,236,136,-3794,236,136,-3998,284,648,-3998,284,648,-3794,236,648,-3590,236,136,-3486,897,136,-3998,897,648,-3998,897,648,-3486,897,136,-3486,606,136,-3574,606,640,-3574,606,640,-3486,606,136,-3486,313,136,-3506,306,136,-3566,258,632,-3566,253,632,-3486,253,608.3809814453125,-3486,260,537.5238037109375,-3486,313,532,-3506,306,556,-3506,304,136,-3494,236,560,-3486,236,136,-3486,236],"vertslength":26,"`
+`tris":[5,0,1,1,2,3,1,3,4,1,4,5,9,6,7,7,8,9,13,10,11,11,12,13,17,18,19,16,17,21,16,15,21,20,14,21,15,14,21,17,19,22,21,17,22,19,20,22,21,20,22,23,24,25],"trislength":18,"triTopoly":[0,0,0,0,1,1,2,2,3,3,3,3,3,3,3,3,3,4],"baseVert":[0,6,10,14,23],"vertsCount":[6,4,4,9,3],"baseTri":[0,4,6,8,17],"triCount":[4,2,2,9,1]},"links":{"poly":[3,4],"cost":[991.4812622070312],"type":[2],"pos":[560,-3486,261.7096862792969,560,-3486,236],"length":1}}],["4_1",{"tileId":"4_1","tx":4,"ty":1,"mesh":{"verts":[648,-3`
+`998,286,816,-3998,286,824,-3854,253,648,-3582,236,960,-3854,294,968,-3998,296,1160,-3998,354,1160,-3486,354,656,-3486,236,648,-3582,236,824,-3854,253,960,-3854,294,1160,-3486,354,648,-3486,897,648,-3998,897,952,-3998,897,952,-3486,897,840,-3886,265,840,-3982,282,944,-3982,286,944,-3886,286],"vertslength":21,"polys":[0,3,4,7,8,12,13,16,17,20],"polyslength":5,"regions":[1,1,1,2,3],"neighbors":[[[0],[0],[1,2],[0]],[[0],[0],[0],[1,2]],[[0],[1,0],[0],[1,1],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[0]]]},"`
+`detail":{"verts":[648,-3998,284,816,-3998,284,822.8571166992188,-3874.571533203125,252,824,-3854,253,773.7142944335938,-3776.28564453125,236,648,-3582,236,648,-3790,236,960,-3854,296,968,-3998,299,1160,-3998,354,1160,-3486,354,656,-3486,236,648,-3582,236,773.7142944335938,-3776.28564453125,236,824,-3854,253,960,-3854,296,1160,-3486,354,770.5454711914062,-3486,236,648,-3486,897,648,-3998,897,952,-3998,897,952,-3486,897,840,-3886,265,840,-3982,280,944,-3982,286,944,-3886,286,876,-3922,268],"vertsl`
+`ength":27,"tris":[2,3,4,1,2,4,4,5,6,4,6,0,0,1,4,7,8,9,7,9,10,17,11,12,13,14,15,17,12,13,17,13,15,15,16,17,21,18,19,19,20,21,25,22,26,22,23,26,23,24,26,25,24,26],"trislength":18,"triTopoly":[0,0,0,0,0,1,1,2,2,2,2,2,3,3,4,4,4,4],"baseVert":[0,7,11,18,22],"vertsCount":[7,4,7,4,5],"baseTri":[0,5,7,12,14],"triCount":[5,2,5,2,4]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["5_1",{"tileId":"5_1","tx":5,"ty":1,"mesh":{"verts":[1160,-3486,357,1160,-3998,357,1320,-3998,404,1320,-3486,40`
+`4],"vertslength":4,"polys":[0,3],"polyslength":1,"regions":[1],"neighbors":[[[0],[0],[0],[0]]]},"detail":{"verts":[1160,-3486,359,1160,-3998,359,1320,-3998,404,1320,-3486,404],"vertslength":4,"tris":[3,0,1,1,2,3],"trislength":2,"triTopoly":[0,0],"baseVert":[0],"vertsCount":[4],"baseTri":[0],"triCount":[2]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["6_1",{"tileId":"6_1","tx":6,"ty":1,"mesh":{"verts":[],"vertslength":0,"polys":[],"polyslength":0,"regions":[],"neighbors":[]},"d`
+`etail":{"verts":[],"vertslength":0,"tris":[],"trislength":0,"triTopoly":[],"baseVert":[],"vertsCount":[],"baseTri":[],"triCount":[]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["0_2",{"tileId":"0_2","tx":0,"ty":2,"mesh":{"verts":[-1392,-2974,406,-1392,-3486,406,-888,-3486,250,-888,-2974,250,-1048,-2974,897,-1048,-3486,897,-888,-3486,897,-888,-2974,897],"vertslength":8,"polys":[0,3,4,7],"polyslength":2,"regions":[1,2],"neighbors":[[[0],[0],[0],[0]],[[0],[0],[0],[0]]]},"detail":`
+`{"verts":[-1392,-2974,403,-1392,-3486,403,-888,-3486,250,-888,-2974,250,-1048,-2974,897,-1048,-3486,897,-888,-3486,897,-888,-2974,897],"vertslength":8,"tris":[3,0,1,1,2,3,7,4,5,5,6,7],"trislength":4,"triTopoly":[0,0,1,1],"baseVert":[0,4],"vertsCount":[4,4],"baseTri":[0,2],"triCount":[2,2]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["1_2",{"tileId":"1_2","tx":1,"ty":2,"mesh":{"verts":[-752,-3046,236,-376,-3038,523,-376,-2974,523,-888,-2974,247,-888,-3486,247,-752,-3486,236,-75`
+`2,-3046,236,-888,-2974,247,-888,-2974,897,-888,-3486,897,-376,-3486,897,-376,-2974,897,-632,-3054,606,-640,-2974,606,-736,-2974,606,-736,-3486,606,-376,-3486,606,-376,-3054,606,-632,-3054,606,-736,-3486,606,-728,-3062,250,-728,-3486,250,-376,-3486,320,-376,-3062,523,-656,-3062,236,-656,-3486,236,-376,-3486,236,-376,-3062,236,-656,-3038,236,-376,-3038,236,-376,-2974,236,-656,-2974,236],"vertslength":32,"polys":[0,3,4,7,8,11,12,15,16,19,20,23,24,27,28,31],"polyslength":8,"regions":[5,5,1,2,2,3,4,6`
+`],"neighbors":[[[0],[0],[0],[1,1]],[[0],[0],[1,0],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[1,4]],[[0],[0],[1,3],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[0]]]},"detail":{"verts":[-752,-3046,238,-728.5,-3045.5,250,-399.5,-3038.5,517,-376,-3038,523,-376,-2974,523,-399.2727355957031,-2974,517,-748.3636474609375,-2974,238,-841.4545288085938,-2974,236,-888,-2974,245,-849.1428833007812,-2994.571533203125,236,-756,-3010,236,-888,-3486,245,-842.6666870117188,-3486,236,-752,-3486,236,-752,-3046,`
+`238,-849.1428833007812,-2994.571533203125,236,-888,-2974,245,-852,-3234,236,-888,-2974,897,-888,-3486,897,-376,-3486,897,-376,-2974,897,-632,-3054,606,-640,-2974,606,-736,-2974,606,-736,-3486,606,-376,-3486,606,-376,-3054,606,-632,-3054,606,-736,-3486,606,-728,-3062,257,-728,-3486,257,-704.5333251953125,-3486,269,-634.1333618164062,-3486,326,-376,-3486,327,-376,-3462.4443359375,341,-376,-3250.4443359375,523,-376,-3062,523,-399.4666748046875,-3062,517,-704.5333251953125,-3062,269,-476,-3330,453,-`
+`452,-3330,459,-656,-3062,236,-656,-3486,236,-376,-3486,236,-376,-3062,236,-656,-3038,236,-376,-3038,236,-376,-2974,236,-656,-2974,236],"vertslength":50,"tris":[7,8,9,3,4,5,2,3,5,1,2,5,1,5,6,1,6,10,6,7,10,9,7,10,9,0,10,1,0,10,16,11,17,11,12,17,14,13,17,12,13,17,14,15,17,16,15,17,21,18,19,19,20,21,22,23,24,22,24,25,26,27,28,26,28,29,36,37,38,33,34,35,39,30,31,38,39,40,38,36,40,39,31,40,31,32,40,35,33,40,32,33,40,35,36,41,36,40,41,40,35,41,45,42,43,43,44,45,49,46,47,47,48,49],"trislength":38,"triTo`
+`poly":[0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,2,2,3,3,4,4,5,5,5,5,5,5,5,5,5,5,5,5,6,6,7,7],"baseVert":[0,11,18,22,26,30,42,46],"vertsCount":[11,7,4,4,4,12,4,4],"baseTri":[0,10,16,18,20,22,34,36],"triCount":[10,6,2,2,2,12,2,2]},"links":{"poly":[5,6],"cost":[1202.879150390625],"type":[2],"pos":[-656,-3486,264.31817626953125,-656,-3486,236],"length":1}}],["2_2",{"tileId":"2_2","tx":2,"ty":2,"mesh":{"verts":[-376,-3062,236,-376,-3486,236,-184,-3486,236,-184,-3062,236,-328,-3206,561,-336,-3062,555,-376,-306`
+`2,529,-376,-3486,320,-184,-3486,320,-184,-3206,556,-328,-3206,561,-376,-3486,320,-168,-3166,606,-168,-3158,606,-304,-3054,606,-376,-3054,606,-376,-3486,606,-176,-3470,606,88,-3486,606,80,-3470,606,-176,-3470,606,-376,-3486,606,-376,-2974,897,-376,-3486,897,136,-3486,897,136,-2974,897,64,-3046,236,136,-3038,236,136,-2974,236,-376,-2974,236,-376,-3038,236,-160,-3046,236,64,-3046,236,-160,-3046,236,-160,-3486,236,64,-3486,236,-376,-2974,529,-376,-3038,529,-296,-3038,593,-160,-2974,607,-296,-3038,59`
+`3,-304,-3054,606,-168,-3158,606,-160,-2974,607,80,-3470,606,88,-3486,606,136,-3486,606,136,-2974,607,80,-3166,606,-160,-2974,607,-168,-3158,606,-168,-3166,606,64,-3166,598,80,-3166,606,136,-2974,607,-160,-3486,320,64,-3486,320,64,-3166,598,-168,-3166,606,88,-3062,236,88,-3486,236,136,-3486,236,136,-3062,236,88,-3206,556,88,-3486,320,136,-3486,320,136,-3206,556],"vertslength":67,"polys":[0,3,4,7,8,11,12,17,18,21,22,25,26,31,32,35,36,39,40,43,44,48,49,54,55,58,59,62,63,66],"polyslength":15,"region`
+`s":[6,7,7,4,4,1,3,3,5,5,2,2,2,8,9],"neighbors":[[[0],[0],[0],[0]],[[0],[0],[0],[1,2]],[[0],[0],[1,1],[0]],[[1,11],[1,9],[0],[0],[1,4],[0]],[[1,10],[0],[1,3],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[0],[0],[1,7]],[[1,6],[0],[0],[0]],[[0],[0],[1,9],[0]],[[0],[1,3],[1,11],[1,8]],[[1,4],[0],[0],[1,11],[0]],[[1,9],[1,3],[1,12],[0],[1,10],[0]],[[0],[0],[1,11],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[0]]]},"detail":{"verts":[-376,-3062,236,-376,-3486,236,-184,-3486,236,-184,-3062,236,-328,-3206,556,-336,-3062,`
+`555,-376,-3062,536,-376,-3226.888916015625,536,-376,-3250.4443359375,528,-376,-3462.4443359375,341,-376,-3486,327,-372,-3462.666748046875,341,-332,-3229.333251953125,549,-340,-3210,561,-184,-3486,327,-184,-3462.666748046875,341,-184,-3229.333251953125,549,-184,-3206,556,-328,-3206,556,-332,-3229.333251953125,549,-372,-3462.666748046875,341,-376,-3486,327,-168,-3166,606,-168,-3158,606,-304,-3054,606,-376,-3054,606,-376,-3486,606,-176,-3470,606,88,-3486,606,80,-3470,606,-176,-3470,606,-376,-3486,6`
+`06,-376,-2974,897,-376,-3486,897,136,-3486,897,136,-2974,897,64,-3046,236,136,-3038,236,136,-2974,236,-376,-2974,236,-376,-3038,236,-160,-3046,236,64,-3046,236,-160,-3046,236,-160,-3486,236,64,-3486,236,-376,-2974,536,-376,-3038,536,-296,-3038,599,-276.5714416503906,-3028.857177734375,607,-160,-2974,607,-268,-2974,607,-311.20001220703125,-2974,586,-296,-3038,599,-304,-3054,593,-287,-3067,606,-168,-3158,607,-160,-2974,607,-276.5714416503906,-3028.857177734375,607,80,-3470,606,88,-3486,606,136,-34`
+`86,606,136,-2974,607,80,-3166,606,-160,-2974,607,-168,-3158,607,-168,-3166,604,64,-3166,606,80,-3166,606,136,-2974,607,-160,-3486,327,41.599998474121094,-3486,327,64,-3486,606,64,-3166,606,-168,-3166,604,-160.57142639160156,-3463.142822265625,341,60,-3474,334,88,-3062,236,88,-3486,236,136,-3486,236,136,-3062,236,88,-3206,556,88,-3229.333251953125,549,88,-3462.666748046875,341,88,-3486,327,136,-3486,327,136,-3462.666748046875,341,136,-3229.333251953125,549,136,-3206,556],"vertslength":89,"tris":[`
+`3,0,1,1,2,3,9,10,11,12,7,8,8,9,11,8,11,12,7,12,13,12,4,13,5,4,13,5,6,13,7,6,13,16,17,18,16,18,19,20,21,14,20,14,15,15,16,19,15,19,20,22,23,24,22,24,25,26,27,22,22,25,26,28,29,30,28,30,31,35,32,33,33,34,35,36,37,38,39,40,41,41,36,38,38,39,41,45,42,43,43,44,45,47,48,49,52,46,47,52,47,49,51,52,49,49,50,51,53,54,55,58,53,55,57,58,55,55,56,57,59,60,61,63,59,61,61,62,63,64,65,66,67,68,69,64,66,67,64,67,69,75,70,71,73,74,75,72,73,76,73,75,76,75,71,76,72,71,76,80,77,78,78,79,80,88,81,82,83,84,85,83,85,8`
+`6,87,88,82,87,82,83,83,86,87],"trislength":61,"triTopoly":[0,0,1,1,1,1,1,1,1,1,1,2,2,2,2,2,2,3,3,3,3,4,4,5,5,6,6,6,6,7,7,8,8,8,8,8,9,9,9,9,10,10,10,11,11,11,11,12,12,12,12,12,12,13,13,14,14,14,14,14,14],"baseVert":[0,4,14,22,28,32,36,42,46,53,59,64,70,77,81],"vertsCount":[4,10,8,6,4,4,6,4,7,6,5,6,7,4,8],"baseTri":[0,2,11,17,21,23,25,29,31,36,40,43,47,53,55],"triCount":[2,9,6,4,2,2,4,2,5,4,3,4,6,2,6]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["3_2",{"tileId":"3_2","tx":3,"ty"`
+`:2,"mesh":{"verts":[136,-3062,236,136,-3486,236,560,-3486,236,560,-3062,236,240,-3198,563,136,-3206,556,136,-3486,320,632,-3062,253,240,-3062,558,240,-3198,563,240,-3198,563,136,-3486,320,632,-3486,253,632,-3062,253,640,-2974,606,552,-2974,606,544,-3054,606,640,-3486,606,200,-3046,606,136,-3038,607,136,-3486,606,544,-3054,606,200,-3046,606,136,-3486,606,640,-3486,606,136,-2974,897,136,-3486,897,648,-3486,897,648,-2974,897,136,-2974,236,136,-3038,236,560,-3038,236,560,-2974,236,136,-2974,607,136,`
+`-3038,607,200,-3046,606,648,-3038,241,648,-2974,241],"vertslength":38,"polys":[0,3,4,6,7,9,10,13,14,17,18,20,21,24,25,28,29,32,33,37],"polyslength":10,"regions":[3,4,4,4,2,2,2,1,6,5],"neighbors":[[[0],[0],[0],[0]],[[0],[0],[1,3]],[[0],[0],[1,3]],[[1,1],[0],[0],[1,2]],[[0],[0],[1,6],[0]],[[1,9],[0],[1,6]],[[0],[1,5],[0],[1,4]],[[0],[0],[0],[0]],[[0],[0],[0],[0]],[[0],[1,5],[0],[0],[0]]]},"detail":{"verts":[136,-3062,236,136,-3486,236,560,-3486,236,560,-3062,236,240,-3198,552,219.1999969482422,-31`
+`99.60009765625,558,136,-3206,556,136,-3229.333251953125,549,136,-3462.666748046875,341,136,-3486,327,176,-3375.230712890625,417,200,-3308.769287109375,480,208,-3286.615478515625,493,232,-3220.15380859375,556,220,-3210,563,632,-3062,253,608.941162109375,-3062,260,447.5294189453125,-3062,393,240,-3062,552,240,-3198,552,610.2222290039062,-3069.5556640625,260,240,-3198,552,232,-3220.15380859375,556,208,-3286.615478515625,493,200,-3308.769287109375,480,176,-3375.230712890625,417,136,-3486,327,513.904`
+`78515625,-3486,327,537.5238037109375,-3486,317,608.3809814453125,-3486,260,632,-3486,253,632,-3062,253,610.2222290039062,-3069.5556640625,260,604,-3090,266,484,-3450,355,640,-2974,606,552,-2974,606,544,-3054,606,640,-3486,606,200,-3046,606,136,-3038,607,136,-3486,606,544,-3054,606,200,-3046,606,136,-3486,606,640,-3486,606,136,-2974,897,136,-3486,897,648,-3486,897,648,-2974,897,136,-2974,236,136,-3038,236,560,-3038,236,560,-2974,236,136,-2974,607,136,-3038,607,178.6666717529297,-3043.333251953125`
+`,602,200,-3046,583,223.57894897460938,-3045.578857421875,571,624.4210815429688,-3038.421142578125,247,648,-3038,241,648,-2974,241,624.727294921875,-2974,247,182.5454559326172,-2974,602,172,-3034,607],"vertslength":65,"tris":[3,0,1,1,2,3,10,11,12,8,9,10,10,12,7,7,8,10,12,13,14,13,4,14,5,4,14,12,7,14,5,6,14,7,6,14,20,15,16,20,16,17,17,18,19,17,19,20,31,30,33,29,30,33,31,32,33,32,21,33,22,23,34,28,27,34,23,24,34,27,26,34,24,25,34,26,25,34,28,29,34,33,29,34,22,21,34,33,21,34,35,36,37,35,37,38,39,40,`
+`41,42,43,44,42,44,45,49,46,47,47,48,49,53,50,51,51,52,53,60,61,62,59,60,62,58,59,62,58,62,63,58,63,64,63,54,64,55,54,64,55,56,64,58,57,64,56,57,64],"trislength":49,"triTopoly":[0,0,1,1,1,1,1,1,1,1,1,1,2,2,2,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,4,4,5,6,6,7,7,8,8,9,9,9,9,9,9,9,9,9,9],"baseVert":[0,4,15,21,35,39,42,46,50,54],"vertsCount":[4,11,6,14,4,3,4,4,4,11],"baseTri":[0,2,12,16,30,32,33,35,37,39],"triCount":[2,10,4,14,2,1,2,2,2,10]},"links":{"poly":[0,3],"cost":[1071.403076171875],"type":[2],"pos":[5`
+`60,-3486,236,560,-3486,262.7257995605469],"length":1}}],["4_2",{"tileId":"4_2","tx":4,"ty":2,"mesh":{"verts":[648,-2974,897,648,-3486,897,952,-3486,897,952,-2974,897,648,-2974,236,648,-3046,236,656,-3486,236,1160,-3486,354,1160,-2974,354],"vertslength":9,"polys":[0,3,4,8],"polyslength":2,"regions":[2,1],"neighbors":[[[0],[0],[0],[0]],[[0],[0],[0],[0],[0]]]},"detail":{"verts":[648,-2974,897,648,-3486,897,952,-3486,897,952,-2974,897,648,-2974,236,648,-3046,236,656,-3486,236,770.5454711914062,-3486`
+`,236,1160,-3486,354,1160,-2974,354,1136.727294921875,-2974,352,787.6363525390625,-2974,241,780,-3138,238],"vertslength":13,"tris":[3,0,1,1,2,3,11,4,5,8,9,12,8,7,12,5,6,12,7,6,12,9,10,12,5,11,12,10,11,12],"trislength":10,"triTopoly":[0,0,1,1,1,1,1,1,1,1],"baseVert":[0,4],"vertsCount":[4,9],"baseTri":[0,2],"triCount":[2,8]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["5_2",{"tileId":"5_2","tx":5,"ty":2,"mesh":{"verts":[1160,-2974,357,1160,-3486,357,1320,-3486,404,1320,-2974,404]`
+`,"vertslength":4,"polys":[0,3],"polyslength":1,"regions":[1],"neighbors":[[[0],[0],[0],[0]]]},"detail":{"verts":[1160,-2974,359,1160,-3486,359,1320,-3486,404,1320,-2974,404],"vertslength":4,"tris":[3,0,1,1,2,3],"trislength":2,"triTopoly":[0,0],"baseVert":[0],"vertsCount":[4],"baseTri":[0],"triCount":[2]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["6_2",{"tileId":"6_2","tx":6,"ty":2,"mesh":{"verts":[],"vertslength":0,"polys":[],"polyslength":0,"regions":[],"neighbors":[]},"det`
+`ail":{"verts":[],"vertslength":0,"tris":[],"trislength":0,"triTopoly":[],"baseVert":[],"vertsCount":[],"baseTri":[],"triCount":[]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["0_3",{"tileId":"0_3","tx":0,"ty":3,"mesh":{"verts":[-1392,-2462,406,-1392,-2974,406,-888,-2974,250,-888,-2462,250,-1048,-2462,897,-1048,-2974,897,-888,-2974,897,-888,-2462,897],"vertslength":8,"polys":[0,3,4,7],"polyslength":2,"regions":[1,2],"neighbors":[[[0],[0],[0],[0]],[[0],[0],[0],[0]]]},"detail":{"`
+`verts":[-1392,-2462,403,-1392,-2974,403,-888,-2974,250,-888,-2462,250,-1048,-2462,897,-1048,-2974,897,-888,-2974,897,-888,-2462,897],"vertslength":8,"tris":[3,0,1,1,2,3,7,4,5,5,6,7],"trislength":4,"triTopoly":[0,0,1,1],"baseVert":[0,4],"vertsCount":[4,4],"baseTri":[0,2],"triCount":[2,2]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["1_3",{"tileId":"1_3","tx":1,"ty":3,"mesh":{"verts":[-744,-2830,238,-752,-2462,236,-888,-2462,247,-888,-2974,247,-376,-2974,523,-376,-2830,523,-744,`
+`-2830,238,-888,-2974,247,-888,-2462,897,-888,-2974,897,-376,-2974,897,-376,-2462,897,-736,-2974,606,-640,-2974,606,-632,-2814,606,-736,-2462,606,-632,-2814,606,-376,-2814,606,-376,-2462,606,-736,-2462,606,-728,-2806,250,-376,-2806,523,-376,-2462,391,-728,-2462,250,-656,-2830,236,-656,-2974,236,-376,-2974,236,-376,-2830,236,-656,-2806,236,-376,-2806,236,-376,-2462,236,-656,-2462,236],"vertslength":32,"polys":[0,3,4,7,8,11,12,15,16,19,20,23,24,27,28,31],"polyslength":8,"regions":[5,5,1,2,2,3,6,4],`
+`"neighbors":[[[0],[0],[0],[1,1]],[[0],[0],[1,0],[0]],[[0],[0],[0],[0]],[[0],[0],[1,4],[0]],[[0],[0],[0],[1,3]],[[0],[0],[0],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[0]]]},"detail":{"verts":[-744,-2830,244,-744.5,-2807,236,-752,-2462,236,-842.6666870117188,-2462,236,-888,-2462,245,-888,-2974,245,-856,-2942,236,-760,-2846,236,-852,-2914,236,-852,-2554,236,-376,-2974,523,-376,-2830,523,-399,-2830,517,-721,-2830,257,-744,-2830,244,-760,-2846,236,-856,-2942,236,-888,-2974,245,-841.4545288085938,-2974,236`
+`,-748.3636474609375,-2974,238,-399.2727355957031,-2974,517,-756,-2866,236,-888,-2462,897,-888,-2974,897,-376,-2974,897,-376,-2462,897,-736,-2974,606,-640,-2974,606,-632,-2814,606,-736,-2462,606,-632,-2814,606,-376,-2814,606,-376,-2462,606,-736,-2462,606,-728,-2806,257,-704.5333251953125,-2806,269,-399.4666748046875,-2806,517,-376,-2806,523,-376,-2622.533447265625,523,-376,-2484.933349609375,398,-376,-2462,391,-540.2666625976562,-2462,391,-563.7333374023438,-2462,383,-704.5333251953125,-2462,269,`
+`-728,-2462,257,-404,-2626,510,-656,-2830,236,-656,-2974,236,-376,-2974,236,-376,-2830,236,-656,-2806,236,-376,-2806,236,-376,-2462,236,-656,-2462,236],"vertslength":54,"tris":[7,0,1,5,6,8,1,7,8,6,7,8,8,1,9,4,3,9,1,2,9,3,2,9,4,5,9,8,5,9,16,17,18,16,18,19,10,11,12,20,10,12,20,12,13,13,19,20,16,19,21,19,13,21,16,15,21,13,14,21,15,14,21,25,22,23,23,24,25,26,27,28,26,28,29,30,31,32,30,32,33,39,40,41,44,34,35,43,44,35,43,35,45,35,36,45,38,37,45,36,37,45,43,42,45,38,39,45,42,41,45,39,41,45,49,46,47,47,`
+`48,49,53,50,51,51,52,53],"trislength":42,"triTopoly":[0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,2,2,3,3,4,4,5,5,5,5,5,5,5,5,5,5,5,6,6,7,7],"baseVert":[0,10,22,26,30,34,46,50],"vertsCount":[10,12,4,4,4,12,4,4],"baseTri":[0,10,21,23,25,27,38,40],"triCount":[10,11,2,2,2,11,2,2]},"links":{"poly":[5,7],"cost":[2753.01513671875],"type":[2],"pos":[-656,-2462,278.8409118652344,-656,-2462,236],"length":1}}],["2_3",{"tileId":"2_3","tx":2,"ty":3,"mesh":{"verts":[136,-2974,236,136,-2830,236,64,-2822,236,-16`
+`0,-2822,236,-376,-2830,236,-376,-2974,236,64,-2822,236,64,-2462,236,-160,-2462,236,-160,-2822,236,-296,-2822,606,-376,-2830,529,-376,-2974,529,-144,-2974,607,-144,-2822,607,16,-2806,897,16,-2974,897,136,-2974,897,136,-2462,897,-376,-2974,897,-144,-2974,897,-136,-2798,897,-376,-2462,897,-136,-2798,897,16,-2806,897,136,-2462,897,-376,-2462,897,-144,-2822,607,-128,-2798,607,-168,-2702,606,-296,-2822,606,-376,-2814,606,-296,-2822,606,-168,-2702,606,-176,-2462,606,-376,-2462,606,-376,-2462,236,-376,-`
+`2806,236,-184,-2806,236,-184,-2462,236,-376,-2806,529,-336,-2806,555,-328,-2662,561,-376,-2462,391,-328,-2662,561,-184,-2662,558,-184,-2462,391,-376,-2462,391,8,-2798,607,16,-2814,607,72,-2702,606,-168,-2702,606,-128,-2798,607,8,-2798,607,72,-2702,606,64,-2462,391,-160,-2462,391,-128,-2814,671,-128,-2966,671,0,-2966,671,0,-2814,671,-128,-2814,962,-128,-2966,962,0,-2966,962,0,-2814,962,-120,-2822,607,-120,-2958,607,-8,-2958,607,-8,-2822,607,16,-2814,607,16,-2974,607,136,-2974,607,72,-2702,606,136`
+`,-2462,606,80,-2462,606,72,-2702,606,136,-2974,607,88,-2806,236,136,-2806,236,136,-2462,236,88,-2462,236,88,-2662,558,136,-2662,558,136,-2462,391,88,-2462,391],"vertslength":85,"polys":[0,5,6,9,10,14,15,18,19,22,23,26,27,30,31,35,36,39,40,43,44,47,48,50,51,56,57,60,61,64,65,68,69,72,73,76,77,80,81,84],"polyslength":20,"regions":[2,2,7,1,1,1,4,4,5,6,6,3,3,9,10,11,8,8,12,13],"neighbors":[[[0],[0],[1,1],[0],[0],[0]],[[0],[0],[0],[1,0]],[[0],[0],[0],[0],[1,6]],[[0],[0],[0],[1,5]],[[0],[0],[1,5],[0]]`
+`,[[0],[1,3],[0],[1,4]],[[0],[1,12],[1,7],[1,2]],[[0],[1,6],[0],[0],[0]],[[0],[0],[0],[0]],[[0],[0],[1,10],[0]],[[0],[0],[0],[1,9]],[[0],[1,16],[1,12]],[[1,6],[0],[1,11],[0],[0],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[0]],[[0],[0],[1,17],[1,11]],[[0],[0],[1,16],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[0]]]},"detail":{"verts":[136,-2974,236,136,-2830,236,64,-2822,236,-160,-2822,236,-376,-2830,236,-376,-2974,236,64,-2822,236,64,-2462,236,-160,-2462,236,-160,-2822,236,-296,-2822,606,-316,`
+`-2824,580,-376,-2830,536,-376,-2974,536,-352.79998779296875,-2974,548,-283.20001220703125,-2974,605,-144,-2974,607,-144,-2822,607,-268,-2842,607,-292,-2866,599,16,-2806,897,16,-2974,897,136,-2974,897,136,-2462,897,-376,-2974,897,-144,-2974,897,-136,-2798,897,-376,-2462,897,-136,-2798,897,16,-2806,897,136,-2462,897,-376,-2462,897,-144,-2822,607,-128,-2798,607,-168,-2702,606,-296,-2822,606,-376,-2814,606,-296,-2822,606,-168,-2702,606,-176,-2462,606,-376,-2462,606,-376,-2462,236,-376,-2806,236,-184`
+`,-2806,236,-184,-2462,236,-376,-2806,536,-336,-2806,555,-329.1428527832031,-2682.571533203125,558,-328,-2662,551,-354.6666564941406,-2550.888916015625,461,-370.6666564941406,-2484.22216796875,398,-376,-2462,391,-376,-2484.933349609375,398,-376,-2622.533447265625,523,-376,-2645.466552734375,536,-340,-2650,544,-328,-2662,551,-184,-2662,551,-184,-2550.888916015625,461,-184,-2484.22216796875,398,-184,-2462,391,-376,-2462,391,-370.6666564941406,-2484.22216796875,398,-354.6666564941406,-2550.888916015`
+`625,461,-364,-2482,398,8,-2798,607,16,-2814,607,53.33333206176758,-2739.333251953125,607,72,-2702,599,-168,-2702,585,-160,-2721.199951171875,606,-128,-2798,607,8,-2798,607,72,-2702,599,69.81818389892578,-2636.54541015625,530,66.90908813476562,-2549.272705078125,454,64.7272720336914,-2483.818115234375,398,64,-2462,391,-160,-2462,391,-160.72727966308594,-2483.818115234375,398,-165.09091186523438,-2614.727294921875,516,-132,-2714,599,60,-2474,391,60,-2690,578,-108,-2738,607,-128,-2814,671,-128,-296`
+`6,671,0,-2966,671,0,-2814,671,-128,-2814,962,-128,-2966,962,0,-2966,962,0,-2814,962,-120,-2822,607,-120,-2958,607,-8,-2958,607,-8,-2822,607,16,-2814,607,16,-2974,607,136,-2974,607,72,-2702,606,136,-2462,606,80,-2462,606,72,-2702,606,136,-2974,607,88,-2806,236,136,-2806,236,136,-2462,236,88,-2462,236,88,-2662,551,136,-2662,551,136,-2550.888916015625,461,136,-2484.22216796875,398,136,-2462,391,88,-2462,391,88,-2484.22216796875,398,88,-2550.888916015625,461],"vertslength":117,"tris":[0,1,2,3,4,5,0,`
+`2,3,0,3,5,9,6,7,7,8,9,12,13,14,15,16,18,17,16,18,17,10,18,11,12,19,14,12,19,14,15,19,18,15,19,18,10,19,11,10,19,20,21,22,20,22,23,24,25,26,24,26,27,28,29,30,28,30,31,32,33,34,32,34,35,36,37,38,38,39,40,36,38,40,44,41,42,42,43,44,50,51,52,49,50,52,49,52,53,45,46,47,45,47,54,54,47,55,47,48,55,49,48,55,49,53,55,54,53,55,56,57,58,63,56,58,63,58,59,63,59,64,59,60,64,61,60,64,61,62,64,63,62,64,65,66,67,65,67,68,75,79,80,80,75,81,75,74,81,80,69,81,70,69,81,79,75,82,75,76,82,77,76,82,77,78,82,79,78,82,7`
+`3,74,83,74,81,83,73,72,83,71,72,84,72,83,84,81,83,84,81,70,84,71,70,84,88,85,86,86,87,88,92,89,90,90,91,92,96,93,94,94,95,96,97,98,99,97,99,100,101,102,103,101,103,104,108,105,106,106,107,108,112,113,114,112,114,115,111,112,115,111,115,116,116,109,110,110,111,116],"trislength":85,"triTopoly":[0,0,0,0,1,1,2,2,2,2,2,2,2,2,2,2,3,3,4,4,5,5,6,6,7,7,7,8,8,9,9,9,9,9,9,9,9,9,9,10,10,10,10,10,10,10,10,11,11,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,13,13,14,14,15,15,16,16,17,17,18,18,19,19,19`
+`,19,19,19],"baseVert":[0,6,10,20,24,28,32,36,41,45,56,65,69,85,89,93,97,101,105,109],"vertsCount":[6,4,10,4,4,4,4,5,4,11,9,4,16,4,4,4,4,4,4,8],"baseTri":[0,4,6,16,18,20,22,24,27,29,39,47,49,67,69,71,73,75,77,79],"triCount":[4,2,10,2,2,2,2,3,2,10,8,2,18,2,2,2,2,2,2,6]},"links":{"poly":[2,13,3,14],"cost":[6528,6721.5],"type":[2,2],"pos":[-144,-2966,607,-128,-2966,671,16,-2966,897,0,-2966,962],"length":2}}],["3_3",{"tileId":"3_3","tx":3,"ty":3,"mesh":{"verts":[136,-2830,236,136,-2974,236,560,-2974,`
+`236,560,-2830,236,200,-2822,606,136,-2814,607,136,-2974,607,648,-2974,241,648,-2830,241,200,-2822,606,136,-2974,607,136,-2462,897,136,-2974,897,648,-2974,897,648,-2462,897,544,-2814,606,552,-2974,606,640,-2974,606,640,-2462,606,136,-2462,606,136,-2814,607,200,-2822,606,544,-2814,606,640,-2462,606,136,-2462,236,136,-2806,236,560,-2806,236,560,-2462,236,136,-2462,391,136,-2662,558,240,-2670,564,240,-2670,564,240,-2806,558,632,-2806,253,632,-2462,253,136,-2462,391,240,-2670,564,632,-2806,253],"vert`
+`slength":38,"polys":[0,3,4,6,7,10,11,14,15,18,19,23,24,27,28,30,31,33,34,37],"polyslength":10,"regions":[5,6,6,1,2,2,3,4,4,4],"neighbors":[[[0],[0],[0],[0]],[[1,5],[0],[1,2]],[[0],[0],[1,1],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[1,5]],[[0],[1,1],[0],[1,4],[0]],[[0],[0],[0],[0]],[[0],[0],[1,9]],[[0],[0],[1,9]],[[0],[1,7],[1,8],[0]]]},"detail":{"verts":[136,-2830,236,136,-2974,236,560,-2974,236,560,-2830,236,200,-2822,596,136,-2814,607,136,-2974,607,172.57142639160156,-2887.142822265625,607,648,-297`
+`4,241,648,-2830,241,624.4210815429688,-2829.578857421875,247,223.57894897460938,-2822.421142578125,571,200,-2822,596,172.57142639160156,-2887.142822265625,607,136,-2974,607,182.5454559326172,-2974,602,624.727294921875,-2974,247,136,-2462,897,136,-2974,897,648,-2974,897,648,-2462,897,544,-2814,606,552,-2974,606,640,-2974,606,640,-2462,606,136,-2462,606,136,-2814,607,200,-2822,606,544,-2814,606,640,-2462,606,136,-2462,236,136,-2806,236,560,-2806,236,560,-2462,236,136,-2462,391,136,-2484.2221679687`
+`5,398,136,-2550.888916015625,461,136,-2662,551,156.8000030517578,-2663.60009765625,558,240,-2670,552,229.60000610351562,-2649.199951171875,544,146.39999389648438,-2482.800048828125,398,240,-2670,552,240,-2806,552,263.058837890625,-2806,539,608.941162109375,-2806,260,632,-2806,253,610.2222290039062,-2798.4443359375,260,632,-2462,253,608.3809814453125,-2462,260,443.047607421875,-2462,391,136,-2462,391,146.39999389648438,-2482.800048828125,398,229.60000610351562,-2649.199951171875,544,240,-2670,552`
+`,610.2222290039062,-2798.4443359375,260,632,-2806,253,268,-2482,398],"vertslength":58,"tris":[3,0,1,1,2,3,7,4,5,5,6,7,11,12,13,13,14,15,16,8,9,16,9,10,11,13,15,16,10,11,11,15,16,20,17,18,18,19,20,21,22,23,21,23,24,25,26,27,25,27,28,25,28,29,33,30,31,31,32,33,41,34,35,41,35,36,38,39,40,37,38,40,36,37,40,36,40,41,45,46,47,42,43,44,44,45,47,42,44,47,55,56,48,55,48,49,55,49,50,50,54,55,50,51,57,51,52,57,53,52,57,53,54,57,50,54,57],"trislength":39,"triTopoly":[0,0,1,1,2,2,2,2,2,2,2,3,3,4,4,5,5,5,6,6,`
+`7,7,7,7,7,7,8,8,8,8,9,9,9,9,9,9,9,9,9],"baseVert":[0,4,8,17,21,25,30,34,42,48],"vertsCount":[4,4,9,4,4,5,4,8,6,10],"baseTri":[0,2,4,11,13,15,18,20,26,30],"triCount":[2,2,7,2,2,3,2,6,4,9]},"links":{"poly":[6,9],"cost":[2057.082275390625],"type":[2],"pos":[560,-2462,236,560,-2462,273.0322570800781],"length":1}}],["4_3",{"tileId":"4_3","tx":4,"ty":3,"mesh":{"verts":[656,-2462,236,648,-2822,236,648,-2974,236,1160,-2974,354,1160,-2462,354,648,-2462,897,648,-2974,897,952,-2974,897,952,-2462,897],"vert`
+`slength":9,"polys":[0,4,5,8],"polyslength":2,"regions":[1,2],"neighbors":[[[0],[0],[0],[0],[0]],[[0],[0],[0],[0]]]},"detail":{"verts":[656,-2462,236,648,-2822,236,648,-2974,236,787.6363525390625,-2974,241,1136.727294921875,-2974,352,1160,-2974,354,1160,-2462,354,770.5454711914062,-2462,236,780,-2842,238,648,-2462,897,648,-2974,897,952,-2974,897,952,-2462,897],"vertslength":13,"tris":[7,0,1,4,5,6,4,6,8,4,3,8,1,2,8,3,2,8,6,7,8,1,7,8,12,9,10,10,11,12],"trislength":10,"triTopoly":[0,0,0,0,0,0,0,0,1,`
+`1],"baseVert":[0,9],"vertsCount":[9,4],"baseTri":[0,8],"triCount":[8,2]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["5_3",{"tileId":"5_3","tx":5,"ty":3,"mesh":{"verts":[1160,-2462,357,1160,-2974,357,1320,-2974,404,1320,-2462,404],"vertslength":4,"polys":[0,3],"polyslength":1,"regions":[1],"neighbors":[[[0],[0],[0],[0]]]},"detail":{"verts":[1160,-2462,359,1160,-2974,359,1320,-2974,404,1320,-2462,404],"vertslength":4,"tris":[3,0,1,1,2,3],"trislength":2,"triTopoly":[0,0],"baseVe`
+`rt":[0],"vertsCount":[4],"baseTri":[0],"triCount":[2]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["6_3",{"tileId":"6_3","tx":6,"ty":3,"mesh":{"verts":[],"vertslength":0,"polys":[],"polyslength":0,"regions":[],"neighbors":[]},"detail":{"verts":[],"vertslength":0,"tris":[],"trislength":0,"triTopoly":[],"baseVert":[],"vertsCount":[],"baseTri":[],"triCount":[]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["0_4",{"tileId":"0_4","tx":0,"ty":4,"mesh":{"verts":[-888`
+`,-1950,269,-912,-1950,269,-920,-1990,262,-888,-2462,250,-1056,-1990,302,-1064,-1950,305,-1392,-1950,406,-888,-2462,250,-920,-1990,262,-1056,-1990,302,-1056,-1990,302,-1392,-1950,406,-1392,-2462,406,-888,-2462,250,-1048,-1950,897,-1048,-2462,897,-888,-2462,897,-888,-1950,897,-936,-1966,267,-936,-1950,269,-1040,-1950,295,-1040,-1966,295],"vertslength":22,"polys":[0,3,4,6,7,9,10,13,14,17,18,21],"polyslength":6,"regions":[1,1,1,1,2,3],"neighbors":[[[0],[0],[1,2],[0]],[[0],[0],[1,3]],[[1,0],[0],[1,3]`
+`],[[1,1],[0],[0],[1,2]],[[0],[0],[0],[0]],[[0],[0],[0],[0]]]},"detail":{"verts":[-888,-1950,269,-912,-1950,269,-920,-1990,263,-912,-2108,252,-888,-2462,250,-888,-2043.0909423828125,250,-1056,-1990,297,-1064,-1950,305,-1392,-1950,403,-888,-2462,250,-912,-2108,252,-920,-1990,263,-942.6666870117188,-1990,262,-1056,-1990,297,-1056,-1990,297,-1392,-1950,403,-1392,-2462,403,-888,-2462,250,-1048,-1950,897,-1048,-2462,897,-888,-2462,897,-888,-1950,897,-936,-1966,269,-936,-1950,269,-1040,-1950,292,-1040,`
+`-1966,292],"vertslength":26,"tris":[0,1,2,5,0,2,5,2,3,3,4,5,6,7,8,10,11,12,10,12,13,9,10,13,14,15,16,14,16,17,21,18,19,19,20,21,25,22,23,23,24,25],"trislength":14,"triTopoly":[0,0,0,0,1,2,2,2,3,3,4,4,5,5],"baseVert":[0,6,9,14,18,22],"vertsCount":[6,3,5,4,4,4],"baseTri":[0,4,5,8,10,12],"triCount":[4,1,3,2,2,2]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["1_4",{"tileId":"1_4","tx":1,"ty":4,"mesh":{"verts":[-888,-2462,247,-752,-2462,236,-744,-2278,236,-888,-1950,269,-744,-2278,2`
+`36,-376,-2278,236,-376,-1950,269,-888,-1950,269,-888,-1950,897,-888,-2462,897,-376,-2462,897,-376,-1950,897,-736,-2294,606,-736,-2462,606,-376,-2462,606,-376,-2294,606,-728,-2302,250,-728,-2462,250,-376,-2462,384,-376,-2302,253,-656,-2366,236,-656,-2462,236,-376,-2462,236,-376,-2366,236],"vertslength":24,"polys":[0,3,4,7,8,11,12,15,16,19,20,23],"polyslength":6,"regions":[2,2,1,3,4,5],"neighbors":[[[0],[0],[1,1],[0]],[[0],[0],[0],[1,0]],[[0],[0],[0],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[0]],[[0],[`
+`0],[0],[0]]]},"detail":{"verts":[-888,-2462,245,-842.6666870117188,-2462,236,-752,-2462,236,-744,-2278,236,-820.7999877929688,-2103.066650390625,236,-888,-1950,269,-888,-2066.363525390625,245,-852,-2402,236,-744,-2278,236,-376,-2278,236,-376,-2114,236,-376,-1950,269,-888,-1950,269,-820.7999877929688,-2103.066650390625,236,-888,-1950,897,-888,-2462,897,-376,-2462,897,-376,-1950,897,-736,-2294,606,-736,-2462,606,-376,-2462,606,-376,-2294,606,-728,-2302,253,-728,-2462,257,-704.5333251953125,-2462,2`
+`69,-563.7333374023438,-2462,377,-376,-2462,377,-376,-2439.142822265625,363,-376,-2324.857177734375,259,-376,-2302,253,-572,-2330,266,-668,-2354,287,-692,-2330,266,-656,-2366,236,-656,-2462,236,-376,-2462,236,-376,-2366,236],"vertslength":37,"tris":[4,5,6,6,0,7,0,1,7,3,2,7,1,2,7,3,4,7,6,4,7,8,9,10,13,8,10,13,10,11,11,12,13,17,14,15,15,16,17,21,18,19,19,20,21,25,26,27,29,22,30,29,28,30,25,27,30,28,27,30,24,23,31,24,25,31,30,25,31,30,22,32,31,30,32,22,23,32,31,23,32,36,33,34,34,35,36],"trislength":`
+`29,"triTopoly":[0,0,0,0,0,0,0,1,1,1,1,2,2,3,3,4,4,4,4,4,4,4,4,4,4,4,4,5,5],"baseVert":[0,8,14,18,22,33],"vertsCount":[8,6,4,4,11,4],"baseTri":[0,7,11,13,15,27],"triCount":[7,4,2,2,12,2]},"links":{"poly":[4,5],"cost":[2572.0693359375],"type":[2],"pos":[-656,-2462,277.4090881347656,-656,-2462,236],"length":1}}],["2_4",{"tileId":"2_4","tx":2,"ty":4,"mesh":{"verts":[-376,-2366,236,-376,-2462,236,-184,-2462,236,-184,-2366,236,-376,-2302,253,-376,-2462,384,-184,-2462,384,-184,-2302,253,-376,-2462,606,`
+`-176,-2462,606,-168,-2390,606,-376,-2294,606,-168,-2390,606,64,-2390,606,72,-2294,606,-376,-2294,606,-376,-1950,897,-376,-2462,897,136,-2462,897,136,-1950,897,-160,-2462,384,64,-2462,384,64,-2286,239,-168,-2278,236,-168,-2278,236,64,-2286,239,136,-2278,236,-376,-1950,269,-376,-2278,236,-168,-2278,236,136,-2278,236,136,-1950,269,-160,-2366,236,-160,-2462,236,64,-2462,236,64,-2366,236,80,-2398,606,80,-2462,606,136,-2462,606,72,-2294,606,64,-2390,606,80,-2398,606,136,-2294,606,72,-2294,606,80,-2398`
+`,606,136,-2462,606,88,-2366,236,88,-2462,236,136,-2462,236,136,-2366,236,88,-2302,253,88,-2462,384,136,-2462,384,136,-2302,253],"vertslength":54,"polys":[0,3,4,7,8,11,12,15,16,19,20,23,24,26,27,31,32,35,36,38,39,41,42,45,46,49,50,53],"polyslength":14,"regions":[6,4,3,3,1,2,2,2,7,5,5,5,8,9],"neighbors":[[[0],[0],[0],[0]],[[0],[0],[0],[0]],[[0],[0],[1,3],[0]],[[0],[1,10],[0],[1,2]],[[0],[0],[0],[0]],[[0],[0],[1,6],[0]],[[1,5],[0],[1,7]],[[0],[0],[1,6],[0],[0]],[[0],[0],[0],[0]],[[0],[0],[1,11]],[[`
+`1,3],[0],[1,11]],[[0],[1,10],[1,9],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[0]]]},"detail":{"verts":[-376,-2366,236,-376,-2462,236,-184,-2462,236,-184,-2366,236,-376,-2302,253,-376,-2324.857177734375,259,-376,-2439.142822265625,363,-376,-2462,377,-184,-2462,377,-184,-2439.142822265625,363,-184,-2324.857177734375,259,-184,-2302,253,-376,-2462,606,-176,-2462,606,-168,-2390,606,-376,-2294,606,-168,-2390,606,64,-2390,606,72,-2294,606,-376,-2294,606,-376,-1950,897,-376,-2462,897,136,-2462,897,136,-1950,8`
+`97,-160,-2462,377,64,-2462,377,64,-2308,246,64,-2286,236,-168,-2278,236,-167,-2301,239,-161,-2439,363,-168,-2278,236,64,-2286,236,136,-2278,236,-376,-1950,269,-376,-2114,236,-376,-2278,236,-168,-2278,236,136,-2278,236,136,-2114,236,136,-1950,269,-124,-2098,237,-160,-2366,236,-160,-2462,236,64,-2462,236,64,-2366,236,80,-2398,606,80,-2462,606,136,-2462,606,72,-2294,606,64,-2390,606,80,-2398,606,136,-2294,606,72,-2294,606,80,-2398,606,136,-2462,606,88,-2366,236,88,-2462,236,136,-2462,236,136,-2366,`
+`236,88,-2302,253,88,-2324.857177734375,259,88,-2439.142822265625,363,88,-2462,377,136,-2462,377,136,-2439.142822265625,363,136,-2324.857177734375,259,136,-2302,253],"vertslength":68,"tris":[3,0,1,1,2,3,11,4,5,6,7,8,6,8,9,10,11,5,10,5,6,6,9,10,12,13,14,12,14,15,16,17,18,16,18,19,23,20,21,21,22,23,30,24,25,27,28,29,26,27,29,26,29,30,25,26,30,31,32,33,35,36,37,40,34,41,34,35,41,37,35,41,40,39,41,37,38,41,39,38,41,45,42,43,43,44,45,46,47,48,49,50,51,52,53,54,52,54,55,59,56,57,57,58,59,67,60,61,62,63`
+`,64,62,64,65,66,67,61,66,61,62,62,65,66],"trislength":41,"triTopoly":[0,0,1,1,1,1,1,1,2,2,3,3,4,4,5,5,5,5,5,6,7,7,7,7,7,7,7,8,8,9,10,11,11,12,12,13,13,13,13,13,13],"baseVert":[0,4,12,16,20,24,31,34,42,46,49,52,56,60],"vertsCount":[4,8,4,4,4,7,3,8,4,3,3,4,4,8],"baseTri":[0,2,8,10,12,14,19,20,27,29,30,31,33,35],"triCount":[2,6,2,2,2,5,1,7,2,1,1,2,2,6]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["3_4",{"tileId":"3_4","tx":3,"ty":4,"mesh":{"verts":[136,-2366,236,136,-2462,236,560`
+`,-2462,236,560,-2366,236,136,-2302,253,136,-2462,384,632,-2462,253,632,-2302,253,136,-2294,606,136,-2462,606,640,-2462,606,640,-2294,606,136,-1950,897,136,-2462,897,648,-2462,897,648,-1950,897,136,-1950,269,136,-2278,236,648,-2278,236,648,-1950,269],"vertslength":20,"polys":[0,3,4,7,8,11,12,15,16,19],"polyslength":5,"regions":[5,4,3,1,2],"neighbors":[[[0],[0],[0],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[0]]]},"detail":{"verts":[136,-2366,236,136,-2462,236,560,-246`
+`2,236,560,-2366,236,136,-2302,253,136,-2324.857177734375,259,136,-2439.142822265625,363,136,-2462,377,466.6666564941406,-2462,374,608.3809814453125,-2462,260,632,-2462,253,632,-2302,253,220,-2330,266,580,-2330,266,460,-2450,370,136,-2294,606,136,-2462,606,640,-2462,606,640,-2294,606,136,-1950,897,136,-2462,897,648,-2462,897,648,-1950,897,136,-1950,269,136,-2114,236,136,-2278,236,648,-2278,236,648,-2114,236,648,-1950,269],"vertslength":29,"tris":[3,0,1,1,2,3,11,4,12,4,5,12,5,6,12,6,7,12,11,12,13,`
+`11,10,13,9,10,13,13,12,14,12,7,14,8,7,14,8,9,14,13,9,14,18,15,16,16,17,18,22,19,20,20,21,22,28,23,24,24,25,26,24,26,27,24,27,28],"trislength":22,"triTopoly":[0,0,1,1,1,1,1,1,1,1,1,1,1,1,2,2,3,3,4,4,4,4],"baseVert":[0,4,15,19,23],"vertsCount":[4,11,4,4,6],"baseTri":[0,2,14,16,18],"triCount":[2,12,2,2,4]},"links":{"poly":[0,1],"cost":[1945.7423095703125],"type":[2],"pos":[560,-2462,236,560,-2462,272.0161437988281],"length":1}}],["4_4",{"tileId":"4_4","tx":4,"ty":4,"mesh":{"verts":[648,-1950,897,64`
+`8,-2462,897,952,-2462,897,952,-1950,897,648,-1950,269,648,-2286,236,656,-2462,236,1160,-2462,354,1160,-1950,354],"vertslength":9,"polys":[0,3,4,8],"polyslength":2,"regions":[2,1],"neighbors":[[[0],[0],[0],[0]],[[0],[0],[0],[0],[0]]]},"detail":{"verts":[648,-1950,897,648,-2462,897,952,-2462,897,952,-1950,897,648,-1950,269,648,-2106.800048828125,236,648,-2286,236,656,-2462,236,770.5454711914062,-2462,236,1160,-2462,354,1160,-1950,354,880.727294921875,-1950,271,780,-2186,238],"vertslength":13,"tris`
+`":[3,0,1,1,2,3,6,7,8,11,4,5,9,10,12,9,8,12,5,6,12,8,6,12,10,11,12,5,11,12],"trislength":10,"triTopoly":[0,0,1,1,1,1,1,1,1,1],"baseVert":[0,4],"vertsCount":[4,9],"baseTri":[0,2],"triCount":[2,8]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["5_4",{"tileId":"5_4","tx":5,"ty":4,"mesh":{"verts":[1160,-1950,357,1160,-2462,357,1320,-2462,404,1320,-1950,404],"vertslength":4,"polys":[0,3],"polyslength":1,"regions":[1],"neighbors":[[[0],[0],[0],[0]]]},"detail":{"verts":[1160,-1950,359,1`
+`160,-2462,359,1320,-2462,404,1320,-1950,404],"vertslength":4,"tris":[3,0,1,1,2,3],"trislength":2,"triTopoly":[0,0],"baseVert":[0],"vertsCount":[4],"baseTri":[0],"triCount":[2]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["6_4",{"tileId":"6_4","tx":6,"ty":4,"mesh":{"verts":[],"vertslength":0,"polys":[],"polyslength":0,"regions":[],"neighbors":[]},"detail":{"verts":[],"vertslength":0,"tris":[],"trislength":0,"triTopoly":[],"baseVert":[],"vertsCount":[],"baseTri":[],"triCount":[]`
+`},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["0_5",{"tileId":"0_5","tx":0,"ty":5,"mesh":{"verts":[-920,-1838,298,-912,-1950,271,-888,-1950,271,-888,-1438,391,-1392,-1950,406,-1064,-1950,305,-1056,-1838,302,-1056,-1838,302,-920,-1838,298,-888,-1438,391,-1392,-1438,406,-1392,-1950,406,-1056,-1838,302,-888,-1438,391,-1048,-1854,897,-1048,-1950,897,-888,-1950,897,-888,-1854,897,-1040,-1862,295,-1040,-1950,295,-936,-1950,271,-936,-1862,290],"vertslength":22,"polys":[0,3,4,6,7,9,10`
+`,13,14,17,18,21],"polyslength":6,"regions":[1,1,1,1,2,3],"neighbors":[[[0],[0],[0],[1,2]],[[0],[0],[1,3]],[[0],[1,0],[1,3]],[[0],[1,1],[1,2],[0]],[[0],[0],[0],[0]],[[0],[0],[0],[0]]]},"detail":{"verts":[-920,-1838,300,-912,-1950,273,-888,-1950,273,-888,-1438,391,-1392,-1950,403,-1064,-1950,305,-1056,-1838,300,-1056,-1838,300,-920,-1838,300,-888,-1438,391,-1392,-1438,403,-1392,-1950,403,-1056,-1838,300,-888,-1438,391,-1346.1817626953125,-1438,391,-1048,-1854,897,-1048,-1950,897,-888,-1950,897,-88`
+`8,-1854,897,-1040,-1862,292,-1040,-1950,292,-977.5999755859375,-1950,275,-936,-1950,273,-936,-1862,290],"vertslength":24,"tris":[0,1,2,0,2,3,4,5,6,7,8,9,14,10,11,14,11,12,12,13,14,18,15,16,16,17,18,21,22,23,19,20,21,19,21,23],"trislength":12,"triTopoly":[0,0,1,2,3,3,3,4,4,5,5,5],"baseVert":[0,4,7,10,15,19],"vertsCount":[4,3,3,5,4,5],"baseTri":[0,2,3,4,7,9],"triCount":[2,1,1,3,2,3]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["1_5",{"tileId":"1_5","tx":1,"ty":5,"mesh":{"verts":`
+`[-888,-1438,391,-888,-1950,271,-376,-1950,271,-376,-1438,391,-888,-1854,897,-888,-1950,897,-376,-1950,897,-376,-1854,897],"vertslength":8,"polys":[0,3,4,7],"polyslength":2,"regions":[1,2],"neighbors":[[[0],[0],[0],[0]],[[0],[0],[0],[0]]]},"detail":{"verts":[-888,-1438,391,-888,-1950,273,-376,-1950,273,-376,-1438,391,-888,-1854,897,-888,-1950,897,-376,-1950,897,-376,-1854,897],"vertslength":8,"tris":[3,0,1,1,2,3,7,4,5,5,6,7],"trislength":4,"triTopoly":[0,0,1,1],"baseVert":[0,4],"vertsCount":[4,4]`
+`,"baseTri":[0,2],"triCount":[2,2]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["2_5",{"tileId":"2_5","tx":2,"ty":5,"mesh":{"verts":[-376,-1438,391,-376,-1950,271,136,-1950,271,136,-1438,391,-376,-1854,897,-376,-1950,897,136,-1950,897,136,-1854,897],"vertslength":8,"polys":[0,3,4,7],"polyslength":2,"regions":[1,2],"neighbors":[[[0],[0],[0],[0]],[[0],[0],[0],[0]]]},"detail":{"verts":[-376,-1438,391,-376,-1950,273,136,-1950,273,136,-1438,391,-376,-1854,897,-376,-1950,897,136,-195`
+`0,897,136,-1854,897],"vertslength":8,"tris":[3,0,1,1,2,3,7,4,5,5,6,7],"trislength":4,"triTopoly":[0,0,1,1],"baseVert":[0,4],"vertsCount":[4,4],"baseTri":[0,2],"triCount":[2,2]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["3_5",{"tileId":"3_5","tx":3,"ty":5,"mesh":{"verts":[136,-1438,391,136,-1950,271,648,-1950,271,648,-1438,391,136,-1854,897,136,-1950,897,648,-1950,897,648,-1854,897],"vertslength":8,"polys":[0,3,4,7],"polyslength":2,"regions":[1,2],"neighbors":[[[0],[0],[0],[0`
+`]],[[0],[0],[0],[0]]]},"detail":{"verts":[136,-1438,391,136,-1950,273,648,-1950,273,648,-1438,391,136,-1854,897,136,-1950,897,648,-1950,897,648,-1854,897],"vertslength":8,"tris":[3,0,1,1,2,3,7,4,5,5,6,7],"trislength":4,"triTopoly":[0,0,1,1],"baseVert":[0,4],"vertsCount":[4,4],"baseTri":[0,2],"triCount":[2,2]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["4_5",{"tileId":"4_5","tx":4,"ty":5,"mesh":{"verts":[648,-1438,391,648,-1950,271,1160,-1950,354,1160,-1438,391,648,-1854,897,6`
+`48,-1950,897,952,-1950,897,952,-1854,897],"vertslength":8,"polys":[0,3,4,7],"polyslength":2,"regions":[1,2],"neighbors":[[[0],[0],[0],[0]],[[0],[0],[0],[0]]]},"detail":{"verts":[648,-1438,391,648,-1950,273,880.727294921875,-1950,273,1160,-1950,354,1160,-1600.9090576171875,355,1160,-1438,391,648,-1854,897,648,-1950,897,952,-1950,897,952,-1854,897],"vertslength":10,"tris":[2,3,4,2,4,5,0,1,2,0,2,5,9,6,7,7,8,9],"trislength":6,"triTopoly":[0,0,0,0,1,1],"baseVert":[0,6],"vertsCount":[6,4],"baseTri":[0`
+`,4],"triCount":[4,2]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["5_5",{"tileId":"5_5","tx":5,"ty":5,"mesh":{"verts":[1160,-1438,391,1160,-1950,357,1320,-1950,404,1320,-1438,404],"vertslength":4,"polys":[0,3],"polyslength":1,"regions":[1],"neighbors":[[[0],[0],[0],[0]]]},"detail":{"verts":[1160,-1438,391,1160,-1600.9090576171875,359,1160,-1950,359,1320,-1950,404,1320,-1438,404,1251.4285888671875,-1438,391],"vertslength":6,"tris":[5,0,1,4,5,1,1,2,3,1,3,4],"trislength":4,"triTo`
+`poly":[0,0,0,0],"baseVert":[0],"vertsCount":[6],"baseTri":[0],"triCount":[4]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["6_5",{"tileId":"6_5","tx":6,"ty":5,"mesh":{"verts":[],"vertslength":0,"polys":[],"polyslength":0,"regions":[],"neighbors":[]},"detail":{"verts":[],"vertslength":0,"tris":[],"trislength":0,"triTopoly":[],"baseVert":[],"vertsCount":[],"baseTri":[],"triCount":[]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["0_6",{"tileId":"0_6","tx":0,"ty":`
+`6,"mesh":{"verts":[-1392,-1382,406,-1392,-1438,406,-888,-1438,393,-888,-1382,405],"vertslength":4,"polys":[0,3],"polyslength":1,"regions":[1],"neighbors":[[[0],[0],[0],[0]]]},"detail":{"verts":[-1392,-1382,405,-1392,-1438,403,-1346.1817626953125,-1438,395,-888,-1438,395,-888,-1382,405],"vertslength":5,"tris":[0,1,2,2,3,4,0,2,4],"trislength":3,"triTopoly":[0,0,0],"baseVert":[0],"vertsCount":[5],"baseTri":[0],"triCount":[3]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["1_6",{"ti`
+`leId":"1_6","tx":1,"ty":6,"mesh":{"verts":[-888,-1382,405,-888,-1438,393,-376,-1438,393,-376,-1382,405],"vertslength":4,"polys":[0,3],"polyslength":1,"regions":[1],"neighbors":[[[0],[0],[0],[0]]]},"detail":{"verts":[-888,-1382,405,-888,-1438,395,-376,-1438,395,-376,-1382,405],"vertslength":4,"tris":[3,0,1,1,2,3],"trislength":2,"triTopoly":[0,0],"baseVert":[0],"vertsCount":[4],"baseTri":[0],"triCount":[2]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["2_6",{"tileId":"2_6","tx":2`
+`,"ty":6,"mesh":{"verts":[-376,-1382,405,-376,-1438,393,136,-1438,393,136,-1382,405],"vertslength":4,"polys":[0,3],"polyslength":1,"regions":[1],"neighbors":[[[0],[0],[0],[0]]]},"detail":{"verts":[-376,-1382,405,-376,-1438,395,136,-1438,395,136,-1382,405],"vertslength":4,"tris":[3,0,1,1,2,3],"trislength":2,"triTopoly":[0,0],"baseVert":[0],"vertsCount":[4],"baseTri":[0],"triCount":[2]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["3_6",{"tileId":"3_6","tx":3,"ty":6,"mesh":{"verts`
+`":[136,-1382,405,136,-1438,393,648,-1438,393,648,-1382,405],"vertslength":4,"polys":[0,3],"polyslength":1,"regions":[1],"neighbors":[[[0],[0],[0],[0]]]},"detail":{"verts":[136,-1382,405,136,-1438,395,648,-1438,395,648,-1382,405],"vertslength":4,"tris":[3,0,1,1,2,3],"trislength":2,"triTopoly":[0,0],"baseVert":[0],"vertsCount":[4],"baseTri":[0],"triCount":[2]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["4_6",{"tileId":"4_6","tx":4,"ty":6,"mesh":{"verts":[648,-1382,405,648,-1438`
+`,393,1160,-1438,393,1160,-1382,405],"vertslength":4,"polys":[0,3],"polyslength":1,"regions":[1],"neighbors":[[[0],[0],[0],[0]]]},"detail":{"verts":[648,-1382,405,648,-1438,395,1160,-1438,395,1160,-1382,405],"vertslength":4,"tris":[3,0,1,1,2,3],"trislength":2,"triTopoly":[0,0],"baseVert":[0],"vertsCount":[4],"baseTri":[0],"triCount":[2]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["5_6",{"tileId":"5_6","tx":5,"ty":6,"mesh":{"verts":[1160,-1382,405,1160,-1438,393,1320,-1438,404,`
+`1320,-1382,405],"vertslength":4,"polys":[0,3],"polyslength":1,"regions":[1],"neighbors":[[[0],[0],[0],[0]]]},"detail":{"verts":[1160,-1382,405,1160,-1438,395,1274.2857666015625,-1438,395,1320,-1438,404,1320,-1382,405],"vertslength":5,"tris":[2,3,4,0,1,2,0,2,4],"trislength":3,"triTopoly":[0,0,0],"baseVert":[0],"vertsCount":[5],"baseTri":[0],"triCount":[3]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}],["6_6",{"tileId":"6_6","tx":6,"ty":6,"mesh":{"verts":[],"vertslength":0,"polys":`
+`[],"polyslength":0,"regions":[],"neighbors":[]},"detail":{"verts":[],"vertslength":0,"tris":[],"trislength":0,"triTopoly":[],"baseVert":[],"vertsCount":[],"baseTri":[],"triCount":[]},"links":{"poly":[],"cost":[],"type":[],"pos":[],"length":0}}]]}`;
    }
}

/**
 * @module 导航网格/开放跨度
 */

/** 当前世界参数下的最大 span 数量（由世界尺寸与体素尺寸自动计算）。 */
const totalspan = ((MESH_WORLD_SIZE_XY / MESH_CELL_SIZE_XY) + 1) * ((MESH_WORLD_SIZE_XY / MESH_CELL_SIZE_XY) + 1) * ((MESH_WORLD_SIZE_Z / MESH_TRACE_SIZE_Z) + 1);

// SOA 结构 (Structure of Arrays) 内存布局优化
// 按属性分离存储，提高缓存局部性，减少内存碎片
/** 每个 span 的地板高度（体素单位），SOA 布局。 */
const floor = new Int16Array(totalspan);
/** 每个 span 的天花板高度（体素单位），SOA 布局。 */
const ceiling = new Int16Array(totalspan);
/** 链表指针——指向同列下一个 span 的索引。 */
const next = new Uint32Array(totalspan);
/** 每个 span 所属的区域 ID。 */
const regionId = new Uint16Array(totalspan);
/** 距离场值，用于腐蚀运算。 */
const distance = new Uint16Array(totalspan);
/** 降噪后的距离场值。 */
const denoisedistance = new Uint16Array(totalspan);
/** 每个 span 的 4 邻居索引（W, N, E, S），0 表示无邻居。 */
const neighbor = new Uint32Array(totalspan * 4);
/** 位图——标记 span 是否正在使用（1 bit = 1 span）。 */
const use = new Uint8Array(Math.ceil(totalspan / 8));
/** 距离场无穷大常量（0xFFFF）。 */
const DISTANCE_INF = 0xFFFF;

// 内存占用计算：
// Int16Array: 2 bytes * totalspan
// Int16Array: 2 bytes * totalspan
// Uint32Array: 4 bytes * totalspan
// Uint16Array: 2 bytes * totalspan
// Uint16Array: 2 bytes * totalspan
// Uint8Array: 1 byte * (totalspan/8)
// ≈ 13 bytes per span (vs 40+ bytes with object fields)

// ============ 纯函数式 API ============
// 所有操作都直接基于 ID，无需创建对象，内存占用为 0
/**
 * Span 低级操作 API（SOA 结构）。
 *
 * 使用 Structure of Arrays 模式将 Span 属性存储在 TypedArray 中，
 * 所有方法均为静态纯函数，通过 ID 直接读写，
 * 内存占用约 13 bytes/span（对比对象方式 40+ bytes）。
 *
 * @navigationTitle Span 操作 API
 */
class OpenSpan{
    /**
     * 初始化一个 span
     * @param {number} id 
     * @param {number} m_floor 
     * @param {number} m_ceiling 
     */
    static initSpan(id, m_floor, m_ceiling) {
        floor[id] = m_floor;
        ceiling[id] = m_ceiling;
        next[id] = 0;
        regionId[id] = 0;
        distance[id] = 0;
        denoisedistance[id]=0;
        const base = id << 2;
        neighbor[base] = 0;
        neighbor[base + 1] = 0;
        neighbor[base + 2] = 0;
        neighbor[base + 3] = 0;
        use[id >> 3] |= (1 << (id & 7));  // 设置 use 位
    }

    /**
     * 获取 floor 值
     * @param {number} id 
     * @returns {number}
     */
    static getFloor(id) {
        return floor[id];
    }

    /**
     * 设置 floor 值
     * @param {number} id 
     * @param {number} value 
     */
    static setFloor(id, value) {
        floor[id] = value;
    }

    /**
     * 获取 ceiling 值
     * @param {number} id 
     * @returns {number}
     */
    static getCeiling(id) {
        return ceiling[id];
    }

    /**
     * 设置 ceiling 值
     * @param {number} id 
     * @param {number} value 
     */
    static setCeiling(id, value) {
        ceiling[id] = value;
    }

    /**
     * 获取下一个 span 的 ID
     * @param {number} id 
     * @returns {number} 0 表示没有下一个
     */
    static getNext(id) {
        return next[id];
    }

    /**
     * 设置下一个 span 的 ID
     * @param {number} id 
     * @param {number} nextId 
     */
    static setNext(id, nextId) {
        next[id] = nextId;
    }

    /**
     * 获取 use 状态
     * @param {number} id 
     * @returns {boolean}
     */
    static getUse(id) {
        return (use[id >> 3] & (1 << (id & 7))) !== 0;
    }

    /**
     * 设置 use 状态
     * @param {number} id 
     * @param {boolean} flag 
     */
    static setUse(id, flag) {
        if (flag) {
            use[id >> 3] |= (1 << (id & 7));
        } else {
            use[id >> 3] &= ~(1 << (id & 7));
        }
    }

    /**
     * 获取 region ID
     * @param {number} id 
     * @returns {number}
     */
    static getRegionId(id) {
        return regionId[id];
    }

    /**
     * 设置 region ID
     * @param {number} id 
     * @param {number} rid 
     */
    static setRegionId(id, rid) {
        regionId[id] = rid;
    }

    /**
     * 获取距离值
     * @param {number} id 
     * @returns {number}
     */
    static getDistance(id) {
        const d = distance[id];
        return d === DISTANCE_INF ? Infinity : d;
    }

    /**
     * 设置距离值
     * @param {number} id 
     * @param {number} dist 
     */
    static setDistance(id, dist) {
        if (!Number.isFinite(dist)) {
            distance[id] = DISTANCE_INF;
            return;
        }

        if (dist <= 0) {
            distance[id] = 0;
            return;
        }

        const clamped = Math.min(DISTANCE_INF - 1, Math.floor(dist));
        distance[id] = clamped;
    }

    /**
     * 获取距离值
     * @param {number} id 
     * @returns {number}
     */
    static getDenoiseDistance(id) {
        const d = denoisedistance[id];
        return d === DISTANCE_INF ? Infinity : d;
    }

    /**
     * 设置距离值
     * @param {number} id 
     * @param {number} dist 
     */
    static setDenoiseDistance(id, dist) {
        if (!Number.isFinite(dist)) {
            denoisedistance[id] = DISTANCE_INF;
            return;
        }

        if (dist <= 0) {
            denoisedistance[id] = 0;
            return;
        }

        const clamped = Math.min(DISTANCE_INF - 1, Math.floor(dist));
        denoisedistance[id] = clamped;
    }
    /**
     * 获取指定方向邻居 spanId
     * @param {number} id
     * @param {number} dir 0:W, 1:N, 2:E, 3:S
     * @returns {number}
     */
    static getNeighbor(id, dir) {
        return neighbor[(id << 2) + dir];
    }

    /**
     * 设置指定方向邻居 spanId
     * @param {number} id
     * @param {number} dir 0:W, 1:N, 2:E, 3:S
     * @param {number} neighborId
     */
    static setNeighbor(id, dir, neighborId) {
        neighbor[(id << 2) + dir] = neighborId;
    }

    /**
     * 清空 [startId, endId] 范围内的 span 数据
     * @param {number} startId
     * @param {number} endId
     */
    static clearRange(startId, endId) {
        const s = Math.max(1, startId | 0);
        const e = Math.max(s, endId | 0);
        for (let id = s; id <= e; id++) {
            floor[id] = 0;
            ceiling[id] = 0;
            next[id] = 0;
            regionId[id] = 0;
            distance[id] = 0;
            denoisedistance[id]=0;
            const base = id << 2;
            neighbor[base] = 0;
            neighbor[base + 1] = 0;
            neighbor[base + 2] = 0;
            neighbor[base + 3] = 0;
            use[id >> 3] &= ~(1 << (id & 7));
        }
    }

    /**
     * 双向通行检查（id1 和 id2 之间能否通行）
     * @param {number} id1 
     * @param {number} id2 
     * @param {number} maxStep 
     * @param {number} agentHeight 
     * @returns {boolean}
     */
    static canTraverseTo(id1, id2, maxStep = MAX_WALK_HEIGHT, agentHeight = AGENT_HEIGHT) {
        // 检查 id2 是否在使用
        if (!this.getUse(id2)) return false;
        
        // 高度差检查
        if (Math.abs(floor[id2] - floor[id1]) > maxStep) {
            return false;
        }

        // 检查两个 span 之间能否通行
        const floorLevel = Math.max(floor[id1], floor[id2]);
        const ceilLevel = Math.min(ceiling[id1], ceiling[id2]);

        if (ceilLevel - floorLevel < agentHeight) {
            return false;
        }

        return true;
    }

    /**
     * 单向通行检查（从 id1 只能往上到 id2）
     * @param {number} id1 
     * @param {number} id2 
     * @param {number} maxStep 
     * @param {number} agentHeight 
     * @returns {boolean}
     */
    static canTo(id1, id2, maxStep = MAX_WALK_HEIGHT, agentHeight = AGENT_HEIGHT) {
        // 检查 id2 是否在使用
        //if (!this.getUse(id2)) return false;
        
        // 只允许上升 maxStep 高度
        if (floor[id2] - floor[id1] > maxStep) {
            return false;
        }

        // 检查高度空间
        const floorLevel = floor[id1];
        const ceilLevel = ceiling[id2];

        if (ceilLevel - floorLevel < agentHeight) {
            return false;
        }

        return true;
    }
}

/**
 * @module 导航网格/开放高度场
 */
/**@typedef {import("cs_script/point_script").Vector} Vector */

/**
 * 开放高度场（体素化）。
 *
 * 将 3D 场景通过列式体素化转换为可行走 Span 链表。
 * 支持坡度检测、边缘腐蚀（erode）和 Padding 标记。
 * 是整个 Navmesh 构建管线的第一步。
 *
 * @navigationTitle 开放高度场
 */
class OpenHeightfield {
    /**
     * 创建指定 Tile 坐标和尺寸参数的开放高度场。
     * @param {number} tx
     * @param {number} ty
     * @param {number} tileSize
     * @param {number} fullGrid
     * @param {number} tilePadding
     */
    constructor(tx, ty, tileSize, fullGrid, tilePadding) {
        /** @type {number} Span 自增 ID 计数器，从 1 开始（0 表示链表终止） */
        this.SPAN_ID = 1;

        /** @type {number} 当前 Tile 的 X 索引 */
        this.tx = tx;
        /** @type {number} 当前 Tile 的 Y 索引 */
        this.ty = ty;
        /** @type {number} Tile 边长（体素单位） */
        this.tileSize = tileSize;
        /** @type {number} 世界网格总边长 */
        this.fullGrid = fullGrid;
        /** @type {number} Tile 边界填充宽度（体素单位） */
        this.tilePadding = tilePadding;

        this.coreMinX = tx * tileSize;
        this.coreMinY = ty * tileSize;
        this.coreMaxX = Math.min(fullGrid - 1, this.coreMinX + tileSize - 1);
        this.coreMaxY = Math.min(fullGrid - 1, this.coreMinY + tileSize - 1);

        this.buildMinX = Math.max(0, this.coreMinX - tilePadding);
        this.buildMinY = Math.max(0, this.coreMinY - tilePadding);
        this.buildMaxX = Math.min(fullGrid - 1, this.coreMaxX + tilePadding);
        this.buildMaxY = Math.min(fullGrid - 1, this.coreMaxY + tilePadding);

        this.localCoreMinX = this.coreMinX - this.buildMinX;
        this.localCoreMinY = this.coreMinY - this.buildMinY;
        this.localCoreMaxX = this.coreMaxX - this.buildMinX;
        this.localCoreMaxY = this.coreMaxY - this.buildMinY;

        this.baseX = this.buildMinX;
        this.baseY = this.buildMinY;
        this.gridX = this.buildMaxX - this.buildMinX + 1;
        this.gridY = this.buildMaxY - this.buildMinY + 1;
        this.tileCoreMinX = this.coreMinX;
        this.tileCoreMaxX = this.coreMaxX + 1;
        this.tileCoreMinY = this.coreMinY;
        this.tileCoreMaxY = this.coreMaxY + 1;

        this.cells = new Array(this.gridX);
        for (let i = 0; i < this.gridX; i++) {
            this.cells[i] = new Uint32Array(this.gridY);
        }

        this.mins = { x: -MESH_CELL_SIZE_XY / 2, y: -MESH_CELL_SIZE_XY / 2, z: -MESH_TRACE_SIZE_Z / 2 };
        this.maxs = { x: MESH_CELL_SIZE_XY / 2, y: MESH_CELL_SIZE_XY / 2, z: MESH_TRACE_SIZE_Z / 2 };
    }
    /**
     * 执行体素化。
     *
     * 遍历构建区域内运行列式射线检测，生成可行走 Span 链表，
     * 然后执行边缘腐蚀和 Padding 标记。
     */
    init() {
        const minZ = origin.z;
        const maxZ = origin.z + MESH_WORLD_SIZE_Z;
        for (let x = 0; x < this.gridX; x++) {
            for (let y = 0; y < this.gridY; y++) {
                const worldX = origin.x + (this.baseX + x) * MESH_CELL_SIZE_XY;
                const worldY = origin.y + (this.baseY + y) * MESH_CELL_SIZE_XY;
                this.cells[x][y] = this.voxelizeColumn(worldX, worldY, minZ, maxZ);
            }

        }
        this.erode(MESH_ERODE_RADIUS);
        this.markPaddingAsUnwalkable();
    }

    /**
     * 对单列体素执行从顶到底的射线检测。
     *
     * 反复向下射线寻找地板，向上射线寻找天花板，
     * 生成符合高度/坡度见条件的 OpenSpan 并插入链表。
     *
     * @param {number} wx 世界 X 坐标
     * @param {number} wy 世界 Y 坐标
     * @param {number} minZ 最低 Z 
     * @param {number} maxZ 最高 Z
     * @returns {number} 链表头 Span ID，0 表示空
     */
    voxelizeColumn(wx, wy, minZ, maxZ) {
        let head = 0;  // 0 表示链表为空
        let currentZ = maxZ;
        const radius = MESH_TRACE_SIZE_Z / 2;

        while (currentZ >= minZ + radius) {
            //寻找地板 (floor)
            const downStart = { x: wx, y: wy, z: currentZ };
            const downEnd = { x: wx, y: wy, z: minZ };
            const downTr = Instance.TraceBox({ mins: this.mins, maxs: this.maxs, start: downStart, end: downEnd, ignorePlayers: true });
            if (!downTr || !downTr.didHit) break; // 下面没东西了，结束

            const floorZ = downTr.end.z - radius;

            //从地板向上寻找天花板 (ceiling)
            const upStart = { x: wx, y: wy, z: downTr.end.z + 1 };
            const upEnd = { x: wx, y: wy, z: maxZ };
            const upTr = Instance.TraceBox({ mins: this.mins, maxs: this.maxs, start: upStart, end: upEnd, ignorePlayers: true });

            let ceilingZ = maxZ;
            if (upTr.didHit) ceilingZ = upTr.end.z + radius;

            const floor = Math.round(floorZ - origin.z);
            const ceiling = Math.round(ceilingZ - origin.z);

            const slopeWalkable = this.isSlopeWalkableByNormal(downTr.normal);
            if ((ceiling - floor) >= AGENT_HEIGHT && slopeWalkable) {
                const newId = this.SPAN_ID++;
                OpenSpan.initSpan(newId, floor, ceiling);

                if (head === 0 || floor < OpenSpan.getFloor(head)) {
                    OpenSpan.setNext(newId, head);
                    head = newId;
                } else {
                    let curr = head;
                    while (OpenSpan.getNext(curr) !== 0 && OpenSpan.getFloor(OpenSpan.getNext(curr)) < floor) {
                        curr = OpenSpan.getNext(curr);
                    }
                    OpenSpan.setNext(newId, OpenSpan.getNext(curr));
                    OpenSpan.setNext(curr, newId);
                }
            }

            currentZ = floorZ - radius - 1;
        }

        return head;
    }

    /**
     * 根据命中法线判断坡度是否可行走。
     * @param {Vector} normal
     * @returns {boolean}
     */
    isSlopeWalkableByNormal(normal) {
        if (!normal) return false;

        const len = Math.hypot(normal.x, normal.y, normal.z);
        if (len <= 1e-6) return false;

        const upDot = Math.max(-1, Math.min(1, normal.z / len));
        const slopeDeg = Math.acos(upDot) * 180 / Math.PI;
        return slopeDeg <= MAX_SLOPE;
    }
    /**
     * 根据半径腐蚀可行走区域。
     *
     * 通过距离场传播将边缘附近的 Span 标记为不可行走，
     * 避免怪物贴墙行走。
     *
     * @param {number} radius 腐蚀半径（体素单位）
     */
    erode(radius) {
        if (radius <= 0) return;

        // 1. 初始化距离场，默认给一个很大的值
        // 使用 Uint16Array 节省内存，索引为 span id
        const distances = new Uint16Array(this.SPAN_ID + 1).fill(65535);
        const dirs = [{ dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }];

        // 2. 标记边界点（距离为 0）
        for (let i = 0; i < this.gridX; i++) {
            for (let j = 0; j < this.gridY; j++) {
                let spanId = this.cells[i][j];
                while (spanId !== 0) {
                    if (OpenSpan.getUse(spanId)) {
                        let isBoundary = false;
                        for (let d = 0; d < 4; d++) {
                            const nx = i + dirs[d].dx;
                            const ny = j + dirs[d].dy;

                            // 触碰地图边界或没有邻居，即为边界
                            if (nx < 0 || ny < 0 || nx >= this.gridX || ny >= this.gridY) {
                                isBoundary = true;
                                break;
                            }

                            let hasNeighborInDir = false;
                            let nspanId = this.cells[nx]?.[ny] || 0;
                            while (nspanId !== 0) {
                                if (OpenSpan.getUse(nspanId)) {
                                    if (OpenSpan.canTraverseTo(spanId, nspanId)) {
                                        hasNeighborInDir = true;
                                        break;
                                    }
                                }
                                nspanId = OpenSpan.getNext(nspanId);
                            }

                            // 任一方向缺失可达邻居，就视为边界
                            if (!hasNeighborInDir) {
                                isBoundary = true;
                                break;
                            }
                        }
                        if (isBoundary) distances[spanId] = 0;
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }

        // 3. 两次遍历计算精确距离场 (Pass 1: Top-Left to Bottom-Right)
        this._passDist(distances, true);
        // (Pass 2: Bottom-Right to Top-Left)
        this._passDist(distances, false);

        // 4. 根据 AGENT_RADIUS 删除不合格的 Span
        for (let i = 0; i < this.gridX; i++) {
            for (let j = 0; j < this.gridY; j++) {
                let spanId = this.cells[i][j];
                while (spanId !== 0) {
                    if (OpenSpan.getUse(spanId)) {
                        // 如果距离边界太近，则剔除
                        if (distances[spanId] < radius) {
                            OpenSpan.setUse(spanId, false);
                        }
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }
    }

    /**
     * 内部辅助：距离场传递
     * @param {Uint16Array} distances
     * @param {boolean} forward
     */
    _passDist(distances, forward) {
        const dirs = [{ dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }];
        const startX = forward ? 0 : this.gridX - 1;
        const endX = forward ? this.gridX : -1;
        const step = forward ? 1 : -1;

        for (let i = startX; i !== endX; i += step) {
            for (let j = forward ? 0 : this.gridY - 1; j !== (forward ? this.gridY : -1); j += step) {
                let spanId = this.cells[i][j];
                while (spanId !== 0) {
                    if (OpenSpan.getUse(spanId)) {
                        for (let d = 0; d < 4; d++) {
                            const nx = i + dirs[d].dx;
                            const ny = j + dirs[d].dy;
                            if (nx < 0 || ny < 0 || nx >= this.gridX || ny >= this.gridY) continue;

                            let nspanId = this.cells[nx]?.[ny] || 0;
                            while (nspanId !== 0) {
                                if (OpenSpan.getUse(nspanId)) {
                                    if (OpenSpan.canTraverseTo(spanId, nspanId)) {
                                        // 核心公式：当前点距离 = min(当前距离, 邻居距离 + 1)
                                        distances[spanId] = Math.min(distances[spanId], distances[nspanId] + 1);
                                    }
                                }
                                nspanId = OpenSpan.getNext(nspanId);
                            }
                        }
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }
    }

    /**
     * 仅让 tile core 参与区域和轮廓生成，padding 只提供体素上下文
     */
    markPaddingAsUnwalkable() {
        for (let i = 0; i < this.gridX; i++) {
            for (let j = 0; j < this.gridY; j++) {
                if (i >= this.localCoreMinX && i <= this.localCoreMaxX && j >= this.localCoreMinY && j <= this.localCoreMaxY) continue;

                let spanId = this.cells[i][j];
                while (spanId !== 0) {
                    OpenSpan.setUse(spanId, false);
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }
    }

    debug(duration = 30) {
        for (let i = 0; i < this.gridX; i++) {
            for (let j = 0; j < this.gridY; j++) {
                let spanId = this.cells[i][j];
                while (spanId !== 0) {
                    if (OpenSpan.getUse(spanId)) {
                        const c = {
                            r: 255,
                            g: 255,
                            b: 0
                        };
                        Instance.DebugSphere({
                            center: {
                                x: origin.x + (this.baseX + i) * MESH_CELL_SIZE_XY,
                                y: origin.y + (this.baseY + j) * MESH_CELL_SIZE_XY,
                                z: origin.z + OpenSpan.getFloor(spanId) * MESH_CELL_SIZE_Z
                            },
                            radius: 3,
                            duration,
                            color: c
                        });
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }
    }
}

/**
 * @module 导航网格/区域生成器
 */

/**
 * 区域生成器。
 *
 * 通过分水岭算法将可行走 Span 分割为不同区域：
 * 1. 双向扫描构建距离场。
 * 2. 分水岭洪填分配区域 ID。
 * 3. 合并小区域 / 过滤噪声。
 * 输出供 ContourBuilder 使用。
 *
 * @navigationTitle 区域生成器
 */
class RegionGenerator {
    /**
     * 初始化区域生成器，绑定开放高度场数据。
     * @param {OpenHeightfield} openHeightfield
     */
    constructor(openHeightfield) {
        /** @type {Uint32Array[]} 开放高度场单元格数组（Span 链表头） */
        this.hf = openHeightfield.cells;
        /** @type {number} 构建区域 X 基址偏移 */
        this.baseX = openHeightfield.baseX;
        /** @type {number} 构建区域 Y 基址偏移 */
        this.baseY = openHeightfield.baseY;

        /** @type {number} 构建区域 X 方向网格数 */
        this.gridX = openHeightfield.gridX;
        /** @type {number} 构建区域 Y 方向网格数 */
        this.gridY = openHeightfield.gridY;

        /** @type {number} 区域 ID 自增计数器 */
        this.nextRegionId = 1;
    }

    /**
     * 执行区域生成全流程。
     *
     * 依次构建邻居关系、距离场、分水岭区域，最后合并过小区域。
     */
    init() {
        this.buildCompactNeighbors();
        this.buildDistanceField();
        this.buildRegionsWatershed();
        this.mergeAndFilterRegions();
    }
    /**
     * 为每个 Span 建立 4 方向邻居关系。
     */
    buildCompactNeighbors() {
        const dirs = [
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: -1 }
        ];

        for (let x = 0; x < this.gridX; x++) {
            for (let y = 0; y < this.gridY; y++) {
                let spanId = this.hf[x][y];
                while (spanId !== 0) {
                    if(OpenSpan.getUse(spanId))
                    {
                        for (let d = 0; d < 4; d++) {
                            const nx = x + dirs[d].dx;
                            const ny = y + dirs[d].dy;
                            if (nx < 0 || ny < 0 || nx >= this.gridX || ny >= this.gridY) {
                                OpenSpan.setNeighbor(spanId, d, 0);
                                continue;
                            }

                            let best = 0;
                            let bestDiff = Infinity;
                            let nspanId = this.hf[nx][ny];

                            while (nspanId !== 0) {
                                if(OpenSpan.getUse(nspanId))
                                {
                                    if (OpenSpan.canTraverseTo(spanId, nspanId)) {
                                        const diff = Math.abs(OpenSpan.getFloor(spanId) - OpenSpan.getFloor(nspanId));
                                        if (diff < bestDiff) {
                                            best = nspanId;
                                            bestDiff = diff;
                                        }
                                    }
                                }
                                nspanId = OpenSpan.getNext(nspanId);
                            }

                            OpenSpan.setNeighbor(spanId, d, best);
                        }
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }
    }

    /**
     * 获取对角线邻居。
     * 例如：西北 (NW) = 先向西(0)再向北(1)
     * @param {number} spanId 
     * @param {number} dir1 
     * @param {number} dir2 
     * @returns {number} 邻居spanId，0表示无邻居
     */
    getDiagonalNeighbor(spanId, dir1, dir2) {
        const first = OpenSpan.getNeighbor(spanId, dir1);
        if (first !== 0) {
            const diagonal = OpenSpan.getNeighbor(first, dir2);
            if (diagonal !== 0) return diagonal;
        }

        const second = OpenSpan.getNeighbor(spanId, dir2);
        if (second !== 0) {
            return OpenSpan.getNeighbor(second, dir1);
        }

        return 0;
    }
    //构建距离场
    buildDistanceField() {
        // 1. 初始化：边界设为0，内部设为无穷大
        for (let x = 0; x < this.gridX; x++) {
            for (let y = 0; y < this.gridY; y++) {
                let spanId = this.hf[x][y];
                while (spanId !== 0) {
                    if(OpenSpan.getUse(spanId))
                    {
                        // 如果任意一个邻居缺失，说明是边界
                        OpenSpan.setDistance(spanId, this.isBorderSpan(spanId) ? 0 : Infinity);
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }

        // 第一遍扫描：从左下到右上
        // 西(0)、西南(0+3)、南(3)、东南(3+2)
        for (let y = 0; y < this.gridY; y++) {
            for (let x = 0; x < this.gridX; x++) {
                let spanId = this.hf[x][y];
                while (spanId !== 0) {
                    if(OpenSpan.getUse(spanId))
                    {
                        if (OpenSpan.getDistance(spanId) > 0) {
                            // 西
                            let n = OpenSpan.getNeighbor(spanId, 0);
                            if (n !== 0) OpenSpan.setDistance(spanId, Math.min(OpenSpan.getDistance(spanId), OpenSpan.getDistance(n) + 2));
                            // 西南
                            let nd = this.getDiagonalNeighbor(spanId, 0, 3);
                            if (nd !== 0) OpenSpan.setDistance(spanId, Math.min(OpenSpan.getDistance(spanId), OpenSpan.getDistance(nd) + 3));
                            // 南
                            n = OpenSpan.getNeighbor(spanId, 3);
                            if (n !== 0) OpenSpan.setDistance(spanId, Math.min(OpenSpan.getDistance(spanId), OpenSpan.getDistance(n) + 2));
                            // 东南
                            nd = this.getDiagonalNeighbor(spanId, 3, 2);
                            if (nd !== 0) OpenSpan.setDistance(spanId, Math.min(OpenSpan.getDistance(spanId), OpenSpan.getDistance(nd) + 3));
                        }
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }

        // 第二遍扫描：从右上到左下
        // 东(2)、东北(2+1)、北(1)、西北(1+0)
        for (let y = this.gridY - 1; y >= 0; y--) {
            for (let x = this.gridX - 1; x >= 0; x--) {
                let spanId = this.hf[x][y];
                while (spanId !== 0) {
                    if(OpenSpan.getUse(spanId))
                    {
                        if (OpenSpan.getDistance(spanId) > 0) {
                            // 东
                            let n = OpenSpan.getNeighbor(spanId, 2);
                            if (n !== 0) OpenSpan.setDistance(spanId, Math.min(OpenSpan.getDistance(spanId), OpenSpan.getDistance(n) + 2));
                            // 东北
                            let nd = this.getDiagonalNeighbor(spanId, 2, 1);
                            if (nd !== 0) OpenSpan.setDistance(spanId, Math.min(OpenSpan.getDistance(spanId), OpenSpan.getDistance(nd) + 3));
                            // 北
                            n = OpenSpan.getNeighbor(spanId, 1);
                            if (n !== 0) OpenSpan.setDistance(spanId, Math.min(OpenSpan.getDistance(spanId), OpenSpan.getDistance(n) + 2));
                            // 西北
                            let nd2 = this.getDiagonalNeighbor(spanId, 1, 0);
                            if (nd2 !== 0) OpenSpan.setDistance(spanId, Math.min(OpenSpan.getDistance(spanId), OpenSpan.getDistance(nd2) + 3));
                        }
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }
        // 第二遍扫描后，distance 场已经稳定了，可以用来做降噪了
        for (let x = 0; x < this.gridX; x++) {
            for (let y = 0; y < this.gridY; y++) {
                let spanId = this.hf[x][y];
                while (spanId !== 0) {
                    if(OpenSpan.getUse(spanId))
                    {
                        let all=OpenSpan.getDistance(spanId);
                        let n = OpenSpan.getNeighbor(spanId, 0);
                        if (n !== 0)all+=OpenSpan.getDistance(n);
                        else all+=OpenSpan.getDistance(spanId);
                        n = OpenSpan.getNeighbor(spanId, 1);
                        if (n !== 0)all+=OpenSpan.getDistance(n);
                        else all+=OpenSpan.getDistance(spanId);
                        n = OpenSpan.getNeighbor(spanId, 2);
                        if (n !== 0)all+=OpenSpan.getDistance(n);
                        else all+=OpenSpan.getDistance(spanId);
                        n = OpenSpan.getNeighbor(spanId, 3);
                        if (n !== 0)all+=OpenSpan.getDistance(n);
                        else all+=OpenSpan.getDistance(spanId);

                        n = this.getDiagonalNeighbor(spanId, 0,3);
                        if (n !== 0)all+=OpenSpan.getDistance(n);
                        else all+=OpenSpan.getDistance(spanId);
                        n = this.getDiagonalNeighbor(spanId, 0,1);
                        if (n !== 0)all+=OpenSpan.getDistance(n);
                        else all+=OpenSpan.getDistance(spanId);

                        n = this.getDiagonalNeighbor(spanId, 2,3);
                        if (n !== 0)all+=OpenSpan.getDistance(n);
                        else all+=OpenSpan.getDistance(spanId);
                        n = this.getDiagonalNeighbor(spanId, 2,1);
                        if (n !== 0)all+=OpenSpan.getDistance(n);
                        else all+=OpenSpan.getDistance(spanId);

                        // 如果任意一个邻居缺失，说明是边界
                        OpenSpan.setDenoiseDistance(spanId, all/9);
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }
    }

    /**
     * 是否是边界span
     * @param {number} spanId
     */
    isBorderSpan(spanId) {
        for (let d = 0; d < 4; d++) {
            if (OpenSpan.getNeighbor(spanId, d) === 0) return true;
        }
        return false;
    }

    //洪水扩张
    buildRegionsWatershed() {
        // 1) 按 denoiseDistance 收集所有可用 span，并重置 regionId
        //    distBuckets: 下标=距离值，value=该距离上的 span 列表
        /** @type {number[][]} */
        const distBuckets = [];
        let maxDist = 0;

        for (let x = 0; x < this.gridX; x++) {
            for (let y = 0; y < this.gridY; y++) {
                let spanId = this.hf[x][y];
                while (spanId !== 0) {
                    if(OpenSpan.getUse(spanId))
                    {
                        OpenSpan.setRegionId(spanId, 0);
                        const dist = OpenSpan.getDenoiseDistance(spanId);
                        if (Number.isFinite(dist) && dist >= 0) {
                            const d = Math.floor(dist);
                            if (!distBuckets[d]) distBuckets[d] = [];
                            distBuckets[d].push(spanId);
                            if (d > maxDist) maxDist = d;
                        }
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }

        // 2) 生成“每隔2个距离一个批次”的批次列表（从大到小）
        //    这里的阈值计算会自然形成：当 maxDist 为偶数时，首批包含 d-2/d-1/d
        /** @type {number[][]} */
        const batches = [];
        let coveredMin = maxDist + 1;
        let level = (maxDist + 1) & -2;

        while (coveredMin > 0) {
            const threshold = Math.max(level - 2, 0);
            const batch = [];

            for (let dist = coveredMin - 1; dist >= threshold; dist--) {
                const list = distBuckets[dist];
                if (list && list.length > 0) batch.push(...list);
            }

            if (batch.length > 0) batches.push(batch);

            coveredMin = threshold;
            level = Math.max(level - 2, 0);
        }

        // 3) 逐批处理（从高距离到低距离）
        for (const batch of batches) {
            // batchSet 用于 O(1) 判断邻居是否仍在当前批次内
            const batchSet = new Set(batch);

            // queue 是“旧水位”的广度扩张队列（BFS）
            // 只装入已经被赋予 region 的节点，向同批次未赋值节点扩散
            const queue = [];

            // 3.1 先尝试让本批次节点接入已有 region（来自历史批次或已处理节点）
            for (const spanId of batch) {
                if (OpenSpan.getRegionId(spanId) !== 0) {
                    queue.push(spanId);
                    continue;
                }

                let bestRegion = 0;
                let maxNeighborDist = -1;

                // 从4邻域中挑一个“最靠内”（距离更大）的已有 region 作为接入目标
                for (let d = 0; d < 4; d++) {
                    const n = OpenSpan.getNeighbor(spanId, d);
                    if (n === 0) continue;

                    const neighborRegion = OpenSpan.getRegionId(n);
                    if (neighborRegion === 0) continue;

                    const neighborDist = OpenSpan.getDenoiseDistance(n);
                    if (neighborDist > maxNeighborDist) {
                        maxNeighborDist = neighborDist;
                        bestRegion = neighborRegion;
                    }
                }

                if (bestRegion !== 0) {
                    OpenSpan.setRegionId(spanId, bestRegion);
                    queue.push(spanId);
                }
            }

            // 3.2 旧水位 BFS：在当前批次内，把已接入的 region 尽量向外扩散
            for (let q = 0; q < queue.length; q++) {
                const current = queue[q];
                const rid = OpenSpan.getRegionId(current);

                for (let d = 0; d < 4; d++) {
                    const n = OpenSpan.getNeighbor(current, d);
                    if (n === 0) continue;
                    if (!batchSet.has(n)) continue;
                    if (OpenSpan.getRegionId(n) !== 0) continue;

                    OpenSpan.setRegionId(n, rid);
                    queue.push(n);
                }
            }

            // 3.3 对仍未覆盖的节点创建新水位（新 region），并立即 DFS 泛洪
            for (const spanId of batch) {
                if (OpenSpan.getRegionId(spanId) !== 0) continue;

                const rid = this.nextRegionId++;
                OpenSpan.setRegionId(spanId, rid);

                // stack 是“新水位”深度扩张栈（DFS）
                const stack = [spanId];
                while (stack.length > 0) {
                    const current = stack.pop();
                    if (current === undefined) break;

                    for (let d = 0; d < 4; d++) {
                        const n = OpenSpan.getNeighbor(current, d);
                        if (n === 0) continue;
                        if (!batchSet.has(n)) continue;
                        if (OpenSpan.getRegionId(n) !== 0) continue;

                        OpenSpan.setRegionId(n, rid);
                        stack.push(n);
                    }
                }
            }
        }
    }
    //合并过滤小region
    mergeAndFilterRegions() {
        /**@type {Map<number,number[]>} */
        const regionSpans = new Map();

        //统计每个region包含的span
        for (let x = 0; x < this.gridX; x++) {
            for (let y = 0; y < this.gridY; y++) {
                let spanId = this.hf[x][y];
                while (spanId !== 0) {
                    if(OpenSpan.getUse(spanId))
                    {
                        if (OpenSpan.getRegionId(spanId) > 0) {
                            if (!regionSpans.has(OpenSpan.getRegionId(spanId))) regionSpans.set(OpenSpan.getRegionId(spanId), []);
                            regionSpans.get(OpenSpan.getRegionId(spanId))?.push(spanId);
                        }
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }
        //合并过小的region
        for (const [id, spans] of regionSpans) {
            if (spans.length >= REGION_MERGE_AREA) continue;
            const neighbors = new Map();
            for (const spanId of spans) {
                for (let d = 0; d < 4; d++) {
                    const n = OpenSpan.getNeighbor(spanId, d);
                    if (n !== 0 && OpenSpan.getRegionId(n) !== id) {
                        neighbors.set(
                            OpenSpan.getRegionId(n),
                            (neighbors.get(OpenSpan.getRegionId(n)) ?? 0) + 1
                        );
                    }
                }
            }

            let best = 0;
            let bestCount = 0;
            for (const [nid, count] of neighbors) {
                if (count > bestCount) {
                    best = nid;
                    bestCount = count;
                }
            }

            if (best > 0) {
                for (const spanId of spans) {
                    OpenSpan.setRegionId(spanId, best);
                    regionSpans.get(OpenSpan.getRegionId(spanId))?.push(spanId);
                }
                regionSpans.set(id, []);
            }
        }
        //统计每个region包含的span
        regionSpans.clear();
        for (let x = 0; x < this.gridX; x++) {
            for (let y = 0; y < this.gridY; y++) {
                let spanId = this.hf[x][y];
                while (spanId !== 0) {
                    if(OpenSpan.getUse(spanId))
                    {
                        if (OpenSpan.getRegionId(spanId) > 0) {
                            if (!regionSpans.has(OpenSpan.getRegionId(spanId))) regionSpans.set(OpenSpan.getRegionId(spanId), []);
                            regionSpans.get(OpenSpan.getRegionId(spanId))?.push(spanId);
                        }
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }
        //忽略过小的region
        for (const [id, spans] of regionSpans) {
            if (spans.length >= REGION_MIN_AREA) continue;
            for (const spanId of spans) {
                if (OpenSpan.getRegionId(spanId) == id) OpenSpan.setRegionId(spanId, 0);
            }
        }
    }
    /**
     * Debug: 绘制 Region（按 regionId 上色）
     * @param {number} duration
     */
    debugDrawRegions(duration = 5) {
        const colorCache = new Map();

        const randomColor = (/** @type {number} */ id) => {
            if (!colorCache.has(id)) {
                colorCache.set(id, {
                    r: (id * 97) % 255,
                    g: (id * 57) % 255,
                    b: (id * 17) % 255
                });
            }
            return colorCache.get(id);
        };

        for (let x = 0; x < this.gridX; x++) {
            for (let y = 0; y < this.gridY; y++) {
                let spanId = this.hf[x][y];
                while (spanId !== 0) {
                    if(OpenSpan.getUse(spanId))
                    {
                        if (OpenSpan.getRegionId(spanId) > 0) {
                            const c = randomColor(OpenSpan.getRegionId(spanId));

                            const center = {
                                x: origin.x + (this.baseX + x + 0.5) * MESH_CELL_SIZE_XY,
                                y: origin.y + (this.baseY + y + 0.5) * MESH_CELL_SIZE_XY,
                                z: origin.z + OpenSpan.getFloor(spanId) * MESH_CELL_SIZE_Z
                            };

                            Instance.DebugSphere({
                                center,
                                radius: 3,
                                color: c,
                                duration
                            });
                        }
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }
    }
    /**
     * Debug: 绘制 Distance Field（亮度 = 距离）
     */
    debugDrawDistance(duration = 5) {
        let maxDist = 0;

        for (let x = 0; x < this.gridX; x++) {
            for (let y = 0; y < this.gridY; y++) {
                let spanId = this.hf[x][y];
                while (spanId !== 0) {
                    if(OpenSpan.getUse(spanId))
                    {
                        maxDist = Math.max(maxDist, OpenSpan.getDistance(spanId));
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }

        for (let x = 0; x < this.gridX; x++) {
            for (let y = 0; y < this.gridY; y++) {
                let spanId = this.hf[x][y];
                while (spanId !== 0) {
                    if(OpenSpan.getUse(spanId))
                    {
                        if (OpenSpan.getDistance(spanId) < Infinity) {
                            const t = OpenSpan.getDistance(spanId) / maxDist;
                            const c = {
                                r: Math.floor(255 * t),
                                g: Math.floor(255 * (1 - t)),
                                b: 0
                            };

                            Instance.DebugSphere({
                                center: {
                                    x: origin.x + (this.baseX + x) * MESH_CELL_SIZE_XY,
                                    y: origin.y + (this.baseY + y) * MESH_CELL_SIZE_XY,
                                    z: origin.z + OpenSpan.getFloor(spanId) * MESH_CELL_SIZE_Z
                                },
                                radius: 3,
                                color: c,
                                duration
                            });
                        }
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }
    }

}

/**
 * @module 导航网格/轮廓构建
 */

/**
 * 轮廓构建器。
 *
 * 将 OpenHeightfield 的可行走 Span 转换为多边形轮廓，
 * 为 PolyMeshBuilder 提供输入。
 * 流程：构建紧凑邻居 → 追踪轮廓 → 简化 → 拆分长边。
 *
 * @navigationTitle 轮廓构建器
 */
class ContourBuilder {
    /**
     * 初始化轮廓构建器，绑定开放高度场数据。
     * @param {OpenHeightfield} hf
     */
    constructor(hf) {
        /** @type {boolean} 构建过程中是否发生错误 */
        this.error = false;
        /** @type {number[][]} 开放高度场单元格数组（Span 链表头） */
        this.hf = hf.cells;
        /** @type {number} X 方向网格数 */
        this.gridX = hf.gridX;
        /** @type {number} Y 方向网格数 */
        this.gridY = hf.gridY;
        /** @type {number} X 基址偏移 */
        this.baseX = hf.baseX;
        /** @type {number} Y 基址偏移 */
        this.baseY = hf.baseY;
        /** @type {number} Tile 核心区 X 最小值 */
        this.tileCoreMinX = hf.tileCoreMinX;
        /** @type {number} Tile 核心区 X 最大值 */
        this.tileCoreMaxX = hf.tileCoreMaxX;
        /** @type {number} Tile 核心区 Y 最小值 */
        this.tileCoreMinY = hf.tileCoreMinY;
        /** @type {number} Tile 核心区 Y 最大值 */
        this.tileCoreMaxY = hf.tileCoreMaxY;

        /** @type {Contour[][]} 按区域 ID 分组的轮廓数组（外轮廓 + 内孔） */
        this.contours = [];
    }

    /**
     * 为所有可行走 Span 建立紧凑四方向邻居索引。
     *
     * 遍历每个 cell 列的每个可用 Span，在四个方向上找到高度差最小且可通行的
     * 相邻 Span，将结果写入 OpenSpan 的邻居槽位，供后续轮廓追踪直接查询。
     */
    buildCompactNeighbors() {
        const dirs = [
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: -1 }
        ];

        for (let x = 0; x < this.gridX; x++) {
            for (let y = 0; y < this.gridY; y++) {
                let spanId = this.hf[x][y];
                while (spanId !== 0) {
                    if (OpenSpan.getUse(spanId)) {
                        for (let d = 0; d < 4; d++) {
                            const nx = x + dirs[d].dx;
                            const ny = y + dirs[d].dy;
                            if (nx < 0 || ny < 0 || nx >= this.gridX || ny >= this.gridY) {
                                OpenSpan.setNeighbor(spanId, d, 0);
                                continue;
                            }

                            let best = 0;
                            let bestDiff = Infinity;
                            let nspanId = this.hf[nx][ny];
                            while (nspanId !== 0) {
                                if (OpenSpan.getUse(nspanId) && OpenSpan.canTraverseTo(spanId, nspanId)) {
                                    const diff = Math.abs(OpenSpan.getFloor(spanId) - OpenSpan.getFloor(nspanId));
                                    if (diff < bestDiff) {
                                        best = nspanId;
                                        bestDiff = diff;
                                    }
                                }
                                nspanId = OpenSpan.getNext(nspanId);
                            }
                            OpenSpan.setNeighbor(spanId, d, best);
                        }
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }
    }

    /**
     * 判断指定 Span 在某方向上是否为区域边界边。
     *
     * 无邻居或邻居所属 Region 不同时视为边界，轮廓追踪会在这些边上输出顶点。
     * @param {number} spanId - 当前 Span ID
     * @param {number} dir - 方向索引（0-3 对应 -X/+Y/+X/-Y）
     * @returns {boolean} 是否为边界边
     */
    isBoundaryEdge(spanId, dir) {
        const n = OpenSpan.getNeighbor(spanId, dir);
        if (n === 0) return true;
        return OpenSpan.getRegionId(n) !== OpenSpan.getRegionId(spanId);
    }
    /**
     * 获取指定方向邻居 Span 所属的 Region ID。
     *
     * 若该方向无邻居则返回 0，用于轮廓追踪时记录每条边对面的区域标识。
     * @param {number} spanId - 当前 Span ID
     * @param {number} dir - 方向索引
     * @returns {number} 邻居的 Region ID，无邻居时为 0
     */
    getNeighborregionid(spanId, dir) {
        const n = OpenSpan.getNeighbor(spanId, dir);
        if (n !== 0) return OpenSpan.getRegionId(n);
        else return 0;
    }
    /**
     * 生成边的唯一字符串键，用于 visited 集合去重。
     * @param {number} x - cell X 坐标
     * @param {number} y - cell Y 坐标
     * @param {number} spanId - Span ID
     * @param {number} dir - 边方向
     * @returns {string} 格式为 "x,y,spanId,dir" 的唯一键
     */
    edgeKey(x, y, spanId, dir) {
        return `${x},${y},${spanId},${dir}`;
    }

    /**
     * 沿指定方向移动一格，返回新的 cell 坐标。
     * @param {number} x - 当前 cell X
     * @param {number} y - 当前 cell Y
     * @param {number} dir - 方向索引（0=-X, 1=+Y, 2=+X, 3=-Y）
     * @returns {{x: number, y: number}} 移动后的坐标
     */
    move(x, y, dir) {
        switch (dir) {
            case 0: return { x: x - 1, y };
            case 1: return { x, y: y + 1 };
            case 2: return { x: x + 1, y };
            case 3: return { x, y: y - 1 };
        }
        return { x, y };
    }

    /**
     * 获取 cell 在指定方向上的角点坐标。
     *
     * 轮廓追踪在边界边上输出顶点时，使用此方法确定该边的角点位置。
     * @param {number} x - cell X
     * @param {number} y - cell Y
     * @param {number} dir - 方向索引
     * @returns {{x: number, y: number}} 角点坐标
     */
    corner(x, y, dir) {
        switch (dir) {
            case 0: return { x, y };
            case 1: return { x, y: y + 1 };
            case 2: return { x: x + 1, y: y + 1 };
            case 3: return { x: x + 1, y };
        }
        return { x, y };
    }

    /**
     * 执行完整的轮廓构建流程。
     *
     * 1. 调用 {@link buildCompactNeighbors} 建立 Span 邻居索引
     * 2. 遍历所有可行走 Span 的四个方向，在边界边上调用 {@link traceContour} 追踪轮廓
     * 3. 对追踪结果依次执行简化（{@link simplifyContour}）和长边分割（{@link splitLongEdges}）
     * 4. 过滤退化轮廓后存入 {@link contours}
     */
    init() {
        /** @type {Set<string>} */
        const visited = new Set();
        this.buildCompactNeighbors();

        for (let x = 0; x < this.gridX; x++) {
            for (let y = 0; y < this.gridY; y++) {
                let spanId = this.hf[x][y];
                while (spanId !== 0) {
                    if(OpenSpan.getUse(spanId))
                    {
                        if (OpenSpan.getRegionId(spanId) > 0) {
                            for (let dir = 0; dir < 4; dir++) {
                                if (this.isBoundaryEdge(spanId, dir)) {

                                    const key = this.edgeKey(x, y, spanId, dir);
                                    if (visited.has(key)) continue;

                                    let contour = this.traceContour(x, y, spanId, dir, visited);
                                    if (contour && contour.length >= 3) {
                                        //外轮廓：逆时针（CCW）
                                        //洞轮廓：顺时针（CW）
                                        contour = this.splitLongEdges(this.simplifyContour(contour));
                                        if (!contour || contour.length < 2) continue;

                                        if (!this.isDegenerateContour(contour) && contour.length >= 3) {
                                            this.contours.push(contour);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }
    }
    /**
     * 简化轮廓：保留关键拐点，移除冗余的中间顶点。
     *
     * - 锁定所有「邻居区域切换点」和「tile 边界非共线点」
     * - 对非 Portal 段使用 Douglas-Peucker 风格的最大误差递归简化
     * - Portal 段（邻居 regionId > 0）只保留端点，保持跨 Tile 对齐
     * @param {Contour[]} contour - 原始轮廓点数组
     * @returns {Contour[]} 简化后的轮廓
     */
    simplifyContour(contour) {
        const n = contour.length;
        if (n < 4) return contour.slice();
        const pts = contour.slice();

        const locked = new Array(n).fill(0);
        let lockCount = 0;
        for (let i = 0; i < n; i++) {
            const cur = pts[i];
            const next = pts[(i + 1) % n];
            const prev = pts[(i - 1 + n) % n];
            const isPortalChange = next.neighborRegionId !== cur.neighborRegionId;
            const keepBorderPoint = this.isPointOnTileBorder(cur) && !this.isBorderCollinearPoint(prev, cur, next);

            if (isPortalChange || keepBorderPoint) {
                locked[i] = 1;
                //Instance.DebugSphere({center: vec.Zfly(this.contourPointToWorld(cur),20*Math.random()), radius: 2, color:{r: 255, g: next.neighborRegionId!=0?255:0, b: 0},duration: 30});
                lockCount++;
            }
        }

        if (lockCount === 0) {
            let minId = 0;
            let maxId = 0;
            for (let i = 1; i < n; i++) {
                const p = pts[i];
                if (p.x < pts[minId].x || (p.x === pts[minId].x && p.y < pts[minId].y)) minId = i;
                if (p.x > pts[maxId].x || (p.x === pts[maxId].x && p.y > pts[maxId].y)) maxId = i;
            }
            locked[minId] = 1;
            locked[maxId] = 1;
        }

        /** @type {Contour[]} */
        const out = [];

        let i = 0;
        let firstLocked = -1;
        let lastLocked = -1;
        while (i < n - 1) {
            if (locked[i] === 0) {
                i++;
                continue;
            }

            if (firstLocked === -1) firstLocked = i;
            let j = i + 1;
            while (j < n - 1 && locked[j] === 0) j++;
            if (locked[j]) lastLocked = j;

            if (locked[i] && locked[j]) {
                // 锁点就是切换点：只看锁点后的第一条边类型
                const portalRegionId = pts[(i + 1) % n]?.neighborRegionId ?? 0;
                if (portalRegionId > 0) {
                    out.push(pts[i]);
                } else {
                    this.simplifySegmentByMaxError(pts, i, j, out);
                }
            }
            i = j;
        }

        // wrap 段同样只看锁点后的第一条边类型
        const wrapPortalRegionId = pts[(lastLocked + 1) % n]?.neighborRegionId ?? 0;
        if (wrapPortalRegionId > 0) {
            out.push(pts[lastLocked]);
        } else {
            this.simplifySegmentByMaxErrorWrap(pts, lastLocked, firstLocked, out);
        }

        if (out.length >= 3) {
            const indexByPoint = new Map();
            for (let k = 0; k < n; k++) {
                indexByPoint.set(pts[k], k);
            }

            /** @type {number[]} */
            const outIndices = [];
            for (const p of out) {
                const idx = indexByPoint.get(p);
                if (idx !== undefined) outIndices.push(idx);
            }
            return outIndices.map((idx) => pts[idx]);
        }

        return out;
    }
    /**
     * 对非 Portal 线段进行递归最大误差简化（Douglas-Peucker 风格）。
     *
     * 在 [i0, i1] 区间找到离线段最远的点，若距离超过 maxError 则递归分割，
     * 否则只保留起点 i0。
     * @param {Contour[]} pts - 完整轮廓点序列
     * @param {number} i0 - 起始索引（锁定点）
     * @param {number} i1 - 结束索引（锁定点）
     * @param {Contour[]} out - 输出数组，保留点会 push 进去
     */
    simplifySegmentByMaxError(pts, i0, i1, out) {
        const a = pts[i0];
        const b = pts[i1];
        let maxDistSq = 0;
        let index = -1;

        for (let i = i0 + 1; i < i1; i++) {
            const d = distPtSegSq(pts[i], a, b);
            if (d > maxDistSq) {
                maxDistSq = d;
                index = i;
            }
        }

        const maxErrorSq = this.getContourMaxErrorSq();
        if (index !== -1 && maxDistSq > maxErrorSq) {
            this.simplifySegmentByMaxError(pts, i0, index, out);
            this.simplifySegmentByMaxError(pts, index, i1, out);
        } else {
            out.push(a);
        }
    }

    /**
     * 跨数组末尾回绕版本的最大误差简化。
     *
     * 处理从最后一个锁定点回绕到第一个锁定点的环形段，
     * 索引从 i0 往后走到末尾再从 0 开始到 i1。
     * @param {Contour[]} pts - 完整轮廓点序列
     * @param {number} i0 - 起始索引（尾部锁定点）
     * @param {number} i1 - 结束索引（头部锁定点）
     * @param {Contour[]} out - 输出数组
     */
    simplifySegmentByMaxErrorWrap(pts, i0, i1, out) {
        if (i0 < 0 || i1 < 0) return;

        const n = pts.length;
        const a = pts[i0];
        const b = pts[i1];
        let maxDistSq = 0;
        let index = -1;

        for (let i = i0 + 1; i < n; i++) {
            const d = distPtSegSq(pts[i], a, b);
            if (d > maxDistSq) {
                maxDistSq = d;
                index = i;
            }
        }
        for (let i = 0; i < i1; i++) {
            const d = distPtSegSq(pts[i], a, b);
            if (d > maxDistSq) {
                maxDistSq = d;
                index = i;
            }
        }

        const maxErrorSq = this.getContourMaxErrorSq();
        if (index !== -1 && maxDistSq > maxErrorSq) {
            if (index < i0) this.simplifySegmentByMaxErrorWrap(pts, i0, index, out);
            else this.simplifySegmentByMaxError(pts, i0, index, out);

            if (index < i1) this.simplifySegmentByMaxError(pts, index, i1, out);
            else this.simplifySegmentByMaxErrorWrap(pts, index, i1, out);
        } else {
            out.push(a);
        }
    }

    /**
     * 线段是否位于当前 tile 的边界上。
     * @param {Contour} a
     * @param {Contour} b
     */
    isSegmentOnTileBorder(a, b) {
        if (this.isPointOnTileBorder(a) || this.isPointOnTileBorder(b)) return true;

        const minX = this.tileCoreMinX;
        const maxX = this.tileCoreMaxX;
        const minY = this.tileCoreMinY;
        const maxY = this.tileCoreMaxY;

        if (a.x === minX && b.x === minX) return true;
        if (a.x === maxX && b.x === maxX) return true;
        if (a.y === minY && b.y === minY) return true;
        if (a.y === maxY && b.y === maxY) return true;

        return false;
    }

    /**
     * 点是否落在当前 tile 的外边界上。
     * @param {Contour} p
     */
    isPointOnTileBorder(p) {
        const minX = this.tileCoreMinX;
        const maxX = this.tileCoreMaxX;
        const minY = this.tileCoreMinY;
        const maxY = this.tileCoreMaxY;

        if (p.x === minX || p.x === maxX) return true;
        if (p.y === minY || p.y === maxY) return true;

        return false;
    }

    /**
     * tile 边界上的“纯共线中间点”判定。
     * 仅当 prev-cur-next 同在同一条 tile 外边界线上时返回 true。
     * @param {Contour} prev
     * @param {Contour} cur
     * @param {Contour} next
     */
    isBorderCollinearPoint(prev, cur, next) {
        const minX = this.tileCoreMinX;
        const maxX = this.tileCoreMaxX;
        const minY = this.tileCoreMinY;
        const maxY = this.tileCoreMaxY;

        if (prev.x === minX && cur.x === minX && next.x === minX) return true;
        if (prev.x === maxX && cur.x === maxX && next.x === maxX) return true;
        if (prev.y === minY && cur.y === minY && next.y === minY) return true;
        if (prev.y === maxY && cur.y === maxY && next.y === maxY) return true;

        return false;
    }

    /**
     * 拆分轮廓中超过最大边长的线段。
     *
     * 反复在中点插入新顶点，直到所有边长均不超过 {@link getContourMaxEdgeLen} 的阈值。
     * 这一步确保多边形不会出现过长的边，有利于后续三角化质量。
     * @param {Contour[]} counter - 简化后的轮廓点序列
     * @returns {Contour[]} 拆分长边后的轮廓
     */
    splitLongEdges(counter) {
        const maxEdgeLen = this.getContourMaxEdgeLen();
        if (maxEdgeLen <= 0) return counter;

        let guard = 0;
        while (guard++ < counter.length * 8) {
            let inserted = false;
            for (let i = 0; i < counter.length; i++) {
                const i0 = counter[i];
                const i1 = counter[(i + 1) % counter.length];
                const dx = Math.abs(i1.x - i0.x);
                const dy = Math.abs(i1.y - i0.y);
                if (Math.max(dx, dy) <= maxEdgeLen) continue;
                //这里在counter插入新点，值为两端点的中点
                const newPoint = {
                    x: (i0.x + i1.x) * 0.5,
                    y: (i0.y + i1.y) * 0.5,
                    z: (i0.z + i1.z) * 0.5,
                    regionId: i0.regionId,
                    neighborRegionId: i0.neighborRegionId
                };

                // 如果你的 counter/contour 存的是点对象：
                counter.splice(i + 1, 0, newPoint);
                inserted = true;
                break;
            }
            if (!inserted) break;
        }
        return counter;
    }
    /**
     * 统计轮廓中不重复的 (x, y) 坐标个数。
     * @param {Contour[]} contour - 轮廓点序列
     * @returns {number} 唯一坐标数
     */
    countUniqueXY(contour) {
        const set = new Set();
        for (const p of contour) set.add(`${p.x}|${p.y}`);
        return set.size;
    }

    /**
     * 判断轮廓是否退化（点数不足或面积过小）。
     *
     * 退化轮廓会在 init 中被过滤不加入最终结果。
     * @param {Contour[]} contour - 轮廓点序列
     * @returns {boolean} 是否退化
     */
    isDegenerateContour(contour) {
        if (!contour || contour.length < 3) return true;
        if (this.countUniqueXY(contour) < 3) return true;
        return Math.abs(this.computeSignedArea2D(contour)) <= 1e-6;
    }

    /**
     * 计算轮廓的 2D 有符号面积（Shoelace 公式）。
     *
     * 正值表示逆时针（外轮廓），负值表示顺时针（孔洞）。
     * @param {Contour[]} contour - 轮廓点序列
     * @returns {number} 有符号面积
     */
    computeSignedArea2D(contour) {
        let area = 0;
        const n = contour.length;
        for (let i = 0; i < n; i++) {
            const a = contour[i];
            const b = contour[(i + 1) % n];
            area += a.x * b.y - b.x * a.y;
        }
        return area * 0.5;
    }

    /**
     * 从起始边界边开始，沿区域边界追踪一圈完整轮廓。
     *
     * 采用「右转 → 直行 → 左转 → 后转」优先级顺序行走，确保紧贴区域边界。
     * 每条边界边记录角点坐标、高度、所属 Region ID 和对面邻居 Region ID。
     * @param {number} sx - 起始 cell X
     * @param {number} sy - 起始 cell Y
     * @param {number} startSpanId - 起始 Span ID
     * @param {number} startDir - 起始边方向
     * @param {Set<string>} visited - 已访问边集合，用于去重
     * @returns {Contour[] | null} 轮廓点数组，失败时返回 null
     */
    traceContour(sx, sy, startSpanId, startDir, visited) {
        let x = sx;
        let y = sy;
        let spanId = startSpanId;
        let dir = startDir;

        const verts = [];

        let iter = 0;
        const MAX_ITER = this.gridX * this.gridY * 4;
        if (!this.isBoundaryEdge(startSpanId, startDir)) return null;
        const startKey = this.edgeKey(x, y, spanId, dir);
        while (iter++ < MAX_ITER) {
            const key = this.edgeKey(x, y, spanId, dir);
            //回到起点
            if (key === startKey && verts.length > 0) break;

            if (visited.has(key)) {
                Instance.Msg("奇怪的轮廓边,找了一遍现在又找一遍");
                this.error=true;
                return null;
            }
            visited.add(key);

            // 只有在边界边才输出顶点
            if (this.isBoundaryEdge(spanId, dir)) {
                const c = this.corner(x, y, dir);

                const h = this.getCornerHeightFromEdge(x, y, spanId, dir);
                const nid = this.getNeighborregionid(spanId, dir);
                //Instance.Msg(nid);
                if (h !== null) {
                    verts.push({
                        x: this.baseX + c.x,
                        y: this.baseY + c.y,
                        z: h,
                        regionId: OpenSpan.getRegionId(spanId),      //当前span的region
                        neighborRegionId: nid   //对面span的region（或 0）
                    });
                }

            }

            // 顺序：右转 → 直行 → 左转 → 后转
            let advanced = false;
            for (let i = 0; i < 4; i++) {
                const ndir = (dir + 3 - i + 4) % 4;
                const nspanId = OpenSpan.getNeighbor(spanId, ndir);

                // 这条边是boundary，就沿边走
                if (nspanId === 0 || OpenSpan.getRegionId(nspanId) !== OpenSpan.getRegionId(spanId)) {
                    dir = ndir;
                    advanced = true;
                    break;
                }

                // 否则穿过这条边
                const p = this.move(x, y, ndir);
                x = p.x;
                y = p.y;
                spanId = nspanId;
                dir = (ndir + 2) % 4;
                advanced = true;
                break;
            }

            if (!advanced) {
                Instance.Msg("轮廓断啦");
                this.error=true;
                return null;
            }
        }
        if (verts.length < 3) {
            this.error=true;
            return null;
        }
        return verts;
    }

    /**
     * 获取指定边角点的最大地板高度。
     *
     * 考察当前 Span 及其左、前、对角方向的邻居，取四者中的最大 floor 高度。
     * 确保轮廓顶点高度反映角点处真实的最高可行走层。
     * @param {number} x - cell X
     * @param {number} y - cell Y
     * @param {number} spanId - 当前 Span ID
     * @param {number} dir - 边方向
     * @returns {number} 角点处的最大地板高度
     */
    getCornerHeightFromEdge(x, y, spanId, dir) {
        let maxFloor = OpenSpan.getFloor(spanId);
        const leftDir = (dir + 3) & 3;
        // 只使用 buildCompactNeighbors 建好的 walkable 邻接，
        // 避免在相邻 cell 的整列 span 中误取到“非当前可走链路”的高度层。
        const left = OpenSpan.getNeighbor(spanId, leftDir);
        if (left !== 0) {
            const h = OpenSpan.getFloor(left);
            if (h > maxFloor) maxFloor = h;
        }

        const front = OpenSpan.getNeighbor(spanId, dir);
        if (front !== 0) {
            const h = OpenSpan.getFloor(front);
            if (h > maxFloor) maxFloor = h;
        }

        // 对角采用“先左再前”与“先前再左”两条可走链路择优。
        let diag = 0;
        if (left !== 0) diag = OpenSpan.getNeighbor(left, dir);
        if (diag === 0 && front !== 0) diag = OpenSpan.getNeighbor(front, leftDir);
        if (diag !== 0) {
            const h = OpenSpan.getFloor(diag);
            if (h > maxFloor) maxFloor = h;
        }

        return maxFloor;
    }
    /**
     * 判断 cell 坐标是否在网格范围内。
     * @param {number} x - cell X
     * @param {number} y - cell Y
     * @returns {boolean}
     */
    inBounds(x, y) {
        return x >= 0 && y >= 0 && x < this.gridX && y < this.gridY;
    }

    /**
     * 获取轮廓简化的最大误差平方值。
     * @returns {number}
     */
    getContourMaxErrorSq() {
        const e = CONT_MAX_ERROR;
        return e * e;
    }

    /**
     * 获取轮廓边允许的最大长度，用于 {@link splitLongEdges}。
     * @returns {number} 最大边长，若配置值 ≤ 0 则不分割
     */
    getContourMaxEdgeLen() {
        return 0;
    }

    /**
     * 将轮廓点从网格坐标转换为世界坐标，用于调试绘制。
     * @param {Contour} v - 轮廓点
     * @returns {{x: number, y: number, z: number}} 世界坐标
     */
    contourPointToWorld(v) {
        return {
            x: origin.x + v.x * MESH_CELL_SIZE_XY ,//- MESH_CELL_SIZE_XY / 2,
            y: origin.y + v.y * MESH_CELL_SIZE_XY ,//- MESH_CELL_SIZE_XY / 2,
            z: origin.z + v.z * MESH_CELL_SIZE_Z,
        };
    }

    /**
     * 调试绘制所有轮廓，每个轮廓用随机颜色的线段显示。
     * @param {number} [duration=5] - 绘制持续时间（秒）
     */
    debugDrawContours(duration = 5) {
        Instance.Msg(`一共${this.contours.length}个轮廓`);
        for (const contour of this.contours) {
            const color = { r: 255 * Math.random(), g: 255 * Math.random(), b: 255 * Math.random() };
            const z = Math.random() * 20;
            for (let i = 0; i < contour.length; i++) {
                const a = this.contourPointToWorld(contour[i]);
                const b = this.contourPointToWorld(contour[(i + 1) % contour.length]);
                const start = {
                    x: a.x,
                    y: a.y,
                    z: a.z + z
                };
                const end = {
                    x: b.x,
                    y: b.y,
                    z: b.z + z
                };
                Instance.DebugLine({
                    start,
                    end,
                    color,
                    duration
                });
            }
        }
    }
}
/**
 * @typedef {Object} Contour
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * x,y 为离散格点坐标；z 为离散高度层
 * @property {number} regionId
 * @property {number} neighborRegionId
 */

/**
 * @module 导航网格/多边形网格构建
 */
/** @typedef {import("cs_script/point_script").Vector} Vector */
/** @typedef {import("./path_contourbuilder").Contour} Contour */
/**
 * 多边形网格构建器。
 *
 * 将轮廓三角剖分后合并为凸多边形，建立邻接关系。
 * 流程：分组轮廓 → 三角化 → 合并三角形 → 邻接图。
 *
 * @navigationTitle 多边形网格构建器
 */
class PolyMeshBuilder {
    /**
     * 初始化多边形网格构建器，传入按 Tile 分组的轮廓数据。
     * @param {Contour[][]} contours
     */
    constructor(contours) {
        /** @type {boolean} */
        this.error = false;
        /** @type {Contour[][]} */
        this.contours = contours;

        /** @type {Float32Array} 顶点坐标数组，顺序为[x0,y0,z0,x1,y1,z1,...] */
        this.verts = new Float32Array(MAX_VERTS * 3); // 0:顶点0的x，1:顶点0的y，2:顶点0的z，3:顶点1的x，4:顶点1的y，5:顶点1的z，以此类推
        /** @type {number} 当前已用顶点数 */
        this.vertslength = 0;
        /** @type {Int32Array} 多边形顶点索引区间数组，顺序为[start0,end0,start1,end1,...] */
        this.polys = new Int32Array(MAX_POLYS * 2); // 0:多边形0的第一个顶点索引，1:多边形0的终点索引，2:多边形1的第一个顶点索引，3:多边形1的终点索引，以此类推
        /** @type {number} 当前已用多边形数 */
        this.polyslength = 0;
        /** @type {Int16Array} 多边形所属区域id数组 */
        this.regions = new Int16Array(MAX_POLYS);
        //最多32767个多边形，每个最多POLY_MAX_VERTS_PER_POLY条边，每个边几个邻居？100?
        /**
         * @type {Array<Array<Int16Array>>}
         * 多边形邻接信息：
         *  - neighbors[polyIdx][edgeIdx][0] 表示该边有几个邻居
         *  - neighbors[polyIdx][edgeIdx][1...N] 存储邻居多边形的索引
         * 结构：
         *   - 外层数组长度为最大多边形数
         *   - 每个多边形有 POLY_MAX_VERTS_PER_POLY 条边
         *   - 每条边可有多个邻居（最大100）
         */
        this.neighbors = new Array(MAX_POLYS); // [][][0] 0号位表示有几个邻居
        this.worldConverted = false;
    }

    /**
     * 执行完整的多边形网格构建流程。
     *
     * 1. 按 regionId 分组轮廓
     * 2. 处理孔洞并合并为简单多边形
     * 3. 耳裁切三角化
     * 4. 合并三角形为凸多边形
     * 5. 添加到全局数组并建立邻接关系
     */
    init() {
        this.error = false;
        /** @type {{x:number,y:number,z:number,regionId:number}[][]} */
        const allPolys = [];

        const grouped = this.groupContoursByRegion(this.contours);
        for (const regionContours of grouped.values()) {
            const simpleContours = this.buildSimpleRegionContours(regionContours);
            for (const contour of simpleContours) {
                const tris = this.triangulate(contour);
                if (tris.length === 0) continue;

                const merged = this.mergeTriangles(tris, POLY_MERGE_LONGEST_EDGE_FIRST);
                for (const poly of merged) allPolys.push(poly);
            }
        }

        for (const p of allPolys) this.addPolygon(p);
        this.buildAdjacency();
        this.convertVertsToWorldAfterAdjacency();
    }

    /**
     * 返回构建结果（顶点 + 多边形 + 区域 + 邻接）。
     * @returns {import("./path_manager").NavMeshMesh}
     */
    return() {
        return {
            verts: this.verts,
            vertslength:this.vertslength,
            polys: this.polys,
            polyslength:this.polyslength,
            regions: this.regions,
            neighbors: this.neighbors
        };
    }

    /**
     * 将轮廓按 regionId 分组。
     * @param {Contour[][]} contours - 所有轮廓
     * @returns {Map<number, Contour[][]>} 按 regionId 分组的轮廓集合
     */
    groupContoursByRegion(contours) {
        /** @type {Map<number, Contour[][]>} */
        const byRegion = new Map();
        for (const contour of contours) {
            if (!contour || contour.length < 3 || this.isDegenerateContour(contour)) continue;
            const rid = contour[0].regionId;
            if (!byRegion.has(rid)) byRegion.set(rid, []);
            byRegion.get(rid)?.push(contour);
        }
        return byRegion;
    }

    /**
     * Recast 风格：处理同一 Region 内的外轮廓与孔洞。
     *
     * 按面积排序后用奇偶性判断外轮廓/孔洞，将孔洞通过桥接边合并到外轮廓，
     * 产生可直接三角化的简单多边形。
     * @param {Contour[][]} regionContours - 同一 region 的所有轮廓
     * @returns {Contour[][]} 合并后的简单多边形数组
     */
    buildSimpleRegionContours(regionContours) {
        /** @type {Contour[][]} */
        const candidates = [];
        for (const contour of regionContours) {
            if (this.isDegenerateContour(contour)) continue;
            const sanitized = this.sanitizeContour(contour);
            if (sanitized.length >= 3 && !this.isDegenerateContour(sanitized)) {
                candidates.push(sanitized);
            }
        }
        if (candidates.length === 0) return [];

        candidates.sort((a, b) => Math.abs(this.computeSignedArea(b)) - Math.abs(this.computeSignedArea(a)));

        /** @type {Contour[][]} */
        const outers = [];
        /** @type {Contour[][][]} */
        const holeGroups = [];

        for (let i = 0; i < candidates.length; i++) {
            const contour = candidates[i].slice();
            const point = contour[0];

            let depth = 0;
            for (let j = 0; j < i; j++) {
                if (this.pointInPolygon2D(point, candidates[j])) depth++;
            }

            const isHole = (depth & 1) === 1;
            if (!isHole) {
                this.ensureWinding(contour, true);
                outers.push(contour);
                holeGroups.push([]);
                continue;
            }

            let bestOuter = -1;
            let bestArea = Infinity;
            for (let k = 0; k < outers.length; k++) {
                if (!this.pointInPolygon2D(point, outers[k])) continue;
                const a = Math.abs(this.computeSignedArea(outers[k]));
                if (a < bestArea) {
                    bestArea = a;
                    bestOuter = k;
                }
            }

            if (bestOuter >= 0) {
                this.ensureWinding(contour, false);
                holeGroups[bestOuter].push(contour);
            }
        }

        /** @type {Contour[][]} */
        const result = [];
        for (let i = 0; i < outers.length; i++) {
            let merged = outers[i].slice();
            const holes = holeGroups[i].slice();
            holes.sort((a, b) => this.getLeftMostPoint(a).x - this.getLeftMostPoint(b).x);

            for (let h = 0; h < holes.length; h++) {
                merged = this.mergeHoleIntoOuter(merged, holes, h);
                merged = this.sanitizeContour(merged);
                if (merged.length < 3) break;
            }

            if (merged.length >= 3 && !this.isDegenerateContour(merged)) {
                this.ensureWinding(merged, true);
                result.push(merged);
            }
        }

        return result;
    }

    /**
     * 清理轮廓：移除重复点并剥离共线中间点。
     * @param {Contour[]} contour - 原始轮廓
     * @returns {Contour[]} 清理后的轮廓
     */
    sanitizeContour(contour) {
        /** @type {Contour[]} */
        const out = [];
        for (let i = 0; i < contour.length; i++) {
            const cur = contour[i];
            const prev = out[out.length - 1];
            if (prev && prev.x === cur.x && prev.y === cur.y) continue;
            out.push(cur);
        }

        if (out.length >= 2) {
            const a = out[0];
            const b = out[out.length - 1];
            if (a.x === b.x && a.y === b.y) out.pop();
        }

        let i = 0;
        while (out.length >= 3 && i < out.length) {
            const n = out.length;
            const a = out[(i + n - 1) % n];
            const b = out[i];
            const c = out[(i + 1) % n];
            if (Math.abs(area(a, b, c)) <= 1e-9) {
                out.splice(i, 1);
                continue;
            }
            i++;
        }

        return out;
    }

    /**
     * 确保轮廓的绕行方向。
     * @param {Contour[]} contour - 轮廓点序列
     * @param {boolean} ccw - true 表示逆时针（外轮廓），false 表示顺时针（孔洞）
     */
    ensureWinding(contour, ccw) {
        const area2 = this.computeSignedArea(contour);
        if (ccw && area2 < 0) contour.reverse();
        if (!ccw && area2 > 0) contour.reverse();
    }

    /**
     * 判断轮廓是否退化（点数不足、唯一坐标不足或面积过小）。
     * @param {Contour[]} contour
     * @returns {boolean}
     */
    isDegenerateContour(contour) {
        if (!contour || contour.length < 3) return true;
        const unique = new Set();
        for (const p of contour) unique.add(`${p.x}|${p.y}`);
        if (unique.size < 3) return true;
        return Math.abs(this.computeSignedArea(contour)) <= 1e-6;
    }

    /**
     * 计算轮廓的 2D 有符号面积（Contour 类型输入）。
     * @param {Contour[]} contour
     * @returns {number}
     */
    computeSignedArea(contour) {
        let sum = 0;
        for (let i = 0; i < contour.length; i++) {
            const a = contour[i];
            const b = contour[(i + 1) % contour.length];
            sum += a.x * b.y - b.x * a.y;
        }
        return sum * 0.5;
    }

    /**
     * 计算 2D 有符号面积（纯 {x,y} 输入）。
     * @param {{x:number,y:number}[]} contour
     * @returns {number}
     */
    computeSignedAreaXY(contour) {
        let sum = 0;
        for (let i = 0; i < contour.length; i++) {
            const a = contour[i];
            const b = contour[(i + 1) % contour.length];
            sum += a.x * b.y - b.x * a.y;
        }
        return sum * 0.5;
    }

    /**
     * 2D 射线法判断点是否在多边形内。
     * @param {Contour} pt - 待检测点
     * @param {Contour[]} polygon - 多边形顶点序列
     * @returns {boolean}
     */
    pointInPolygon2D(pt, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const pi = polygon[i];
            const pj = polygon[j];
            const intersects = ((pi.y > pt.y) !== (pj.y > pt.y))
                && (pt.x < (pj.x - pi.x) * (pt.y - pi.y) / ((pj.y - pi.y) || 1e-9) + pi.x);
            if (intersects) inside = !inside;
        }
        return inside;
    }

    /**
     * 获取轮廓中 X 最小的点，用于孔洞桥接排序。
     * @param {Contour[]} contour
     * @returns {Contour}
     */
    getLeftMostPoint(contour) {
        let p = contour[0];
        for (let i = 1; i < contour.length; i++) {
            const v = contour[i];
            if (v.x < p.x || (v.x === p.x && v.y < p.y)) p = v;
        }
        return p;
    }

    /**
     * 判断两条线段是否相交。
     * @param {Contour} p1 - 线段1起点
     * @param {Contour} p2 - 线段1终点
     * @param {Contour} p3 - 线段2起点
     * @param {Contour} p4 - 线段2终点
     * @param {boolean} includeEnd - 是否包含端点相交
     * @returns {boolean}
     */
    segmentsIntersect(p1, p2, p3, p4, includeEnd) {
        const cross = (
            /** @type {{x:number,y:number}} */ a,
            /** @type {{x:number,y:number}} */ b,
            /** @type {{x:number,y:number}} */ c
        ) => (c.y - a.y) * (b.x - a.x) - (b.y - a.y) * (c.x - a.x);

        const d1 = cross(p1, p2, p3);
        const d2 = cross(p1, p2, p4);
        const d3 = cross(p3, p4, p1);
        const d4 = cross(p3, p4, p2);
        if (includeEnd) return (d1 * d2 <= 0 && d3 * d4 <= 0);
        return (d1 * d2 < 0 && d3 * d4 < 0);
    }

    /**
     * 为孔洞点找到外轮廓上最近的桥接点索引。
     *
     * 遍历外轮廓顶点，排除与轮廓/孔洞相交的桥接线段，取距离最近的。
     * @param {Contour} holePt - 孔洞起始点
     * @param {Contour[]} outer - 外轮廓点序列
     * @param {Contour[][]} holes - 所有孔洞序列
     * @param {number} holeId - 当前孔洞索引
     * @returns {number} 外轮廓上的桥接点索引，未找到时返回 -1
     */
    findBridgeOuterIndex(holePt, outer, holes, holeId) {
        const hole = holes[holeId];
        let bestDistSq = Infinity;
        let bestIdx = -1;

        for (let i = 0; i < outer.length; i++) {
            const a = outer[i];
            const dx = holePt.x - a.x;
            const dy = holePt.y - a.y;
            const distSq = dx * dx + dy * dy;
            if (distSq >= bestDistSq) continue;

            let intersects = false;

            for (let j = 0; j < outer.length; j++) {
                const p1 = outer[j];
                const p2 = outer[(j + 1) % outer.length];
                if (j === i || (j + 1) % outer.length === i) continue;
                if (this.segmentsIntersect(holePt, a, p1, p2, true)) {
                    intersects = true;
                    break;
                }
            }
            if (intersects) continue;

            for (let j = 0; j < hole.length; j++) {
                const p1 = hole[j];
                const p2 = hole[(j + 1) % hole.length];
                if (p1 === holePt || p2 === holePt) continue;
                if (this.segmentsIntersect(holePt, a, p1, p2, true)) {
                    intersects = true;
                    break;
                }
            }
            if (intersects) continue;

            for (let k = holeId + 1; k < holes.length; k++) {
                const other = holes[k];
                for (let j = 0; j < other.length; j++) {
                    const p1 = other[j];
                    const p2 = other[(j + 1) % other.length];
                    if (this.segmentsIntersect(holePt, a, p1, p2, true)) {
                        intersects = true;
                        break;
                    }
                }
                if (intersects) break;
            }
            if (intersects) continue;

            bestDistSq = distSq;
            bestIdx = i;
        }

        return bestIdx;
    }

    /**
     * 将孔洞通过桥接边合并到外轮廓中。
     * @param {Contour[]} outer - 外轮廓
     * @param {Contour[][]} holes - 所有孔洞
     * @param {number} holeId - 当前孔洞索引
     * @returns {Contour[]} 合并后的多边形
     */
    mergeHoleIntoOuter(outer, holes, holeId) {
        const hole = holes[holeId];
        let oi = -1;
        let holePt = hole[0];
        let hi = 0;

        for (hi = 0; hi < hole.length; hi++) {
            holePt = hole[hi];
            oi = this.findBridgeOuterIndex(holePt, outer, holes, holeId);
            if (oi >= 0) break;
        }

        if (oi < 0) {
            Instance.Msg("未找到洞桥接点，跳过该洞");
            this.error=true;
            return outer;
        }

        /** @type {Contour[]} */
        const merged = [];

        for (let i = 0; i <= oi; i++) merged.push(outer[i]);
        merged.push(holePt);
        for (let i = 1; i <= hole.length; i++) merged.push(hole[(hi + i) % hole.length]);
        merged.push(outer[oi]);
        for (let i = oi + 1; i < outer.length; i++) merged.push(outer[i]);

        return merged;
    }

    /**
     * 耳裁切三角化：将简单多边形切分为三角形序列。
     *
     * 优先切割“周长最小”的耳朵（当 POLY_BIG_TRI 启用时）以获得更均匀的三角形。
     * @param {{x:number,y:number,z:number,regionId:number}[]} poly - 简单多边形顶点
     * @returns {{x:number,y:number,z:number,regionId:number}[][]} 三角形数组
     */
    triangulate(poly) {
        let verts = this.sanitizeTriangulationInput(poly);
        if (verts.length < 3) return [];
        if (this.computeSignedAreaXY(verts) < 0) verts = verts.reverse();

        /** @type {{x:number,y:number,z:number,regionId:number}[][]} */
        const result = [];

        let guard = 0;
        while (verts.length > 3 && guard++ < 5000) {
            let bestIndex = -1;
            let bestPerimeter = Infinity;

            for (let i = 0; i < verts.length; i++) {
                const prev = verts[(i - 1 + verts.length) % verts.length];
                const cur = verts[i];
                const next = verts[(i + 1) % verts.length];

                if (!isConvex(prev, cur, next)) continue;

                let blocked = false;
                for (let j = 0; j < verts.length; j++) {
                    if (j === i || j === (i - 1 + verts.length) % verts.length || j === (i + 1) % verts.length) continue;
                    if (pointInTri(verts[j], prev, cur, next)) {
                        blocked = true;
                        break;
                    }
                }
                if (blocked) continue;

                for (let j = 0; j < verts.length; j++) {
                    if (j === i || j === (i - 1 + verts.length) % verts.length || j === (i + 1) % verts.length) continue;
                    if (distPtSegSq(verts[j], prev, next) <= 1e-9) {
                        if (vec.length2D(prev, verts[j]) === 0 || vec.length2D(next, verts[j]) === 0) continue;
                        blocked = true;
                        break;
                    }
                }
                if (blocked) continue;

                const perimeter = vec.length2D(prev, cur) + vec.length2D(cur, next) + vec.length2D(next, prev);
                {
                    if (perimeter < bestPerimeter) {
                        bestPerimeter = perimeter;
                        bestIndex = i;
                    }
                }
            }

            if (bestIndex < 0) break;

            const prev = verts[(bestIndex - 1 + verts.length) % verts.length];
            const cur = verts[bestIndex];
            const next = verts[(bestIndex + 1) % verts.length];
            result.push([prev, cur, next]);
            verts.splice(bestIndex, 1);
        }

        if (verts.length === 3) {
            result.push([verts[0], verts[1], verts[2]]);
            return result;
        }

        if (verts.length !== 0) {
            this.error = true;
            Instance.Msg(`区域(${poly[0].regionId})：耳切失败，跳过该轮廓`);
            return [];
        }

        return result;
    }

    /**
     * 清理三角化输入：移除重复点和共线点。
     * @param {{x:number,y:number,z:number,regionId:number}[]} poly
     * @returns {{x:number,y:number,z:number,regionId:number}[]}
     */
    sanitizeTriangulationInput(poly) {
        /** @type {{x:number,y:number,z:number,regionId:number}[]} */
        const out = [];
        for (let i = 0; i < poly.length; i++) {
            const cur = poly[i];
            const prev = out[out.length - 1];
            if (prev && prev.x === cur.x && prev.y === cur.y) continue;
            out.push(cur);
        }

        if (out.length >= 2) {
            const a = out[0];
            const b = out[out.length - 1];
            if (a.x === b.x && a.y === b.y) out.pop();
        }

        let i = 0;
        while (out.length >= 3 && i < out.length) {
            const n = out.length;
            const a = out[(i + n - 1) % n];
            const b = out[i];
            const c = out[(i + 1) % n];
            if (Math.abs(area(a, b, c)) <= 1e-9) {
                out.splice(i, 1);
                continue;
            }
            i++;
        }

        return out;
    }

    /**
     * 合并三角形为凸多边形。
     *
     * 反复尝试将共享边的两个多边形合并，保持凸性且不超过最大顶点数。
     * longestEdgeFirst 为 true 时优先合并最长共享边，产生更少多边形。
     * @param {{x:number,y:number,z:number,regionId:number}[][]} tris - 三角形序列
     * @param {boolean} longestEdgeFirst - 是否优先合并最长边
     * @returns {{x:number,y:number,z:number,regionId:number}[][]} 合并后的多边形序列
     */
    mergeTriangles(tris, longestEdgeFirst) {
        const polys = tris.map((t) => t.slice());
        let merged = true;

        while (merged) {
            merged = false;

            let bestI = -1;
            let bestJ = -1;
            let bestPoly = null;
            let bestDist = -Infinity;

            for (let i = 0; i < polys.length; i++) {
                for (let j = i + 1; j < polys.length; j++) {
                    const info = this.getMergeInfo(polys[i], polys[j]);
                    if (!info) continue;

                    if (!longestEdgeFirst) {
                        bestI = i;
                        bestJ = j;
                        bestPoly = info.info;
                        break;
                    }

                    if (info.dist > bestDist) {
                        bestDist = info.dist;
                        bestI = i;
                        bestJ = j;
                        bestPoly = info.info;
                    }
                }
                if (!longestEdgeFirst && bestPoly) break;
            }

            if (!bestPoly) break;

            polys[bestI] = bestPoly;
            polys.splice(bestJ, 1);
            merged = true;
        }

        return polys;
    }

    /**
     * 尝试合并两个多边形，返回合并结果和共享边长度。
     * @param {{x:number,y:number,z:number,regionId:number}[]} a - 多边形 A
     * @param {{x:number,y:number,z:number,regionId:number}[]} b - 多边形 B
     * @returns {{info: {x:number,y:number,z:number,regionId:number}[], dist: number} | null} 合并成功时返回结果，否则 null
     */
    getMergeInfo(a, b) {
        let ai = -1;
        let bi = -1;
        const eps = 1e-6;

        for (let i = 0; i < a.length; i++) {
            const an = (i + 1) % a.length;
            for (let j = 0; j < b.length; j++) {
                const bn = (j + 1) % b.length;
                if (vec.length(a[i], b[bn]) <= eps && vec.length(a[an], b[j]) <= eps) {
                    ai = i;
                    bi = j;
                    break;
                }
            }
            if (ai >= 0) break;
        }

        if (ai < 0) return null;

        /** @type {{x:number,y:number,z:number,regionId:number}[]} */
        const merged = [];
        const nA = a.length;
        const nB = b.length;
        for (let i = 0; i < nA - 1; i++) merged.push(a[(ai + 1 + i) % nA]);
        for (let i = 0; i < nB - 1; i++) merged.push(b[(bi + 1 + i) % nB]);

        if (merged.length > POLY_MAX_VERTS_PER_POLY) return null;
        if (!this.isPolyConvex(merged)) return null;

        const v1 = a[ai];
        const v2 = a[(ai + 1) % nA];
        const distSq = (v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2;

        return { info: merged, dist: distSq };
    }

    /**
     * 判断多边形是否为凸多边形。
     * @param {{x:number,y:number,z:number,regionId:number}[]} poly
     * @returns {boolean}
     */
    isPolyConvex(poly) {
        const n = poly.length;
        for (let i = 0; i < n; i++) {
            if (area(poly[i], poly[(i + 1) % n], poly[(i + 2) % n]) < -1e-6) return false;
        }
        return true;
    }

    /**
     * 将一个多边形的顶点和区域信息添加到全局数组中。
     * @param {{x:number,y:number,z:number,regionId:number}[]} poly
     */
    addPolygon(poly) {
        const pi=this.polyslength*2;
        this.polys[pi]=this.vertslength;
        for (const v of poly) {
            const vi = this.vertslength*3;
            this.verts[vi]=v.x;
            this.verts[vi+1]=v.y;
            this.verts[vi+2]=v.z;
            this.vertslength++;
        }
        this.polys[pi+1]=this.vertslength-1;
        this.regions[this.polyslength]=poly[0].regionId;
        this.polyslength++;
    }

    /**
     * 在邻接关系建好后，将所有顶点从网格坐标转为世界坐标。
     *
     * 必须在 buildAdjacency 之后调用，因为邻接匹配依赖网格坐标的精确比对。
     */
    convertVertsToWorldAfterAdjacency() {
        if (this.worldConverted) return;
        // 只转换实际已用顶点，且每次步进3
        for (let i = 0; i < this.vertslength; i++) {
            const vi = i * 3;
            const v = this.toWorldVertex({
                x: this.verts[vi],
                y: this.verts[vi + 1],
                z: this.verts[vi + 2]
            });
            this.verts[vi] = v.x;
            this.verts[vi + 1] = v.y;
            this.verts[vi + 2] = v.z;
        }
        this.worldConverted = true;
    }

    /**
     * 将网格坐标转换为世界坐标。
     * @param {{x:number,y:number,z:number}} v - 网格坐标
     * @returns {{x:number,y:number,z:number}} 世界坐标
     */
    toWorldVertex(v) {
        return {
            x: origin.x + v.x * MESH_CELL_SIZE_XY,// - MESH_CELL_SIZE_XY / 2,
            y: origin.y + v.y * MESH_CELL_SIZE_XY,// - MESH_CELL_SIZE_XY / 2,
            z: origin.z + v.z * MESH_CELL_SIZE_Z
        };
    }

    /**
     * 为所有多边形建立边邻接关系。
     *
     * 通过匹配每条边的正/反向顶点键，记录共享边的相邻多边形索引。
     */
    buildAdjacency() {
        /**@type {Map<string, {poly: number, edge: number}>} */
        const edgeMap = new Map();
        // 先重置所有邻居信息
        for (let pi = 0; pi < this.polyslength; pi++) {
            const startVert = this.polys[pi * 2];
            const endVert = this.polys[pi * 2 + 1];
            const vertCount = endVert - startVert + 1;
            this.neighbors[pi]=new Array(vertCount);
            for (let ei = 0; ei < vertCount; ei++) {
                if (!this.neighbors[pi][ei]) {
                    this.neighbors[pi][ei] = new Int16Array(100);
                }
                this.neighbors[pi][ei][0] = 0; // 0号位表示邻居数量
            }
        }
        for (let pi = 0; pi < this.polyslength; pi++) {
            const startVert = this.polys[pi * 2];
            const endVert = this.polys[pi * 2 + 1];
            const vertCount = endVert - startVert + 1;
            for (let ei = 0; ei < vertCount; ei++) {
                const a = startVert + ei;
                const b = startVert + ((ei + 1) % vertCount);
                const ka = `${this.verts[a * 3]},${this.verts[a * 3 + 1]},${this.verts[a * 3 + 2]}`;
                const kb = `${this.verts[b * 3]},${this.verts[b * 3 + 1]},${this.verts[b * 3 + 2]}`;
                const lk = ka + '|' + kb;
                const rk = kb + '|' + ka;
                if (!edgeMap.has(lk)) {
                    edgeMap.set(lk, { poly: pi, edge: ei });
                    edgeMap.set(rk, { poly: pi, edge: ei });
                } else {
                    const other = edgeMap.get(lk);
                    if (!other) continue;
                    // 双向写入邻居
                    let n1 = ++this.neighbors[pi][ei][0];
                    this.neighbors[pi][ei][n1] = other.poly;
                    let n2 = ++this.neighbors[other.poly][other.edge][0];
                    this.neighbors[other.poly][other.edge][n2] = pi;
                }
            }
        }
    }

    /**
     * 调试绘制所有多边形边框。
     * @param {number} [duration=5] - 绘制持续时间（秒）
     */
    debugDrawPolys(duration = 5) {
        // 修正：this.polys为Int32Array，存储为[起始顶点索引, 结束顶点索引]，每个多边形2个元素
        for (let pi = 0; pi < this.polyslength; pi++) {
            const startVert = this.polys[pi * 2];
            const endVert = this.polys[pi * 2 + 1];
            const vertCount = endVert - startVert + 1;
            if (vertCount < 3) continue;
            const color = { r: 255, g: 255, b: 0 };
            for (let i = 0; i < vertCount; i++) {
                const vi0 = startVert + i;
                const vi1 = startVert + ((i + 1) % vertCount);
                const v0 = {
                    x: this.verts[vi0 * 3],
                    y: this.verts[vi0 * 3 + 1],
                    z: this.verts[vi0 * 3 + 2],
                };
                const v1 = {
                    x: this.verts[vi1 * 3],
                    y: this.verts[vi1 * 3 + 1],
                    z: this.verts[vi1 * 3 + 2],
                };
                const start = vec.Zfly(v0, 0);
                const end = vec.Zfly(v1, 0);
                Instance.DebugLine({ start, end, color, duration });
            }
        }
    }

    /**
     * 调试绘制多边形之间的邻接连线。
     * @param {number} [duration=15]
     */
    debugDrawAdjacency(duration = 15) {
        // 修正：边数应由多边形顶点数决定，不能直接用neighborsOfPoly.length
        for (let pi = 0; pi < this.polyslength; pi++) {
            const start = this.polyCenter(pi);
            const startVert = this.polys[pi * 2];
            const endVert = this.polys[pi * 2 + 1];
            const vertCount = endVert - startVert + 1;
            for (let ei = 0; ei < vertCount; ei++) {
                for(let ni=1;ni<=this.neighbors[pi][ei][0];ni++){
                    const neighborIndex = this.neighbors[pi][ei][ni];
                    // 只画一次，避免重复
                    if (neighborIndex < 0 || neighborIndex <= pi) continue;
                    const end = this.polyCenter(neighborIndex);
                    Instance.DebugLine({ start, end, color: { r: 255, g: 0, b: 255 }, duration });
                }
            }
        }
    }

    /**
     * 计算多边形的几何中心点。
     * @param {number} pi - 多边形索引
     * @returns {{x:number, y:number, z:number}}
     */
    polyCenter(pi) {
        // 修正：根据多边形索引区间遍历顶点，累加坐标
        const startVert = this.polys[pi * 2];
        const endVert = this.polys[pi * 2 + 1];
        const vertCount = endVert - startVert + 1;
        if (vertCount <= 0) return { x: 0, y: 0, z: 0 };
        let x = 0, y = 0, z = 0;
        for (let vi = startVert; vi <= endVert; vi++) {
            x += this.verts[vi * 3];
            y += this.verts[vi * 3 + 1];
            z += this.verts[vi * 3 + 2];
        }
        return { x: x / vertCount, y: y / vertCount, z: z / vertCount };
    }

    /**
     * 调试绘制共享边（有邻居的边）。
     * @param {number} [duration=15]
     */
    debugDrawSharedEdges(duration = 15) {
        // 修正：遍历所有多边形和每条边，判断该边是否有邻居，有则高亮
        for (let pi = 0; pi < this.polyslength; pi++) {
            const startVert = this.polys[pi * 2];
            const endVert = this.polys[pi * 2 + 1];
            const vertCount = endVert - startVert + 1;
            if (vertCount < 3) continue;
            const neighborsOfPoly = this.neighbors[pi];
            if (!neighborsOfPoly) continue;
            for (let ei = 0; ei < vertCount; ei++) {
                const edgeNeighbors = neighborsOfPoly[ei];
                if (!edgeNeighbors) continue;
                const count = edgeNeighbors[0];
                if (count > 0) {
                    const vi0 = startVert + ei;
                    const vi1 = startVert + ((ei + 1) % vertCount);
                    const v0 = {
                        x: this.verts[vi0 * 3],
                        y: this.verts[vi0 * 3 + 1],
                        z: this.verts[vi0 * 3 + 2],
                    };
                    const v1 = {
                        x: this.verts[vi1 * 3],
                        y: this.verts[vi1 * 3 + 1],
                        z: this.verts[vi1 * 3 + 2],
                    };
                    const start = vec.Zfly(v0, 20);
                    const end = vec.Zfly(v1, 20);
                    Instance.DebugLine({ start, end, color: { r: 0, g: 255, b: 0 }, duration });
                }
            }
        }
    }
}

/**
 * @module 导航网格/多边形细节
 */
/** @typedef {import("cs_script/point_script").Vector} Vector */
/** @typedef {import("./path_manager").NavMeshMesh} NavMeshMesh */

/**
 * 多边形细节网格构建器。
 *
 * 为每个导航多边形生成高保真的三角形网格（Detail Mesh），
 * 使用约束 Delaunay 三角剖分（CDT）和耳裁切算法。
 * Detail Mesh 用于精确的高度插值（由 FunnelHeightFixer 使用）。
 *
 * @navigationTitle 细节网格构建器
 */
class PolyMeshDetailBuilder {
    /**
     * 初始化细节网格构建器，绑定多边形网格与高度场。
     * @param {NavMeshMesh} mesh - 多边形网格数据
     * @param {OpenHeightfield} hf - 开放高度场，用于采样高度
     */
    constructor(mesh, hf) {
        /** @type {boolean} 构建过程中是否发生错误 */
        this.error = false;
        /** @type {NavMeshMesh} 多边形网格数据 */
        this.mesh = mesh;
        /** @type {OpenHeightfield} 开放高度场引用 */
        this.hf = hf;
        /** @type {Float32Array} */
        this.verts = new Float32Array(MAX_TRIS*3 * 3);//全局顶点数组，顺序为[x0,y0,z0,x1,y1,z1,...]，每个多边形的顶点在其中占用一个连续区间
        /** @type {number} */
        this.vertslength = 0;//点总数
        /** @type {Uint16Array} */
        this.tris = new Uint16Array(MAX_TRIS * 3);//第i个三角形的三个顶点为tris[3i][3i+1][3i+2],每个坐标为verts[tris[3i]|+1|+2]
        /** @type {number} */
        this.trislength = 0;//三角形总数
        /** @type {Uint16Array} */
        this.triTopoly = new Uint16Array(MAX_TRIS);//[i]:第i个三角形对应的多边形索引
        //每个多边形对应的三角形索引范围，格式为[baseVert=该多边形点索引起点, vertCount=该多边形有几个点, baseTri=该多边形三角索引起点, triCount=该多边形有几个三角形]
        /** @type {Uint16Array} */
        this.baseVert = new Uint16Array(MAX_POLYS);//该多边形点索引起点
        /** @type {Uint16Array} */
        this.vertsCount = new Uint16Array(MAX_POLYS);//该多边形有几个点
        /** @type {Uint16Array} */
        this.baseTri = new Uint16Array(MAX_POLYS);//该多边形三角索引起点
        /** @type {Uint16Array} */
        this.triCount = new Uint16Array(MAX_POLYS);//该多边形有几个三角形

        ///**@type {Vector[]}*/
        //this.verts = [];
        ///**@type {number[][]}*/
        //this.tris = [];
        ///**@type {number[][]}*/
        //this.meshes = [];
        ///**@type {number[]} */
        //this.triTopoly=[];
    }

    /**
     * 为所有多边形构建细节三角形网格。
     *
     * 遍历每个多边形调用 {@link buildPoly}，生成带高度信息的三角形网格。
     * @returns {import("./path_manager").NavMeshDetail}
     */
    init() {
        this.error = false;
        for (let pi = 0; pi < this.mesh.polyslength; pi++) {
            this.buildPoly(pi);
        }

        return {
            verts: this.verts,
            vertslength:this.vertslength,
            tris: this.tris,
            trislength:this.trislength,
            triTopoly:this.triTopoly,
            baseVert:this.baseVert,
            vertsCount:this.vertsCount,
            baseTri:this.baseTri,
            triCount:this.triCount
        };
    }
    /**
     * 调试绘制所有细节三角形。
     * @param {number} [duration=5] - 绘制持续时间（秒）
     */
    debugDrawPolys(duration = 5) {
        // TypedArray结构：tris为Uint16Array，verts为Float32Array
        for (let ti = 0; ti < this.trislength; ti++) {
            const ia = this.tris[ti * 3];
            const ib = this.tris[ti * 3 + 1];
            const ic = this.tris[ti * 3 + 2];
            const color = { r: 255 * Math.random(), g: 255 * Math.random(), b: 255 * Math.random() };
            const va = {
                x: this.verts[ia * 3],
                y: this.verts[ia * 3 + 1],
                z: this.verts[ia * 3 + 2]
            };
            const vb = {
                x: this.verts[ib * 3],
                y: this.verts[ib * 3 + 1],
                z: this.verts[ib * 3 + 2]
            };
            const vc = {
                x: this.verts[ic * 3],
                y: this.verts[ic * 3 + 1],
                z: this.verts[ic * 3 + 2]
            };
            Instance.DebugLine({ start: va, end: vb, color, duration });
            Instance.DebugLine({ start: vb, end: vc, color, duration });
            Instance.DebugLine({ start: vc, end: va, color, duration });
        }
    }
    /**
     * 为单个多边形构建细节三角形网格。
     *
     * 流程：采样边界高度 → 初始 CDT 三角化 → 内部采样点
     * → 逾代插入高度误差最大的点 → 写入全局数组。
     * @param {number} pi - 多边形索引
     */
    buildPoly(pi) {
        // TypedArray结构：polys为索引区间数组，regions为Int16Array
        const startVert = this.mesh.polys[pi * 2];
        const endVert = this.mesh.polys[pi * 2 + 1];
        const poly = [startVert, endVert];
        const regionid = this.mesh.regions[pi];
        const polyVerts = this.getPolyVerts(this.mesh, poly);
        // 待优化：内部采样点高度可改为基于细分后三角形插值

        // 1. 为多边形边界顶点采样高度
        const borderVerts = this.applyHeights(polyVerts, this.hf,regionid);
        // 2. 计算边界平均高度和高度范围
        const borderHeightInfo = this.calculateBorderHeightInfo(borderVerts);
        // 3. 获取初始三角划分（用于高度误差检查）
        const initialVertices = [...borderVerts];
        const initialConstraints = [];
        for (let i = 0; i < borderVerts.length; i++) {
            const j = (i + 1) % borderVerts.length;
            initialConstraints.push([i, j]);
        }
        // 4. 执行初始划分（基于边界点）
        const trianglesCDT = new SimplifiedCDT(initialVertices, initialConstraints, () => {
            this.error = true;
        });
        let triangles = trianglesCDT.getTri();
        // 5. 生成内部采样点
        let rawSamples = this.buildDetailSamples(polyVerts, borderHeightInfo, this.hf,triangles,trianglesCDT.vertices,regionid);
        // 6. 过滤内部采样点：仅保留高度误差较大的点
        while(rawSamples.length>0)
        {
            let insert=false;
            let heightDiff = 0;
            let heightid = -1;
            triangles = trianglesCDT.getTri();
            let toRemoveIndices = [];
            for (let i=0;i<rawSamples.length;i++) {
                const sample=rawSamples[i];
                let diff=0;
                // 找到包含采样点的三角形
                for (const tri of triangles) {
                    if (tri.containsPoint(sample, trianglesCDT.vertices)) {
                        const interpolatedHeight = tri.interpolateHeight(sample.x, sample.y, trianglesCDT.vertices);
                        diff = Math.abs(sample.z - interpolatedHeight);
                        if(this.isNearTriangleEdge(sample,tri,trianglesCDT.vertices)) diff = 0;
                        break;
                    }
                }
                // 仅当高度误差超过阈值时保留
                if(diff<=POLY_DETAIL_HEIGHT_ERROR)toRemoveIndices.push(i);
                else if (diff > heightDiff) {
                    heightDiff=diff;
                    heightid=i;
                    insert=true;
                }
            }
            if(insert)trianglesCDT.insertPointSimplified(rawSamples[heightid]);
            else break;
            for (let i = toRemoveIndices.length - 1; i >= 0; i--) {
                rawSamples.splice(toRemoveIndices[i], 1);
            }
        }
        
        // 7. 添加到全局列表
        // TypedArray结构填充
        const baseVert = this.vertslength;
        const baseTri = this.trislength;
        const allVerts = trianglesCDT.vertices;
        // 填充verts
        for (let i = 0; i < allVerts.length; i++) {
            const v = allVerts[i];
            this.verts[baseVert * 3 + i * 3] = v.x;
            this.verts[baseVert * 3 + i * 3 + 1] = v.y;
            this.verts[baseVert * 3 + i * 3 + 2] = v.z;
        }
        this.vertslength += allVerts.length;
        triangles = trianglesCDT.getTri();
        if (trianglesCDT.error) this.error = true;
        // 填充tris和triTopoly
        for (let i = 0; i < triangles.length; i++) {
            const tri = triangles[i];
            this.tris[(baseTri + i) * 3] = baseVert + tri.a;
            this.tris[(baseTri + i) * 3 + 1] = baseVert + tri.b;
            this.tris[(baseTri + i) * 3 + 2] = baseVert + tri.c;
            this.triTopoly[baseTri + i] = pi;
        }
        this.trislength += triangles.length;
        // 填充baseVert、vertsCount、baseTri、triCount
        this.baseVert[pi] = baseVert;
        this.vertsCount[pi] = allVerts.length;
        this.baseTri[pi] = baseTri;
        this.triCount[pi] = triangles.length;
        // meshes数组可选，若需要保留
        // this.meshes.push([
        //     baseVert,
        //     allVerts.length,
        //     baseTri,
        //     triangles.length
        // ]);
    }
    /**
    * 计算边界顶点高度信息
     * @param {Vector[]} borderVerts
     * @returns {{avgHeight: number, minHeight: number, maxHeight: number, heightRange: number}}
     */
    calculateBorderHeightInfo(borderVerts) {
        let sumHeight = 0;
        let minHeight = Infinity;
        let maxHeight = -Infinity;

        for (const v of borderVerts) {
            sumHeight += v.z;
            minHeight = Math.min(minHeight, v.z);
            maxHeight = Math.max(maxHeight, v.z);
        }

        const avgHeight = sumHeight / borderVerts.length;
        const heightRange = maxHeight - minHeight;

        return {
            avgHeight,
            minHeight,
            maxHeight,
            heightRange
        };
    }
    /**
     * 从多边形索引区间提取顶点坐标。
     * @param {NavMeshMesh} mesh - 网格数据
     * @param {number[]} poly - [startVert, endVert] 顶点索引区间
     * @returns {Vector[]}
     */
    getPolyVerts(mesh, poly) {
        // poly为[startVert, endVert]区间
        const [start, end] = poly;
        const verts = [];
        for (let i = start; i <= end; i++) {
            const x = mesh.verts[i * 3];
            const y = mesh.verts[i * 3 + 1];
            const z = mesh.verts[i * 3 + 2];
            verts.push({ x, y, z });
        }
        return verts;
    }
    /**
    * 生成内部采样点（带高度误差检查）
     * @param {Vector[]} polyVerts
     * @param {{avgHeight: number;minHeight: number;maxHeight: number;heightRange: number;}} heightInfo
     * @param {OpenHeightfield} hf
     * @returns {Vector[]}
     * @param {Triangle[]} initialTriangles
     * @param {Vector[]} initialVertices
     * @param {number} regionid
     */
    buildDetailSamples(polyVerts, heightInfo, hf,initialTriangles,initialVertices,regionid) {
        const samples = [];
        // 2. AABB
        let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
        for (const v of polyVerts) {
            minx = Math.min(minx, v.x);
            miny = Math.min(miny, v.y);
            maxx = Math.max(maxx, v.x);
            maxy = Math.max(maxy, v.y);
        }

        const step = POLY_DETAIL_SAMPLE_DIST * MESH_CELL_SIZE_XY;
        for (let x = minx + step / 2; x <= maxx; x += step) {
            for (let y = miny + step / 2; y <= maxy; y += step) {
                if (this.pointInPoly2D(x, y, polyVerts)) {
                    // 采样高度
                    let triheight=heightInfo.avgHeight;

                    // 计算与边界平均高度的差值
                    //const heightDiff = Math.abs(height - heightInfo.avgHeight);
                    for (const tri of initialTriangles) {
                        if (tri.containsPoint({x, y,z:heightInfo.avgHeight},initialVertices)) {
                            // 使用三角形插值计算高度
                            triheight = tri.interpolateHeight(x, y, initialVertices);
                            break;
                        }
                    }
                    const height=this.sampleHeight(hf, x, y, triheight??heightInfo.avgHeight,regionid);
                    // 检查是否超过阈值
                    if(Math.abs(height - triheight)>POLY_DETAIL_HEIGHT_ERROR) {
                        samples.push({ x: x, y: y, z: height });
                    }
                }
            }
        }
        return samples;
    }
    /**
     * 判断采样点是否距离三角形边太近。
     * @param {Vector} sample
     * @param {Triangle} tri
     * @param {Vector[]} verts
     * @returns {boolean}
     */
    isNearTriangleEdge(sample, tri, verts) {

        const dis = Math.min(distPtSegSq(sample,verts[tri.a],verts[tri.b]),distPtSegSq(sample,verts[tri.b],verts[tri.c]),distPtSegSq(sample,verts[tri.c],verts[tri.a]));
        if (dis < POLY_DETAIL_SAMPLE_DIST * 0.5) return true;
        return false;
    }
    /**
     * 为多边形边界顶点采样真实高度，并在边上插入高度误差较大的点。
     * @param {Vector[]} polyVerts - 多边形顶点
     * @param {OpenHeightfield} hf - 开放高度场
     * @param {number} regionid - 区域 ID
     * @returns {Vector[]} 带真实高度的边界顶点序列
     */
    applyHeights(polyVerts, hf,regionid) {
        const resultVerts = [];
        const n = polyVerts.length;
        const step = POLY_DETAIL_SAMPLE_DIST * MESH_CELL_SIZE_XY;
        for (let i = 0; i < n; i++) {
            const a = polyVerts[i];
            const b = polyVerts[(i + 1) % n];
            // 对当前顶点采样高度
            const az = this.sampleHeight(hf, a.x, a.y, a.z,regionid);
            const bz = this.sampleHeight(hf, b.x, b.y, b.z, regionid);
            const A = { x: a.x, y: a.y, z: az };
            const B = { x: b.x, y: b.y, z: bz };
            // 添加当前顶点（起始点）
            resultVerts.push(A);

            // 细分当前边
            const samples = this.sampleEdgeWithHeightCheck(
                A, 
                B, 
                hf,
                step
            );
            // 递归插点
            this.subdivideEdgeByHeight(
                A,
                B,
                samples,
                hf,
                regionid,
                resultVerts
            );
        }
        
        return resultVerts;
    }
    /**
     * 在 [start, end] 之间递归插入高度误差最大的点。
     * @param {Vector} start - 起始顶点
     * @param {Vector} end - 结束顶点
     * @param {Vector[]} samples - 该边上的细分点（不含 start/end）
     * @param {OpenHeightfield} hf
     * @param {number} regionid
     * @param {Vector[]} outVerts - 输出顶点数组
     */
    subdivideEdgeByHeight(start, end,samples,hf,regionid,outVerts) {
        let maxError = 0;
        let maxIndex = -1;
        let maxVert = null;

        const total = samples.length;

        for (let i = 0; i < total; i++) {
            const s = samples[i];
            const t = (i + 1) / (total + 1);

            // 不加入该点时的插值高度
            const interpZ = start.z * (1 - t) + end.z * t;

            const h = this.sampleHeight(hf, s.x, s.y, interpZ, regionid);
            const err = Math.abs(h - interpZ);

            if (err > maxError) {
                maxError = err;
                maxIndex = i;
                maxVert = { x: s.x, y: s.y, z: h };
            }
        }

        // 没有需要加入的点
        if (maxError <= POLY_DETAIL_HEIGHT_ERROR || maxIndex === -1||!maxVert) {
            return;
        }

        // 递归左半段
        this.subdivideEdgeByHeight(
            start,
            maxVert,
            samples.slice(0, maxIndex),
            hf,
            regionid,
            outVerts
        );

        // 插入当前最大误差点（保持顺序）
        outVerts.push(maxVert);

        // 递归右半段
        this.subdivideEdgeByHeight(
            maxVert,
            end,
            samples.slice(maxIndex + 1),
            hf,
            regionid,
            outVerts
        );
    }
    /**
     * 沿边等距采样点，返回中间点坐标数组。
     * @param {Vector} start - 边起点
     * @param {Vector} end - 边终点
     * @param {OpenHeightfield} hf
     * @param {number} sampleDist - 采样间距
     * @returns {Vector[]} 采样点数组
     */
    sampleEdgeWithHeightCheck(start, end, hf, sampleDist) {
        const samples = [];
        
        // 计算边向量和长度
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        
        if (length <= 1e-6) {
            return []; // 边长度为 0，不采样
        }
        
        // 计算方向向量
        const dirX = dx / length;
        const dirY = dy / length;
        // 计算采样点数（不包含起点和终点）
        const numSamples = Math.floor(length / sampleDist);
        
        // 记录采样点高度

        for (let i = 1; i <= numSamples; i++) {
            const t = i / (numSamples + 1); // 确保不会采样到端点
            const x = start.x + dirX * length * t;
            const y = start.y + dirY * length * t;
            const z = start.z * (1 - t) + end.z * t;
            samples.push({ x, y, z });
        }
        
        return samples;
    }
    /**
     * 从开放高度场采样世界坐标处的地板高度。
     *
     * 先在对应 cell 中查找同区域的最近 Span，找不到时向多周围扩散搜索。
     * @param {OpenHeightfield} hf
     * @param {number} wx - 世界坐标 X
     * @param {number} wy - 世界坐标 Y
     * @param {number} fallbackZ - 找不到时的回退高度
     * @param {number} regionid - 区域 ID
     * @returns {number} 采样到的高度
     */
    sampleHeight(hf, wx, wy, fallbackZ,regionid) {
        const globalIx = Math.round((wx - origin.x+ MESH_CELL_SIZE_XY / 2) / MESH_CELL_SIZE_XY);
        const globalIy = Math.round((wy - origin.y+ MESH_CELL_SIZE_XY / 2) / MESH_CELL_SIZE_XY);
        const ix = globalIx - (hf.baseX);
        const iy = globalIy - (hf.baseY);

        if (ix < 0 || iy < 0 || ix >= hf.gridX || iy >= hf.gridY) return fallbackZ;

        let best = null;
        let bestDiff = Infinity;
        let spanId = hf.cells[ix][iy];
        while (spanId !== 0) {
            if(OpenSpan.getRegionId(spanId)===regionid)
            {
                const z = origin.z + OpenSpan.getFloor(spanId) * MESH_CELL_SIZE_Z;
                const d = Math.abs(z - fallbackZ);
                if (d < bestDiff) {
                    bestDiff = d;
                    best = z;
                }
            }
            spanId = OpenSpan.getNext(spanId);
        }
        // 如果没有找到合适的 span，开始螺旋式搜索
        if (best === null) {
            const maxRadius = Math.max(hf.gridX, hf.gridY); // 搜索最大半径
            let radius = 1; // 初始半径
            out:
            while (radius <= maxRadius) {
                // 螺旋式外扩，检查四个方向
                for (let offset = 0; offset <= radius; offset++) {
                    // 检查 (ix + offset, iy + radius) 等候选位置
                    let candidates = [
                        [ix + offset, iy + radius], // 上
                        [ix + radius, iy + offset], // 右
                        [ix - offset, iy - radius], // 下
                        [ix - radius, iy - offset]  // 左
                    ];

                    for (const [nx, ny] of candidates) {
                        if (nx >= 0 && ny >= 0 && nx < hf.gridX && ny < hf.gridY) {
                            // 在有效范围内查找对应 span
                            spanId = hf.cells[nx][ny];
                            while (spanId !== 0) {
                                if(OpenSpan.getRegionId(spanId)===regionid)
                                {
                                    const z = origin.z + OpenSpan.getFloor(spanId) * MESH_CELL_SIZE_Z;
                                    const d = Math.abs(z - fallbackZ);
                                    if (d < bestDiff) {
                                        bestDiff = d;
                                        best = z;
                                        break out;
                                    }
                                }
                                spanId = OpenSpan.getNext(spanId);
                            }
                        }
                    }
                }
                // 增大半径，继续搜索
                radius++;
            }
        }

        // 如果最终未找到合适 span，返回 fallbackZ
        return best ?? fallbackZ;
    }
    /**
    * 判断点是否在多边形内（不含边界）
    * 使用 odd-even rule（射线法）
     *
     * @param {number} px
     * @param {number} py
     * @param {{x:number,y:number}[]} poly
     * @returns {boolean}
     */
    pointInPoly2D(px, py, poly) {
        let inside = false;
        const n = poly.length;

        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;

            // ===== 点在边上，按 outside 处理 =====
            if (Tool.pointOnSegment2D(px, py, xi, yi, xj, yj, { includeEndpoints: true })) {
                return false;
            }

            // ===== 射线法 =====
            const intersect =
                ((yi > py) !== (yj > py)) &&
                (px < (xj - xi) * (py - yi) / (yj - yi + 1e-12) + xi);

            if (intersect) inside = !inside;
        }

        return inside;
    }

}

/**
 * 简化的约束 Delaunay 三角剖分器。
 *
 * 使用耳裁切进行初始三角化，然后通过 Bowyer-Watson 风格插入新点并
 * 对非约束边执行 Delaunay 合法化翻转。
 */
class SimplifiedCDT {
    /**
     * 创建约束 Delaunay 三角剖分实例。
     * @param {Vector[]} vertices - 初始顶点列表
     * @param {number[][]} constraints - 约束边列表（顶点索引对）
     * @param {(() => void)} onError - 错误回调
     */
    constructor(vertices, constraints, onError) {
        /** @type {boolean} 是否发生错误 */
        this.error = false;
        /** @type {(() => void) | undefined} 错误回调 */
        this.onError = onError;
        /** @type {Vector[]} 顶点列表（插入新点时会增长） */
        this.vertices = vertices;
        /** @type {number[][]} 约束边列表 */
        this.constraints = constraints;
        /** @type {Triangle[]} 当前三角形列表 */
        this.triangles = [];
        
        // 构建约束边查找集合
        this.constraintEdges = new Set();
        for (const [a, b] of constraints) {
            // 规范化边键（小索引在前）
            const key = Tool.orderedPairKey(a, b);
            this.constraintEdges.add(key);
        }
        // 初始剖分：耳切法
        this.earClipping(vertices);
    }

    /**
     * 获取当前三角形列表。
     * @returns {Triangle[]} 三角形顶点索引列表
     */
    getTri() {
        return this.triangles;
    }
    /**
     * 耳裁切三角化，优先切割周长最小的耳朵。
     * @param {Vector[]} poly - 多边形顶点
     */
    earClipping(poly) {
        const verts = Array.from({ length: poly.length }, (_, i) => i);
        let guard = 0;
        while (verts.length > 3 && guard++ < 5000) {
            let bestEar=null;
            let minPerimeter=Infinity;
            let bestIndex=-1;

            for (let i = 0; i < verts.length; i++) {
                const prev = poly[verts[(i - 1 + verts.length) % verts.length]];
                const cur = poly[verts[i]];
                const next = poly[verts[(i + 1) % verts.length]];
                // cur 对应角度是否小于 180 度
                if (!isConvex(prev, cur, next)) continue;
                // 检查三角形是否包含其他点
                let contains = false;
                for (let j = 0; j < verts.length; j++) {
                    if (j == i || j == (i - 1 + verts.length) % verts.length || j == (i + 1) % verts.length) continue;
                    if (pointInTri(poly[verts[j]], prev, cur, next)) {
                        contains = true;
                        break;
                    }
                }
                if (contains) continue;
                // 其他点不能在线段 prev-next 上
                for (let j = 0; j < verts.length; j++) {
                    if (j == i || j == (i - 1 + verts.length) % verts.length || j == (i + 1) % verts.length) continue;
                    if (distPtSegSq(poly[verts[j]], prev, next) == 0) // 判断点是否在线段上
                    {
                        if (vec.length2D(prev, poly[verts[j]]) == 0 || vec.length2D(next, poly[verts[j]]) == 0) continue;
                        contains = true;
                        break;
                    }
                }
                if (contains) continue;
                const perimeter = 
                vec.length2D(prev, cur) +
                vec.length2D(cur, next) +
                vec.length2D(next, prev);
            
                // 找到周长最小的耳朵
                if (perimeter < minPerimeter) {
                    minPerimeter = perimeter;
                    bestEar = {p:verts[(i - 1 + verts.length) % verts.length], c:verts[i], n:verts[(i + 1) % verts.length]};
                    bestIndex = i;
                }
            }
            // 找到最佳耳朵则切除
            if (bestEar && bestIndex !== -1) {
                this.triangles.push(new Triangle(bestEar.p, bestEar.c, bestEar.n));
                verts.splice(bestIndex, 1);
            } else {
                // 找不到耳朵，退出循环
                break;
            }
        }
        if (verts.length == 3) {
            this.triangles.push(new Triangle(verts[0], verts[1], verts[2]));
        }else {
            this.error = true;
            if (this.onError) this.onError();
            Instance.Msg("细节多边形耳切失败");
        }
    }
    /**
     * 向三角剖分中插入新点，拆分包含它的三角形并合法化受影响的边。
     * @param {Vector} point - 要插入的点
     */
    insertPointSimplified(point) {

        const pointIndex = this.vertices.length;
        this.vertices.push(point);
        const p=this.vertices[pointIndex];
        let targetIdx = -1;

        // 找到包含点的三角形
        for (let i = 0; i < this.triangles.length; i++) {
            if (this.triangles[i].containsPoint(p, this.vertices)) {
                targetIdx = i;
                break;
            }
        }
        
        if (targetIdx === -1) {
            // 点不在任何三角形内（可能在边上），尝试处理边上点
            this.handlePointOnEdge(pointIndex);
            //Instance.Msg("点在边上");
            return;
        }

        const t = this.triangles[targetIdx];

        this.triangles.splice(targetIdx, 1);

        // 分裂为三个新三角形
        const t1 = new Triangle(t.a, t.b, pointIndex);
        const t2 = new Triangle(t.b, t.c, pointIndex);
        const t3 = new Triangle(t.c, t.a, pointIndex);
        
        this.triangles.push(t1, t2, t3);

        // 只对这三条边进行局部优化
        this.legalizeEdge(pointIndex, t.a, t.b);
        this.legalizeEdge(pointIndex, t.b, t.c);
        this.legalizeEdge(pointIndex, t.c, t.a);
    }
    /**
     * 处理点落在三角形边上的情况，拆分相邻两个三角形为四个。
     * @param {number} pointIndex - 新点在 vertices 中的索引
     */
    handlePointOnEdge(pointIndex) {
        const p = this.vertices[pointIndex];
        // 先检查是否在约束边上
        for (const [a, b] of this.constraints) {
            if (Tool.pointOnSegment2D(p.x, p.y, this.vertices[a].x, this.vertices[a].y, this.vertices[b].x, this.vertices[b].y, { includeEndpoints: true })) {
                return;
            }
        }
        // 查找包含该点的边
        for (let i = 0; i < this.triangles.length; i++) {
            const tri = this.triangles[i];
            const edges = tri.edges();
            
            for (const [a, b] of edges) {
                if (this.isConstraintEdge(a, b)) continue;
                if (Tool.pointOnSegment2D(p.x, p.y, this.vertices[a].x, this.vertices[a].y, this.vertices[b].x, this.vertices[b].y, { includeEndpoints: true })) {
                    // 找到共享该边的另一个三角形
                    const otherTri = this.findAdjacentTriangleByEdge([a, b], tri);
                    
                    if (otherTri) {

                        // 移除两个共享该边的三角形
                        this.triangles.splice(this.triangles.indexOf(tri), 1);
                        this.triangles.splice(this.triangles.indexOf(otherTri), 1);
                        
                        // 获取两个三角形中不在该边上的顶点
                        const c = tri.oppositeVertex(a, b);
                        const d = otherTri.oppositeVertex(a, b);
                        
                        // 创建四个新三角形
                        const t1=new Triangle(a, pointIndex, c);
                        const t2=new Triangle(pointIndex, b, c);
                        const t3=new Triangle(a, d, pointIndex);
                        const t4=new Triangle(pointIndex, d, b);

                        this.triangles.push(t1,t2,t3,t4);

                        // 优化新产生的边
                        this.legalizeEdge(pointIndex, a, c);
                        this.legalizeEdge(pointIndex, b, c);
                        this.legalizeEdge(pointIndex, a, d);
                        this.legalizeEdge(pointIndex, b, d);
                        
                        return;
                    }
                }
            }
        }
    }
    /**
     * Delaunay 合法化：若边不满足空圆条件则翻转，跳过约束边。
     * @param {number} pIdx - 新插入点索引
     * @param {number} v1 - 边的一端
     * @param {number} v2 - 边的另一端
     */
    legalizeEdge(pIdx, v1, v2) {
        // 约束边不可翻转
        if (this.isConstraintEdge(v1, v2)) {
            return;
        }
        
        const edge = [v1, v2];
        const triangleWithP = this.findTriangleByVerts(v1, v2, pIdx);
        if (!triangleWithP) return;
        
        const t2 = this.findAdjacentTriangleByEdge(edge, triangleWithP);
        if (!t2) return;

        const otherVert = t2.oppositeVertex(v1, v2);
        
        // 检查 Delaunay 条件
        if (this.inCircumcircle(
            this.vertices[v1], 
            this.vertices[v2], 
            this.vertices[pIdx], 
            this.vertices[otherVert]
        )) {
            // 翻转边
            this.removeTriangle(t2);
            this.removeTriangle(triangleWithP);

            // 创建两个新三角形
            const tt1=new Triangle(v1, otherVert, pIdx);
            const tt2=new Triangle(v2, otherVert, pIdx);

            this.triangles.push(tt1,tt2);

            // 递归优化新产生的两条外边
            this.legalizeEdge(pIdx, v1, otherVert);
            this.legalizeEdge(pIdx, v2, otherVert);
        }
    }
    
    /**
     * 判断边是否为约束边（不可翻转）。
     * @param {number} a
     * @param {number} b
     * @returns {boolean}
     */
    isConstraintEdge(a, b) {
        const key = Tool.orderedPairKey(a, b);
        return this.constraintEdges.has(key);
    }

    /**
     * 根据三个顶点索引查找三角形（任意顺序）。
     * @param {number} a
     * @param {number} b
     * @param {number} c
     * @returns {Triangle | null}
     */
    findTriangleByVerts(a, b, c) {
        for (const tri of this.triangles) {
            if ((tri.a === a && tri.b === b && tri.c === c) ||
                (tri.a === a && tri.b === c && tri.c === b) ||
                (tri.a === b && tri.b === a && tri.c === c) ||
                (tri.a === b && tri.b === c && tri.c === a) ||
                (tri.a === c && tri.b === a && tri.c === b) ||
                (tri.a === c && tri.b === b && tri.c === a)) {
                return tri;
            }
        }
        return null;
    }
    
    /**
     * 通过共享边查找相邻三角形。
     * @param {number[]} edge - 边的两个顶点索引
     * @param {Triangle} excludeTriangle - 排除的三角形
     * @returns {Triangle | null}
     */
    findAdjacentTriangleByEdge(edge, excludeTriangle) {
        const [a, b] = edge;
        
        for (const tri of this.triangles) {
            if (tri === excludeTriangle) continue;
            
            if ((tri.a === a && tri.b === b) ||
                (tri.a === b && tri.b === a) ||
                (tri.a === a && tri.c === b) ||
                (tri.a === b && tri.c === a) ||
                (tri.b === a && tri.c === b) ||
                (tri.b === b && tri.c === a)) {
                return tri;
            }
        }
        
        return null;
    }
    
    /**
     * 移除指定三角形。
     * @param {Triangle} triangle
     */
    removeTriangle(triangle) {
        const index = this.triangles.indexOf(triangle);
        if (index !== -1) {
            this.triangles.splice(index, 1);
        }
    }

    /**
     * 检查点 d 是否在三角形 abc 的外接圆内。
     * @param {{ x: any; y: any;}} a
     * @param {{ x: any; y: any;}} b
     * @param {{ x: any; y: any;}} c
     * @param {{ x: any; y: any;}} d
     * @returns {boolean}
     */
    inCircumcircle(a, b, c, d) {
        const orient =
        (b.x - a.x) * (c.y - a.y) -
        (b.y - a.y) * (c.x - a.x);
        const ax = a.x, ay = a.y;
        const bx = b.x, by = b.y;
        const cx = c.x, cy = c.y;
        const dx = d.x, dy = d.y;
        
        const adx = ax - dx;
        const ady = ay - dy;
        const bdx = bx - dx;
        const bdy = by - dy;
        const cdx = cx - dx;
        const cdy = cy - dy;
        
        const abdet = adx * bdy - bdx * ady;
        const bcdet = bdx * cdy - cdx * bdy;
        const cadet = cdx * ady - adx * cdy;
        const alift = adx * adx + ady * ady;
        const blift = bdx * bdx + bdy * bdy;
        const clift = cdx * cdx + cdy * cdy;
        
        const det = alift * bcdet + blift * cadet + clift * abdet;
        
        return orient > 0 ? det > 0 : det < 0;
    }
}
/**
 * 三角形类，存储三个顶点索引并提供几何查询方法。
 */
class Triangle {
    /**
     * 用三个顶点索引创建三角形。
     * @param {number} a - 顶点 A 索引
     * @param {number} b - 顶点 B 索引
     * @param {number} c - 顶点 C 索引
     */
    constructor(a, b, c) {
        this.a = a;
        this.b = b;
        this.c = c;
    }

    /**
     * 返回三角形的三条边（顶点索引对）。
     * @returns {number[][]}
     */
    edges() {
        return [
            [this.a, this.b],
            [this.b, this.c],
            [this.c, this.a]
        ];
    }

    /**
     * 检查三角形是否包含某条边。
     * @param {number[]} edge - 边的两个顶点索引
     * @returns {boolean}
     */
    hasEdge(edge) {
        const [e1, e2] = edge;
        return (this.a === e1 && this.b === e2) ||
            (this.b === e1 && this.c === e2) ||
            (this.c === e1 && this.a === e2) ||
            (this.a === e2 && this.b === e1) ||
            (this.b === e2 && this.c === e1) ||
            (this.c === e2 && this.a === e1);
    }

    /**
     * 检查点是否在三角形内。
     * @param {Vector} point
     * @param {Vector[]} vertices
     * @returns {boolean}
     */
    containsPoint(point, vertices) {
        const va = vertices[this.a];
        const vb = vertices[this.b];
        const vc = vertices[this.c];

        return pointInTri(point, va, vb, vc);
    }

    /**
     * 找到边对面的顶点。
     * @param {number} v1
     * @param {number} v2
     * @returns {number} 对面顶点索引，未找到时返回 -1
     */
    oppositeVertex(v1, v2) {
        if (this.a !== v1 && this.a !== v2) return this.a;
        if (this.b !== v1 && this.b !== v2) return this.b;
        if (this.c !== v1 && this.c !== v2) return this.c;
        return -1;
    }
    /**
    * 计算点在三角形平面上的插值高度
    * @param {number} x 点的 x 坐标
    * @param {number} y 点的 y 坐标
     * @param {Vector[]} vertices
    * @returns {number} 插值高度
     */
    interpolateHeight(x, y, vertices) {
        const va = vertices[this.a];
        const vb = vertices[this.b];
        const vc = vertices[this.c];
        
        // 使用重心坐标插值
        const denom = (vb.y - vc.y) * (va.x - vc.x) + (vc.x - vb.x) * (va.y - vc.y);
        
        if (Math.abs(denom) < 1e-6) {
            // 三角形退化时，返回三个顶点高度平均值
            return (va.z + vb.z + vc.z) / 3;
        }
        
        const u = ((vb.y - vc.y) * (x - vc.x) + (vc.x - vb.x) * (y - vc.y)) / denom;
        const v = ((vc.y - va.y) * (x - vc.x) + (va.x - vc.x) * (y - vc.y)) / denom;
        const w = 1 - u - v;
        
        // 插值高度
        return u * va.z + v * vb.z + w * vc.z;
    }
}

/**
 * @module 导航网格/跳跃链接构建
 */
/** @typedef {import("cs_script/point_script").Vector} Vector */
/** @typedef {import("./path_manager").NavMeshMesh} NavMeshMesh */
/** @typedef {import("./path_manager").NavMeshLink} NavMeshLink */
/**
 * 跳跃链接自动构建器。
 *
 * 在不可达的分离行走区域间自动构建跳跃连接。
 * 使用网格空间索引快速查找候选边缘，并通过 TraceBox
 * 验证跳跃路径的可行性。支持 Tile 内和跨 Tile 链接。
 *
 * @navigationTitle 跳跃链接构建
 */
class JumpLinkBuilder
{
    /**
     * 初始化跳跃链接构建器，绑定多边形网格。
    * @param {NavMeshMesh} polyMesh
     */
    constructor(polyMesh) {
        /** @type {NavMeshMesh} 待分析的多边形网格引用 */
        this.mesh = polyMesh;
        /** 2D 边界边间最大跳跃距离（单位：引擎坐标），用于空间索引查询半径 */
        this.jumpDist = 32;
        /** 最大跳跃高度（MAX_JUMP_HEIGHT × 体素 Z 尺寸），超过此高差的候选将被丢弃 */
        this.jumpHeight = MAX_JUMP_HEIGHT*MESH_CELL_SIZE_Z;
        /** 可行走高差阈值（MAX_WALK_HEIGHT × 体素 Z 尺寸），低于此高差的连接标记为 WALK 而非 JUMP */
        this.walkHeight = MAX_WALK_HEIGHT*MESH_CELL_SIZE_Z;
        /** 代理站立高度（AGENT_HEIGHT × 体素 Z 尺寸），用于 TraceBox 验证 */
        this.agentHeight = AGENT_HEIGHT * MESH_CELL_SIZE_Z;
        /** 同一岛对内跳跃点最小间距（平方），避免密集重复连接 */
        this.linkdist=250;

        /** @type {Uint16Array} 每个 link 占 2 个 uint16：poly[i*2]=起始 poly, poly[i*2+1]=目标 poly */
        this.poly=new Uint16Array(MAX_LINKS*2);
        /** @type {Float32Array} 每个 link 的寻路代价（通常为距离 × 1.5） */
        this.cost=new Float32Array(MAX_LINKS);

        /** @type {Uint8Array} 每个 link 的类型（PathState.WALK / PathState.JUMP） */
        this.type=new Uint8Array(MAX_LINKS);

        /** @type {Float32Array} 每个 link 占 6 个 float：pos[i*6..i*6+2] 为起点 XYZ, pos[i*6+3..i*6+5] 为终点 XYZ */
        this.pos=new Float32Array(MAX_LINKS*6);
        /** @type {number} 当前已写入的 link 数量 */
        this.length=0;

        /** @type {Int16Array} 每个多边形所属的连通区域 ID（由 buildConnectivity 填充）；同岛多边形之间不构建跳跃链接 */
        this.islandIds=new Int16Array(MAX_POLYS);
    }
    /**
     * 收集所有边界边，返回TypedArray，每3个为一组：polyIndex, p1索引, p2索引
     * p1/p2为顶点索引（不是坐标），便于后续批量处理
     * @returns {{boundarylengh:number,boundaryEdges:Uint16Array}} [polyIndex, p1, p2, ...]
     */
    collectBoundaryEdges() {
        const polyCount = this.mesh.polyslength;
        // 预估最大边界边数量
        const maxEdges = polyCount * 6;
        const result = new Uint16Array(maxEdges * 3);
        let edgeCount = 0;
        for (let i = 0; i < polyCount; i++) {
            const startVert = this.mesh.polys[i * 2];
            const endVert = this.mesh.polys[i * 2 + 1];
            const vertCount = endVert - startVert + 1;
            for (let j = 0; j < vertCount; j++) {
                const neighList = this.mesh.neighbors[i][j];
                if (!neighList[0]) {
                    const vi0 = startVert + j;
                    const vi1 = startVert + ((j + 1) % vertCount);
                    const idx = edgeCount * 3;
                    result[idx] = i;
                    result[idx + 1] = vi0;
                    result[idx + 2] = vi1;
                    edgeCount++;
                }
            }
        }
        // 截取有效部分
        return {boundarylengh:edgeCount,boundaryEdges:result};
    }
    /**
     * 判断两个多边形是否已经是物理邻居
     * @param {number} idxA
     * @param {number} idxB
     */
    areNeighbors(idxA, idxB) {
        const edgeList = this.mesh.neighbors[idxA];
        for (const entry of edgeList) {
            for (let k = 1; k <= entry[0]; k++) {
                if (entry[k] === idxB) return true;
            }
        }
        return false;
    }
    // 1D 区间间距：重叠返回 0，不重叠返回最小间距
    /**
     * 计算两个一维区间的间距，重叠时返回 0，否则返回最小间距。
     * @param {number} a0
     * @param {number} a1
     * @param {number} b0
     * @param {number} b1
     */
    intervalGap(a0, a1, b0, b1) {
        const amin = Math.min(a0, a1);
        const amax = Math.max(a0, a1);
        const bmin = Math.min(b0, b1);
        const bmax = Math.max(b0, b1);

        if (amax < bmin) return bmin - amax; // A 在 B 左侧
        if (bmax < amin) return amin - bmax; // B 在 A 左侧
        return 0; // 重叠
    }
    /**
     * 计算两条线段在 XY 平面上的最近点对及距离。
     *
     * 算法来自《Real-Time Collision Detection》，在 XY 平面求解参数 s/t，
     * 再映射回 3D 坐标。同时进行提前剪枝：Z 间距 > jumpHeight 或 XY AABB 间距 > dist2dsq 时直接返回。
     *
     * @param {number} p1x - 线段 A 起点 X
     * @param {number} p1y - 线段 A 起点 Y
     * @param {number} p1z - 线段 A 起点 Z
     * @param {number} p2x - 线段 A 终点 X
     * @param {number} p2y - 线段 A 终点 Y
     * @param {number} p2z - 线段 A 终点 Z
     * @param {number} p3x - 线段 B 起点 X
     * @param {number} p3y - 线段 B 起点 Y
     * @param {number} p3z - 线段 B 起点 Z
     * @param {number} p4x - 线段 B 终点 X
     * @param {number} p4y - 线段 B 终点 Y
     * @param {number} p4z - 线段 B 终点 Z
     * @param {number} dist2dsq - 2D 距离平方阈值
     * @returns {{dist:number, ptA:Vector, ptB:Vector}|undefined} 最近点对及距离平方，或 undefined 表示不满足条件
     */
    closestPtSegmentSegment(p1x,p1y,p1z,p2x,p2y,p2z,p3x,p3y,p3z,p4x,p4y,p4z,dist2dsq) {
        const gapZ=this.intervalGap(p1z, p2z, p3z, p4z);
        if (gapZ > this.jumpHeight) return;
        const gapX = this.intervalGap(p1x, p2x, p3x, p4x);
        const gapY = this.intervalGap(p1y, p2y, p3y, p4y);

        if (gapX * gapX + gapY * gapY > dist2dsq)return
        // 算法来源：Real-Time Collision Detection (Graham Walsh)
        // 计算线段 S1(p1,p2) 与 S2(p3,p4) 之间最近点
        
        const d1 = { x: p2x - p1x, y: p2y - p1y}; // 忽略 Z 参与平面距离计算
        const d2 = { x: p4x - p3x, y: p4y - p3y};
        const r = { x: p1x - p3x, y: p1y - p3y};

        const a = d1.x * d1.x + d1.y * d1.y; // Squared length of segment S1
        const e = d2.x * d2.x + d2.y * d2.y; // Squared length of segment S2
        const f = d2.x * r.x + d2.y * r.y;

        const EPSILON = 1;

        // 检查线段是否退化成点
        if (a <= EPSILON && e <= EPSILON) {
            // 两个都是点
            return { dist: (p1x - p3x)*(p1x - p3x) + (p1y - p3y)*(p1y - p3y) + (p1z - p3z)*(p1z - p3z), ptA: {x: p1x, y: p1y, z: p1z}, ptB: {x: p3x, y: p3y, z: p3z} };
        }
        
        let s, t;
        if (a <= EPSILON) {
            // S1 是点
            s = 0.0;
            t = f / e;
            t = Math.max(0.0, Math.min(1.0, t));
        } else {
            const c = d1.x * r.x + d1.y * r.y;
            if (e <= EPSILON) {
                // S2 是点
                t = 0.0;
                s = Math.max(0.0, Math.min(1.0, -c / a));
            } else {
                // 常规情况：两条线段
                const b = d1.x * d2.x + d1.y * d2.y;
                const denom = a * e - b * b;

                if (denom !== 0.0) {
                    s = Math.max(0.0, Math.min(1.0, (b * f - c * e) / denom));
                } else {
                    // 平行
                    s = 0.0;
                }

                t = (b * s + f) / e;

                if (t < 0.0) {
                    t = 0.0;
                    s = Math.max(0.0, Math.min(1.0, -c / a));
                } else if (t > 1.0) {
                    t = 1.0;
                    s = Math.max(0.0, Math.min(1.0, (b - c) / a));
                }
            }
        }
        // 计算最近点坐标（包含 Z）
        // 注意：t 和 s 在 XY 平面求得，再应用到 3D 坐标
        const ptA = {
            x: p1x + (p2x - p1x) * s,
            y: p1y + (p2y - p1y) * s,
            z: p1z + (p2z - p1z) * s
        };

        const ptB = {
            x: p3x + (p4x - p3x) * t,
            y: p3y + (p4y - p3y) * t,
            z: p3z + (p4z - p3z) * t
        };
        const heightDiff = Math.abs(ptA.z - ptB.z);
        if (heightDiff > this.jumpHeight) return;

        let dist=(ptA.x - ptB.x)*(ptA.x - ptB.x) + (ptA.y - ptB.y)*(ptA.y - ptB.y);
        if(dist > dist2dsq)return;
        dist+=heightDiff*heightDiff;
        if (heightDiff < 1 && dist < 1) return;
        return {
            dist,
            ptA,
            ptB
        };
    }
    /**
     * 返回当前构建的 NavMeshLink 结构。
     *
     * 若传入 Extlink，先将其追加到当前数组末尾再返回（用于跨 Tile 增量合并）。
     *
     * @param {import("./path_manager").NavMeshLink} [Extlink] - 可选的已有连接，追加到末尾
     * @returns {NavMeshLink}
     */
    return(Extlink) {
        if(Extlink)
        {
            const a = Extlink.length;
            const b = this.length;

            this.poly.set(
                Extlink.poly.subarray(0, a * 2),
                b*2
            );

            this.cost.set(
                Extlink.cost.subarray(0, a),
                b
            );

            this.type.set(
                Extlink.type.subarray(0, a),
                b
            );

            this.pos.set(
                Extlink.pos.subarray(0, a * 6),
                b * 6
            );
            this.length+=a;
        }
        return {
            poly: this.poly,
            pos: this.pos,
            type: this.type,
            cost: this.cost,
            length: this.length
        };
    }
    /**
     * 构建 Tile 内部的所有跳跃连接。
     *
     * 流程：计算连通分量 → 收集边界边 → 建立空间索引 → 收集候选 → 去重筛选 → 返回 NavMeshLink。
     *
     * @returns {NavMeshLink}
     */
    init() {
        // 3) 计算 mesh 连通分量（islandIds），后续用于“同岛且高度可走”过滤。
        this.buildConnectivity();
        // 4) 收集边界边（只在边界边之间寻找 jump 候选）。
        const {boundarylengh,boundaryEdges} = this.collectBoundaryEdges();
        // 5) 为边界边建立空间网格索引，加速近邻边查询。
        const edgeGrid = this.buildEdgeGrid(boundaryEdges,boundarylengh);
        // 6) 收集候选并执行首轮筛选，得到每个 poly 对的最优候选。
        const bestJumpPerPoly = this._collectBestJumpCandidates(boundaryEdges,boundarylengh, edgeGrid);
        // 7) 对候选做收尾去重（pair 去重 + 岛对近距去重），并生成最终 links。
        this._finalizeJumpLinks(bestJumpPerPoly);
        // 9) 返回构建完成的 links。
        return this.return();
    }
    /**
     * 仅构建指定 Tile 与周围 Tile 之间的跨 Tile 跳跃连接。
     *
     * 与 init() 类似，但候选筛选增加 tileid 标记过滤：
     * 仅从中心 Tile (tileid=2) 的边界边出发，目标不能同属中心 Tile。
     *
     * @param {number} boundarylengh - 边界边数量
     * @param {Uint16Array} boundaryEdges - 边界边数组（每 3 个为一组）
     * @param {Uint8Array} tileid - 每个 poly 的 tile 标记（2=中心, 1=邻居）
     * @param {NavMeshLink} Extlink - 已有的跨 Tile 连接，追加到末尾
     * @returns {NavMeshLink}
     */
    initInterTileIn(boundarylengh,boundaryEdges,tileid,Extlink) {
        // 4) 计算 mesh 连通分量。
        this.buildConnectivity(tileid);
        // 5) 收集边界边。
        // 6) 建立边界边空间索引。
        const edgeGrid = this.buildEdgeGrid(boundaryEdges,boundarylengh);
        // 7) 收集候选并筛选：额外过滤“同 tile”pair，只保留跨 tile 候选。
        const bestJumpPerPoly = this._collectBestJumpCandidates(boundaryEdges,boundarylengh,edgeGrid,tileid);
        // 8) 对候选做收尾去重并生成最终 links。
        this._finalizeJumpLinks(bestJumpPerPoly);
        // 10) 返回构建完成的 links。
        return this.return(Extlink);
    }
    /**
     * 遍历所有边界边对，通过空间索引查询近邻边，筛选出每对多边形之间的最优跳跃候选。
     *
     * 过滤条件：同岛排除、AABB 距离剪枝、最近点对距离与高度检查、TraceBox 路径验证。
     * 对同一 poly 对只保留距离最短的候选。
     *
     * @param {Uint16Array} boundaryEdges - 边界边数组
     * @param {number} boundaryLength - 边界边数量
     * @param {{grid: Map<number, number[]>, metas: Float32Array, cellSize: number, count: number}} edgeGrid - 空间索引
     * @param {Uint8Array} [tileid] - 可选 tile 标记，有值时仅从 tileid=2 出发
     * @returns {Map<number,any>} poly 对到最优候选的映射
     */
    _collectBestJumpCandidates(boundaryEdges, boundaryLength, edgeGrid, tileid) {
        // Key: "polyA_polyB", Value: { targetPoly, dist, startPos, endPos }
        const verts = this.mesh.verts;
        const islandIds = this.islandIds;
        const jumpDistSq = this.jumpDist * this.jumpDist;
        const bestJumpPerPoly = new Map();
        const candidateIndices=new Uint16Array(boundaryLength);
        for (let i = 0; i < boundaryLength; i++) {
            const idxA = (i<<1)+i;
            const polyIndexA = boundaryEdges[idxA];
            if(!islandIds[polyIndexA])continue;
            if(tileid&&tileid[polyIndexA]!=2)continue;
            const viA0 = boundaryEdges[idxA + 1]* 3;
            const viA1 = boundaryEdges[idxA + 2]* 3;
            candidateIndices[0]=0;
            this.queryNearbyEdges(edgeGrid, i, this.jumpDist,candidateIndices);
            for(let s=1;s<=candidateIndices[0];s++)
            {
                const j=candidateIndices[s];
                const idxB = (j<<1)+j;
                const polyIndexB = boundaryEdges[idxB];
                if(!islandIds[polyIndexB])continue;
                if(islandIds[polyIndexA] === islandIds[polyIndexB])continue;//同岛内的边界边不考虑构建跳跃链接
                if (polyIndexA === polyIndexB) continue;
                if(tileid&&tileid[polyIndexB]==2)continue;
                if(!tileid)
                {
                    //init()调用，判断多边形是否是邻居
                    if (this.areNeighbors(polyIndexA, polyIndexB)) continue;
                }
                const viB0 = boundaryEdges[idxB + 1]* 3;
                const viB1 = boundaryEdges[idxB + 2]* 3;
                const minBoxDist = this.bboxMinDist2D(edgeGrid.metas,i,j);
                if (minBoxDist > jumpDistSq) continue;
                
                const closestResult = this.closestPtSegmentSegment(
                    verts[viA0], verts[viA0+1], verts[viA0+2],
                    verts[viA1], verts[viA1+1], verts[viA1+2],
                    verts[viB0], verts[viB0+1], verts[viB0+2],
                    verts[viB1], verts[viB1+1], verts[viB1+2],
                    jumpDistSq);
                if (!closestResult) continue;
                //Instance.DebugLine({start:{x:verts[viA0],y:verts[viA0+1],z:verts[viA0+2]+5},
                //    end:{x:verts[viA1],y:verts[viA1+1],z:verts[viA1+2]+5},
                //    duration:5,color:{r:0,g:0,b:255}
                //});
                //Instance.DebugLine({start:{x:verts[viB0],y:verts[viB0+1],z:verts[viB0+2]+5},
                //    end:{x:verts[viB1],y:verts[viB1+1],z:verts[viB1+2]+5},
                //    duration:5,color:{r:0,g:0,b:255}
                //});
                const { dist, ptA, ptB } = closestResult;
                if (!this.validateJumpPath(ptA, ptB)) continue;
                this.updateBestCandidate(bestJumpPerPoly, polyIndexA, polyIndexB, dist, ptA, ptB);
            }
        }
        return bestJumpPerPoly;
    }

    /**
     * 最终连接生成：对候选进行 pair 去重和岛对近距去重，写入 TypedArray。
     *
     * 对每个候选检查已写入的同岛对 link，若起/终点距离 < linkdist 则跳过。
     * 根据高差将 link 标记为 WALK 或 JUMP 类型。
     *
     * @param {Map<number,any>} bestJumpPerPoly - _collectBestJumpCandidates 的输出
     */
    _finalizeJumpLinks(bestJumpPerPoly) {
        const sortedCandidates = Array.from(bestJumpPerPoly.values());
        let linkCount = 0;
        const linkdistsq=this.linkdist*this.linkdist;
        for (const cand of sortedCandidates) {
            // 距离判重，需遍历已写入的link
            let tooClose = false;
            for (let k = 0; k < linkCount; k++) {
                const plIdx = k << 1;
                const exA = this.poly[plIdx];
                const exB = this.poly[plIdx + 1];
                const exIslandA = this.islandIds[exA];
                const exIslandB = this.islandIds[exB];
                const islandA = this.islandIds[cand.startPoly];
                const islandB = this.islandIds[cand.endPoly];
                if ((islandA === exIslandA && islandB === exIslandB) || (islandA === exIslandB && islandB === exIslandA)) {
                    // 距离判重
                    const posIdx = (k << 2) + (k << 1);
                    const exStart = {
                        x: this.pos[posIdx],
                        y: this.pos[posIdx + 1],
                        z: this.pos[posIdx + 2]
                    };
                    const exEnd = {
                        x: this.pos[posIdx + 3],
                        y: this.pos[posIdx + 4],
                        z: this.pos[posIdx + 5]
                    };
                    const dSqStart = vec.lengthsq(cand.startPos, exStart);
                    const dSqEnd = vec.lengthsq(cand.endPos, exEnd);
                    if (dSqStart < linkdistsq || dSqEnd < linkdistsq) {
                        tooClose = true;
                        break;
                    }
                }
            }
            if (tooClose) continue;
            // 写入TypedArray
            const pid=linkCount<<1;
            this.poly[pid] = cand.startPoly;
            this.poly[pid + 1] = cand.endPoly;
            const posIdx = (linkCount << 2) + (linkCount << 1);
            this.pos[posIdx] = cand.startPos.x;
            this.pos[posIdx + 1] = cand.startPos.y;
            this.pos[posIdx + 2] = cand.startPos.z;
            this.pos[posIdx + 3] = cand.endPos.x;
            this.pos[posIdx + 4] = cand.endPos.y;
            this.pos[posIdx + 5] = cand.endPos.z;
            this.cost[linkCount] = cand.dist * 1.5;
            this.type[linkCount] = (Math.abs(cand.startPos.z - cand.endPos.z) <= this.walkHeight ? PathState$1.WALK : PathState$1.JUMP);
            linkCount++;
        }
        this.length = linkCount;
    }
    /**
     * BFS 计算多边形网格的连通分量，将结果写入 this.islandIds。
     *
     * 互相连通的多边形获得相同的区域 ID，后续筛选时同岛 poly 对将被跳过。
     * 若传入 tileid，只对 tileid[i] != 0 的多边形计算连通性。
     *
     * @param {Uint8Array} [tileid] - 可选的 tile 标记数组
     */
    buildConnectivity(tileid) {
        const numPolys = this.mesh.polyslength;
        this.islandIds = new Int16Array(numPolys);
        let currentId = 1;
        // 用TypedArray实现队列
        const queue = new Uint16Array(numPolys);
        for (let i = 0; i < numPolys; i++) {
            if (this.islandIds[i]) continue;
            if(tileid&&!tileid[i])continue;
            currentId++;
            let head = 0, tail = 0;
            queue[tail++] = i;
            this.islandIds[i] = currentId;
            while (head < tail) {
                let u = queue[head++];
                const neighbors = this.mesh.neighbors[u];
                // 获取该多边形的边数
                u<<=1;
                const startVert = this.mesh.polys[u];
                const endVert = this.mesh.polys[u + 1];
                const edgeCount = endVert - startVert + 1;
                for (let j = 0; j < edgeCount; j++) {
                    const entry = neighbors[j];
                    if (entry[0] == 0) continue;
                    for (let k = 1; k <= entry[0]; k++) {
                        const v = entry[k];
                        if (!this.islandIds[v]) {
                            this.islandIds[v] = currentId;
                            queue[tail++] = v;
                        }
                    }
                }
            }
        }
        //Instance.Msg(`共有${currentId-1}个独立行走区域`);
    }

    /**
     * 为边界边构建空间网格索引，加速近邻边查询。
     *
     * 每条边的 XY AABB 存入 metas（Float32Array），
     * 按 cellSize=jumpDist 分网格存入 grid Map。
     *
     * @param {Uint16Array} edges - 边界边数组（每 3 个为一组）
     * @param {number} count - 边界边数量
     * @returns {{grid: Map<number, number[]>, metas: Float32Array, cellSize: number, count: number}}
     */
    buildEdgeGrid(edges, count) {
        const cellSize = this.jumpDist;
        const grid = new Map();
        const metas = new Float32Array(count << 2);
        for (let i = 0; i < count; i++) {
            const idx = (i<<1)+i;
            // const polyIndex = edges[idx]; // 未用
            const vi0 = edges[idx + 1]*3;
            const vi1 = edges[idx + 2]*3;
            const x0 = this.mesh.verts[vi0], y0 = this.mesh.verts[vi0 + 1];
            const x1 = this.mesh.verts[vi1], y1 = this.mesh.verts[vi1 + 1];
            const minX = Math.min(x0, x1);
            const maxX = Math.max(x0, x1);
            const minY = Math.min(y0, y1);
            const maxY = Math.max(y0, y1);
            const metaIdx = i << 2;
            metas[metaIdx] = minX;
            metas[metaIdx + 1] = maxX;
            metas[metaIdx + 2] = minY;
            metas[metaIdx + 3] = maxY;
            const gridX0 = Math.floor(minX / cellSize);
            const gridX1 = Math.floor(maxX / cellSize);
            const gridY0 = Math.floor(minY / cellSize);
            const gridY1 = Math.floor(maxY / cellSize);
            for (let x = gridX0; x <= gridX1; x++) {
                for (let y = gridY0; y <= gridY1; y++) {
                    const k = (y << 16) | x;
                    if(!grid.has(k)) grid.set(k, []);
                    grid.get(k).push(i);
                }
            }
        }
        return { grid, metas, cellSize,count};
    }

    /**
     * 在空间索引中查询指定边的近邻边，结果写入 result 数组。
     *
     * result[0] 用作计数器，查询范围为边的 AABB 向外扩展 expand 距离。
     *
     * @param {{grid: Map<number, number[]>, metas: Float32Array, cellSize: number, count: number}} edgeGrid - 空间索引
     * @param {number} edgeIndex - 当前边索引
     * @param {number} expand - 扩展距离
     * @param {Uint16Array} result - 输出数组，result[0]=数量，result[1..]=索引
     */
    queryNearbyEdges(edgeGrid, edgeIndex, expand, result) {
        edgeIndex <<=2;
        const x0 = Math.floor((edgeGrid.metas[edgeIndex] - expand) / edgeGrid.cellSize);
        const x1 = Math.floor((edgeGrid.metas[edgeIndex + 1] + expand) / edgeGrid.cellSize);
        const y0 = Math.floor((edgeGrid.metas[edgeIndex + 2] - expand) / edgeGrid.cellSize);
        const y1 = Math.floor((edgeGrid.metas[edgeIndex + 3] + expand) / edgeGrid.cellSize);
        /**@type {Uint8Array} */
        const seen = new Uint8Array(edgeGrid.count);
        for (let x = x0; x <= x1; x++) {
            for (let y = y0; y <= y1; y++) {
                const k = (y << 16) | x;
                const list = edgeGrid.grid.get(k);
                if (!list) continue;
                for (const idx of list) {
                    if (seen[idx]) continue;
                    seen[idx] = 1;
                    result[++result[0]] = idx;
                }
            }
        }
        return;
    }

    /**
     * 计算两条边界边 AABB 在 2D 平面上的最小距离平方，用于快速剪枝。
     *
     * @param {Float32Array} metas - 边界边 AABB 元数据
     * @param {number} idxA - 第一条边索引
     * @param {number} idxB - 第二条边索引
     * @returns {number} 2D AABB 最小距离平方
     */
    bboxMinDist2D(metas, idxA, idxB) {
        idxA<<=2;
        idxB<<=2;
        return vec.length2Dsq({x:Math.max(0, Math.max(metas[idxA], metas[idxB]) - Math.min(metas[idxA + 1], metas[idxB + 1])),y:Math.max(0, Math.max(metas[idxA + 2], metas[idxB + 2]) - Math.min(metas[idxA + 3], metas[idxB + 3])),z:0});
    }

    /**
     * 通过 TraceBox 验证跳跃路径的可行性。
     *
     * 分 6 条射线模拟“升-平移-降”的抛物线路径（正向 + 反向），
     * 任一条线碎于障碍则判定不可跳跃。
     *
     * @param {Vector} a - 起点
     * @param {Vector} b - 终点
     * @returns {boolean} true 表示路径无障碍可跳跃
     */
    validateJumpPath(a, b) {
        const z=Math.max(a.z, b.z)+8;

        const start = { x: a.x, y: a.y, z: 8 };
        const end = { x: b.x, y: b.y, z: 8 };

        const boxMins = { x: -1, y: -1, z: 0 };
        const boxMaxs = { x: 1, y: 1, z: 1 };
        const hit = Instance.TraceBox({
            mins: boxMins,
            maxs: boxMaxs,
            start:vec.Zfly(start,z),
            end:vec.Zfly(end,z),
            ignorePlayers: true
        });
        if (hit && hit.didHit) return false;
        const hitup = Instance.TraceBox({
            mins: boxMins,
            maxs: boxMaxs,
            start:vec.Zfly(start,a.z),
            end:vec.Zfly(start,z),
            ignorePlayers: true
        });
        if (hitup && hitup.didHit) return false;
        const hitdown = Instance.TraceBox({
            mins: boxMins,
            maxs: boxMaxs,
            start:vec.Zfly(end,z),
            end:vec.Zfly(end,b.z),
            ignorePlayers: true
        });
        if (hitdown && hitdown.didHit) return false;

        const hitReverse = Instance.TraceBox({
            mins: boxMins,
            maxs: boxMaxs,
            start: vec.Zfly(end,z),
            end: vec.Zfly(start,z),
            ignorePlayers: true
        });
        if (hitReverse && hitReverse.didHit) return false;
        const hitupReverse = Instance.TraceBox({
            mins: boxMins,
            maxs: boxMaxs,
            start:vec.Zfly(end,b.z),
            end:vec.Zfly(end,z),
            ignorePlayers: true
        });
        if (hitupReverse && hitupReverse.didHit) return false;
        const hitdownReverse = Instance.TraceBox({
            mins: boxMins,
            maxs: boxMaxs,
            start:vec.Zfly(start,z),
            end:vec.Zfly(start,a.z),
            ignorePlayers: true
        });
        if (hitdownReverse && hitdownReverse.didHit) return false;
        return true;
    }
    /**
     * 更新 poly 对的最优跳跃候选：若新候选距离更短则替换。
     *
     * key 为 (idxA << 16) | idxB，保证每对多边形只保留一个最优候选。
     *
     * @param {Map<number,any>} map - poly 对到候选的映射
     * @param {number} idxA - 起始多边形索引
     * @param {number} idxB - 目标多边形索引
     * @param {number} dist - 距离平方
     * @param {Vector} ptA - 起点
     * @param {Vector} ptB - 终点
     */
    updateBestCandidate(map, idxA, idxB, dist, ptA, ptB) {
        // 检查是否已记录过该多边形对的跳跃目标
        const key = (idxA << 16) | idxB;

        const existing = map.get(key);
        // 若未记录或发现更近目标，则更新
        if (!existing || dist < existing.dist) {
            map.set(key, {
                startPoly: idxA,
                endPoly: idxB,
                dist: dist,
                startPos: { ...ptA },
                endPos: { ...ptB }
            });
        }
    }
    /**
     * 调试绘制所有跳跃连接（线段 + 多边形边界）。
     *
     * WALK 类型显示为绿色，JUMP 类型显示为蓝色，多边形边界显示为品红色。
     *
     * @param {number} [duration=10] - 绘制持续时间（秒）
     */
    debugDraw(duration = 10) {
        // 支持TypedArray结构
        Instance.Msg("debug");
        const { poly, pos, type, length } = this;
        const mesh = this.mesh;
        for (let i = 0; i < length; i++) {
            const polyA = poly[i * 2];
            const polyB = poly[i * 2 + 1];
            const t = type[i];
            const start = {
                x: pos[i * 6],
                y: pos[i * 6 + 1],
                z: pos[i * 6 + 2]
            };
            const end = {
                x: pos[i * 6 + 3],
                y: pos[i * 6 + 4],
                z: pos[i * 6 + 5]
            };
            Instance.DebugLine({
                start,
                end,
                color: { r: 0, g: (t === 1 ? 255 : 0), b: 255 },
                duration
            });
            // 可选：画起点终点球体
            // Instance.DebugSphere({ center: start, radius: 4, color: { r: 0, g: 255, b: 0 }, duration });
            // Instance.DebugSphere({ center: end, radius: 4, color: { r: 255, g: 0, b: 0 }, duration });
            // 绘制PolyB边界
            if (mesh && mesh.polys && mesh.verts) {
                const startVertB = mesh.polys[polyB * 2];
                const endVertB = mesh.polys[polyB * 2 + 1];
                const vertCountB = endVertB - startVertB+1;
                for (let j = 0; j < vertCountB; j++) {
                    const vi0 = startVertB + j;
                    const vi1 = startVertB + ((j + 1) % vertCountB);
                    const v0 = {
                        x: mesh.verts[vi0 * 3],
                        y: mesh.verts[vi0 * 3 + 1],
                        z: mesh.verts[vi0 * 3 + 2]
                    };
                    const v1 = {
                        x: mesh.verts[vi1 * 3],
                        y: mesh.verts[vi1 * 3 + 1],
                        z: mesh.verts[vi1 * 3 + 2]
                    };
                    Instance.DebugLine({ start: v0, end: v1, color: { r: 255, g: 0, b: 255 }, duration });
                }
                // 绘制PolyA边界
                const startVertA = mesh.polys[polyA * 2];
                const endVertA = mesh.polys[polyA * 2 + 1];
                const vertCountA = endVertA - startVertA + 1;
                for (let j = 0; j < vertCountA; j++) {
                    const vi0 = startVertA + j;
                    const vi1 = startVertA + ((j + 1) % vertCountA);
                    const v0 = {
                        x: mesh.verts[vi0 * 3],
                        y: mesh.verts[vi0 * 3 + 1],
                        z: mesh.verts[vi0 * 3 + 2]
                    };
                    const v1 = {
                        x: mesh.verts[vi1 * 3],
                        y: mesh.verts[vi1 * 3 + 1],
                        z: mesh.verts[vi1 * 3 + 2]
                    };
                    Instance.DebugLine({ start: v0, end: v1, color: { r: 255, g: 0, b: 255 }, duration });
                }
            }
        }
    }
}

/**
 * @module 导航网格/瓦片
 */

/** @typedef {import("./path_manager").NavMeshMesh} NavMeshMesh */
/** @typedef {import("./path_manager").NavMeshDetail} NavMeshDetail */
/** @typedef {import("./path_manager").NavMeshLink} NavMeshLink */

/**
 * 单 Tile 构建编排器。
 *
 * 编排整个构建管线：
 * OpenHeightfield → RegionGenerator → ContourBuilder
 * → PolyMeshBuilder → PolyMeshDetailBuilder → JumpLinkBuilder。
 * 返回 TileData，由 TileManager 负责跨 Tile 聚合。
 *
 * @navigationTitle Tile 构建器
 */
class tile {
    constructor() {
        /** @type {OpenHeightfield | undefined} 当前 Tile 的开放高度场 */
        this.hf = undefined;
        /** @type {RegionGenerator | undefined} 区域生成器 */
        this.regionGen = undefined;
        /** @type {ContourBuilder | undefined} 轮廓构建器 */
        this.contourBuilder = undefined;
        /** @type {PolyMeshBuilder | undefined} 多边形网格构建器 */
        this.polyMeshGenerator = undefined;
        /** @type {PolyMeshDetailBuilder | undefined} 细节网格构建器 */
        this.polidetail = undefined;
        /** @type {JumpLinkBuilder | undefined} 跳跃链接构建器 */
        this.jumplinkbuilder = undefined;
        /** @type {number} 边界体素填充宽度 */
        this.tilePadding = Math.max(0, TILE_PADDING | 0);
        /** @type {number} Tile 核心区大小（不含 padding） */
        this.tileSize = Math.max(1, TILE_SIZE | 0);
        /** @type {number} 全局网格一边的体素数 */
        this.fullGrid = Math.floor(MESH_WORLD_SIZE_XY / MESH_CELL_SIZE_XY) + 1;
        /** @type {number} X 方向 Tile 总数 */
        this.tilesX = Math.ceil(this.fullGrid / this.tileSize);
        /** @type {number} Y 方向 Tile 总数 */
        this.tilesY = Math.ceil(this.fullGrid / this.tileSize);
    }
    /**
     * 根据世界坐标获取其所在 Tile 的 ID 字符串。
     * @param {{x:number,y:number,z:number}} pos - 世界坐标
     * @returns {string} 格式为 "tx_ty" 的 Tile ID
     */
    fromPosGetTile(pos) {
        const gx = Math.max(0, Math.min(this.fullGrid - 1, Math.floor((pos.x - origin.x) / MESH_CELL_SIZE_XY)));
        const gy = Math.max(0, Math.min(this.fullGrid - 1, Math.floor((pos.y - origin.y) / MESH_CELL_SIZE_XY)));
        const tx = Math.max(0, Math.min(this.tilesX - 1, Math.floor(gx / this.tileSize)));
        const ty = Math.max(0, Math.min(this.tilesY - 1, Math.floor(gy / this.tileSize)));
        return `${tx}_${ty}`;
    }
    /**
     * 仅构建给定世界坐标所在的 Tile。
     * @param {{x:number,y:number,z:number}} pos - 世界坐标
     * @returns {import("./path_tilemanager").TileData} 构建结果
     */
    buildTileNavMeshAtPos(pos) {
        const gx = Math.max(0, Math.min(this.fullGrid - 1, Math.floor((pos.x - origin.x) / MESH_CELL_SIZE_XY)));
        const gy = Math.max(0, Math.min(this.fullGrid - 1, Math.floor((pos.y - origin.y) / MESH_CELL_SIZE_XY)));
        const tx = Math.max(0, Math.min(this.tilesX - 1, Math.floor(gx / this.tileSize)));
        const ty = Math.max(0, Math.min(this.tilesY - 1, Math.floor(gy / this.tileSize)));
        return this.buildTile(tx, ty);
    }

    /**
     * 构建指定坐标的单个 Tile，执行完整的构建管线。
     *
     * 流程：体素化 → 区域生成 → 轮廓提取 → 多边形构建 → 细节网格 → 跳跃链接。
     * @param {number} tx - Tile X 坐标
     * @param {number} ty - Tile Y 坐标
     * @returns {any} 构建结果，包含 mesh/detail/links 和计时信息
     */
    buildTile(tx, ty) {
        const nowMs = () => new Date().getTime();
        const timing = {hfInit: 0,region: 0,contour: 0,poly: 0,detail: 0,merge: 0,jumpLinks: 0,};

        let tileHasError = false;
        const tileStartMs = nowMs();
        Instance.Msg(`开始构建 Tile (${tx+1}/${this.tilesX},${ty+1}/${this.tilesY})`);
        let phaseStartMs = nowMs();

        this.hf = new OpenHeightfield(tx, ty, this.tileSize, this.fullGrid, this.tilePadding);
        this.hf.init();
        timing.hfInit += nowMs() - phaseStartMs;
        phaseStartMs = nowMs();

        this.regionGen = new RegionGenerator(this.hf);
        this.regionGen.init();
        timing.region += nowMs() - phaseStartMs;
        phaseStartMs = nowMs();

        this.contourBuilder = new ContourBuilder(this.hf);
        this.contourBuilder.init();

        if (this.contourBuilder.error) tileHasError = true;
        timing.contour += nowMs() - phaseStartMs;
        phaseStartMs = nowMs();

        this.polyMeshGenerator = new PolyMeshBuilder(this.contourBuilder.contours);
        this.polyMeshGenerator.init();

        const tileMesh = this.polyMeshGenerator.return();
        if (this.polyMeshGenerator.error) tileHasError = true;
        timing.poly += nowMs() - phaseStartMs;
        //if (POLY_DEBUG) {
        //    this.polyMeshGenerator.debugDrawPolys(tileDebugDuration);
        //    this.polyMeshGenerator.debugDrawAdjacency(tileDebugDuration);
        //}

        phaseStartMs = nowMs();

        this.polidetail = new PolyMeshDetailBuilder(tileMesh, this.hf);
        /** @type {NavMeshDetail} */
        let tileDetail = this.polidetail.init();
        //if(POLY_DETAIL_DEBUG)
        //{
        //    this.polidetail.debugDrawPolys(tileDebugDuration);
        //}
        if (this.polidetail.error) tileHasError = true;
        timing.detail += nowMs() - phaseStartMs;

        phaseStartMs = nowMs();
        this.jumplinkbuilder = new JumpLinkBuilder(tileMesh);
        /**
         * @type {NavMeshLink}
         */
        let tileLinks = this.jumplinkbuilder.init();
        //if(LINK_DEBUG)
        //{
           // this.jumplinkbuilder.debugDraw(tileDebugDuration);
        //}
        timing.jumpLinks += nowMs() - phaseStartMs;

        OpenSpan.clearRange(1, this.hf.SPAN_ID + 2);
        const tileCostMs = nowMs() - tileStartMs;
        Instance.Msg(`完成 Tile (${tx+1}/${this.tilesX},${ty+1}/${this.tilesY}),耗时${tileCostMs}ms`);

        return {tileId: `${tx}_${ty}`,tx,ty,mesh: tileMesh,detail: tileDetail,links: tileLinks,hasError: tileHasError,timing};
    }

    /**
     * 调试绘制报错的 Tile 边界框。
     * @param {{tx:number,ty:number}[]} tiles - 报错的 Tile 坐标列表
     * @param {number} [duration=120] - 绘制持续时间（秒）
     */
    debugDrawErrorTiles(tiles, duration = 120) {
        if (!tiles || tiles.length === 0) return;
        const color = { r: 255, g: 255, b: 255 };

        for (const tile of tiles) {
            const coreMinX = tile.tx * this.tileSize;
            const coreMinY = tile.ty * this.tileSize;
            const coreMaxX = Math.min(this.fullGrid - 1, coreMinX + this.tileSize - 1);
            const coreMaxY = Math.min(this.fullGrid - 1, coreMinY + this.tileSize - 1);

            const minX = origin.x + coreMinX * MESH_CELL_SIZE_XY;
            const minY = origin.y + coreMinY * MESH_CELL_SIZE_XY;
            const maxX = origin.x + (coreMaxX + 1) * MESH_CELL_SIZE_XY;
            const maxY = origin.y + (coreMaxY + 1) * MESH_CELL_SIZE_XY;

            const z0 = origin.z + 8;
            const z1 = origin.z + 500;

            const a0 = { x: minX, y: minY, z: z0 };
            const b0 = { x: maxX, y: minY, z: z0 };
            const c0 = { x: maxX, y: maxY, z: z0 };
            const d0 = { x: minX, y: maxY, z: z0 };
            const a1 = { x: minX, y: minY, z: z1 };
            const b1 = { x: maxX, y: minY, z: z1 };
            const c1 = { x: maxX, y: maxY, z: z1 };
            const d1 = { x: minX, y: maxY, z: z1 };

            Instance.DebugLine({ start: a0, end: b0, color, duration });
            Instance.DebugLine({ start: b0, end: c0, color, duration });
            Instance.DebugLine({ start: c0, end: d0, color, duration });
            Instance.DebugLine({ start: d0, end: a0, color, duration });

            Instance.DebugLine({ start: a1, end: b1, color, duration });
            Instance.DebugLine({ start: b1, end: c1, color, duration });
            Instance.DebugLine({ start: c1, end: d1, color, duration });
            Instance.DebugLine({ start: d1, end: a1, color, duration });

            Instance.DebugLine({ start: a0, end: a1, color, duration });
            Instance.DebugLine({ start: b0, end: b1, color, duration });
            Instance.DebugLine({ start: c0, end: c1, color, duration });
            Instance.DebugLine({ start: d0, end: d1, color, duration });

            Instance.DebugLine({ start: a1, end: c1, color, duration });
            Instance.DebugLine({ start: b1, end: d1, color, duration });
        }
    }

}

/**
 * @module 导航网格/导航调试
 */

/**
 * NavMesh 调试工具集。
 *
 * 在游戏中绘制 Debug 几何体（线条、球体）展示 NavMesh 各组件：
 * - MESH：体素化/网格化
 * - REGION：区域分割
 * - CONTOUR：轮廓构建
 * - POLY：多边形生成
 * - DETAIL：细节层三角网
 * - LINK：连接构建
 * - PATH：路径生成与输出
 *
 * @navigationTitle NavMesh 调试工具
 */
class NavMeshDebugTools {
    /**
     * 初始化调试工具，绑定 NavMesh 实例。
     * @param {import("./path_manager").NavMesh} nav
     */
    constructor(nav) {
        /** @type {import("./path_manager").NavMesh} */
        this.nav = nav;
        /** @type {number[]} */
        this._polyAreas = [];
        /** @type {number[]} */
        this._polyPrefix = [];
        /** @type {number} */
        this._totalPolyArea = 0;
    }
    /**
     * 绘制 detail 层三角形（用于调试 detail 网格）。
     * 期望 detail 使用 TypedArray 布局：`verts` 为 Float32Array，`tris` 为 Uint16Array，
     * 并存在 `trislength` / `vertslength` 等计数字段。
     * @param {number} [duration]
     */
    debugDrawMeshDetail(duration = 10) {
        const detail = this.nav.meshdetail;
        if (!detail) return;
        // TypedArray 结构：detail.verts 为 Float32Array，detail.tris 为 Uint16Array，并存在 trislength/vertslength
        for (let i = 0; i < detail.trislength; i++) {
            const ia = detail.tris[i * 3];
            const ib = detail.tris[i * 3 + 1];
            const ic = detail.tris[i * 3 + 2];
            const va = {
                x: detail.verts[ia * 3],
                y: detail.verts[ia * 3 + 1],
                z: detail.verts[ia * 3 + 2]
            };
            const vb = {
                x: detail.verts[ib * 3],
                y: detail.verts[ib * 3 + 1],
                z: detail.verts[ib * 3 + 2]
            };
            const vc = {
                x: detail.verts[ic * 3],
                y: detail.verts[ic * 3 + 1],
                z: detail.verts[ic * 3 + 2]
            };
            const color = { r: 0, g: 180, b: 255 };
            Instance.DebugLine({ start: va, end: vb, color, duration });
            Instance.DebugLine({ start: vb, end: vc, color, duration });
            Instance.DebugLine({ start: vc, end: va, color, duration });
        }
        return;
    }
    /**
     * 绘制所有特殊连接点（跳点/梯子/传送门）。
     *
     * 用不同颜色区分类型：青色=跳点，橙色=梯子，蓝色=传送门。
     *
     * @param {number} [duration] 绘制持续时间（秒）
     */
    debugLinks(duration = 30) {
        const links = this.nav.links;
        const mesh = this.nav.mesh;
        if (!links || !mesh || !mesh.polys || !mesh.verts) return;

        for (let li = 0; li < links.length; li++) {
            const type = links.type[li];
            const isJump = type === PathState$1.JUMP;
            const isLadder = type === PathState$1.LADDER;
            const lineColor = isLadder
                ? { r: 255, g: 165, b: 0 }
                : (isJump ? { r: 0, g: 255, b: 255 } : { r: 0, g: 0, b: 255 });
            const startColor = isLadder
                ? { r: 255, g: 215, b: 0 }
                : (isJump ? { r: 0, g: 255, b: 255 } : { r: 0, g: 255, b: 0 });

            const posBase = li * 6;
            const start = {
                x: links.pos[posBase],
                y: links.pos[posBase + 1],
                z: links.pos[posBase + 2]
            };
            const end = {
                x: links.pos[posBase + 3],
                y: links.pos[posBase + 4],
                z: links.pos[posBase + 5]
            };

            Instance.DebugLine({ start, end, color: lineColor, duration });
            Instance.DebugSphere({ center: start, radius: 4, color: startColor, duration });

            const pi = links.poly[(li << 1) + 1];
            if (pi < 0 || pi >= mesh.polyslength) continue;

            const startVert = mesh.polys[pi * 2];
            const endVert = mesh.polys[pi * 2 + 1];
            const vertCount = endVert - startVert + 1;
            for (let i = 0; i < vertCount; i++) {
                const vi0 = startVert + i;
                const vi1 = startVert + ((i + 1) % vertCount);
                const v0 = { x: mesh.verts[vi0 * 3], y: mesh.verts[vi0 * 3 + 1], z: mesh.verts[vi0 * 3 + 2] };
                const v1 = { x: mesh.verts[vi1 * 3], y: mesh.verts[vi1 * 3 + 1], z: mesh.verts[vi1 * 3 + 2] };
                Instance.DebugLine({ start: v0, end: v1, color: isLadder ? { r: 255, g: 140, b: 0 } : { r: 255, g: 0, b: 255 }, duration });
            }
        }
    }
    /**
     * 绘制所有多边形（不展示 links），用于检查多边形边界。
     * @param {number} duration
     */
    debugDrawMeshPolys(duration = 10) {
        if (!this.nav.mesh) return;
        const mesh = this.nav.mesh;
        for (let pi = 0; pi < mesh.polyslength; pi++) {
            const startVert = mesh.polys[pi * 2];
            const endVert = mesh.polys[pi * 2 + 1];
            const vertCount = endVert - startVert + 1;
            if (vertCount < 3) continue;
            const color = { r: 255, g: 0, b: 0 };
            for (let i = 0; i < vertCount; i++) {
                const vi0 = startVert + i;
                const vi1 = startVert + ((i + 1) % vertCount);
                const v0 = { x: mesh.verts[vi0 * 3], y: mesh.verts[vi0 * 3 + 1], z: mesh.verts[vi0 * 3 + 2] };
                const v1 = { x: mesh.verts[vi1 * 3], y: mesh.verts[vi1 * 3 + 1], z: mesh.verts[vi1 * 3 + 2] };
                Instance.DebugLine({ start: v0, end: v1, color, duration });
            }
        }
    }

    /**
     * 绘制网格连通关系（多边形邻接），用于调试跨 tile 的边界匹配。
     * 直接读取 `this.nav.mesh.neighbors` 结构并绘制连接线。
     * @param {number} [duration]
     */
    debugDrawMeshConnectivity(duration = 15) {
        if (!this.nav.mesh) return;
        const mesh = this.nav.mesh;
        const drawn = new Set();
        for (let i = 0; i < mesh.polyslength; i++) {
            const start = this._meshPolyCenter(i);
            const pstart=this.nav.mesh.polys[i*2];
            const pend=this.nav.mesh.polys[i*2+1];
            const ecount=pend-pstart+1;
            for (let e = 0; e < ecount; e++) {
                const edgeNei = mesh.neighbors[i][e][0];
                if(edgeNei==0)continue;
                for(let j=1;j<=edgeNei;j++)
                {
                    const ni=mesh.neighbors[i][e][j];
                    const a = Math.min(i, ni);
                    const b = Math.max(i, ni);
                    const k = `${a}|${b}`;
                    if (drawn.has(k)) continue;
                    drawn.add(k);

                    const end = this._meshPolyCenter(ni);
                    Instance.DebugLine({
                        start,
                        end,
                        color: { r: 255, g: 0, b: 255 },
                        duration
                    });
                }
            }
        }
    }

    /**
     * 计算指定多边形的几何中心（用于调试绘制）。
     * 适配 TypedArray 布局，返回 {x,y,z}。
     * @param {number} polyIndex
     */
    _meshPolyCenter(polyIndex) {
        const mesh = this.nav.mesh;
        const startVert = mesh.polys[polyIndex * 2];
        const endVert = mesh.polys[polyIndex * 2 + 1];
        const vertCount = endVert - startVert + 1;
        if (vertCount <= 0) return { x: 0, y: 0, z: 0 };
        let x = 0, y = 0, z = 0;
        for (let vi = startVert; vi <= endVert; vi++) {
            x += mesh.verts[vi * 3];
            y += mesh.verts[vi * 3 + 1];
            z += mesh.verts[vi * 3 + 2];
        }
        return { x: x / vertCount, y: y / vertCount, z: z / vertCount };
    }

    /**
     * 绘制 Funnel 生成的路径（用于调试 funnel 算法）。
     * @param {{pos:{x:number,y:number,z:number},mode:number}[]} path
     * @param {number} [duration]
     */
    debugDrawfunnelPath(path, duration = 10) {
        if (!path || path.length < 2) {
            Instance.Msg("No path to draw");
            return;
        }
        const color = { r: 0, g: 255, b: 0 };
        const colorJ = { r: 0, g: 255, b: 255 };

        const last = path[0].pos;
        Instance.DebugSphere({ center: { x: last.x, y: last.y, z: last.z }, radius: 3, color: { r: 255, g: 0, b: 0 }, duration });
        for (let i = 1; i < path.length; i++) {
            const a = path[i - 1].pos;
            const b = path[i].pos;
            Instance.DebugLine({
                start: { x: a.x, y: a.y, z: a.z },
                end: { x: b.x, y: b.y, z: b.z },
                color: path[i].mode == PathState$1.WALK ? color:colorJ,
                duration
            });
            Instance.DebugSphere({ center: { x: b.x, y: b.y, z: b.z }, radius: 3, color: path[i].mode == PathState$1.WALK ? color:colorJ, duration });
        }
    }

    /**
     * 绘制路径（包含不同模式的颜色区分，例如行走/跳跃/梯子）。
     * @param {{pos:{x:number,y:number,z:number},mode:number}[]} path
     * @param {number} [duration]
     */
    debugDrawPath(path, duration = 10) {
        const color = { r: 0, g: 0, b: 255 };
        const colorJ = { r: 255, g: 255, b: 0 };
        if (!path || path.length == 2) {
            if (path && path.length == 2) {
                Instance.DebugSphere({ center: { x: path[0].pos.x, y: path[0].pos.y, z: path[0].pos.z }, radius: 3, color: { r: 0, g: 0, b: 255 }, duration });
                Instance.DebugLine({
                    start: { x: path[0].pos.x, y: path[0].pos.y, z: path[0].pos.z },
                    end: { x: path[1].pos.x, y: path[1].pos.y, z: path[1].pos.z },
                    color: path[1].mode == PathState$1.WALK ? color:colorJ,
                    duration
                });
                Instance.DebugSphere({ center: { x: path[1].pos.x, y: path[1].pos.y, z: path[1].pos.z }, radius: 3, color: path[1].mode == PathState$1.WALK ? color:colorJ, duration });
            } else Instance.Msg("No path to draw");
            return;
        }

        const last = path[0].pos;
        Instance.DebugSphere({ center: { x: last.x, y: last.y, z: last.z }, radius: 3, color: { r: 0, g: 0, b: 255 }, duration });
        for (let i = 1; i < path.length; i++) {
            const a = path[i - 1].pos;
            const b = path[i].pos;
            Instance.DebugLine({
                start: { x: a.x, y: a.y, z: a.z },
                end: { x: b.x, y: b.y, z: b.z },
                color: path[i].mode == PathState$1.WALK ? color:colorJ,
                duration
            });
            Instance.DebugSphere({ center: { x: b.x, y: b.y, z: b.z }, radius: 3, color: path[i].mode == PathState$1.WALK ? color:colorJ, duration });
        }
    }

    /**
     * 绘制多边形序列路径（A* 输出）。
     *
     * 用随机颜色绘制多边形中心连线，区分行走和跳跃模式。
     *
     * @param {{id:number,mode:number}[]} polyPath 多边形序列
     * @param {number} [duration] 绘制持续时间
     */
    debugDrawPolyPath(polyPath, duration = 10) {
        if (!polyPath || polyPath.length === 0 || !this.nav.mesh) return;
        const mesh = this.nav.mesh;
        let prev = null;
        // 避免重复绘制相同路径段或中心点
        const color = {
            r: Math.floor(100 + Math.random() * 155),
            g: Math.floor(100 + Math.random() * 155),
            b: Math.floor(100 + Math.random() * 155),
        };
        const colorJ = {
            r: Math.floor(100 + Math.random() * 155),
            g: Math.floor(100 + Math.random() * 155),
            b: Math.floor(100 + Math.random() * 155),
        };
        for (const pi of polyPath) {
            // 适配 TypedArray 布局：mesh.polys 存为 start/end 对，mesh.verts 为扁平 Float32Array
            const polyIndex = pi.id;
            const startVert = mesh.polys[polyIndex * 2];
            const endVert = mesh.polys[polyIndex * 2 + 1];
            const vertCount = endVert - startVert + 1;
            if (vertCount < 3) continue;
            let cx = 0, cy = 0, cz = 0;
            for (let vi = startVert; vi <= endVert; vi++) {
                cx += mesh.verts[vi * 3];
                cy += mesh.verts[vi * 3 + 1];
                cz += mesh.verts[vi * 3 + 2];
            }
            cx /= vertCount;
            cy /= vertCount;
            cz /= vertCount;
            const center = { x: cx, y: cy, z: cz };
            if (pi.mode == 2) {
                Instance.DebugSphere({ center, radius: 10, color: colorJ, duration });
                if (prev) Instance.DebugLine({ start: prev, end: center, color: colorJ, duration });
            } else {
                Instance.DebugSphere({ center, radius: 10, color, duration });
                if (prev) Instance.DebugLine({ start: prev, end: center, color, duration });
            }
            prev = center;
        }
    }
    /**
     * 绘制所有 Tile 的边界线框。
     *
     * @param {number} duration 绘制持续时间（秒）
     */
    debugDrawALLTiles(duration = 120) {
        const color = { r: 255, g: 255, b: 255 };
        const fullGrid=Math.floor(MESH_WORLD_SIZE_XY / MESH_CELL_SIZE_XY) + 1;
        const tiles=Math.ceil(fullGrid / TILE_SIZE);
        for (let ty = 0; ty < tiles; ty++) {
            for (let tx = 0; tx < tiles; tx++) {
                const coreMinX = tx * TILE_SIZE;
                const coreMinY = ty * TILE_SIZE;
                const coreMaxX = Math.min(fullGrid - 1, coreMinX + TILE_SIZE - 1);
                const coreMaxY = Math.min(fullGrid - 1, coreMinY + TILE_SIZE - 1);

                const minX = origin.x + coreMinX * MESH_CELL_SIZE_XY;
                const minY = origin.y + coreMinY * MESH_CELL_SIZE_XY;
                const maxX = origin.x + (coreMaxX + 1) * MESH_CELL_SIZE_XY;
                const maxY = origin.y + (coreMaxY + 1) * MESH_CELL_SIZE_XY;

                const z0 = origin.z + 8;
                const z1 = origin.z + 500;

                const a0 = { x: minX, y: minY, z: z0 };
                const b0 = { x: maxX, y: minY, z: z0 };
                const c0 = { x: maxX, y: maxY, z: z0 };
                const d0 = { x: minX, y: maxY, z: z0 };
                const a1 = { x: minX, y: minY, z: z1 };
                const b1 = { x: maxX, y: minY, z: z1 };
                const c1 = { x: maxX, y: maxY, z: z1 };
                const d1 = { x: minX, y: maxY, z: z1 };

                Instance.DebugLine({ start: a0, end: b0, color, duration });
                Instance.DebugLine({ start: b0, end: c0, color, duration });
                Instance.DebugLine({ start: c0, end: d0, color, duration });
                Instance.DebugLine({ start: d0, end: a0, color, duration });

                Instance.DebugLine({ start: a1, end: b1, color, duration });
                Instance.DebugLine({ start: b1, end: c1, color, duration });
                Instance.DebugLine({ start: c1, end: d1, color, duration });
                Instance.DebugLine({ start: d1, end: a1, color, duration });

                Instance.DebugLine({ start: a0, end: a1, color, duration });
                Instance.DebugLine({ start: b0, end: b1, color, duration });
                Instance.DebugLine({ start: c0, end: c1, color, duration });
                Instance.DebugLine({ start: d0, end: d1, color, duration });

                Instance.DebugLine({ start: a1, end: c1, color, duration });
                Instance.DebugLine({ start: b1, end: d1, color, duration });
            }
        }
    }
}

/**
 * @module 导航网格/梯子链接构建
 */
/** @typedef {import("cs_script/point_script").Vector} Vector */
/** @typedef {import("./path_manager").NavMeshMesh} NavMeshMesh */
/** @typedef {import("./path_manager").NavMeshDetail} NavMeshDetail */
/** @typedef {import("./path_manager").NavMeshLink} NavMeshLink */
/**
 * 梯子链接构建器。
 *
 * 从地图中查找 `navmesh_LADDER_*` 实体对，
 * 创建梯子类型的导航链接。
 *
 * @navigationTitle 梯子链接构建
 */
//不多，可以每次都重新构建
class LadderLinkBuilder {
    /**
     * 初始化梯子链接构建器，绑定多边形网格。
     * @param {NavMeshMesh} polyMesh
     */
    constructor(polyMesh) {
        /** @type {NavMeshMesh} 待分析的多边形网格引用 */
        this.mesh = polyMesh;
        /** @type {boolean} 构建过程中是否出现错误（点位不足、找不到 poly 等） */
        this.error = false;
        /** @type {Uint16Array} 每个 link 占 2 个 uint16：poly[i*2]=起始 poly, poly[i*2+1]=目标 poly */
        this.poly = new Uint16Array(MAX_LINKS * 2);
        /** @type {Float32Array} 每个 link 的寻路代价（梯子固定为 0，鼓励使用） */
        this.cost = new Float32Array(MAX_LINKS);
        /** @type {Uint8Array} 每个 link 的类型（PathState.LADDER） */
        this.type = new Uint8Array(MAX_LINKS);
        /** @type {Float32Array} 每个 link 占 6 个 float：起点 XYZ + 终点 XYZ */
        this.pos = new Float32Array(MAX_LINKS * 6);
        /** @type {number} 当前已写入的 link 数量 */
        this.length = 0;
    }

    /**
     * 返回当前构建的 NavMeshLink 结构。
     *
     * @returns {NavMeshLink}
     */
    return() {
        return {
            poly: this.poly,
            cost: this.cost,
            type: this.type,
            pos: this.pos,
            length: this.length
        };
    }

    /**
     * 将一条梯子连接写入 TypedArray。
     *
     * @param {number} polyA - 起始多边形索引
     * @param {number} polyB - 目标多边形索引
     * @param {Vector} posA - 起点世界坐标
     * @param {Vector} posB - 终点世界坐标
     * @param {number} cost - 寻路代价
     */
    pushLink(polyA, polyB, posA, posB, cost) {
        const i = this.length;
        const pi = i << 1;
        const vi = i * 6;
        this.poly[pi] = polyA;
        this.poly[pi + 1] = polyB;
        this.cost[i] = cost;
        this.type[i] = PathState$1.LADDER;
        this.pos[vi] = posA.x;
        this.pos[vi + 1] = posA.y;
        this.pos[vi + 2] = posA.z;
        this.pos[vi + 3] = posB.x;
        this.pos[vi + 4] = posB.y;
        this.pos[vi + 5] = posB.z;
        this.length++;
    }

    /**
     * 从地图中查找所有 navmesh_LADDER_* 实体对，构建梯子连接。
     *
     * 每个标签组需要恰好 2 个点位，按 Z 轴从低到高配对，
     * 通过 findNearestPoly 匹配到多边形后生成双向梯子 link。
     *
     * @returns {NavMeshLink}
     */
    init() {
        this.error = false;
        this.length = 0;
        if (!this.mesh || !this.mesh.polys || this.mesh.polyslength === 0) return this.return();

        /** @type {Map<string, Vector[]>} */
        const groups = new Map();
        const ents = Instance.FindEntitiesByClass("info_target");

        for (const ent of ents) {
            const name = ent.GetEntityName();
            if (!name.startsWith("navmesh_LADDER_")) continue;

            const tag = name.slice("navmesh_LADDER_".length);
            if (!tag) continue;

            const p = ent.GetAbsOrigin();
            if (!p) continue;

            if (!groups.has(tag)) groups.set(tag, []);
            groups.get(tag)?.push({ x: p.x, y: p.y, z: p.z });
        }
        //let start=new Date();
        let rawPairs = 0;
        let validPairs = 0;

        for (const [tag, points] of groups) {
            if (points.length < 2) {
                this.error = true;
                Instance.Msg(`LadderLink: ${tag} 点位不足(=${points.length})，已跳过`);
                continue;
            }
            if (points.length !== 2) {
                this.error = true;
                Instance.Msg(`LadderLink: ${tag} 点位数量过多(${points.length})，已跳过`);
                continue;
            }
            const p0 = points[0], p1 = points[1];
            const aPos = p0.z <= p1.z ? p0 : p1;
            const bPos = p0.z <= p1.z ? p1 : p0;
            //points.sort((a, b) => a.z - b.z);
            //const aPos = points[0];
            //const bPos = points[points.length - 1];
            rawPairs++;
            const aNearest = Tool.findNearestPoly(aPos, this.mesh);//,this.heightfixer);
            const bNearest = Tool.findNearestPoly(bPos, this.mesh);//,this.heightfixer);
            const aPoly = aNearest.poly;
            const bPoly = bNearest.poly;
            if (aPoly < 0 || bPoly < 0) {
                this.error = true;
                Instance.Msg(`LadderLink: ${tag} 找不到最近多边形，已跳过`);
                continue;
            }
            if (aPoly === bPoly) {
                this.error = true;
                Instance.Msg(`LadderLink: ${tag} 两端落在同一 poly(${aPoly})，已跳过`);
                continue;
            }
            const cost = 0;//鼓励走梯子
            this.pushLink(aPoly, bPoly, aPos, bPos, cost);
            validPairs++;
        }
        Instance.Msg(`LadderLink统计: group=${groups.size} pair=${rawPairs} link=${this.length} valid=${validPairs}`);
        return this.return();
    }

    /**
     * 调试绘制所有梯子连接（橙色线段 + 金色球体）。
     *
     * @param {number} [duration=30] - 绘制持续时间（秒）
     */
    debugDraw(duration = 30) {
        for (let i = 0; i < this.length; i++) {
            const vi = i * 6;
            const start = {
                x: this.pos[vi],
                y: this.pos[vi + 1],
                z: this.pos[vi + 2]
            };
            const end = {
                x: this.pos[vi + 3],
                y: this.pos[vi + 4],
                z: this.pos[vi + 5]
            };
            Instance.DebugLine({
                start,
                end,
                color: { r: 255, g: 165, b: 0 },
                duration
            });
            Instance.DebugSphere({ center: start, radius: 4, color: { r: 255, g: 215, b: 0 }, duration });
            Instance.DebugSphere({ center: end, radius: 4, color: { r: 255, g: 215, b: 0 }, duration });
        }
    }
}

/**
 * @module 导航网格/地图跳跃链接
 */
/** @typedef {import("cs_script/point_script").Vector} Vector */
/** @typedef {import("./path_manager").NavMeshMesh} NavMeshMesh */
/** @typedef {import("./path_manager").NavMeshDetail} NavMeshDetail */
/** @typedef {import("./path_manager").NavMeshLink} NavMeshLink */
/**
 * 手动跳跃链接构建器。
 *
 * 从地图中查找 `navmesh_JUMP_*` 实体对，
 * 创建人工标记的跳跃链接。
 *
 * @navigationTitle 手动跳跃链接
 */
//手动跳点
class MapJUMPLinkBuilder {
    /**
     * 初始化手动跳跃链接构建器，绑定多边形网格。
     * @param {NavMeshMesh} polyMesh
     */
    constructor(polyMesh) {
        /** @type {NavMeshMesh} 待分析的多边形网格引用 */
        this.mesh = polyMesh;
        /** @type {boolean} 构建过程中是否出现错误（点位不足、找不到 poly 等） */
        this.error = false;
        /** @type {Uint16Array} 每个 link 占 2 个 uint16：poly[i*2]=起始 poly, poly[i*2+1]=目标 poly */
        this.poly = new Uint16Array(MAX_LINKS * 2);
        /** @type {Float32Array} 每个 link 的寻路代价（基于两点距离平方，至少为 1） */
        this.cost = new Float32Array(MAX_LINKS);
        /** @type {Uint8Array} 每个 link 的类型（PathState.JUMP） */
        this.type = new Uint8Array(MAX_LINKS);
        /** @type {Float32Array} 每个 link 占 6 个 float：起点 XYZ + 终点 XYZ */
        this.pos = new Float32Array(MAX_LINKS * 6);
        /** @type {number} 当前已写入的 link 数量 */
        this.length = 0;
    }

    /**
     * 返回当前构建的 NavMeshLink 结构。
     *
     * @returns {NavMeshLink}
     */
    return() {
        return {
            poly: this.poly,
            cost: this.cost,
            type: this.type,
            pos: this.pos,
            length: this.length
        };
    }

    /**
     * 将一条手动跳跃连接写入 TypedArray。
     *
     * @param {number} polyA - 起始多边形索引
     * @param {number} polyB - 目标多边形索引
     * @param {Vector} posA - 起点世界坐标
     * @param {Vector} posB - 终点世界坐标
     * @param {number} cost - 寻路代价
     */
    pushLink(polyA, polyB, posA, posB, cost) {
        const i = this.length;
        const pi = i << 1;
        const vi = i * 6;
        this.poly[pi] = polyA;
        this.poly[pi + 1] = polyB;
        this.cost[i] = cost;
        this.type[i] = PathState$1.JUMP;
        this.pos[vi] = posA.x;
        this.pos[vi + 1] = posA.y;
        this.pos[vi + 2] = posA.z;
        this.pos[vi + 3] = posB.x;
        this.pos[vi + 4] = posB.y;
        this.pos[vi + 5] = posB.z;
        this.length++;
    }

    /**
     * 从地图中查找所有 navmesh_JUMP_* 实体对，构建手动跳跃连接。
     *
     * 每个标签组需要恰好 2 个点位，按 Z 轴从低到高配对，
     * 通过 findNearestPoly 匹配到多边形后生成跳跃 link。
     *
     * @returns {NavMeshLink}
     */
    init() {
        this.error = false;
        this.length = 0;
        if (!this.mesh || !this.mesh.polys || this.mesh.polyslength === 0) return this.return();

        /** @type {Map<string, Vector[]>} */
        const groups = new Map();
        const ents = Instance.FindEntitiesByClass("info_target");

        for (const ent of ents) {
            const name = ent.GetEntityName();
            if (!name.startsWith("navmesh_JUMP_")) continue;

            const tag = name.slice("navmesh_JUMP_".length);
            if (!tag) continue;

            const p = ent.GetAbsOrigin();
            if (!p) continue;

            if (!groups.has(tag)) groups.set(tag, []);
            groups.get(tag)?.push({ x: p.x, y: p.y, z: p.z });
        }
        //let start=new Date();
        let rawPairs = 0;
        let validPairs = 0;

        for (const [tag, points] of groups) {
            if (points.length < 2) {
                this.error = true;
                Instance.Msg(`MapJUMPLink: ${tag} 点位不足(=${points.length})，已跳过`);
                continue;
            }
            if (points.length !== 2) {
                this.error = true;
                Instance.Msg(`MapJUMPLink: ${tag} 点位数量过多(${points.length})，已跳过`);
                continue;
            }
            const p0 = points[0], p1 = points[1];
            const aPos = p0.z <= p1.z ? p0 : p1;
            const bPos = p0.z <= p1.z ? p1 : p0;
            //points.sort((a, b) => a.z - b.z);
            //const aPos = points[0];
            //const bPos = points[points.length - 1];
            rawPairs++;
            const aNearest = Tool.findNearestPoly(aPos, this.mesh);//,this.heightfixer);
            const bNearest = Tool.findNearestPoly(bPos, this.mesh);//,this.heightfixer);
            const aPoly = aNearest.poly;
            const bPoly = bNearest.poly;
            if (aPoly < 0 || bPoly < 0) {
                this.error = true;
                Instance.Msg(`MapJUMPLink: ${tag} 找不到最近多边形，已跳过`);
                continue;
            }
            if (aPoly === bPoly) {
                this.error = true;
                Instance.Msg(`MapJUMPLink: ${tag} 两端落在同一 poly(${aPoly})，已跳过`);
                continue;
            }
            const cost = Math.max(1, vec.lengthsq(aNearest.pos, bNearest.pos));
            this.pushLink(aPoly, bPoly, aPos, bPos, cost);
            validPairs++;
        }
        Instance.Msg(`MapJUMPLink统计: group=${groups.size} pair=${rawPairs} link=${this.length} valid=${validPairs}`);
        return this.return();
    }

    /**
     * 调试绘制所有手动跳跃连接（橙色线段 + 青色球体）。
     *
     * @param {number} [duration=30] - 绘制持续时间（秒）
     */
    debugDraw(duration = 30) {
        for (let i = 0; i < this.length; i++) {
            const vi = i * 6;
            const start = {
                x: this.pos[vi],
                y: this.pos[vi + 1],
                z: this.pos[vi + 2]
            };
            const end = {
                x: this.pos[vi + 3],
                y: this.pos[vi + 4],
                z: this.pos[vi + 5]
            };
            Instance.DebugLine({
                start,
                end,
                color: { r: 255, g: 165, b: 0 },
                duration
            });
            Instance.DebugSphere({ center: start, radius: 4, color: { r: 0, g: 215, b: 255 }, duration });
            Instance.DebugSphere({ center: end, radius: 4, color: { r: 0, g: 215, b: 255 }, duration });
        }
    }
}

/**
 * @module 导航网格/传送门链接构建
 */
/** @typedef {import("cs_script/point_script").Vector} Vector */
/** @typedef {import("./path_manager").NavMeshMesh} NavMeshMesh */
/** @typedef {import("./path_manager").NavMeshDetail} NavMeshDetail */
/** @typedef {import("./path_manager").NavMeshLink} NavMeshLink */
/**
 * 传送门链接构建器。
 *
 * 从地图中查找 `navmesh_PORTAL_*` 实体对，
 * 创建零代价的传送连接（Teleport）。
 *
 * @navigationTitle 传送门链接构建
 */
//手动传送点
class PortalLinkBuilder {
    /**
     * 初始化传送门链接构建器，绑定多边形网格。
     * @param {NavMeshMesh} polyMesh
     */
    constructor(polyMesh) {
        /** @type {NavMeshMesh} 待分析的多边形网格引用 */
        this.mesh = polyMesh;
        /** @type {boolean} 构建过程中是否出现错误（点位不足、找不到 poly 等） */
        this.error = false;
        /** @type {Uint16Array} 每个 link 占 2 个 uint16：poly[i*2]=起始 poly, poly[i*2+1]=目标 poly */
        this.poly = new Uint16Array(MAX_LINKS * 2);
        /** @type {Float32Array} 每个 link 的寻路代价（传送门固定为 0，鼓励使用） */
        this.cost = new Float32Array(MAX_LINKS);
        /** @type {Uint8Array} 每个 link 的类型（PathState.PORTAL） */
        this.type = new Uint8Array(MAX_LINKS);
        /** @type {Float32Array} 每个 link 占 6 个 float：起点 XYZ + 终点 XYZ */
        this.pos = new Float32Array(MAX_LINKS * 6);
        /** @type {number} 当前已写入的 link 数量 */
        this.length = 0;
    }

    /**
     * 返回当前构建的 NavMeshLink 结构。
     *
     * @returns {NavMeshLink}
     */
    return() {
        return {
            poly: this.poly,
            cost: this.cost,
            type: this.type,
            pos: this.pos,
            length: this.length
        };
    }

    /**
     * 将一条传送门连接写入 TypedArray。
     *
     * @param {number} polyA - 起始多边形索引
     * @param {number} polyB - 目标多边形索引
     * @param {Vector} posA - 起点世界坐标
     * @param {Vector} posB - 终点世界坐标
     * @param {number} cost - 寻路代价
     */
    pushLink(polyA, polyB, posA, posB, cost) {
        const i = this.length;
        const pi = i << 1;
        const vi = i * 6;
        this.poly[pi] = polyA;
        this.poly[pi + 1] = polyB;
        this.cost[i] = cost;
        this.type[i] = PathState$1.PORTAL;
        this.pos[vi] = posA.x;
        this.pos[vi + 1] = posA.y;
        this.pos[vi + 2] = posA.z;
        this.pos[vi + 3] = posB.x;
        this.pos[vi + 4] = posB.y;
        this.pos[vi + 5] = posB.z;
        this.length++;
    }

    /**
     * 从地图中查找所有 navmesh_PORTAL_* 实体对，构建零代价传送连接。
     *
     * 每个标签组需要恰好 2 个点位，按 Z 轴从低到高配对，
     * 通过 findNearestPoly 匹配到多边形后生成传送门 link。
     *
     * @returns {NavMeshLink}
     */
    init() {
        this.error = false;
        this.length = 0;
        if (!this.mesh || !this.mesh.polys || this.mesh.polyslength === 0) return this.return();

        /** @type {Map<string, Vector[]>} */
        const groups = new Map();
        const ents = Instance.FindEntitiesByClass("info_target");

        for (const ent of ents) {
            const name = ent.GetEntityName();
            if (!name.startsWith("navmesh_PORTAL_")) continue;

            const tag = name.slice("navmesh_PORTAL_".length);
            if (!tag) continue;

            const p = ent.GetAbsOrigin();
            if (!p) continue;

            if (!groups.has(tag)) groups.set(tag, []);
            groups.get(tag)?.push({ x: p.x, y: p.y, z: p.z });
        }
        //let start=new Date();
        let rawPairs = 0;
        let validPairs = 0;

        for (const [tag, points] of groups) {
            if (points.length < 2) {
                this.error = true;
                Instance.Msg(`PortalLink: ${tag} 点位不足(=${points.length})，已跳过`);
                continue;
            }
            if (points.length !== 2) {
                this.error = true;
                Instance.Msg(`PortalLink: ${tag} 点位数量过多(${points.length})，已跳过`);
                continue;
            }
            const p0 = points[0], p1 = points[1];
            const aPos = p0.z <= p1.z ? p0 : p1;
            const bPos = p0.z <= p1.z ? p1 : p0;
            //points.sort((a, b) => a.z - b.z);
            //const aPos = points[0];
            //const bPos = points[points.length - 1];
            rawPairs++;
            const aNearest = Tool.findNearestPoly(aPos, this.mesh);//,this.heightfixer);
            const bNearest = Tool.findNearestPoly(bPos, this.mesh);//,this.heightfixer);
            const aPoly = aNearest.poly;
            const bPoly = bNearest.poly;
            if (aPoly < 0 || bPoly < 0) {
                this.error = true;
                Instance.Msg(`PortalLink: ${tag} 找不到最近多边形，已跳过`);
                continue;
            }
            if (aPoly === bPoly) {
                this.error = true;
                Instance.Msg(`PortalLink: ${tag} 两端落在同一 poly(${aPoly})，已跳过`);
                continue;
            }//鼓励走传送门
            this.pushLink(aPoly, bPoly, aPos, bPos, 0);
            validPairs++;
        }
        Instance.Msg(`PortalLink统计: group=${groups.size} pair=${rawPairs} link=${this.length} valid=${validPairs}`);
        return this.return();
    }

    /**
     * 调试绘制所有传送门连接（橙色线段 + 青色球体）。
     *
     * @param {number} [duration=30] - 绘制持续时间（秒）
     */
    debugDraw(duration = 30) {
        for (let i = 0; i < this.length; i++) {
            const vi = i * 6;
            const start = {
                x: this.pos[vi],
                y: this.pos[vi + 1],
                z: this.pos[vi + 2]
            };
            const end = {
                x: this.pos[vi + 3],
                y: this.pos[vi + 4],
                z: this.pos[vi + 5]
            };
            Instance.DebugLine({
                start,
                end,
                color: { r: 255, g: 165, b: 0 },
                duration
            });
            Instance.DebugSphere({ center: start, radius: 4, color: { r: 0, g: 215, b: 255 }, duration });
            Instance.DebugSphere({ center: end, radius: 4, color: { r: 0, g: 215, b: 255 }, duration });
        }
    }
}

/**
 * @module 导航网格/瓦片管理器
 */
/** @typedef {import("./path_manager").NavMeshMesh} NavMeshMesh */
/** @typedef {import("./path_manager").NavMeshDetail} NavMeshDetail */
/** @typedef {import("./path_manager").NavMeshLink} NavMeshLink */
/** @typedef {import("./path_manager").NavMesh} NavMesh */
/** @typedef {import("./path_tile").tile} tile */

/**
 * @typedef {{
 *  tileId:string,
 *  tx:number,
 *  ty:number,
 *  mesh:NavMeshMesh,
 *  detail:NavMeshDetail,
 *  links:NavMeshLink
 * }} TileData
 */
/**
 * 创建一个空的 NavMeshMesh 结构（TypedArray 预分配）。
 */
function newmesh()
{
    return {
        verts: new Float32Array(MAX_VERTS*3),
        vertslength: 0,
        polys: new Int32Array(MAX_POLYS*2),
        polyslength: 0,
        regions: new Int16Array(0),///这里和之后都不会用到，先放个空数组占位
        neighbors: new Array(MAX_POLYS)
    };
}
/**
 * 创建一个空的 NavMeshDetail 结构（TypedArray 预分配）。
 */
function newdetailmesh()
{
    return {
        verts: new Float32Array(MAX_TRIS*3*3),
        vertslength: 0,
        tris: new Uint16Array(MAX_TRIS*3),
        trislength: 0,
        triTopoly: new Uint16Array(MAX_TRIS),
        baseVert: new Uint16Array(MAX_POLYS),
        vertsCount: new Uint16Array(MAX_POLYS),
        baseTri: new Uint16Array(MAX_POLYS),
        triCount: new Uint16Array(MAX_POLYS)
    };
}
/**
 * 创建一个空的 NavMeshLink 结构（TypedArray 预分配）。
 */
function newlink()
{
    return {
        poly:new Uint16Array(MAX_LINKS*2),
        cost:new Float32Array(MAX_LINKS),
        type:new Uint8Array(MAX_LINKS),
        pos:new Float32Array(MAX_LINKS*6),
        length:0
    };
}
/**
 * Tile 管理器。
 *
 * 动态加载 / 卸载 / 更新多个 Tile，维护全局 mesh / detail / link 数组。
 * 支持 lazy-loading：按需构建单个 Tile，自动建立跨 Tile 邻接关系，
 * 并通过可达性裁剪（pruneUnreachablePolys）清除孤立多边形。
 *
 * @navigationTitle Tile 管理器
 */
class TileManager {
    /**
     * 初始化 Tile 管理器，绑定所属 NavMesh 实例。
     * @param {NavMesh} nav
     */
    constructor(nav) {
        /** @type {NavMesh} 所属的 NavMesh 管理器实例，用于在 updatemesh() 中回写全局导航数据 */
        this.nav=nav;
        /** @type {Map<string, TileData>} 以 "tx_ty" 为键存储每个已加载 Tile 的原始数据（mesh/detail/links），用于增量更新与邻居查询 */
        this.tiles = new Map();
        /** @type {NavMeshMesh} 全局合并后的多边形网格（所有已加载 Tile 的顶点/多边形/邻接拼合在一起），未经可达性裁剪 */
        this.mesh=newmesh();
        /** @type {NavMeshDetail} 全局合并后的细节网格（高分辨率三角形），与 mesh 的 poly 索引对齐 */
        this.meshdetail=newdetailmesh();
        /** @type {NavMeshLink} 全局合并后的连接（baseLinks + Extlink + supprlink 三者拼合），供寻路使用 */
        this.links= newlink();

        /** @type {NavMeshMesh} 经可达性裁剪后的多边形网格，仅保留从种子点可达的多边形；启用 TILE_OPTIMIZATION_1 时由 pruneUnreachablePolys() 写入 */
        this.prunemesh;
        /** @type {NavMeshDetail} 经可达性裁剪后的细节网格，与 prunemesh 索引对齐 */
        this.prunemeshdetail;
        /** @type {NavMeshLink} 经可达性裁剪后的连接数组，仅包含两端 poly 均可达的连接 */
        this.prunelinks;

        /** @type {NavMeshLink} 补充连接（梯子 + 地图跳跃点 + 传送门），由 buildSupperLinksForMesh() 生成 */
        this.supprlink= newlink();//ladder连接
        /** @type {NavMeshLink} 跨 Tile 跳跃连接，由 JumpLinkBuilder.initInterTileIn() 增量生成 */
        this.Extlink = newlink();//tile间连接
        /** @type {NavMeshLink} Tile 内部连接（每个 Tile 自身构建时产生的 links 合并），作为最终合并的基础层 */
        this.baseLinks =newlink();//tile内连接

        /** @type {Map<string, {vertBase:number,vertCount:number,polyBase:number,polyCount:number,detailVertBase:number,detailVertCount:number,triBase:number,triCount:number,meshRecBase:number,meshRecCount:number}>} 记录每个 Tile 在全局 mesh/detail 数组中的偏移与长度，用于移除/重映射 */
        this.tileRanges = new Map();
    }

    /**
     * 添加（或替换）一个 Tile 到管理器。
     *
     * 若该 key 已存在，先调用 removetile 移除旧 Tile，再将新数据追加到全局数组。
     * 追加完成后自动执行增量跨 Tile 连接生成（_rebuildDeferredLinks）。
     *
     * @param {string} key - Tile 唯一标识，格式 "tx_ty"
     * @param {number} tx - Tile 在网格中的列索引
     * @param {number} ty - Tile 在网格中的行索引
     * @param {NavMeshMesh} tileMesh - Tile 的多边形网格
     * @param {NavMeshDetail} tileDetail - Tile 的细节三角网格
     * @param {NavMeshLink} tileLinks - Tile 内部生成的连接
     */
    addtile(key, tx, ty, tileMesh, tileDetail, tileLinks) {
        if (this.tiles.has(key)) {
            this.removetile(key);
        }
        this.tiles.set(key, {
            tileId: key,
            tx,
            ty,
            mesh: tileMesh,
            detail: tileDetail,
            links: tileLinks
        });
        this._appendTileData(key, tileMesh, tileDetail, tileLinks);
        this._rebuildDeferredLinks(true,true,key);
    }

    /**
     * 从管理器中移除指定 Tile。
     *
     * 调用 _removeTileData 从全局数组中删除该 Tile 占用的数据并重映射所有索引，
     * 然后重建补充连接（_rebuildDeferredLinks）。
     *
     * @param {string} key - 要移除的 Tile 标识
     */
    removetile(key) {
        if (!this.tiles.has(key)) return;
        this.tiles.delete(key);
        this._removeTileData(key);
        this._rebuildDeferredLinks(false,false);
    }

    /**
     * 更新指定 Tile（先移除旧数据再添加新数据）。
     *
     * 内部直接委托给 addtile，后者会检测重复 key 并先 removetile。
     *
     * @param {string} key - Tile 标识
     * @param {number} tx - 列索引
     * @param {number} ty - 行索引
     * @param {NavMeshMesh} tileMesh - 新的多边形网格
     * @param {NavMeshDetail} tileDetail - 新的细节网格
     * @param {NavMeshLink} tileLinks - 新的 Tile 内连接
     */
    updatetile(key, tx, ty, tileMesh, tileDetail, tileLinks) {
        this.addtile(key, tx, ty, tileMesh, tileDetail, tileLinks);//48ms
    }
    /**
     * 为全局合并后的 mesh 构建所有补充连接（梯子 + 地图跳跃点 + 传送门）。
     *
     * 依次调用 LadderLinkBuilder、MapJUMPLinkBuilder、PortalLinkBuilder 的 init()，
     * 再通过 copyLinks 将结果合并为一个 NavMeshLink。
     *
     * @param {NavMeshMesh} mesh - 要分析的全局多边形网格
     * @returns {NavMeshLink} 合并后的补充连接
     */
    buildSupperLinksForMesh(mesh) {
        let merged = this.copyLinks(new LadderLinkBuilder(mesh).init(), new MapJUMPLinkBuilder(mesh).init());
        return this.copyLinks(merged, new PortalLinkBuilder(mesh).init());
    }
    /**
     * 将当前最终的 mesh/detail/links 回写到 NavMesh 管理器。
     *
     * 调用 return() 获取最终数据（裁剪或未裁剪），直接赋值给 nav.mesh / nav.meshdetail / nav.links，
     * 使寻路系统立即可用最新导航网格。
     */
    updatemesh()
    {
        const merged = this.return();
        this.nav.mesh = merged.mesh;
        this.nav.meshdetail = merged.meshdetail;
        this.nav.links = merged.links;
    }
    /**
     * 返回最终可用的导航数据包。
     *
     * 当 TILE_OPTIMIZATION_1 开启时返回经可达性裁剪后的 prunemesh/prunemeshdetail/prunelinks；
     * 否则返回未裁剪的原始全局合并数据。
     *
     * @returns {{mesh: NavMeshMesh, meshdetail: NavMeshDetail, links: NavMeshLink}}
     */
    return() {
        return {
                mesh: this.prunemesh,
                meshdetail: this.prunemeshdetail,
                links: this.prunelinks
            }
    }

    /**
     * 从零开始重建所有 Tile。
     *
     * 清空现有数据，遍历 tileBuilder 的网格坐标依次调用 buildTile 构建每个 Tile，
     * 追加到全局数组并增量生成跨 Tile 连接。全部完成后执行补充连接生成、
     * 可达性裁剪，并统计各阶段耗时。若有 Tile 报错则高亮显示。
     *
     * @param {tile} tileBuilder - Tile 构建器实例，提供 tilesX/tilesY 和 buildTile()
     * @returns {{timing: Object, errorTiles: any[]}} 各阶段耗时统计 + 报错 Tile 列表
     */
    rebuildAll(tileBuilder) {
        this.tiles.clear();
        this.tileRanges.clear();
        this.mesh=newmesh();
        this.meshdetail = newdetailmesh();
        this.links = newlink();
        this.supprlink = newlink();
        this.Extlink=newlink();
        this.baseLinks =newlink();
        
        const timing = {
            hfInit: 0,
            region: 0,
            contour: 0,
            poly: 0,
            detail: 0,
            merge: 0,
            jumpLinks: 0,
        };

        /** @type {{tx:number,ty:number}[]} */
        const errorTiles = [];

        for (let ty = 0; ty < tileBuilder.tilesY; ty++) {
            for (let tx = 0; tx < tileBuilder.tilesX; tx++) {
                const tileData = tileBuilder.buildTile(tx, ty);
                timing.hfInit += tileData.timing.hfInit;
                timing.region += tileData.timing.region;
                timing.contour += tileData.timing.contour;
                timing.poly += tileData.timing.poly;
                timing.detail += tileData.timing.detail;
                timing.merge += tileData.timing.merge;
                timing.jumpLinks += tileData.timing.jumpLinks;
                if (tileData.hasError) errorTiles.push({ tx, ty });
                const key = tileData.tileId;
                this.tiles.set(key, {
                    tileId: key,
                    tx: tileData.tx,
                    ty: tileData.ty,
                    mesh: tileData.mesh,
                    detail: tileData.detail,
                    links: tileData.links
                });
                this._appendTileData(key, tileData.mesh, tileData.detail, tileData.links);
                this._rebuildDeferredLinks(true,false,key);
            }
        }
        this._rebuildDeferredLinks(false,true);
        if (errorTiles.length > 0) {
            const dedup = new Map();
            for (const tile of errorTiles) dedup.set(`${tile.tx}|${tile.ty}`, tile);
            const drawTiles = Array.from(dedup.values());
            tileBuilder.debugDrawErrorTiles(drawTiles, 60);
            Instance.Msg(`Tile报错统计: ${drawTiles.length} 个tile存在步骤报错，已在地图高亮`);
        }
        this.pruneUnreachablePolys();
        Instance.Msg(`Tile阶段耗时统计: 体素化=${timing.hfInit}ms, 区域=${timing.region}ms, 轮廓=${timing.contour}ms, 多边形=${timing.poly}ms, 细节=${timing.detail}ms, 合并=${timing.merge}ms`);
        return { timing, errorTiles };
    }

    /**
     * 将一个 Tile 的 mesh/detail/links 追加到全局数组末尾。
     *
     * 具体步骤：
     * 1. 记录 vertBase/polyBase/detailVertBase/triBase 等全局基址
     * 2. 追加 polys/verts（每个 poly 的顶点顺序复制，并重映射邻接关系）
     * 3. 追加 detail verts/tris/triTopoly 和每个 poly 的 mesh record
     * 4. 追加 baseLinks（Tile 内连接）并重映射 poly 索引
     * 5. 在 tileRanges 中记录该 Tile 的范围
     * 6. 调用 _linkTileWithNeighborTiles 建立跨 Tile 邻接
     *
     * @param {string} tileId - Tile 标识
     * @param {NavMeshMesh} tileMesh - Tile 的多边形网格
     * @param {NavMeshDetail} tileDetail - Tile 的细节网格
     * @param {NavMeshLink} tileLinks - Tile 内连接
     */
    _appendTileData(tileId, tileMesh, tileDetail, tileLinks) {
        const mesh = this.mesh;
        const meshdetail = this.meshdetail;
        const baseLinks = this.baseLinks;
        // 记录本次追加前的全局基址（用于后续写入时做偏移）
        const vertBase = mesh.vertslength; // 顶点基址（顶点数，不是浮点数长度）
        const polyBase = mesh.polyslength; // 多边形基址（多边形计数）

        // 记录 detail 层的基址（细节顶点与细节三角）
        const detailVertBase = meshdetail.vertslength;
        const triBase = meshdetail.trislength;
        const meshRecBase = polyBase; // mesh record 基址与 polyBase 对齐（每个 poly 一条 record）
        
        // =========================
        // 1) 追加多边形：把 tile 的每个 poly 的顶点按顺序追加到全局 verts 中，
        //    并在 polys 中记录该 poly 在 verts 中的 start/end 索引区间
        // =========================
        // append polys
        for (let i = 0; i < tileMesh.polyslength; i++) {
            const tstart = tileMesh.polys[i<<1];
            const tend = tileMesh.polys[(i<<1)+1];
            // poly 在全局 verts 中的起始顶点索引
            const start= mesh.vertslength;
            for (let k = tstart; k <= tend; k++) {

                const sx = tileMesh.verts[k * 3];
                const sy = tileMesh.verts[k * 3 + 1];
                const sz = tileMesh.verts[k * 3 + 2];
                const writeIndex = (mesh.vertslength) * 3;
                mesh.verts[writeIndex] = sx;
                mesh.verts[writeIndex + 1] = sy;
                mesh.verts[writeIndex + 2] = sz;

                mesh.vertslength++;
            }
            const end = mesh.vertslength - 1;
            // 将该 poly 的 start/end 写入 polys（每个 poly 占两个 Int32）
            const pi = mesh.polyslength * 2;
            mesh.polys[pi] = start;
            mesh.polys[pi + 1] = end;
            

            // 把 tile 本地的邻接关系（如果有）映射到全局 poly 索引空间
            const vertCount = tend - tstart + 1;
            mesh.neighbors[mesh.polyslength]=new Array(vertCount);
            for (let ei = 0; ei < vertCount; ei++) 
            {
                const nc=tileMesh.neighbors[i][ei][0];
                mesh.neighbors[mesh.polyslength][ei]=new Int16Array(100);
                mesh.neighbors[mesh.polyslength][ei][0]=nc;
                for(let ni=1;ni<=nc;ni++)
                {
                    const nei = tileMesh.neighbors[i][ei][ni];
                    const mappedNei = polyBase + nei;
                    mesh.neighbors[mesh.polyslength][ei][ni] = mappedNei;
                }
            }
            mesh.polyslength++;
        }

        meshdetail.verts.set(tileDetail.verts.subarray(0, tileDetail.vertslength * 3), detailVertBase * 3);
        meshdetail.vertslength+=tileDetail.vertslength;
        // =========================
        // 3) 追加 detail 三角形（tris）和 tri->poly 映射（triTopoly）到 TypedArray
        //    tris 以三元组存储顶点索引（每个值指向 meshdetail.verts 的顶点索引）
        // =========================

        for (let i = 0; i < tileDetail.trislength; i++) {

            let a = detailVertBase + tileDetail.tris[i * 3];
            let b = detailVertBase + tileDetail.tris[i * 3 + 1];
            let c = detailVertBase + tileDetail.tris[i * 3 + 2];

            const writeIdx = meshdetail.trislength * 3;
            meshdetail.tris[writeIdx] = a;
            meshdetail.tris[writeIdx + 1] = b;
            meshdetail.tris[writeIdx + 2] = c;

            meshdetail.triTopoly[meshdetail.trislength] = polyBase + tileDetail.triTopoly[i];
            meshdetail.trislength++;
        }

        // =========================
        // 4) 追加每个 poly 对应的 mesh record（baseVert, vertsCount, baseTri, triCount）
        //    这些数组以 poly 索引为下标，存储该 poly 的细节数据在全局数组中的起点与计数
        // =========================
        for (let i = 0; i < tileMesh.polyslength; i++) {

            const gi = meshRecBase + i;

            meshdetail.baseVert[gi] = detailVertBase + tileDetail.baseVert[i];
            meshdetail.vertsCount[gi] = tileDetail.vertsCount[i];
            meshdetail.baseTri[gi] = triBase + tileDetail.baseTri[i];
            meshdetail.triCount[gi] = tileDetail.triCount[i];
        }
        // 追加link
        const blid=baseLinks.length;
        baseLinks.cost.set(tileLinks.cost.subarray(0, tileLinks.length), blid);
        baseLinks.type.set(tileLinks.type.subarray(0, tileLinks.length), blid);
        baseLinks.pos.set(tileLinks.pos.subarray(0, tileLinks.length * 6), blid * 6);

        for (let i=0;i<tileLinks.length;i++)
        {
            baseLinks.poly[(blid+i)<<1]=polyBase+tileLinks.poly[i<<1];
            baseLinks.poly[((blid+i)<<1)+1]=polyBase+tileLinks.poly[(i<<1)+1];
        }
        baseLinks.length+=tileLinks.length;
        //记录 tile 在全局 mesh/detail 中的范围
        this.tileRanges.set(tileId, {
            vertBase,
            vertCount: mesh.vertslength-vertBase,
            polyBase,
            polyCount: tileMesh.polyslength,
            detailVertBase,
            detailVertCount: tileDetail.vertslength,
            triBase,
            triCount: tileDetail.trislength,
            meshRecBase,
            meshRecCount: tileMesh.polyslength
        });
        this._linkTileWithNeighborTiles(tileId);
    }

    /**
     * 新 Tile 追加后，增量补齐其与周围 4 个邻居 Tile 的跨 Tile 邻接关系。
     *
     * 算法流程：
     * 1. 收集邻居 Tile 中所有多边形的开放边（无邻接的边），按主轴方向 + bucket 分组
     * 2. 遍历当前 Tile 的开放边，通过 findOpenEdgesByOverlap 与邻居边进行模糊匹配
     * 3. 对匹配成功的边对调用 addNeighborLink 双向连接
     *
     * @param {string} tileId - 新追加的 Tile 标识
     */
    _linkTileWithNeighborTiles(tileId) {
        const tileData = this.tiles.get(tileId);
        const curRange = this.tileRanges.get(tileId);
        if (!tileData || !curRange || curRange.polyCount <= 0) return;

        const neighborTiles = this._collectNeighborTiles(tileData.tx, tileData.ty);
        if (neighborTiles.length === 0) return;
        //邻居 tile 的“开放边”
        const openEdgeStorebuckets = new Map();
        // =========================
        // 1️⃣ 收集邻居 tile 的开放边
        // =========================
        //收集所有邻居中的多边形的开放边(无邻居边)
        for (const nei of neighborTiles) {
            const neiRange = this.tileRanges.get(nei);
            if (!neiRange || neiRange.polyCount <= 0) continue;

            const end = neiRange.polyBase + neiRange.polyCount;
            for (let poly = neiRange.polyBase; poly < end; poly++) {
                const polyStart = this.mesh.polys[poly << 1];
                const polyEnd   = this.mesh.polys[(poly << 1) + 1];
                const vertCount = polyEnd - polyStart + 1;
                for (let edge = 0; edge < vertCount; edge++) 
                {
                    if (this.mesh.neighbors[poly][edge][0] > 0) continue; // 有邻居
                    const va = polyStart + edge;
                    const vb = polyStart + ((edge + 1) % vertCount);
                    const edgeRec = this.buildOpenEdgeRecord(this.mesh, poly, edge, va, vb);

                    const bucketKey = `${edgeRec.major}|${edgeRec.bucketId}`;
                    const bucket = Tool.getOrCreateArray(openEdgeStorebuckets, bucketKey);
                    bucket.push(edgeRec);
                }
            }
        }
        // =========================
        // 2️⃣ 当前 tile 尝试匹配
        // =========================
        const dedup = new Set();
        /**
         * @type {any[]}
         */
        const candidates=[];
        const curEnd = curRange.polyBase + curRange.polyCount;
        for (let poly = curRange.polyBase; poly < curEnd; poly++) {
            const polyStart = this.mesh.polys[poly << 1];
            const polyEnd   = this.mesh.polys[(poly << 1) + 1];
            const vertCount = polyEnd - polyStart + 1;
            for (let edge = 0; edge < vertCount; edge++) 
            {
                if (this.mesh.neighbors[poly][edge][0] > 0) continue;
                dedup.clear();
                candidates.length = 0;
                // ===== 2️⃣ 模糊匹配 =====
                this.findOpenEdgesByOverlap(
                    this.mesh,
                    openEdgeStorebuckets,
                    poly,
                    edge,
                    curRange.polyBase,
                    candidates,
                    dedup
                );

                for (const cand of candidates) {
                    this.addNeighborLink(this.mesh, poly, edge, cand.poly, cand.edge);
                }
                //可以维护一个所有tile的边界边
            }
        }
    }

    /**
     * 收集指定 Tile 坐标周围的已加载邻居 Tile 标识。
     *
     * 默认只返回上下左右 4 个方向；开启 includeDiagonal 后
     * 返回 8 个方向加自身（共 9 个），用于跨 Tile 连接生成时的范围查询。
     *
     * @param {number} tx - 中心 Tile 列索引
     * @param {number} ty - 中心 Tile 行索引
     * @param {boolean} [includeDiagonal] - 是否包含对角线邻居和自身
     * @returns {string[]} 已加载的邻居 Tile 标识数组
     */
    _collectNeighborTiles(tx, ty, includeDiagonal = false) {
        /** @type {string[]} */
        const out = [];
        // 4/8邻居偏移
        const offsets = includeDiagonal
            ? [
                [-1, -1], [0, -1], [1, -1],
                [-1,  0], [0,  0], [1,  0],
                [-1,  1], [0,  1], [1,  1]
            ]
            : [
                [0, -1], [-1, 0], [1, 0], [0, 1]
            ];
        for (const [dx, dy] of offsets) {
            const ntx = tx + dx;
            const nty = ty + dy;
            // 构造 tileId，需与 addtile 时一致
            const tileId = `${ntx}_${nty}`;
            if (this.tiles.has(tileId)) out.push(tileId);
        }
        return out;
    }

    /**
     * 从全局数组中删除指定 Tile 的数据并重映射所有索引。
     *
     * 共 10 个步骤：
     * 1-2. 删除 mesh verts、polys（copyWithin 左移 + 长度减少）
     * 3. 重映射剩余 poly 的顶点索引
     * 4. 重映射所有 neighbors 中的 poly 索引（删除指向被移除 Tile 的邻接）
     * 5-6. 删除 detail verts/tris
     * 7-8. 重映射 detail tris 顶点索引和 triTopoly
     * 9. 重映射三套 links（baseLinks/Extlink/supprlink）中的 poly 索引
     * 10. 更新其他 Tile 在 tileRanges 中的偏移
     *
     * @param {string} tileId - 要移除的 Tile 标识
     */
    _removeTileData(tileId) {
        // 1) 读取该 tile 在全局数组中的范围；没有范围说明未被 append，直接返回。
        const range = this.tileRanges.get(tileId);
        if (!range) return;
        const mesh = this.mesh;
        const detail = this.meshdetail;

        // 2) 预先计算被删除区间的右边界，用于后续索引重映射判断。
        const vertEnd = range.vertBase + range.vertCount;
        const polyEnd = range.polyBase + range.polyCount;
        const dVertEnd = range.detailVertBase + range.detailVertCount;
        const triEnd = range.triBase + range.triCount;

        // 3) 从主 mesh 中删除该 tile 占用的顶点/多边形/邻接记录。
        // =========================
        // 1️⃣ 删除 mesh verts（float x3）
        // =========================
        const vertMoveCount = mesh.vertslength - vertEnd;
        if (vertMoveCount > 0) {
            mesh.verts.copyWithin(
                range.vertBase * 3,
                vertEnd * 3,
                mesh.vertslength * 3
            );
        }
        mesh.vertslength -= range.vertCount;
        // =========================
        // 2️⃣ 删除 polys
        // =========================
        const polyMoveCount = mesh.polyslength - polyEnd;
        const oldpolylen=mesh.polyslength;
        if (polyMoveCount > 0) {
            mesh.polys.copyWithin(
                range.polyBase * 2,
                polyEnd * 2,
                mesh.polyslength * 2
            );
        }
        mesh.polyslength -= range.polyCount;

        // neighbors 也要左移
        mesh.neighbors.splice(range.polyBase, range.polyCount);

        // =========================
        // 3️⃣ 重映射 poly 顶点索引
        // =========================
        for (let i = range.polyBase; i < mesh.polyslength; i++) {

            const pi = i << 1;

            let start = mesh.polys[pi];
            let end   = mesh.polys[pi + 1];

            if (start >= vertEnd) {
                start -= range.vertCount;
                end   -= range.vertCount;
                mesh.polys[pi] = start;
                mesh.polys[pi + 1] = end;
            }
        }
        // =========================
        // 4️⃣ 重映射 neighbors poly index
        // =========================
        for (let p = 0; p < mesh.polyslength; p++) {

            const ppolyStart = mesh.polys[p << 1];
            const ppolyEnd   = mesh.polys[(p << 1) + 1];
            const vertCount = ppolyEnd - ppolyStart + 1;

            for (let e = 0; e < vertCount; e++) {

                const list = mesh.neighbors[p][e];
                const count = list[0];

                let write = 1;

                for (let i = 1; i <= count; i++) {

                    const n = list[i];

                    if (n >= range.polyBase && n < polyEnd) {
                        continue; // 删除
                    }

                    list[write++] = n >= polyEnd
                        ? n - range.polyCount
                        : n;
                }

                list[0] = write - 1;
            }
        }

        // =========================
        // 5️⃣ 删除 detail verts
        // =========================
        const dMove = detail.vertslength - dVertEnd;
        if (dMove > 0) {
            detail.verts.copyWithin(
                range.detailVertBase * 3,
                dVertEnd * 3,
                detail.vertslength * 3
            );
        }
        detail.vertslength -= range.detailVertCount;
        // =========================
        // 6️⃣ 删除 detail tris
        // =========================
        const triMove = detail.trislength - triEnd;
        if (triMove > 0) {
            detail.tris.copyWithin(
                range.triBase * 3,
                triEnd * 3,
                detail.trislength * 3
            );

            detail.triTopoly.copyWithin(
                range.triBase,
                triEnd,
                detail.trislength
            );
        }
        detail.trislength -= range.triCount;

        // =========================
        // 7️⃣ 重映射 detail tris 顶点
        // =========================
        for (let i = range.triBase*3; i < detail.trislength * 3; i++) {
            const v = detail.tris[i];
            if (v >= dVertEnd) {
                detail.tris[i] = v - range.detailVertCount;
            }
        }

        // =========================
        // 8️⃣ 重映射 triTopoly
        // =========================
        for (let i = range.triBase; i < detail.trislength; i++) {
            const p = detail.triTopoly[i];
            if (p >= polyEnd) {
                detail.triTopoly[i] = p - range.polyCount;
            }
        }

        detail.baseVert.copyWithin(range.polyBase, polyEnd, oldpolylen);
        detail.vertsCount.copyWithin(range.polyBase, polyEnd, oldpolylen);
        detail.baseTri.copyWithin(range.polyBase, polyEnd, oldpolylen);
        detail.triCount.copyWithin(range.polyBase, polyEnd, oldpolylen);
        for (let i = range.polyBase; i < mesh.polyslength; i++) {
            if (detail.baseVert[i] >= dVertEnd) detail.baseVert[i] -= range.detailVertCount;
            if (detail.baseTri[i]  >= triEnd)   detail.baseTri[i]  -= range.triCount;
        }

        // =========================
        // 9️⃣ 重映射 Links（TypedArray 版本）
        // =========================
        const remapLinks = (/** @type {NavMeshLink} */ linkSet) => {

            let write = 0;

            for (let i = 0; i < linkSet.length; i++) {

                const a = linkSet.poly[i << 1];
                const b = linkSet.poly[(i << 1) + 1];

                if (
                    (a >= range.polyBase && a < polyEnd) ||
                    (b >= range.polyBase && b < polyEnd)
                ) {
                    continue;
                }

                linkSet.poly[write << 1] =
                    a >= polyEnd ? a - range.polyCount : a;

                linkSet.poly[(write << 1) + 1] =
                    b >= polyEnd ? b - range.polyCount : b;

                linkSet.cost[write] = linkSet.cost[i];
                linkSet.type[write] = linkSet.type[i];

                for (let k = 0; k < 6; k++) {
                    linkSet.pos[write * 6 + k] =
                        linkSet.pos[i * 6 + k];
                }

                write++;
            }

            linkSet.length = write;
        };

        remapLinks(this.baseLinks);
        remapLinks(this.Extlink);
        remapLinks(this.supprlink);

        // =========================
        // 🔟 更新 tileRanges
        // =========================
        this.tileRanges.delete(tileId);

        for (const [k, r] of this.tileRanges.entries()) {

            if (r.vertBase > range.vertBase)
                r.vertBase -= range.vertCount;

            if (r.polyBase > range.polyBase)
                r.polyBase -= range.polyCount;

            if (r.detailVertBase > range.detailVertBase)
                r.detailVertBase -= range.detailVertCount;

            if (r.triBase > range.triBase)
                r.triBase -= range.triCount;

            if (r.meshRecBase > range.meshRecBase)
                r.meshRecBase -= range.meshRecCount;

            this.tileRanges.set(k, r);
        }
    }
    /**
     * 获取指定 Tile 及其邻居（含对角线）的所有开放边（无邻接的多边形边）。
     *
     * 返回的 result 数组每 3 个元素为一条边 [poly, vertA, vertB]，
     * tilemark 记录每个 poly 属于目标 Tile (2) 还是邻居 Tile (1)，
     * 用于 JumpLinkBuilder.initInterTileIn() 判断跨 Tile 连接方向。
     *
     * @param {string} targettileId - 目标 Tile 标识
     * @returns {{edgeCount: number, result: Uint16Array, tilemark: Uint8Array}}
     */
    getedgebytileid(targettileId)
    {
        /**
         * @type {string[]}
         */
        let neitileid = [];
        const tileData = this.tiles.get(targettileId);
        if (tileData) neitileid=this._collectNeighborTiles(tileData.tx, tileData.ty, true);
        const tilemark=new Uint8Array(4096*3);
        const result = new Uint16Array(4096 * 3);
        let edgeCount = 0;
        for (const tileId of neitileid) {
            const range=this.tileRanges.get(tileId);
            if(!range)continue;
            const end = range.polyBase + range.polyCount;
            for (let p = range.polyBase; p < end; p++) {
                const polyStart = this.mesh.polys[p << 1];
                const polyEnd   = this.mesh.polys[(p << 1) + 1];
                const vertCount = polyEnd - polyStart + 1;
                if(targettileId===tileId)tilemark[p]=2;
                else tilemark[p]=1;
                for (let j = 0; j < vertCount; j++) {
                    // 如果没有邻居，就是边界边
                    if (this.mesh.neighbors[p][j][0] === 0) {
                        const vi1 = polyStart + j;
                        const vi2 = polyStart + ((j + 1) % vertCount);
                        const idx =  edgeCount*3;
                        result[idx] = p;
                        result[idx+1] = vi1;
                        result[idx + 2] = vi2;
                        edgeCount++;
                   }
                }
            }
        }
        return { edgeCount, result, tilemark };
    }
    /**
     * 重建延迟连接（跨 Tile 跳跃 + 补充连接），并将所有连接合并到 this.links。
     *
     * Extjump=true 时根据 targettileId 增量生成跨 Tile 跳跃连接；
     * Supperlink=true 时为全局 mesh 重建梯子/地图跳跃点/传送门连接。
     * 最后将 baseLinks + Extlink + supprlink 三层合并为 this.links。
     *
     * @param {boolean} Extjump - 是否生成跨 Tile 跳跃连接
     * @param {boolean} Supperlink - 是否重建补充连接（梯子/传送门等）
     * @param {string} [targettileId] - 指定 Tile 时仅对其增量生成；不传则触发全局重建
     */
    _rebuildDeferredLinks(Extjump,Supperlink,targettileId) {
        if(Extjump&&targettileId)
        {
            const { edgeCount, result, tilemark } = this.getedgebytileid(targettileId);
            if(Extjump)this.Extlink = new JumpLinkBuilder(this.mesh).initInterTileIn(edgeCount,result,tilemark,this.Extlink);//15ms
        }
        if(Supperlink)
        {
            Tool.buildSpatialIndex(this.mesh);//ladder最后才会运行，弄完后才会裁剪，裁剪也会使用这个
            this.supprlink= this.buildSupperLinksForMesh(this.mesh);
        }
        let merged = this.copyLinks(this.baseLinks, this.Extlink);
        merged = this.copyLinks(merged, this.supprlink);
        this.links = merged;
    }
    /**
     * 把 b 追加到 a 后面，返回新的 link
     * @param {NavMeshLink} a
     * @param {NavMeshLink} b
     * @returns {NavMeshLink}
     */
    copyLinks(a, b) {
        const total = a.length + b.length;
        /** @type {NavMeshLink} */
        const merged = {
            poly: new Uint16Array(total * 2),
            cost: new Float32Array(total),
            type: new Uint8Array(total),
            pos:  new Float32Array(total * 6),
            length: total
        };

        let linkOff = 0;
        let polyOff = 0;
        let posOff  = 0;

        const append = (/** @type {NavMeshLink} */ src) => {
            if (!src || src.length === 0) return;

            merged.poly.set(src.poly.subarray(0, src.length * 2), polyOff);
            merged.cost.set(src.cost.subarray(0, src.length), linkOff);
            merged.type.set(src.type.subarray(0, src.length), linkOff);
            merged.pos.set(src.pos.subarray(0, src.length * 6), posOff);

            polyOff += src.length * 2;
            linkOff += src.length;
            posOff  += src.length * 6;
        };

        append(a); // 先 a
        append(b); // 再 b（追加到后面）
        return merged;
    }
    /**
     * 构建 poly 索引→Tile 标识的映射数组。
     *
     * 如果传入 targettileId，仅填充该 Tile 及其 8 邻居的多边形；
     * 否则遍历所有 tileRanges 填充整个数组。
     * 返回的数组长度等于 mesh.polyslength，索引为 poly ID。
     *
     * @param {string} [targettileId] - 可选的目标 Tile 标识
     * @returns {string[]} 每个 poly 对应的 tileId
     */
    _buildPolyTileKeys(targettileId) {
        /**
         * @type {string[]}
         */
        let neitileid = [];
        const polyTileKeys = new Array(this.mesh.polyslength);
        
        if (targettileId) {
            const tileData = this.tiles.get(targettileId);
            if (tileData) neitileid=this._collectNeighborTiles(tileData.tx, tileData.ty, true);
            for (const tileId of neitileid) {
                const range=this.tileRanges.get(tileId);
                if(!range)continue;
                const end = range.polyBase + range.polyCount;
                for (let p = range.polyBase; p < end; p++) {
                    polyTileKeys[p] = tileId;
                }
            }
        }
        else {
            for (const [tileId, range] of this.tileRanges.entries()) {
                const end = range.polyBase + range.polyCount;
                for (let p = range.polyBase; p < end; p++) {
                    polyTileKeys[p] = tileId;
                }
            }
        }
        return polyTileKeys;
    }

    /**
     * 根据世界坐标重建其所在的 Tile。
     *
     * 调用 tileBuilder.buildTileNavMeshAtPos 构建 Tile，然后 updatetile 更新全局数据。
     * 若开启 TILE_OPTIMIZATION_1 则进行可达性裁剪。
     *
     * @param {tile} tileBuilder - Tile 构建器
     * @param {{x:number,y:number,z:number}} pos - 世界坐标
     * @returns {TileData|null} 新构建的 Tile 数据，或 null
     */
    rebuildAtPos(tileBuilder, pos) {
        const tileData = tileBuilder.buildTileNavMeshAtPos(pos);
        if (!tileData) return null;
        this.updatetile(tileData.tileId, tileData.tx, tileData.ty, tileData.mesh, tileData.detail, tileData.links);
        this.pruneUnreachablePolys();
        return tileData;
    }

    /**
     * 切换 pos 所在 Tile 的加载状态。
     *
     * 若该 Tile 已存在则移除（返回 false），若不存在则构建并添加（返回 true）。
     * 开启 TILE_OPTIMIZATION_1 时自动执行可达性裁剪。
     *
     * @param {tile} tileBuilder - Tile 构建器
     * @param {{x:number,y:number,z:number}} pos - 世界坐标
     * @returns {boolean} true 表示添加，false 表示移除
     */
    reversetile(tileBuilder, pos) {
        const tileId = tileBuilder.fromPosGetTile(pos);
        if (this.tiles.has(tileId)) {
            this.removetile(tileId);
            this.pruneUnreachablePolys();
            return false;
        }
        const tileData = tileBuilder.buildTileNavMeshAtPos(pos);
        this.addtile(tileId, tileData.tx, tileData.ty, tileData.mesh, tileData.detail, tileData.links || []);
        this.pruneUnreachablePolys();
        return true;
    }

    /**
     * 可达性裁剪：以场景中 name="navmesh" 的 info_target 为种子，
     * BFS 遍历 neighbors + links，删除所有不可达的多边形。
     *
     * 具体步骤：
     * 1. 查找种子 poly（离 info_target 最近的 poly）
     * 2. 建立 links 的 poly 邻接表
     * 3. BFS 标记所有可达 poly
     * 4. 构建 oldToNewPoly 重映射表
     * 5. 拷贝可达的 verts、polys、neighbors 到 prunemesh
     * 6. 拷贝可达的 detail verts/tris 到 prunemeshdetail
     * 7. 拷贝两端均可达的 links 到 prunelinks
     */
    pruneUnreachablePolys() {//15ms
        const mesh = this.mesh;
        const detail = this.meshdetail;
        const polyCount = mesh.polyslength;

        if (polyCount === 0) return;
        /** @type {number[]} */
        const seedPolys = [];
        const slist = Instance.FindEntitiesByClass("info_target");
        for (const ent of slist) {
            if (ent.GetEntityName() === "navmesh") {
                const seed = Tool.findNearestPoly(ent.GetAbsOrigin(), this.mesh).poly;
                if (seed >= 0 && seed < polyCount) seedPolys.push(seed);
            }
        }
        if (seedPolys.length === 0) {
            Instance.Msg("可达性筛选跳过: 未找到 info_target{name=navmesh} 种子");
            return;
        }
        const reachable = new Uint8Array(polyCount);
        const queue = new Int32Array(polyCount);
        let keepCount = 0;
        let qh = 0, qt = 0;
        // 入队 seed
        for (const s of seedPolys) {
            if (reachable[s]) continue;
            reachable[s] = 1;
            keepCount++;
            queue[qt++] = s;
        }

        // 先把 links 建成按 poly 的邻接（一次性）
        const linkAdj = new Array(polyCount);
        for (let i = 0; i < polyCount; i++) linkAdj[i] = [];
        for (let i = 0; i < this.links.length; i++) 
        {
            const a = this.links.poly[i << 1];
            const b = this.links.poly[(i << 1) + 1];
            if (a >= 0 && a < polyCount && b >= 0 && b < polyCount)
            {
                linkAdj[a].push(b);
                linkAdj[b].push(a);
            }
        }

        // BFS
        while (qh < qt) 
        {
            const p = queue[qh++];

            // 走 neighbors
            const ps = mesh.polys[p << 1];
            const pe = mesh.polys[(p << 1) + 1];
            const edgeCount = pe - ps + 1;
            const edges = mesh.neighbors[p];
            for (let e = 0; e < edgeCount; e++) 
            {
                const list = edges[e];
                const count = list[0] | 0;
                for (let k = 1; k <= count; k++) {
                const n = list[k];
                if (n < 0 || n >= polyCount || reachable[n]) continue;
                reachable[n] = 1;
                keepCount++;
                queue[qt++] = n;
                }
            }

            // 走 links
            const la = linkAdj[p];
            for (let i = 0; i < la.length; i++) 
            {
                const n = la[i];
                if (reachable[n]) continue;
                reachable[n] = 1;
                keepCount++;
                queue[qt++] = n;
            }
        }

        const oldToNewPoly = new Int32Array(polyCount).fill(-1);

        let newPolyCount = 0;
        for (let i = 0; i < polyCount; i++) {
            if (reachable[i]) oldToNewPoly[i] = newPolyCount++;
        }
        // =========================
        // 5️⃣ 统计新 verts 数量
        // =========================

        const vertUsed = new Uint8Array(mesh.vertslength);
        let newVertCount = 0;

        for (let p = 0; p < polyCount; p++) {

            if (!reachable[p]) continue;

            const start = mesh.polys[p<<1];
            const end   = mesh.polys[(p<<1)+1];

            for (let v = start; v <= end; v++) {
                if (!vertUsed[v]) {
                    vertUsed[v] = 1;
                    newVertCount++;
                }
            }
        }

        const vertRemap = new Int32Array(mesh.vertslength).fill(-1);

        let writeV = 0;
        for (let i = 0; i < mesh.vertslength; i++) {
            if (vertUsed[i])
                vertRemap[i] = writeV++;
        }
        // =========================
        // 6️⃣ 构建 prunemesh
        // =========================
        /** @type {NavMeshMesh} */
        const newMesh = {
            verts: new Float32Array(newVertCount * 3),
            polys: new Int32Array(newPolyCount * 2),
            neighbors: new Array(newPolyCount),
            regions: new Int16Array(0),//无用
            polyslength: newPolyCount,
            vertslength: newVertCount
        };
        // verts copy
        for (let i = 0; i < mesh.vertslength; i++) {

            if (!vertUsed[i]) continue;

            const nv = vertRemap[i];

            newMesh.verts[nv*3]     = mesh.verts[i*3];
            newMesh.verts[nv*3 + 1] = mesh.verts[i*3 + 1];
            newMesh.verts[nv*3 + 2] = mesh.verts[i*3 + 2];
        }
        // polys copy
        for (let p = 0; p < polyCount; p++) {

            if (!reachable[p]) continue;

            const np = oldToNewPoly[p];

            const start = mesh.polys[p<<1];
            const end   = mesh.polys[(p<<1)+1];

            newMesh.polys[np<<1]     = vertRemap[start];
            newMesh.polys[(np<<1)+1] = vertRemap[end];

            // neighbors
            //////////////////////
            const edgeList = mesh.neighbors[p];
            const vertCount = end - start + 1;
            const newEdges = new Array(vertCount);

            for (let e = 0; e < vertCount; e++) {

                const list = edgeList[e];
                const count = list[0];

                const newList = new Int16Array(count + 1);

                let w = 1;

                for (let i = 1; i <= count; i++) {

                    const newIdx = oldToNewPoly[list[i]];
                    if (newIdx !== -1)newList[w++] = newIdx;
                }

                newList[0] = w - 1;
                newEdges[e] = newList;
            }

            newMesh.neighbors[np] = newEdges;
        }
        // =========================
        // 7️⃣ 统计 tri 数量
        // =========================

        let newTriCount = 0;

        for (let p = 0; p < polyCount; p++) {

            if (!reachable[p]) continue;
            newTriCount += detail.triCount[p];
        }
        let newDetailVertCount = 0;

        const detailVertRemap = new Int32Array(detail.vertslength);
        detailVertRemap.fill(-1);
        for (let t = 0; t < detail.trislength; t++) {
            if (!reachable[detail.triTopoly[t]]) continue;
            const base = t * 3;
            detailVertRemap[detail.tris[base]]     = newDetailVertCount++;
            detailVertRemap[detail.tris[base + 1]] = newDetailVertCount++;
            detailVertRemap[detail.tris[base + 2]] = newDetailVertCount++;
        }

        /**@type {NavMeshDetail} */
        const newDetail = {
            verts: new Float32Array(newDetailVertCount * 3),
            vertslength: newDetailVertCount,
            tris: new Uint16Array(newTriCount * 3),
            triTopoly: new Uint16Array(newTriCount),
            trislength: newTriCount,
            baseVert: new Uint16Array(newPolyCount),
            vertsCount: new Uint16Array(newPolyCount),
            baseTri: new Uint16Array(newPolyCount),
            triCount: new Uint16Array(newPolyCount)
        };
        for (let i = 0; i < detail.vertslength; i++) {

            const newIdx = detailVertRemap[i];
            if (newIdx === -1) continue;

            newDetail.verts[newIdx*3]     = detail.verts[i*3];
            newDetail.verts[newIdx*3 + 1] = detail.verts[i*3 + 1];
            newDetail.verts[newIdx*3 + 2] = detail.verts[i*3 + 2];
        }
        let writeTri = 0;

        for (let oldP = 0; oldP < polyCount; oldP++) {
            if (!reachable[oldP]) continue;
            const newP = oldToNewPoly[oldP];

            const triBase  = detail.baseTri[oldP];
            const triCount = detail.triCount[oldP];

            newDetail.baseVert[newP] = detail.baseVert[oldP];
            newDetail.vertsCount[newP] = detail.vertsCount[oldP];
            newDetail.baseTri[newP] = writeTri;
            newDetail.triCount[newP] = triCount;

            for (let t = 0; t < triCount; t++) {

                const oldTriIdx = triBase + t;

                const baseOld = oldTriIdx * 3;
                const baseNew = writeTri * 3;

                newDetail.tris[baseNew] =
                    detailVertRemap[detail.tris[baseOld]];

                newDetail.tris[baseNew + 1] =
                    detailVertRemap[detail.tris[baseOld + 1]];

                newDetail.tris[baseNew + 2] =
                    detailVertRemap[detail.tris[baseOld + 2]];

                newDetail.triTopoly[writeTri] = newP;

                writeTri++;
            }
        }
        this.prunemesh = newMesh;
        this.prunemeshdetail = newDetail;
        // =========================
        // 8️⃣ link copy
        // =========================

        const linkSet = this.links;

        let newLinkCount = 0;

        for (let i = 0; i < linkSet.length; i++) {
            const a = oldToNewPoly[linkSet.poly[i<<1]];
            const b = oldToNewPoly[linkSet.poly[(i<<1)+1]];
            if (a !== -1 && b !== -1)
                newLinkCount++;
        }
        /**@type {NavMeshLink} */
        const newLinks = {
            poly: new Uint16Array(newLinkCount * 2),
            cost: new Float32Array(newLinkCount),
            type: new Uint8Array(newLinkCount),
            pos:  new Float32Array(newLinkCount * 6),
            length: newLinkCount
        };

        let w = 0;

        for (let i = 0; i < linkSet.length; i++) {

            const na = oldToNewPoly[linkSet.poly[i<<1]];
            const nb = oldToNewPoly[linkSet.poly[(i<<1)+1]];

            if (na === -1 || nb === -1) continue;

            newLinks.poly[w<<1]     = na;
            newLinks.poly[(w<<1)+1] = nb;
            newLinks.cost[w] = linkSet.cost[i];
            newLinks.type[w] = linkSet.type[i];

            for (let k=0;k<6;k++)
                newLinks.pos[w*6+k] = linkSet.pos[i*6+k];

            w++;
        }
        this.prunelinks = newLinks;
        Instance.Msg(`可达性筛选完成: ${polyCount} -> ${keepCount}`);
    }
    /**
     * 为一条开放边构建空间查询记录，用于跨 Tile 邻接匹配。
     *
     * 计算边的主轴方向（X 或 Y）、在副轴上的 lineCoord（用于 bucket 分组）、
     * 在主轴上的投影区间 [projMin, projMax]、单位方向向量、中心 Z 等信息。
     * bucket 分组策略基于 MESH_CELL_SIZE_XY × 0.6 的缩放因子。
     *
     * @param {NavMeshMesh} mesh - 全局多边形网格
     * @param {number} poly - 多边形索引
     * @param {number} edge - 边索引
     * @param {number} va - 边起点的全局顶点索引
     * @param {number} vb - 边终点的全局顶点索引
     * @returns {{poly:number, edge:number, va:number, vb:number, exactKey:string, major:number, lineCoord:number, projMin:number, projMax:number, dirX:number, dirY:number, centerZ:number, bucketId:number}}
     */
    buildOpenEdgeRecord(mesh, poly, edge, va, vb) {
        const ax = mesh.verts[va * 3];
        const ay = mesh.verts[va * 3 + 1];
        const az = mesh.verts[va * 3 + 2];

        const bx = mesh.verts[vb * 3];
        const by = mesh.verts[vb * 3 + 1];
        const bz = mesh.verts[vb * 3 + 2];

        const dx = bx - ax;
        const dy = by - ay;

        const len = Math.hypot(dx, dy);
        const major = Math.abs(dx) >= Math.abs(dy) ? 0 : 1;
        const lineCoord = major === 0
        ? (ay + by) * 0.5
        : (ax + bx) * 0.5;

        const pa = major === 0 ? ax : ay;
        const pb = major === 0 ? bx : by;

        const projMin = Math.min(pa, pb);
        const projMax = Math.max(pa, pb);
        const invLen = len > 1e-6 ? 1 / len : 0;

        const dirX = dx * invLen;
        const dirY = dy * invLen;

        const centerZ = (az + bz) * 0.5;

        const bucketScale = Math.max(1e-4, MESH_CELL_SIZE_XY * 0.6);
        const bucketId = Math.round(lineCoord / bucketScale);

        return { poly, edge, va, vb, exactKey: `${va}|${vb}`, major, lineCoord, projMin, projMax, dirX, dirY, centerZ, bucketId, };
    }

    /**
     * 跨 Tile 边界的模糊匹配：在 bucket 中查找与当前边方向相反、XY/Z 投影重叠的候选边。
     *
     * 匹配条件：
     * - 主轴相同且 lineCoord 误差在 lineTol 内
     * - 方向点积 < -0.8（近似反向）
     * - XY 投影间距 < maxProjGapXY 且主轴重叠 >= minXYOverlap
     * - Z 重叠区间间距 < maxZDiff（可行走高度）
     *
     * @param {NavMeshMesh} mesh - 全局多边形网格
     * @param {Map<string,any[]>} buckets - 由 buildOpenEdgeRecord 产生的空间 bucket 分组
     * @param {number} poly - 当前多边形索引
     * @param {number} edge - 当前边索引
     * @param {number} tilePolyStart - 当前 Tile 的 poly 起始索引，避免自匹配
     * @param {any[]} candidates - 输出：匹配到的候选边记录
     * @param {Set<string>} dedup - 去重集合
     */
    findOpenEdgesByOverlap(mesh, buckets, poly, edge, tilePolyStart,candidates,dedup) {

        const polys = mesh.polys;
        const verts = mesh.verts;

        const polyStart = polys[poly << 1];
        const polyEnd   = polys[(poly << 1) + 1];
        const vertCount = polyEnd - polyStart + 1;

        const va = polyStart + edge;
        const vb = polyStart + ((edge + 1) % vertCount);

        const ax = verts[va * 3];
        const ay = verts[va * 3 + 1];
        const az = verts[va * 3 + 2];

        const bx = verts[vb * 3];
        const by = verts[vb * 3 + 1];
        const bz = verts[vb * 3 + 2];

        const dx = bx - ax;
        const dy = by - ay;

        const len = Math.hypot(dx, dy);
        const invLen = len > 1e-6 ? 1 / len : 0;

        const dirX = dx * invLen;
        const dirY = dy * invLen;

        const major = Math.abs(dx) >= Math.abs(dy) ? 0 : 1;

        const lineCoord = major === 0
            ? (ay + by) * 0.5
            : (ax + bx) * 0.5;

        const pa = major === 0 ? ax : ay;
        const pb = major === 0 ? bx : by;

        const projMin = pa < pb ? pa : pb;
        const projMax = pa > pb ? pa : pb;

        const bucketScale = Math.max(1e-4, MESH_CELL_SIZE_XY * 0.6);
        const bucketId = Math.round(lineCoord / bucketScale);

        const lineTol = MESH_CELL_SIZE_XY * 0.6;
        const maxProjGapXY = MESH_CELL_SIZE_XY;
        const minXYOverlap = 0.1;
        const maxZDiff = MAX_WALK_HEIGHT * MESH_CELL_SIZE_Z;

        for (let b = bucketId - 1; b <= bucketId + 1; b++) {

            const bucketKey = `${major}|${b}`;
            const bucket = buckets.get(bucketKey);
            if (!bucket) continue;

            for (let i = 0; i < bucket.length; i++) {

                const candidate = bucket[i];

                if (candidate.poly === poly) continue;
                if (candidate.poly >= tilePolyStart) continue;
                if (Math.abs(candidate.lineCoord - lineCoord) > lineTol) continue;

                const dot = dirX * candidate.dirX + dirY * candidate.dirY;
                if (dot > -0.8) continue;

                // ===== XY 投影 gap =====

                const cva = candidate.va;
                const cvb = candidate.vb;

                const cax = verts[cva * 3];
                const cay = verts[cva * 3 + 1];
                const caz = verts[cva * 3 + 2];

                const cbx = verts[cvb * 3];
                const cby = verts[cvb * 3 + 1];
                const cbz = verts[cvb * 3 + 2];

                const curXMin = ax < bx ? ax : bx;
                const curXMax = ax > bx ? ax : bx;
                const curYMin = ay < by ? ay : by;
                const curYMax = ay > by ? ay : by;

                const candXMin = cax < cbx ? cax : cbx;
                const candXMax = cax > cbx ? cax : cbx;
                const candYMin = cay < cby ? cay : cby;
                const candYMax = cay > cby ? cay : cby;

                const gapX = Math.max(0, Math.max(curXMin, candXMin) - Math.min(curXMax, candXMax));
                const gapY = Math.max(0, Math.max(curYMin, candYMin) - Math.min(curYMax, candYMax));

                if (Math.hypot(gapX, gapY) >= maxProjGapXY) continue;

                // ===== 主轴 overlap =====

                const overlapMin = projMin > candidate.projMin ? projMin : candidate.projMin;
                const overlapMax = projMax < candidate.projMax ? projMax : candidate.projMax;

                if (overlapMax <= overlapMin) continue;
                if ((overlapMax - overlapMin) < minXYOverlap) continue;

                // ===== Z overlap =====

                const ca = major === 0 ? ax : ay;
                const cb = major === 0 ? bx : by;
                const cdc = cb - ca;

                let zMinA, zMaxA;

                if (Math.abs(cdc) <= 1e-6) {
                    zMinA = az < bz ? az : bz;
                    zMaxA = az > bz ? az : bz;
                } else {
                    const inv = 1 / cdc;
                    const t0 = (overlapMin - ca) * inv;
                    const t1 = (overlapMax - ca) * inv;

                    const z0 = az + (bz - az) * t0;
                    const z1 = az + (bz - az) * t1;

                    zMinA = z0 < z1 ? z0 : z1;
                    zMaxA = z0 > z1 ? z0 : z1;
                }

                const cca = major === 0 ? cax : cay;
                const ccb = major === 0 ? cbx : cby;
                const cdc2 = ccb - cca;

                let zMinB, zMaxB;

                if (Math.abs(cdc2) <= 1e-6) {
                    zMinB = caz < cbz ? caz : cbz;
                    zMaxB = caz > cbz ? caz : cbz;
                } else {
                    const inv2 = 1 / cdc2;
                    const t0 = (overlapMin - cca) * inv2;
                    const t1 = (overlapMax - cca) * inv2;

                    const z0 = caz + (cbz - caz) * t0;
                    const z1 = caz + (cbz - caz) * t1;

                    zMinB = z0 < z1 ? z0 : z1;
                    zMaxB = z0 > z1 ? z0 : z1;
                }

                const gapZ = Math.max(0, Math.max(zMinA, zMinB) - Math.min(zMaxA, zMaxB));
                if (gapZ >= maxZDiff) continue;

                const key = candidate.poly + "|" + candidate.edge;
                if (dedup.has(key)) continue;

                dedup.add(key);
                candidates.push(candidate);
            }
        }

        return ;
    }
    /**
     * 为两个多边形的指定边双向添加邻接关系。
     *
     * 在 mesh.neighbors[polyA][edgeA] 中追加 polyB，
     * 同时在 mesh.neighbors[polyB][edgeB] 中追加 polyA。
     * 带匹配去重：已存在的邻接关系不会重复添加。
     *
     * @param {NavMeshMesh} mesh - 全局多边形网格
     * @param {number} polyA - 第一个多边形索引
     * @param {number} edgeA - polyA 的边索引
     * @param {number} polyB - 第二个多边形索引
     * @param {number} edgeB - polyB 的边索引
     */
    addNeighborLink(mesh, polyA, edgeA, polyB, edgeB) {
        const listA = mesh.neighbors[polyA][edgeA];
        const listB = mesh.neighbors[polyB][edgeB];
        // list[0] 存数量
        const countA = listA[0];
        let exists = false;

        for (let i = 1; i <= countA; i++) {
            if (listA[i] === polyB) {
                exists = true;
                break;
            }
        }

        if (!exists) {
            listA[0]++;
            listA[listA[0]] = polyB;
        }

        const countB = listB[0];
        exists = false;

        for (let i = 1; i <= countB; i++) {
            if (listB[i] === polyA) {
                exists = true;
                break;
            }
        }

        if (!exists) {
            listB[0]++;
            listB[listB[0]] = polyA;
        }
    }
}

/**
 * @module 导航网格/导航管理器
 */
/** @typedef {import("cs_script/point_script").Vector} Vector */
/** @typedef {import("./path_tilemanager").TileData} TileData */
/**
 * @typedef {{
 *  verts: Float32Array<ArrayBufferLike>,
 *  vertslength: number,
 *  polys: Int32Array<ArrayBufferLike>,
 *  polyslength: number,
 *  regions: Int16Array<ArrayBufferLike>,
 *  neighbors: Int16Array<ArrayBufferLike>[][]
 * }} NavMeshMesh
 */

/**
 * @typedef {{
 *  verts: Float32Array<ArrayBufferLike>,
 *  vertslength: number,
 *  tris: Uint16Array<ArrayBufferLike>,
 *  trislength: number,
 *  triTopoly: Uint16Array<ArrayBufferLike>,
 *  baseVert: Uint16Array<ArrayBufferLike>,
 *  vertsCount: Uint16Array<ArrayBufferLike>,
 *  baseTri: Uint16Array<ArrayBufferLike>,
 *  triCount: Uint16Array<ArrayBufferLike>
 * }} NavMeshDetail
 */

/**
 * @typedef {{
 *  poly: Uint16Array,
 *  cost: Float32Array,
 *  type: Uint8Array,
 *  pos: Float32Array,
 *  length: number
 * }} NavMeshLink
 */

/**
 * @typedef {{
 *  PolyA:number,
 *  PolyB:number,
 *  PosA:Vector,
 *  PosB:Vector,
 *  cost:number,
 *  type:number
 * }} NavMeshLinkARRAY
 */
/**
 * 主导航网格管理器（核心 API）。
 *
 * 协调所有 Navmesh 子系统，提供统一的寻路接口：
 * - `init()` — 加载静态数据 / 实时构建 Tile。
 * - `findPath(start, end)` — A* + Funnel + 高度修正 → 最终路径。
 * - `tick()` / `debug()` — 每帧更新和调试可视化。
 * - `exportNavData()` / `importNavData()` — 导航数据存档。
 *
 * 持有 TileManager、PolyGraphAStar、FunnelPath、FunnelHeightFixer、
 * NavMeshDebugTools 和 NVplugin（可选）。
 *
 * @navigationTitle 导航网格管理器
 */
class NavMesh {
    constructor() {
        /**@type {PolyGraphAStar} A* 多边形图寻路器，init 后初始化 */
        this.astar;
        /**@type {NavMeshMesh} 合并后的全局多边形网格（顶点/多边形/邻接） */
        this.mesh;
        /**@type {NavMeshDetail} 全局细节三角网 */
        this.meshdetail;
        /**@type {FunnelPath} 漏斗路径平滑器 */
        this.funnel;
        /**@type {FunnelHeightFixer} 路径高度修正器 */
        this.heightfixer;
        /**@type {NavMeshLink} 特殊连接点数据（跳点/梯子/传送门） */
        this.links;
        /** @type {TileManager} 瓦片管理器，负责拆分/合并/重建 Tile */
        this.tileManager = new TileManager(this);
        /** @type {tile} 单个 Tile 构建器（体素化 → 区域 → 轮廓 → 多边形） */
        this.tile = new tile();
        /** @type {NavMeshDebugTools} 调试可视化工具 */
        this.debugTools = new NavMeshDebugTools(this);
        //删除prop_door_rotating实体？也许应该弄一个目录，让作者把门一类的实体名字放里面
    }
    /**
     * 导出导航网格数据为 JSON 文本（按行截断输出到控制台）。
     *
     * 将所有 Tile 序列化为 JSON 字符串，并按 charsPerLine 切块
     * 输出到游戏控制台，便于复制粘贴存档。
     */
    exportNavData() {
        const charsPerLine = 500;
        const data = {
            tiles: Array.from(this.tileManager.tiles, ([key, td]) => [key, Tool._compactTileData(td)])
        };
        // 使用 JSON 序列化
        const jsonStr = JSON.stringify(data);
        // 2. 将字符串切割成指定长度的块
        Instance.Msg("--- NAV DATA START ---");
        for (let i = 0; i < jsonStr.length; i += charsPerLine) {
            Instance.Msg("+`"+jsonStr.substring(i, i + charsPerLine)+"`");
        }
        Instance.Msg("--- NAV DATA END ---");
    }
    /**
     * 从 JSON 文本恢复导航网格。
     *
     * 解析 Tile 数据并注入 TileManager，重建 Link 和空间索引。
     *
     * @param {string} jsonStr 序列化的导航数据
     * @returns {boolean} 是否加载成功
     */
    importNavData(jsonStr) {
        try {
            const cleanJson = jsonStr.replace(/\s/g, "");

            const data = JSON.parse(cleanJson);

            // 1. 恢复核心网格数据
            for (const tile of data.tiles) {
                const tiledata=tile[1];
                const key = tiledata.tileId;
                const mesh = Tool.toTypedMesh(tiledata.mesh);
                const detail = Tool.toTypedDetail(tiledata.detail);
                const links = Tool.toTypedLinks(tiledata.links);
                this.tileManager.tiles.set(key, {
                    tileId: key,
                    tx: tiledata.tx,
                    ty: tiledata.ty,
                    mesh: mesh,
                    detail: detail,
                    links: links
                });
                this.tileManager._appendTileData(key, mesh, detail, links);
                this.tileManager._rebuildDeferredLinks(true,false,key);
            }
            this.tileManager._rebuildDeferredLinks(false,true);
            if (TILE_OPTIMIZATION_1)this.tileManager.pruneUnreachablePolys();
            this.tileManager.updatemesh();
            Instance.Msg(`导航数据加载成功！多边形数量: ${this.mesh.polyslength-1}`);
            return true;
        } catch (e) {
            Instance.Msg(`加载导航数据失败: ${e}`);
            return false;
        }
    }
    /**
     * 初始化导航网格。
     *
     * 根据配置决定加载预烘焕的静态数据或实时构建所有 Tile。
     * 完成后初始化 A*、Funnel、HeightFixer 等运行时组件。
     */
    init() {
        this.tileManager = new TileManager(this);
        {
            this.importNavData(new StaticData().Data);
        }
        this._refreshRuntime();
    }
    /**
     * 更新指定位置所在 Tile 的导航网格。
     * 重建该 Tile 并刷新运行时组件（A*\\Funnel\\HeightFixer）。
     * @param {Vector} pos 世界坐标
     */
    update(pos)
    {
        this.tileManager.rebuildAtPos(this.tile, pos);
        this.tileManager.updatemesh();
        this._refreshRuntime();
    }
    /**
     * 刷新运行时组件。
     *
     * 根据当前全局 mesh / links 重建空间索引、A*、Funnel、HeightFixer。
     */
    _refreshRuntime() {
        Tool.buildSpatialIndex(this.mesh);
        
//        /** @type {Map<number, number>} */
//        const degree = new Map();
//        const globalLinks = this.links;
//        const globalLen = globalLinks?.length ?? 0;
//
//        // 1) 先统计每个 poly 需要多少条 link（双向展开）
//        for (let i = 0; i < globalLen; i++) {
//            const a = globalLinks.poly[i * 2];
//            const b = globalLinks.poly[i * 2 + 1];
//            if (a < 0 || b < 0) continue;
//
//            degree.set(a, (degree.get(a) ?? 0) + 1);
//            degree.set(b, (degree.get(b) ?? 0) + 1);
//        }
//
//        /**@type {NavMeshLink[]} */
//        const links=new Array();
//        // 2) 按统计容量分配，避免固定 32 溢出
//        for (const [poly, cnt] of degree.entries()) {
//            links[poly] = {
//                poly: new Uint16Array(cnt * 2),
//                cost: new Float32Array(cnt),
//                type: new Uint8Array(cnt),
//                pos: new Float32Array(cnt * 6),
//                length: 0
//            };
//        }
//
//        // 3) 写入双向 link（reverse 方向要交换 start/end）
//        for (let i = 0; i < globalLen; i++) {
//            const polyA = globalLinks.poly[i * 2];
//            const polyB = globalLinks.poly[i * 2 + 1];
//            if (polyA < 0 || polyB < 0) continue;
//
//            const cost = globalLinks.cost[i] * OFF_MESH_LINK_COST_SCALE;
//            const type = globalLinks.type[i];
//            const srcPosBase = i * 6;
//
//            const la = links[polyA];
//            const lb = links[polyB];
//            if (!la || !lb) continue;
//
//            // A -> B
//            let wa = la.length;
//            la.poly[wa * 2] = polyA;
//            la.poly[wa * 2 + 1] = polyB;
//            la.cost[wa] = cost;
//            la.type[wa] = type;
//            la.pos[wa * 6] = globalLinks.pos[srcPosBase];
//            la.pos[wa * 6 + 1] = globalLinks.pos[srcPosBase + 1];
//            la.pos[wa * 6 + 2] = globalLinks.pos[srcPosBase + 2];
//            la.pos[wa * 6 + 3] = globalLinks.pos[srcPosBase + 3];
//            la.pos[wa * 6 + 4] = globalLinks.pos[srcPosBase + 4];
//            la.pos[wa * 6 + 5] = globalLinks.pos[srcPosBase + 5];
//            la.length = wa + 1;
//
//            // B -> A（交换端点）
//            let wb = lb.length;
//            lb.poly[wb * 2] = polyB;
//            lb.poly[wb * 2 + 1] = polyA;
//            lb.cost[wb] = cost;
//            lb.type[wb] = type;
//            lb.pos[wb * 6] = globalLinks.pos[srcPosBase + 3];
//            lb.pos[wb * 6 + 1] = globalLinks.pos[srcPosBase + 4];
//            lb.pos[wb * 6 + 2] = globalLinks.pos[srcPosBase + 5];
//            lb.pos[wb * 6 + 3] = globalLinks.pos[srcPosBase];
//            lb.pos[wb * 6 + 4] = globalLinks.pos[srcPosBase + 1];
//            lb.pos[wb * 6 + 5] = globalLinks.pos[srcPosBase + 2];
//            lb.length = wb + 1;
//        }
        /**@type {Map<number,NavMeshLinkARRAY[]>} */
        const links = new Map();
        for (let i = 0; i < this.links.length; i++) {
            const polyA = this.links.poly[i * 2];
            const polyB = this.links.poly[i * 2 + 1];
            if (polyA < 0 || polyB < 0) continue;
            const cost = this.links.cost[i] * OFF_MESH_LINK_COST_SCALE;
            const type = this.links.type[i];
            const srcPosBase = i * 6;
            if (!links.has(polyA)) links.set(polyA, []);
            if (!links.has(polyB)) links.set(polyB, []);
            const link={
                PolyA: polyA,
                PolyB: polyB,
                PosA: {
                    x: this.links.pos[srcPosBase],
                    y: this.links.pos[srcPosBase + 1],
                    z: this.links.pos[srcPosBase + 2]
                },
                PosB: {
                    x: this.links.pos[srcPosBase + 3],
                    y: this.links.pos[srcPosBase + 4],
                    z: this.links.pos[srcPosBase + 5]
                },
                cost: cost,
                type: type
            };
            links.get(polyA)?.push(link);
            links.get(polyB)?.push(link);
        }
        this.heightfixer = new FunnelHeightFixer(this.mesh, this.meshdetail, ADJUST_HEIGHT_DISTANCE);
        this.astar = new PolyGraphAStar(this.mesh, links, this.heightfixer);
        this.funnel = new FunnelPath(this.mesh, this.astar.centers, links);
    }
    /**
     * 每帧更新。
     *
     * 驱动插件 tick，若开启 TILE_DEBUG 则显示当前所在 TileKey。
     *
     * @param {Vector} [pos] 玩家当前位置
     */
    tick(pos)
    {
    }
    /**
     * 调试可视化。
     *
     * 根据全局开关绘制多边形、细节三角网、Tile 边界、
     * 连接点和邻接关系等调试信息。
     *
     * @param {number} duration 调试绘制持续时间（秒）
     */
    debug(duration = 60) {
    }
    /**
     * 寻路主入口。
     *
     * A* 多边形搜索 → Funnel 路径平滑 → 可选高度修正，
     * 返回带移动模式的世界坐标航路点列表。
     *
     * @param {Vector} start 起点世界坐标
     * @param {Vector} end 终点世界坐标
     * @returns {{pos:Vector,mode:number}[]} 最终路径
     */
    findPath(start, end) {
        //Instance.DebugLine({start,end,duration:1,color:{r:0,g:255,b:0}});
        const polyPath=this.astar.findPath(start,end);
        //this.debugTools.debugDrawPolyPath(polyPath.path,1);
        //if (!polyPath || polyPath.path.length === 0) return [];
        const funnelPath = this.funnel.build(polyPath.path, polyPath.start, polyPath.end);
        //this.debugTools.debugDrawfunnelPath(funnelPath,0.5);
        return funnelPath;
        //if (!ans || ans.length === 0) return [];
        //多边形总数：649跳点数：82
        //100次A*           30ms
        //100次funnelPath   46ms-30=16ms
        //100次200fixHeight    100ms-46=54ms
    }
}

/**
 * @module 实体移动/常量配置
 */
// ── 运动模块内聚常量─────────────────

/** 世界重力 (hu/s²) */
const gravity = 800;
/** 地面摩擦系数 */
const friction = 6;
/** 爬台阶高度 (hu) */
const stepHeight = 13;
/** 路径节点到达判定距离 (hu) */
const goalTolerance = 20;
/** 终点到达判定距离 (hu) */
const arriveDistance = 1;
/** 转向速度 (度/s) */
const turnSpeed = 360;

// ── 碰撞相关 ────────────────────────────────────────────────
/** 碰撞盒最小点 */
const traceMins = { x: -4, y: -4, z: 1 };
/** 碰撞盒最大点 */
const traceMaxs = { x: 4, y: 4, z: 4 };
/** 碰撞面安全偏移距离 (hu) */
const surfaceEpsilon = 4;

// ── 怪物群体分离 ───────────────────────────────────────────
/** 怪物之间开始相互推开的 2D 半径 (hu)。
 * 该值需要和实际怪物占用尺寸一致，否则会出现视觉上重叠但没有分离的情况。
 */
const separationRadius = 32;
/** 分离力满额生效的近距离半径 (hu) */
const separationMinRadius = 10;
/** 最大分离速度 (hu/s) */
const separationMaxStrength = 150;

// ── 卡死检测 ────────────────────────────────────────────────
/** 低于此距离认为没动 (hu) */
const moveEpsilon = 0.5;
/** 持续多久算卡死 (s) */
const stuckTimeThreshold = 2;

// ── 路径节点类型 ────────────────────────────────────────────
/** @enum {number} */
const PathState = {
    WALK: 1,
    JUMP: 2,
    LADDER: 3,
    PORTAL: 4
};

/**
 * @module 实体移动/碰撞探测器
 */

/** @typedef {import("cs_script/point_script").Vector} Vector */
/** @typedef {import("cs_script/point_script").Entity} Entity */

/**
 * 碰撞探测器：封装 TraceBox 调用，提供 traceMove / traceGround / tryStep。
 */
class MoveProbe {
    /**
     * @param {{ mins?: Vector; maxs?: Vector }} [config]
     */
    constructor(config = {}) {
        this.mins = config.mins ?? traceMins;
        this.maxs = config.maxs ?? traceMaxs;
    }

    /**
     * 扫描前方是否被阻挡
     * @param {Vector} start
     * @param {Vector} end
     * @param {Entity[]} ignoreEntities
     */
    traceMove(start, end, ignoreEntities) {
        const tr = Instance.TraceBox({
            mins: this.mins,
            maxs: this.maxs,
            start,
            end,
            ignorePlayers: true,
            ignoreEntity: ignoreEntities
        });
        return {
            hit: !!(tr && tr.didHit),
            endPos: end,
            hitPos: vec$1.add(tr.end, vec$1.scale(tr.normal, surfaceEpsilon)),
            normal: tr.normal,
            fraction: tr.fraction
        };
    }

    /**
     * 向下检测地面
     * @param {Vector} pos
     * @param {Entity[]} ignoreEntities
     */
    traceGround(pos, ignoreEntities) {
        const start = vec$1.clone(pos);
        const end = vec$1.Zfly(pos, -8);
        const tr = Instance.TraceBox({
            mins: this.mins,
            maxs: this.maxs,
            start,
            end,
            ignorePlayers: true,
            ignoreEntity: ignoreEntities
        });
        if (!tr || !tr.didHit || tr.normal.z < 0.5) {
            return {
                hit: false,
                hitPos: vec$1.add(tr.end, vec$1.scale(tr.normal, surfaceEpsilon)),
                normal: tr.normal
            };
        }
        return {
            hit: true,
            hitPos: vec$1.add(tr.end, vec$1.scale(tr.normal, surfaceEpsilon)),
            normal: tr.normal
        };
    }

    /**
     * 尝试上台阶（上→前→下）
     * @param {Vector} start
     * @param {Vector} move
     * @param {number} step
     * @param {Entity[]} ignoreEntities
     */
    tryStep(start, move, step, ignoreEntities) {
        const up = vec$1.Zfly(start, step);
        const trUp = this.traceMove(start, up, ignoreEntities);
        if (trUp.hit) return { success: false, endPos: trUp.hitPos };

        const forwardEnd = vec$1.add(up, move);
        const trForward = this.traceMove(up, forwardEnd, ignoreEntities);
        if (trForward.hit) return { success: false, endPos: trUp.hitPos };

        const downEnd = vec$1.Zfly(forwardEnd, -step);
        const trDown = this.traceMove(forwardEnd, downEnd, ignoreEntities);
        if (!trDown.hit) return { success: false, endPos: trDown.hitPos };
        if (trDown.normal.z < 0.5) return { success: false, endPos: trDown.hitPos };

        return { success: true, endPos: trDown.hitPos };
    }
}

/**
 * @module 实体移动/运动电机
 */

/** @typedef {import("cs_script/point_script").Vector} Vector */
/** @typedef {import("cs_script/point_script").Entity} Entity */

/**
 * 运动电机：负责速度、重力、碰撞检测、地面吸附和位移推进。
 * 不感知任何业务语义（monster / path / mode 等）。
 *
 * 与旧 AIMotor 的区别：
 * - 不持有 Entity 引用，不调用 Teleport / GetAbsOrigin
 * - 所有方法接收当前位置、返回新位置，实际传送由门面层统一执行
 */
class Motor {
    /**
     * @param {{
     *   gravity?: number;
     *   friction?: number;
     *   stepHeight?: number;
     *   turnSpeed?: number;
     *   probe?: MoveProbe;
     * }} [config]
     */
    constructor(config = {}) {
        this.gravity = config.gravity ?? gravity;
        this.friction = config.friction ?? friction;
        this.stepHeight = config.stepHeight ?? stepHeight;
        this.turnSpeed = config.turnSpeed ?? turnSpeed;
        this.probe = config.probe ?? new MoveProbe();

        /** @type {Vector} */
        this.velocity = vec$1.get(0, 0, 0);
        this.onGround = false;
        this.wasOnGround = false;
        /** @type {{ hit: boolean; normal: Vector; point: Vector }} */
        this.ground = { hit: false, normal: vec$1.get(0, 0, 0), point: vec$1.get(0, 0, 0) };

        // ── 卡死检测 ──
        this._stuckLastPos = vec$1.get(0, 0, 0);
        this._stuckTime = 0;
    }

    // ───────────────────── 公共运动方法 ─────────────────────

    /**
     * 地面移动：摩擦→加速→分离→Step/Slide→贴地
     * @param {Vector} pos       当前位置
     * @param {Vector} wishDir   期望方向（单位向量）
     * @param {number} wishSpeed 期望速度
     * @param {number} dt        帧间隔
     * @param {{entities: Entity[], positions: Vector[]}} sepCtx 分离上下文
     * @returns {Vector} 新位置
     */
    moveGround(pos, wishDir, wishSpeed, dt, sepCtx) {
        this._applyFriction(dt);
        this._accelerate2D(wishDir, wishSpeed, dt);
        this.velocity = vec$1.add(this.velocity, this._computeSeparation(pos, sepCtx.positions));

        const move = vec$1.scale(this.velocity, dt);
        move.z = 0;

        let newPos = this._stepSlideMove(pos, move, sepCtx.entities).pos;
        this._updateGround(newPos, sepCtx.entities);
        newPos = this._snapToGround(newPos);
        this._updateStuck(newPos, dt);
        return newPos;
    }

    /**
     * 空中移动：弱方向控制 + 重力
     * @param {Vector} pos
     * @param {Vector} wishDir
     * @param {number} wishSpeed
     * @param {number} dt
     * @param {{entities: Entity[], positions: Vector[]}} sepCtx 分离上下文
     * @returns {Vector}
     */
    moveAir(pos, wishDir, wishSpeed, dt, sepCtx) {
        // 空中弱方向控制
        if (vec$1.length2Dsq(wishDir) > 0.1) {
            const wishDir2D = vec$1.normalize2D(wishDir);
            const airAccel = 10;
            const currentSpeed = vec$1.dot2D(this.velocity, wishDir2D);
            const addSpeed = wishSpeed - currentSpeed;
            if (addSpeed > 0) {
                const accelSpeed = Math.min(airAccel * dt * wishSpeed, addSpeed);
                this.velocity.x += accelSpeed * wishDir2D.x;
                this.velocity.y += accelSpeed * wishDir2D.y;
            }
        }
        // 重力
        this.velocity.z = Math.max(-this.gravity, this.velocity.z - this.gravity * dt);
        // 分离
        this.velocity = vec$1.add(this.velocity, this._computeSeparation(pos, sepCtx.positions));

        const move = vec$1.scale(this.velocity, dt);
        const result = this._airSlideMove(pos, move, sepCtx.entities);
        let newPos = result.pos;
        if (result.clipNormals.length) {
            for (const n of result.clipNormals) {
                this.velocity = this._clipVelocity(this.velocity, n);
            }
        }
        this._updateGround(newPos, sepCtx.entities);
        this._updateStuck(newPos, dt);
        return newPos;
    }

    /**
     * 飞行移动：3D 加速，无重力
     * @param {Vector} pos
     * @param {Vector} wishDir
     * @param {number} wishSpeed
     * @param {number} dt
     * @param {{entities: Entity[], positions: Vector[]}} sepCtx 分离上下文
     * @returns {Vector}
     */
    moveFly(pos, wishDir, wishSpeed, dt, sepCtx) {
        this._accelerate3D(wishDir, wishSpeed, dt);
        this.velocity = vec$1.add(this.velocity, this._computeSeparation(pos, sepCtx.positions));

        const move = vec$1.scale(this.velocity, dt);
        const result = this._airSlideMove(pos, move, sepCtx.entities);
        let newPos = result.pos;
        if (result.clipNormals.length) {
            for (const n of result.clipNormals) {
                this.velocity = this._clipVelocity(this.velocity, n);
            }
        }
        this.onGround = false;
        this._updateStuck(newPos, dt);
        return newPos;
    }

    /**
     * 梯子移动：XY 方向快速贴近目标，Z 方向缓慢变化。
     * @param {Vector} pos
     * @param {Vector} goalPos
     * @param {number} baseSpeed
     * @param {number} dt
     * @param {{entities: Entity[], positions: Vector[]}} sepCtx 分离上下文
     * @returns {Vector}
     */
    moveLadder(pos, goalPos, baseSpeed, dt, sepCtx) {
        const toGoal = vec$1.sub(goalPos, pos);
        const horizontalDelta = vec$1.get(toGoal.x, toGoal.y, 0);
        const horizontalDist = vec$1.length2D(horizontalDelta);
        const horizontalDir = vec$1.normalize2D(horizontalDelta);
        const horizontalSpeed = horizontalDist <= 4
            ? 0
            : Math.min(220, Math.max(baseSpeed * 1.5, horizontalDist * 8));
        const verticalSpeed = Math.abs(toGoal.z) <= 4
            ? 0
            : Math.sign(toGoal.z) * Math.min(96, Math.max(48, Math.abs(toGoal.z) * 2));

        this.velocity = vec$1.get(
            horizontalDir.x * horizontalSpeed,
            horizontalDir.y * horizontalSpeed,
            verticalSpeed
        );

        const move = vec$1.scale(this.velocity, dt);
        const result = this._airSlideMove(pos, move, sepCtx.entities);
        let newPos = result.pos;
        if (result.clipNormals.length) {
            for (const n of result.clipNormals) {
                this.velocity = this._clipVelocity(this.velocity, n);
            }
        }
        this.onGround = false;
        this._updateStuck(newPos, dt);
        return newPos;
    }

    stop() { this.velocity = vec$1.get(0, 0, 0); }
    isOnGround() { return this.onGround; }
    getVelocity() { return vec$1.clone(this.velocity); }

    /**
     * 计算朝向（yaw 角度）
     * @param {Vector} wishDir
     * @param {number} currentYaw 当前 yaw (度)
     * @param {number} dt
     * @returns {number} 新 yaw
     */
    computeYaw(wishDir, currentYaw, dt) {
        if (vec$1.length2Dsq(wishDir) < 0.1) return currentYaw;
        const targetYaw = Math.atan2(wishDir.y, wishDir.x) * 180 / Math.PI;
        let delta = targetYaw - currentYaw;
        while (delta > 180) delta -= 360;
        while (delta < -180) delta += 360;
        const maxStep = this.turnSpeed * dt;
        if (delta > maxStep) delta = maxStep;
        else if (delta < -maxStep) delta = -maxStep;
        return currentYaw + delta;
    }

    isStuck() { return this._stuckTime >= stuckTimeThreshold; }

    // ───────────────────── 内部方法 ─────────────────────────

    /** @param {number} dt */
    _applyFriction(dt) {
        if (vec$1.length2Dsq(this.velocity) < 0.1) return;
        const frictionScale = Math.max(0, 1 - this.friction * dt);
        this.velocity = vec$1.scale2D(this.velocity, frictionScale);
    }

    /** @param {Vector} wishDir @param {number} wishSpeed @param {number} dt */
    _accelerate2D(wishDir, wishSpeed, dt) {
        if (wishSpeed <= 0) return;
        const currentSpeed = vec$1.dot2D(this.velocity, wishDir);
        const addSpeed = wishSpeed - currentSpeed;
        if (addSpeed <= 0) return;
        const accelSpeed = Math.min(addSpeed, wishSpeed * dt * 10);
        this.velocity = vec$1.add2D(this.velocity, vec$1.scale(wishDir, accelSpeed));
    }

    /** @param {Vector} wishDir @param {number} wishSpeed @param {number} dt */
    _accelerate3D(wishDir, wishSpeed, dt) {
        if (wishSpeed <= 0) return;
        const currentSpeed = vec$1.dot(this.velocity, wishDir);
        const addSpeed = wishSpeed - currentSpeed;
        if (addSpeed <= 0) return;
        const accel = wishSpeed * dt * 10;
        const accelSpeed = Math.min(addSpeed, accel);
        this.velocity = vec$1.add(this.velocity, vec$1.scale(wishDir, accelSpeed));
    }

    /**
     * NPC-NPC 分离速度（直接消费位置缓存，不调用 GetAbsOrigin）
     * @param {Vector} pos        当前怪物位置
     * @param {Vector[]} positions 所有活跃怪物位置缓存
     * @returns {Vector}
     */
    _computeSeparation(pos, positions) {
        const radius = separationRadius;
        const radiusSq = radius * radius;
        const maxStrength = separationMaxStrength;
        const maxStrengthSq = maxStrength * maxStrength;
        const minRadiusSq = separationMinRadius * separationMinRadius;
        const falloffRangeSq = Math.max(1e-6, radiusSq - minRadiusSq);
        const minDistSq = 16;
        let sep = vec$1.get(0, 0, 0);
        for (let i = 0; i < positions.length; i++) {

            const otherPos = positions[i];
            let delta = vec$1.sub(pos, otherPos);
            const dist2Dsq = vec$1.length2Dsq(delta);
            if (dist2Dsq < minDistSq || vec$1.lengthsq(delta) > radiusSq) continue;
            delta.z = 0;
            const l1 = Math.abs(delta.x) + Math.abs(delta.y);
            if (l1 < 1e-6) continue;
            const dir = vec$1.scale(delta, 1 / l1);
            let strength = 1.0;
            if (dist2Dsq > minRadiusSq) {
                const t = Math.min(1, (dist2Dsq - minRadiusSq) / falloffRangeSq);
                strength = 1 - t * t * (3 - 2 * t);
            }
            sep = vec$1.add(sep, vec$1.scale(dir, strength * maxStrength));
        }
        const lenSq = vec$1.length2Dsq(sep);
        if (lenSq > maxStrengthSq) sep = vec$1.scale(sep, maxStrengthSq / lenSq);
        return sep;
    }

    /**
     * Step + Slide（地面碰撞处理）
     * @param {Vector} start
     * @param {Vector} move
     * @param {Entity[]} allm
     */
    _stepSlideMove(start, move, allm) {
        const end = vec$1.add(start, move);
        const direct = this.probe.traceMove(start, end, allm);
        if (!direct.hit) return { pos: direct.endPos };

        const step = this.probe.tryStep(start, move, this.stepHeight, allm);
        if (step.success) return { pos: step.endPos };

        const MAX_CLIPS = 3;
        let remaining = vec$1.clone(move);
        const clipNormals = [];
        let pos = start;
        for (let i = 0; i < MAX_CLIPS; i++) {
            if (vec$1.length2Dsq(remaining) < 0.1) break;
            const endPos = vec$1.add(pos, remaining);
            const tr = this.probe.traceMove(pos, endPos, allm);
            if (!tr.hit) return { pos: tr.endPos };
            pos = tr.hitPos;
            clipNormals.push(vec$1.clone(tr.normal));
            remaining = vec$1.scale(remaining, 1 - tr.fraction);
            remaining = this._clipMoveByNormals(remaining, clipNormals);
        }
        return { pos };
    }

    /**
     * 空中 Slide（TryPlayerMove 风格）
     * @param {Vector} start
     * @param {Vector} move
     * @param {Entity[]} allm
     */
    _airSlideMove(start, move, allm) {
        const MAX_CLIPS = 3;
        let remaining = vec$1.clone(move);
        /** @type {Vector[]} */
        const clipNormals = [];
        let pos = start;

        for (let i = 0; i < MAX_CLIPS; i++) {
            if (vec$1.lengthsq(remaining) < 0.1) break;
            const endPos = vec$1.add(pos, remaining);
            const tr = this.probe.traceMove(pos, endPos, allm);
            if (!tr.hit) return { pos: tr.endPos, clipNormals };
            pos = tr.hitPos;
            clipNormals.push(vec$1.clone(tr.normal));
            remaining = vec$1.scale(remaining, 1 - tr.fraction);
            remaining = this._clipMoveByNormals(remaining, clipNormals);
        }
        return { pos, clipNormals };
    }

    /**
     * @param {Vector} move
     * @param {Vector[]} normals
     */
    _clipMoveByNormals(move, normals) {
        let out = vec$1.clone(move);
        for (const n of normals) {
            const dot = vec$1.dot2D(out, n);
            if (dot < 0) out = vec$1.sub(out, vec$1.scale(n, dot));
        }
        return out;
    }

    /**
     * Source ClipVelocity
     * @param {Vector} vel
     * @param {Vector} normal
     * @param {number} [overbounce]
     */
    _clipVelocity(vel, normal, overbounce = 1.01) {
        const backoff = vec$1.dot(vel, normal);
        if (backoff >= 0) return vec$1.clone(vel);
        const change = vec$1.scale(normal, backoff * overbounce);
        const out = vec$1.sub(vel, change);
        if (Math.abs(out.x) < 0.0001) out.x = 0;
        if (Math.abs(out.y) < 0.0001) out.y = 0;
        if (Math.abs(out.z) < 0.0001) out.z = 0;
        return out;
    }

    /** @param {Vector} pos */
    _snapToGround(pos) {
        if (!this.wasOnGround || !this.onGround || this.velocity.z < -1 || !this.ground.hit) return pos;
        const dz = this.ground.point.z - pos.z;
        if (Math.abs(dz) > 4) return pos;
        pos.z = this.ground.point.z;
        return pos;
    }

    /**
     * @param {Vector} pos
     * @param {Entity[]} allm
     */
    _updateGround(pos, allm) {
        const tr = this.probe.traceGround(pos, allm);
        this.wasOnGround = this.onGround;
        this.ground.hit = false;
        if (!tr.hit || !tr.hitPos) { this.onGround = false; return; }
        if (tr.normal.z < 0.5) { this.onGround = false; return; }
        this.onGround = true;
        this.ground.hit = true;
        this.ground.normal = vec$1.clone(tr.normal);
        this.ground.point = vec$1.clone(tr.hitPos);
    }

    /**
     * 卡死检测 + 解卡
     * @param {Vector} pos
     * @param {number} dt
     */
    _updateStuck(pos, dt) {
        const moved = vec$1.lengthsq(vec$1.sub(pos, this._stuckLastPos));
        if (moved < moveEpsilon*moveEpsilon) { this._stuckTime += dt; } else { this._stuckTime = 0; }
        this._stuckLastPos = vec$1.clone(pos);
        // 不做自动解卡，由外层处理
    }
}

/**
 * @module 实体移动/路径跟随器
 */

/**
 * 路径游标：维护 {pos, mode}[] 路径数组与当前 cursor，
 * 提供 setPath / getMoveGoal / advanceIfReached 等接口。
 */
class PathFollower {
    constructor() {
        /** @type {{ pos: import("cs_script/point_script").Vector; mode: number }[]} */
        this.path = [];
        this.cursor = 0;
    }

    /** @param {{ pos: import("cs_script/point_script").Vector; mode: number }[]} path */
    setPath(path) {
        this.path = path.map(n => ({ pos: vec$1.clone(n.pos), mode: n.mode }));
        this.cursor = 0;
    }

    isFinished() {
        return this.path.length === 0 || this.cursor >= this.path.length;
    }

    clear() {
        this.path = [];
        this.cursor = 0;
    }

    /** 获取当前目标节点（可能为 null） */
    getMoveGoal() {
        if (this.isFinished()) return null;
        return this.path[this.cursor];
    }

    /**
     * 如果足够接近当前目标节点则推进 cursor
     * @param {import("cs_script/point_script").Vector} currentPos
     * @param {number} [tolerance]
     */
    advanceIfReached(currentPos, tolerance = goalTolerance) {
        while (!this.isFinished()) {
            const goal = this.getMoveGoal();
            if (!goal) return;
            if (vec$1.lengthsq(vec$1.sub(currentPos, goal.pos)) <= tolerance * tolerance) {
                this.cursor++;
                continue;
            }
            break;
        }
    }

    /** PORTAL 节点专用推进 */
    advancePortal() {
        if (!this.isFinished()) this.cursor++;
    }
}

/**
 * @module 实体移动/运动模式
 */

/**
 * @typedef {import("./motor").Motor} Motor
 * @typedef {import("./path_follower").PathFollower} PathFollower
 * @typedef {import("cs_script/point_script").Entity} Entity
 * @typedef {import("cs_script/point_script").Vector} Vector
 */

/**
 * @typedef {object} LocoContext
 * @property {Motor}        motor
 * @property {PathFollower} pathFollower
 * @property {Vector}       wishDir
 * @property {number}       wishSpeed
 * @property {number}       maxSpeed
 * @property {() => Vector} getPos        获取当前实体位置
 * @property {(name: string, arg?: any) => void} requestModeSwitch  请求切换模式（由 controller 处理）
 */

// ─────────────────── 基类 ───────────────────────────────────
class MoveMode {
    /** @param {LocoContext} ctx */
    enter(ctx) {}
    /** @param {LocoContext} ctx */
    leave(ctx) {}
    /**
     * @param {LocoContext} ctx
     * @param {number} dt
     * @param {{entities: Entity[], positions: Vector[]}} sepCtx
     * @returns {Vector}
     */
    update(ctx, dt, sepCtx) {return {x:0,y:0,z:0};}
}

// ─────────────────── Walk ───────────────────────────────────
class MoveWalk extends MoveMode {
    /**
     * @param {LocoContext} ctx
     * @param {number} dt
     * @param {{entities: Entity[], positions: Vector[]}} sepCtx
     * @return {Vector}
     */
    update(ctx, dt, sepCtx) {
        const pos = ctx.getPos();

        // 路径推进
        ctx.pathFollower.advanceIfReached(pos);
        const goal = ctx.pathFollower.getMoveGoal();

        // 路径节点驱动的模式切换请求
        if (goal?.mode === PathState.JUMP) {
            ctx.motor.velocity.z = 500;
            ctx.requestModeSwitch("air");
            return pos;
        }
        if (goal?.mode === PathState.LADDER) {
            ctx.motor.velocity.x = 0;
            ctx.motor.velocity.y = 0;
            ctx.motor.velocity.z = 0;
            ctx.requestModeSwitch("ladder");
            return pos;
        }

        computeWish(ctx, goal);

        // 物理推进
        const newPos = ctx.motor.moveGround(pos, ctx.wishDir, ctx.wishSpeed, dt, sepCtx);

        // 离地 → 请求切换到 air
        if (!ctx.motor.isOnGround()) {
            ctx.requestModeSwitch("air");
        }

        return newPos;
    }
}

// ─────────────────── Air ────────────────────────────────────
class MoveAir extends MoveMode {
    /**
     * @param {LocoContext} ctx
     * @param {number} dt
     * @param {{entities: Entity[], positions: Vector[]}} sepCtx
     * @return {Vector}
     */
    update(ctx, dt, sepCtx) {
        const pos = ctx.getPos();

        ctx.pathFollower.advanceIfReached(pos);
        const goal = ctx.pathFollower.getMoveGoal();
        computeWish(ctx, goal);

        const newPos = ctx.motor.moveAir(pos, ctx.wishDir, ctx.wishSpeed, dt, sepCtx);

        // 落地 → 请求切换回 walk
        if (ctx.motor.isOnGround()) {
            ctx.motor.velocity.z = 0;
            ctx.requestModeSwitch("walk");
        }

        return newPos;
    }
}

// ─────────────────── Fly ────────────────────────────────────
class MoveFly extends MoveMode {
    /**
     * @param {LocoContext} ctx
     * @param {number} dt
     * @param {{entities: Entity[], positions: Vector[]}} sepCtx
     * @return {Vector}
     */
    update(ctx, dt, sepCtx) {
        const pos = ctx.getPos();

        ctx.pathFollower.advanceIfReached(pos, 200);
        const goal = ctx.pathFollower.getMoveGoal();

        if (!goal) {
            ctx.motor.velocity = vec$1.get(0, 0, 0);
            return pos;
        }

        // 飞行模式：3D 方向
        const dir = vec$1.normalize(vec$1.sub(goal.pos, pos));
        ctx.wishDir = dir;
        ctx.wishSpeed = ctx.maxSpeed;

        const newPos = ctx.motor.moveFly(pos, dir, ctx.maxSpeed, dt, sepCtx);
        return newPos;
    }
}

// ─────────────────── Ladder ─────────────────────────────
class MoveLadder extends MoveMode {
    /**
     * @param {LocoContext} ctx
     * @param {number} dt
     * @param {{entities: Entity[], positions: Vector[]}} sepCtx
     * @return {Vector}
     */
    update(ctx, dt, sepCtx) {
        const goal = ctx.pathFollower.getMoveGoal();
        const pos = ctx.getPos();

        if (!goal) {
            ctx.motor.velocity = vec$1.get(0, 0, 0);
            return pos;
        }
        if (goal.mode !== PathState.LADDER) {
            ctx.motor.velocity.z = 200;
            ctx.requestModeSwitch("air");
            return pos;
        }

        const newPos = ctx.motor.moveLadder(pos, goal.pos, ctx.maxSpeed, dt, sepCtx);
        ctx.pathFollower.advanceIfReached(newPos);
        return newPos;
    }
}

// ─────────────────── 期望方向计算（共用）─────────────────────
/**
 * @param {LocoContext} ctx
 * @param {{ pos: Vector; mode: number } | null} goal
 */
function computeWish(ctx, goal) {
    if (!goal) {
        ctx.wishDir = vec$1.get(0, 0, 0);
        ctx.wishSpeed = ctx.maxSpeed;
        return;
    }
    const pos = ctx.getPos();
    const toGoal = vec$1.sub(goal.pos, pos);
    const dist = vec$1.lengthsq(toGoal);

    if (goal.mode === PathState.JUMP) {
        if (dist <= arriveDistance * arriveDistance) {
            ctx.wishDir = vec$1.get(0, 0, 0);
            ctx.wishSpeed = ctx.maxSpeed;
            return;
        }
        ctx.wishDir = vec$1.normalize(toGoal);
        ctx.wishSpeed = 800;
    } else {
        if (dist <= arriveDistance * arriveDistance) {
            ctx.wishDir = vec$1.get(0, 0, 0);
            ctx.wishSpeed = ctx.maxSpeed;
            return;
        }
        ctx.wishDir = vec$1.normalize2D(toGoal);
        ctx.wishSpeed = ctx.maxSpeed;
    }
}

/**
 * @module 实体移动/运动模式控制器
 */

/**
 * @typedef {import("./move_mode").MoveMode} MoveMode
 * @typedef {import("./move_mode").LocoContext} LocoContext
 * @typedef {import("cs_script/point_script").Entity} Entity
 */

/**
 * 运动模式控制器：管理 walk / air / fly 三种模式的注册、切换和每帧更新。
 *
 * 支持 `autoSwitch` 开关：
 * - true（默认）：MoveMode 内部可通过 ctx.requestModeSwitch 请求切换
 * - false：requestModeSwitch 被屏蔽，只有外部调用 setMode 才能切换
 */
class MovementController {
    /**
     * @param {LocoContext} ctx
     */
    constructor(ctx) {
        ctx.requestModeSwitch = this.setMode.bind(this);
        this.ctx = ctx;

        /** @type {Record<string, MoveMode>} */
        this.modes = {
            walk: new MoveWalk(),
            air: new MoveAir(),
            fly: new MoveFly(),
            ladder: new MoveLadder(),
        };

        /** @type {MoveMode | null} */
        this.current = null;
        /** @type {string} */
        this.currentName = "";
    }

    /**
     * 外部强制切换模式
     * @param {string} name
     * @param {any} [arg]
     */
    setMode(name, arg) {
        if (this.currentName === name) return;
        if (this.current) this.current.leave(this.ctx);

        this.current = this.modes[name] ?? null;
        this.currentName = name;
        if (this.current) this.current.enter(this.ctx);
    }

    /**
     * 运行时注册自定义模式
     * @param {string} name
     * @param {MoveMode} mode
     */
    registerMode(name, mode) {
        this.modes[name] = mode;
    }

    /**
     * @param {number} dt
     * @param {{entities: Entity[], positions: import("cs_script/point_script").Vector[]}} sepCtx
     * @returns {import("cs_script/point_script").Vector | undefined}
     */
    update(dt, sepCtx) {
        if (this.current) {
            return this.current.update(this.ctx, dt, sepCtx);
        }
    }
}

/**
 * @module 实体移动/运动类
 */

/** @typedef {import("cs_script/point_script").Entity} Entity */
/** @typedef {import("cs_script/point_script").Vector} Vector */

/**
 * @typedef {object} MovementConfig
 * @property {Entity}   entity                             移动实体
 * @property {number}   [speed=120]                        默认移动速度
 * @property {string}   [mode="walk"]                      默认运动模式（walk / air / fly / ladder）
 * @property {boolean}  [usePathfinding=true]              本实例默认是否使用寻路
 * @property {((start: Vector, end: Vector) => {pos: Vector, mode: number}[] | null) | null} [requestPath=null]
 *   寻路回调：接收起终点，返回 {pos, mode}[] 路径数组或 null
 * @property {{ gravity?: number; friction?: number; stepHeight?: number; turnSpeed?: number;
 *   mins?: Vector; maxs?: Vector }} [physics]             可选物理常量覆盖
 */

/**
 * @typedef {object} MoveTask
 * @property {Vector}   target          终点坐标
 * @property {boolean}  [usePathfinding] 本次任务是否使用寻路（覆盖默认值）
 * @property {boolean}  [accelerate]    是否加速（预留，默认 true）
 * @property {number}   [speed]         本次任务速度（覆盖默认）
 * @property {Vector}   [initialVelocity] 本次任务起始速度；可用于飞扑/投掷等锁定 air 段
 * @property {string}   [mode]          本次任务初始模式（覆盖默认，可传 walk / air / fly / ladder）
 */

/**
 * 独立运动门面类。
 *
 * 职责：
 * 1. 管理实体的移动生命周期（startMove → update → stop）
 * 2. 内聚 Motor / PathFollower / MovementController，对外只暴露简洁 API
 * 3. 寻路解耦：通过 requestPath 回调获取路径，不直接依赖 navmesh
 *
 * 用法示例：
 * ```js
 * const mv = new Movement({
 *     entity: myEntity,
 *     speed: 150,
 *     requestPath: (start, end) => myNavmesh.findPath(start, end)
 * });
 * mv.startMove({ target: { x: 100, y: 200, z: 0 } });
 * // 每帧
 * mv.update(dt, sepCtx);
 * ```
 */
class Movement {
    /**
     * @param {MovementConfig} config
     */
    constructor(config) {
        this.entity = config.entity;

        // ── 默认配置 ──
        this._defaultSpeed = config.speed ?? 120;
        this._defaultMode = config.mode ?? "walk";
        this._defaultUsePathfinding = config.usePathfinding ?? true;
        this._requestPath = config.requestPath ?? null;

        // ── 当前任务状态 ──
        /** @type {Vector | null} */
        this._target = null;
        this._usePathfinding = this._defaultUsePathfinding;
        this._isStopped = true;
        this._currentYaw = 0;

        // ── 内部组件 ──
        const physicsConf = config.physics ?? {};
        this._probe = new MoveProbe({ mins: physicsConf.mins, maxs: physicsConf.maxs });
        this._motor = new Motor({
            gravity: physicsConf.gravity,
            friction: physicsConf.friction,
            stepHeight: physicsConf.stepHeight,
            turnSpeed: physicsConf.turnSpeed,
            probe: this._probe
        });
        this._pathFollower = new PathFollower();

        // ── LocoContext（由 controller & modes 共享）──
        /** @type {import("./move_mode").LocoContext} */
        this._ctx = {
            motor: this._motor,
            pathFollower: this._pathFollower,
            wishDir: vec$1.get(0, 0, 0),
            wishSpeed: 0,
            maxSpeed: this._defaultSpeed,
            getPos: () => vec$1.clone(this.entity.GetAbsOrigin()),
            requestModeSwitch: () => {} // 由 controller 绑定
        };

        this._controller = new MovementController(this._ctx);
        this._controller.setMode(this._defaultMode);

        // portal 防重入
        this._lastPortalAt = -999;
    }

    // ═══════════════════ 公共 API ═══════════════════════════

    /**
     * 开始一个移动任务
     * @param {MoveTask} task
     */
    startMove(task) {
        this._target = vec$1.clone(task.target);
        this._isStopped = false;
        this._ctx.maxSpeed = task.speed ?? this._defaultSpeed;
        this._usePathfinding = task.usePathfinding ?? this._defaultUsePathfinding;
        if (task.initialVelocity) {
            this._motor.velocity = vec$1.clone(task.initialVelocity);
        }

        if (task.mode) {
            this._controller.setMode(task.mode);
        }

        // 如果启用寻路，立即请求一次路径
        if (this._usePathfinding) {
            this.refreshPath();
        } else {
            // 不寻路：建一条直达路径（单节点，WALK 模式）
            this._pathFollower.setPath([{ pos: this._target, mode: PathState.WALK }]);
        }
    }

    /**
     * 每帧更新（唯一驱动入口）
     * @param {number} dt         帧间隔（秒）
     * @param {{entities: Entity[], positions: Vector[]}} sepCtx 分离上下文
     */
    update(dt, sepCtx) {
        if (this._isStopped) return;

        // PORTAL 特殊处理（在常规 controller 之前）
        if (this._handlePortal()) return;

        // 更新 maxSpeed（支持运行时改速度后生效）
        // controller → mode → motor
        const newPos = this._controller.update(dt, sepCtx);

        // 传送实体到新位置
        if (newPos) {
            const facingDir = vec$1.length2Dsq(this._ctx.wishDir) > 0.1
                ? this._ctx.wishDir
                : vec$1.normalize2D(this._motor.getVelocity());

            this._currentYaw = this._motor.computeYaw(facingDir, this._currentYaw, dt);
            this.entity.Teleport({
                position: newPos,
                angles: { pitch: 0, yaw: this._currentYaw, roll: 0 }
            });
        }
    }

    /**
     * 刷新路径（外部决定调用时机）。
     * 调用时会用当前实体位置和 _target 向 requestPath 回调请求新路径。
     * @returns {boolean} 是否成功刷新
     */
    refreshPath() {
        if (!this._requestPath || !this._target) return false;
        if (this._motor.isStuck()) return false; // 卡死时不刷新（可选策略）
        const start = this.entity.GetAbsOrigin();
        const path = this._requestPath(start, this._target);
        if (!path) return false;
        // 确保终点在路径末尾
        path.push({ pos: vec$1.clone(this._target), mode: PathState.WALK });
        this._pathFollower.setPath(path);
        return true;
    }

    /**
     * 直接设置路径（跳过 requestPath 回调）
     * @param {{ pos: Vector; mode: number }[]} path
     */
    setPath(path) {
        this._pathFollower.setPath(path);
    }

    /** 获取当前路径快照（返回拷贝，外部修改后需重新 setPath） */
    getPath() {
        return this._pathFollower.path.map(node => ({
            pos: vec$1.clone(node.pos),
            mode: node.mode
        }));
    }

    /**
     * 更新目标坐标（不自动重算路径，需外部调用 refreshPath）
     * @param {Vector} target
     */
    setTarget(target) {
        this._target = vec$1.clone(target);
    }

    /**
     * 设置移动速度
     * @param {number} speed
     */
    setSpeed(speed) {
        this._ctx.maxSpeed = speed;
    }

    /**
     * 直接设置当前速度；飞扑/投掷等锁定 air 段使用这个接口
     * @param {Vector} velocity
     */
    setVelocity(velocity) {
        this._motor.velocity = vec$1.clone(velocity);
    }

    /** 获取当前速度快照 */
    getVelocity() {
        return this._motor.getVelocity();
    }

    /**
     * 外部强制切换运动模式
     * @param {string} name  "walk" | "air" | "fly" 或自定义注册名
     * @param {any} [arg]
     */
    setMode(name, arg) {
        this._controller.setMode(name, arg);
    }

    /**
     * 运行时注册自定义模式
     * @param {string} name
     * @param {import("./move_mode").MoveMode} mode
     */
    registerMode(name, mode) {
        this._controller.registerMode(name, mode);
    }

    /** 停止移动 */
    stop() {
        this._isStopped = true;
        this._ctx.wishDir = vec$1.get(0, 0, 0);
        this._ctx.wishSpeed = 0;
        this._motor.stop();
    }

    /** 恢复移动 */
    resume() {
        this._isStopped = false;
    }

    /** 清空路径 */
    clearPath() {
        this._pathFollower.clear();
    }

    /** 获取当前状态快照 */
    getState() {
        const currentGoal = this._pathFollower.getMoveGoal();
        return {
            mode: this._controller.currentName,
            onGround: this._motor.isOnGround(),
            currentGoalMode: currentGoal?.mode ?? null
        };
    }

    /** 路径是否走完 */
    isPathFinished() {
        return this._pathFollower.isFinished();
    }

    /** 是否在地面 */
    isOnGround() {
        return this._motor.isOnGround();
    }

    /** 是否正在移动 */
    isMoving() {
        return !this._isStopped && this._ctx.wishSpeed > 0;
    }

    // ═══════════════════ 内部方法 ═══════════════════════════

    /**
     * PORTAL 节点处理（在 controller.update 之前调用）
     * @returns {boolean} true 表示本帧跳过常规移动
     */
    _handlePortal() {
        const goal = this._pathFollower.getMoveGoal();
        if (!goal || goal.mode !== PathState.PORTAL) return false;

        const now = Instance.GetGameTime();
        if (now - this._lastPortalAt < 0.5) {
            this._pathFollower.advancePortal();
            return true;
        }
        this._lastPortalAt = now;

        this.entity.Teleport({ position: goal.pos, velocity: { x: 0, y: 0, z: 0 } });
        this._motor.velocity = vec$1.get(0, 0, 0);
        this._pathFollower.advancePortal();
        return true;
    }
}

/**
 * @module 实体移动/移动管理器
 */
/**
 * 通用实体 Movement 管理器。
 * 由 main 持有，负责注册/注销任意实体的 Movement 实例，
 * 维护内部请求队列并在 tick 内统一消费，
 * 通过内部路径调度队列按频率驱动路径重算。
 * 寻路依赖（findPath）由 main 装配注入。
 */

/** @typedef {import("cs_script/point_script").Entity} Entity */
/** @typedef {import("cs_script/point_script").Vector} Vector */

/**
 * @typedef {object} MovementEntry
 * @property {Movement} movement        Movement 实例
 * @property {Entity}   entity          引擎实体引用
 * @property {object}   config          注册时的配置快照
 * @property {Entity|null} ignoreEntity 传给 move_probe 的忽略实体
 * @property {boolean}  useNPCSeparation 当前是否启用分离速度
 * @property {boolean}  usePathRefresh  当前任务是否允许刷新路径
 * @property {Entity|null}  targetEntity  追击目标实体（来自最后一次 Move 请求）
 * @property {Vector|null}  targetPosition  目标坐标（来自最后一次 Move 请求）
 */

/**
 * 通用实体 MovementManager。
 *
 * 以 entity 为键管理 Movement 实例，路径调度堆中也直接存储 entity。
 * 外部系统通过 submitRequest 提交 MovementRequest，manager 在 tick 开头统一按优先级
 * 合并并消费。tick 内部依次执行：消费请求 → 路径刷新 → 批量 update。
 *
 * 路径刷新逻辑完全基于 entry 自身字段（usePathRefresh、targetEntity、
 * skillMotion），不依赖外部实例方法。
 */
class MovementManager {
    constructor() {
        /** @type {Map<Entity, MovementEntry>} */
        this._entries = new Map();
        /** @type {Entity[]} 提供给 move_probe 的忽略实体列表。 */
        this.ignoreEntity = [];

        /** 路径调度最小堆，按上次更新时间排序。 */
        this._pathHeap = new _MinHeap(1000);
        /**
         * 寻路函数，由 main 通过 initPathScheduler 注入。
         * @type {((start: Vector, end: Vector) => {pos: Vector, mode: number}[] | null) | null}
         */
        this._findPath = null;
        /** @type {import("../util/definition").MovementRequest[]} */
        this._pendingRequests = [];
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Movement.In.MoveRequest, (req = {}) => {
                req.type = MovementRequestType$1.Move;
                this.submitRequest(req);
            }),
            eventBus.on(event.Movement.In.StopRequest, (req = {}) => {
                req.type = MovementRequestType$1.Stop;
                this.submitRequest(req);
            }),
            eventBus.on(event.Movement.In.RemoveRequest, (req = {}) => {
                req.type = MovementRequestType$1.Remove;
                this.submitRequest(req);
            }),
        ];
    }

    /**
     * 注入路径调度依赖。必须在使用 tick 前调用。
     * @param {(start: Vector, end: Vector) => {pos: Vector, mode: number}[]} findPath 寻路函数
     */
    initPathScheduler(findPath) {
        this._findPath = findPath;
    }

    /**
     * 提交一条移动请求到内部队列。
     * 在下一次 tick 开头按 entity 合并后统一消费。
     * @param {import("../util/definition").MovementRequest} req
     */
    submitRequest(req) {
        if (!req?.entity) return;
        this._pendingRequests.push(req);
    }

    /**
     * 注册一个移动实体的 Movement 实例。
     * @param {Entity} key
     * @param {{ speed?: number, mode?: string, physics?: object, useSeparation?: boolean, ignoreEntity?: Entity | null }} config
     */
    register(key, config) {
        if (this._entries.has(key)) return;
        const movement = new Movement({
            entity: key,
            speed: config.speed ?? 120,
            mode: config.mode ?? "walk",
            usePathfinding: false,
            requestPath: null,
            physics: config.physics,
        });
        this._entries.set(key, {
            movement,
            entity: key,
            config,
            ignoreEntity: config.ignoreEntity ?? null,
            useNPCSeparation: config.useSeparation ?? true,
            usePathRefresh: false,
            targetEntity: null,
            targetPosition: null,
        });
        this._addIgnoreEntity(config.ignoreEntity ?? null);
        this._pathHeap.push(key, 0);
        eventBus.emit(event.Movement.Out.OnRegistered, {
            entity: key,
            config,
        });
    }

    /**
     * 注销一个 Movement。
     * @param {Entity} key
     */
    unregister(key) {
        const entry = this._entries.get(key);
        if (!entry) return;
        entry.movement.stop();
        this._entries.delete(key);
        this._removeIgnoreEntity(entry.ignoreEntity);
        this._pathHeap.remove(key);
        eventBus.emit(event.Movement.Out.OnRemoved, {
            entity: key,
        });
    }

    /** @param {any} key */
    has(key) {
        return this._entries.has(key);
    }

    /**
     * 获取所有实体的移动状态摘要。
     * 用于将 movement 层状态回写给 monster 侧。
     * @returns {Map<Entity, {mode: string, onGround: boolean, currentGoalMode: number|null}>}
     */
    getAllStates() {
        const result = new Map();
        for (const [key, entry] of this._entries) {
            const s = entry.movement.getState();
            result.set(key, s);
        }
        return result;
    }

    /**
     * @param {Entity} key
     * @param {number} speed
     */
    setSpeed(key, speed) {
        const entry = this._entries.get(key);
        if (!entry) return false;
        entry.movement.setSpeed(speed);
        return true;
    }

    // ═══════════════════════════════════════════════
    // 统一 tick 入口
    // ═══════════════════════════════════════════════

    /**
     * 每帧由 main 调用的唯一入口。依次执行：
     * 1. 消费并合并请求队列
     * 2. 路径刷新调度
     * 3. 批量 movement.update
     * @param {number} now 当前游戏时间
     * @param {number} dt 帧间隔
     * @param {Vector[]} separationPositions
     */
    tick(now,dt, separationPositions) {
        this._consumeRequests();
        this._tickPathRefresh(now);
        this._updateAll(dt, separationPositions);
    }

    /**
     * 向 ignoreEntity 追加一个外部提供的忽略实体。
        * @param {Entity|null} entity
     */
    _addIgnoreEntity(entity) {
        if (!entity) return;
        if (this.ignoreEntity.indexOf(entity) !== -1) return;
        this.ignoreEntity.push(entity);
    }

    /**
     * 从 ignoreEntity 中移除一个忽略实体。
        * @param {Entity|null} entity
     */
    _removeIgnoreEntity(entity) {
        if (!entity) return;
        const idx = this.ignoreEntity.indexOf(entity);
        if (idx === -1) return;
        const last = this.ignoreEntity.length - 1;
        if (idx !== last) {
            this.ignoreEntity[idx] = this.ignoreEntity[last];
        }
        this.ignoreEntity.pop();
    }

    // ═══════════════════════════════════════════════
    // 内部：请求消费
    // ═══════════════════════════════════════════════

    /** 按 entity 合并队列中的请求（保留最高优先级），然后逐条应用。 */
    _consumeRequests() {
        if (this._pendingRequests.length === 0) return;
        const merged = new Map();
        for (const req of this._pendingRequests) {
            const prev = merged.get(req.entity);
            if (!prev || req.priority <= prev.priority) {
                merged.set(req.entity, req);
            }
        }
        this._pendingRequests.length = 0;
        for (const [, req] of merged) {
            this._applyRequest(req);
        }
    }

    /**
     * 应用单条移动请求（Move / Stop / Remove）。
     * 内部按请求字段映射到具体 Movement API，同时更新 entry 长期任务状态。
     * @param {import("../util/definition").MovementRequest} req
     */
    _applyRequest(req) {
        let key = req.entity;
        if (!this._entries.has(key) && req.type === "Move") {
            this.register(key, {
                mode: req.Mode,
                useSeparation: req.useNPCSeparation ?? false,
            });
        }
        if (!this._entries.has(key)) return;

        if (req.type === "Remove") {
            this.unregister(key);
            return;
        }

        const entry = this._entries.get(key);
        if (!entry) return;

        if (req.type === "Stop") {
            entry.movement.stop();
            if (req.clearPath) entry.movement.clearPath();
            entry.usePathRefresh = false;
            entry.targetEntity = null;
            entry.targetPosition = null;
            eventBus.emit(event.Movement.Out.OnStopped, {
                entity: key,
            });
            return;
        }

        // type === "Move"
        entry.targetEntity = req.targetEntity ?? null;
        entry.targetPosition = req.targetPosition ?? null;

        if (req.useNPCSeparation !== undefined) entry.useNPCSeparation = req.useNPCSeparation;
        if (req.usePathRefresh !== undefined) entry.usePathRefresh = req.usePathRefresh;

        if (req.Mode) entry.movement.setMode(req.Mode);
        if (req.Velocity) entry.movement.setVelocity(req.Velocity);
        if (req.maxSpeed !== undefined) entry.movement.setSpeed(req.maxSpeed);
        if (req.clearPath) entry.movement.clearPath();

        if (req.targetEntity) {
            const pos = req.targetEntity.GetAbsOrigin();
            if (pos) entry.movement.setTarget(pos);
        } else if (req.targetPosition) {
            if (req.usePathRefresh) {
                entry.movement.setTarget(req.targetPosition);
            } else {
                entry.movement.startMove({
                    target: req.targetPosition,
                    usePathfinding: false,
                    mode: req.Mode,
                    initialVelocity: req.Velocity,
                });
            }
        }

        entry.movement.resume();
    }

    // ═══════════════════════════════════════════════
    // 内部：路径刷新调度
    // ═══════════════════════════════════════════════

    /**
     * 从最小堆中取出最久未更新的实体，按 entry 字段判断是否允许刷新，
     * 通过注入的 findPath 重算路径。每帧最多成功更新一个。
     * @param {number} now
     */
    _tickPathRefresh(now) {
        if (!this._findPath) return;

        /** @type {Entity|null} */
        let first = null;
        while (!this._pathHeap.isEmpty()) {
            const current = this._pathHeap.pop();
            if (!current.node) break;

            if (current.node === first || now - current.cost <= 0.5) {
                this._pathHeap.push(current.node, current.cost);
                break;
            }
            if (!first) first = current.node;

            const key = current.node;
            if (!key) continue;
            const entry = this._entries.get(key);
            if (!entry) continue;

            if (!this._canRefreshPath(entry)) {
                this._pathHeap.push(current.node, now);
                continue;
            }

            const start = entry.entity.GetAbsOrigin();
            const target = entry.targetEntity;
            const end = (target&&target.IsAlive()) ? target.GetAbsOrigin() : entry.targetPosition;
            if (!start || !end) {
                this._pathHeap.push(current.node, now);
                continue;
            }

            const path = this._findPath(start, end);
            if (path && path.length > 0) {
                entry.movement.setPath(path);
            }

            this._pathHeap.push(current.node, now);
            break;
        }
    }

    /**
     * 判断 entry 是否允许执行路径刷新。
     * @param {MovementEntry} entry
     * @returns {boolean}
     */
    _canRefreshPath(entry) {
        if (!entry.usePathRefresh) return false;
        if (!entry.targetEntity && !entry.targetPosition) return false;
        const s = entry.movement.getState();
        if (s.currentGoalMode === PathState.JUMP ||
            s.currentGoalMode === PathState.LADDER ||
            s.currentGoalMode === PathState.PORTAL) return false;
        return true;
    }

    // ═══════════════════════════════════════════════
    // 内部：批量更新
    // ═══════════════════════════════════════════════

    /**
     * @param {number} dt
     * @param {Vector[]} separationPositions
     */
    _updateAll(dt, separationPositions) {
        for (const [key, entry] of this._entries) {
            const sepCtx = entry.useNPCSeparation
                ? { entities: this.ignoreEntity, positions: separationPositions }
                : { entities: [], positions: []};
            entry.movement.update(dt, sepCtx);
        }
    }

    // ═══════════════════════════════════════════════
    // 生命周期
    // ═══════════════════════════════════════════════

    /**
     * 释放全部 Movement 实例与路径调度队列。
     */
    cleanup() {
        for (const [, entry] of this._entries) {
            entry.movement.stop();
        }
        this._entries.clear();
        this.ignoreEntity.length = 0;
        this._pathHeap.clear();
        this._pendingRequests.length = 0;
    }

    destroy() {
        this.cleanup();
        for (const unsubscribe of this._unsubscribers) {
            unsubscribe();
        }
        this._unsubscribers.length = 0;
    }
}

/**
 * 路径调度内部最小堆。
 * 按 cost（上次更新时间）排序，每次 pop 取出最久未更新的怪物。
 * @private
 */
class _MinHeap {
    /** @param {number} capacity 固定容量 */
    constructor(capacity) {
        this.capacity = capacity;
        /** @type {Entity[]} */
        this.nodes = [];
        /** @type {number[]} */
        this.costs = [];
        /** @type {Map<Entity, number>} */
        this.index = new Map();
        this.size = 0;
    }
    clear() {
        this.nodes.length = 0;
        this.costs.length = 0;
        this.index.clear();
        this.size = 0;
    }
    isEmpty() { return this.size === 0; }
    /** @param {Entity} node @param {number} cost @returns {boolean} */
    push(node, cost) {
        if (!node) return false;
        if (this.size >= this.capacity) return false;
        let i = this.size++;
        this.nodes[i] = node;
        this.costs[i] = cost;
        this.index.set(node, i);
        this._up(i);
        return true;
    }
    /** @param {Entity} node @returns {boolean} */
    remove(node) {
        const idx = this.index.get(node);
        if (idx === undefined) return false;

        this.index.delete(node);
        this.size--;

        if (idx === this.size) {
            this.nodes.length = this.size;
            this.costs.length = this.size;
            return true;
        }

        this.nodes[idx] = this.nodes[this.size];
        this.costs[idx] = this.costs[this.size];
        this.nodes.length = this.size;
        this.costs.length = this.size;
        this.index.set(this.nodes[idx], idx);

        const parent = (idx - 1) >> 1;
        if (idx > 0 && this.costs[idx] < this.costs[parent]) this._up(idx);
        else this._down(idx);
        return true;
    }
    /** @returns {{node: Entity | null, cost: number}} */
    pop() {
        if (this.size === 0) return { node: null, cost: -1 };
        const n = this.nodes[0], c = this.costs[0];
        this.index.delete(n);
        this.size--;
        if (this.size > 0) {
            this.nodes[0] = this.nodes[this.size];
            this.costs[0] = this.costs[this.size];
            this.nodes.length = this.size;
            this.costs.length = this.size;
            this.index.set(this.nodes[0], 0);
            this._down(0);
        } else {
            this.nodes.length = 0;
            this.costs.length = 0;
        }
        return { node: n, cost: c };
    }
    /** @param {number} i */
    _up(i) {
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.costs[p] <= this.costs[i]) break;
            this._swap(i, p); i = p;
        }
    }
    /** @param {number} i */
    _down(i) {
        const n = this.size;
        while (true) {
            let l = i * 2 + 1, r = l + 1, m = i;
            if (l < n && this.costs[l] < this.costs[m]) m = l;
            if (r < n && this.costs[r] < this.costs[m]) m = r;
            if (m === i) break;
            this._swap(i, m); i = m;
        }
    }
    /** @param {number} a @param {number} b */
    _swap(a, b) {
        const ca = this.costs[a], na = this.nodes[a];
        this.costs[a] = this.costs[b]; this.costs[b] = ca;
        this.nodes[a] = this.nodes[b]; this.nodes[b] = na;
        this.index.set(na, b);
        this.index.set(this.nodes[a], a);
    }
}

/**
 * 维护主循环共享的临时上下文快照。
 */
class contextManager{
    constructor()
    {
        /** @type {import("../monster/monster/monster").Monster[]} */
        this.activeMonsters = [];
        /** @type {import("cs_script/point_script").Entity[]} */
        this.monsterEntities = [];
        /** @type {import("cs_script/point_script").Vector[]} */
        this.separationPositions = [];
        /** @type {import("cs_script/point_script").Entity[]} */
        this.breakableEntities = [];
        /** @type {import("cs_script/point_script").Vector[]} */
        this.playerPositions = [];
        /** @type {import("cs_script/point_script").Vector[]} */
        this.monsterPositions = [];
    }

    /**
     * 更新本 tick 用到的怪物相关临时快照。
     * @param {{
     *   activeMonsters?: import("../monster/monster/monster").Monster[];
     *   monsterEntities?: import("cs_script/point_script").Entity[];
     *   separationPositions?: import("cs_script/point_script").Vector[];
     * }} [nextContext]
     */
    updateTickContext(nextContext = {})
    {
        this.activeMonsters = Array.isArray(nextContext.activeMonsters) ? [...nextContext.activeMonsters] : [];
        this.monsterEntities = Array.isArray(nextContext.monsterEntities) ? [...nextContext.monsterEntities] : [];
        this.separationPositions = Array.isArray(nextContext.separationPositions) ? [...nextContext.separationPositions] : [];
    }

    resetTickContext()
    {
        this.updateTickContext();
    }
}

/**
 * @module 区域效果/效果配置
 */
/**
 * 区域效果配置
 * @typedef {object} areaEffectStatic
 * @property {string} effectName - 区域预制效果名称
 * @property {string} buffName - 命中后要施加的预制 Buff 名字
 * @property {string} particleName - 需要创建的粒子系统预制名字
 */
/**
 * @typedef {object} AreaEffectCreateRequest
 * @property {string} areaEffectStaticKey - 预制区域效果配置的 key
 * @property {{x:number,y:number,z:number}} position - 区域中心点
 * @property {number} radius - 区域半径
 * @property {number} duration - 总持续时间（秒）
 * @property {string[]} targetTypes - 该区域效果可命中的目标类型
 * @property {boolean} result - 结果是否成功
 */
/**
 * @typedef {object} AreaEffectStopRequest
 * @property {number} areaEffectId - 区域效果实例 id
 * @property {boolean} result - 结果是否成功
 */

/**
 * 区域效果每帧检测上下文。
 * @typedef {object} areaEffectTickContext
 * @property {import("../player/player/player").Player[]} players - 当帧可被命中的玩家列表
 * @property {import("../monster/monster/monster").Monster[]} monsters - 当帧可被命中的怪物列表
 */
/**
 * @typedef {object} OnAreaEffectCreated
 * @property {number} effectId - 区域效果实例 id
 */
/**
 * @typedef {object} OnAreaEffectStopped
 * @property {number} effectId - 区域效果实例 id
 */
/**
 * @typedef {object} OnAreaEffectHitPlayer
 * @property {import("../player/player/player").Player} player - 命中的玩家实例
 * @property {number} effectId - 区域效果实例 id
 * @property {string} targetType - 命中的目标类型
 * @property {number} hit -  玩家：`slot`  怪物：`monsterId`
 * @property {string} buffName - 命中后要施加的预制 Buff 名称
 */
/**
 * @typedef {object} OnAreaEffectHitMonster
 * @property {import("../monster/monster/monster").Monster} monster - 命中的怪物实例
 * @property {number} effectId - 区域效果实例 id
 * @property {string} targetType - 命中的目标类型
 * @property {number} hit -  玩家：`slot`  怪物：`monsterId`
 * @property {string} buffName - 命中后要施加的预制 Buff 名称
 */
/**
 * 区域效果目标类型常量。
 */
const Target={
    Player:"player",
    Monster:"monster",
};
//export const AreaEffectTargetType = Object.freeze({
//    Player: "player",
//    Monster: "monster",
//});
//
///**
// * 默认命中的目标类型。当前为了兼容 poisongas，默认只命中玩家。
// */
//export const DEFAULT_AREA_EFFECT_TARGET_TYPES = Object.freeze([
//    AreaEffectTargetType.Player,
//]);
//===================预制区域效果配置========================
/** @type {Record<string, areaEffectStatic>} */
const areaEffectStatics = {
    "poisongas": {
        effectName: "poisongas_area_effect",
        buffName: "poison",
        particleName: "poisongas",
    },
    // 后续在此添加更多预制区域效果，例如：
    // firezone: { effectName: "firezone_area_effect", position: { x: 0, y: 0, z: 0 }, radius: 100, duration: 3, buffName: "burn", particleName: "firezone", targetTypes: [Target.Player, Target.Monster] },
};

/**
 * @module 区域效果/单个区域效果
 */

/**
 * 单个区域效果实例（毒区、燃烧地面等）。
 *
 * 完全独立于怪物生命周期，由 AreaEffectManager 统一驱动。
 * 每个实例包含位置、半径、持续时间、施加间隔和 Buff 参数，
 * 在每帧 tick 中检测半径内的目标，并按冷却时间触发命中回调。
 * 超时后自动销毁并清理关联的粒子效果句柄。
 *
 * @navigationTitle 区域效果实例
 */
class AreaEffect {
    static _nextId = 1;

    /**
     * 创建区域效果实例。
     * @param {import("./area_const").AreaEffectCreateRequest} desc
     */
    constructor(desc) {
        /** 自增唯一 ID。 */
        this.id = AreaEffect._nextId++;
        /** 效果类型标识（如 "poisongas"）。 */
        this.effectName = areaEffectStatics[desc.areaEffectStaticKey].effectName;
        /** Buff 类型名字。 */
        this.buffName = areaEffectStatics[desc.areaEffectStaticKey].buffName;
        /** 关联的粒子效果名字。
         * @type {string} */
        this.particleName = areaEffectStatics[desc.areaEffectStaticKey].particleName;

        /** 效果中心世界坐标。 */
        this.position = desc.position;
        /** 影响半径。 */
        this.radius = desc.radius;
        /** 总持续时间（秒）。 */
        this.duration = desc.duration;
        /** 命中目标类型数组。
         * @type {string[]} */
        this.targetTypes = desc.targetTypes;
        /** 创建时的游戏时间戳。由 `start()` 设置，用于超时判定。 */
        this.startTime = 0;
        /** 是否存活。由 `start()` 置为 true，`stop()` 置为 false。 */
        this.alive = false;
        /** 粒子效果 ID，由粒子管理器返回。 */
        this.particleId=-1;
        /**
         * 每个目标的命中冷却记录。键采用：
         * - 玩家：`p:${slot}`
         * - 怪物：`m:${monsterId}`
         * @type {Map<string, number>}
         */
        this._hitCooldowns = new Map();
        /**
         * 每个目标的 Buff ID 记录。键采用：
         * - 玩家：`p:${slot}`
         * - 怪物：`m:${monsterId}`
         * @type {Map<string, number>}
         */
        this._buffid=new Map();
    }

    /**
     * 启动区域效果实例。
     * @returns {boolean}
     */
    start() {
        if (this.alive) {
            this.stop();
        }
        this._buffid.clear();
        this._hitCooldowns.clear();
        this.startTime = Instance.GetGameTime();
        this.alive = true;
        this._requestParticle();
        /** @type {import("./area_const").OnAreaEffectCreated} */
        const payload = {
            effectId: this.id,
        };
        eventBus.emit(event.AreaEffects.Out.OnCreated, payload);
        return true;
    }

    /**
     * 每次由 manager 驱动调用。
     * @param {number} now
     * @param {import("./area_const").areaEffectTickContext} tickContext
     */
    tick(now, tickContext) {
        if (!this.alive) return;

        if (now - this.startTime >= this.duration) {
            this.stop();
            return;
        }

        const r2 = this.radius * this.radius;
        if (this.targetTypes.includes(Target.Player)) {
            this._tickPlayers(now, tickContext?.players ?? [], r2);
        }
        if (this.targetTypes.includes(Target.Monster)) {
            this._tickMonsters(now, tickContext?.monsters ?? [], r2);
        }
    }

    /**
     * 停止效果并清理粒子句柄。
     */
    stop() {
        if (!this.alive && !this.particleId) return;

        this.alive = false;
        this._stopParticle();
        this._hitCooldowns.clear();
        this.startTime = 0;
        /** @type {import("./area_const").OnAreaEffectStopped} */
        const payload = {
            effectId: this.id,
        };
        eventBus.emit(event.AreaEffects.Out.OnStopped, payload);
        Instance.Msg(`[AreaEffect] #${this.id} ${this.effectName} 已停止销毁`);
    }

    /** @returns {boolean} 当前实例是否仍处于存活状态 */
    isAlive() {
        return this.alive;
    }

    /**
     * 处理玩家命中判定。
     * @param {number} now
     * @param {import("../player/player/player").Player[]} players
     * @param {number} r2
     */
    _tickPlayers(now, players, r2) {
        for (const player of players) {
            const pawn = player?.entityBridge?.pawn;
            const pos = pawn?.GetAbsOrigin?.();
            if (!pos || vec$1.lengthsq(pos, this.position) > r2) continue;

            const slot = pawn?.GetPlayerController?.()?.GetPlayerSlot?.() ?? -1;
            if (slot < 0) continue;

            const cooldownKey = `p:${slot}`;
            if (this._isInCooldown(cooldownKey, now)) continue;

            this._hitCooldowns.set(cooldownKey, now);
            this._ensureBuff(cooldownKey, player, Target.Player);
            /** @type {import("./area_const").OnAreaEffectHitPlayer} */
            const payload = { player, 
                effectId: this.id,
                targetType: Target.Player,
                hit: slot,
                buffName: this.buffName,
            };
            eventBus.emit(event.AreaEffects.Out.OnHitPlayer, payload);
        }
    }

    /**
     * 处理怪物命中判定。
     * @param {number} now
     * @param {import("../monster/monster/monster").Monster[]} monsters
     * @param {number} r2
     */
    _tickMonsters(now, monsters, r2) {
        for (const monster of monsters) {
            const monsterId = monster?.id;
            const pos = monster?.model?.GetAbsOrigin?.();
            if (!pos || vec$1.lengthsq(pos, this.position) > r2) continue;

            const cooldownKey = `m:${monsterId}`;
            if (this._isInCooldown(cooldownKey, now)) continue;

            this._hitCooldowns.set(cooldownKey, now);
            this._ensureBuff(cooldownKey, monster, Target.Monster);
            /** @type {import("./area_const").OnAreaEffectHitMonster} */
            const payload = { monster, 
                effectId: this.id,
                targetType: Target.Monster,
                hit: monsterId,
                buffName: this.buffName
            };
            eventBus.emit(event.AreaEffects.Out.OnHitMonster, payload);
        }
    }

    /**
     * 优先刷新目标当前缓存的 Buff；若缓存失效则当场回退到重新创建。
     *
     * 这里只在命中路径消费 _buffid，因此采用懒修复即可：
     * refresh 失败说明本地缓存已过期，立刻删掉并重新 add。
     *
     * @param {string} cooldownKey
     * @param {import("../player/player/player").Player | import("../monster/monster/monster").Monster} target
     * @param {string} targetType
     * @returns {number} 成功时返回有效 buffId，失败返回 -1
     */
    _ensureBuff(cooldownKey, target, targetType) {
        const cachedBuffId = this._buffid.get(cooldownKey);
        if (cachedBuffId&& cachedBuffId > 0) {
            /** @type {import("../buff/buff_const").BuffRefreshRequest} */
            const refreshRequest = { buffId: cachedBuffId, result: false };
            eventBus.emit(event.Buff.In.BuffRefreshRequest, refreshRequest);
            if (refreshRequest.result) {
                return cachedBuffId;
            }
            this._buffid.delete(cooldownKey);
        }

        /** @type {import("../buff/buff_const").BuffAddRequest} */
        const addRequest = {
            configid: this.buffName,
            target,
            targetType,
            result: -1,
        };
        eventBus.emit(event.Buff.In.BuffAddRequest, addRequest);
        if (addRequest.result > 0) {
            this._buffid.set(cooldownKey, addRequest.result);
            return addRequest.result;
        }

        this._buffid.delete(cooldownKey);
        return -1;
    }

    /**
     * 判断某个目标是否处于命中冷却中。
     * @param {string} cooldownKey
     * @param {number} now
     * @returns {boolean}
     */
    _isInCooldown(cooldownKey, now) {
        const lastApply = this._hitCooldowns.get(cooldownKey) ?? -Infinity;
        return now - lastApply < 0.5; // 默认 500ms 冷却时间，避免同一帧多次命中
    }

    /** 按需向管理器请求粒子系统。 */
    _requestParticle() {
        /**@type {import("../particle/particle_const").ParticleCreateRequest} */
        const payload = {
            particleName: this.particleName,
            position: { ...this.position },
            lifetime: this.duration,
            result:-1,
        };
        eventBus.emit(event.Particle.In.CreateRequest, payload);
        this.particleId = payload.result;
    }

    /** 停止并释放粒子句柄。 */
    _stopParticle() {
        /**@type {import("../particle/particle_const").ParticleStopRequest} */
        const payload = {
            particleId: this.particleId,
            result: false,
        };
        eventBus.emit(event.Particle.In.StopRequest, payload);
        return payload.result;
    }

}

/**
 * @module 区域效果/区域效果管理器
 */
/**
 * 区域效果管理器级别的服务。
 *
 * 负责创建、驱动和清理所有独立于怪物生命周期的持续区域效果。
 * 模块内部只关心：
 * - 区域效果实例集合
 * - 每帧 tick 统一驱动
 * - 命中回调桥接
 * - 粒子请求桥接
 *
 * @navigationTitle 区域效果服务
 */
class AreaEffectManager {
    constructor() {
        /** 所有活跃的区域效果实例。尾部追加，失活后在 tick 中移除。
         * @type {Map<number, AreaEffect>} */
        this._effects = new Map();
        this._nextEffectId = 1;
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.AreaEffects.In.CreateRequest, (/** @type {import("./area_const").AreaEffectCreateRequest} */ payload) => {
                payload.result = this.create(payload);
            }),
            eventBus.on(event.AreaEffects.In.StopRequest, (/** @type {import("./area_const").AreaEffectStopRequest} */ payload) => {
                payload.result = this.stop(payload.areaEffectId);
            })
        ];
    }

    /**
     * 创建一个新的区域效果。
     * @param {import("./area_const").AreaEffectCreateRequest} desc
     * @returns {boolean} 是否成功创建
     */
    create(desc) {
        const effect = new AreaEffect(desc);
        effect.start();
        this._effects.set(effect.id, effect);
        return true;
    }

    /**
     * 停止指定区域效果。
     * @param {number} areaEffectId
     * @returns {boolean}
     */
    stop(areaEffectId) {
        const effect = this._effects.get(areaEffectId);
        if (!effect) return false;
        effect.stop();
        this._effects.delete(areaEffectId);
        return true;
    }

    /**
     * 每帧由外部主循环或上层 manager 调用。
     * @param {number} now
     * @param {import("./area_const").areaEffectTickContext} tickContext
     */
    tick(now, tickContext) {
        for (const [id,effect] of this._effects.entries()) {
            if (!effect) continue;

            if (!effect.isAlive()) {
                this._effects.delete(id);
                continue;
            }

            effect.tick(now, tickContext);
            if (!effect.isAlive()) {
                this._effects.delete(id);
            }
        }
    }

    /** 清理所有区域效果 */
    cleanup() {
        for (const effect of this._effects.values()) {
            effect?.stop();
        }
        this._effects.clear();
    }

    /** 销毁服务并注销事件监听。 */
    destroy() {
        this.cleanup();
        for (const unsubscribe of this._unsubscribers) {
            unsubscribe();
        }
        this._unsubscribers.length = 0;
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
const skillManager = new SkillManager();
const monsterManager = new MonsterManager();
const navMesh = new NavMesh();
navMesh.init();
const movementManager = new MovementManager();
movementManager.initPathScheduler((start, end) => navMesh.findPath(start, end));
const buffManager = new BuffManager();
const particleManager = new ParticleManager();
const areaEffectManager = new AreaEffectManager();
const tempContext = new contextManager();

// ═══════════════════════════════════════════════
// 3. 跨模块回调绑定（全部集中在此）
// ═══════════════════════════════════════════════

// ——— 3.1 波次结算 / Game / Wave / 区域效果编排 ———

eventBus.on(event.Wave.Out.OnWaveEnd, (/** @type {import("./wave/wave_const").OnWaveEnd} */ payload) => {
    const waveNumber = payload.waveIndex;
    const waveConfig = waveManager.getWaveConfig(waveNumber);

    // 给予玩家波次奖励
    playerManager.dispatchReward(null, {
        type: "money",
        amount: waveConfig?.reward ?? 0,
        reason: `第${waveNumber}波通关奖励`
    });

    // 推进下一波或胜利
    if (waveManager.hasNextWave()) {
        /** @type {import("./wave/wave_const").WaveStartRequest} */
        const payload = { waveIndex: waveNumber + 1, result: false };
        eventBus.emit(event.Wave.In.WaveStartRequest, payload);
    } else {
        eventBus.emit(event.Game.In.GameWinRequest,{});
    }
});

eventBus.on(event.Wave.Out.OnWaveStart, (/** @type {import("./wave/wave_const").OnWaveStart} */ payload) => {
    const { waveConfig } = payload;
    if (waveConfig) {
        monsterManager.spawnWave(waveConfig);
    }
});

eventBus.on(event.Game.Out.OnEnterPreparePhase, (payload) => {
    playerManager.dispatchReward(null, {
        type: "ready",
        isReady: false
    });
});

eventBus.on(event.Game.Out.OnStartGame, (payload) => {
    playerManager.enterGameStart();
    /** @type {import("./wave/wave_const").WaveStartRequest} */
    const waveStartPayload = { waveIndex: 1, result: false };
    eventBus.emit(event.Wave.In.WaveStartRequest, waveStartPayload);
});

eventBus.on(event.Game.Out.OnGameLost, (payload) => {
    shopManager.closeAll();
    for (const player of playerManager.getActivePlayers()) {
        player.stopInputTracking();
    }
    monsterManager.stopWave();
});

eventBus.on(event.Game.Out.OnGameWin, (payload) => {
    shopManager.closeAll();
    for (const player of playerManager.getActivePlayers()) {
        player.stopInputTracking();
    }
    monsterManager.stopWave();
});

eventBus.on(event.Game.Out.OnResetGame, (payload) => {
    shopManager.closeAll();
    waveManager.resetGame();
    skillManager.clearAll();
    monsterManager.resetAllGameStatus();
    movementManager.cleanup();
    areaEffectManager.cleanup();
    particleManager.cleanup();
    buffManager.clearAll();
    playerManager.resetAllGameStatus();
    Instance.ServerCommand("mp_restartgame 5");
});

// ——— 3.2 玩家 / 怪物 → 游戏 / Buff ———

eventBus.on(event.Monster.Out.OnMonsterDeath, (/** @type {import("./monster/monster_const").OnMonsterDeath} */ payload) => {
    if (!payload.monster.model) return;
    /** @type {import("./util/definition").MovementRequest} */
    const removePayload = {
        type: MovementRequestType$1.Remove,
        entity: payload.monster.model,
        priority: -1,
    };
    eventBus.emit(event.Movement.In.RemoveRequest, removePayload);

    const killerPawn = /** @type {import("cs_script/point_script").CSPlayerPawn | null | undefined} */ (payload.killer);
    const killerSlot = killerPawn?.GetPlayerController?.()?.GetPlayerSlot?.();
    if (typeof killerSlot === "number" && killerSlot >= 0 && payload.reward > 0) {
        playerManager.dispatchReward(killerSlot, {
            type: "exp",
            amount: payload.reward,
            reason: `击杀 ${payload.monster.type} 经验`,
        });
    }
});
eventBus.on(event.Monster.Out.OnAttack, (/** @type {import("./monster/monster_const").OnMonsterAttack} */ payload) => {
    const targetSlot = payload.target?.GetPlayerController?.()?.GetPlayerSlot?.();
    if (typeof targetSlot !== "number" || targetSlot < 0) return;

    const player = playerManager.getPlayer(targetSlot);
    if (!player) return;

    player.takeDamage(payload.damage, payload.monster.model ?? null);
});
eventBus.on(event.Monster.Out.OnAllMonstersDead, () => {
    eventBus.emit(event.Wave.In.WaveEndRequest, {result: false});
});
eventBus.on(event.Player.Out.OnPlayerJoin, (payload) => {
    gameManager.onPlayerJoin();
});
eventBus.on(event.Player.Out.OnPlayerLeave, (payload) => {
    /** @type {import("./shop/shop_const").ShopCloseRequest} */
    const shopClosePayload = { slot: payload.slot, result: false };
    eventBus.emit(event.Shop.In.ShopCloseRequest, shopClosePayload);

    /** @type {import("./input/input_const").StopRequest} */
    const inputStopPayload = { slot: payload.slot, result: false };
    eventBus.emit(event.Input.In.StopRequest, inputStopPayload);

    /** @type {import("./hud/hud_const").HideHudRequest} */
    const hideHudPayload = { slot: payload.slot, result: false };
    eventBus.emit(event.Hud.In.HideHudRequest, hideHudPayload);

    const wasPlaying = gameManager.onPlayerLeave(payload.slot);
    if (wasPlaying && !playerManager.hasAlivePlayers()) {
        eventBus.emit(event.Game.In.GameLoseRequest, {});
    }
});

eventBus.on(event.Player.Out.OnPlayerDeath, (payload) => {
    /** @type {import("./shop/shop_const").ShopCloseRequest} */
    const shopClosePayload = { slot: payload.slot, result: false };
    eventBus.emit(event.Shop.In.ShopCloseRequest, shopClosePayload);

    /** @type {import("./input/input_const").StopRequest} */
    const inputStopPayload = { slot: payload.slot, result: false };
    eventBus.emit(event.Input.In.StopRequest, inputStopPayload);

    /** @type {import("./hud/hud_const").HideHudRequest} */
    const hideHudPayload = { slot: payload.slot, result: false };
    eventBus.emit(event.Hud.In.HideHudRequest, hideHudPayload);

    const wasPlaying = gameManager.onPlayerDeath();
    if (wasPlaying && !playerManager.hasAlivePlayers()) {
        eventBus.emit(event.Game.In.GameLoseRequest, {});
    }
});

eventBus.on(event.Player.Out.OnPlayerRespawn, (payload) => {
    gameManager.onPlayerRespawn();
});

// ——— 3.3 全员准备 → 开始游戏 → 开始波次 ———

eventBus.on(event.Player.Out.OnAllPlayersReady, () => {
    eventBus.emit(event.Game.In.StartGameRequest, {});
});

// ——— 3.5 输入 → 玩家技能 / 商店 ———

eventBus.on(event.Input.Out.OnInput, (/** @type {import("./input/input_const").OnInput} */ payload) => {
    if (payload.key !== "InspectWeapon") return;
    playerManager.handleInput(payload.slot, payload.key);
});

// ═══════════════════════════════════════════════
// 4. 引擎事件注册
// ═══════════════════════════════════════════════
Instance.OnScriptInput("startGame", () => {
    eventBus.emit(event.Game.In.StartGameRequest, {});
});

Instance.OnScriptInput("enterPreparePhase", () => {
    eventBus.emit(event.Game.In.EnterPreparePhaseRequest, { });
});

Instance.OnScriptInput("resetGame", () => {
    eventBus.emit(event.Game.In.ResetGameRequest, { });
});

Instance.OnScriptInput("gameWon", () => {
    eventBus.emit(event.Game.In.GameWinRequest, {});
});

Instance.OnScriptInput("gameLost", () => {
    eventBus.emit(event.Game.In.GameLoseRequest, {});
});

Instance.OnScriptInput("endWave", () => {
    eventBus.emit(event.Wave.In.WaveEndRequest, {result: false});
});

Instance.OnScriptInput("startWave", (scriptEvent) => {
    const entityName = scriptEvent.caller?.GetEntityName?.();
    if (!entityName) return;

    const parts = entityName.split("_");
    const waveNumber = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(waveNumber)) {
        /** @type {import("./wave/wave_const").WaveStartRequest} */
        const payload = { waveIndex: waveNumber, result: false };
        eventBus.emit(event.Wave.In.WaveStartRequest, payload);
    }
});

Instance.OnScriptInput("ready", (scriptEvent) => {
    const pawn = /** @type {import("cs_script/point_script").CSPlayerPawn|undefined} */ (scriptEvent.activator);
    playerManager.toggleReadyByPawn(pawn);
});

Instance.OnScriptInput("openshop", (scriptEvent) => {
    const controller = /** @type {import("cs_script/point_script").CSPlayerController|undefined} */ (scriptEvent.activator);
    const slot = controller?.GetPlayerSlot?.();
    const pawn = controller?.GetPlayerPawn?.();
    if (typeof slot !== "number" || !pawn) return;

    /** @type {import("./shop/shop_const").ShopOpenRequest} */
    const payload = { slot, pawn, result: false };
    eventBus.emit(event.Shop.In.ShopOpenRequest, payload);
});

Instance.OnScriptInput("closeshop", (scriptEvent) => {
    const controller = /** @type {import("cs_script/point_script").CSPlayerController|undefined} */ (scriptEvent.activator);
    const slot = controller?.GetPlayerSlot?.();
    if (typeof slot !== "number") return;

    /** @type {import("./shop/shop_const").ShopCloseRequest} */
    const payload = { slot, result: false };
    eventBus.emit(event.Shop.In.ShopCloseRequest, payload);
});

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

Instance.OnPlayerChat((chatEvent) => {
    playerManager.handlePlayerChat(chatEvent);
    const controller = chatEvent.player;
    const text = chatEvent.text;
    if (!controller) return;

    const parts = text.trim().toLowerCase().split(/\s+/);
    const command = parts[0];
    Number(parts[1]);

    if (command === "shop" || command === "!shop") {
        const pawn = controller.GetPlayerPawn();
        if (pawn) {
            /** @type {import("./shop/shop_const").ShopOpenRequest} */
            const payload = { slot: controller.GetPlayerSlot(), pawn, result: false };
            eventBus.emit(event.Shop.In.ShopOpenRequest, payload);
        }
    }
});

// ═══════════════════════════════════════════════
// 5. 主循环（统一 think）
// ═══════════════════════════════════════════════

/** 上一帧时间戳，用于计算 dt */
let _lastTime = Instance.GetGameTime();

Instance.SetThink(() => {
    const now = Instance.GetGameTime();
    const dt = Math.max(0, now - _lastTime);
    _lastTime = now;
    const isGamePlaying = gameManager.checkGameState();
    const alivePlayers = playerManager.getAlivePlayers();
    const alivePawns = alivePlayers
        .map((player) => player.entityBridge.pawn)
        .filter((pawn) => pawn != null);
    const currentMonsters = monsterManager.getActiveMonsters();
    const currentMonsterEntities = currentMonsters
        .map((monster) => monster.model)
        .filter((entity) => entity != null);

    // ── 5.1 输入 / 玩家 / 波次 / Buff ──
    inputManager.tick();
    playerManager.tick();
    if (isGamePlaying) {
        waveManager.tick();
    }
    if (isGamePlaying) {
        monsterManager.tick(currentMonsterEntities, alivePawns);
    }
    if (isGamePlaying) {
        skillManager.tick();
        const activeMonsters = monsterManager.getActiveMonsters();
        const monsterEntities = activeMonsters
            .map((monster) => monster.model)
            .filter((entity) => entity != null);
        const separationPositions = monsterEntities
            .map((entity) => entity.GetAbsOrigin())
            .filter((position) => position != null);
        tempContext.updateTickContext({
            activeMonsters,
            monsterEntities,
            separationPositions,
        });
        movementManager.tick(now, dt, tempContext.separationPositions);
        monsterManager.syncMovementStates(movementManager.getAllStates());
        areaEffectManager.tick(now, {
            players: alivePlayers,
            monsters: tempContext.activeMonsters,
        });
        particleManager.tickAll(now);
        buffManager.tick();
    } else {
        tempContext.resetTickContext();
    }
    if (isGamePlaying) {
        navMesh.tick(alivePawns[0]?.GetAbsOrigin?.());
    }

    // ── 5.2 其他模块 tick ──
    shopManager.tick();
    hudManager.tick(alivePlayers.map(p => p.getSummary()));

    // ── 5.3 玩家状态 HUD 同步 ──
    Instance.SetNextThink(now + 1 / 64);
});
Instance.SetNextThink(Instance.GetGameTime() + 1 / 64);

Instance.Msg("=== PvE Release 已启动 ===");

playerManager.refresh();
