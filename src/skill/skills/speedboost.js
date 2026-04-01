/**
 * @module 怪物系统/怪物技能/急速
 */
import { BaseModelEntity, Instance } from "cs_script/point_script";
import { SkillEvents } from "../skill_const";
import { SkillTemplate } from "../skill_template";

export class SpeedBoostSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
     * @param {{
     *   cooldown?: number;
     *   runtime?: number;
     *   speed_mult?: number;
     *   speed_value?: number;
     *   events?: string[];
     *   animation?: string | null;
     *   glow?: {r:number, g:number, b:number} | null;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "speedboost", id, params);
        this.runtime = params.runtime ?? 3;
        this.speed_mult = params.speed_mult ?? 1;
        this.speed_value = params.speed_value ?? 0;
        this.animation = params.animation ?? null;
        this.events = params.events ?? [SkillEvents.Tick];
        this.glow = params.glow ?? null;
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

        /** @type {any[]} */
        const buffs = monster.getAllBuffs();
        const hasOwnBuff = buffs.some((buff) => buff.groupKey === this._getBuffGroupKey());

        if (!hasOwnBuff) {
            this._endBoost();
            return;
        }

        if (this.runtime !== -1 && this.lastTriggerTime + this.runtime <= Instance.GetGameTime()) {
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

        const buff = monster.addBuff("speed_up", {
            duration: this.runtime,
            multiplier: this.speed_mult,
            flatBonus: this.speed_value,
            groupKey: this._getBuffGroupKey(),
        }, {
            sourceType: "monster-self-buff",
            sourceId: monster.id,
            monsterId: monster.id,
            monsterType: monster.type ?? "unknown",
            skillTypeId: this.typeId,
        }, {
            monster,
        });

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

    _getBuffGroupKey() {
        return `skill:speedboost:${this.id}`;
    }
}
