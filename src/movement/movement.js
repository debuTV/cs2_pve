/**
 * @module 实体移动/运动类
 */
import { Instance } from "cs_script/point_script";
import { Motor } from "./motor";
import { MoveProbe } from "./move_probe";
import { PathFollower } from "./path_follower";
import { MovementController } from "./movement_controller";
import { PathState } from "./movement_const";
import { vec } from "../util/vector";

/** @typedef {import("cs_script/point_script").Entity} Entity */
/** @typedef {import("cs_script/point_script").Vector} Vector */

/**
 * @typedef {object} MovementConfig
 * @property {Entity}   entity                             移动实体
 * @property {number}   [speed=120]                        默认移动速度
 * @property {string}   [mode="walk"]                      默认运动模式（walk / air / fly / ladder）
 * @property {boolean}  [usePathfinding=true]              本实例默认是否使用寻路
 * @property {((start: Vector, end: Vector) => {pos: Vector, mode: number}[] | null) | null} [requestPath=null]
 *   寻路回调：接收起终点，返回 {pos, mode}[] 路径数组或 null
 * @property {{ gravity?: number; friction?: number; stepHeight?: number; turnSpeed?: number;
 *   mins?: Vector; maxs?: Vector }} [physics]             可选物理常量覆盖
 */

/**
 * @typedef {object} MoveTask
 * @property {Vector}   target          终点坐标
 * @property {boolean}  [usePathfinding] 本次任务是否使用寻路（覆盖默认值）
 * @property {boolean}  [accelerate]    是否加速（预留，默认 true）
 * @property {number}   [speed]         本次任务速度（覆盖默认）
 * @property {Vector}   [initialVelocity] 本次任务起始速度；可用于飞扑/投掷等锁定 air 段
 * @property {string}   [mode]          本次任务初始模式（覆盖默认，可传 walk / air / fly / ladder）
 */

/**
 * 独立运动门面类。
 *
 * 职责：
 * 1. 管理实体的移动生命周期（startMove → update → stop）
 * 2. 内聚 Motor / PathFollower / MovementController，对外只暴露简洁 API
 * 3. 寻路解耦：通过 requestPath 回调获取路径，不直接依赖 navmesh
 *
 * 用法示例：
 * ```js
 * const mv = new Movement({
 *     entity: myEntity,
 *     speed: 150,
 *     requestPath: (start, end) => myNavmesh.findPath(start, end)
 * });
 * mv.startMove({ target: { x: 100, y: 200, z: 0 } });
 * // 每帧
 * mv.update(dt, sepCtx);
 * ```
 */
export class Movement {
    /**
     * @param {MovementConfig} config
     */
    constructor(config) {
        this.entity = config.entity;

        // ── 默认配置 ──
        this._defaultSpeed = config.speed ?? 120;
        this._defaultMode = config.mode ?? "walk";
        this._defaultUsePathfinding = config.usePathfinding ?? true;
        this._requestPath = config.requestPath ?? null;

        // ── 当前任务状态 ──
        /** @type {Vector | null} */
        this._target = null;
        this._usePathfinding = this._defaultUsePathfinding;
        this._isStopped = true;
        this._currentYaw = 0;

        // ── 内部组件 ──
        const physicsConf = config.physics ?? {};
        this._probe = new MoveProbe({ mins: physicsConf.mins, maxs: physicsConf.maxs });
        this._motor = new Motor({
            gravity: physicsConf.gravity,
            friction: physicsConf.friction,
            stepHeight: physicsConf.stepHeight,
            turnSpeed: physicsConf.turnSpeed,
            probe: this._probe
        });
        this._pathFollower = new PathFollower();

        // ── LocoContext（由 controller & modes 共享）──
        /** @type {import("./move_mode").LocoContext} */
        this._ctx = {
            motor: this._motor,
            pathFollower: this._pathFollower,
            wishDir: vec.get(0, 0, 0),
            wishSpeed: 0,
            maxSpeed: this._defaultSpeed,
            getPos: () => vec.clone(this.entity.GetAbsOrigin()),
            requestModeSwitch: () => {} // 由 controller 绑定
        };

        this._controller = new MovementController(this._ctx);
        this._controller.setMode(this._defaultMode);

        // portal 防重入
        this._lastPortalAt = -999;
    }

    // ═══════════════════ 公共 API ═══════════════════════════

    /**
     * 开始一个移动任务
     * @param {MoveTask} task
     */
    startMove(task) {
        this._target = vec.clone(task.target);
        this._isStopped = false;
        this._ctx.maxSpeed = task.speed ?? this._defaultSpeed;
        this._usePathfinding = task.usePathfinding ?? this._defaultUsePathfinding;
        if (task.initialVelocity) {
            this._motor.velocity = vec.clone(task.initialVelocity);
        }

        if (task.mode) {
            this._controller.setMode(task.mode);
        }

        // 如果启用寻路，立即请求一次路径
        if (this._usePathfinding) {
            this.refreshPath();
        } else {
            // 不寻路：建一条直达路径（单节点，WALK 模式）
            this._pathFollower.setPath([{ pos: this._target, mode: PathState.WALK }]);
        }
    }

