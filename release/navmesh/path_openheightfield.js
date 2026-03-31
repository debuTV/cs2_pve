/**
 * @module 导航网格/开放高度场
 */
import { Instance } from "cs_script/point_script";
import { origin, MESH_CELL_SIZE_XY, MESH_CELL_SIZE_Z, MESH_WORLD_SIZE_Z, AGENT_HEIGHT, MESH_ERODE_RADIUS, MESH_TRACE_SIZE_Z, MAX_SLOPE } from "./path_const";
import { OpenSpan } from "./path_openspan";
/**@typedef {import("cs_script/point_script").Vector} Vector */

/**
 * 开放高度场（体素化）。
 *
 * 将 3D 场景通过列式体素化转换为可行走 Span 链表。
 * 支持坡度检测、边缘腐蚀（erode）和 Padding 标记。
 * 是整个 Navmesh 构建管线的第一步。
 *
 * @navigationTitle 开放高度场
 */
export class OpenHeightfield {
    /**
     * 创建指定 Tile 坐标和尺寸参数的开放高度场。
     * @param {number} tx
     * @param {number} ty
     * @param {number} tileSize
     * @param {number} fullGrid
     * @param {number} tilePadding
     */
    constructor(tx, ty, tileSize, fullGrid, tilePadding) {
        /** @type {number} Span 自增 ID 计数器，从 1 开始（0 表示链表终止） */
        this.SPAN_ID = 1;

        /** @type {number} 当前 Tile 的 X 索引 */
        this.tx = tx;
        /** @type {number} 当前 Tile 的 Y 索引 */
        this.ty = ty;
        /** @type {number} Tile 边长（体素单位） */
        this.tileSize = tileSize;
        /** @type {number} 世界网格总边长 */
        this.fullGrid = fullGrid;
        /** @type {number} Tile 边界填充宽度（体素单位） */
        this.tilePadding = tilePadding;

        this.coreMinX = tx * tileSize;
        this.coreMinY = ty * tileSize;
        this.coreMaxX = Math.min(fullGrid - 1, this.coreMinX + tileSize - 1);
        this.coreMaxY = Math.min(fullGrid - 1, this.coreMinY + tileSize - 1);

        this.buildMinX = Math.max(0, this.coreMinX - tilePadding);
        this.buildMinY = Math.max(0, this.coreMinY - tilePadding);
        this.buildMaxX = Math.min(fullGrid - 1, this.coreMaxX + tilePadding);
        this.buildMaxY = Math.min(fullGrid - 1, this.coreMaxY + tilePadding);

        this.localCoreMinX = this.coreMinX - this.buildMinX;
        this.localCoreMinY = this.coreMinY - this.buildMinY;
        this.localCoreMaxX = this.coreMaxX - this.buildMinX;
        this.localCoreMaxY = this.coreMaxY - this.buildMinY;

        this.baseX = this.buildMinX;
        this.baseY = this.buildMinY;
        this.gridX = this.buildMaxX - this.buildMinX + 1;
        this.gridY = this.buildMaxY - this.buildMinY + 1;
        this.tileCoreMinX = this.coreMinX;
        this.tileCoreMaxX = this.coreMaxX + 1;
        this.tileCoreMinY = this.coreMinY;
        this.tileCoreMaxY = this.coreMaxY + 1;

        this.cells = new Array(this.gridX);
        for (let i = 0; i < this.gridX; i++) {
            this.cells[i] = new Uint32Array(this.gridY);
        }

        this.mins = { x: -MESH_CELL_SIZE_XY / 2, y: -MESH_CELL_SIZE_XY / 2, z: -MESH_TRACE_SIZE_Z / 2 };
        this.maxs = { x: MESH_CELL_SIZE_XY / 2, y: MESH_CELL_SIZE_XY / 2, z: MESH_TRACE_SIZE_Z / 2 };
    }
    /**
     * 执行体素化。
     *
     * 遍历构建区域内运行列式射线检测，生成可行走 Span 链表，
     * 然后执行边缘腐蚀和 Padding 标记。
     */
    init() {
        const minZ = origin.z;
        const maxZ = origin.z + MESH_WORLD_SIZE_Z;
        for (let x = 0; x < this.gridX; x++) {
            for (let y = 0; y < this.gridY; y++) {
                const worldX = origin.x + (this.baseX + x) * MESH_CELL_SIZE_XY;
                const worldY = origin.y + (this.baseY + y) * MESH_CELL_SIZE_XY;
                this.cells[x][y] = this.voxelizeColumn(worldX, worldY, minZ, maxZ);
            }

        }
        this.erode(MESH_ERODE_RADIUS);
        this.markPaddingAsUnwalkable();
    }

