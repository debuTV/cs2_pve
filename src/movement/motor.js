/**
 * @module 实体移动/运动电机
 */
import { Instance } from "cs_script/point_script";
import { vec } from "../util/vector";
import { MoveProbe } from "./move_probe";
import {
    friction as defaultFriction,
    gravity as defaultGravity,
    groundUpdateInterval,
    stepHeight as defaultStepHeight,
    turnSpeed as defaultTurnSpeed,
    separationRadius,
    separationMinRadius,
    separationMaxStrength,
    moveEpsilon,
    stuckTimeThreshold
} from "./movement_const";

/** @typedef {import("cs_script/point_script").Vector} Vector */
/** @typedef {import("cs_script/point_script").Entity} Entity */

const SEPARATION_RADIUS = separationRadius;
const SEPARATION_MAX_STRENGTH = separationMaxStrength;
const SEPARATION_MAX_STRENGTH_SQ = SEPARATION_MAX_STRENGTH * SEPARATION_MAX_STRENGTH;
const SEPARATION_MIN_RADIUS_SQ = separationMinRadius * separationMinRadius;
const SEPARATION_RADIUS_SQ = SEPARATION_RADIUS * SEPARATION_RADIUS;
const SEPARATION_FALLOFF_RANGE_SQ = Math.max(1e-6, SEPARATION_RADIUS_SQ - SEPARATION_MIN_RADIUS_SQ);
const SEPARATION_MIN_DIST_SQ = 16;

/**
 * @typedef {object} SeparationContext
 * @property {Entity[]} entities
 * @property {import("../util/spatial_hash").SpatialHashGrid | null} spatialIndex
 * @property {Entity | null} selfBreakable
 */

/**
 * 运动电机：负责速度、重力、碰撞检测、地面吸附和位移推进。
 * 不感知任何业务语义（monster / path / mode 等）。
 *
 * 与旧 AIMotor 的区别：
 * - 不持有 Entity 引用，不调用 Teleport / GetAbsOrigin
 * - 所有方法接收当前位置、返回新位置，实际传送由门面层统一执行
 */
export class Motor {
    /**
     * @param {{
     *   gravity?: number;
     *   friction?: number;
     *   stepHeight?: number;
     *   turnSpeed?: number;
     *   probe?: MoveProbe;
     * }} [config]
     */
    constructor(config = {}) {
        this.gravity = config.gravity ?? defaultGravity;
        this.friction = config.friction ?? defaultFriction;
        this.stepHeight = config.stepHeight ?? defaultStepHeight;
        this.turnSpeed = config.turnSpeed ?? defaultTurnSpeed;
        this.probe = config.probe ?? new MoveProbe();

        /** @type {Vector} */
        this.velocity = vec.get(0, 0, 0);
        this.onGround = false;
        this.wasOnGround = false;
        /** @type {{ hit: boolean; normal: Vector; point: Vector }} */
        this.ground = { hit: false, normal: vec.get(0, 0, 0), point: vec.get(0, 0, 0) };

        // ── 卡死检测 ──
        this._stuckLastPos = vec.get(0, 0, 0);
        this._stuckTime = 0;
        this._groundUpdateCooldown = 0;
    }

    // ───────────────────── 公共运动方法 ─────────────────────

    /**
     * 地面移动：摩擦→加速→分离→Step/Slide→贴地
     * @param {Vector} pos       当前位置
     * @param {Vector} wishDir   期望方向（单位向量）
     * @param {number} wishSpeed 期望速度
     * @param {number} dt        帧间隔
     * @param {SeparationContext} sepCtx 分离上下文
     * @returns {Vector} 新位置
     */
    moveGround(pos, wishDir, wishSpeed, dt, sepCtx) {
        this._applyFriction(dt);
        this._accelerate2D(wishDir, wishSpeed, dt);
        this.velocity = vec.add(this.velocity, this._computeSeparation(pos, sepCtx));

        const move = vec.scale(this.velocity, dt);
        move.z = 0;

        let newPos = this._stepSlideMove(pos, move, sepCtx.entities).pos;
        const didUpdateGround = this._updateGround(newPos, sepCtx.entities, dt);
        if (didUpdateGround) {
            newPos = this._snapToGround(newPos);
        }
        this._updateStuck(newPos, dt);
        return newPos;
    }

