/**
 * @module 怪物系统/怪物技能/激光
 */
import { Instance } from "cs_script/point_script";
import { SkillEvents } from "../skill_const";
import { SkillTemplate } from "../skill_template";
import { Player } from "../../player/player/player";
import { Monster } from "../../monster/monster/monster";

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
        this._beamStartedAt = 0;
        this._nextDamageAt = 0;
    }
    /**
     * @param {any} event
     */
    canTrigger(event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;
        if (!this.monster)return false;

        if (!this.monster.target) return false;
        if (this.running) return false;
        if (this.monster.isOccupied()) return false;

        const distsq = this.monster.distanceTosq(this.monster.target);
        if (distsq > this.distance * this.distance) return false;

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
        if (this.duration > 0 && this._beamStartedAt + this.duration <= now) {
            this._stopBeam();
            return;
        }

        const target = this.monster.target;
        if (!target || this.monster.distanceTosq(target) > this.distance * this.distance) {
            this._stopBeam();
            return;
        }

        const interval = this.tickInterval > 0 ? this.tickInterval : 0.25;
        while (now >= this._nextDamageAt) {
            this.monster.emitAttackEvent(Math.max(1, Math.round(this.damagePerSecond * interval)), target);
            this._nextDamageAt += interval;
        }
    }

    trigger() {
        if (this.player) {
            this._markTriggered();
            return;
        }
        const monster = this.monster;
        const target = monster?.target;
        if (!monster || !target) return;
        if (monster.distanceTosq(target) > this.distance * this.distance) return;

        this._markTriggered();
        this._beamStartedAt = Instance.GetGameTime();
        const interval = this.tickInterval > 0 ? this.tickInterval : 0.25;
        this._nextDamageAt = this._beamStartedAt + this.startDelay;

        if (this.duration <= 0) {
            monster.emitAttackEvent(Math.max(1, Math.round(this.damagePerSecond * interval)), target);
            this._stopBeam();
            return;
        }

        this.running = true;
    }

    onSkillDelete() {
        this._stopBeam();
    }

    _stopBeam() {
        this.running = false;
        this._beamStartedAt = 0;
        this._nextDamageAt = 0;
    }
}
