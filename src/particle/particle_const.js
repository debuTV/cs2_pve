/**
 * @module 粒子系统/粒子配置
 */
/**
 * 区域效果请求粒子系统时的负载。
 * @typedef {object} ParticleCreateRequest
 * @property {string} particleName - 需要创建的粒子系统预制名字
 * @property {{x:number,y:number,z:number}} position - 粒子生成位置
 * @property {import("cs_script/point_script").Entity | null} [parentEntity] - 粒子跟随的父实体；null 时原地生成位置播放
 * @property {number} lifetime - 粒子持续时间
 * @property {number} result - 管理器返回的粒子id
 */
/**
 * 区域效果请求粒子系统时的负载。
 * @typedef {object} ParticleStopRequest
 * @property {number} particleId - 需要停止的粒子系统ID
 * @property {boolean} result - 管理器返回的操作结果
 */
//===================预制粒子配置========================

/** @type {Record<string, import("../util/definition").particleConfig>} */
export const particleConfigs = {
    fire: {
        id: "fire",
        // 运行时键已迁到 fire，底层模板资源名继续沿用现有预制体。
        spawnTemplateName: "fire_particle_template",
        middleEntityName: "fire_particle",
    },
    poison_cloud: {
        id: "poison_cloud",
        // 第一版复用现有火焰模板占位，后续可替换成专用毒雾 PointTemplate。
        spawnTemplateName: "fire_particle_template",
        middleEntityName: "fire_particle",
    },
    healing_field: {
        id: "healing_field",
        spawnTemplateName: "healing_field_particle_template",
        middleEntityName: "healing_field_particle",
    },
    // 后续在此添加更多粒子，例如：
    // explosion: { id: "explosion", spawnTemplateName: "explosion_particle_template" },
};