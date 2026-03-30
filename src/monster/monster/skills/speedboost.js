/**
 * @module 怪物系统/怪物技能/急速
 */
import { BaseModelEntity, Instance } from "cs_script/point_script";
import { SkillTemplate } from "../skill_manager";
import { MonsterBuffEvents } from "../monster_state";

export class SpeedBoostSkill extends SkillTemplate {
    constructor(monster, params) {
        super(monster);
        this.typeId = "speedboost";
        this.cooldown = params.cooldown ?? -1;
        this.runtime = params.runtime ?? 3;
        this.speed_mult = params.speed_mult ?? 1;
        this.speed_value = params.speed_value ?? 0;
        this.animation = params.animation ?? null;
        this.events = params.events ?? [MonsterBuffEvents.Tick];
        this.glow = params.glow ?? null;
    }

    canTrigger(event) {
        if (!this.events.includes(event.type)) return false;
        if (this.running) return false;
        if (this.monster.isOccupied()) return false;
        if (!this._cooldownReady()) return false;
        if (!this.isActive()) {
            this.trigger();
            return false;
        }
        return true;
    }

    tick() {
        if (!this.running) return;

        const hasOwnBuff = this.monster
            .getAllBuffs()
            .some((buff) => buff.groupKey === this._getBuffGroupKey());

        if (!hasOwnBuff) {
            this._endBoost();
            return;
        }

        if (this.runtime !== -1 && this.lastTriggerTime + this.runtime <= Instance.GetGameTime()) {
            this._endBoost();
        }
    }

    trigger() {
        const buff = this.monster.addBuff("speed_up", {
            duration: this.runtime,
            multiplier: this.speed_mult,
            flatBonus: this.speed_value,
            groupKey: this._getBuffGroupKey(),
        }, {
            sourceType: "monster-self-buff",
            sourceId: this.monster.id,
            monsterId: this.monster.id,
            monsterType: this.monster.type ?? "unknown",
            skillTypeId: this.typeId,
        });

        if (!buff) return;

        if (this.glow && this.monster.model instanceof BaseModelEntity) {
            this.monster.model.Glow(this.glow);
        }
        this.running = true;
        this._markTriggered();
    }

    _endBoost() {
        this.running = false;
        if (this.glow && this.monster.model instanceof BaseModelEntity) {
            this.monster.model.Unglow();
        }
    }

    _getBuffGroupKey() {
        return `skill:speedboost:${this.id}`;
    }
}
