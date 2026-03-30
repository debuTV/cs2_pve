/**
 * @module 粒子系统/粒子配置
 */
//===================粒子配置========================
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