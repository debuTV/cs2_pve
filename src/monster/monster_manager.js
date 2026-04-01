/**
 * @module 怪物系统/怪物管理器
 */
import { CSPlayerPawn, Entity, Instance} from "cs_script/point_script";
import { Monster } from "./monster/monster";
import { targetTeam } from "./monster_const";
import { SpawnService } from "./monster_manager/spawn_service";
import { LifecycleService } from "./monster_manager/lifecycle_service";
import { MonsterState } from "./monster/monster_state";
/**
 * 怪物管理器。
 *
 * 负责整个怪物集合的生命周期和每帧调度，是外部系统（如 GameManager、
 * DebugManager）与怪物系统交互的唯一入口。
 *
 * 主要职责：
 * - 持有全部怪物实例（`monsters` Map，id → Monster）。
 * - 协调 `SpawnService` 刷怪。
 * - 采集本帧上下文（所有怪物位置、所有玩家 pawn），传给怪物 tick。
 * - 维护区域效果服务 `AreaEffectService`，驱动怪物技能制造的持续区域效果。
 * - 监听怪物领域事件并通过 `MonsterManagerEvents` 向上层暴露统一回调。
 *
 * 支持交替移动模式：当 `alternatMode` 开启时，奇偶帧各驱动一半怪物，
 * 降低每帧计算量，从而支持更大规模的怪物数量。
 *
 * 使用方式：先构造 `new MonsterManager()`（会自动初始化 NavMesh），
 * 然后在主循环中每帧调用 `tick()` 驱动所有怪物逻辑。
 *
 * @navigationTitle 怪物管理器
 */
export class MonsterManager {
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
        /** 累计奖励金额。
         * @type {number} */
        this.totalReward = 0;
        /** 总帧计数。用于奇偶帧交替调度怪物 tick。 */
        this.totaltick=-1;

        // ── 帧上下文缓存（增量维护，tick 只刷新位置）──
        /** @type {Monster[]} 缓存的活跃怪物实例，与 _cachedAllmpos/_cachedPositions 同索引。 */
        this._cachedMonsters = [];
        /** @type {Entity[]} 缓存的活跃怪物 breakable 数组（内部复用，调用方只读）。 */
        this._cachedAllmpos = [];
        /** @type {import("cs_script/point_script").Vector[]} 缓存的怪物位置（每 tick 原位更新）。 */
        this._cachedPositions = [];
        /** @type {Map<number,number>} 私有索引：怪物 id → 缓存数组下标，用于 O(1) 删除。 */
        this._monsterCacheIdx = new Map();
        /** @type {CSPlayerPawn[]} 缓存的存活敌对玩家 pawn（事件驱动更新）。 */
        this._cachedAllppos = [];
        /**
         * 复用的 tickContext 对象壳。
         * 返回的 allmpos / allppos / monsterPositions 是内部缓存引用，调用方只读、不可持久化后修改。
         */
        this._tickContext = { allmpos: this._cachedAllmpos, allppos: this._cachedAllppos, monsterPositions: this._cachedPositions };