    /**
     * 空中移动：弱方向控制 + 重力
     * @param {Vector} pos
     * @param {Vector} wishDir
     * @param {number} wishSpeed
     * @param {number} dt
    * @param {SeparationContext} sepCtx 分离上下文
     * @returns {Vector}
     */
    moveAir(pos, wishDir, wishSpeed, dt, sepCtx) {
        // 空中方向控制：直接把水平速度对齐到目标速度
        if (wishSpeed > 0) {
            this.velocity.x = wishDir.x * wishSpeed;
            this.velocity.y = wishDir.y * wishSpeed;
        }
        // 重力
        this.velocity.z = Math.max(-this.gravity, this.velocity.z - this.gravity * dt);
        // 分离
        //this.velocity = vec.add(this.velocity, this._computeSeparation(pos, sepCtx));

        const move = vec.scale(this.velocity, dt);
        const result = this._airSlideMove(pos, move, sepCtx.entities);
        let newPos = result.pos;
        if (result.clipNormals.length) {
            for (const n of result.clipNormals) {
                this.velocity = this._clipVelocity(this.velocity, n);
            }
        }
        this._updateGround(newPos, sepCtx.entities, dt);
        this._updateStuck(newPos, dt);
        return newPos;
    }

    /**
     * 飞行移动：3D 加速，无重力
     * @param {Vector} pos
     * @param {Vector} wishDir
     * @param {number} wishSpeed
     * @param {number} dt
      * @param {SeparationContext} sepCtx 分离上下文
     * @returns {Vector}
     */
    moveFly(pos, wishDir, wishSpeed, dt, sepCtx) {
        this._accelerate3D(wishDir, wishSpeed, dt);
          this.velocity = vec.add(this.velocity, this._computeSeparation(pos, sepCtx));

        const move = vec.scale(this.velocity, dt);
        const result = this._airSlideMove(pos, move, sepCtx.entities);
        let newPos = result.pos;
        if (result.clipNormals.length) {
            for (const n of result.clipNormals) {
                this.velocity = this._clipVelocity(this.velocity, n);
            }
        }
        this.onGround = false;
        this._groundUpdateCooldown = 0;
        this._updateStuck(newPos, dt);
        return newPos;
    }

    /**
     * 梯子移动：XY 方向快速贴近目标，Z 方向缓慢变化。
     * @param {Vector} pos
     * @param {Vector} goalPos
     * @param {number} baseSpeed
     * @param {number} dt
    * @param {SeparationContext} sepCtx 分离上下文
     * @returns {Vector}
     */
    moveLadder(pos, goalPos, baseSpeed, dt, sepCtx) {
        const toGoal = vec.sub(goalPos, pos);
        const horizontalDelta = vec.get(toGoal.x, toGoal.y, 0);
        const horizontalDist = vec.length2D(horizontalDelta);
        const horizontalDir = vec.normalize2D(horizontalDelta);
        const horizontalSpeed = horizontalDist <= 4
            ? 0
            : Math.min(220, Math.max(baseSpeed * 1.5, horizontalDist * 8));
        const verticalSpeed = Math.abs(toGoal.z) <= 4
            ? 0
            : Math.sign(toGoal.z) * Math.min(96, Math.max(48, Math.abs(toGoal.z) * 2));

        this.velocity = vec.get(
            horizontalDir.x * horizontalSpeed,
            horizontalDir.y * horizontalSpeed,
            verticalSpeed
        );

        const move = vec.scale(this.velocity, dt);
        const result = this._airSlideMove(pos, move, sepCtx.entities);
        let newPos = result.pos;
        if (result.clipNormals.length) {
            for (const n of result.clipNormals) {
                this.velocity = this._clipVelocity(this.velocity, n);
            }
        }
        this.onGround = false;
        this._groundUpdateCooldown = 0;
        this._updateStuck(newPos, dt);
        return newPos;
    }

    stop() {
        this.velocity = vec.get(0, 0, 0);
        this._groundUpdateCooldown = 0;
    }
    isOnGround() { return this.onGround; }
    getVelocity() { return vec.clone(this.velocity); }

    /**
     * 计算朝向（yaw 角度）
     * @param {Vector} wishDir
     * @param {number} currentYaw 当前 yaw (度)
     * @param {number} dt
     * @returns {number} 新 yaw
     */
    computeYaw(wishDir, currentYaw, dt) {
        if (vec.length2Dsq(wishDir) < 0.1) return currentYaw;
        const targetYaw = Math.atan2(wishDir.y, wishDir.x) * 180 / Math.PI;
        let delta = targetYaw - currentYaw;
        while (delta > 180) delta -= 360;
        while (delta < -180) delta += 360;
        const maxStep = this.turnSpeed * dt;
        if (delta > maxStep) delta = maxStep;
        else if (delta < -maxStep) delta = -maxStep;
        return currentYaw + delta;
    }

