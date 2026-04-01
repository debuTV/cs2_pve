/**
 * @module 怪物系统/怪物技能/护盾
 */
import { BaseModelEntity, Instance } from "cs_script/point_script";
import { SkillEvents } from "../skill_const";
import { SkillTemplate } from "../skill_template";

export class ShieldSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
    * @param {Record<string, any>} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "shield", id, params);
        this.runtime = params.runtime ?? -1;
        this.maxshield = params.value ?? 0;
        this.shield = 0;
        this.animation = params.animation ?? null;

        const userEvents = params.events ?? [SkillEvents.Spawn, SkillEvents.Tick];
        this.events = userEvents.includes(SkillEvents.Spawn)
            ? userEvents
            : [SkillEvents.Spawn, ...userEvents];

        this._initialized = false;
        this._modFn = null;
    }

    onSkillDelete() {
        const monster = this.monster;
        if (monster && this._modFn) {
            monster.healthCombat.removeDamageModifier(this._modFn);
        }
        this.running = false;
        if (monster && monster.model instanceof BaseModelEntity) {
            monster.model.Unglow();
        }
    }

    canTrigger(/** @type {any} */ event) {
        if (!this.events.includes(event.type)) return false;

        const monster = this.monster;
        if (event.type === SkillEvents.Spawn) {
            if (this.player || !monster) return false;
            if (!this._initialized) {
                this._initialized = true;
                this._modFn = (/** @type {number} */ amount) => {
                    if (!this.running) return amount;

                    const absorbed = Math.min(amount, this.shield);
                    this.shield -= absorbed;
                    if (this.shield <= 0) {
                        this.running = false;
                        if (monster.model instanceof BaseModelEntity) {
                            monster.model.Unglow();
                        }
                    }
                    return amount - absorbed;
                };
                monster.healthCombat.addDamageModifier(this._modFn);
            }
            return false;
        }

        if (!this._cooldownReady()) return false;

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

        if (this.runtime !== -1 && this.lastTriggerTime + this.runtime <= Instance.GetGameTime()) {
            this.running = false;
            if (monster.model instanceof BaseModelEntity) {
                monster.model.Unglow();
            }
        }
    }

    trigger() {
        if (this.player) {
            this._markTriggered();
            return;
        }

        const monster = this.monster;
        if (!monster) return;

        this.shield = this.maxshield;
        if (monster.model instanceof BaseModelEntity) {
            monster.model.Glow({ r: 0, g: 0, b: 255 });
        }
        this.running = true;
        this._markTriggered();
    }
}