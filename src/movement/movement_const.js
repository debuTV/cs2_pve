/**
 * @module 实体移动/常量配置
 */
// ── 运动模块内聚常量─────────────────

/** 世界重力 (hu/s²) */
export const gravity = 800;
/** 跳跃过程速度 (hu/s) */
export const jumpSpeed = 450;
/** 地面摩擦系数 */
export const friction = 6;
/** 爬台阶高度 (hu) */
export const stepHeight = 13;
/** 路径节点到达判定距离 (hu) */
export const goalTolerance = 20;
/** 终点到达判定距离 (hu) */
export const arriveDistance = 1;
/** 转向速度 (度/s) */
export const turnSpeed = 360;
/** movement.update 最多拆成多少个轮转分片。 */
export const movementUpdateShardCount = 1;
/** 异常长帧时单个实体单次最多消费多少累计 dt (s)。 */
export const movementMaxAccumulatedDt = 0.25;
/** 真实地面检测最小间隔 (s)，沿用原 64Hz 下每 8 tick 的语义。 */
export const groundUpdateInterval = 8 / 64;

// ── 碰撞相关 ────────────────────────────────────────────────
/** 碰撞盒最小点 */
export const traceMins = { x: -4, y: -4, z: 1 };
/** 碰撞盒最大点 */
export const traceMaxs = { x: 4, y: 4, z: 4 };
/** 地面检测向下扫描距离 (hu) */
export const groundCheckDist = 8;
/** 碰撞面安全偏移距离 (hu) */
export const surfaceEpsilon = 4;

// ── 怪物群体分离 ───────────────────────────────────────────
/** 怪物之间开始相互推开的 2D 半径 (hu)。
 * 该值需要和实际怪物占用尺寸一致，否则会出现视觉上重叠但没有分离的情况。
 */
export const separationRadius = 32;
/** 分离力满额生效的近距离半径 (hu) */
export const separationMinRadius = 24;
/** 最大分离速度 (hu/s) */
export const separationMaxStrength = 120;

// ── 卡死检测 ────────────────────────────────────────────────
/** 低于此距离认为没动 (hu) */
export const moveEpsilon = 0.5;
/** 持续多久算卡死 (s) */
export const stuckTimeThreshold = 2;

// ── 路径节点类型 ────────────────────────────────────────────
/** @enum {number} */
export const PathState = {
    WALK: 1,
    JUMP: 2,
    LADDER: 3,
    PORTAL: 4
};
