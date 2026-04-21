/**
 * @module 玩家系统/玩家/玩家实体
 */
import { eventBus } from "../../util/event_bus";
import { event } from "../../util/definition";
import { PlayerRuntimeEvents } from "../../util/runtime_events.js";
import { PlayerEntityBridge } from "./components/entity_bridge";
import { PlayerStats } from "./components/player_stats";
import { PlayerHealthCombat } from "./components/health_combat";
import { PlayerLifecycle } from "./components/lifecycle";
import { CSPlayerPawn, Instance } from "cs_script/point_script";
import { DEFAULT_PLAYER_PROFESSION, getPlayerProfessionConfig, getPlayerStateLabel, PlayerState } from "../player_const";

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
export class Player {
    /**
     * @param {number} slot 引擎 PlayerSlot
     */
    constructor(slot) {
        /** @type {number} 引擎 PlayerSlot */
        this.slot = slot;
        /**@type {import("cs_script/point_script").Vector} */
        this.pos={x:0,y:0,z:0};
        /** @type {boolean} 玩家在当前对局中是否进入过 game_start 游戏区域 */
        this.inGame = false;
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
        this.addMoney(500);//初始金钱
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
     * 绑定 Pawn，进入可游戏状态,可以复活。
     * @param {import("cs_script/point_script").CSPlayerPawn|undefined|null} [pawn] 玩家 Pawn 实体
     */
    updatePawn(pawn) {
        this.lifecycle.activate(pawn);
    }
    respawn() {
        this.lifecycle.respawn();
    }
    /**
     * 断开连接，清理资源。
     */
    disconnect() {
        this.inGame = false;
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
        this.inGame = false;
        this.clearBuffs();
        this.lifecycle.resetGameStatus();
    }

    /**
     * @param {boolean} inGame
     * @returns {boolean}
     */
    setInGame(inGame) {
        this.inGame = !!inGame;
        return this.inGame;
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

    enterGameStart() {
        this.lifecycle.enterGameStart();
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
     * 记录一次玩家对怪物造成的最终伤害。
     * @param {number} amount
     * @returns {number}
     */
    recordMonsterDamage(amount) {
        return this.stats.recordMonsterDamage(amount);
    }

    /**
     * 通过客户端命令给予玩家武器。
     * @param {string} weaponName
     * @returns {boolean}
     */
    giveWeapon(weaponName) {
        return this.entityBridge.giveItem(weaponName);
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
        this.emitStatusChanged({ buff: true });
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
        return removeRequest.result;
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
        this.emitStatusChanged({ buff: true });
        return true;
    }

    /**
     * 清空当前玩家身上的全部 Buff。
     */
    clearBuffs() {
        for (const typeId of Array.from(this.buffMap.keys())) {
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
            this.emitStatusChanged({ buff: true });
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
        let handled = false;
        for (const id of this.buffMap.values()) {
            /** @type {import("../../buff/buff_const").BuffEmitRequest} */
            const emitRequest = {
                buffId: id,
                eventName,
                params,
                result: { result: false },
            };
            eventBus.emit(event.Buff.In.BuffEmitRequest, emitRequest);
            const emitResult = /** @type {{ result?: boolean }} */ (emitRequest.result);
            handled = emitResult.result === true || handled;
        }
        return handled;
    }

    /**
     * @param {import("../../input/input_const").InputKey} key
     * @returns {boolean}
     */
    handleInputKey(key) {
        if (!this.isReady) return false;
        return this.emitRuntimeEvent(PlayerRuntimeEvents.Input, { key });
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
     * 向玩家宿主内的 buff 与 skill 同时广播统一运行时事件。
     * @param {string} eventName
        * @param {import("../../util/runtime_events.js").RuntimeEventPayload} [params]
     * @returns {boolean}
     */
    emitRuntimeEvent(eventName, params = {}) {
        const buffHandled = this.emitBuffEvent(eventName, params);
        const skillHandled = this.emitSkillEvent(eventName, params);
        return buffHandled || skillHandled;
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
     * @returns {boolean}
     */
    setProfession(professionId) {
        const config = getPlayerProfessionConfig(professionId);
        if (!config) return false;
        if (this.professionId === professionId && this.skillId != null) return true;

        let nextSkillId = null;
        if (config.skillTypeId) {
            nextSkillId = this._addSkillFromProfession(config);
            if (nextSkillId == null) return false;
        }

        const previousSkillId = this.skillId;
        if (previousSkillId != null) {
            const removed = this._removeSkillById(previousSkillId);
            if (!removed) {
                if (nextSkillId != null) {
                    this._removeSkillById(nextSkillId);
                }
                return false;
            }
        }

        this.professionId = professionId;
        this.skillId = nextSkillId;
        this.skillTypeId = config.skillTypeId ?? null;

        this.emitStatusChanged({
            professionId: this.professionId,
            professionDisplayName: config.displayName,
            skill: true,
        });

        return true;
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
        if (!Object.values(PlayerState).includes(nextState)) return false;
        if (this.state === nextState) return true;
        const oldState = this.state;
        this.state = nextState;
        this.emitStatusChanged({
            state: this.state,
            stateLabel: getPlayerStateLabel(this.state),
        });
        this.emitRuntimeEvent(PlayerRuntimeEvents.StateChange, { oldState, nextState });
        return true;
    }

    /**
     * 向外发送玩家状态变化事件。
     * @param {import("../player_const").PlayerSummary} summary
     * @returns {void}
     */
    emitStatusChanged(summary) {
        /**@type {import("../player_const").OnPlayerStatusChanged} */
        const payload = {
            player: this,
            pawn: this.entityBridge.pawn,
            slot: this.slot,
            summary,
        };
        eventBus.emit(event.Player.Out.OnPlayerStatusChanged, payload);
    }

    /**
     * 发送一份完整的 HUD 基线快照。
     * @returns {void}
     */
    emitStatusSnapshot() {
        this.emitStatusChanged({
            ...this.getSummary(),
            buff: true,
            skill: true,
        });
    }

    // ——— Tick ———
    /**
     * 每帧调度入口。
     * @param {boolean} [gameActive=false]
     */
    tick(gameActive = false) {
        const pawn = this.entityBridge.pawn;
        if (pawn?.IsValid()) {
            this.pos = pawn.GetAbsOrigin?.();
        }

        if (!gameActive || !this.isReady) return;
        this.emitRuntimeEvent(PlayerRuntimeEvents.Tick, {});
    }

    // ——— 查询 ———

    /**
     * 获取玩家属性快照（委托给 Stats）。
     * @returns {any}
     */
    getSummary() {
        const professionConfig = getPlayerProfessionConfig(this.professionId);
        return {
            ...this.stats.getSummary(),
            pawn: this.entityBridge.pawn,
            professionId: this.professionId,
            professionDisplayName: professionConfig?.displayName ?? this.professionId,
            state: this.state,
            stateLabel: getPlayerStateLabel(this.state),
        };
    }
}