    /**
     * 对单列体素执行从顶到底的射线检测。
     *
     * 反复向下射线寻找地板，向上射线寻找天花板，
     * 生成符合高度/坡度见条件的 OpenSpan 并插入链表。
     *
     * @param {number} wx 世界 X 坐标
     * @param {number} wy 世界 Y 坐标
     * @param {number} minZ 最低 Z 
     * @param {number} maxZ 最高 Z
     * @returns {number} 链表头 Span ID，0 表示空
     */
    voxelizeColumn(wx, wy, minZ, maxZ) {
        let head = 0;  // 0 表示链表为空
        let currentZ = maxZ;
        const radius = MESH_TRACE_SIZE_Z / 2;

        while (currentZ >= minZ + radius) {
            //寻找地板 (floor)
            const downStart = { x: wx, y: wy, z: currentZ };
            const downEnd = { x: wx, y: wy, z: minZ };
            const downTr = Instance.TraceBox({ mins: this.mins, maxs: this.maxs, start: downStart, end: downEnd, ignorePlayers: true });
            if (!downTr || !downTr.didHit) break; // 下面没东西了，结束

            const floorZ = downTr.end.z - radius;

            //从地板向上寻找天花板 (ceiling)
            const upStart = { x: wx, y: wy, z: downTr.end.z + 1 };
            const upEnd = { x: wx, y: wy, z: maxZ };
            const upTr = Instance.TraceBox({ mins: this.mins, maxs: this.maxs, start: upStart, end: upEnd, ignorePlayers: true });

            let ceilingZ = maxZ;
            if (upTr.didHit) ceilingZ = upTr.end.z + radius;

            const floor = Math.round(floorZ - origin.z);
            const ceiling = Math.round(ceilingZ - origin.z);

            const slopeWalkable = this.isSlopeWalkableByNormal(downTr.normal);
            if ((ceiling - floor) >= AGENT_HEIGHT && slopeWalkable) {
                const newId = this.SPAN_ID++;
                OpenSpan.initSpan(newId, floor, ceiling);

                if (head === 0 || floor < OpenSpan.getFloor(head)) {
                    OpenSpan.setNext(newId, head);
                    head = newId;
                } else {
                    let curr = head;
                    while (OpenSpan.getNext(curr) !== 0 && OpenSpan.getFloor(OpenSpan.getNext(curr)) < floor) {
                        curr = OpenSpan.getNext(curr);
                    }
                    OpenSpan.setNext(newId, OpenSpan.getNext(curr));
                    OpenSpan.setNext(curr, newId);
                }
            }

            currentZ = floorZ - radius - 1;
        }

        return head;
    }

