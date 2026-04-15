/**
 * @module 怪物系统/怪物技能/重击
 */
import { eventBus } from "../../util/event_bus";
import { event } from "../../util/definition";
import { MonsterRuntimeEvents } from "../../util/runtime_events.js";
import { SkillTemplate } from "../skill_template";

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
     * }} [params]
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "powerattack", id, params);
        this.animation = params.animation ?? null;
        this.events = params.events ?? [MonsterRuntimeEvents.AttackTrue];
        this.buffConfigId = typeof params.buffConfigId === "string"
            ? params.buffConfigId.trim()
            : "";
    }

    canTrigger(/** @type {any} */ event) {
        if (!this.events.includes(event.type)) return false;
        if (!this._cooldownReady()) return false;

        const monster = this.monster;
        if (monster) {
            if (!monster.target) return false;
            if (monster.isOccupied()) return false;
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
        const target = monster?.target;
        if (!monster || !target) return;
        if (monster.distanceTosq(target) > monster.attackdist * monster.attackdist) return;

        this._markTriggered();
        this._applyTargetBuff(target);
        monster.emitAttackEvent(Math.max(1, Math.round(monster.damage * 2)), target);
    }

    /**
     * @param {import("cs_script/point_script").CSPlayerPawn} target
     * @returns {boolean}
     */
    _applyTargetBuff(target) {
        if (!this.buffConfigId) return false;

        const slot = target?.GetPlayerController?.()?.GetPlayerSlot?.();
        if (typeof slot !== "number" || slot < 0) return false;

        const rewardRequest = {
            slot,
            reward: {
                type: "buff",
                buffConfigId: this.buffConfigId,
            },
            result: false,
        };
        eventBus.emit(event.Player.In.DispatchRewardRequest, rewardRequest);
        return rewardRequest.result === true;
    }
}