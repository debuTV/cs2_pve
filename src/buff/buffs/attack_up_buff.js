import { BuffTemplate } from "../buff_template";

export class AttackUpBuff extends BuffTemplate {
    /**
     * @param {number} id
     * @param {import("../../player/player/player").Player} target
     * @param {string} targetType
     * @param {{ duration?: number; multiplier?: number }} [params]
     */
    constructor(id, target, targetType, params = {}) {
        super(id, target, targetType, "attack_up", params);
        this.duration = typeof params.duration === "number" ? params.duration : 30;
        this.multiplier = typeof params.multiplier === "number" ? params.multiplier : 1.35;
    }

    /**
     * @param {string} eventName
     */
    OnBuffEmit(eventName) {
        if (eventName !== "OnRecompute") {
            return { result: false };
        }
        if (this.targetType !== "player") {
            return { result: false };
        }

        const player = /** @type {import("../../player/player/player").Player} */ (this.target);
        player.stats.attackScale *= this.multiplier;
        return { result: true };
    }
}