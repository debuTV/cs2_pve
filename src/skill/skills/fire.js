/**
 * @module 怪物系统/怪物技能/燃烧
 */
import { eventBus } from "../../util/event_bus";
import { event } from "../../util/definition";
import { Target } from "../../areaEffects/area_const";
import { MonsterRuntimeEvents, PlayerRuntimeEvents } from "../../util/runtime_events.js";
import { SkillTemplate } from "../skill_template";

export class FireSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
     * @param {{
     *   areaEffectStaticKey?: string;
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string | null;
     *   inputKey?: string;
     *   zoneDuration?: number;
     *   zoneRadius?: number;
     *   triggerDistance?: number;
     *   distance?: number;
     *   targetTypes?: string[];
     * }} params
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "fire", id, params);
        this.animation = params.animation ?? null;
        this.events = Array.isArray(params.events) && params.events.length > 0
            ? params.events
            : (player && !monster ? [PlayerRuntimeEvents.Input] : [MonsterRuntimeEvents.Die]);
        this.inputKey = params.inputKey ?? "InspectWeapon";
        this.areaEffectStaticKey = params.areaEffectStaticKey ?? "fire";
        this.zoneDuration = params.zoneDuration ?? 5;
        this.zoneRadius = params.zoneRadius ?? 150;
        this.triggerDistance = Math.max(0, params.triggerDistance ?? params.distance ?? this.zoneRadius);
        this.targetTypes = Array.isArray(params.targetTypes) ? params.targetTypes : null;
    }
    /**
        * @param {import("../../util/runtime_events.js").RuntimeEvent} event
     */
    canTrigger(event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;

        if (this.player && !this.monster) {
            const inputKey = "key" in event ? event.key : undefined;
            if (event.type === PlayerRuntimeEvents.Input && inputKey !== this.inputKey) return false;
            this.trigger();
            return false;
        }

        const monster = this.monster;
        if (!monster) return false;

        if (event.type === MonsterRuntimeEvents.Tick) {
            if (!monster.target) return false;
            if (monster.isOccupied()) return false;
            const triggerDistanceSq = this.triggerDistance * this.triggerDistance;
            if (triggerDistanceSq > 0 && monster.distanceTosq(monster.target) > triggerDistanceSq) {
                return false;
            }
        }

        if (this.animation === null) {
            this.trigger();
            return false;
        }

        return true;
    }

    trigger() {
        const pos = this.player
            ? (this.player.entityBridge?.pawn?.IsValid?.() ? this.player.entityBridge.pawn.GetAbsOrigin() : null)
            : (this.monster?.model?.IsValid?.() ? this.monster.model.GetAbsOrigin() : null);
        if (!pos) return false;

        /**@type {import("../../areaEffects/area_const").AreaEffectCreateRequest} */
        const payload = {
            areaEffectStaticKey: this.areaEffectStaticKey,
            position: { x: pos.x, y: pos.y, z: pos.z },
            radius: this.zoneRadius,
            duration: this.zoneDuration,
            targetTypes: this._resolveTargetTypes(),
            result: -1,
        };
        eventBus.emit(event.AreaEffects.In.CreateRequest, payload);
        if (payload.result > 0) {
            this._markTriggered();
            return true;
        }
        return false;
    }

    _resolveTargetTypes() {
        const configuredTypes = Array.isArray(this.targetTypes)
            ? this.targetTypes.filter((type) => type === Target.Player || type === Target.Monster)
            : [];
        if (configuredTypes.length > 0) {
            return Array.from(new Set(configuredTypes));
        }
        if (this.player && !this.monster) {
            return [Target.Monster];
        }
        return [Target.Player];
    }
}
