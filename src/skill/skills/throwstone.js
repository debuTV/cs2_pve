/**
 * @module 怪物系统/怪物技能/投掷石头
 */
import { SkillEvents } from "../skill_const";
import { SkillTemplate } from "../skill_template";

export class ThrowStoneSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string | null;
     *   distanceMin?: number;
     *   distanceMax?: number;
     *   damage?: number;
     *   projectileSpeed?: number;
     *   gravityScale?: number;
     *   radius?: number;
     *   maxTargets?: number;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "throwstone", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [SkillEvents.Tick];
        this.distanceMin = params.distanceMin ?? 0;
        this.distanceMax = params.distanceMax ?? 600;
        this.damage = params.damage ?? 10;
        this.projectileSpeed = params.projectileSpeed ?? 500;
        this.gravityScale = params.gravityScale ?? 1;
        this.radius = params.radius ?? 32;
        this.maxTargets = params.maxTargets ?? 1;
        this._projectile = null;
        this._tickCtx = null;
    }

    canTrigger(/** @type {any} */ event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;

        const monster = this.monster;
        if (monster) {
            if (!monster.target) return false;
            if (this.running) return false;
            if (monster.isOccupied()) return false;

            const distsq = monster.distanceTosq(monster.target);
            const minDistSq = this.distanceMin * this.distanceMin;
            const maxDistSq = this.distanceMax * this.distanceMax;
            if (distsq < minDistSq || distsq > maxDistSq) return false;

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
        if (!this.running) return;

        // if (this._projectile) {
        //     this._projectile.update(dt);
        //     if (this._projectile.isFinished()) {
        //         const hitTargets = this._projectile.getHitTargets();
        //         void hitTargets;
        //         this.running = false;
        //         this._projectile = null;
        //     }
        // }
    }

    trigger() {
        if (this.player) {
            this._markTriggered();
            return;
        }
        if (!this.monster) return;

        // this._projectile = new ProjectileRunner({ ... });
        // this.running = true;
        this._markTriggered();
    }
}
