/**
 * @module Buff 系统/配置
 */

/**
 * Buff 极性。
 * 兼容旧调用方对基础枚举的导入。
 */
export const BuffPolarity = {
	BUFF: "buff",
	DEBUFF: "debuff",
};

/**
 * Buff 运行时事件负载。
 * 当前仅作为 JSDoc 类型占位，供 buff_manager / buff_template 引用。
 * @typedef {Record<string, any>} EmitEventPayload
 */
