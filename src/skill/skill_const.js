/**
 * @module 技能系统/共享常量
 */

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

/** @typedef {import("../util/runtime_events.js").RuntimeEventPayload} EmitEventPayload */
/** @typedef {import("../util/runtime_events.js").RuntimeEvent} SkillRuntimeEvent */

/**
 * @typedef {Object} SkillAddRequest
 * @property {import("../player/player/player").Player|import("../monster/monster/monster").Monster} target
 * @property {string} typeId
 * @property {Record<string, any>} params
 * @property {number|null} result
 */

/**
 * @typedef {Object} SkillRemoveRequest
 * @property {number} skillId
 * @property {import("../player/player/player").Player|import("../monster/monster/monster").Monster|null} [target]
 * @property {boolean} result
 */

/**
 * @typedef {Object} SkillUseRequest
 * @property {number} skillId
 * @property {import("../player/player/player").Player|import("../monster/monster/monster").Monster} target
 * @property {boolean} result
 */

/**
 * @typedef {Object} SkillEmitRequest
 * @property {number} skillId
 * @property {string} eventName
 * @property {EmitEventPayload} params
 * @property {import("../player/player/player").Player|import("../monster/monster/monster").Monster|null} [target]
 * @property {boolean} result
 */