    isStuck() { return this._stuckTime >= stuckTimeThreshold; }

    // ───────────────────── 内部方法 ─────────────────────────

    /** @param {number} dt */
    _applyFriction(dt) {
        if (vec.length2Dsq(this.velocity) < 0.1) return;
        const frictionScale = Math.max(0, 1 - this.friction * dt);
        this.velocity = vec.scale2D(this.velocity, frictionScale);
    }

    /** @param {Vector} wishDir @param {number} wishSpeed @param {number} dt */
    _accelerate2D(wishDir, wishSpeed, dt) {
        if (wishSpeed <= 0) return;
        const currentSpeed = vec.dot2D(this.velocity, wishDir);
        const addSpeed = wishSpeed - currentSpeed;
        if (addSpeed <= 0) return;
        const accelSpeed = Math.min(addSpeed, wishSpeed * dt * 10);
        this.velocity = vec.add2D(this.velocity, vec.scale(wishDir, accelSpeed));
    }

    /** @param {Vector} wishDir @param {number} wishSpeed @param {number} dt */
    _accelerate3D(wishDir, wishSpeed, dt) {
        if (wishSpeed <= 0) return;
        const currentSpeed = vec.dot(this.velocity, wishDir);
        const addSpeed = wishSpeed - currentSpeed;
        if (addSpeed <= 0) return;
        const accel = wishSpeed * dt * 10;
        const accelSpeed = Math.min(addSpeed, accel);
        this.velocity = vec.add(this.velocity, vec.scale(wishDir, accelSpeed));
    }

    /**
     * NPC-NPC 分离速度（基于空间索引查询 breakable 邻居）
     * @param {Vector} pos 当前怪物位置
     * @param {SeparationContext} sepCtx 分离上下文
     * @returns {Vector}
     */
    _computeSeparation(pos, sepCtx) {
        if (!sepCtx.spatialIndex) return vec.get(0, 0, 0);

        let sep = vec.get(0, 0, 0);
        let hitCount = 0;

        const accumulateNeighbor = (/** @type {{ entity?: import("cs_script/point_script").Entity; position: any; }} */ neighbor) => {
            const otherPos = neighbor.position;
            let delta = vec.sub(pos, otherPos);
            const dist2Dsq = vec.length2Dsq(delta);
            if (dist2Dsq < SEPARATION_MIN_DIST_SQ || vec.lengthsq(delta) > SEPARATION_RADIUS_SQ) return;
            delta.z = 0;
            const l1 = Math.abs(delta.x) + Math.abs(delta.y);
            if (l1 < 1e-6) return;
            const dir = vec.scale(delta, 1 / l1);
            let strength = 1.0;
            if (dist2Dsq > SEPARATION_MIN_RADIUS_SQ) {
                const t = Math.min(1, (dist2Dsq - SEPARATION_MIN_RADIUS_SQ) / SEPARATION_FALLOFF_RANGE_SQ);
                strength = 1 - t * t * (3 - 2 * t);
            }
            sep = vec.add(sep, vec.scale(dir, strength * SEPARATION_MAX_STRENGTH));
            hitCount += 1;
        };

        if (typeof sepCtx.spatialIndex.forEachInSphere === "function") {
            sepCtx.spatialIndex.forEachInSphere(pos, SEPARATION_RADIUS, accumulateNeighbor, {
                excludeEntity: sepCtx.selfBreakable,
            });
        } else {
            const neighbors = sepCtx.spatialIndex.querySphere(pos, SEPARATION_RADIUS, {
                excludeEntity: sepCtx.selfBreakable,
            });
            for (let i = 0; i < neighbors.length; i++) {
                accumulateNeighbor(neighbors[i]);
            }
        }

        if (hitCount === 0) return vec.get(0, 0, 0);

        const lenSq = vec.length2Dsq(sep);
        if (lenSq > SEPARATION_MAX_STRENGTH_SQ) sep = vec.scale(sep, SEPARATION_MAX_STRENGTH_SQ / lenSq);
        return sep;
    }

