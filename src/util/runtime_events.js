/**
 * @module 运行时事件契约
 */

/**
 * 玩家宿主内统一运行时事件表。
 *
 * 约定：
 * - 玩家宿主上的 buff 与 skill 只能订阅这组事件，不再混用旧的模块级事件名。
 * - 业务代码应通过 `player.emitRuntimeEvent(...)` 分发这些事件，而不是手写字符串。
 * - 这里的字符串值属于稳定运行时契约；新增事件时应同步补充 payload typedef。
 *
 * 字段说明：
 * - `Spawn`：玩家激活、重生或重绑技能后触发，用于初始化一次性效果。
 * - `Input`：玩家输入事件，目前主要用于职业技能主动施放。
 * - `Tick`：玩家存活期间的逐帧心跳。
 * - `StateChange`：玩家状态切换时触发，负载为 `RuntimeStateChangePayload`。
 * - `Recompute`：派生属性重算时触发，供 buff/skill 重新写入修正值。
 * - `BeforeTakeDamage`：玩家受伤前触发，允许同步修改 `damage`。
 * - `TakeDamage`：玩家受伤后触发，只用于读取最终结果，不应再回写结算。
 * - `Attack`：玩家攻击伤害结算时触发，供修正最终输出伤害。
 * - `Die`：玩家进入死亡流程时触发。
 */
export const PlayerRuntimeEvents = {
    Spawn: "OnSpawn",
    Input: "OnInput",
    Tick: "OnTick",
    StateChange: "OnStateChange",
    Recompute: "OnRecompute",
    BeforeTakeDamage: "BeforeTakeDamage",
    TakeDamage: "OnTakeDamage",
    Attack: "OnAttack",
    Die: "OnDie",
};

/**
 * 怪物宿主内统一运行时事件表。
 *
 * 约定：
 * - 怪物宿主上的 buff 与 skill 只能订阅这组事件，不再复用旧的 `MonsterBuffEvents` 或 `SkillEvents`。
 * - 业务代码应通过 `monster.emitRuntimeEvent(...)` 分发这些事件，由宿主同时路由到 buff 与 skill。
 * - 该表覆盖怪物的生命周期、AI、战斗和技能施放通知；不要求与玩家事件集完全同构。
 *
 * 字段说明：
 * - `Spawn`：怪物实例完成初始化后触发。
 * - `Tick`：怪物存活期间的逐帧心跳。
 * - `TargetUpdate`：怪物仇恨目标更新后触发。
 * - `StateChange`：怪物状态切换时触发，负载为 `RuntimeStateChangePayload`。
 * - `Recompute`：怪物派生属性重算时触发。
 * - `BeforeTakeDamage`：怪物受伤前触发，允许同步修改 `damage`。
 * - `TakeDamage`：怪物受伤后触发，提供最终伤害与血量变化结果。
 * - `AttackTrue`：怪物本次普通攻击成功命中目标。
 * - `AttackFalse`：怪物本次普通攻击未命中目标。
 * - `SkillCast`：怪物技能成功施放后的运行时通知。
 * - `Die`：怪物进入死亡流程时触发。
 * - `ModelRemove`：怪物死亡动画结束、模型即将移除时触发。
 */
export const MonsterRuntimeEvents = {
    Spawn: "OnSpawn",
    Tick: "OnTick",
    TargetUpdate: "OnTargetUpdate",
    StateChange: "OnStateChange",
    Recompute: "OnRecompute",
    BeforeTakeDamage: "BeforeTakeDamage",
    TakeDamage: "OnTakeDamage",
    AttackTrue: "OnAttackTrue",
    AttackFalse: "OnAttackFalse",
    SkillCast: "OnSkillCast",
    Die: "OnDie",
    ModelRemove: "OnModelRemove",
};

/**
 * @typedef {Object} RuntimeSpawnPayload
 * @property {number} [state]
 */

/**
 * @typedef {Object} RuntimeStateChangePayload
 * @property {number} oldState
 * @property {number} nextState
 */

/**
 * @typedef {Object} RuntimeTickPayload
 * @property {number} [dt]
 */

/**
 * @typedef {Object} RuntimeRecomputePayload
 * @property {boolean} recompute
 */

/**
 * @typedef {Object} RuntimeInputPayload
 * @property {string} key
 */

/**
 * @typedef {Object} RuntimeDiePayload
 * @property {import("cs_script/point_script").Entity|null} [killer]
 */

/**
 * @typedef {Object} RuntimeAttackPayload
 * @property {number} damage
 * @property {number} [baseDamage]
 * @property {number} [scaledDamage]
 * @property {number} [critChance]
 * @property {number} [critMultiplier]
 * @property {boolean} [isCritical]
 * @property {import("cs_script/point_script").Entity|null} [target]
 * @property {import("cs_script/point_script").Entity|null} [attacker]
 */

/**
 * @typedef {Object} RuntimeTargetUpdatePayload
 * @property {import("cs_script/point_script").Entity|null} [previousTarget]
 * @property {import("cs_script/point_script").Entity|null} [target]
 */

/**
 * @typedef {Object} RuntimeModelRemovePayload
 * @property {number} [state]
 */

/**
 * @typedef {Object} RuntimeSkillCastPayload
 * @property {number} [skillId]
 * @property {string} [skillTypeId]
 * @property {string} [buffTypeId]
 * @property {import("cs_script/point_script").Entity|null} [source]
 * @property {import("cs_script/point_script").Entity|null} [target]
 */

/**
 * @typedef {Object} RuntimeBeforeTakeDamagePayload
 * @property {number} damage
 * @property {import("cs_script/point_script").Entity|null} [attacker]
 * @property {import("cs_script/point_script").Entity|null} [source]
 * @property {string} [reason]
 */

/**
 * @typedef {RuntimeBeforeTakeDamagePayload & {
 *   previousHealth?: number,
 *   currentHealth?: number,
 *   previousArmor?: number,
 *   currentArmor?: number,
 *   value?: number,
 *   health?: number,
 * }} RuntimeTakeDamagePayload
 */

/**
 * 运行时事件 payload 的共享联合类型。
 * 玩家与怪物宿主都会从这组结构中取子集使用。
 * @typedef {RuntimeSpawnPayload|RuntimeStateChangePayload|RuntimeTickPayload|RuntimeRecomputePayload|RuntimeInputPayload|RuntimeDiePayload|RuntimeAttackPayload|RuntimeTargetUpdatePayload|RuntimeModelRemovePayload|RuntimeSkillCastPayload|RuntimeBeforeTakeDamagePayload|RuntimeTakeDamagePayload} RuntimeEventPayload
 */

/**
 * @typedef {RuntimeEventPayload & { type: string }} RuntimeEvent
 */

/**
 * @param {import("../player/player/player.js").Player|null|undefined} player
 * @param {import("../monster/monster/monster.js").Monster|null|undefined} monster
 */
export function getRuntimeEventsForHost(player, monster) {
    return player && !monster ? PlayerRuntimeEvents : MonsterRuntimeEvents;
}