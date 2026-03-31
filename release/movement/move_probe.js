/**
 * @module 实体移动/碰撞探测器
 */
import { Instance } from "cs_script/point_script";
import { traceMins, traceMaxs, groundCheckDist, surfaceEpsilon, stepHeight } from "./movement_const";
import { vec } from "../util/vector";

/** @typedef {import("cs_script/point_script").Vector} Vector */
/** @typedef {import("cs_script/point_script").Entity} Entity */

/**
 * 碰撞探测器：封装 TraceBox 调用，提供 traceMove / traceGround / tryStep。
 */
export class MoveProbe {
    /**
     * @param {{ mins?: Vector; maxs?: Vector }} [config]
     */
    constructor(config = {}) {
        this.mins = config.mins ?? traceMins;
        this.maxs = config.maxs ?? traceMaxs;
    }

    /**
     * 扫描前方是否被阻挡
     * @param {Vector} start
     * @param {Vector} end
     * @param {Entity[]} ignoreEntities
     */
    traceMove(start, end, ignoreEntities) {
        const tr = Instance.TraceBox({
            mins: this.mins,
            maxs: this.maxs,
            start,
            end,
            ignorePlayers: true,
            ignoreEntity: ignoreEntities
        });
        return {
            hit: !!(tr && tr.didHit),
            endPos: end,
            hitPos: vec.add(tr.end, vec.scale(tr.normal, surfaceEpsilon)),
            normal: tr.normal,
            fraction: tr.fraction
        };
    }

    /**
     * 向下检测地面
     * @param {Vector} pos
     * @param {Entity[]} ignoreEntities
     */
    traceGround(pos, ignoreEntities) {
        const start = vec.clone(pos);
        const end = vec.Zfly(pos, -groundCheckDist);
        const tr = Instance.TraceBox({
            mins: this.mins,
            maxs: this.maxs,
            start,
            end,
            ignorePlayers: true,
            ignoreEntity: ignoreEntities
        });
        if (!tr || !tr.didHit || tr.normal.z < 0.5) {
            return {
                hit: false,
                hitPos: vec.add(tr.end, vec.scale(tr.normal, surfaceEpsilon)),
                normal: tr.normal
            };
        }
        return {
            hit: true,
            hitPos: vec.add(tr.end, vec.scale(tr.normal, surfaceEpsilon)),
            normal: tr.normal
        };
    }

    /**
     * 尝试上台阶（上→前→下）
     * @param {Vector} start
     * @param {Vector} move
     * @param {number} step
     * @param {Entity[]} ignoreEntities
     */
    tryStep(start, move, step, ignoreEntities) {
        const up = vec.Zfly(start, step);
        const trUp = this.traceMove(start, up, ignoreEntities);
        if (trUp.hit) return { success: false, endPos: trUp.hitPos };

        const forwardEnd = vec.add(up, move);
        const trForward = this.traceMove(up, forwardEnd, ignoreEntities);
        if (trForward.hit) return { success: false, endPos: trUp.hitPos };

        const downEnd = vec.Zfly(forwardEnd, -step);
        const trDown = this.traceMove(forwardEnd, downEnd, ignoreEntities);
        if (!trDown.hit) return { success: false, endPos: trDown.hitPos };
        if (trDown.normal.z < 0.5) return { success: false, endPos: trDown.hitPos };

        return { success: true, endPos: trDown.hitPos };
    }
}