        /** 管理器级事件集合。向上层暴露生成/死亡/全灭/攻击/技能事件。 */
        this.events = new MonsterManagerEvents();
        this._buffController = null;
        /** 刷怪服务。负责波次调度和单体生成。 */
        this.spawnService = new SpawnService(this);
        /** 生命周期服务。处理死亡/清理/统计。 */
        this.lifecycle = new LifecycleService(this, this.spawnService);
    }
    /**
     * 生成一波怪物。委托 SpawnService。
     * @param {import("../util/definition").waveConfig} waveConfig 波次配置
     */
    spawnWave(waveConfig) {
        this.spawnService.spawnWave(waveConfig);
    }
    /**
     * 停止刷怪。委托 SpawnService。
     */
    stopWave()
    {
        this.spawnService.stopWave();
    }
    /**
     * 生成单个怪物。委托 SpawnService。
     * @param {import("../util/definition").waveConfig} waveConfig 波次配置
     * @returns {Monster|null}
     */
    spawnMonster(waveConfig) {
        return this.spawnService.spawnMonster(waveConfig);
    }
    /**
     * 处理怪物死亡。委托 LifecycleService。
     * @param {Monster} monsterInstance 死亡怪物实例
     * @param {import("cs_script/point_script").Entity|null|undefined} killer 击杀者
     */
    handleMonsterDeath(monsterInstance, killer) {
        this.lifecycle.handleMonsterDeath(monsterInstance, killer);
    }
    /**
     * 强制清理所有怪物和区域效果。
     */
    cleanup() {
        this.lifecycle.cleanup();
    }
    /**
     * 强制击杀所有怪物。
     * @returns {number[]} 被击杀怪物 ID 列表
     */
    killAllMonsters() {
        return this.lifecycle.killAllMonsters();
    }

    /**
     * 每帧主循环。依次：刷新上下文 → 怪物 tick → 刷怪 tick。
     * 移动的实际推进由 main 在 tick 后统一执行。
     *
     * 返回的 tickContext 是内部复用对象，调用方只读。
     * @returns {{allmpos: Entity[], allppos: CSPlayerPawn[], monsterPositions: import("cs_script/point_script").Vector[]}}
     */
    tick()
    {
        this.totaltick++;
        const now=Instance.GetGameTime();
        const tickContext=this.collectTickContext();
        this.tickMonsters(tickContext.allmpos,tickContext.allppos);
        this.spawnService.tick(now);
        return tickContext;
    }
    /**
     * 刷新缓存中的怪物位置并返回复用的上下文对象。
     *
     * allmpos / allppos 由生命周期事件增量维护，此处只原位更新 monsterPositions。
     * @returns {{allmpos: Entity[], allppos: CSPlayerPawn[], monsterPositions: import("cs_script/point_script").Vector[]}}
     */
    collectTickContext()
    {
        for(let i=0;i<this._cachedMonsters.length;i++){
            this._cachedPositions[i]=this._cachedMonsters[i].model.GetAbsOrigin();
        }
        return this._tickContext;
    }

    /**
     * 驱动所有怪物的 tick。奇偶帧交替调度降低每帧计算量。
     * @param {Entity[]} allmpos 所有活跃怪物实体
     * @param {CSPlayerPawn[]} allppos 所有存活玩家
     */
    tickMonsters(allmpos,allppos)
    {
        for (const [id, monster] of this.monsters) {
            try {
                monster.tick(allmpos,allppos);
            } catch (error) {
                Instance.Msg(`更新怪物 #${id} 失败: ${error}`);
            }
        }
    }

    /**
    * 为新生成的怪物绑定事件回调。绑定死亡/攻击/技能事件，
     * 设置产卵和区域效果请求回调。
     * @param {Monster} monster 新生成的怪物实例
     */
    bindMonsterCallbacks(monster)
    {
        monster.events.setOnDie((monsterInstance, killer) => {
            this.handleMonsterDeath(monsterInstance, killer);
        });
        monster.events.setOnAttackTrue((damage, target) => {
            this.events.OnAttack?.(damage, target);
        });
        monster.events.setOnSkillCast((id, target, payload) => {
            this.events.OnSkill?.(id, target, payload);
        });
        monster.events.setOnBeforeTakeDamage((monsterInstance, amount, attacker) => {
            return this.events.OnBeforeTakeDamage?.(monsterInstance, amount, attacker);
        });
        // 产卵请求需返回布尔值，保留直接回调模式
        monster.events.setOnSpawnRequest((caster, options) => {
            return this.spawnService.spawnBySkill(caster, options);
        });
        // 移动意图事件转发：Monster 产生的移动事件汇入 Manager 级队列
        monster.events.setOnMovementEvent((event) => {
            this.events.OnMovementRequest?.(event);
        });
    }

    // ── 怪物缓存维护（私有，由 SpawnService / LifecycleService 调用）──

    /** @param {Monster} monster */
    _addMonsterToCache(monster) {
        const idx = this._cachedMonsters.length;
        this._cachedMonsters.push(monster);
        this._cachedAllmpos.push(monster.breakable);
        this._cachedPositions.push(monster.model.GetAbsOrigin());
        this._monsterCacheIdx.set(monster.id, idx);
    }

    /** @param {number} monsterId */
    _removeMonsterFromCache(monsterId) {
        const idx = this._monsterCacheIdx.get(monsterId);
        if (idx === undefined) return;
        const last = this._cachedMonsters.length - 1;
        if (idx !== last) {
            const tail = this._cachedMonsters[last];
            this._cachedMonsters[idx] = tail;
            this._cachedAllmpos[idx] = this._cachedAllmpos[last];
            this._cachedPositions[idx] = this._cachedPositions[last];
            this._monsterCacheIdx.set(tail.id, idx);
        }
        this._cachedMonsters.pop();
        this._cachedAllmpos.pop();
        this._cachedPositions.pop();
        this._monsterCacheIdx.delete(monsterId);
    }

    _clearMonsterCache() {
        this._cachedMonsters.length = 0;
        this._cachedAllmpos.length = 0;
        this._cachedPositions.length = 0;
        this._monsterCacheIdx.clear();
    }

    // ── 玩家缓存维护（公开，由 main.js 事件桥接调用）──

    /**
     * 将一个玩家 pawn 加入缓存。内部检查队伍和去重。
     * @param {CSPlayerPawn} pawn
     */
    addPlayerPawn(pawn) {
        if (!pawn) return;
        if ((pawn.GetTeamNumber() ^ targetTeam) === 1) return;
        if (this._cachedAllppos.indexOf(pawn) !== -1) return;
        this._cachedAllppos.push(pawn);
    }

    /**
     * 从缓存移除一个玩家 pawn。
     * @param {CSPlayerPawn} pawn
     */
    removePlayerPawn(pawn) {
        const idx = this._cachedAllppos.indexOf(pawn);
        if (idx === -1) return;
        const last = this._cachedAllppos.length - 1;
        if (idx !== last) {
            this._cachedAllppos[idx] = this._cachedAllppos[last];
        }
        this._cachedAllppos.pop();
    }

    /**
     * 用给定的 pawn 列表重建玩家缓存。内部过滤队伍。
     * @param {CSPlayerPawn[]} pawns
     */
    syncAllPlayerPawns(pawns) {
        this._cachedAllppos.length = 0;
        for (const p of pawns) {
            if (p && (p.GetTeamNumber() ^ targetTeam) !== 1) {
                this._cachedAllppos.push(p);
            }
        }
    }

    /**
     * 通过 ID 获取怪物实例。
     * @param {number} id 怪物 ID
     * @returns {Monster|undefined}
     */
    getMonsterById(id) {
        return this.monsters.get(id);
    }

    setBuffController(controller) {
        this._buffController = controller;
        for (const [, monster] of this.monsters) {
            monster.buffManager.bindController(controller);
        }
    }

    applyBuff(monsterOrId, typeId, params, source, context = null) {
        const monster = typeof monsterOrId === "number"
            ? this.getMonsterById(monsterOrId)
            : monsterOrId;
        if (!monster || !typeId) return null;
        return monster.addBuff(typeId, params, source, {
            player: context?.player ?? null,
            monster: context?.monster ?? monster,
        });
    }

    /**
     * 将 movement 状态快照回写给对应的怪物实例。
     * 由 main 在 movementManager.tick() 后调用。
     * @param {Map<Entity, { mode: string; onGround: boolean; currentGoalMode: number | null; }>} states
     */
    syncMovementStates(states) {
        for (const [, monster] of this.monsters) {
            const state = states.get(monster.model);
            if (state) monster.updateMovementSnapshot(state);
        }
    }

    /**
     * 获取所有怪物实例数组。
     * @returns {Monster[]}
     */
    getAllMonsters() {
        return Array.from(this.monsters.values());
    }
    
    /**
     * 获取所有未死亡的怪物实例数组。
     * @returns {Monster[]}
     */
    getActiveMonsters() {
        return Array.from(this.monsters.values()).filter(monster => monster.state!=MonsterState.DEAD);
    }
    
    /**
     * 获取所有怪物 ID 数组。
     * @returns {number[]}
     */
    getAllMonsterIds() {
        return Array.from(this.monsters.keys());
    }
    
    /**
     * 获取当前活跃怪物数量。
     * @returns {number}
     */
    getMonsterCount() {
        return this.activeMonsters;
    }
    
    /**
     * 获取累计击杀数。
     * @returns {number}
     */
    getTotalKills() {
        return this.totalKills;
    }
    
    /**
     * 获取累计奖励金额。
     * @returns {number}
     */
    getTotalReward() {
        return this.totalReward;
    }
    
    /**
     * 重置统计数据（击杀数和奖励）。
     */
    resetStats() {
        this.totalKills = 0;
        this.totalReward = 0;
    }
    /**
     * 手动触发全灭事件。
     */
    triggerAllMonstersDead() {
        this.events.OnAllMonstersDead?.(this.totalKills, this.totalReward);
    }
    /**
     * 获取管理器状态快照。
     * @returns {{totalMonsters: number, activeMonsters: number, nextId: number, totalKills: number, totalReward: number}}
     */
    getStatus() {
        return {
            totalMonsters: this.monsters.size,
            activeMonsters: this.activeMonsters,
            nextId: this.nextMonsterId,
            totalKills: this.totalKills,
            totalReward: this.totalReward
        };
    }
}
/**
 * MonsterManager 级事件集合。
 */