    /**
     * Step + Slide（地面碰撞处理）
     * @param {Vector} start
     * @param {Vector} move
     * @param {Entity[]} allm
     */
    _stepSlideMove(start, move, allm) {
        const end = vec.add(start, move);
        const direct = this.probe.traceMove(start, end, allm);
        if (!direct.hit) return { pos: direct.endPos };

        const step = this.probe.tryStep(start, move, this.stepHeight, allm);
        if (step.success) return { pos: step.endPos };

        const MAX_CLIPS = 2;
        let remaining = vec.clone(move);
        const clipNormals = [];
        let pos = start;
        for (let i = 0; i < MAX_CLIPS; i++) {
            if (vec.length2Dsq(remaining) < 0.1) break;
            const endPos = vec.add(pos, remaining);
            const tr = this.probe.traceMove(pos, endPos, allm);
            if (!tr.hit) return { pos: tr.endPos };
            pos = tr.hitPos;
            clipNormals.push(vec.clone(tr.normal));
            remaining = vec.scale(remaining, 1 - tr.fraction);
            remaining = this._clipMoveByNormals(remaining, clipNormals);
        }
        return { pos };
    }

    /**
     * 空中 Slide（TryPlayerMove 风格）
     * @param {Vector} start
     * @param {Vector} move
     * @param {Entity[]} allm
     */
    _airSlideMove(start, move, allm) {
        const MAX_CLIPS = 2;
        let remaining = vec.clone(move);
        /** @type {Vector[]} */
        const clipNormals = [];
        let pos = start;

        for (let i = 0; i < MAX_CLIPS; i++) {
            if (vec.lengthsq(remaining) < 0.1) break;
            const endPos = vec.add(pos, remaining);
            const tr = this.probe.traceMove(pos, endPos, allm);
            if (!tr.hit) return { pos: tr.endPos, clipNormals };
            pos = tr.hitPos;
            clipNormals.push(vec.clone(tr.normal));
            remaining = vec.scale(remaining, 1 - tr.fraction);
            remaining = this._clipMoveByNormals(remaining, clipNormals);
        }
        return { pos, clipNormals };
    }

    /**
     * @param {Vector} move
     * @param {Vector[]} normals
     */
    _clipMoveByNormals(move, normals) {
        let out = vec.clone(move);
        for (const n of normals) {
            const dot = vec.dot2D(out, n);
            if (dot < 0) out = vec.sub(out, vec.scale(n, dot));
        }
        return out;
    }

    /**
     * Source ClipVelocity
     * @param {Vector} vel
     * @param {Vector} normal
     * @param {number} [overbounce]
     */
    _clipVelocity(vel, normal, overbounce = 1.01) {
        const backoff = vec.dot(vel, normal);
        if (backoff >= 0) return vec.clone(vel);
        const change = vec.scale(normal, backoff * overbounce);
        const out = vec.sub(vel, change);
        if (Math.abs(out.x) < 0.0001) out.x = 0;
        if (Math.abs(out.y) < 0.0001) out.y = 0;
        if (Math.abs(out.z) < 0.0001) out.z = 0;
        return out;
    }

    /** @param {Vector} pos */
    _snapToGround(pos) {
        if (!this.wasOnGround || !this.onGround || this.velocity.z < -1 || !this.ground.hit) return pos;
        const dz = this.ground.point.z - pos.z;
        if (Math.abs(dz) > 4) return pos;
        pos.z = this.ground.point.z;
        return pos;
    }

    /**
     * @param {Vector} pos
     * @param {Entity[]} allm
     * @param {number} dt
     * @returns {boolean}
     */
    _updateGround(pos, allm, dt) {
        this._groundUpdateCooldown = Math.max(0, this._groundUpdateCooldown - Math.max(0, dt));
        if (this._groundUpdateCooldown > 1e-6) {
            return false;
        }
        this._groundUpdateCooldown = groundUpdateInterval;

        const tr = this.probe.traceGround(pos, allm);
        this.wasOnGround = this.onGround;
        this.ground.hit = false;
        if (!tr.hit || !tr.hitPos) {
            this.onGround = false;
            return true;
        }
        if (tr.normal.z < 0.5) {
            this.onGround = false;
            return true;
        }
        this.onGround = true;
        this.ground.hit = true;
        this.ground.normal = vec.clone(tr.normal);
        this.ground.point = vec.clone(tr.hitPos);
        return true;
    }

    /**
     * 卡死检测 + 解卡
     * @param {Vector} pos
     * @param {number} dt
     */
    _updateStuck(pos, dt) {
        const moved = vec.lengthsq(vec.sub(pos, this._stuckLastPos));
        if (moved < moveEpsilon*moveEpsilon) { this._stuckTime += dt; } else { this._stuckTime = 0; }
        this._stuckLastPos = vec.clone(pos);
        // 不做自动解卡，由外层处理
    }
}
