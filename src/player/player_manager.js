/**
 * @module 玩家系统/玩家管理器
 */
import { CSPlayerController, CSPlayerPawn, Instance } from "cs_script/point_script";
import { eventBus } from "../util/event_bus";
import { event } from "../util/definition";
import { Player } from "./player/player";
import { getPlayerProfessionConfig, getPlayerProfessionIds, PlayerState } from "./player_const";

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
        const count = Number(parts[1]);

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
