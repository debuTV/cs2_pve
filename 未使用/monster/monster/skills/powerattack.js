/**
 * @module 怪物系统/怪物技能/重击
 */
import { SkillTemplate } from "../skill_manager";
import { vec } from "../../../util/vector";
import { MonsterBuffEvents } from "../monster_state";

/**
 * 重击技能。
 *
 * 攻击命中时（默认 AttackTrue）对目标玩家施加 KnockUpBuff，
 * 产生击飞效果。可配置冲量、垂直加速和 Buff 持续时间。
 * 被动技能，无动作。
 *
 * @navigationTitle 重击技能
 */
export class PowerAttackSkill extends SkillTemplate {
    /**
     * 创建重击技能实例。
     * @param {import("../monster").Monster} monster 
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string;
     *   impulse?: number;
     *   verticalBoost?: number;
     *   buffDuration?: number;
     * }} [params]
     */
    constructor(monster, params = {}) {
        super(monster);
        /** @type {string} 技能类型标识，固定为 `"powerattack"` */
        this.typeId = "powerattack";
        /** @type {number} 冷却时间（秒），-1 表示无冷却 */
        this.cooldown = params.cooldown ?? -1;
        /** @type {string|null} 技能动画名（被动技能通常为 null） */
        this.animation = params.animation ?? null;
        /** @type {string[]} 监听的事件类型，默认 [AttackTrue] */
        this.events = params.events ?? [MonsterBuffEvents.AttackTrue];

        /** @type {string} 施加的 Buff 类型标识（击飞） */
        this.buffTypeId = "knockup";
        /** @type {{impulse: number, verticalBoost: number, duration: number}} 击飞 Buff 参数（水平冲量、垂直加速、持续时间） */
        this.buffParams = {
            impulse:       params.impulse       ?? 300,
            verticalBoost: params.verticalBoost  ?? 400,
            duration:      params.buffDuration   ?? 0.6,
        };
    }
    /**
     * 判断当前事件是否满足重击触发条件。
     *
     * 检查事件类型、目标存在、占用状态和冷却。
     * 被动触发——条件满足但未激活时静默触发。
     *
     * @param {any} event 技能事件对象
     * @returns {boolean} 是否需要通过动画流程触发
     */
    canTrigger(event) {
        if(!this.events.includes(event.type))return false;
        if (!this.monster.target) return false;
        if (this.monster.isOccupied()) return false;
        if (!this._cooldownReady()) return false;
        if (!this.isActive()) {
            this.trigger();
            return false;
        }
        return true;
    }

    /**
     * 执行重击。
     *
     * 当前为预留逻辑桩——后续将对目标玩家施加击飞 Buff。
     */
    trigger() {
        //这里给与玩家速度
        this._markTriggered();
    }

    /**
     * 构建 Buff 载荷——计算怪物→目标方向并注入 direction。
     *
     * 重写基类方法，在标准 payload 上追加归一化的
     * 水平方向向量，用于击飞 Buff 的冲量方向计算。
     *
     * @returns {any} 包含 direction 的 Buff 载荷对象
     */
    buildBuffPayload() {
        const payload = super.buildBuffPayload();
        const target = this.monster.target;
        if (target) {
            const monsterPos = this.monster.model.GetAbsOrigin();
            const targetPos  = target.GetAbsOrigin?.();
            if (monsterPos && targetPos) {
                const delta = vec.sub(targetPos, monsterPos);
                const dir = vec.normalize2D(delta);
                // normalize2D 在零长度时返回 {0,0,0}；此场景目标与怪物不会重合
                payload.params.direction = dir;
            }
        }
        return payload;
    }
}