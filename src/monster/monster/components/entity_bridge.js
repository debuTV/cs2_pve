/**
 * @module 怪物系统/怪物组件/实体桥接
 */
import { CSPlayerPawn, Instance, PointTemplate } from "cs_script/point_script";

const BREAKABLE_HEALTH_SCALE = 10000;

/**
 * 怪物实体桥接组件。
 *
 * 负责生成 model / breakable，并把 breakable 受到的引擎伤害
 * 单向折算到脚本侧生命，不再把脚本生命反向同步给 breakable。
 * 
 * @navigationTitle 怪物实体桥接
 */
export class MonsterEntityBridge {
    /**
     * 创建怪物实体桥接组件。
     * @param {import("../monster").Monster} monster 所属怪物实例
     */
    constructor(monster) {
        /** 所属怪物实例。 */
        this.monster = monster;
    }
    /**
     * 根据怪物配置生成引擎实体（breakable + model）。
     *
     * 通过 `PointTemplate.ForceSpawn` 在指定位置创建模板实体，
     * 并监听 breakable 的 `OnHealthChanged` 将引擎伤害转发给 `healthCombat`。
     *
     * @param {import("cs_script/point_script").Vector} position 出生世界坐标
     * @param {import("../../../util/definition").monsterTypes} typeConfig 怪物类型配置
     */
    init(position, typeConfig) {
        const template = Instance.FindEntityByName(typeConfig.template_name);
        if (template && template instanceof PointTemplate) {
            const spawned = template.ForceSpawn(position);
            if (spawned && spawned.length > 0) {
                spawned.forEach((element) => {
                    if (element.GetClassName() == "func_breakable") {
                        this.monster.breakable = element;
                    }
                    if (element.GetClassName() == "prop_dynamic" && element.GetEntityName() == typeConfig.model_name) {
                        this.monster.model = element;
                    }
                });
            }
        }

        if (this.monster.breakable) {
            this.monster.preBreakableHealth = BREAKABLE_HEALTH_SCALE;
            Instance.ConnectOutput(this.monster.breakable, "OnHealthChanged", (e) => {
                if (typeof e.value !== "number") return;

                const currentBreakableHealth = Math.max(
                    0,
                    Math.min(BREAKABLE_HEALTH_SCALE, BREAKABLE_HEALTH_SCALE * e.value)
                );
                const damage = this.monster.preBreakableHealth - currentBreakableHealth;
                this.monster.preBreakableHealth = currentBreakableHealth;

                if (damage <= 1) return;

                const attacker = e.activator instanceof CSPlayerPawn ? e.activator : null;
                this.monster.takeDamage(damage, attacker);
            });
        }

        if (this.monster.model) {
            this.monster.model.Teleport({ position: { x: position.x, y: position.y, z: position.z + 50 } });
        }
    }

    /**
     * 死亡后移除引擎实体。breakable 始终移除，model 是否删除由参数控制。
     * @param {boolean} [removeModelAfterDeathAnimation=true] 是否删除怪物模型
     */
    removeAfterDeath(removeModelAfterDeathAnimation = true) {
        if (this.monster.breakable?.IsValid()) {
            this.monster.breakable.Remove();
        }
        if (removeModelAfterDeathAnimation && this.monster.model?.IsValid()) {
            this.monster.model.Remove();
        }
    }
}
