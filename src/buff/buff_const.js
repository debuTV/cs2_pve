/**
 * @module Buff 系统/配置
 */

import { Monster } from "../monster/monster/monster";
import { Player } from "../player/player/player";

/**
 * Buff 极性。
 * 兼容旧调用方对基础枚举的导入。
 */
export const BuffPolarity = {
	BUFF: "buff",
	DEBUFF: "debuff",
};

/**
 * @typedef {Object} BuffConfig
 * @property {string} configid Buff 配置 id
 * @property {string} typeid Buff 种类
 * @property {Object} params Buff 参数
 */
/**
 * @typedef {Object} BuffAddRequest
 * @property {string} configid Buff 配置 id
 * @property {Monster|Player} target Buff 作用的目标
 * @property {string} targetType Buff 作用的目标类型
 * @property {number} result - 结果，返回buffid，失败返回-1
 */
/**
 * @typedef {Object} BuffRemoveRequest
 * @property {number} buffId Buff id
 * @property {boolean} result - 结果，成功返回true，失败返回false
 */
/**
 * @typedef {Object} BuffRefreshRequest
 * @property {number} buffId Buff id
 * @property {boolean} result - 结果，成功返回true，失败返回false
 */
/**
 * @typedef {Object} BuffEmitRequest
 * @property {number} buffId Buff id
 * @property {string} eventName 事件名称
 * @property {object} params - 事件参数
 * @property {object} result - 结果
 */
/**
 * @typedef {Object} OnBuffAdded
 * @property {number} buffId Buff id
 */
/**
 * @typedef {Object} OnBuffRefreshed
 * @property {number} buffId Buff id
 */
/**
 * @typedef {Object} OnBuffRemoved
 * @property {number} buffId Buff id
 */
//=====================预制buff配置====================
// Buff 构建参数的唯一来源。运行时只按 configid 查这里的预设，不接受外部附加参数。
/**@type {Record<string, BuffConfig>} */
export const buffconfig={
	burn:{
		configid:"burn",
		typeid:"burn",
		params:{
			duration:5,
			tickInterval:0.5,
			dps:25,
		}
	},
	poison:{
		configid:"poison",
		typeid:"poison",
		params:{
			duration:5,
			tickInterval:1,
			dps:10,
		}
	},
	regeneration:{
		configid:"regeneration",
		typeid:"regeneration",
		params:{
			duration:3,
			tickInterval:0.5,
			healPerTick:15,
		}
	},
	attack_up:{
		configid:"attack_up",
		typeid:"attack_up",
		params:{
			duration:30,
			multiplier:1.35,
		}
	},
	speed_up:{
		configid:"speed_up",
		typeid:"speed_up",
		params:{
			duration:5,
			multiplier:1.8,
			flatBonus:0,
		}
	}
}