/**
 * @module 怪物系统/怪物状态
 */

/**
 * 怪物状态枚举。
 *
 * 定义了怪物在战斗循环中可能处于的所有状态。
 * Monster 的 `brainState` 组件和 `tickDispatcher` 会根据这些值
 * 决定每帧应该执行的行为（移动、攻击、施法或待机）。
 *
 * 状态流转典型路径：
 * `IDLE → CHASE → ATTACK → CHASE` 或 `IDLE → CHASE → SKILL → CHASE`，
 * 死亡后进入 `DEAD` 终态。
 *
 * - `IDLE` (0)：空闲状态，刚生成或无目标时的默认状态。
 * - `CHASE` (1)：追击状态，正在寻路并移动向目标玩家。
 * - `ATTACK` (2)：攻击状态，到达攻击距离后执行普通攻击动作。
 * - `SKILL` (3)：技能状态，正在施放主动技能，此时移动和普攻被暂停。
 * - `DEAD` (4)：死亡终态，怪物已被击杀，等待清理。
 */
export const MonsterState = {
    IDLE: 0,//空闲
    CHASE: 1,//追人
    ATTACK: 2,//攻击
    SKILL:  3,//技能
    DEAD: 4//死亡
};

/**
 * 怪物事件类型常量。
 *
 * 收录怪物技能内部事件名称字符串。
 * 使用统一常量替代散落的字符串，防止拼写错误导致事件丢失。
 *
 * 事件按职责分为四组：
 * - **生命周期**：生成（Spawn）、死亡（Die）、模型移除（ModelRemove）。
 * - **战斗**：受伤（TakeDamage）、攻击命中（AttackTrue）、攻击未命中（AttackFalse）。
 * - **AI**：每帧心跳（Tick）、目标更新（TargetUpdate）。
 * - **技能**：技能施放（SkillCast）。
 *
 */
export const MonsterBuffEvents = {
    // 生命周期
    Spawn:        "OnSpawn",
    Die:          "OnDie",
    ModelRemove:  "OnModelRemove",
    // 战斗
    BeforeTakeDamage: "BeforeTakeDamage", // 受伤前事件，允许修改伤害
    TakeDamage:   "OnTakeDamage",        // 受伤后事件，提供最终伤害值
    AttackTrue:   "OnAttackTrue",
    AttackFalse:  "OnAttackFalse",
    // AI
    Tick:         "OnTick",
    TargetUpdate: "OnupdateTarget",
    // 技能施放（领域总线键）
    SkillCast:    "OnSkillCast",
};