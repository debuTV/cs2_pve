/**
 * @module 导航网格/轮廓构建
 */
import { Instance } from "cs_script/point_script";
import { origin, MESH_CELL_SIZE_XY, MESH_CELL_SIZE_Z, CONT_MAX_ERROR, CONT_MAX_EDGE_LEN, distPtSegSq } from "./path_const";
import { OpenHeightfield } from "./path_openheightfield";
import { OpenSpan } from "./path_openspan";

/**
 * 轮廓构建器。
 *
 * 将 OpenHeightfield 的可行走 Span 转换为多边形轮廓，
 * 为 PolyMeshBuilder 提供输入。
 * 流程：构建紧凑邻居 → 追踪轮廓 → 简化 → 拆分长边。
 *
 * @navigationTitle 轮廓构建器
 */
export class ContourBuilder {
    /**
     * 初始化轮廓构建器，绑定开放高度场数据。
     * @param {OpenHeightfield} hf
     */
    constructor(hf) {
        /** @type {boolean} 构建过程中是否发生错误 */
        this.error = false;
        /** @type {number[][]} 开放高度场单元格数组（Span 链表头） */
        this.hf = hf.cells;
        /** @type {number} X 方向网格数 */
        this.gridX = hf.gridX;
        /** @type {number} Y 方向网格数 */
        this.gridY = hf.gridY;
        /** @type {number} X 基址偏移 */
        this.baseX = hf.baseX;
        /** @type {number} Y 基址偏移 */
        this.baseY = hf.baseY;
        /** @type {number} Tile 核心区 X 最小值 */
        this.tileCoreMinX = hf.tileCoreMinX;
        /** @type {number} Tile 核心区 X 最大值 */
        this.tileCoreMaxX = hf.tileCoreMaxX;
        /** @type {number} Tile 核心区 Y 最小值 */
        this.tileCoreMinY = hf.tileCoreMinY;
        /** @type {number} Tile 核心区 Y 最大值 */
        this.tileCoreMaxY = hf.tileCoreMaxY;

        /** @type {Contour[][]} 按区域 ID 分组的轮廓数组（外轮廓 + 内孔） */
        this.contours = [];
    }

    /**
     * 为所有可行走 Span 建立紧凑四方向邻居索引。
     *
     * 遍历每个 cell 列的每个可用 Span，在四个方向上找到高度差最小且可通行的
     * 相邻 Span，将结果写入 OpenSpan 的邻居槽位，供后续轮廓追踪直接查询。
     */
    buildCompactNeighbors() {
        const dirs = [
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 1, dy: 0 },
            { dx: 0, dy: -1 }
        ];

