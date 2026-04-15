/**
 * @module 实体移动/运动模式
 */
import { vec } from "../util/vector";
import { arriveDistance, jumpSpeed, PathState } from "./movement_const";

/**
 * @typedef {import("./motor").Motor} Motor
 * @typedef {import("./path_follower").PathFollower} PathFollower
 * @typedef {import("cs_script/point_script").Entity} Entity
 * @typedef {import("cs_script/point_script").Vector} Vector
 */

/**
 * @typedef {object} LocoContext
 * @property {Motor}        motor
 * @property {PathFollower} pathFollower
 * @property {Vector}       wishDir
 * @property {number}       wishSpeed
 * @property {number}       maxSpeed
 * @property {() => Vector} getPos        获取当前实体位置
 * @property {(name: string, arg?: any) => void} requestModeSwitch  请求切换模式（由 controller 处理）
 */

// ─────────────────── 基类 ───────────────────────────────────
export class MoveMode {
    /** @param {LocoContext} ctx */
    enter(ctx) {}
    /** @param {LocoContext} ctx */
    leave(ctx) {}
    /**
     * @param {LocoContext} ctx
     * @param {number} dt
     * @param {{
     *   entities: Entity[];
    *   spatialIndex: import("../util/spatial_hash").SpatialHashGrid | null;
     *   selfBreakable: Entity | null;
     * }} sepCtx
     * @returns {Vector}
     */
    update(ctx, dt, sepCtx) {return {x:0,y:0,z:0};}
}

// ─────────────────── Walk ───────────────────────────────────
export class MoveWalk extends MoveMode {
    /**
     * @param {LocoContext} ctx
     * @param {number} dt
     * @param {{
     *   entities: Entity[];
    *   spatialIndex: import("../util/spatial_hash").SpatialHashGrid | null;
     *   selfBreakable: Entity | null;
     * }} sepCtx
     * @return {Vector}
     */
    update(ctx, dt, sepCtx) {
        const pos = ctx.getPos();

        // 路径推进
        ctx.pathFollower.advanceIfReached(pos);
        const goal = ctx.pathFollower.getMoveGoal();

        // 路径节点驱动的模式切换请求
        if (goal?.mode === PathState.JUMP) {
            ctx.motor.velocity.z = jumpSpeed;
            ctx.requestModeSwitch("air");
            return pos;
        }
        if (goal?.mode === PathState.LADDER) {
            ctx.motor.velocity.x = 0;
            ctx.motor.velocity.y = 0;
            ctx.motor.velocity.z = 0;
            ctx.requestModeSwitch("ladder");
            return pos;
        }

        computeWish(ctx, goal);

        // 物理推进
        const newPos = ctx.motor.moveGround(pos, ctx.wishDir, ctx.wishSpeed, dt, sepCtx);

        // 离地 → 请求切换到 air
        if (!ctx.motor.isOnGround()) {
            ctx.requestModeSwitch("air");
        }

        return newPos;
    }
}

// ─────────────────── Air ────────────────────────────────────
export class MoveAir extends MoveMode {
    /**
     * @param {LocoContext} ctx
     * @param {number} dt
     * @param {{
     *   entities: Entity[];
    *   spatialIndex: import("../util/spatial_hash").SpatialHashGrid | null;
     *   selfBreakable: Entity | null;
     * }} sepCtx
     * @return {Vector}
     */
    update(ctx, dt, sepCtx) {
        const pos = ctx.getPos();

        ctx.pathFollower.advanceIfReached(pos);
        const goal = ctx.pathFollower.getMoveGoal();
        computeWish(ctx, goal);

        const newPos = ctx.motor.moveAir(pos, ctx.wishDir, ctx.wishSpeed, dt, sepCtx);

        // 落地 → 请求切换回 walk
        if (ctx.motor.velocity.z<30&&ctx.motor.isOnGround()) {
            ctx.motor.velocity.z = 0;
            ctx.requestModeSwitch("walk");
        }

        return newPos;
    }
}

// ─────────────────── Fly ────────────────────────────────────
export class MoveFly extends MoveMode {
    /**
     * @param {LocoContext} ctx
     * @param {number} dt
     * @param {{
     *   entities: Entity[];
    *   spatialIndex: import("../util/spatial_hash").SpatialHashGrid | null;
     *   selfBreakable: Entity | null;
     * }} sepCtx
     * @return {Vector}
     */
    update(ctx, dt, sepCtx) {
        const pos = ctx.getPos();

        ctx.pathFollower.advanceIfReached(pos, 200);
        const goal = ctx.pathFollower.getMoveGoal();

        if (!goal) {
            ctx.motor.velocity = vec.get(0, 0, 0);
            return pos;
        }

        // 飞行模式：3D 方向
        const dir = vec.normalize(vec.sub(goal.pos, pos));
        ctx.wishDir = dir;
        ctx.wishSpeed = ctx.maxSpeed;

        const newPos = ctx.motor.moveFly(pos, dir, ctx.maxSpeed, dt, sepCtx);
        return newPos;
    }
}

// ─────────────────── Ladder ─────────────────────────────
export class MoveLadder extends MoveMode {
    /**
     * @param {LocoContext} ctx
     * @param {number} dt
     * @param {{
     *   entities: Entity[];
    *   spatialIndex: import("../util/spatial_hash").SpatialHashGrid | null;
     *   selfBreakable: Entity | null;
     * }} sepCtx
     * @return {Vector}
     */
    update(ctx, dt, sepCtx) {
        const goal = ctx.pathFollower.getMoveGoal();
        const pos = ctx.getPos();

        if (!goal) {
            ctx.motor.velocity = vec.get(0, 0, 0);
            return pos;
        }
        if (goal.mode !== PathState.LADDER) {
            ctx.motor.velocity.z = jumpSpeed;
            ctx.requestModeSwitch("air");
            return pos;
        }

        const newPos = ctx.motor.moveLadder(pos, goal.pos, ctx.maxSpeed, dt, sepCtx);
        ctx.pathFollower.advanceIfReached(newPos);
        return newPos;
    }
}

// ─────────────────── 期望方向计算（共用）─────────────────────
/**
 * @param {LocoContext} ctx
 * @param {{ pos: Vector; mode: number } | null} goal
 */
function computeWish(ctx, goal) {
    if (!goal) {
        ctx.wishDir = vec.get(0, 0, 0);
        ctx.wishSpeed = ctx.maxSpeed;
        return;
    }
    const pos = ctx.getPos();
    const toGoal = vec.sub(goal.pos, pos);
    const dist = vec.lengthsq(toGoal);

    if (goal.mode === PathState.JUMP) {
        if (dist <= arriveDistance * arriveDistance) {
            ctx.wishDir = vec.get(0, 0, 0);
            ctx.wishSpeed = ctx.maxSpeed;
            return;
        }
        ctx.wishDir = vec.normalize(toGoal);
        ctx.wishSpeed = jumpSpeed;
    } else {
        if (dist <= arriveDistance * arriveDistance) {
            ctx.wishDir = vec.get(0, 0, 0);
            ctx.wishSpeed = ctx.maxSpeed;
            return;
        }
        ctx.wishDir = vec.normalize2D(toGoal);
        ctx.wishSpeed = ctx.maxSpeed;
    }
}
