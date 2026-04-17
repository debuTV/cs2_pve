/**
 * @module 怪物系统/怪物技能/投掷石头
 */
import { Instance, PointTemplate } from "cs_script/point_script";
import { eventBus } from "../../util/event_bus";
import { event } from "../../util/definition";
import { MonsterRuntimeEvents } from "../../util/runtime_events.js";
import { ThrowTarget } from "../../throw/throw_const";
import { SkillTemplate } from "../skill_template";

export class ThrowStoneSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string | null;
     *   distanceMin?: number;
     *   distanceMax?: number;
     *   damage?: number;
     *   projectileSpeed?: number;
     *   gravityScale?: number;
     *   radius?: number;
     *   maxTargets?: number;
    *   templateName?: string;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "throwstone", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [MonsterRuntimeEvents.Tick];
        this.distanceMin = params.distanceMin ?? 0;
        this.distanceMax = params.distanceMax ?? 600;
        this.damage = params.damage ?? 10;
        this.projectileSpeed = params.projectileSpeed ?? 500;
        this.gravityScale = params.gravityScale ?? 1;
        this.radius = params.radius ?? 32;
        this.maxTargets = params.maxTargets ?? 1;
        this.templateName = typeof params.templateName === "string"
            ? params.templateName.trim()
            : "throwstone_projectile_template";
    }

    canTrigger(/** @type {any} */ event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;

        const monster = this.monster;
        if (monster) {
            if (!monster.target) return false;
            if (this.running) return false;
            if (monster.isOccupied()) return false;

            const distsq = monster.distanceTosq(monster.target.pos);
            const minDistSq = this.distanceMin * this.distanceMin;
            const maxDistSq = this.distanceMax * this.distanceMax;
            if (distsq < minDistSq || distsq > maxDistSq) return false;
        }

        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    tick() {
        if (this.player) return;
        this.running = false;
    }

    trigger() {
        if (this.player) {
            this._markTriggered();
            return;
        }
        const monster = this.monster;
        const target = monster?.target;
        const model = monster?.model;
        if (!monster || !target || !model?.IsValid?.()) return;

        const distsq = monster.distanceTosq(target.pos);
        const minDistSq = this.distanceMin * this.distanceMin;
        const maxDistSq = this.distanceMax * this.distanceMax;
        if (distsq < minDistSq || distsq > maxDistSq) return;

        const startPos = model.GetEyePosition?.() ?? model.GetAbsOrigin?.();
        const endPos = target.pos;
        if (!startPos || !endPos) return;

        const projectileEntity = this._spawnProjectileEntity(startPos);
        if (!projectileEntity) return;

        /** @type {import("../../throw/throw_const").ThrowCreateRequest} */
        const payload = {
            startPos,
            endPos,
            entity: projectileEntity,
            speed: this.projectileSpeed,
            gravityScale: this.gravityScale,
            radius: this.radius,
            maxTargets: this.maxTargets,
            targetType: ThrowTarget.Player,
            source: model,
            meta: {
                damage: this.damage,
                reason: "throwstone",
                skillId: this.id,
                skillTypeId: this.typeId,
            },
            result: -1,
        };
        eventBus.emit(event.Throw.In.CreateRequest, payload);
        if (payload.result <= 0) {
            if (projectileEntity.IsValid()) {
                projectileEntity.Remove();
            }
            return;
        }

        this.running = true;
        this._markTriggered();
    }

    /**
     * @param {import("cs_script/point_script").Vector} origin
     * @returns {import("cs_script/point_script").Entity | null}
     */
    _spawnProjectileEntity(origin) {
        if (!this.templateName) {
            Instance.Msg("ThrowStone: 未配置 templateName\n");
            return null;
        }

        const template = Instance.FindEntityByName(this.templateName);
        if (!template || !(template instanceof PointTemplate)) {
            Instance.Msg(`ThrowStone: 找不到 PointTemplate \"${this.templateName}\"\n`);
            return null;
        }

        const spawned = template.ForceSpawn(origin);
        if (!spawned || spawned.length !== 1) {
            Instance.Msg(`ThrowStone: PointTemplate \"${this.templateName}\" 必须且只能生成 1 个实体\n`);
            this._cleanupSpawnedEntities(spawned ?? []);
            return null;
        }

        const projectileEntity = spawned[0];
        if (!projectileEntity?.IsValid?.()) {
            Instance.Msg(`ThrowStone: PointTemplate \"${this.templateName}\" 生成的实体无效\n`);
            this._cleanupSpawnedEntities(spawned);
            return null;
        }

        return projectileEntity;
    }

    /**
     * @param {import("cs_script/point_script").Entity[]} entities
     */
    _cleanupSpawnedEntities(entities) {
        for (const entity of entities) {
            if (entity?.IsValid?.()) {
                entity.Remove();
            }
        }
    }
}
