/**
 * @module 技能系统/共享常量
 */

/**
 * 技能统一事件键。
 *
 * 约定：monster、player 与输入系统都向 skill 层发送这些字符串值，
 * 这样 skill 模块不必再直接依赖具体宿主模块的事件常量文件。
 */
export const SkillEvents = {
    Spawn: "OnSpawn",
    Die: "OnDie",
    ModelRemove: "OnModelRemove",
    BeforeTakeDamage: "BeforeTakeDamage",
    TakeDamage: "OnTakeDamage",
    AttackTrue: "OnAttackTrue",
    AttackFalse: "OnAttackFalse",
    Attack: "OnAttack",
    Tick: "OnTick",
    TargetUpdate: "OnupdateTarget",
    SkillCast: "OnSkillCast",
    Input: "OnInput",
};

/** 与技能位移交互兼容的移动请求类型。 */
export const MovementRequestType = {
    Move: "Move",
    Stop: "Stop",
    Remove: "Remove",
};

/** 与技能位移交互兼容的移动请求优先级。 */
export const MovementPriority = {
    Skill: 0,
    StateChange: 1,
    Chase: 2,
};

/** 默认世界重力加速度。 */
export const DEFAULT_WORLD_GRAVITY = 800;

/**
 * 技能 运行时事件负载。
 * 当前仅作为 JSDoc 类型占位，供 skill_manager / skill_template 引用。
 * @typedef {Record<string, any>} EmitEventPayload
 */
