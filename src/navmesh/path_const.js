/**
 * @module 导航网格/常量与工具
 */
import { Instance } from "cs_script/point_script";
/** @typedef {import("cs_script/point_script").Vector} Vector */
/** @typedef {import("cs_script/point_script").Color} Color */
/**
 * 导航路径节点状态枚举，表示到达下一个点时应采用的移动方式。
 * - `WALK(1)`：直线行走
 * - `JUMP(2)`：跳跃
 * - `LADDER(3)`：爬梯子（持续到下一个非梯子点）
 * - `PORTAL(4)`：传送门瞬移
 *
 * NavMesh 寻路结果数组中每个节点的 `mode` 字段即为此类型。
 */
export const PathState = {
    WALK: 1,
    JUMP: 2,
    LADDER: 3,
    PORTAL: 4
};
//==============================对外脚本接口=========================================
/**
 * update(pos);         //实时更新pos所在tile，平均tile构建会最多卡1秒，减少tile大小或者增加体素大小均可改善
 * findPath(start,end); //寻路，返回路径点数组，路径点格式：{pos:Vector,mode:number}，mode是PathState类型,表示到下一个点的移动方式
 * debug(time);         //调试工具，持续time秒
 * init();              //初始化生成整个导航网格
 * tick();              //每帧需要运行的代码，包括debugtile时的tile文本等
 */
//==============================插件设置（对实体支持OnScriptInput）===============
/**
 * addtile();           //将caller所设置的tile的当前状态添加到备选数据列表中，并输出整个data
 * settile();           //将caller所设置的tile设置为备选的tile数据
 * 例如调用addtile的时候，caller名字叫“navmesh_aaabbbCCC_1-2_2-3”,那tile就是1-2和2-3,数据名称就是aaabbbCCC,前面的`navmesh_`必须要有,
 * 调用settile的时候，如果caller名字叫“navmesh_aaabbbCCC_1-2”，就只会把1-2tile上的名字叫aaabbbCCC的数据设置到1-2上
 * 调用settile的时候，如果caller名字叫“navmesh_default_1-2”，就会把1-2tile上的navmeshstatic数据设置到1-2上
 * settile不存在则自动生成
 * 
 * 用法：当门打开时，对一个infotarget输入FireUser1，info里面再对脚本输入settile或者addtile，这时候名字需要设置在info上；门关上时需要对另一个info输入
 */
