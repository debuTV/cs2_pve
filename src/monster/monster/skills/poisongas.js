/**
 * @module 怪物系统/怪物技能/毒气
 */
import { SkillTemplate } from "../skill_manager";
import { MonsterBuffEvents } from "../monster_state";

/**
 * 毒气技能。
 *
 * 怪物死亡时（默认 OnDie）在脚下创建毒气区域，
 * 通过 AreaEffectService 持续对范围内玩家施加 PoisonBuff。
 * 可配置毒区半径、持续时间、施加间隔和粒子效果。
 * 被动一次性技能。
 *
 * @navigationTitle 毒气技能
 */
export class PoisonGasSkill extends SkillTemplate {
    /**
     * 创建毒气技能实例。
     * @param {import("../monster").Monster} monster 
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string;
     *   particleId?: string;
     *   dps?: number;
     *   buffDuration?: number;
     *   tickInterval?: number;
     *   zoneDuration?: number;
     *   zoneRadius?: number;
     *   applyInterval?: number;
     * }} [params]
     */
    constructor(monster, params = {}) {
        super(monster);
        /** @type {string} 技能类型标识，固定为 `"poisongas"` */
        this.typeId = "poisongas";
        /** @type {number} 冷却时间（秒），-1 表示一次性 */
        this.cooldown = params.cooldown ?? -1;
        /** @type {string|null} 技能动画名（被动技能通常为 null） */
        this.animation = params.animation ?? null;
        /** @type {string[]} 监听的事件类型，默认 [OnDie] */
        this.events = params.events ?? [MonsterBuffEvents.Die];

        /** @type {string} 毒气粒子效果标识 */
        this.particleId = params.particleId ?? "poisongas";

        /** @type {string} 施加的 Buff 类型标识 */
        this.buffTypeId = "poison";
        /** @type {{dps: number, duration: number, tickInterval: number}} Buff 参数（每秒伤害、持续时间、判定间隔） */
        this.buffParams = {
            dps:          params.dps          ?? 5,
            duration:     params.buffDuration ?? 4,
            tickInterval: params.tickInterval ?? 1,
        };

        /** @type {number} 毒区持续时间（秒） */
        this.zoneDuration = params.zoneDuration ?? 5;
        /** @type {number} 毒区半径 */
        this.zoneRadius = params.zoneRadius ?? 150;
        /** @type {number} 对同一玩家重新施加 buff 的最小间隔（秒） */
        this.applyInterval = params.applyInterval ?? 1;
    }

    /**
     * 判断当前事件是否满足毒气释放条件。
     *
     * 仅检查事件类型与冷却状态。被动触发——条件满足但未激活时
     * 立即调用 {@link trigger}。
     *
     * @param {any} event 技能事件对象
     * @returns {boolean} 是否需要通过动画流程触发（被动技能始终返回 false）
     */
    canTrigger(event) {
        if(!this.events.includes(event.type))return false;
        if (!this._cooldownReady()) return false;
        if (!this.isActive()) {
            this.trigger();
            return false;
        }
        return true;
    }

    /**
     * 创建毒气区域效果。
     *
     * 捕获怪物死亡位置，通过 `events.onAreaEffectRequest` 回调
     * 向 MonsterManager 的 AreaEffectService 提交区域效果请求。
     * 请求包含毒区半径、持续时间、Buff 参数及粒子特效等信息。
     */
    trigger() {
        const pos = this.monster.model?.GetAbsOrigin?.();
        if (!pos) return;

        // 向 MonsterManager 的 AreaEffectService 提交区域效果请求
        if (this.monster.events.onAreaEffectRequest) {
            this.monster.events.onAreaEffectRequest({
                effectType: "poisongas",
                position: { x: pos.x, y: pos.y, z: pos.z },
                radius: this.zoneRadius,
                duration: this.zoneDuration,
                applyInterval: this.applyInterval,
                buffTypeId: this.buffTypeId,
                buffParams: { ...this.buffParams },
                source: {
                    sourceType: "monster-skill",
                    sourceId: this.monster.id,
                    monsterId: this.monster.id,
                    monsterType: this.monster.type ?? "unknown",
                    skillTypeId: this.typeId,
                },
                particleId: this.particleId,
                particleLifetime: this.zoneDuration,
            });
        }

        this._markTriggered();
    }
}
