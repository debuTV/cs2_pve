/**
 * @module 玩家系统/玩家/玩家实体
 */
import { PlayerEntityBridge } from "./components/entity_bridge";
import { PlayerStats } from "./components/player_stats";
import { PlayerHealthCombat } from "./components/health_combat";
import { PlayerBuffManager } from "./components/buff_manager";
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
export class Player {
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
export class PlayerEvents {
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