/** 是否启用 NavMesh 插件系统（tile 动态替换 / `OnScriptInput` 交互）。 */
export const PLUGIN_ENABLED = false;
//==============================世界相关设置=====================================
/** NavMesh 世界左下角原点坐标（体素空间的 (0,0,0) 对应的世界坐标）。 */
export const origin = { x: -2500, y: -820, z: 1080 };
/** 体素水平方向尺寸（单位）。越小精度越高，构建越慢。 */
export const MESH_CELL_SIZE_XY = 6;
/** 体素垂直方向尺寸（单位）。 */
export const MESH_CELL_SIZE_Z = 1;
/** 体素化射线方块高度（单位）。设置过高会忽略竖直方向的空隙。 */
export const MESH_TRACE_SIZE_Z = 32;
/** NavMesh 世界水平范围大小（单位）。 */
export const MESH_WORLD_SIZE_XY = 4000;
/** NavMesh 世界垂直范围大小（单位）。 */
export const MESH_WORLD_SIZE_Z = 512;
//==============================数据结构设置=====================================
/** 多边形最大数量，受 16 位索引限制（不超过 65535）。 */
export const MAX_POLYS = 65535;
/** 顶点最大数量。 */
export const MAX_VERTS = 65535;
/** 三角形最大数量。 */
export const MAX_TRIS = 65535;
/** 特殊连接点（跳点 / 梯子 / 传送门）的最大数量。 */
export const MAX_LINKS = 4096;
//==============================Recast设置======================================
//其他参数
/** 最大可行走坡度（度），超过此角度的斜面视为不可行走。 */
export const MAX_SLOPE = 65;
/** 怪物最大可行走台阶高度（体素单位）。 */
export const MAX_WALK_HEIGHT = 13 / MESH_CELL_SIZE_Z;
/** 怪物最大可跳跃高度（体素单位）。 */
export const MAX_JUMP_HEIGHT = 65 / MESH_CELL_SIZE_Z;
/** Agent 半径（体素单位），汽化时用于腐蚀和空间判定。 */
export const AGENT_RADIUS = 8 / MESH_CELL_SIZE_XY;
/** Agent 高度（体素单位），用于可行走 span 高度筛选。 */
export const AGENT_HEIGHT = 40 / MESH_CELL_SIZE_Z;
//TILE参数
/** 瓦片边长（体素单位）。每个 tile 包含 `TILE_SIZE×TILE_SIZE` 个体素，过大影响性能，过小增加内存开销。 */
export const TILE_SIZE = 512 / MESH_CELL_SIZE_XY;
/** 瓦片边界填充体素数，防止边缘寻路穿模。必须大于 `MESH_ERODE_RADIUS`。 */
export const TILE_PADDING = AGENT_RADIUS + 1;
/** 优化1：是否修剪 `info_target{name:navmesh}` 无法到达的平台。 */
export const TILE_OPTIMIZATION_1 = true;
//体素化参数
/** 开放高度场腐蚀半径（体素单位），用于收缩可行走区域以避开墙壁。 */
export const MESH_ERODE_RADIUS = AGENT_RADIUS;
//区域生成参数
/** 小于此面积的相邻区域会被合并（体素单位）。 */
export const REGION_MERGE_AREA = 128;
/** 小于此面积的区域将被丢弃（体素单位），0 表示不丢弃。 */
export const REGION_MIN_AREA = 0;
//轮廓生成参数
/** 轮廓简化时原始点到简化边的最大偏离距离（体素距离）。 */
export const CONT_MAX_ERROR = 1.5;
/** 简化后边长上限（体素距离），0 表示不启用。 */
export const CONT_MAX_EDGE_LEN = 0;
// 多边形网格配置
/** 耳割法是否优先切割周长最短的三角形。 */
export const POLY_BIG_TRI = true;
/** 每个多边形的最大顶点数。 */
export const POLY_MAX_VERTS_PER_POLY = 6;
/** 多边形合并时是否优先合并最长公共边。 */
export const POLY_MERGE_LONGEST_EDGE_FIRST = true;
/** 细节网格采样间距，值越小精度越高但耗时越多，推荐 3。 */
export const POLY_DETAIL_SAMPLE_DIST = 3;
/** 细节网格采样点与计算点的高度差小于此阈值时跳过采样。 */
export const POLY_DETAIL_HEIGHT_ERROR = 5;
// LADDER配置
/** 是否检测地图中的梯子实体。需要成对放置 `info_target{name:navmesh_LADDER_i}`，两个实体的 `i` 后缀必须相同。 */
export const LADDER=true;
//生成参数
/** 是否在控制台打印导航网格数据。 */
export const PRINT_NAV_MESH = false;
/** 是否载入预先烘焙的静态导航网格。开启时无法使用一次性 debug 工具。 */
export const LOAD_STATIC_MESH = true;
//==============================Debug设置=======================================
// --- 一次性 debug 工具（持续 300 秒，需重新 init 才能再次调用） ---
/** 显示体素化后的体素（一次性）。 */
export const MESH_DEBUG = false;
/** 显示区域划分结果（一次性）。 */
export const REGION_DEBUG = false;
/** 显示简化后的轮廓（一次性）。 */
export const CONTOUR_DEBUG = false;
// --- 可重复 debug 工具（持续 60 秒，可反复调用） ---
/** 显示瓦片边界并通过 debugtext 显示所在瓦片 ID（可重复）。 */
export const TILE_DEBUG = false;
/** 显示最终的寻路多边形（可重复）。 */
export const POLY_DEBUG = false;
/** 显示细节多边形（可重复）。 */
export const POLY_DETAIL_DEBUG = false;
/** 显示特殊连接点（跳点 / 梯子 / 传送门）（可重复）。 */
export const LINK_DEBUG = false;
/** 载入静态数据时用于检查导入是否成功（可重复）。 */
export const LOAD_DEBUG = false;
//==============================Detour设置======================================
//A*寻路参数
/** 特殊连接点的寻路代价系数，越大越不倾向使用特殊点。 */
export const OFF_MESH_LINK_COST_SCALE=1;
/** A* 寻路时多边形空间分块大小。 */
export const ASTAR_BLOCK_SIZE = 128;
/** A* 启发式估价缩放系数，推荐 1.0–1.5。 */
export const ASTAR_HEURISTIC_SCALE = 1.2;
//Funnel参数
/** Funnel 路径拉直时距多边形边缘的最小距离百分比（0–100，100% 表示只能走边的中点）。 */
export const FUNNEL_DISTANCE = 0;
//高度修正参数//一般不需要，除非移动是平移过去
/** 是否启用路径高度修正（一般不需要，除非移动类型是平移）。 */
export const ADJUST_HEIGHT=false;
/** 高度修正时每隔此距离插入一个采样点（单位）。 */
export const ADJUST_HEIGHT_DISTANCE = 50;

/**
 * 返回一个随机的颜色
 * @returns {Color}
 */
