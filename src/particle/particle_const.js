/**
 * @module 粒子系统/粒子配置
 */
/**
 * 区域效果请求粒子系统时的负载。
 * @typedef {object} ParticleCreateRequest
 * @property {string} particleName - 需要创建的粒子系统预制名字
 * @property {{x:number,y:number,z:number}} position - 粒子生成位置
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
    poisongas: {
        id: "poisongas",
        spawnTemplateName: "poisongas_particle_template",
        middleEntityName: "poisongas_particle",
    },
    // 后续在此添加更多粒子，例如：
    // explosion: { id: "explosion", spawnTemplateName: "explosion_particle_template" },
};