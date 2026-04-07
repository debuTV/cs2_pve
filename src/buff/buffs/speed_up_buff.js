import { BuffTemplate } from "../buff_template";

export class SpeedUpBuff extends BuffTemplate {
    /**
     * @param {number} id
     * @param {import("../../monster/monster/monster").Monster} target
     * @param {string} targetType
     * @param {{ duration?: number; multiplier?: number; flatBonus?: number }} [params]
     */
    constructor(id, target, targetType, params = {}) {
        super(id, target, targetType, "speed_up", params);
        this.duration = typeof params.duration === "number" ? params.duration : 5;
        this.multiplier = typeof params.multiplier === "number" ? params.multiplier : 1.8;
        this.flatBonus = typeof params.flatBonus === "number" ? params.flatBonus : 0;
    }

    /**
     * @param {string} eventName
     */
    OnBuffEmit(eventName) {
        if (eventName !== "OnRecompute") {
            return { result: false };
        }
        if (this.targetType !== "monster") {
            return { result: false };
        }

        const monster = /** @type {import("../../monster/monster/monster").Monster} */ (this.target);
        monster.speed = Math.max(0, monster.speed * this.multiplier + this.flatBonus);
        return { result: true };
    }
}