/**
 * @module 怪物系统/怪物管理器/全局生命周期相关
 */
import { Entity, Instance } from "cs_script/point_script";
import { MonsterManager } from "../monster_manager";
import { SpawnService } from "./spawn_service";
import { Monster } from "../monster/monster";
/**
 * 怪物生命周期服务。
 *
 * 负责怪物死亡、清理、强制击杀等数量层面的生命周期逻辑。
 * 
 * @navigationTitle 怪物生命周期服务
 */
export class LifecycleService {
    /**
     * 创建生命周期服务实例。
     * @param {MonsterManager} manager 所属怪物管理器
     * @param {SpawnService} spawnService 刷怪服务实例
     */
    constructor(manager, spawnService) {
        /** 所属怪物管理器。 */
        this.manager = manager;
        /** 刷怪服务实例，用于判断是否正在刷怪。 */
        this.spawnService = spawnService;
        /** 
         * 当前抑制“全部怪物已死亡”事件的层级。每进入一个强制清理/输局回收流程时增加，离开时减少。
         * 仅当为0且没有活跃怪物时，才允许触发自然清场的“全部怪物已死亡”事件。
         * @type {number} 
         */
        this._allDeadSuppressDepth = 0;
    }

    /**
     * 处理单个怪物死亡，记录统计并在自然清场时发布事件。
     * @param {Monster} monsterInstance 死亡的怪物实例
     * @param {Entity|null|undefined} killer 击杀者实体
     */
    handleMonsterDeath(monsterInstance, killer) {
        const monsterId = monsterInstance.id;
        const reward = monsterInstance.baseReward;
        this.recordDeath(reward);
        this.manager.monsters.delete(monsterId);
        this.manager._removeMonsterFromCache(monsterId);
        this.manager.events.OnMonsterDeath?.(monsterInstance, killer, reward);
        if (this._shouldEmitAllMonstersDead()) {
            this.manager.events.OnAllMonstersDead?.(this.manager.totalKills, this.manager.totalReward);
        }
        Instance.Msg(`怪物 #${monsterId} 死亡，奖励 ${reward}`);
    }

    /**
     * 强制清理所有怪物并停止刷怪。
     * 强制流程不应被当成正常通关。
     */
    cleanup() {
        this._withAllDeadSuppressed(() => {
            for (const [id, monster] of this.manager.monsters) {
                try {
                    monster.die(null);
                } catch (error) {
                    Instance.Msg(`清理怪物 #${id} 失败: ${error}`);
                }
            }
            this.manager.monsters.clear();
            this.manager._clearMonsterCache();
            this.manager.activeMonsters = 0;
            this.spawnService.stopWave();
        });
        Instance.Msg("所有怪物已清理");
    }

    /**
     * 强制击杀所有怪物，不触发自然清场逻辑。
     * @returns {number[]}
     */
    killAllMonsters() {
        /**
         * @type {number[]}
         */
        const killed = [];
        this._withAllDeadSuppressed(() => {
            for (const [id, monster] of this.manager.monsters) {
                try {
                    monster.die(null);
                    killed.push(id);
                } catch (error) {
                    Instance.Msg(`杀死怪物 #${id} 失败: ${error}`);
                }
            }
        });
        Instance.Msg(`强制杀死${killed.length} 个怪物`);
        return killed;
    }

    /**
     * 记录一次怪物生成。
     */
    recordSpawn() {
        this.manager.activeMonsters++;
    }

    /**
     * 记录一次怪物死亡。
     * @param {number} reward
     */
    recordDeath(reward) {
        this.manager.activeMonsters = Math.max(0, this.manager.activeMonsters - 1);
        this.manager.totalKills++;
        this.manager.totalReward += reward;
    }

    /**
     * 是否应该发布“全部怪物已死亡”。
     * 仅自然清场允许触发，强制清理/输局回收必须抑制。
     * @returns {boolean}
     */
    _shouldEmitAllMonstersDead() {
        if (this._allDeadSuppressDepth > 0) return false;
        if (this.manager.activeMonsters > 0) return false;
        return !this.spawnService.hasPendingSpawns();
    }

    /**
     * @param {() => void} action
     */
    _withAllDeadSuppressed(action) {
        this._allDeadSuppressDepth++;
        try {
            action();
        } finally {
            this._allDeadSuppressDepth = Math.max(0, this._allDeadSuppressDepth - 1);
        }
    }
}
