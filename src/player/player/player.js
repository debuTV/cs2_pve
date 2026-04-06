/**
 * @module 玩家系统/玩家/玩家实体
 */
import { eventBus } from "../../eventBus/event_bus";
import { PlayerBuffEvents } from "../../buff/buff_const";
import { event as eventDefs } from "../../util/definition";
import { PlayerEntityBridge } from "./components/entity_bridge";
import { PlayerStats } from "./components/player_stats";
import { PlayerHealthCombat } from "./components/health_combat";
import { PlayerLifecycle } from "./components/lifecycle";
import { CSPlayerPawn, Instance } from "cs_script/point_script";
import { PlayerState } from "../player_const";

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
     */
    addMoney(amount) {
        this.stats.addMoney(amount);
    }

    /**
     * 增加经验值。
     * @param {number} amount 经验量
     */
    addExp(amount) {
        this.stats.addExp(amount);
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

    // ——— Buff 入口（直接驱动全局 Buff 系统） ———

    /**
     * 添加指定类型的 Buff。
     * @param {string} typeId Buff 类型标识
     * @param {Record<string, any>} params Buff 初始化参数
     * @returns {boolean} 是否成功添加 Buff
     */
    addBuff(typeId, params) {
        if (this.buffMap.has(typeId)) return false;
        /** @type {import("../../buff/buff_const").BuffAddRequest} */
        const addRequest = {
            configid: typeId,
            target: this,
            targetType: "player",
            result: -1,
        };
        eventBus.emit(eventDefs.Buff.In.BuffAddRequest, addRequest);
        if (addRequest.result <= 0) return false;
        this.buffMap.set(typeId, addRequest.result);
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
        eventBus.emit(eventDefs.Buff.In.BuffRemoveRequest, removeRequest);
        if (!removeRequest.result) return false;
        this.buffMap.delete(typeId);
        return true;
    }

    /**
     * 刷新指定类型的 Buff；若不存在则尝试直接添加。
     * @param {string} typeId Buff 类型标识
     * @param {Record<string, any>} params Buff 刷新参数
     * @returns {boolean} 是否成功
     */
    refreshBuff(typeId, params) {
        const id = this.buffMap.get(typeId);
        if (id == null) return this.addBuff(typeId, params);
        /** @type {import("../../buff/buff_const").BuffRefreshRequest} */
        const refreshRequest = {
            buffId: id,
            result: false,
        };
        eventBus.emit(eventDefs.Buff.In.BuffRefreshRequest, refreshRequest);
        return refreshRequest.result;
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
            eventBus.emit(eventDefs.Buff.In.BuffEmitRequest, emitRequest);
        }
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
