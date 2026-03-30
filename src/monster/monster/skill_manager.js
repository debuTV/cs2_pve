/**
 * @module 怪物系统/技能基类
 */
import { Instance } from "cs_script/point_script";

/*
技能分类规则（唯一权威）：
  有 animation 字段（非 null/undefined）= 主动技能：canTrigger 通过后进入请求队列，
    Monster 进入 SKILL 状态，skills_manager 先播放 animation 动作，再调用 trigger()。
  无 animation 字段（null）           = 被动技能：在 canTrigger 内直接执行业务并返回 false，
    不进入请求队列，不触发状态切换。

冷却语义：
  cooldown > 0  → 间隔触发（秒）
  cooldown = 0  → 无限制
  cooldown = -1 → 一次性：仅首次触发一次，之后永久失效
  默认值为 -1（一次性），可在子类构造函数或 params.cooldown 中覆盖。

实例 id 语义：
  skill.id  = 运行时实例 id，由 MonsterSkillsManager.addSkill 按添加顺序分配（0,1,2,...）。
             同一怪物上 id 越小，优先级越高（主动技能请求队列的排序依据）。
  skill.typeId = 技能类型标识，对应 SkillFactory 注册键（如 "corestats"），子类在构造函数里设置。
             同一怪物可同时拥有多个相同 typeId 的技能实例，各实例独立运行互不干扰。

多事件触发：
  子类构造函数中设置 this.events 数组，列出该技能响应的事件类型。
  可在配置 params.events 中直接指定（如 ["OnSpawn","OnDie"]），未提供则使用技能类的默认值。
  对 spawn 等技能：旧的单值 params.event 仍向后兼容（会被包装为单元素数组）。

原 onAdd() 生命周期已移除；需要在生成时执行的初始化逻辑，
请在 canTrigger 中响应 MonsterEvents.Spawn 并 return false。

新增技能时不要手写 this.id（实例 id 由 addSkill 自动分配）；
在子类构造函数里设置 this.typeId（技能类型标识）；
isActive() 由基类根据 this.animation 自动判断。

事件大全（统一使用 MonsterEvents 常量，见 monster_events.js）
//怪物生成完后
MonsterEvents.Spawn        → "OnSpawn"

//当受到伤害后(伤害值，最后血量)
MonsterEvents.TakeDamage   → "OnTakeDamage"   { value, health }

//怪物死亡前，这时候实体还未销毁
MonsterEvents.Die          → "OnDie"

//当前TICK(tick间隔，所有怪物breakable实体)
MonsterEvents.Tick         → "OnTick"          { dt, allmpos }

//目标更新后
MonsterEvents.TargetUpdate → "OnupdateTarget"

//没有攻击到目标
MonsterEvents.AttackFalse  → "OnAttackFalse"

//对目标造成伤害后
MonsterEvents.AttackTrue   → "OnAttackTrue"

//模型移除后（动画结束）
MonsterEvents.ModelRemove  → "OnModelRemove"
 */
/**
 * 怪物技能基类。所有具体技能继承此类并重写 `canTrigger` 和 `trigger`。
 *
 * 技能分为两大类：
 * - **主动技能**（`animation` 非 null）— `canTrigger` 返回 true 后入队，
 *   Monster 进入 SKILL 状态，播放动作后调用 `trigger()`。
 * - **被动技能**（`animation` 为 null）— 在 `canTrigger` 内直接执行并返回 false。
 *
 * 冷却语义：
 * - `-1` = 一次性（默认），触发过一次后永久失效。
 * - `0` = 无限制。
 * - `> 0` = 按秒间隔触发。
 *
 * 子类在构造函数中设置 `this.typeId`，运行时实例 id `this.id` 由
 * MonsterSkillsManager.addSkill 自动分配，id 越小优先级越高。
 *
 * @navigationTitle 技能基类
 */
