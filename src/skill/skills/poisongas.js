/**
 * @module 怪物系统/怪物技能/毒气
 */
import { eventBus } from "../../eventBus/event_bus";
import { event } from "../../util/definition";
import { SkillEvents } from "../skill_const";
import { SkillTemplate } from "../skill_template";

export class PoisonGasSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
     * @param {{
     *   areaEffectStaticKey?: string;
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string | null;
     *   zoneDuration?: number;
     *   zoneRadius?: number;
     * }} params
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "poisongas", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [SkillEvents.Die];
        this.areaEffectStaticKey= "poisongas";
        this.zoneDuration = params.zoneDuration ?? 5;
        this.zoneRadius = params.zoneRadius ?? 150;
    }
    /**
     * @param {any} event
     */
    canTrigger(event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;
        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    trigger() {
        this._markTriggered();
        if (this.player) {
            return;
        }

        const monster = this.monster;
        if (!monster) return;

        const pos = monster.model?.GetAbsOrigin?.();
        if (!pos) return;
        /**@type {import("../../areaEffects/area_const").areaEffectDesc} */
        const payload = {
            areaEffectStaticKey: "poisongas",
            position: { x: pos.x, y: pos.y, z: pos.z },
            radius: this.zoneRadius,
            duration: this.zoneDuration,
            targetTypes: ["player"],
            result: false,
        };
        eventBus.emit(event.AreaEffects.In.CreateRequest, payload);
        return payload.result;
    }
}
