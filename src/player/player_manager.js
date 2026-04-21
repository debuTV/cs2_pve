/**
 * @module 玩家系统/玩家管理器
 */
import { CSPlayerController, CSPlayerPawn, Instance } from "cs_script/point_script";
import { eventBus } from "../util/event_bus";
import { event } from "../util/definition";
import { formatScopedMessage } from "../util/log";
import { Player } from "./player/player";
import { getPlayerProfessionConfig, getPlayerProfessionIds, PlayerState } from "./player_const";

/**
 * @typedef {object} TP_playerRewardPayload - 玩家奖励分发载荷
 * @property {"buff"|"money"|"exp"|"heal"|"armor"|"damage"|"weapon"|"ready"|"respawn"|"resetGameStatus"|"profession"} type - 奖励类型
 * @property {string} [buffConfigId] - Buff 配置 ID（仅 type="buff" 时适用）
 * @property {number} [amount] - 数值（仅 type="money"、"exp"、"heal"、"armor"、"damage" 时适用）
 * @property {string} [weaponName] - 武器名称（仅 type="weapon" 时适用）
 * @property {string} [reason] - 原因描述（仅 type="money"、"exp" 时适用）
 * @property {boolean} [isReady] - 准备状态（仅 type="ready" 时适用）
 * @property {number} [health] - 生命值（仅 type="respawn" 时适用）
 * @property {number} [armor] - 护甲值（仅 type="respawn" 时适用）
 * @property {string} [professionId] - 职业ID（仅 type="profession" 时适用）
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
         * 当前可参战的 READY 玩家实例数组。
         * 仅在游戏进行中维护，避免每次查询都遍历全表。
         * @type {Player[]}
         */
        this.alivePlayerList = [];
        /**
         * 已完成死亡收尾的玩家槽位。
         * 致死伤害判定与引擎 OnPlayerKill 都会走同一个入口，但只允许收尾一次。
         * @type {Set<number>}
         */
        this._handledDeathSlots = new Set();
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
                if (!payload.buffConfigId) return false;
                return player.addBuff(payload.buffConfigId);
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
                this._syncAlivePlayer(player);
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
                player.respawn();
                this._syncPreparingRespawn(player);
                return true;
            },
            resetGameStatus: (player) => {
                player.resetGameStatus();
                this._syncAlivePlayer(player);
                return true;
            },
            profession: (player, payload) => {
                if (!payload.professionId) return false;
                return player.setProfession(payload.professionId);
            }
        };
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Player.In.GetPlayerSummaryRequest, (payload = {}) => {
                payload.result = typeof payload.slot === "number"
                    ? this.getPlayerSummary(payload.slot)
                    : null;
            }),
            eventBus.on(event.Player.In.DispatchRewardRequest, (payload) => {
                const rewards = payload.rewards;
                const targetSlot = payload.slot;
                payload.result = this.dispatchRewardRequest(targetSlot, rewards);
            })
        ];/** @type {{rewards: import("./player_manager").TP_playerRewardPayload[], slot: number|null,result:boolean}} */
    }
    /**
     * 所有类初始化完成后调用
     */
    refresh() {
        const players = Instance.FindEntitiesByClass("player");
        for (const player of players) {
            if (player && player instanceof CSPlayerPawn) {
                const controller = player.GetPlayerController();
                if (!controller || controller.IsBot()) continue;
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
        this._handledDeathSlots.delete(slot);
        const existingPlayer = this.players.get(slot);
        if (existingPlayer) {
            if (existingPlayer.isReady) this.readyCount--;
            this._removeAlivePlayer(slot);
            existingPlayer.disconnect();
            this.players.delete(slot);
            this.totalPlayers--;
        }

        const player = new Player(slot);
        player.connect(controller);
        this.players.set(slot, player);
        this.totalPlayers++;

        this._adapter.broadcast(formatScopedMessage("PlayerManager/handlePlayerConnect", `玩家 ${controller.GetPlayerName()} 加入游戏 (SLOT: ${slot})`));
        eventBus.emit(event.Player.Out.OnPlayerJoin, {
            player,
            slot,
        });

        this._adapter.sendMessage(slot, formatScopedMessage("PlayerManager/handlePlayerConnect", "=== 欢迎加入游戏 ==="));
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

        player.updatePawn(pawn);
        this._syncAlivePlayer(player);
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

        this._adapter.broadcast(formatScopedMessage("PlayerManager/handlePlayerDisconnect", `玩家 ${player.entityBridge.getPlayerName()} 离开游戏`));

        if (wasReady) {
            this.readyCount = Math.max(0, this.readyCount - 1);
        }

        this._removeAlivePlayer(playerSlot);
        this._handledDeathSlots.delete(playerSlot);
        player.disconnect();
        this.players.delete(playerSlot);
        this.totalPlayers--;

        eventBus.emit(event.Player.Out.OnPlayerLeave, {
            player,
            slot: playerSlot,
            wasReady,
            wasLobbyState,
        });

        if (!this.ingame && wasLobbyState && this.areAllPlayersReady()) {
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

            player.updatePawn(pawn);
            this._syncPreparingRespawn(player);
            if (player.state !== PlayerState.DEAD) {
                this._handledDeathSlots.delete(player.slot);
            }
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
     * 统一死亡收尾入口。
     * 致死伤害判定与引擎 OnPlayerKill 都会走这里，但内部只会真正处理一次。
     * @param {CSPlayerPawn} playerPawn 玩家 Pawn 实体
     * @returns {boolean} 本次是否首次完成死亡收尾
     */
    handlePlayerDeath(playerPawn) {
        if (!(playerPawn instanceof CSPlayerPawn)) return false;
        const controller = playerPawn.GetPlayerController();
        if (!controller) return false;
        const slot = controller.GetPlayerSlot();
        const player = this.players.get(slot);
        if (!player) return false;
        if (player.entityBridge.pawn && player.entityBridge.pawn !== playerPawn) return false;
        if (this._handledDeathSlots.has(slot))
        {
            Instance.Msg(formatScopedMessage("PlayerManager/handlePlayerDeath", "玩家死亡事件已处理过，跳过重复处理\n"));
            return false;
        }

        const wasReady = player.isReady;
        if (player.state !== PlayerState.DEAD) {
            player.healthCombat.die(null);
        }
        if (wasReady) {
            this.readyCount = Math.max(0, this.readyCount - 1);
        }

        this._removeAlivePlayer(slot);
        this._handledDeathSlots.add(slot);
        eventBus.emit(event.Player.Out.OnPlayerDeath, {
            player,
            slot,
            playerPawn,
        });
        return true;
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
        const count = Number(parts[1]);

        //if (command === "r" || command === "!r") {
        //    //玩家准备
        //    this._setPlayerReady(player, true);
        //    return;
        //}
        //if (command ==="money"||command === "!money") {
        //    //测试用，给予金钱
        //    player.addMoney(100000);
        //    return;
        //}
        //if (command ==="exp"||command === "!exp") {
        //    //测试用，给予经验
        //    player.addExp(100000);
        //    return;
        //}
    }

    /**
     * 引擎伤害事件前置拦截，若玩家已死亡则中止伤害。
     * @param {import("cs_script/point_script").ModifyPlayerDamageEvent} event 引擎伤害修改事件
     */
    handleBeforePlayerDamage(event) {

        return;
    }

    /**
     * 同步引擎侧伤害到脚本层；若判定致死，则进入统一死亡收尾入口。
     * @param {import("cs_script/point_script").PlayerDamageEvent} event 引擎伤害事件
     */
    handlePlayerDamage(event) {
        const controller = event.player.GetPlayerController();
        if (!controller) return;
        const slot = controller.GetPlayerSlot();
        const player = this.players.get(slot);
        if (!player) return;

        const killed = player.syncDamageFromEngine(event.damage, event.attacker, event.inflictor);
        if (killed) {
            this.handlePlayerDeath(event.player);
        }
    }

    /**
     * 由 main.js 转发 ready 脚本输入，切换玩家准备状态。
     * @param {CSPlayerPawn|undefined|null} pawn
     * @param {boolean} ready 
     * @returns {boolean}
     */
    toggleReadyByPawn(pawn, ready) {
        if (!(pawn instanceof CSPlayerPawn)) return false;
        const controller = pawn.GetPlayerController();
        if (!controller) return false;

        const player = this.players.get(controller.GetPlayerSlot());
        if (!player) return false;
        if (player.inGame) return false;

        return this._setPlayerReady(player, ready);
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
        else this.readyCount = Math.max(0, this.readyCount - 1);

        this._syncAlivePlayer(player);

        const name = player.entityBridge.getPlayerName();
        this._adapter.broadcast(formatScopedMessage(
            "PlayerManager/_setPlayerReady",
            ready
                ? `${name} 已准备 (${this.readyCount}/${this.totalPlayers})`
                : `${name} 取消准备 (${this.readyCount}/${this.totalPlayers})`
        ));
        eventBus.emit(event.Player.Out.OnPlayerReadyChanged, {
            player,
            slot: player.slot,
            ready,
            readyCount: this.readyCount,
            totalPlayers: this.totalPlayers,
        });

        if (ready && !this.ingame && this.areAllPlayersReady()) {
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
     * 记录指定玩家最近一次对怪物造成的实际伤害。
     * @param {number} playerSlot
     * @param {number} amount
     * @returns {number}
     */
    recordMonsterDamage(playerSlot, amount) {
        const player = this.players.get(playerSlot);
        if (!player) return 0;
        return player.recordMonsterDamage(amount);
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
        if (!this.ingame || !player.isReady) return false;
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
     * @returns {Player[]} 返回当前可参战的 READY 玩家
     */
    getCombatPlayers() {
        if (!this.ingame) return [];
        return this.alivePlayerList;
    }

    /**
     * @returns {boolean}
     */
    hasAlivePlayers() {
        return this.alivePlayerList.length > 0;
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
        this.readyCount = this._countReadyPlayers();
        this._handledDeathSlots.clear();
        this.alivePlayerList = [];
        for (const [, player] of this.players) {
            if (!player.entityBridge.pawn) continue;
            player.enterGameStart();
            this._syncAlivePlayer(player);
        }
    }

    resetAllGameStatus() {
        this.ingame = false;
        this.readyCount = 0;
        this._handledDeathSlots.clear();
        for (const [, player] of this.players) {
            player.resetGameStatus();
        }
        this.alivePlayerList = [];
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
     * @param {Player} player
     * @returns {void}
     */
    _addAlivePlayer(player) {
        this._handledDeathSlots.delete(player.slot);
        if (this.alivePlayerList.some(alivePlayer => alivePlayer.slot === player.slot)) return;
        this.alivePlayerList.push(player);
    }

    /**
     * @param {number} playerSlot
     * @returns {boolean}
     */
    _removeAlivePlayer(playerSlot) {
        const alivePlayerIndex = this.alivePlayerList.findIndex(player => player.slot === playerSlot);
        if (alivePlayerIndex < 0) return false;
        this.alivePlayerList.splice(alivePlayerIndex, 1);
        return true;
    }

    /**
     * @param {Player} player
     * @returns {void}
     */
    _syncAlivePlayer(player) {
        if (this.ingame && player.isReady && player.entityBridge.isPawnValid()) {
            this._addAlivePlayer(player);
            return;
        }
        this._removeAlivePlayer(player.slot);
    }

    /**
     * 玩家重生后统一进入 PREPARING，需要同步 readyCount 与可参战缓存。
     * @param {Player} player
     * @returns {void}
     */
    _syncPreparingRespawn(player) {
        this.readyCount = this._countReadyPlayers();
        this._syncAlivePlayer(player);
    }

    /**
     * @returns {number}
     */
    _countReadyPlayers() {
        let readyCount = 0;
        for (const player of this.players.values()) {
            if (player.isReady) {
                readyCount++;
            }
        }
        return readyCount;
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
            alive: this.alivePlayerList.length
        };
    }

    /**
     * 每帧驱动所有在线玩家的持续逻辑。
     */
    tick() {
        for (const [slot, player] of this.players) {
            player.tick(this.ingame);
        }
    }
}
