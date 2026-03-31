/**
 * @module 玩家系统/玩家/Buff/击飞Buff
 */
import { Instance } from "cs_script/point_script";
import { BuffTemplate, BuffStackMode, BuffPersistPolicy } from "./buff_template";

/**
 * 击飞 Buff — 被怪物重击时给予玩家一个速度脉冲（击飞）。
 *
 * 参数（params）：
 * | 参数            | 默认值 | 说明                           |
 * |----------------|--------|--------------------------------|
 * | `impulse`      | 300    | 水平冲量大小                     |
 * | `verticalBoost`| 400    | 垂直速度                         |
 * | `duration`     | 0.6    | 状态持续秒数（仅用于标记）       |
 * | `direction`    | null   | 方向向量 {x,y,z}，空则垂直上飞   |
 * | `source`       | ""     | 来源描述                         |
 *
 * 叠层模式 REJECT，同一时刻只允许一个击飞实例。
 * 标签 `["cc"]`，可通过 `getBuffsByTag("cc")` 查询控制类 Buff。
 *
 * @navigationTitle 击飞 Buff
 */
export class KnockUpBuff extends BuffTemplate {
    /**
     * @param {import("../player.js").Player} player 所属玩家实例
     * @param {Record<string, any>} [params] 初始化参数
     */
    constructor(player, params) {
        super(player, {
            duration:      params?.duration ?? 0.6,
            stackMode:     BuffStackMode.REJECT,
            persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
            tags:          ["cc", "knockup", "debuff"],
            ...params,
        });
        this.typeId = "knockup";
        /** @type {number} 水平冲量大小 */
        this.impulse       = params?.impulse       ?? 300;
        /** @type {number} 垂直速度 */
        this.verticalBoost = params?.verticalBoost  ?? 400;
        /** @type {{x:number,y:number,z:number}|null} 方向向量，null 则垂直上飞 */
        this.direction     = params?.direction      ?? null;
    }

    /**
     * Buff 添加时触发：对玩家 Pawn 施加速度脉冲实现击飞效果。
     */
    onAdd() {
        const pawn = this.player.entityBridge.pawn;
        if (!pawn || !pawn.IsValid()) return;

        let vx = 0, vy = 0;
        if (this.direction) {
            vx = this.direction.x * this.impulse;
            vy = this.direction.y * this.impulse;
        }
        const vz = this.verticalBoost;

        pawn.Teleport(null, null, { x: vx, y: vy, z: vz });
    }
}
