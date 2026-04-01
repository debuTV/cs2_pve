/**
 * @module 怪物系统/怪物技能/激光
 */
import { Monster } from "../../monster/monster/monster";
import { Player } from "../../player/player/player";
import { Instance } from "cs_script/point_script";
import { SkillEvents } from "../skill_const";
import { SkillTemplate } from "../skill_template";

export class LaserBeamSkill extends SkillTemplate {
    /**
     * @param {Player|null} player
     * @param {Monster|null} monster
     * @param {number} id
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string | null;
     *   distance?: number;
     *   duration?: number;
     *   damagePerSecond?: number;
     *   tickInterval?: number;
     *   width?: number;
     *   pierce?: boolean;
     *   maxTargets?: number;
     *   startDelay?: number;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "laserbeam", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [SkillEvents.Tick];
        this.distance = params.distance ?? 500;
        this.duration = params.duration ?? 0;
        this.damagePerSecond = params.damagePerSecond ?? 20;
        this.tickInterval = params.tickInterval ?? 0.25;
        this.width = params.width ?? 8;
        this.pierce = params.pierce ?? false;
        this.maxTargets = params.maxTargets ?? 1;
        this.startDelay = params.startDelay ?? 0;
        this._tickAccumulator = 0;
        this._tickCtx = null;
    }

    canTrigger(/** @type {any} */ event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;
        if (!this.monster)return false;
        const monster = this.monster;
        if (monster) {
            if (!monster.target) return false;
            if (this.running) return false;
            if (monster.isOccupied()) return false;

            const distsq = monster.distanceTosq(monster.target);
            if (distsq > this.distance * this.distance) return false;

            this._tickCtx = { dt: event.dt, allmpos: event.allmpos };
        }

        if (this.animation === null) {
            this.trigger();
            return false;
        }
        return true;
    }

    tick() {
        if (this.player) return;
        if (!this.running || !this.monster) return;

        const now = Instance.GetGameTime();
        if (this.duration > 0 && this.lastTriggerTime + this.duration <= now) {
            this.running = false;
            this._tickAccumulator = 0;
            return;
        }

        // this._tickAccumulator += dt;
        // while (this._tickAccumulator >= this.tickInterval) {
        //     this._tickAccumulator -= this.tickInterval;
        //     // 射线检测 + 造成伤害
        // }
    }

    trigger() {
        if (this.player) {
            this._markTriggered();
            return;
        }
        if (!this.monster) return;

        if (this.duration > 0) {
            this.running = true;
            this._tickAccumulator = 0;
        }

        this._markTriggered();
    }
}
