/**
 * @module 怪物系统/怪物技能/重击
 */
import { MonsterRuntimeEvents } from "../../util/runtime_events.js";
import { SkillTemplate } from "../skill_template";
import { Player } from "../../player/player/player";

export class PowerAttackSkill extends SkillTemplate {
    /**
     * @param {any|null} player
     * @param {import("../../monster/monster/monster").Monster|null} monster
     * @param {number} id
     * @param {{
     *   cooldown?: number;
     *   events?: string[];
     *   animation?: string | null;
     *   buffConfigId?: string;
     *   bonusDamageMultiplier?: number;
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "powerattack", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [MonsterRuntimeEvents.AttackTrue];
        this.buffConfigId = typeof params.buffConfigId === "string"
            ? params.buffConfigId.trim()
            : "";
        this.bonusDamageMultiplier = typeof params.bonusDamageMultiplier === "number"
            ? Math.max(0, params.bonusDamageMultiplier)
            : 2;
        this._pendingTarget = null;
    }

    canTrigger(/** @type {any} */ event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;

        const monster = this.monster;
        if (monster) {
            const target = event?.target ?? monster.target;
            if (!target) return false;
            if (event.type !== MonsterRuntimeEvents.AttackTrue && monster.isOccupied()) return false;
            this._pendingTarget = target;
        }

        if (this.animation === null) {
            this.trigger(this._pendingTarget);
            return false;
        }
        return true;
    }

    /**
     * @param {Player|null} [targetOverride]
     */
    trigger(targetOverride = null) {
        if (this.player) {
            this._markTriggered();
            return;
        }
        const monster = this.monster;
        const target = targetOverride ?? this._pendingTarget ?? monster?.target ?? null;
        this._pendingTarget = null;
        if (!monster || !target) return;
        if (monster.distanceTosq(target.pos) > monster.attackdist * monster.attackdist) return;

        this._markTriggered();
        this._applyTargetBuff(target);
        const pawn=target.entityBridge?.pawn;
        if (pawn && this.bonusDamageMultiplier > 0) {
            monster.emitAttackEvent(Math.max(1, Math.round(monster.damage * this.bonusDamageMultiplier)), pawn);
        }
    }

    /**
     * @param {Player} target
     * @returns {boolean}
     */
    _applyTargetBuff(target) {
        if (!this.buffConfigId) return false;
        return target.refreshBuff(this.buffConfigId);
    }
}