        for (let x = 0; x < this.gridX; x++) {
            for (let y = 0; y < this.gridY; y++) {
                let spanId = this.hf[x][y];
                while (spanId !== 0) {
                    if (OpenSpan.getUse(spanId)) {
                        for (let d = 0; d < 4; d++) {
                            const nx = x + dirs[d].dx;
                            const ny = y + dirs[d].dy;
                            if (nx < 0 || ny < 0 || nx >= this.gridX || ny >= this.gridY) {
                                OpenSpan.setNeighbor(spanId, d, 0);
                                continue;
                            }

                            let best = 0;
                            let bestDiff = Infinity;
                            let nspanId = this.hf[nx][ny];
                            while (nspanId !== 0) {
                                if (OpenSpan.getUse(nspanId) && OpenSpan.canTraverseTo(spanId, nspanId)) {
                                    const diff = Math.abs(OpenSpan.getFloor(spanId) - OpenSpan.getFloor(nspanId));
                                    if (diff < bestDiff) {
                                        best = nspanId;
                                        bestDiff = diff;
                                    }
                                }
                                nspanId = OpenSpan.getNext(nspanId);
                            }
                            OpenSpan.setNeighbor(spanId, d, best);
                        }
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }
    }

    /**
     * 判断指定 Span 在某方向上是否为区域边界边。
     *
     * 无邻居或邻居所属 Region 不同时视为边界，轮廓追踪会在这些边上输出顶点。
     * @param {number} spanId - 当前 Span ID
     * @param {number} dir - 方向索引（0-3 对应 -X/+Y/+X/-Y）
     * @returns {boolean} 是否为边界边
     */
    isBoundaryEdge(spanId, dir) {
        const n = OpenSpan.getNeighbor(spanId, dir);
        if (n === 0) return true;
        return OpenSpan.getRegionId(n) !== OpenSpan.getRegionId(spanId);
    }
    /**
     * 获取指定方向邻居 Span 所属的 Region ID。
     *
     * 若该方向无邻居则返回 0，用于轮廓追踪时记录每条边对面的区域标识。
     * @param {number} spanId - 当前 Span ID
     * @param {number} dir - 方向索引
     * @returns {number} 邻居的 Region ID，无邻居时为 0
     */
    getNeighborregionid(spanId, dir) {
        const n = OpenSpan.getNeighbor(spanId, dir);
        if (n !== 0) return OpenSpan.getRegionId(n);
        else return 0;
    }
    /**
     * 生成边的唯一字符串键，用于 visited 集合去重。
     * @param {number} x - cell X 坐标
     * @param {number} y - cell Y 坐标
     * @param {number} spanId - Span ID
     * @param {number} dir - 边方向
     * @returns {string} 格式为 "x,y,spanId,dir" 的唯一键
     */
    edgeKey(x, y, spanId, dir) {
        return `${x},${y},${spanId},${dir}`;
    }

    /**
     * 沿指定方向移动一格，返回新的 cell 坐标。
     * @param {number} x - 当前 cell X
     * @param {number} y - 当前 cell Y
     * @param {number} dir - 方向索引（0=-X, 1=+Y, 2=+X, 3=-Y）
     * @returns {{x: number, y: number}} 移动后的坐标
     */
    move(x, y, dir) {
        switch (dir) {
            case 0: return { x: x - 1, y };
            case 1: return { x, y: y + 1 };
            case 2: return { x: x + 1, y };
            case 3: return { x, y: y - 1 };
        }
        return { x, y };
    }

    /**
     * 获取 cell 在指定方向上的角点坐标。
     *
     * 轮廓追踪在边界边上输出顶点时，使用此方法确定该边的角点位置。
     * @param {number} x - cell X
     * @param {number} y - cell Y
     * @param {number} dir - 方向索引
     * @returns {{x: number, y: number}} 角点坐标
     */
    corner(x, y, dir) {
        switch (dir) {
            case 0: return { x, y };
            case 1: return { x, y: y + 1 };
            case 2: return { x: x + 1, y: y + 1 };
            case 3: return { x: x + 1, y };
        }
        return { x, y };
    }

    /**
     * 执行完整的轮廓构建流程。
     *
     * 1. 调用 {@link buildCompactNeighbors} 建立 Span 邻居索引
     * 2. 遍历所有可行走 Span 的四个方向，在边界边上调用 {@link traceContour} 追踪轮廓
     * 3. 对追踪结果依次执行简化（{@link simplifyContour}）和长边分割（{@link splitLongEdges}）
     * 4. 过滤退化轮廓后存入 {@link contours}
     */
    init() {
        /** @type {Set<string>} */
        const visited = new Set();
        this.buildCompactNeighbors();

        for (let x = 0; x < this.gridX; x++) {
            for (let y = 0; y < this.gridY; y++) {
                let spanId = this.hf[x][y];
                while (spanId !== 0) {
                    if(OpenSpan.getUse(spanId))
                    {
                        if (OpenSpan.getRegionId(spanId) > 0) {
                            for (let dir = 0; dir < 4; dir++) {
                                if (this.isBoundaryEdge(spanId, dir)) {

                                    const key = this.edgeKey(x, y, spanId, dir);
                                    if (visited.has(key)) continue;

                                    let contour = this.traceContour(x, y, spanId, dir, visited);
                                    if (contour && contour.length >= 3) {
                                        //外轮廓：逆时针（CCW）
                                        //洞轮廓：顺时针（CW）
                                        contour = this.splitLongEdges(this.simplifyContour(contour));
                                        if (!contour || contour.length < 2) continue;

                                        if (!this.isDegenerateContour(contour) && contour.length >= 3) {
                                            this.contours.push(contour);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    spanId = OpenSpan.getNext(spanId);
                }
            }
        }
    }
    /**
     * 简化轮廓：保留关键拐点，移除冗余的中间顶点。
     *
     * - 锁定所有「邻居区域切换点」和「tile 边界非共线点」
     * - 对非 Portal 段使用 Douglas-Peucker 风格的最大误差递归简化
     * - Portal 段（邻居 regionId > 0）只保留端点，保持跨 Tile 对齐
     * @param {Contour[]} contour - 原始轮廓点数组
     * @returns {Contour[]} 简化后的轮廓
     */
    simplifyContour(contour) {
        const n = contour.length;
        if (n < 4) return contour.slice();
        const pts = contour.slice();

        const locked = new Array(n).fill(0);
        let lockCount = 0;
        for (let i = 0; i < n; i++) {
            const cur = pts[i];
            const next = pts[(i + 1) % n];
            const prev = pts[(i - 1 + n) % n];
            const isPortalChange = next.neighborRegionId !== cur.neighborRegionId;
            const keepBorderPoint = this.isPointOnTileBorder(cur) && !this.isBorderCollinearPoint(prev, cur, next);

            if (isPortalChange || keepBorderPoint) {
                locked[i] = 1;
                //Instance.DebugSphere({center: vec.Zfly(this.contourPointToWorld(cur),20*Math.random()), radius: 2, color:{r: 255, g: next.neighborRegionId!=0?255:0, b: 0},duration: 30});
                lockCount++;
            }
        }

        if (lockCount === 0) {
            let minId = 0;
            let maxId = 0;
            for (let i = 1; i < n; i++) {
                const p = pts[i];
                if (p.x < pts[minId].x || (p.x === pts[minId].x && p.y < pts[minId].y)) minId = i;
                if (p.x > pts[maxId].x || (p.x === pts[maxId].x && p.y > pts[maxId].y)) maxId = i;
            }
            locked[minId] = 1;
            locked[maxId] = 1;
        }

        /** @type {Contour[]} */
        const out = [];

        let i = 0;
        let firstLocked = -1;
        let lastLocked = -1;
        while (i < n - 1) {
            if (locked[i] === 0) {
                i++;
                continue;
            }

            if (firstLocked === -1) firstLocked = i;
            let j = i + 1;
            while (j < n - 1 && locked[j] === 0) j++;
            if (locked[j]) lastLocked = j;

            if (locked[i] && locked[j]) {
                // 锁点就是切换点：只看锁点后的第一条边类型
                const portalRegionId = pts[(i + 1) % n]?.neighborRegionId ?? 0;
                if (portalRegionId > 0) {
                    out.push(pts[i]);
                } else {
                    this.simplifySegmentByMaxError(pts, i, j, out);
                }
            }
            i = j;
        }

        // wrap 段同样只看锁点后的第一条边类型
        const wrapPortalRegionId = pts[(lastLocked + 1) % n]?.neighborRegionId ?? 0;
        if (wrapPortalRegionId > 0) {
            out.push(pts[lastLocked]);
        } else {
            this.simplifySegmentByMaxErrorWrap(pts, lastLocked, firstLocked, out);
        }

        if (out.length >= 3) {
            const indexByPoint = new Map();
            for (let k = 0; k < n; k++) {
                indexByPoint.set(pts[k], k);
            }

            /** @type {number[]} */
            const outIndices = [];
            for (const p of out) {
                const idx = indexByPoint.get(p);
                if (idx !== undefined) outIndices.push(idx);
            }
            return outIndices.map((idx) => pts[idx]);
        }

        return out;
    }
    /**
     * 对非 Portal 线段进行递归最大误差简化（Douglas-Peucker 风格）。
     *
     * 在 [i0, i1] 区间找到离线段最远的点，若距离超过 maxError 则递归分割，
     * 否则只保留起点 i0。
     * @param {Contour[]} pts - 完整轮廓点序列
     * @param {number} i0 - 起始索引（锁定点）
     * @param {number} i1 - 结束索引（锁定点）
     * @param {Contour[]} out - 输出数组，保留点会 push 进去
     */
    simplifySegmentByMaxError(pts, i0, i1, out) {
        const a = pts[i0];
        const b = pts[i1];
        let maxDistSq = 0;
        let index = -1;

        for (let i = i0 + 1; i < i1; i++) {
            const d = distPtSegSq(pts[i], a, b);
            if (d > maxDistSq) {
                maxDistSq = d;
                index = i;
            }
        }

        const maxErrorSq = this.getContourMaxErrorSq();
        if (index !== -1 && maxDistSq > maxErrorSq) {
            this.simplifySegmentByMaxError(pts, i0, index, out);
            this.simplifySegmentByMaxError(pts, index, i1, out);
        } else {
            out.push(a);
        }
    }

    /**
     * 跨数组末尾回绕版本的最大误差简化。
     *
     * 处理从最后一个锁定点回绕到第一个锁定点的环形段，
     * 索引从 i0 往后走到末尾再从 0 开始到 i1。
     * @param {Contour[]} pts - 完整轮廓点序列
     * @param {number} i0 - 起始索引（尾部锁定点）
     * @param {number} i1 - 结束索引（头部锁定点）
     * @param {Contour[]} out - 输出数组
     */
    simplifySegmentByMaxErrorWrap(pts, i0, i1, out) {
        if (i0 < 0 || i1 < 0) return;

        const n = pts.length;
        const a = pts[i0];
        const b = pts[i1];
        let maxDistSq = 0;
        let index = -1;

        for (let i = i0 + 1; i < n; i++) {
            const d = distPtSegSq(pts[i], a, b);
            if (d > maxDistSq) {
                maxDistSq = d;
                index = i;
            }
        }
        for (let i = 0; i < i1; i++) {
            const d = distPtSegSq(pts[i], a, b);
            if (d > maxDistSq) {
                maxDistSq = d;
                index = i;
            }
        }

        const maxErrorSq = this.getContourMaxErrorSq();
        if (index !== -1 && maxDistSq > maxErrorSq) {
            if (index < i0) this.simplifySegmentByMaxErrorWrap(pts, i0, index, out);
            else this.simplifySegmentByMaxError(pts, i0, index, out);

            if (index < i1) this.simplifySegmentByMaxError(pts, index, i1, out);
            else this.simplifySegmentByMaxErrorWrap(pts, index, i1, out);
        } else {
            out.push(a);
        }
    }

    /**
     * 线段是否位于当前 tile 的边界上。
     * @param {Contour} a
     * @param {Contour} b
     */
    isSegmentOnTileBorder(a, b) {
        if (this.isPointOnTileBorder(a) || this.isPointOnTileBorder(b)) return true;

        const minX = this.tileCoreMinX;
        const maxX = this.tileCoreMaxX;
        const minY = this.tileCoreMinY;
        const maxY = this.tileCoreMaxY;

        if (a.x === minX && b.x === minX) return true;
        if (a.x === maxX && b.x === maxX) return true;
        if (a.y === minY && b.y === minY) return true;
        if (a.y === maxY && b.y === maxY) return true;

        return false;
    }

    /**
     * 点是否落在当前 tile 的外边界上。
     * @param {Contour} p
     */
    isPointOnTileBorder(p) {
        const minX = this.tileCoreMinX;
        const maxX = this.tileCoreMaxX;
        const minY = this.tileCoreMinY;
        const maxY = this.tileCoreMaxY;

        if (p.x === minX || p.x === maxX) return true;
        if (p.y === minY || p.y === maxY) return true;

        return false;
    }

    /**
     * tile 边界上的“纯共线中间点”判定。
     * 仅当 prev-cur-next 同在同一条 tile 外边界线上时返回 true。
     * @param {Contour} prev
     * @param {Contour} cur
     * @param {Contour} next
     */
    isBorderCollinearPoint(prev, cur, next) {
        const minX = this.tileCoreMinX;
        const maxX = this.tileCoreMaxX;
        const minY = this.tileCoreMinY;
        const maxY = this.tileCoreMaxY;

        if (prev.x === minX && cur.x === minX && next.x === minX) return true;
        if (prev.x === maxX && cur.x === maxX && next.x === maxX) return true;
        if (prev.y === minY && cur.y === minY && next.y === minY) return true;
        if (prev.y === maxY && cur.y === maxY && next.y === maxY) return true;

        return false;
    }

    /**
     * 拆分轮廓中超过最大边长的线段。
     *
     * 反复在中点插入新顶点，直到所有边长均不超过 {@link getContourMaxEdgeLen} 的阈值。
     * 这一步确保多边形不会出现过长的边，有利于后续三角化质量。
     * @param {Contour[]} counter - 简化后的轮廓点序列
     * @returns {Contour[]} 拆分长边后的轮廓
     */
    splitLongEdges(counter) {
        const maxEdgeLen = this.getContourMaxEdgeLen();
        if (maxEdgeLen <= 0) return counter;

        let guard = 0;
        while (guard++ < counter.length * 8) {
            let inserted = false;
            for (let i = 0; i < counter.length; i++) {
                const i0 = counter[i];
                const i1 = counter[(i + 1) % counter.length];
                const dx = Math.abs(i1.x - i0.x);
                const dy = Math.abs(i1.y - i0.y);
                if (Math.max(dx, dy) <= maxEdgeLen) continue;
                //这里在counter插入新点，值为两端点的中点
                const newPoint = {
                    x: (i0.x + i1.x) * 0.5,
                    y: (i0.y + i1.y) * 0.5,
                    z: (i0.z + i1.z) * 0.5,
                    regionId: i0.regionId,
                    neighborRegionId: i0.neighborRegionId
                };

                // 如果你的 counter/contour 存的是点对象：
                counter.splice(i + 1, 0, newPoint);
                inserted = true;
                break;
            }
            if (!inserted) break;
        }
        return counter;
    }
    /**
     * 统计轮廓中不重复的 (x, y) 坐标个数。
     * @param {Contour[]} contour - 轮廓点序列
     * @returns {number} 唯一坐标数
     */
    countUniqueXY(contour) {
        const set = new Set();
        for (const p of contour) set.add(`${p.x}|${p.y}`);
        return set.size;
    }

    /**
     * 判断轮廓是否退化（点数不足或面积过小）。
     *
     * 退化轮廓会在 init 中被过滤不加入最终结果。
     * @param {Contour[]} contour - 轮廓点序列
     * @returns {boolean} 是否退化
     */
    isDegenerateContour(contour) {
        if (!contour || contour.length < 3) return true;
        if (this.countUniqueXY(contour) < 3) return true;
        return Math.abs(this.computeSignedArea2D(contour)) <= 1e-6;
    }

    /**
     * 计算轮廓的 2D 有符号面积（Shoelace 公式）。
     *
     * 正值表示逆时针（外轮廓），负值表示顺时针（孔洞）。
     * @param {Contour[]} contour - 轮廓点序列
     * @returns {number} 有符号面积
     */
    computeSignedArea2D(contour) {
        let area = 0;
        const n = contour.length;
        for (let i = 0; i < n; i++) {
            const a = contour[i];
            const b = contour[(i + 1) % n];
            area += a.x * b.y - b.x * a.y;
        }
        return area * 0.5;
    }

    /**
     * 从起始边界边开始，沿区域边界追踪一圈完整轮廓。
     *
     * 采用「右转 → 直行 → 左转 → 后转」优先级顺序行走，确保紧贴区域边界。
     * 每条边界边记录角点坐标、高度、所属 Region ID 和对面邻居 Region ID。
     * @param {number} sx - 起始 cell X
     * @param {number} sy - 起始 cell Y
     * @param {number} startSpanId - 起始 Span ID
     * @param {number} startDir - 起始边方向
     * @param {Set<string>} visited - 已访问边集合，用于去重
     * @returns {Contour[] | null} 轮廓点数组，失败时返回 null
     */
    traceContour(sx, sy, startSpanId, startDir, visited) {
        let x = sx;
        let y = sy;
        let spanId = startSpanId;
        let dir = startDir;

        const verts = [];

        let iter = 0;
        const MAX_ITER = this.gridX * this.gridY * 4;
        if (!this.isBoundaryEdge(startSpanId, startDir)) return null;
        const startKey = this.edgeKey(x, y, spanId, dir);
        while (iter++ < MAX_ITER) {
            const key = this.edgeKey(x, y, spanId, dir);
            //回到起点
            if (key === startKey && verts.length > 0) break;

            if (visited.has(key)) {
                Instance.Msg("奇怪的轮廓边,找了一遍现在又找一遍");
                this.error=true;
                return null;
            }
            visited.add(key);

            // 只有在边界边才输出顶点
            if (this.isBoundaryEdge(spanId, dir)) {
                const c = this.corner(x, y, dir);

                const h = this.getCornerHeightFromEdge(x, y, spanId, dir);
                const nid = this.getNeighborregionid(spanId, dir);
                //Instance.Msg(nid);
                if (h !== null) {
                    verts.push({
                        x: this.baseX + c.x,
                        y: this.baseY + c.y,
                        z: h,
                        regionId: OpenSpan.getRegionId(spanId),      //当前span的region
                        neighborRegionId: nid   //对面span的region（或 0）
                    });
                }

            }

            // 顺序：右转 → 直行 → 左转 → 后转
            let advanced = false;
            for (let i = 0; i < 4; i++) {
                const ndir = (dir + 3 - i + 4) % 4;
                const nspanId = OpenSpan.getNeighbor(spanId, ndir);

                // 这条边是boundary，就沿边走
                if (nspanId === 0 || OpenSpan.getRegionId(nspanId) !== OpenSpan.getRegionId(spanId)) {
                    dir = ndir;
                    advanced = true;
                    break;
                }

                // 否则穿过这条边
                const p = this.move(x, y, ndir);
                x = p.x;
                y = p.y;
                spanId = nspanId;
                dir = (ndir + 2) % 4;
                advanced = true;
                break;
            }

            if (!advanced) {
                Instance.Msg("轮廓断啦");
                this.error=true;
                return null;
            }
        }
        if (verts.length < 3) {
            this.error=true;
            return null;
        }
        return verts;
    }

    /**
     * 获取指定边角点的最大地板高度。
     *
     * 考察当前 Span 及其左、前、对角方向的邻居，取四者中的最大 floor 高度。
     * 确保轮廓顶点高度反映角点处真实的最高可行走层。
     * @param {number} x - cell X
     * @param {number} y - cell Y
     * @param {number} spanId - 当前 Span ID
     * @param {number} dir - 边方向
     * @returns {number} 角点处的最大地板高度
     */
    getCornerHeightFromEdge(x, y, spanId, dir) {
        let maxFloor = OpenSpan.getFloor(spanId);
        const leftDir = (dir + 3) & 3;
        // 只使用 buildCompactNeighbors 建好的 walkable 邻接，
        // 避免在相邻 cell 的整列 span 中误取到“非当前可走链路”的高度层。
        const left = OpenSpan.getNeighbor(spanId, leftDir);
        if (left !== 0) {
            const h = OpenSpan.getFloor(left);
            if (h > maxFloor) maxFloor = h;
        }

        const front = OpenSpan.getNeighbor(spanId, dir);
        if (front !== 0) {
            const h = OpenSpan.getFloor(front);
            if (h > maxFloor) maxFloor = h;
        }

        // 对角采用“先左再前”与“先前再左”两条可走链路择优。
        let diag = 0;
        if (left !== 0) diag = OpenSpan.getNeighbor(left, dir);
        if (diag === 0 && front !== 0) diag = OpenSpan.getNeighbor(front, leftDir);
        if (diag !== 0) {
            const h = OpenSpan.getFloor(diag);
            if (h > maxFloor) maxFloor = h;
        }

        return maxFloor;
    }
    /**
     * 判断 cell 坐标是否在网格范围内。
     * @param {number} x - cell X
     * @param {number} y - cell Y
     * @returns {boolean}
     */
    inBounds(x, y) {
        return x >= 0 && y >= 0 && x < this.gridX && y < this.gridY;
    }

    /**
     * 获取轮廓简化的最大误差平方值。
     * @returns {number}
     */
    getContourMaxErrorSq() {
        const e = CONT_MAX_ERROR;
        return e * e;
    }

    /**
     * 获取轮廓边允许的最大长度，用于 {@link splitLongEdges}。
     * @returns {number} 最大边长，若配置值 ≤ 0 则不分割
     */
    getContourMaxEdgeLen() {
        if (CONT_MAX_EDGE_LEN <= 0) return 0;
        return CONT_MAX_EDGE_LEN;
    }

    /**
     * 将轮廓点从网格坐标转换为世界坐标，用于调试绘制。
     * @param {Contour} v - 轮廓点
     * @returns {{x: number, y: number, z: number}} 世界坐标
     */
    contourPointToWorld(v) {
        return {
            x: origin.x + v.x * MESH_CELL_SIZE_XY ,//- MESH_CELL_SIZE_XY / 2,
            y: origin.y + v.y * MESH_CELL_SIZE_XY ,//- MESH_CELL_SIZE_XY / 2,
            z: origin.z + v.z * MESH_CELL_SIZE_Z,
        };
    }

    /**
     * 调试绘制所有轮廓，每个轮廓用随机颜色的线段显示。
     * @param {number} [duration=5] - 绘制持续时间（秒）
     */
    debugDrawContours(duration = 5) {
        Instance.Msg(`一共${this.contours.length}个轮廓`)
        for (const contour of this.contours) {
            const color = { r: 255 * Math.random(), g: 255 * Math.random(), b: 255 * Math.random() };
            const z = Math.random() * 20;
            for (let i = 0; i < contour.length; i++) {
                const a = this.contourPointToWorld(contour[i]);
                const b = this.contourPointToWorld(contour[(i + 1) % contour.length]);
                const start = {
                    x: a.x,
                    y: a.y,
                    z: a.z + z
                };
                const end = {
                    x: b.x,
                    y: b.y,
                    z: b.z + z
                };
                Instance.DebugLine({
                    start,
                    end,
                    color,
                    duration
                });
            }
        }
    }
}
/**
 * @typedef {Object} Contour
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * x,y 为离散格点坐标；z 为离散高度层
 * @property {number} regionId
 * @property {number} neighborRegionId
 */

