/**
 * @module 怪物系统/怪物技能/急速
 */
import { BaseModelEntity } from "cs_script/point_script";
import { MonsterRuntimeEvents } from "../../util/runtime_events.js";
import { SkillTemplate } from "../skill_template";

export class SpeedBoostSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
     * @param {{
     *   cooldown?: number;
    *   buffConfigId?: string;
     *   events?: string[];
     *   animation?: string | null;
     *   glow?: {r:number, g:number, b:number} | null;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "speedboost", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [MonsterRuntimeEvents.Tick];
        this.buffConfigId = typeof params.buffConfigId === "string" && params.buffConfigId.trim().length > 0
            ? params.buffConfigId.trim()
            : "speed_up";
        this.glow = params.glow ?? null;
    }

    onSkillDelete() {
        this._endBoost();
    }

    canTrigger(/** @type {any} */ event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;

        const monster = this.monster;
        if (monster) {
            if (this.running) return false;
            if (monster.isOccupied()) return false;
        }

        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    tick() {
        if (this.player) return;

        const monster = this.monster;
        if (!this.running || !monster) return;

        if (!monster.hasBuff(this.buffConfigId)) {
            this._endBoost();
        }
    }

    trigger() {
        if (this.player) {
            this._markTriggered();
            return;
        }

        const monster = this.monster;
        if (!monster) return;

        const buff = monster.addBuff(this.buffConfigId);

        if (!buff) return;

        if (this.glow && monster.model instanceof BaseModelEntity) {
            monster.model.Glow(this.glow);
        }
        this.running = true;
        this._markTriggered();
    }

    _endBoost() {
        const monster = this.monster;
        this.running = false;
        if (this.glow && monster && monster.model instanceof BaseModelEntity) {
            monster.model.Unglow();
        }
    }
}
