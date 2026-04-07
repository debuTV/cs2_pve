import { PoisonBuff } from "./buffs/poison_buff";
import { AttackUpBuff } from "./buffs/attack_up_buff";
import { SpeedUpBuff } from "./buffs/speed_up_buff";

export const BuffFactory = {
    /**
     * 根据 typeId 创建对应的 buff 实例。未识别的 id 返回 null。
     * @param {import("../monster/monster/monster").Monster|import("../player/player/player").Player} target
     * @param {string} targetType
     * @param {string} typeid
     * @param {number} id
     * @param {Record<string, any>} params
     * @returns {import("./buff_template").BuffTemplate|null}
     */
    create(target, targetType, typeid, id, params) {
        switch (typeid) {
            case "poison":
                return new PoisonBuff(id, target, targetType, params);
            case "attack_up":
                return targetType === "player"
                    ? new AttackUpBuff(id, /** @type {import("../player/player/player").Player} */ (target), targetType, params)
                    : null;
            case "speed_up":
                return targetType === "monster"
                    ? new SpeedUpBuff(id, /** @type {import("../monster/monster/monster").Monster} */ (target), targetType, params)
                    : null;
            case "corestats":
                return null;
            default:
                return null;
        }
    }
};