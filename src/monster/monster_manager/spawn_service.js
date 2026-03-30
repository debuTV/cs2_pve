/**
 * @module 怪物系统/怪物管理器/怪物生成相关
 */
import { Entity, Instance } from "cs_script/point_script";
import { spawnPointsDistance } from "../monster_const";
import { vec } from "../../util/vector";
import { Monster } from "../monster/monster";
import { MonsterManager } from "../monster_manager";
/**
 * 怪物刷新服务。
 *
 * 负责按波次配置在地图上生成怪物实例。核心流程：
 * 1. `spawnWave(waveConfig)` – 设置当前波次配置，解析生成点。
 * 2. `tick(now)` – 每帧检查是否到达刷怪间隔、是否超过存活上限、是否达到总数。
 * 3. `spawnMonster(waveConfig)` – 在随机生成点创建单个怪物，绑定事件并注册到 MonsterManager。
 *
 * 刷怪点距离检测：当 `spawnPointsDistance > 0` 时，只会选择
 * 离最近玩家距离不超过该值的生成点，避免怪物生成在无人区域。
 *
 * 内部持有 MonsterFactory 用于实际创建 Monster 对象。
 *
 * @navigationTitle 怪物刷新服务
 */
export class SpawnService {
    /**
     * 创建怪物刷新服务实例。
     * @param {MonsterManager} manager 怪物管理器，提供怪物注册、事件绑定等服务
     */
    constructor(manager) {
        /** 怪物管理器引用，提供怪物注册、ID 分配、事件绑定等能力。 */
        this.manager = manager;
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
         * @type {import("../../util/definition").waveConfig | null}
         */
        this.spawnconfig = null;
    }

    /**
     * 启动一个新波次的刷怪流程。
     *
     * 重置计数器与生成点列表，按配置中的 `monster_spawn_points_name` 查找地图实体，
     * 之后每帧由 `tick` 按间隔和存活上限驱动实际生成。
     *
     * @param {import("../../util/definition").waveConfig} waveConfig 波次配置，包含怪物总数、间隔、生成点名称等
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
     * 每帧刷怪驱动。按以下顺序检查是否应生成新怪物：
     * 1. 刷怪开关 `spawn` 是否开启。
     * 2. 已生成数 `spawnmonstercount` 是否达到波次总数。
     * 3. 距上次生成是否超过 `spawnInterval`。
     * 4. 当前存活怪物数是否低于 `aliveMonster` 上限。
     *
     * 满足全部条件后调用 `spawnMonster` 生成一只怪物并更新计数器。
     *
     * @param {number} now 当前游戏时间（秒）
     */
    tick(now) {
        if (!this.spawn) return;
        if (!this.spawnconfig) return;
        if (this.spawnmonstercount >= this.spawnconfig.totalMonsters) {
            this.spawn = false;
            return;
        }
        if (now - this.spawnpretick < this.spawnconfig.spawnInterval) return;
        if (this.manager.activeMonsters >= this.spawnconfig.aliveMonster) return;
        const monster = this.spawnMonster(this.spawnconfig);
        if (monster) {
            this.spawnmonstercount++;
            if (this.spawnmonstercount >= this.spawnconfig.totalMonsters) {
                this.spawn = false;
            }
            this.spawnpretick = now;
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
     * @param {import("../../util/definition").waveConfig} waveConfig 当前波次配置
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
            if (spawnPointsDistance > 0) {
                const players = Instance.FindEntitiesByClass("player");
                const maxDistSq = spawnPointsDistance * spawnPointsDistance;
                nearbySpawnPoints = this.spawnPoints.filter(sp => {
                    const spPos = sp.GetAbsOrigin();
                    for (const p of players) {
                        if (vec.lengthsq(spPos, p.GetAbsOrigin()) <= maxDistSq) return true;
                    }
                    return false;
                });
            }
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
            const typeConfig = this.getMonsterType(waveConfig, this.manager.nextMonsterId);
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
     * 由技能触发的怪物产卵。在施法者周围随机位置尝试生成一只指定类型的怪物。
     *
     * 在 `radiusMin`~`radiusMax` 范围内随机采样位置，最多尝试 `tries` 次，
     * 每次用包围盒检测碰撞遮挡，通过后调用 `createMonster` 创建。
     *
     * @param {Monster} caster 施法者怪物，用于获取中心坐标和默认类型
     * @param {{typeName?:string,radiusMin?:number,radiusMax?:number,tries?:number}} options 产卵选项
     * @returns {boolean} 是否成功生成
     */
    spawnBySkill(caster, options) {
        options = options || {};
        const typeName = options.typeName ?? caster.type;
        const typeConfig = this.findMonsterTypeByName(typeName);
        if (!typeConfig) {
            Instance.Msg(`技能产卵失败: 未找到怪物类型 ${typeName}`);
            return false;
        }
        if (!caster.breakable || !caster.breakable.IsValid()) return false;

        const center = caster.breakable.GetAbsOrigin();
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
     * 依次执行：分配全局递增 ID → 工厂创建实例 → 绑定管理器回调 →
     * 注册到 monsters 映射表 → 记录生命周期统计 → 注册首次寻路 → 发布生成事件。
     *
     * @param {import("../../util/definition").monsterTypes} typeConfig 怪物类型配置
     * @param {import("cs_script/point_script").Vector} position 生成世界坐标
     * @returns {Monster} 创建好的怪物实例
     */
    createMonster(typeConfig, position) {
        const monsterId = this.manager.nextMonsterId++;
        const monster = new Monster(monsterId, position, typeConfig);
        this.manager.bindMonsterCallbacks(monster);
        this.manager.monsters.set(monsterId, monster);
        this.manager.lifecycle.recordSpawn();
        this.manager._addMonsterToCache(monster);
        this.manager.events.OnMonsterSpawn?.(monster);
        monster.init();
        return monster;
    }

    /**
     * 在当前波次配置的怪物类型列表中按名称查找配置。
     * @param {string} typeName 要查找的怪物名称
     * @returns {import("../../util/definition").monsterTypes|null} 找到的配置，未找到返回 null
     */
    findMonsterTypeByName(typeName) {
        const allTypes = this.spawnconfig?.monsterTypes ?? [];
        for (const cfg of allTypes) {
            if (cfg.name == typeName) return cfg;
        }
        return null;
    }

    /**
     * 按怪物 ID 轮询选取波次中的怪物类型配置（取模分配）。
     * @param {import("../../util/definition").waveConfig} waveConfig 波次配置
     * @param {number} monsterId 怪物全局 ID
     * @returns {import("../../util/definition").monsterTypes}
     */
    getMonsterType(waveConfig, monsterId) {
        const typeIndex = monsterId % waveConfig.monsterTypes.length;
        return waveConfig.monsterTypes[typeIndex];
    }

    /**
     * 当前是否正在刷怪中。
     * @returns {boolean}
     */
    isSpawning() {
        return this.spawn;
    }

    hasPendingSpawns() {
        if (!this.spawnconfig) return false;
        return this.spawnmonstercount < this.spawnconfig.totalMonsters;
    }
}
