import { eventBus } from "../../util/event_bus";
import { event } from "../../util/definition";
import { Target } from "../../areaEffects/area_const";
import { PlayerRuntimeEvents } from "../../util/runtime_events.js";
import { SkillTemplate } from "../skill_template";

export class PlayerHealingFieldSkill extends SkillTemplate {
    /**
     * @param {import("../../player/player/player").Player | null} player
     * @param {import("../../monster/monster/monster").Monster | null} monster
     * @param {number} id
     * @param {{
     *   inputKey?: string;
     *   cooldown?: number;
     *   zoneDuration?: number;
     *   zoneRadius?: number;
     *   areaEffectStaticKey?: string;
     *   targetTypes?: string[];
     *   events?: string[];
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "player_mend_field", id, params);
        this.animation = null;
        this.events = Array.isArray(params.events) && params.events.length > 0
            ? params.events
            : [PlayerRuntimeEvents.Input];
        this.inputKey = params.inputKey ?? "InspectWeapon";
        this.zoneDuration = params.zoneDuration ?? 5;
        this.zoneRadius = params.zoneRadius ?? 150;
        this.areaEffectStaticKey = params.areaEffectStaticKey ?? "healing_field";
        this.targetTypes = Array.isArray(params.targetTypes) ? params.targetTypes : [Target.Player];
        this.activeAreaEffectId = null;
    }

    /**
        * @param {import("../../util/runtime_events.js").RuntimeEvent} eventPayload
     * @returns {boolean}
     */
    canTrigger(eventPayload) {
        if (!this.player || this.monster) return false;
        if (!this.events.includes(eventPayload.type)) return false;
        const inputKey = "key" in eventPayload ? eventPayload.key : undefined;
        if (eventPayload.type === PlayerRuntimeEvents.Input && inputKey !== this.inputKey) return false;
        if (!this._cooldownReady()) return false;

        this.trigger();
        return false;
    }

    trigger() {
        const parentEntity = this._getParentEntity();
        const position = parentEntity?.GetAbsOrigin?.();
        if (!position) return false;

        this._stopActiveAreaEffect();

        /** @type {import("../../areaEffects/area_const").AreaEffectCreateRequest} */
        const payload = {
            areaEffectStaticKey: this.areaEffectStaticKey,
            position: { x: position.x, y: position.y, z: position.z },
            parentEntity,
            radius: this.zoneRadius,
            duration: this.zoneDuration,
            targetTypes: this._resolveTargetTypes(),
            result: -1,
        };
        eventBus.emit(event.AreaEffects.In.CreateRequest, payload);
        if (payload.result <= 0) {
            return false;
        }

        this.activeAreaEffectId = payload.result;
        this._markTriggered();
        return true;
    }

    onSkillDelete() {
        super.onSkillDelete();
        this._stopActiveAreaEffect();
    }

    _getParentEntity() {
        const player = this.player;
        const pawn = player?.entityBridge?.pawn;
        if (!player || this.monster || !player.isReady || !pawn?.IsValid?.()) {
            return null;
        }
        return pawn;
    }

    _resolveTargetTypes() {
        const resolved = this.targetTypes.filter((type) => type === Target.Player || type === Target.Monster);
        return resolved.length > 0 ? Array.from(new Set(resolved)) : [Target.Player];
    }

    _stopActiveAreaEffect() {
        const areaEffectId = this.activeAreaEffectId;
        this.activeAreaEffectId = null;
        if (areaEffectId == null || areaEffectId < 1) return false;

        /** @type {import("../../areaEffects/area_const").AreaEffectStopRequest} */
        const payload = {
            areaEffectId,
            result: false,
        };
        eventBus.emit(event.AreaEffects.In.StopRequest, payload);
        return payload.result;
    }
}