     /**
      * 每帧更新（唯一驱动入口）
      * @param {number} dt         帧间隔（秒）
      * @param {{
      *   entities: Entity[];
      *   spatialIndex: import("../spatialHash/spatial_hash").SpatialHashGrid | null;
      *   selfBreakable: Entity | null;
      * }} sepCtx 分离上下文
      * @returns {Vector | undefined}
      */
    update(dt, sepCtx) {
        if (this._isStopped) return;

        // PORTAL 特殊处理（在常规 controller 之前）
        if (this._handlePortal()) {
            return this.entity.GetAbsOrigin();
        }

        // 更新 maxSpeed（支持运行时改速度后生效）
        // controller → mode → motor
        const newPos = this._controller.update(dt, sepCtx);

        // 传送实体到新位置
        if (newPos) {
            const facingDir = vec.length2Dsq(this._ctx.wishDir) > 0.1
                ? this._ctx.wishDir
                : vec.normalize2D(this._motor.getVelocity());

            this._currentYaw = this._motor.computeYaw(facingDir, this._currentYaw, dt);
            this.entity.Teleport({
                position: newPos,
                angles: { pitch: 0, yaw: this._currentYaw, roll: 0 }
            });
            return newPos;
        }
    }

    /**
     * 刷新路径（外部决定调用时机）。
     * 调用时会用当前实体位置和 _target 向 requestPath 回调请求新路径。
     * @returns {boolean} 是否成功刷新
     */
    refreshPath() {
        if (!this._requestPath || !this._target) return false;
        if (this._motor.isStuck()) return false; // 卡死时不刷新（可选策略）
        const start = this.entity.GetAbsOrigin();
        const path = this._requestPath(start, this._target);
        if (!path) return false;
        // 确保终点在路径末尾
        path.push({ pos: vec.clone(this._target), mode: PathState.WALK });
        this._pathFollower.setPath(path);
        return true;
    }

    /**
     * 直接设置路径（跳过 requestPath 回调）
     * @param {{ pos: Vector; mode: number }[]} path
     */
    setPath(path) {
        this._pathFollower.setPath(path);
    }

    /** 获取当前路径快照（返回拷贝，外部修改后需重新 setPath） */
    getPath() {
        return this._pathFollower.path.map(node => ({
            pos: vec.clone(node.pos),
            mode: node.mode
        }));
    }

    /**
     * 更新目标坐标（不自动重算路径，需外部调用 refreshPath）
     * @param {Vector} target
     */
    setTarget(target) {
        this._target = vec.clone(target);
    }

    /**
     * 设置移动速度
     * @param {number} speed
     */
    setSpeed(speed) {
        this._ctx.maxSpeed = speed;
    }

    /**
     * 直接设置当前速度；飞扑/投掷等锁定 air 段使用这个接口
     * @param {Vector} velocity
     */
    setVelocity(velocity) {
        this._motor.velocity = vec.clone(velocity);
    }

    /** 获取当前速度快照 */
    getVelocity() {
        return this._motor.getVelocity();
    }

    /**
     * 外部强制切换运动模式
     * @param {string} name  "walk" | "air" | "fly" 或自定义注册名
     * @param {any} [arg]
     */
    setMode(name, arg) {
        this._controller.setMode(name, arg);
    }

    /**
     * 运行时注册自定义模式
     * @param {string} name
     * @param {import("./move_mode").MoveMode} mode
     */
    registerMode(name, mode) {
        this._controller.registerMode(name, mode);
    }

    /** 停止移动 */
    stop() {
        this._isStopped = true;
        this._ctx.wishDir = vec.get(0, 0, 0);
        this._ctx.wishSpeed = 0;
        this._motor.stop();
    }

    /** 恢复移动 */
    resume() {
        this._isStopped = false;
    }

    /** 清空路径 */
    clearPath() {
        this._pathFollower.clear();
    }

    /** 获取当前状态快照 */
    getState() {
        const currentGoal = this._pathFollower.getMoveGoal();
        return {
            mode: this._controller.currentName,
            onGround: this._motor.isOnGround(),
            currentGoalMode: currentGoal?.mode ?? null
        };
    }

    /** 路径是否走完 */
    isPathFinished() {
        return this._pathFollower.isFinished();
    }

    /** 是否在地面 */
    isOnGround() {
        return this._motor.isOnGround();
    }

    /** 是否正在移动 */
    isMoving() {
        return !this._isStopped && this._ctx.wishSpeed > 0;
    }

    // ═══════════════════ 内部方法 ═══════════════════════════

    /**
     * PORTAL 节点处理（在 controller.update 之前调用）
     * @returns {boolean} true 表示本帧跳过常规移动
     */
    _handlePortal() {
        const goal = this._pathFollower.getMoveGoal();
        if (!goal || goal.mode !== PathState.PORTAL) return false;

        const now = Instance.GetGameTime();
        if (now - this._lastPortalAt < 0.5) {
            this._pathFollower.advancePortal();
            return true;
        }
        this._lastPortalAt = now;

        this.entity.Teleport({ position: goal.pos, velocity: { x: 0, y: 0, z: 0 } });
        this._motor.velocity = vec.get(0, 0, 0);
        this._pathFollower.advancePortal();
        return true;
    }
}
