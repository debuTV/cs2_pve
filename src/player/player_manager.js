/**
 * @module 玩家系统/玩家管理器
 */
import { CSPlayerController, CSPlayerPawn, Instance } from "cs_script/point_script";
import { Player, PlayerEvents } from "./player/player";
import { PlayerState } from "./player_const";

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
export class PlayerManager {
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
        this.events = new PlayerManagerEvents();
        /** @type {Record<string, (player: Player, payload: TP_playerRewardPayload) => void>} */
        this._rewardHandlers = {
            buff: (player, payload) => {
                if (!payload.buffTypeId) return;
                player.addBuff(payload.buffTypeId, payload.params ?? {});
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
        const count = Number(parts[1]);

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
        player.events.setOnReadyChanged((ready) => {
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
        player.events.setBuffEvent(
            (typeId,params)=> this.events.OnBuffAddedRequest?.(player,typeId,params)??null,
            (buffId)=>this.events.OnBuffRemovedRequest?.(player,buffId)??false,
            (buffId,params)=>this.events.OnBuffRefreshedRequest?.(player,buffId,params)??false,
            (buffId,event,params)=>this.events.OnBuffEmitEvent?.(player,buffId,event,params)??false
        )
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
     * 由 main.js 统一调度的玩家 Buff 应用入口。
     * PlayerManager 不主动决定何时发 Buff；它只负责在 main 给出最终结论后，
     * 把请求路由到对应 Player，并补齐当前目标玩家上下文。
     * @param {number|null} playerSlot null = 全体玩家
     * @param {string} typeId Buff 类型 ID
     * @param {Record<string, any>} params Buff 参数
     * @returns {any}
     */
    applyBuff(playerSlot, typeId, params) {
        if (!typeId) return null;

        /** @type {any} */
        let appliedBuff = null;
        this._forEachTargetPlayer(playerSlot, (player) => {
            const buff = player.addBuff(typeId, params);
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
export class PlayerManagerEvents {
    constructor() {
        // manager 级事件回调
        this.OnPlayerJoin = null;
        this.OnPlayerLeave = null;
        this.OnPlayerReady = null;
        this.OnPlayerDeath = null;
        this.OnPlayerRespawn = null;
        this.OnAllPlayersReady = null;
        //player buff事件回调
        this.OnBuffAddedRequest = null;
        this.OnBuffRemovedRequest = null;
        this.OnBuffRefreshedRequest = null;
        this.OnBuffEmitEvent = null;
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
    /** 设置全员准备就绪回调。 @param {() => void} callback */
    setOnAllPlayersReady(callback) { this.OnAllPlayersReady = callback; }

    /** 设置玩家 Buff 添加请求回调。 @param {(player: any, typeId: string, params: Record<string, any>) => number|null} callback*/
    setOnPlayerBuffAddRequest(callback) { this.OnBuffAddedRequest = callback; }
    /** 设置玩家 Buff 删除请求回调。 @param {(player: any, buffid: number) => boolean} callback*/
    setOnPlayerBuffDeleteRequest(callback) { this.OnBuffRemovedRequest = callback; }
    /** 设置玩家 Buff 刷新请求回调。 @param {(player: any, buffid: number, params: Record<string, any>) => boolean} callback*/
    setOnPlayerBuffRefreshRequest(callback) { this.OnBuffRefreshedRequest = callback; }
    /** 设置玩家 Buff 发射事件回调。 @param {(player: any, buffid: number, event: string, params: any) => boolean} callback*/
    setOnPlayerBuffEmitEvent(callback) { this.OnBuffEmitEvent = callback; }
}