export function getRandomColor() {
    return {
        r: Math.floor(Math.random() * 255),
        g: Math.floor(Math.random() * 255),
        b: Math.floor(Math.random() * 255),
        a: 255
    };
}
/**
 * 根据体素(i,j,k)坐标返回世界(x,y,z)坐标
 * @param {number} i
 * @param {number} j
 * @param {number} k
 * @returns {Vector}
 */
export function getpos(i, j, k) {
    return { x: origin.x + i * MESH_CELL_SIZE_XY, y: origin.y + j * MESH_CELL_SIZE_XY, z: origin.z + k * MESH_CELL_SIZE_Z }
}
/**
 * 得到体素左下角的世界坐标
 * @param {Vector} pos
 * @returns {Vector}
 */
export function getmins(pos) {
    return { x: pos.x - MESH_CELL_SIZE_XY / 2, y: pos.y - MESH_CELL_SIZE_XY / 2, z: pos.z - MESH_CELL_SIZE_Z / 2 };
}
/**
 * 得到体素右上角的世界坐标
 * @param {Vector} pos
 * @returns {Vector}
 */
export function getmaxs(pos) {
    return { x: pos.x + MESH_CELL_SIZE_XY / 2, y: pos.y + MESH_CELL_SIZE_XY / 2, z: pos.z + MESH_CELL_SIZE_Z / 2 };
}
/**
 * 在指定体素位置向下和向上各做一次射线检测，返回地面碰撞结果。
 * @param {Vector} pos
 */
export function traceGroundAt(pos) {
    const start = { x: pos.x, y: pos.y, z: pos.z + MESH_CELL_SIZE_Z - 1 };
    const end = { x: pos.x, y: pos.y, z: pos.z - 1 };
    const S_E = Instance.TraceLine({ start, end, ignorePlayers: true });
    const E_S = Instance.TraceLine({ start: end, end: start, ignorePlayers: true });
    return { down: S_E, up: E_S }
}
/**
 * 在指定体素位置沿 X/Y 双向做射线检测，判断是否存在墙壁遮挡。
 * @param {Vector} pos
 */
export function traceWallAt(pos) {
    const start = { x: pos.x + MESH_CELL_SIZE_XY / 2, y: pos.y, z: pos.z + MESH_CELL_SIZE_Z / 2 };
    const end = { x: pos.x - MESH_CELL_SIZE_XY / 2, y: pos.y, z: pos.z + MESH_CELL_SIZE_Z / 2 };
    let l = Instance.TraceLine({ start, end, ignorePlayers: true });
    if (l && l.didHit) return true;
    l = Instance.TraceLine({ start: end, end: start, ignorePlayers: true });
    if (l && l.didHit) return true;
    start.x = pos.x;
    start.y = pos.y + MESH_CELL_SIZE_XY / 2;
    end.x = pos.x;
    end.y = pos.y - MESH_CELL_SIZE_XY / 2;
    l = Instance.TraceLine({ start, end, ignorePlayers: true });
    if (l && l.didHit) return true;
    l = Instance.TraceLine({ start: end, end: start, ignorePlayers: true });
    if (l && l.didHit) return true;
    return false;
}
/**
 * 从世界最高处向指定位置向下做射线检测，返回地面碰撞结果。
 * @param {Vector} pos
 */
export function traceGroundpd(pos) {
    const start = { x: pos.x, y: pos.y, z: origin.z + MESH_WORLD_SIZE_Z };
    const end = { x: pos.x, y: pos.y, z: pos.z - 1 };
    return Instance.TraceLine({ start, end, ignorePlayers: true });
}
/**
 * 从指定位置向上做射线检测至世界最高处，返回上方碰撞结果。
 * @param {Vector} pos
 */
export function traceAirpd(pos) {
    const start = { x: pos.x, y: pos.y, z: pos.z - 1 };
    const end = { x: pos.x, y: pos.y, z: origin.z + MESH_WORLD_SIZE_Z };
    return Instance.TraceLine({ start, end, ignorePlayers: true });
}
/**
 * 返回三点是否共线
 * @param {Vector} a
 * @param {Vector} b
 * @param {Vector} c
 */
export function isCollinear(a, b, c) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const bcx = c.x - b.x;
    const bcy = c.y - b.y;
    return abx * bcy - aby * bcx === 0;
}
/**
 * 点p到线段ab距离的平方
 * @param {Vector} p
 * @param {Vector} a
 * @param {Vector} b
 */
