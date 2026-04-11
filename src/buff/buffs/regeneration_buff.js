import { Instance } from "cs_script/point_script";
import { PlayerState } from "../../player/player_const";
import { BuffTemplate } from "../buff_template";
import { Monster } from "../../monster/monster/monster";
import { MonsterRuntimeEvents, PlayerRuntimeEvents } from "../../util/runtime_events.js";

export class RegenerationBuff extends BuffTemplate {
    /**
     * @param {number} id
     * @param {import("../../player/player/player").Player} target
     * @param {string} targetType
     * @param {{ duration?: number; tickInterval?: number; healPerTick?: number }} [params]
     */
    constructor(id, target, targetType, params = {}) {
        super(id, target, targetType, "regeneration", params);
        this.duration = typeof params.duration === "number" ? params.duration : 1;
        this.tickInterval = Math.max(0.1, typeof params.tickInterval === "number" ? params.tickInterval : 0.5);
        this.healPerTick = Math.max(0, typeof params.healPerTick === "number" ? params.healPerTick : 5);
        this._nextTickTime = Instance.GetGameTime() + this.tickInterval;
    }

    start() {
        const started = super.start();
        if (!started) return false;
        this._nextTickTime = Instance.GetGameTime() + this.tickInterval;
        return true;
    }

    refresh() {
        return super.refresh();
    }

    tick() {
        if (!this.use) return;
        if (!this._isTargetAlive()) {
            this.stop();
            return;
        }

        super.tick();
        if (!this.use) return;

        const now = Instance.GetGameTime();
        while (this.use && now >= this._nextTickTime) {
            this._applyTickHeal();
            this._nextTickTime += this.tickInterval;
        }
    }

    /**
     * @param {string} eventName
     * @param {{ nextState?: number }} [params]
     */
    OnBuffEmit(eventName, params = {}) {
        const runtimeEvents = this.targetType === "player" ? PlayerRuntimeEvents : MonsterRuntimeEvents;

        if (eventName === runtimeEvents.Die) {
            this.stop();
            return { result: true };
        }

        if (eventName === runtimeEvents.StateChange) {
            if (params.nextState === PlayerState.DEAD || params.nextState === PlayerState.DISCONNECTED) {
                this.stop();
                return { result: true };
            }
        }

        return { result: false };
    }

    _applyTickHeal() {
        if (this.healPerTick <= 0) return;
        if (this.target instanceof Monster) return;
        this.target.heal(this.healPerTick);
        if (!this._isTargetAlive()) {
            this.stop();
        }
    }

    _isTargetAlive() {
        return !!this.target
            && this.target.state !== PlayerState.DEAD
            && this.target.state !== PlayerState.DISCONNECTED;
    }
}