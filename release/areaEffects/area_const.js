/**
 * @module 区域效果/效果配置
 */

/**
 * 区域效果命中目标类型。
 * @typedef {"player"|"monster"} areaEffectTargetType
 */

/**
 * 区域效果创建描述。
 * @typedef {object} areaEffectDesc
 * @property {string} effectType - 区域效果类型标识
 * @property {{x:number,y:number,z:number}} position - 区域中心点
 * @property {number} radius - 区域半径
 * @property {number} duration - 总持续时间（秒）
 * @property {number} applyInterval - 对同一目标重复命中的最小间隔（秒）
 * @property {string} buffTypeId - 命中后要施加的 Buff 类型
 * @property {Record<string,any>} buffParams - Buff 参数对象
 * @property {{monsterId:number, monsterType:string, skillTypeId:string}|Record<string,any>} source - 来源信息
 * @property {string} [particleId] - 需要创建的粒子系统 id
 * @property {number} [particleLifetime] - 粒子持续时间；缺省时沿用区域持续时间
 * @property {areaEffectTargetType[]} targetTypes - 该区域效果可命中的目标类型
 */

/**
 * 区域效果每帧检测上下文。
 * @typedef {object} areaEffectTickContext
 * @property {import("cs_script/point_script").CSPlayerPawn[]} players - 当帧可被命中的玩家列表
 * @property {import("../monster/monster/monster").Monster[]} monsters - 当帧可被命中的怪物列表
 */

/**
 * 区域效果命中事件负载。
 * @typedef {object} areaEffectHitPayload
 * @property {number} effectId - 区域效果实例 id
 * @property {string} effectType - 区域效果类型标识
 * @property {string} buffTypeId - 命中后施加的 Buff 类型
 * @property {Record<string,any>} buffParams - Buff 参数对象副本
 * @property {{monsterId:number, monsterType:string, skillTypeId:string}|Record<string,any>} source - 来源信息副本
 */

/**
 * 区域效果请求粒子系统时的负载。
 * @typedef {object} areaEffectParticleRequest
 * @property {string} particleId - 粒子配置 id
 * @property {{x:number,y:number,z:number}} position - 粒子生成位置
 * @property {number} lifetime - 粒子持续时间
 * @property {number} effectId - 区域效果实例 id
 * @property {string} effectType - 区域效果类型标识
 * @property {{monsterId:number, monsterType:string, skillTypeId:string}|Record<string,any>} source - 来源信息副本
 */

/**
 * 区域效果持有的粒子句柄。只要求提供 stop 接口即可。
 * @typedef {object} areaEffectParticleHandle
 * @property {(() => void)} [stop] - 停止并清理粒子
 */

/**
 * @callback areaEffectHitPlayerCallback
 * @param {import("cs_script/point_script").CSPlayerPawn} targetPawn
 * @param {areaEffectHitPayload} payload
 * @returns {void}
 */

/**
 * @callback areaEffectHitMonsterCallback
 * @param {import("../monster/monster/monster").Monster} targetMonster
 * @param {areaEffectHitPayload} payload
 * @returns {void}
 */

/**
 * @callback areaEffectParticleRequestCallback
 * @param {areaEffectParticleRequest} request
 * @returns {areaEffectParticleHandle|null|undefined}
 */

/**
 * 区域效果目标类型常量。
 */
export const AreaEffectTargetType = Object.freeze({
    Player: "player",
    Monster: "monster",
});

/**
 * 默认命中的目标类型。当前为了兼容 poisongas，默认只命中玩家。
 */
export const DEFAULT_AREA_EFFECT_TARGET_TYPES = Object.freeze([
    AreaEffectTargetType.Player,
]);
