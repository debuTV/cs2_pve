/**
 * @module 怪物系统/怪物技能/声音实体
 */
import { Instance } from "cs_script/point_script";
import { createSoundEntity, SOUND_TEMPLATE_NAME } from "../../util/sound.js";
import { MonsterRuntimeEvents } from "../../util/runtime_events.js";
import { SkillTemplate } from "../skill_template";

export class SoundSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
     * @param {{
     *   eventSoundMap?: Record<string, string>;
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string | null;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "sound", id, params);
        this.cooldown = params.cooldown ?? 0;
        this.animation = params.animation ?? null;
        this.eventSoundMap = params.eventSoundMap ?? {};
        const configuredEvents = Array.isArray(params.events) && params.events.length > 0
            ? params.events
            : Object.keys(this.eventSoundMap);
        this.events = configuredEvents.length > 0
            ? configuredEvents
            : [MonsterRuntimeEvents.Spawn];
        /** @type {import("cs_script/point_script").Entity|null} */
        this._soundEntity = null;
        /** @type {string | null} */
        this._pendingSoundEventName = null;
    }

    onSkillAdd() {
        if (this.player || !this.monster) return;
        this._ensureSoundEntity();
    }

    onSkillDelete() {
        super.onSkillDelete();
        this._pendingSoundEventName = null;
        this._cleanupEntities();
    }

    /**
     * @param {{ type: string }} event
     * @returns {boolean}
     */
    canTrigger(event) {
        if (this.player || !this.monster) return false;
        if (!this.events.includes(event.type)) return false;
        const soundEventName = this.eventSoundMap[event.type];
        if (!soundEventName) return false;
        if (!this._cooldownReady()) return false;
        if (!this._ensureSoundEntity()) return false;
        if (this.animation === null) {
            this._pendingSoundEventName = soundEventName;
            this.trigger();
            return false;
        }
        if (this.monster.isOccupied()) return false;
        this._pendingSoundEventName = soundEventName;
        return true;
    }

    trigger() {
        if (this.player || !this.monster) return false;
        if (!this._ensureSoundEntity()) return false;

        const soundEntity = this._soundEntity;
        const soundEventName = this._pendingSoundEventName;
        if (!soundEntity?.IsValid?.()) return false;
        if (!soundEventName) return false;

        Instance.EntFireAtTarget({
            target: soundEntity,
            input: "SetSoundEventName",
            value: soundEventName,
        });
        Instance.EntFireAtTarget({
            target: soundEntity,
            input: "StartSound",
        });
        this._pendingSoundEventName = null;
        this._markTriggered();
        return true;
    }
    /**
     * @returns {boolean}
     */
    _ensureSoundEntity() {
        if (this._soundEntity?.IsValid?.()) {
            return true;
        }

        const monster = this.monster;
        const model = monster?.model;
        if (!model?.IsValid?.()) {
            return false;
        }

        const origin = model.GetAbsOrigin?.();
        if (!origin) {
            return false;
        }

        this._cleanupEntities();

        this._soundEntity = createSoundEntity({
            position: origin,
        });
        if (!this._soundEntity?.IsValid?.()) {
            this._soundEntity = null;
            return false;
        }

        Instance.EntFireAtTarget({
            target: this._soundEntity,
            input: "Followentity",
            value: "!activator",
            activator: model,
        });
        return true;
    }

    _cleanupEntities() {
        if (this._soundEntity?.IsValid?.()) {
            this._soundEntity.Remove();
        }
        this._soundEntity = null;
    }
}