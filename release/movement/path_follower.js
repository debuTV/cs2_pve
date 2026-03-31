/**
 * @module 实体移动/路径跟随器
 */
import { vec } from "../util/vector";
import { goalTolerance } from "./movement_const";

/**
 * 路径游标：维护 {pos, mode}[] 路径数组与当前 cursor，
 * 提供 setPath / getMoveGoal / advanceIfReached 等接口。
 */
export class PathFollower {
    constructor() {
        /** @type {{ pos: import("cs_script/point_script").Vector; mode: number }[]} */
        this.path = [];
        this.cursor = 0;
    }

    /** @param {{ pos: import("cs_script/point_script").Vector; mode: number }[]} path */
    setPath(path) {
        this.path = path.map(n => ({ pos: vec.clone(n.pos), mode: n.mode }));
        this.cursor = 0;
    }

    isFinished() {
        return this.path.length === 0 || this.cursor >= this.path.length;
    }

    clear() {
        this.path = [];
        this.cursor = 0;
    }

    /** 获取当前目标节点（可能为 null） */
    getMoveGoal() {
        if (this.isFinished()) return null;
        return this.path[this.cursor];
    }

    /**
     * 如果足够接近当前目标节点则推进 cursor
     * @param {import("cs_script/point_script").Vector} currentPos
     * @param {number} [tolerance]
     */
    advanceIfReached(currentPos, tolerance = goalTolerance) {
        while (!this.isFinished()) {
            const goal = this.getMoveGoal();
            if (!goal) return;
            if (vec.lengthsq(vec.sub(currentPos, goal.pos)) <= tolerance * tolerance) {
                this.cursor++;
                continue;
            }
            break;
        }
    }

    /** PORTAL 节点专用推进 */
    advancePortal() {
        if (!this.isFinished()) this.cursor++;
    }
}
