/**
 * @module 区域效果/效果配置
 */
/**
 * 区域效果配置
 * @typedef {object} areaEffectStatic
 * @property {string} effectName - 区域预制效果名称
 * @property {string} buffConfigId - 命中后要施加的 Buff 配置 id
 * @property {string} particleName - 需要创建的粒子系统预制名字
 */
/**
 * @typedef {object} AreaEffectCreateRequest
 * @property {string} areaEffectStaticKey - 预制区域效果配置的 key
 * @property {{x:number,y:number,z:number}} position - 区域中心点
 * @property {number} radius - 区域半径
 * @property {number} duration - 总持续时间（秒）
 * @property {string[]} targetTypes - 该区域效果可命中的目标类型
 * @property {import("cs_script/point_script").Entity | null} [parentEntity] - 跟随的父实体；无效时区域自动停止
 * @property {number} result - 结果，成功返回区域效果实例 id，失败返回 -1
 */
/**
 * @typedef {object} AreaEffectStopRequest
 * @property {number} areaEffectId - 区域效果实例 id
 * @property {boolean} result - 结果是否成功
 */

/**
 * 区域效果每帧检测上下文。
 * @typedef {object} areaEffectTickContext
 * @property {import("../player/player/player").Player[]} players - 当帧可被命中的玩家列表
 * @property {import("../monster/monster/monster").Monster[]} monsters - 当帧可被命中的怪物列表
 */
/**
 * @typedef {object} OnAreaEffectCreated
 * @property {number} effectId - 区域效果实例 id
 */
/**
 * @typedef {object} OnAreaEffectStopped
 * @property {number} effectId - 区域效果实例 id
 */
/**
 * @typedef {object} OnAreaEffectHitPlayer
 * @property {import("../player/player/player").Player} player - 命中的玩家实例
 * @property {number} effectId - 区域效果实例 id
 * @property {string} targetType - 命中的目标类型
 * @property {number} hit -  玩家：`slot`  怪物：`monsterId`
 * @property {string} buffConfigId - 命中后要施加的 Buff 配置 id
 */
/**
 * @typedef {object} OnAreaEffectHitMonster
 * @property {import("../monster/monster/monster").Monster} monster - 命中的怪物实例
 * @property {number} effectId - 区域效果实例 id
 * @property {string} targetType - 命中的目标类型
 * @property {number} hit -  玩家：`slot`  怪物：`monsterId`
 * @property {string} buffConfigId - 命中后要施加的 Buff 配置 id
 */
/**
 * 区域效果目标类型常量。
 */
export const Target={
    Player:"player",
    Monster:"monster",
}
//export const AreaEffectTargetType = Object.freeze({
//    Player: "player",
//    Monster: "monster",
//});
//
///**
// * 默认命中的目标类型。当前为了兼容燃烧区域，默认只命中玩家。
// */
//export const DEFAULT_AREA_EFFECT_TARGET_TYPES = Object.freeze([
//    AreaEffectTargetType.Player,
//]);
//===================预制区域效果配置========================
/** @type {Record<string, areaEffectStatic>} */
export const areaEffectStatics = {
    "fire": {
        effectName: "fire_area_effect",
        buffConfigId: "burn",
        particleName: "fire",
    },
    "poison_cloud": {
        effectName: "poison_cloud_area_effect",
        buffConfigId: "poison",
        particleName: "poison_cloud",
    },
    "healing_field": {
        effectName: "healing_field_area_effect",
        buffConfigId: "regeneration",
        particleName: "healing_field",
    },
    // 后续在此添加更多预制区域效果，例如：
    // firezone: { effectName: "firezone_area_effect", position: { x: 0, y: 0, z: 0 }, radius: 100, duration: 3, buffConfigId: "burn", particleName: "firezone", targetTypes: [Target.Player, Target.Monster] },
};