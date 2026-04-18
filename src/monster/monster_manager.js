/**
 * @module 怪物系统/怪物管理器
 */
import { BaseModelEntity, CSPlayerPawn, Entity, Instance} from "cs_script/point_script";
import { eventBus } from "../util/event_bus";
import { event } from "../util/definition";
import { Monster } from "./monster/monster";
import { MonsterState,targetTeam,MonsterType } from "./monster_const";
import { vec } from "../util/vector";
import { Player } from "../player/player/player";
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
        /**
         * 当前存活怪物实例数组。
         * 创建时加入，死亡或清理时移除，避免每次查询都遍历全表。
         * @type {Monster[]}
         */
        this.activeMonsterList = [];
        /** 累计击杀数。
         * @type {number} */
        this.totalKills = 0;
        /**
         * 当前波次可用的生成点实体列表。由 `spawnWave` 按配置名称查找并填充，
         * 每次新波次开始时清空重建。
         * @type {import("cs_script/point_script").Vector[]}
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
        this.glowing=false;
    }
    /**
     * @param {Monster} monsterInstance 死亡怪物实例
     * @param {import("cs_script/point_script").Entity|null|undefined} killer 击杀者
     */
    handleMonsterDeath(monsterInstance, killer) {
        const monsterId = monsterInstance.id;
        const removed = this._removeActiveMonster(monsterId);
        if (!removed) return;
        void killer;
        this.totalKills++;
        if(this.spawnconfig && this.activeMonsters==0 && this.spawnmonstercount>=this.spawnconfig.totalMonsters) {
            eventBus.emit(event.Monster.Out.OnAllMonstersDead, {});
        }
    }

    forceCleanup() {
        for (const monster of this.monsters.values()) {
            monster.dispose();
        }
        this.monsters.clear();
        this.activeMonsterList = [];
        this.activeMonsters = 0;
        this.spawnPoints = [];
        this.spawnpretick = -1;
        this.spawnmonstercount = 0;
        this.spawn = false;
        this.spawnconfig = null;
        this.glowing = false;
    }

    /**
     * 重置游戏
     */
    resetAllGameStatus() {
        this.forceCleanup();
        this.glowing=false;
        this.nextMonsterId = 1;
        this.totalKills = 0;
    }
    /**
     * 每帧主循环。依次：刷新上下文 → 怪物 tick → 刷怪 tick。
     * 移动的实际推进由 main 在 tick 后统一执行。
     *
     * 返回的 tickContext 是内部复用对象，调用方只读。
     * @param {Player[]} allplayers
     */
    tick(allplayers)
    {
        for (const [id, monster] of this.monsters) {
            if (monster.state === MonsterState.DEAD && !monster.model && !monster.breakable) {
                this._removeActiveMonster(id);
                this.monsters.delete(id);
                continue;
            }
            monster.tick(allplayers);
            if (monster.state === MonsterState.DEAD && !monster.model && !monster.breakable) {
                this._removeActiveMonster(id);
                this.monsters.delete(id);
            }
        }
        this.spawntick();
    }
    spawntick()
    {
        const now=Instance.GetGameTime();
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
     */
    applyBuff(monsterId,typeId) {
        if (!typeId) return null;
        const monster = this.monsters.get(monsterId);
        if (!monster) return null;
        return monster.addBuff(typeId);
    }

    /**
     * @param {Monster} monster
     * @returns {void}
     */
    _addActiveMonster(monster) {
        if (this.activeMonsterList.some(activeMonster => activeMonster.id === monster.id)) return;
        this.activeMonsterList.push(monster);
        this.activeMonsters = this.activeMonsterList.length;
    }

    /**
     * @param {number} monsterId
     * @returns {boolean}
     */
    _removeActiveMonster(monsterId) {
        const activeMonsterIndex = this.activeMonsterList.findIndex(monster => monster.id === monsterId);
        if (activeMonsterIndex < 0) return false;
        this.activeMonsterList.splice(activeMonsterIndex, 1);
        this.activeMonsters = this.activeMonsterList.length;
        this.updateMonsterGlow();
        return true;
    }

    updateMonsterGlow() {
        const shouldGlow = this.activeMonsters > 0 && this.activeMonsters <= 20;
        if (!shouldGlow) {
            if (!this.glowing) return;
            this.glowing = false;
            for (const monster of this.activeMonsterList) {
                const model = monster.model;
                if (!model || !(model instanceof BaseModelEntity) || !model.IsGlowing()) continue;
                model.Unglow();
            }
            return;
        }

        this.glowing = true;
        for (const monster of this.activeMonsterList) {
            const model = monster.model;
            if (!model || !(model instanceof BaseModelEntity)) continue;
            model.Glow({ r: 255, g: 0, b: 0 });
        }
    }

    /**
     * @param {Map<Entity, {mode:string,pos:import("cs_script/point_script").Vector}>} movementStates
     */
    syncMovementStates(movementStates) {
        for (const monster of this.monsters.values()) {
            if (monster.state === MonsterState.DEAD) continue;
            const model = monster.model;
            if (!model) continue;
            const snapshot = movementStates.get(model);
            if (!snapshot) continue;
            monster.updateMovementMovemode(snapshot.mode, snapshot.pos);
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
     * 获取当前波次仍需清理的怪物数。
     * 包含未出生的波次怪物，以及当前仍存活的额外召唤物。
     * @param {number} [totalMonsters=this.spawnconfig?.totalMonsters ?? 0]
     * @returns {number}
     */
    getRemainingMonsters(totalMonsters = this.spawnconfig?.totalMonsters ?? 0) {
        const plannedTotal = Math.max(0, Math.round(totalMonsters ?? 0));
        if (plannedTotal <= 0) {
            return Math.max(0, this.activeMonsters);
        }

        return Math.max(0, plannedTotal - this.spawnmonstercount + this.activeMonsters);
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
        this.getspawnPoints(waveConfig);
    }

    /**
     * 停止当前波次的刷怪。将 `spawn` 标记设为 false，`tick` 不再生成新怪物。
     * 已生成的怪物不受影响。
     */
    stopWave() {
        this.spawn = false;
    }
    /**
     * @param {import("../util/definition").waveConfig} waveConfig 当前波次配置
     */
    getspawnPoints(waveConfig)
    {
        if (this.spawnPoints.length === 0) {
            const spawnPointNames = waveConfig.monster_spawn_points_name;
            spawnPointNames.forEach((/** @type {string} */ name) => {
                const found = Instance.FindEntitiesByName(name);
                this.spawnPoints.push(...found.map(entity => entity.GetAbsOrigin()));
            });
        }
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
            this.getspawnPoints(waveConfig);
            if (this.spawnPoints.length === 0)
            {   
                Instance.Msg("错误: 未找到怪物生成点");
                return null;
            }
            const pos = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
            const start = { x: pos.x, y: pos.y, z: pos.z };
            const end = { x: pos.x, y: pos.y, z: pos.z };
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
    * 在 `radiusMin`~`radiusMax` 范围内随机采样位置，最多尝试 10 次，
    * 每次先从较高位置向下探测可站立地面，再检查球形出生点遮挡，
    * 通过后调用 `createMonster` 创建。
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
        const center = this.getSpawnCenter(caster);
        if (!center) {
            Instance.Msg(`技能产卵失败: 怪物 #${caster.id} 缺少有效生成中心`);
            return false;
        }
        const radiusMin = Math.max(0, options.radiusMin ?? 24);
        const radiusMax = Math.max(radiusMin, options.radiusMax ?? 96);
        const tries = Math.min(10, Math.max(1, options.tries ?? 10));
        const spawnLift = 100;
        const probeHeight = 200;
        const probeDepth = 400;
        const clearanceRadius = 30;
        /** @type {import("cs_script/point_script").Entity[]} */
        const ignoreEntities = [];
        if (caster.breakable?.IsValid?.()) ignoreEntities.push(caster.breakable);
        if (caster.model?.IsValid?.()) ignoreEntities.push(caster.model);

        for (let i = 0; i < tries; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = radiusMin + Math.random() * (radiusMax - radiusMin);
            const pos = {
                x: center.x + Math.cos(angle) * dist,
                y: center.y + Math.sin(angle) * dist,
                z: center.z
            };
            const start = { x: pos.x, y: pos.y, z: pos.z + probeHeight };
            const end = { x: pos.x, y: pos.y, z: pos.z - probeDepth };
            const groundTrace = Instance.TraceLine({
                start,
                end,
                ignorePlayers: true,
                ignoreEntity: ignoreEntities.length > 0 ? ignoreEntities : undefined,
            });
            if (!groundTrace.didHit || groundTrace.startedInSolid || groundTrace.normal.z < 0.5) {
                continue;
            }

            const spawnPos = {
                x: groundTrace.end.x,
                y: groundTrace.end.y,
                z: groundTrace.end.z + spawnLift,
            };
            const clearanceTrace = Instance.TraceSphere({
                radius: clearanceRadius,
                start: spawnPos,
                end: spawnPos,
                ignorePlayers: true,
                ignoreEntity: ignoreEntities.length > 0 ? ignoreEntities : undefined,
            });
            if (clearanceTrace.didHit || clearanceTrace.startedInSolid) {
                continue;
            }

            const monster = this.createMonster(typeConfig, spawnPos);
            if (!monster) return false;
            Instance.Msg(`技能产卵成功 #${monster.id} ${monster.type}`);
            return true;
        }

        Instance.Msg(`技能产卵失败: ${typeName} 在 ${tries} 次尝试内未找到可用位置`);
        return false;
    }

    /**
     * 优先读取当前实体的实时坐标，避免使用延迟同步的缓存位置。
     * @param {Monster} caster
     * @returns {import("cs_script/point_script").Vector|null}
     */
    getSpawnCenter(caster) {
        const breakableOrigin = caster.breakable?.IsValid?.() ? caster.breakable.GetAbsOrigin?.() : null;
        if (breakableOrigin) return breakableOrigin;

        const modelOrigin = caster.model?.IsValid?.() ? caster.model.GetAbsOrigin?.() : null;
        if (modelOrigin) return modelOrigin;

        return caster.pos ?? null;
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
        this._addActiveMonster(monster);
        /** @type {import("./monster_const").OnMonsterSpawn} */
        const payload = { monster };
        eventBus.emit(event.Monster.Out.OnMonsterSpawn, payload);
        monster.init();
        this.updateMonsterGlow();
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
