/**
 * @module 工具/声音实体工具
 */
import { Instance, PointTemplate } from "cs_script/point_script";

/** 声音实体 PointTemplate 默认实体名。 */
export const SOUND_TEMPLATE_NAME = "sound_template";

/**
 * 声音实体创建参数。
 *
 * 说明：
 * - 该工具不管理实体生命周期，只负责创建并返回一个声音实体。
 * - 模板必须且只能生成一个独立实体。
 *
 * @typedef {object} SoundEntityCreateOptions
 * @property {import("cs_script/point_script").Vector} position - 创建后覆盖声音实体的位置
 */

/**
 * 创建一个声音实体。
 *
 * 该函数只负责：
 * - 查找 PointTemplate
 * - 生成声音实体
 * - 按需覆盖位置与角度
 * - 返回创建结果
 *
 * 它不会：
 * - 持有实体引用
 * - 在后续 tick 中维护实体
 * - 在外部不再需要时自动删除实体
 *
 * @param {SoundEntityCreateOptions} options
 * @returns {import("cs_script/point_script").Entity | null}
 */
export function createSoundEntity(options) {
	const template = Instance.FindEntityByName(SOUND_TEMPLATE_NAME);
	if (!template || !(template instanceof PointTemplate)) {
		return null;
	}

	const spawned = template.ForceSpawn(options.position);
	if (!spawned || spawned.length !== 1) {
		cleanupSpawnedEntities(spawned ?? []);
		return null;
	}

	const [soundEntity] = spawned;
	if (!soundEntity?.IsValid?.()) {
		cleanupSpawnedEntities(spawned);
		return null;
	}

	soundEntity.Teleport({
		position: options.position,
	});

	return soundEntity;
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