    /**
     * 根据命中法线判断坡度是否可行走。
     * @param {Vector} normal
     * @returns {boolean}
     */
    isSlopeWalkableByNormal(normal) {
        if (!normal) return false;

        const len = Math.hypot(normal.x, normal.y, normal.z);
        if (len <= 1e-6) return false;

        const upDot = Math.max(-1, Math.min(1, normal.z / len));
        const slopeDeg = Math.acos(upDot) * 180 / Math.PI;
        return slopeDeg <= MAX_SLOPE;
    }
    /**
     * 根据半径腐蚀可行走区域。
     *
     * 通过距离场传播将边缘附近的 Span 标记为不可行走，
     * 避免怪物贴墙行走。
     *
     * @param {number} radius 腐蚀半径（体素单位）
     */
    erode(radius) {
        if (radius <= 0) return;

        // 1. 初始化距离场，默认给一个很大的值
        // 使用 Uint16Array 节省内存，索引为 span id
        const distances = new Uint16Array(this.SPAN_ID + 1).fill(65535);
        const dirs = [{ dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }];

        // 2. 标记边界点（距离为 0）
        for (let i = 0; i < this.gridX; i++) {
            for (let j = 0; j < this.gridY; j++) {
                let spanId = this.cells[i][j];
                while (spanId !== 0) {
                    if (OpenSpan.getUse(spanId)) {
                        let isBoundary = false;
                        for (let d = 0; d < 4; d++) {
                            const nx = i + dirs[d].dx;
                            const ny = j + dirs[d].dy;

                            // 触碰地图边界或没有邻居，即为边界
                            if (nx < 0 || ny < 0 || nx >= this.gridX || ny >= this.gridY) {
                                isBoundary = true;
                                break;
                            }

                            let hasNeighborInDir = false;
                            let nspanId = this.cells[nx]?.[ny] || 0;
                            while (nspanId !== 0) {
                                if (OpenSpan.getUse(nspanId)) {
                                    if (OpenSpan.canTraverseTo(spanId, nspanId)) {
                                        hasNeighborInDir = true;
                                        break;
                                    }
                                }
                                nspanId = OpenSpan.getNext(nspanId);
                            }

                            // 任一方向缺失可达邻居，就视为边界
                            if (!hasNeighborInDir) {
                                isBoundary = true;
                                break;
                            }
                        }
                        if (isBoundary) distances[spanId] = 0;
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }

        // 3. 两次遍历计算精确距离场 (Pass 1: Top-Left to Bottom-Right)
        this._passDist(distances, true);
        // (Pass 2: Bottom-Right to Top-Left)
        this._passDist(distances, false);

        // 4. 根据 AGENT_RADIUS 删除不合格的 Span
        for (let i = 0; i < this.gridX; i++) {
            for (let j = 0; j < this.gridY; j++) {
                let spanId = this.cells[i][j];
                while (spanId !== 0) {
                    if (OpenSpan.getUse(spanId)) {
                        // 如果距离边界太近，则剔除
                        if (distances[spanId] < radius) {
                            OpenSpan.setUse(spanId, false);
                        }
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }
    }

    /**
     * 内部辅助：距离场传递
     * @param {Uint16Array} distances
     * @param {boolean} forward
     */
    _passDist(distances, forward) {
        const dirs = [{ dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }];
        const startX = forward ? 0 : this.gridX - 1;
        const endX = forward ? this.gridX : -1;
        const step = forward ? 1 : -1;

        for (let i = startX; i !== endX; i += step) {
            for (let j = forward ? 0 : this.gridY - 1; j !== (forward ? this.gridY : -1); j += step) {
                let spanId = this.cells[i][j];
                while (spanId !== 0) {
                    if (OpenSpan.getUse(spanId)) {
                        for (let d = 0; d < 4; d++) {
                            const nx = i + dirs[d].dx;
                            const ny = j + dirs[d].dy;
                            if (nx < 0 || ny < 0 || nx >= this.gridX || ny >= this.gridY) continue;

                            let nspanId = this.cells[nx]?.[ny] || 0;
                            while (nspanId !== 0) {
                                if (OpenSpan.getUse(nspanId)) {
                                    if (OpenSpan.canTraverseTo(spanId, nspanId)) {
                                        // 核心公式：当前点距离 = min(当前距离, 邻居距离 + 1)
                                        distances[spanId] = Math.min(distances[spanId], distances[nspanId] + 1);
                                    }
                                }
                                nspanId = OpenSpan.getNext(nspanId);
                            }
                        }
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }
    }

    /**
     * 仅让 tile core 参与区域和轮廓生成，padding 只提供体素上下文
     */
    markPaddingAsUnwalkable() {
        for (let i = 0; i < this.gridX; i++) {
            for (let j = 0; j < this.gridY; j++) {
                if (i >= this.localCoreMinX && i <= this.localCoreMaxX && j >= this.localCoreMinY && j <= this.localCoreMaxY) continue;

                let spanId = this.cells[i][j];
                while (spanId !== 0) {
                    OpenSpan.setUse(spanId, false);
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }
    }

    debug(duration = 30) {
        for (let i = 0; i < this.gridX; i++) {
            for (let j = 0; j < this.gridY; j++) {
                let spanId = this.cells[i][j];
                while (spanId !== 0) {
                    if (OpenSpan.getUse(spanId)) {
                        const c = {
                            r: 255,
                            g: 255,
                            b: 0
                        };
                        Instance.DebugSphere({
                            center: {
                                x: origin.x + (this.baseX + i) * MESH_CELL_SIZE_XY,
                                y: origin.y + (this.baseY + j) * MESH_CELL_SIZE_XY,
                                z: origin.z + OpenSpan.getFloor(spanId) * MESH_CELL_SIZE_Z
                            },
                            radius: 3,
                            duration,
                            color: c
                        });
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }
    }
}