export function distPtSegSq(p, a, b) {
    // 向量 ab 和 ap
    const abX = b.x - a.x;
    const abY = b.y - a.y;
    const apX = p.x - a.x;
    const apY = p.y - a.y;

    // 计算 ab 向量的平方长度
    const abSq = abX * abX + abY * abY;

    // 如果线段的起点和终点重合（abSq 为 0），直接计算点到起点的距离
    if (abSq === 0) {
        return apX * apX + apY * apY;
    }

    // 计算点p在ab上的投影 t
    const t = (apX * abX + apY * abY) / abSq;

    // 计算投影点的位置
    let nearestX, nearestY;

    if (t < 0) {
        // 投影点在a点左侧，最近点是a
        nearestX = a.x;
        nearestY = a.y;
    } else if (t > 1) {
        // 投影点在b点右侧，最近点是b
        nearestX = b.x;
        nearestY = b.y;
    } else {
        // 投影点在线段上，最近点是投影点
        nearestX = a.x + t * abX;
        nearestY = a.y + t * abY;
    }

    // 计算点p到最近点的距离的平方
    const dx = p.x - nearestX;
    const dy = p.y - nearestY;

    return dx * dx + dy * dy;
}
/**
 * xy平面上点abc构成的三角形面积的两倍，>0表示ABC逆时针，<0表示顺时针
 * @param {Vector} a
 * @param {Vector} b
 * @param {Vector} c
 */
export function area(a, b, c) {
    const ab = { x: b.x - a.x, y: b.y - a.y };
    const ac = { x: c.x - a.x, y: c.y - a.y };
    const s2 = (ab.x * ac.y - ac.x * ab.y);
    return s2;
}
/**
 * 返回cur在多边形中是否是锐角
 * @param {Vector} prev
 * @param {Vector} cur
 * @param {Vector} next
 */
export function isConvex(prev, cur, next) {
    return area(prev, cur, next) > 0;
}
/**
 * xy平面上点p是否在abc构成的三角形内（不包括边上）
 * @param {Vector} p
 * @param {Vector} a
 * @param {Vector} b
 * @param {Vector} c
 */
export function pointInTri(p, a, b, c) {
    const ab = area(a, b, p);
    const bc = area(b, c, p);
    const ca = area(c, a, p);
    //内轮廓与外轮廓那里会有顶点位置相同的时候
    return ab > 0 && bc > 0 && ca > 0;
}
/**
 * 点到线段最近点
 * @param {Vector} p
 * @param {Vector} a
 * @param {Vector} b
 */
export function closestPointOnSegment(p, a, b) {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const abz = b.z - a.z;

    const apx = p.x - a.x;
    const apy = p.y - a.y;
    const apz = p.z - a.z;

    const d = abx * abx + aby * aby + abz * abz;
    let t = d > 0 ? (apx * abx + apy * aby + apz * abz) / d : 0;
    t = Math.max(0, Math.min(1, t));

    return {
        x: a.x + abx * t,
        y: a.y + aby * t,
        z: a.z + abz * t,
    };
}
/**
 * 点是否在凸多边形内(xy投影)
 * @param {Vector} p
 * @param {Float32Array} verts
 * @param {number} start
 * @param {number} end
 */
export function pointInConvexPolyXY(p, verts, start, end) {
    for (let i = start; i <= end; i++) {
        const a = { x: verts[i * 3], y: verts[i * 3 + 1],z:0 };
        const b = { x: verts[((i < end) ? (i + 1) : start) * 3], y: verts[((i < end) ? (i + 1) : start) * 3 + 1],z:0 };
        if (area(a, b, p) < 0) return false;
    }
    return true;
}
/**
 * 点到 polygon 最近点(xy投影)
 * @param {Vector} pos
 * @param {Float32Array} verts
 * @param {number} start
 * @param {number} end
 */
export function closestPointOnPoly(pos, verts, start, end) {
    // 1. 如果在多边形内部（XY），直接投影到平面
    if (pointInConvexPolyXY(pos, verts, start, end)) {
        // 用平均高度（你也可以用平面方程）
        let maxz = -Infinity, minz = Infinity;
        start*=3;
        end*=3;
        for (let i = start; i <= end; i+=3) {
            const z = verts[i + 2];
            if (z > maxz) maxz = z;
            if (z < minz) minz = z;
        }
        return { x: pos.x, y: pos.y, z: (maxz + minz) >>1, in: true };
    }
    // 2. 否则，找最近边
    let best = null;
    let bestDist = Infinity;
    for (let i = start; i <= end; i++) {
        const ia = i;
        const ib = (i < end) ? (i + 1) : start;
        const a = { x: verts[ia * 3], y: verts[ia * 3 + 1], z: verts[ia * 3 + 2] };
        const b = { x: verts[ib * 3], y: verts[ib * 3 + 1], z: verts[ib * 3 + 2] };
        const c = closestPointOnSegment(pos, a, b);
        const dx = c.x - pos.x;
        const dy = c.y - pos.y;
        const dz = c.z - pos.z;
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bestDist) {
            bestDist = d;
            best = { x: c.x, y: c.y, z: c.z, in: false };
        }
    }
    return best;
}

