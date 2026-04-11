import { Instance } from "cs_script/point_script";
import { MonsterState } from "../../monster/monster_const";
import { PlayerState } from "../../player/player_const";
import { MonsterRuntimeEvents, PlayerRuntimeEvents } from "../../util/runtime_events.js";
import { BuffTemplate } from "../buff_template";

export class BurnBuff extends BuffTemplate {
    /**
     * @param {number} id
     * @param {import("../../monster/monster/monster").Monster|import("../../player/player/player").Player} target
     * @param {string} targetType
     * @param {{ duration?: number; tickInterval?: number; dps?: number }} [params]
     */
    constructor(id, target, targetType, params = {}) {
        super(id, target, targetType, "burn", params);
        this.duration = typeof params.duration === "number" ? params.duration : 1;
        this.tickInterval = Math.max(0.1, typeof params.tickInterval === "number" ? params.tickInterval : 0.5);
        this.dps = Math.max(0, typeof params.dps === "number" ? params.dps : 8);
        this._nextTickTime = Instance.GetGameTime() + this.tickInterval;
    }

    start() {
        const started = super.start();
        if (!started) return false;
        this._nextTickTime = Instance.GetGameTime() + this.tickInterval;
        return true;
    }

    refresh() {
        const refreshed = super.refresh();
        if (!refreshed) return false;
        return true;
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
            this._applyTickDamage(this.tickInterval);
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
            if (this.targetType === "player" && params.nextState === PlayerState.DEAD) {
                this.stop();
                return { result: true };
            }
            if (this.targetType === "monster" && params.nextState === MonsterState.DEAD) {
                this.stop();
                return { result: true };
            }
        }

        return { result: false };
    }

    /**
     * @param {number} intervalSeconds
     */
    _applyTickDamage(intervalSeconds) {
        const damage = this.dps * intervalSeconds;
        if (damage <= 0) return;

        if (this.targetType === "player") {
            this.target.takeDamage(damage, null);
        } else if (this.targetType === "monster") {
            this.target.takeDamage(damage, null, { reason: "burn" });
        }

        if (!this._isTargetAlive()) {
            this.stop();
        }
    }

    _isTargetAlive() {
        if (!this.target) return false;
        if (this.targetType === "player") {
            return this.target.state !== PlayerState.DEAD && this.target.state !== PlayerState.DISCONNECTED;
        }
        if (this.targetType === "monster") {
            return this.target.state !== MonsterState.DEAD;
        }
        return false;
    }
}
