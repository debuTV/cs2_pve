/**
 * @module 怪物系统/怪物技能/护盾
 */
import { BaseModelEntity, Instance } from "cs_script/point_script";
import { SkillTemplate } from "../skill_manager";
import { MonsterBuffEvents } from "../monster_state";

/**
 * 护盾技能。
 *
 * 生成时注册伤害修饰器到 HealthCombat，在 runtime 秒内
 * 吸收最多 value 点伤害。护盾耗尽或超时后自动移除。
 * 支持粒子特效和发光效果。
 * 被动技能，events 必须包含 OnSpawn 以初始化修饰器。
 *
 * @navigationTitle 护盾技能
 */
export class ShieldSkill extends SkillTemplate {
    /**
     * 创建护盾技能实例。
        * @param {import("../monster").Monster} monster 
     * @param {{
     *   cooldown?: number;
     *   runtime: number;
     *   value: number;
     *   events?: string[];
     *   animation?: string;
     * }} params
     */
    constructor(monster,params) {
        super(monster);
        /** @type {string} 技能类型标识，固定为 `"shield"` */
        this.typeId = "shield";
        /** @type {number} 冷却时间（秒），-1 表示无冷却 */
        this.cooldown = params.cooldown ?? -1;
        /** @type {number} 护盾持续时间（秒），-1 表示无限时 */
        this.runtime=params.runtime;
        /** @type {number} 护盾最大吸收量 */
        this.maxshield=params.value;
        /** @type {number} 当前护盾剩余值，活跃时从 maxshield 递减至 0 */
        this.shield=0;
        /** @type {string|null} 技能动画名（被动技能通常为 null） */
        this.animation = params.animation ?? null;
        // 修饰器初始化必须在 Spawn 时完成，无论用户如何配置 events，始终保闭 Spawn
        const userEvents = params.events ?? [MonsterBuffEvents.Spawn, MonsterBuffEvents.Tick];
        /** @type {string[]} 监听的事件类型，强制包含 OnSpawn */
        this.events = userEvents.includes(MonsterBuffEvents.Spawn)
            ? userEvents
            : [MonsterBuffEvents.Spawn, ...userEvents];
        /** @type {boolean} 值守标志，确保伤害修饰器仅注册一次 */
        this._initialized = false;
    }
    /**
     * 判断当前事件是否满足护盾触发条件。
     *
     * - **OnSpawn**：初始化伤害修饰器，将拤截函数注册到 HealthCombat，
     *   使护盾活跃时像“降伤层”一样吸收伤害。只注册一次。
     * - **其它事件**：检查护盾是否可激活（未运行、未占用、冷却就绪）。
     *
     * @param {any} event 技能事件对象
     * @returns {boolean} 是否需要通过动画流程触发
     */
    canTrigger(event) {

        // OnSpawn：初始化伤害修饰器（每个实例只注册一次）
        if (event.type === MonsterBuffEvents.Spawn) {
            if (!this._initialized) {
                this._initialized = true;
                this._modFn = (/** @type {number} */ amount) => {
                    if (!this.running) return amount;
                    const absorbed = Math.min(amount, this.shield);
                    this.shield -= absorbed;
                    if (this.shield <= 0) {
                        this.running = false;
                        if (this.monster.model instanceof BaseModelEntity) {
                            this.monster.model.Unglow();
                        }
                    }
                    return amount - absorbed;
                };
                this.monster.healthCombat.addDamageModifier(this._modFn);
            }
            return false;
        }

        // 其他事件：判断是否可激活护盾
        if (this.running) return false;
        if (this.monster.isOccupied()) return false;
        if (!this._cooldownReady()) return false;
        if (!this.isActive()) {
            this.trigger();
            return false;
        }
        return true;
    }
    /**
     * 护盾逐帧更新。
     *
     * 检查护盾是否超时；若 `runtime` 已达到则关闭护盾
     * 并移除发光效果。
     */
    tick()
    {
        if (this.runtime!=-1&&this.lastTriggerTime+this.runtime<=Instance.GetGameTime())
        {//时间到直接关闭护盾
            this.running=false;
            if(this.monster.model instanceof BaseModelEntity)
            {
                this.monster.model.Unglow();
            }
            return;
        }
    }
    /**
     * 激活护盾。
     *
     * 将 shield 重置为 maxshield，开启蓝色发光特效，
     * 标记 running=true 并记录触发时间。
     */
    trigger() 
    {
        this.shield=this.maxshield;
        if(this.monster.model instanceof BaseModelEntity)
        {
            this.monster.model.Glow({r:0,g:0,b:255});
        }
        this.running=true;
        this._markTriggered();
    }
}