/**
 * @module 工具/激光端点工具
 */
import { Instance, PointTemplate } from "cs_script/point_script";

/** 激光端点 PointTemplate 默认实体名。 */
export const LASER_ENDPOINT_TEMPLATE_NAME = "laser_template";

/**
 * 激光端点创建参数。
 *
 * 说明：
 * - 该工具不管理实体生命周期，只负责创建并返回两个端点实体。
 * - 模板必须且只能生成两个独立实体，通常建议使用两个 info_target。
 * - 两个端点本身是对称锚点，`start` / `end` 只是返回时的可读命名；调用方可以自由交换两者的位置或用途。
 *
 * @typedef {object} LaserEndpointCreateOptions
 * @property {import("cs_script/point_script").Vector} startPosition - 创建后覆盖第一个端点的位置
 * @property {import("cs_script/point_script").Vector} endPosition - 创建后覆盖第二个端点的位置
 */

/**
 * 激光端点创建结果。
 * @typedef {object} LaserEndpointPair
 * @property {import("cs_script/point_script").Entity} start - 第一个端点实体
 * @property {import("cs_script/point_script").Entity} end - 第二个端点实体
 */

/**
 * 创建一对激光端点实体。
 *
 * 该函数只负责：
 * - 查找 PointTemplate
 * - 生成两端点实体
 * - 按需覆盖起点/终点位置与角度
 * - 返回创建结果
 *
 * 它不会：
 * - 持有实体引用
 * - 在后续 tick 中维护实体
 * - 在外部不再需要时自动删除实体
 *
 * @param {LaserEndpointCreateOptions} options
 * @returns {LaserEndpointPair | null}
 */
export function createLaserEndpoints(options) {
    const template = Instance.FindEntityByName(LASER_ENDPOINT_TEMPLATE_NAME);
    if (!template || !(template instanceof PointTemplate)) {
        return null;
    }
    const spawned = template.ForceSpawn(options.startPosition);
    if (!spawned || spawned.length !== 2) {
        cleanupSpawnedEntities(spawned ?? []);
        return null;
    }

    const [start, end] = spawned;
    if (!start?.IsValid?.() || !end?.IsValid?.()) {
        cleanupSpawnedEntities(spawned);
        return null;
    }
    start.Teleport({position: options.startPosition});
    end.Teleport({position: options.endPosition});

    return {
        start,
        end
    };
}

/**
 * 失败时清理由模板生成出的实体，避免遗留无主实体。
 * @param {import("cs_script/point_script").Entity[]} entities
 */
function cleanupSpawnedEntities(entities) {
    for (const entity of entities) {
        if (entity?.IsValid?.()) {
            entity.Remove();
        }
    }
}