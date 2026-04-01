/**
 * @module 怪物系统/怪物技能/产卵
 */
import { SkillEvents } from "../skill_const";
import { SkillTemplate } from "../skill_template";

export class SpawnSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
     * @param {{
     *   events?: string[];
     *   event?: string;
     *   count?: number;
     *   typeName?: string;
     *   cooldown?: number;
     *   maxSummons?: number;
     *   radiusMin?: number;
     *   radiusMax?: number;
     *   tries?: number;
     *   animation?: string | null;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "spawn", id, params);
        this.animation = params.animation ?? null;

        const configuredEvents = params.events ?? (params.event ? [params.event] : [SkillEvents.Die]);
        this.events = Array.isArray(configuredEvents) ? configuredEvents : [configuredEvents];
        this.count = Math.max(1, params.count ?? 1);
        this.typeName = params.typeName ?? monster?.type ?? "";
        this.maxSummons = params.maxSummons ?? 1;
        this.radiusMin = Math.max(0, params.radiusMin ?? 24);
        this.radiusMax = Math.max(this.radiusMin, params.radiusMax ?? 96);
        this.tries = Math.max(1, params.tries ?? 6);
        this.spawnedTotal = 0;
        this._pendingCount = 0;
    }

    canTrigger(/** @type {any} */ event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;

        const monster = this.monster;
        if (monster) {
            if (this.maxSummons >= 0 && this.spawnedTotal >= this.maxSummons) return false;

            const remaining = this.maxSummons < 0
                ? this.count
                : Math.min(this.count, this.maxSummons - this.spawnedTotal);
            if (remaining <= 0) return false;

            this._pendingCount = remaining;
        }

        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    trigger() {
        if (this.player) {
            this._markTriggered();
            return;
        }

        const monster = this.monster;
        if (!monster) return;

        let spawnedNow = 0;
        for (let i = 0; i < this._pendingCount; i++) {
            const ok = monster.requestSpawn({
                typeName: this.typeName,
                radiusMin: this.radiusMin,
                radiusMax: this.radiusMax,
                tries: this.tries,
            });
            if (ok) spawnedNow++;
        }

        this._pendingCount = 0;
        if (spawnedNow > 0) {
            this.spawnedTotal += spawnedNow;
            this._markTriggered();
        }
    }
}
