/**
 * @module 玩家系统/玩家/Buff/毒气Buff
 */
import { BuffTemplate, BuffStackMode, BuffPersistPolicy } from "./buff_template";

/**
 * 毒气 Buff — 进入毒气范围时持续刷新，离开后仍按剩余时长持续扣血。
 *
 * 参数（params）：
 * | 参数           | 默认值 | 说明                       |
 * |---------------|--------|----------------------------|
 * | `dps`         | 5      | 每秒伤害值                   |
 * | `duration`    | 4      | 持续秒数                     |
 * | `tickInterval`| 1      | 伤害间隔（秒）               |
 * | `source`      | ""     | 来源描述                     |
 *
 * 叠层模式 REFRESH，重新进入毒区会刷新持续时间，
 * 并自动升级 DPS 到更高值。
 *
 * @navigationTitle 毒气 Buff
 */
export class PoisonBuff extends BuffTemplate {
    /**
     * @param {import("../player.js").Player} player 所属玩家实例
     * @param {Record<string, any>} [params] 初始化参数
     */
    constructor(player, params) {
        super(player, {
            duration:      params?.duration      ?? 4,
            tickInterval:  params?.tickInterval  ?? 1,
            stackMode:     BuffStackMode.REFRESH,
            persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
            tags:          ["dot", "poison", "debuff"],
            ...params,
        });
        this.typeId = "poison";
        /** @type {number} 每秒伤害值 */
        this.dps = params?.dps ?? 5;
    }

    /** 每 tickInterval 秒触发一次 */
    /** @param {number} dt */
    onIntervalTick(dt) {
        const damage = this.dps * dt;
        if (damage > 0) {
            this.player.takeDamage(damage);
        }
    }

    /** @param {BuffTemplate} incoming */
    onRefresh(incoming) {
        super.onRefresh(incoming);
        // 刷新时取更高的 dps
        const incomingDps = /** @type {number} */ ("dps" in incoming ? incoming.dps : 0);
        if (incomingDps > this.dps) {
            this.dps = incomingDps;
        }
    }
}