export class MonsterManagerEvents {
    constructor() {
        /** @type {((monster: Monster) => void) | null} */
        this.OnMonsterSpawn = null;
        /** @type {((monster: Monster, killer: Entity|null|undefined, reward: number) => void) | null} */
        this.OnMonsterDeath = null;
        /** @type {((totalKills: number, totalReward: number) => void) | null} */
        this.OnAllMonstersDead = null;
        /** @type {((damage: number, target: CSPlayerPawn) => void) | null} */
        this.OnAttack = null;
        /** @type {((id: string, target: CSPlayerPawn, payload?: any) => void) | null} */
        this.OnSkill = null;
        /** @type {((monster: Monster, amount: number, attacker: CSPlayerPawn | null) => number | void) | null} */
        this.OnBeforeTakeDamage = null;
        /** @type {((req: any) => void) | null} */
        this.OnMovementRequest = null;
    }
    /** @param {(monster: Monster) => void} callback */
    setOnMonsterSpawn(callback) {
        this.OnMonsterSpawn = callback;
    }
    /** @param {(monster: Monster, killer: Entity|null|undefined, reward: number) => void} callback */
    setOnMonsterDeath(callback) {
        this.OnMonsterDeath = callback;
    }
    /** @param {(totalKills: number, totalReward: number) => void} callback */
    setOnAllMonstersDead(callback) {
        this.OnAllMonstersDead = callback;
    }
    /** @param {(damage: number, target: CSPlayerPawn) => void} callback */
    setOnAttack(callback) {
        this.OnAttack = callback;
    }
    /** @param {(id: string, target: CSPlayerPawn, payload?: any) => void} callback */
    setOnSkill(callback) {
        this.OnSkill = callback;
    }
    /** @param {(monster: Monster, amount: number, attacker: CSPlayerPawn | null) => number | void} callback */
    setOnBeforeTakeDamage(callback) {
        this.OnBeforeTakeDamage = callback;
    }
    /** @param {(req: any) => void} callback */
    setOnMovementRequest(callback) {
        this.OnMovementRequest = callback;
    }
}