export class SkillTemplate
{
    /**
     * 创建技能基类实例，绑定所属怪物。
    * @param {import("./monster").Monster} monster
     */
    constructor(monster) {
        /** 所属怪物实例的引用，用于访问怪物属性、目标、事件系统等。 */
        this.monster=monster;
        /** 技能类型标识，对应 SkillFactory 注册键（如 "corestats"）。子类在构造函数里设置。 */
        this.typeId = "unknown";
        /** 运行时实例 id，由 MonsterSkillsManager.addSkill 按添加顺序分配（0,1,2,...）。id 越小优先级越高。 */
        this.id = -1;
        /** @type {string|null} 动作名称：非 null = 有动作；null = 无动作 */
        this.animation = null;
        /** 冷却（秒）。-1=一次性，0=无限制，>0=按秒冷却。默认 -1。 */
        this.cooldown = -1;
        /** 上次触发的游戏时间。初始值 -999。由 `_markTriggered` 更新，供 `_cooldownReady` 判断冷却。 */
        this.lastTriggerTime = -999;
        /** 技能是否正在后台运行中（限时技能的执行期间为 true）。由子类 `tick` 逻辑控制。 */
        this.running=false;
        /**
         * 异步技能占用标记。非 null 时表示技能自行管理占用生命周期：
         * - trigger() 中调用 `monster.animationOccupation.setOccupation(asyncOccupation)` 接管占用。
         * - 技能结束时调用 `monster.onOccupationEnd(asyncOccupation)` 释放。
         * - 动画完成时的 onOccupationEnd("skill") 因类型不匹配而跳过，不会提前释放。
         * @type {string|null}
         */
        this.asyncOccupation = null;
        /** 请求优先级次级排序（主排序为实例 id 升序；越大越优先，默认 0）*/
        this.priority = 0;

        /**
         * 技能对应的 buff 类型标识，null 表示不施加 buff。
         * @type {string|null}
         */
        this.buffTypeId = null;
        /** 技能施加 buff 时的默认参数 */
        this.buffParams = {};
    }

    /**
     * 构建发送给玩家 buff 系统的标准 payload。
     * 子类可重写以提供动态参数（如基于怪物属性计算伤害）。
     * @returns {{skillTypeId: string, buffTypeId: string|null, params: Record<string,any>, source: {monsterId: number, monsterType: string, skillTypeId: string}}}
     */
    buildBuffPayload() {
        return {
            skillTypeId: this.typeId,
            buffTypeId: this.buffTypeId,
            params: { ...this.buffParams },
            source: {
                sourceType: "monster-skill",
                sourceId: this.monster.id,
                monsterId: this.monster.id,
                monsterType: this.monster.type ?? "unknown",
                skillTypeId: this.typeId,
            },
        };
    }
    /**
     * 是否为有动作技能（配置了 animation）。
     * 有动作时由管理器进入 SKILL 状态并播放动作；无动作时在 canTrigger 内直接执行。
     * @returns {boolean}
     */
    isActive() {
        return this.animation !== null && this.animation !== undefined;
    }
    /**
     * 这个事件能否执行。
     * - 有 animation（isActive=true）：做条件判断通过后返回 true，由 emitEvent 调用 request 入队。
     * - 无 animation（isActive=false）：在此处直接执行业务逻辑并返回 false，不入队不切换状态。
     * @param {any} event
     */
    canTrigger(event) {
        return false;
    }
    /**
     * 请求执行（基类默认实现，子类无需重写）。
     * 仅由 isActive()=true 的技能在 canTrigger 返回 true 后被 emitEvent 调用。
     */
    request(){
        this.monster.requestSkill(this);
    }
    /**
     * 执行技能主体逻辑。仅对主动技能有效——动画播放完毕后由 MonsterSkillsManager 调用。
     * 子类必须重写此方法以实现具体技能效果。
     */
    trigger() {}
    /**
     * 后台限时技能的每帧执行入口。
     * 对于有持续时间的技能（如护盾、急速），在 `running` 为 true 期间每帧调用。
     * 子类按需重写以实现持续效果或到期清理。
     */
    tick(){}
    /**
     * 检查冷却是否就绪。
     * - `cooldown = -1`（一次性）：仅当从未触发过时返回 true。
     * - `cooldown <= 0`（无限制）：始终返回 true。
     * - `cooldown > 0`：当前时间距上次触发超过冷却秒数时返回 true。
     * @returns {boolean}
     */
    _cooldownReady() {
        // -1 = 一次性：只要触发过一次（lastTriggerTime 不再是初始值 -999）就永久失效
        if (this.cooldown === -1) return this.lastTriggerTime === -999;
        if (this.cooldown <= 0) return true;
        const now = Instance.GetGameTime();
        return now - this.lastTriggerTime >= this.cooldown;
    }

    /**
     * 标记技能已触发——更新 `lastTriggerTime` 为当前游戏时间。
     * 若技能配置了 `buffTypeId` 且怪物当前有目标，还会通过事件系统发布 `SkillCast` 事件，
     * 携带构建好的 buff 负载供玩家 buff 系统接收。
     */
    _markTriggered() {
        this.lastTriggerTime = Instance.GetGameTime();
        // 如果技能配置了 buffTypeId 且怪物有目标，发布 SkillCast 事件
        if (this.buffTypeId && this.monster.target) {
            const payload = this.buildBuffPayload();
            this.monster.events.OnSkillCast?.(this.typeId, this.monster.target, payload);
        }
    }
}
