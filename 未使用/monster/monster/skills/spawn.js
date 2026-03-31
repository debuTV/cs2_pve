/**
 * @module 怪物系统/怪物技能/产卵
 */
import { SkillTemplate } from "../skill_manager";
import { MonsterBuffEvents } from "../monster_state";

/**
 * 产卵技能。
 *
 * 在指定事件（默认 OnDie）触发时，在怪物周围生成
 * count 个指定类型的小怪，受 maxSummons 整体上限约束。
 * 生成位置在 `radiusMin` – `radiusMax` 的随机圆环内，
 * 最多尝试 `tries` 次寻找有效位置。
 * 被动技能。
 *
 * @navigationTitle 产卵技能
 */
export class SpawnSkill extends SkillTemplate {
    /**
     * 创建召唤技能实例。
        * @param {import("../monster").Monster} monster
     * @param {{
     *   events?: string[];
     *   count?: number;
     *   typeName?: string;
     *   cooldown?: number;
     *   maxSummons?: number;
     *   radiusMin?: number;
     *   radiusMax?: number;
     *   tries?: number;
     *   animation?: string;
     * }} params
     */
    constructor(monster, params) {
        super(monster);
        /** @type {string} 技能类型标识，固定为 `"spawn"` */
        this.typeId = "spawn";
        /** @type {string|null} 技能动画名（被动技能通常为 null） */
        this.animation = params.animation ?? null;
        /** @type {string[]} 监听的事件类型列表 */
        this.events = params.events??[MonsterBuffEvents.Die];
        /** @type {number} 每次触发生成的小怪数量 */
        this.count = Math.max(1, params.count ?? 1);
        /** @type {string} 生成的怪物类型名，默认继承父怪类型 */
        this.typeName = params.typeName ?? monster.type;
        /** @type {number} 冷却时间（秒），-1 表示无冷却 */
        this.cooldown = params.cooldown ?? -1;
        /** @type {number} 总生成上限，-1 表示无限 */
        this.maxSummons = params.maxSummons ?? 1;
        /** @type {number} 生成位置最小半径 */
        this.radiusMin = Math.max(0, params.radiusMin ?? 24);
        /** @type {number} 生成位置最大半径 */
        this.radiusMax = Math.max(this.radiusMin, params.radiusMax ?? 96);
        /** @type {number} 寻找有效生成位置的最大尝试次数 */
        this.tries = Math.max(1, params.tries ?? 6);

        /** @type {number} 已累计生成数，受 maxSummons 约束 */
        this.spawnedTotal = 0;
        /** @type {number} 本次触发待生成的小怪数量 */
        this._pendingCount=0;
    }

    /**
     * 判断当前事件是否满足产卵触发条件。
     *
     * 检查事件类型、总生成上限、冷却状态和本次可生成数。
     * 将本次可生成数缓存至 `_pendingCount` 供 trigger 使用。
     *
     * @param {any} event 技能事件对象
     * @returns {boolean} 是否需要通过动画流程触发
     */
    canTrigger(event) {
        if (!this.events.includes(event.type)) return false;
        if (this.maxSummons >= 0 && this.spawnedTotal >= this.maxSummons) return false;
        if (!this._cooldownReady()) return false;

        const remaining = this.maxSummons < 0
            ? this.count
            : Math.min(this.count, this.maxSummons - this.spawnedTotal);
        if (remaining <= 0) return false;

        this._pendingCount = remaining;
        if (!this.isActive()) {
            this.trigger();
            return false;
        }
        return true;
    }

    /**
     * 执行产卵。
     *
     * 循环调用 `monster.requestSpawn` 在怪物周围随机圆环内
     * 生成小怪，累计成功数并更新 `spawnedTotal`。
     */
    trigger() {
        let spawnedNow = 0;
        for (let i = 0; i < this._pendingCount; i++) {
            const ok = this.monster.requestSpawn({
                typeName: this.typeName,
                radiusMin: this.radiusMin,
                radiusMax: this.radiusMax,
                tries: this.tries,
            });
            if (ok) spawnedNow++;
        }
        this._pendingCount = 0;
        if (spawnedNow > 0) {
            this.spawnedTotal += spawnedNow;
            this._markTriggered();
        }
    }
}
