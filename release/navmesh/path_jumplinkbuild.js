/**
 * @module 导航网格/跳跃链接构建
 */
import { Instance } from "cs_script/point_script";
import { AGENT_HEIGHT, AGENT_RADIUS, MAX_JUMP_HEIGHT, MAX_LINKS, MAX_POLYS, MAX_WALK_HEIGHT, MESH_CELL_SIZE_XY, MESH_CELL_SIZE_Z, PathState } from "./path_const";
import { Tool } from "./util/tool";
import { vec } from "./util/vector";
/** @typedef {import("cs_script/point_script").Vector} Vector */
/** @typedef {import("./path_manager").NavMeshMesh} NavMeshMesh */
/** @typedef {import("./path_manager").NavMeshLink} NavMeshLink */
/**
 * 跳跃链接自动构建器。
 *
 * 在不可达的分离行走区域间自动构建跳跃连接。
 * 使用网格空间索引快速查找候选边缘，并通过 TraceBox
 * 验证跳跃路径的可行性。支持 Tile 内和跨 Tile 链接。
 *
 * @navigationTitle 跳跃链接构建
 */
export class JumpLinkBuilder
{
    /**
     * 初始化跳跃链接构建器，绑定多边形网格。
    * @param {NavMeshMesh} polyMesh
     */
    constructor(polyMesh) {
        /** @type {NavMeshMesh} 待分析的多边形网格引用 */
        this.mesh = polyMesh;
        /** 2D 边界边间最大跳跃距离（单位：引擎坐标），用于空间索引查询半径 */
        this.jumpDist = 32;
        /** 最大跳跃高度（MAX_JUMP_HEIGHT × 体素 Z 尺寸），超过此高差的候选将被丢弃 */
        this.jumpHeight = MAX_JUMP_HEIGHT*MESH_CELL_SIZE_Z;
        /** 可行走高差阈值（MAX_WALK_HEIGHT × 体素 Z 尺寸），低于此高差的连接标记为 WALK 而非 JUMP */
        this.walkHeight = MAX_WALK_HEIGHT*MESH_CELL_SIZE_Z;
        /** 代理站立高度（AGENT_HEIGHT × 体素 Z 尺寸），用于 TraceBox 验证 */
        this.agentHeight = AGENT_HEIGHT * MESH_CELL_SIZE_Z;
        /** 同一岛对内跳跃点最小间距（平方），避免密集重复连接 */
        this.linkdist=250;

        /** @type {Uint16Array} 每个 link 占 2 个 uint16：poly[i*2]=起始 poly, poly[i*2+1]=目标 poly */
        this.poly=new Uint16Array(MAX_LINKS*2);
        /** @type {Float32Array} 每个 link 的寻路代价（通常为距离 × 1.5） */
        this.cost=new Float32Array(MAX_LINKS);

        /** @type {Uint8Array} 每个 link 的类型（PathState.WALK / PathState.JUMP） */
        this.type=new Uint8Array(MAX_LINKS);

        /** @type {Float32Array} 每个 link 占 6 个 float：pos[i*6..i*6+2] 为起点 XYZ, pos[i*6+3..i*6+5] 为终点 XYZ */
        this.pos=new Float32Array(MAX_LINKS*6);
        /** @type {number} 当前已写入的 link 数量 */
        this.length=0;

        /** @type {Int16Array} 每个多边形所属的连通区域 ID（由 buildConnectivity 填充）；同岛多边形之间不构建跳跃链接 */
        this.islandIds=new Int16Array(MAX_POLYS);
    }
    /**
     * 收集所有边界边，返回TypedArray，每3个为一组：polyIndex, p1索引, p2索引
     * p1/p2为顶点索引（不是坐标），便于后续批量处理
     * @returns {{boundarylengh:number,boundaryEdges:Uint16Array}} [polyIndex, p1, p2, ...]
     */
    collectBoundaryEdges() {
        const polyCount = this.mesh.polyslength;
        // 预估最大边界边数量
        const maxEdges = polyCount * 6;
        const result = new Uint16Array(maxEdges * 3);
        let edgeCount = 0;
        for (let i = 0; i < polyCount; i++) {
            const startVert = this.mesh.polys[i * 2];
            const endVert = this.mesh.polys[i * 2 + 1];
            const vertCount = endVert - startVert + 1;
            for (let j = 0; j < vertCount; j++) {
                const neighList = this.mesh.neighbors[i][j];
                if (!neighList[0]) {
                    const vi0 = startVert + j;
                    const vi1 = startVert + ((j + 1) % vertCount);
                    const idx = edgeCount * 3;
                    result[idx] = i;
                    result[idx + 1] = vi0;
                    result[idx + 2] = vi1;
                    edgeCount++;
                }
            }
        }
        // 截取有效部分
        return {boundarylengh:edgeCount,boundaryEdges:result};
    }
    /**
     * 判断两个多边形是否已经是物理邻居
     * @param {number} idxA
     * @param {number} idxB
     */
    areNeighbors(idxA, idxB) {
        const edgeList = this.mesh.neighbors[idxA];
        for (const entry of edgeList) {
            for (let k = 1; k <= entry[0]; k++) {
                if (entry[k] === idxB) return true;
            }
        }
        return false;
    }
    // 1D 区间间距：重叠返回 0，不重叠返回最小间距
    /**
     * 计算两个一维区间的间距，重叠时返回 0，否则返回最小间距。
     * @param {number} a0
     * @param {number} a1
     * @param {number} b0
     * @param {number} b1
     */
    intervalGap(a0, a1, b0, b1) {
        const amin = Math.min(a0, a1);
        const amax = Math.max(a0, a1);
        const bmin = Math.min(b0, b1);
        const bmax = Math.max(b0, b1);

        if (amax < bmin) return bmin - amax; // A 在 B 左侧
        if (bmax < amin) return amin - bmax; // B 在 A 左侧
        return 0; // 重叠
    }
    /**
     * 计算两条线段在 XY 平面上的最近点对及距离。
     *
     * 算法来自《Real-Time Collision Detection》，在 XY 平面求解参数 s/t，
     * 再映射回 3D 坐标。同时进行提前剪枝：Z 间距 > jumpHeight 或 XY AABB 间距 > dist2dsq 时直接返回。
     *
     * @param {number} p1x - 线段 A 起点 X
     * @param {number} p1y - 线段 A 起点 Y
     * @param {number} p1z - 线段 A 起点 Z
     * @param {number} p2x - 线段 A 终点 X
     * @param {number} p2y - 线段 A 终点 Y
     * @param {number} p2z - 线段 A 终点 Z
     * @param {number} p3x - 线段 B 起点 X
     * @param {number} p3y - 线段 B 起点 Y
     * @param {number} p3z - 线段 B 起点 Z
     * @param {number} p4x - 线段 B 终点 X
     * @param {number} p4y - 线段 B 终点 Y
     * @param {number} p4z - 线段 B 终点 Z
     * @param {number} dist2dsq - 2D 距离平方阈值
     * @returns {{dist:number, ptA:Vector, ptB:Vector}|undefined} 最近点对及距离平方，或 undefined 表示不满足条件
     */
    closestPtSegmentSegment(p1x,p1y,p1z,p2x,p2y,p2z,p3x,p3y,p3z,p4x,p4y,p4z,dist2dsq) {
        const gapZ=this.intervalGap(p1z, p2z, p3z, p4z);
        if (gapZ > this.jumpHeight) return;
        const gapX = this.intervalGap(p1x, p2x, p3x, p4x);
        const gapY = this.intervalGap(p1y, p2y, p3y, p4y);

        if (gapX * gapX + gapY * gapY > dist2dsq)return
        // 算法来源：Real-Time Collision Detection (Graham Walsh)
        // 计算线段 S1(p1,p2) 与 S2(p3,p4) 之间最近点
        
        const d1 = { x: p2x - p1x, y: p2y - p1y, z: 0 }; // 忽略 Z 参与平面距离计算
        const d2 = { x: p4x - p3x, y: p4y - p3y, z: 0 };
        const r = { x: p1x - p3x, y: p1y - p3y, z: 0 };

        const a = d1.x * d1.x + d1.y * d1.y; // Squared length of segment S1
        const e = d2.x * d2.x + d2.y * d2.y; // Squared length of segment S2
        const f = d2.x * r.x + d2.y * r.y;

        const EPSILON = 1;

        // 检查线段是否退化成点
        if (a <= EPSILON && e <= EPSILON) {
            // 两个都是点
            return { dist: (p1x - p3x)*(p1x - p3x) + (p1y - p3y)*(p1y - p3y) + (p1z - p3z)*(p1z - p3z), ptA: {x: p1x, y: p1y, z: p1z}, ptB: {x: p3x, y: p3y, z: p3z} };
        }
        
        let s, t;
        if (a <= EPSILON) {
            // S1 是点
            s = 0.0;
            t = f / e;
            t = Math.max(0.0, Math.min(1.0, t));
        } else {
            const c = d1.x * r.x + d1.y * r.y;
            if (e <= EPSILON) {
                // S2 是点
                t = 0.0;
                s = Math.max(0.0, Math.min(1.0, -c / a));
            } else {
                // 常规情况：两条线段
                const b = d1.x * d2.x + d1.y * d2.y;
                const denom = a * e - b * b;

                if (denom !== 0.0) {
                    s = Math.max(0.0, Math.min(1.0, (b * f - c * e) / denom));
                } else {
                    // 平行
                    s = 0.0;
                }

                t = (b * s + f) / e;

                if (t < 0.0) {
                    t = 0.0;
                    s = Math.max(0.0, Math.min(1.0, -c / a));
                } else if (t > 1.0) {
                    t = 1.0;
                    s = Math.max(0.0, Math.min(1.0, (b - c) / a));
                }
            }
        }
        // 计算最近点坐标（包含 Z）
        // 注意：t 和 s 在 XY 平面求得，再应用到 3D 坐标
        const ptA = {
            x: p1x + (p2x - p1x) * s,
            y: p1y + (p2y - p1y) * s,
            z: p1z + (p2z - p1z) * s
        };

        const ptB = {
            x: p3x + (p4x - p3x) * t,
            y: p3y + (p4y - p3y) * t,
            z: p3z + (p4z - p3z) * t
        };
        const heightDiff = Math.abs(ptA.z - ptB.z);
        if (heightDiff > this.jumpHeight) return;

        let dist=(ptA.x - ptB.x)*(ptA.x - ptB.x) + (ptA.y - ptB.y)*(ptA.y - ptB.y);
        if(dist > dist2dsq)return;
        dist+=heightDiff*heightDiff;
        if (heightDiff < 1 && dist < 1) return;
        return {
            dist,
            ptA,
            ptB
        };
    }
    /**
     * 返回当前构建的 NavMeshLink 结构。
     *
     * 若传入 Extlink，先将其追加到当前数组末尾再返回（用于跨 Tile 增量合并）。
     *
     * @param {import("./path_manager").NavMeshLink} [Extlink] - 可选的已有连接，追加到末尾
     * @returns {NavMeshLink}
     */
    return(Extlink) {
        if(Extlink)
        {
            const a = Extlink.length;
            const b = this.length;

            this.poly.set(
                Extlink.poly.subarray(0, a * 2),
                b*2
            );

            this.cost.set(
                Extlink.cost.subarray(0, a),
                b
            );

            this.type.set(
                Extlink.type.subarray(0, a),
                b
            );

            this.pos.set(
                Extlink.pos.subarray(0, a * 6),
                b * 6
            );
            this.length+=a;
        }
        return {
            poly: this.poly,
            pos: this.pos,
            type: this.type,
            cost: this.cost,
            length: this.length
        };
    }
    /**
     * 构建 Tile 内部的所有跳跃连接。
     *
     * 流程：计算连通分量 → 收集边界边 → 建立空间索引 → 收集候选 → 去重筛选 → 返回 NavMeshLink。
     *
     * @returns {NavMeshLink}
     */
    init() {
        // 3) 计算 mesh 连通分量（islandIds），后续用于“同岛且高度可走”过滤。
        this.buildConnectivity();
        // 4) 收集边界边（只在边界边之间寻找 jump 候选）。
        const {boundarylengh,boundaryEdges} = this.collectBoundaryEdges();
        // 5) 为边界边建立空间网格索引，加速近邻边查询。
        const edgeGrid = this.buildEdgeGrid(boundaryEdges,boundarylengh);
        // 6) 收集候选并执行首轮筛选，得到每个 poly 对的最优候选。
        const bestJumpPerPoly = this._collectBestJumpCandidates(boundaryEdges,boundarylengh, edgeGrid);
        // 7) 对候选做收尾去重（pair 去重 + 岛对近距去重），并生成最终 links。
        this._finalizeJumpLinks(bestJumpPerPoly);
        // 9) 返回构建完成的 links。
        return this.return();
    }
    /**
     * 仅构建指定 Tile 与周围 Tile 之间的跨 Tile 跳跃连接。
     *
     * 与 init() 类似，但候选筛选增加 tileid 标记过滤：
     * 仅从中心 Tile (tileid=2) 的边界边出发，目标不能同属中心 Tile。
     *
     * @param {number} boundarylengh - 边界边数量
     * @param {Uint16Array} boundaryEdges - 边界边数组（每 3 个为一组）
     * @param {Uint8Array} tileid - 每个 poly 的 tile 标记（2=中心, 1=邻居）
     * @param {NavMeshLink} Extlink - 已有的跨 Tile 连接，追加到末尾
     * @returns {NavMeshLink}
     */
    initInterTileIn(boundarylengh,boundaryEdges,tileid,Extlink) {
        // 4) 计算 mesh 连通分量。
        this.buildConnectivity(tileid);
        // 5) 收集边界边。
        // 6) 建立边界边空间索引。
        const edgeGrid = this.buildEdgeGrid(boundaryEdges,boundarylengh);
        // 7) 收集候选并筛选：额外过滤“同 tile”pair，只保留跨 tile 候选。
        const bestJumpPerPoly = this._collectBestJumpCandidates(boundaryEdges,boundarylengh,edgeGrid,tileid);
        // 8) 对候选做收尾去重并生成最终 links。
        this._finalizeJumpLinks(bestJumpPerPoly);
        // 10) 返回构建完成的 links。
        return this.return(Extlink);
    }
    /**
     * 遍历所有边界边对，通过空间索引查询近邻边，筛选出每对多边形之间的最优跳跃候选。
     *
     * 过滤条件：同岛排除、AABB 距离剪枝、最近点对距离与高度检查、TraceBox 路径验证。
     * 对同一 poly 对只保留距离最短的候选。
     *
     * @param {Uint16Array} boundaryEdges - 边界边数组
     * @param {number} boundaryLength - 边界边数量
     * @param {{grid: Map<number, number[]>, metas: Float32Array, cellSize: number, count: number}} edgeGrid - 空间索引
     * @param {Uint8Array} [tileid] - 可选 tile 标记，有值时仅从 tileid=2 出发
     * @returns {Map<number,any>} poly 对到最优候选的映射
     */
    _collectBestJumpCandidates(boundaryEdges, boundaryLength, edgeGrid, tileid) {
        // Key: "polyA_polyB", Value: { targetPoly, dist, startPos, endPos }
        const verts = this.mesh.verts;
        const islandIds = this.islandIds;
        const jumpDistSq = this.jumpDist * this.jumpDist;
        const bestJumpPerPoly = new Map();
        const candidateIndices=new Uint16Array(boundaryLength);
        for (let i = 0; i < boundaryLength; i++) {
            const idxA = (i<<1)+i;
            const polyIndexA = boundaryEdges[idxA];
            if(!islandIds[polyIndexA])continue;
            if(tileid&&tileid[polyIndexA]!=2)continue;
            const viA0 = boundaryEdges[idxA + 1]* 3;
            const viA1 = boundaryEdges[idxA + 2]* 3;
            candidateIndices[0]=0;
            this.queryNearbyEdges(edgeGrid, i, this.jumpDist,candidateIndices);
            for(let s=1;s<=candidateIndices[0];s++)
            {
                const j=candidateIndices[s];
                const idxB = (j<<1)+j;
                const polyIndexB = boundaryEdges[idxB];
                if(!islandIds[polyIndexB])continue;
                if(islandIds[polyIndexA] === islandIds[polyIndexB])continue;//同岛内的边界边不考虑构建跳跃链接
                if (polyIndexA === polyIndexB) continue;
                if(tileid&&tileid[polyIndexB]==2)continue;
                if(!tileid)
                {
                    //init()调用，判断多边形是否是邻居
                    if (this.areNeighbors(polyIndexA, polyIndexB)) continue;
                }
                const viB0 = boundaryEdges[idxB + 1]* 3;
                const viB1 = boundaryEdges[idxB + 2]* 3;
                const minBoxDist = this.bboxMinDist2D(edgeGrid.metas,i,j);
                if (minBoxDist > jumpDistSq) continue;
                
                const closestResult = this.closestPtSegmentSegment(
                    verts[viA0], verts[viA0+1], verts[viA0+2],
                    verts[viA1], verts[viA1+1], verts[viA1+2],
                    verts[viB0], verts[viB0+1], verts[viB0+2],
                    verts[viB1], verts[viB1+1], verts[viB1+2],
                    jumpDistSq);
                if (!closestResult) continue;
                //Instance.DebugLine({start:{x:verts[viA0],y:verts[viA0+1],z:verts[viA0+2]+5},
                //    end:{x:verts[viA1],y:verts[viA1+1],z:verts[viA1+2]+5},
                //    duration:5,color:{r:0,g:0,b:255}
                //});
                //Instance.DebugLine({start:{x:verts[viB0],y:verts[viB0+1],z:verts[viB0+2]+5},
                //    end:{x:verts[viB1],y:verts[viB1+1],z:verts[viB1+2]+5},
                //    duration:5,color:{r:0,g:0,b:255}
                //});
                const { dist, ptA, ptB } = closestResult;
                if (!this.validateJumpPath(ptA, ptB)) continue;
                this.updateBestCandidate(bestJumpPerPoly, polyIndexA, polyIndexB, dist, ptA, ptB);
            }
        }
        return bestJumpPerPoly;
    }

    /**
     * 最终连接生成：对候选进行 pair 去重和岛对近距去重，写入 TypedArray。
     *
     * 对每个候选检查已写入的同岛对 link，若起/终点距离 < linkdist 则跳过。
     * 根据高差将 link 标记为 WALK 或 JUMP 类型。
     *
     * @param {Map<number,any>} bestJumpPerPoly - _collectBestJumpCandidates 的输出
     */
    _finalizeJumpLinks(bestJumpPerPoly) {
        const sortedCandidates = Array.from(bestJumpPerPoly.values());
        let linkCount = 0;
        const linkdistsq=this.linkdist*this.linkdist;
        for (const cand of sortedCandidates) {
            // 距离判重，需遍历已写入的link
            let tooClose = false;
            for (let k = 0; k < linkCount; k++) {
                const plIdx = k << 1;
                const exA = this.poly[plIdx];
                const exB = this.poly[plIdx + 1];
                const exIslandA = this.islandIds[exA];
                const exIslandB = this.islandIds[exB];
                const islandA = this.islandIds[cand.startPoly];
                const islandB = this.islandIds[cand.endPoly];
                if ((islandA === exIslandA && islandB === exIslandB) || (islandA === exIslandB && islandB === exIslandA)) {
                    // 距离判重
                    const posIdx = (k << 2) + (k << 1);
                    const exStart = {
                        x: this.pos[posIdx],
                        y: this.pos[posIdx + 1],
                        z: this.pos[posIdx + 2]
                    };
                    const exEnd = {
                        x: this.pos[posIdx + 3],
                        y: this.pos[posIdx + 4],
                        z: this.pos[posIdx + 5]
                    };
                    const dSqStart = vec.lengthsq(cand.startPos, exStart);
                    const dSqEnd = vec.lengthsq(cand.endPos, exEnd);
                    if (dSqStart < linkdistsq || dSqEnd < linkdistsq) {
                        tooClose = true;
                        break;
                    }
                }
            }
            if (tooClose) continue;
            // 写入TypedArray
            const pid=linkCount<<1;
            this.poly[pid] = cand.startPoly;
            this.poly[pid + 1] = cand.endPoly;
            const posIdx = (linkCount << 2) + (linkCount << 1);
            this.pos[posIdx] = cand.startPos.x;
            this.pos[posIdx + 1] = cand.startPos.y;
            this.pos[posIdx + 2] = cand.startPos.z;
            this.pos[posIdx + 3] = cand.endPos.x;
            this.pos[posIdx + 4] = cand.endPos.y;
            this.pos[posIdx + 5] = cand.endPos.z;
            this.cost[linkCount] = cand.dist * 1.5;
            this.type[linkCount] = (Math.abs(cand.startPos.z - cand.endPos.z) <= this.walkHeight ? PathState.WALK : PathState.JUMP);
            linkCount++;
        }
        this.length = linkCount;
    }
    /**
     * BFS 计算多边形网格的连通分量，将结果写入 this.islandIds。
     *
     * 互相连通的多边形获得相同的区域 ID，后续筛选时同岛 poly 对将被跳过。
     * 若传入 tileid，只对 tileid[i] != 0 的多边形计算连通性。
     *
     * @param {Uint8Array} [tileid] - 可选的 tile 标记数组
     */
    buildConnectivity(tileid) {
        const numPolys = this.mesh.polyslength;
        this.islandIds = new Int16Array(numPolys);
        let currentId = 1;
        // 用TypedArray实现队列
        const queue = new Uint16Array(numPolys);
        for (let i = 0; i < numPolys; i++) {
            if (this.islandIds[i]) continue;
            if(tileid&&!tileid[i])continue;
            currentId++;
            let head = 0, tail = 0;
            queue[tail++] = i;
            this.islandIds[i] = currentId;
            while (head < tail) {
                let u = queue[head++];
                const neighbors = this.mesh.neighbors[u];
                // 获取该多边形的边数
                u<<=1;
                const startVert = this.mesh.polys[u];
                const endVert = this.mesh.polys[u + 1];
                const edgeCount = endVert - startVert + 1;
                for (let j = 0; j < edgeCount; j++) {
                    const entry = neighbors[j];
                    if (entry[0] == 0) continue;
                    for (let k = 1; k <= entry[0]; k++) {
                        const v = entry[k];
                        if (!this.islandIds[v]) {
                            this.islandIds[v] = currentId;
                            queue[tail++] = v;
                        }
                    }
                }
            }
        }
        //Instance.Msg(`共有${currentId-1}个独立行走区域`);
    }

    /**
     * 为边界边构建空间网格索引，加速近邻边查询。
     *
     * 每条边的 XY AABB 存入 metas（Float32Array），
     * 按 cellSize=jumpDist 分网格存入 grid Map。
     *
     * @param {Uint16Array} edges - 边界边数组（每 3 个为一组）
     * @param {number} count - 边界边数量
     * @returns {{grid: Map<number, number[]>, metas: Float32Array, cellSize: number, count: number}}
     */
    buildEdgeGrid(edges, count) {
        const cellSize = this.jumpDist;
        const grid = new Map();
        const metas = new Float32Array(count << 2);
        for (let i = 0; i < count; i++) {
            const idx = (i<<1)+i;
            // const polyIndex = edges[idx]; // 未用
            const vi0 = edges[idx + 1]*3;
            const vi1 = edges[idx + 2]*3;
            const x0 = this.mesh.verts[vi0], y0 = this.mesh.verts[vi0 + 1];
            const x1 = this.mesh.verts[vi1], y1 = this.mesh.verts[vi1 + 1];
            const minX = Math.min(x0, x1);
            const maxX = Math.max(x0, x1);
            const minY = Math.min(y0, y1);
            const maxY = Math.max(y0, y1);
            const metaIdx = i << 2;
            metas[metaIdx] = minX;
            metas[metaIdx + 1] = maxX;
            metas[metaIdx + 2] = minY;
            metas[metaIdx + 3] = maxY;
            const gridX0 = Math.floor(minX / cellSize);
            const gridX1 = Math.floor(maxX / cellSize);
            const gridY0 = Math.floor(minY / cellSize);
            const gridY1 = Math.floor(maxY / cellSize);
            for (let x = gridX0; x <= gridX1; x++) {
                for (let y = gridY0; y <= gridY1; y++) {
                    const k = (y << 16) | x;
                    if(!grid.has(k)) grid.set(k, []);
                    grid.get(k).push(i);
                }
            }
        }
        return { grid, metas, cellSize,count};
    }

    /**
     * 在空间索引中查询指定边的近邻边，结果写入 result 数组。
     *
     * result[0] 用作计数器，查询范围为边的 AABB 向外扩展 expand 距离。
     *
     * @param {{grid: Map<number, number[]>, metas: Float32Array, cellSize: number, count: number}} edgeGrid - 空间索引
     * @param {number} edgeIndex - 当前边索引
     * @param {number} expand - 扩展距离
     * @param {Uint16Array} result - 输出数组，result[0]=数量，result[1..]=索引
     */
    queryNearbyEdges(edgeGrid, edgeIndex, expand, result) {
        edgeIndex <<=2;
        const x0 = Math.floor((edgeGrid.metas[edgeIndex] - expand) / edgeGrid.cellSize);
        const x1 = Math.floor((edgeGrid.metas[edgeIndex + 1] + expand) / edgeGrid.cellSize);
        const y0 = Math.floor((edgeGrid.metas[edgeIndex + 2] - expand) / edgeGrid.cellSize);
        const y1 = Math.floor((edgeGrid.metas[edgeIndex + 3] + expand) / edgeGrid.cellSize);
        /**@type {Uint8Array} */
        const seen = new Uint8Array(edgeGrid.count);
        for (let x = x0; x <= x1; x++) {
            for (let y = y0; y <= y1; y++) {
                const k = (y << 16) | x;
                const list = edgeGrid.grid.get(k);
                if (!list) continue;
                for (const idx of list) {
                    if (seen[idx]) continue;
                    seen[idx] = 1;
                    result[++result[0]] = idx;
                }
            }
        }
        return;
    }

    /**
     * 计算两条边界边 AABB 在 2D 平面上的最小距离平方，用于快速剪枝。
     *
     * @param {Float32Array} metas - 边界边 AABB 元数据
     * @param {number} idxA - 第一条边索引
     * @param {number} idxB - 第二条边索引
     * @returns {number} 2D AABB 最小距离平方
     */
    bboxMinDist2D(metas, idxA, idxB) {
        idxA<<=2;
        idxB<<=2;
        return vec.length2Dsq({x:Math.max(0, Math.max(metas[idxA], metas[idxB]) - Math.min(metas[idxA + 1], metas[idxB + 1])),y:Math.max(0, Math.max(metas[idxA + 2], metas[idxB + 2]) - Math.min(metas[idxA + 3], metas[idxB + 3])),z:0});
    }

    /**
     * 通过 TraceBox 验证跳跃路径的可行性。
     *
     * 分 6 条射线模拟“升-平移-降”的抛物线路径（正向 + 反向），
     * 任一条线碎于障碍则判定不可跳跃。
     *
     * @param {Vector} a - 起点
     * @param {Vector} b - 终点
     * @returns {boolean} true 表示路径无障碍可跳跃
     */
    validateJumpPath(a, b) {
        const z=Math.max(a.z, b.z)+8;

        const start = { x: a.x, y: a.y, z: 8 };
        const end = { x: b.x, y: b.y, z: 8 };

        const boxMins = { x: -1, y: -1, z: 0 };
        const boxMaxs = { x: 1, y: 1, z: 1 };
        const hit = Instance.TraceBox({
            mins: boxMins,
            maxs: boxMaxs,
            start:vec.Zfly(start,z),
            end:vec.Zfly(end,z),
            ignorePlayers: true
        });
        if (hit && hit.didHit) return false;
        const hitup = Instance.TraceBox({
            mins: boxMins,
            maxs: boxMaxs,
            start:vec.Zfly(start,a.z),
            end:vec.Zfly(start,z),
            ignorePlayers: true
        });
        if (hitup && hitup.didHit) return false;
        const hitdown = Instance.TraceBox({
            mins: boxMins,
            maxs: boxMaxs,
            start:vec.Zfly(end,z),
            end:vec.Zfly(end,b.z),
            ignorePlayers: true
        });
        if (hitdown && hitdown.didHit) return false;

        const hitReverse = Instance.TraceBox({
            mins: boxMins,
            maxs: boxMaxs,
            start: vec.Zfly(end,z),
            end: vec.Zfly(start,z),
            ignorePlayers: true
        });
        if (hitReverse && hitReverse.didHit) return false;
        const hitupReverse = Instance.TraceBox({
            mins: boxMins,
            maxs: boxMaxs,
            start:vec.Zfly(end,b.z),
            end:vec.Zfly(end,z),
            ignorePlayers: true
        });
        if (hitupReverse && hitupReverse.didHit) return false;
        const hitdownReverse = Instance.TraceBox({
            mins: boxMins,
            maxs: boxMaxs,
            start:vec.Zfly(start,z),
            end:vec.Zfly(start,a.z),
            ignorePlayers: true
        });
        if (hitdownReverse && hitdownReverse.didHit) return false;
        return true;
    }
    /**
     * 更新 poly 对的最优跳跃候选：若新候选距离更短则替换。
     *
     * key 为 (idxA << 16) | idxB，保证每对多边形只保留一个最优候选。
     *
     * @param {Map<number,any>} map - poly 对到候选的映射
     * @param {number} idxA - 起始多边形索引
     * @param {number} idxB - 目标多边形索引
     * @param {number} dist - 距离平方
     * @param {Vector} ptA - 起点
     * @param {Vector} ptB - 终点
     */
    updateBestCandidate(map, idxA, idxB, dist, ptA, ptB) {
        // 检查是否已记录过该多边形对的跳跃目标
        const key = (idxA << 16) | idxB;

        const existing = map.get(key);
        // 若未记录或发现更近目标，则更新
        if (!existing || dist < existing.dist) {
            map.set(key, {
                startPoly: idxA,
                endPoly: idxB,
                dist: dist,
                startPos: { ...ptA },
                endPos: { ...ptB }
            });
        }
    }
    /**
     * 调试绘制所有跳跃连接（线段 + 多边形边界）。
     *
     * WALK 类型显示为绿色，JUMP 类型显示为蓝色，多边形边界显示为品红色。
     *
     * @param {number} [duration=10] - 绘制持续时间（秒）
     */
    debugDraw(duration = 10) {
        // 支持TypedArray结构
        Instance.Msg("debug");
        const { poly, pos, type, length } = this;
        const mesh = this.mesh;
        for (let i = 0; i < length; i++) {
            const polyA = poly[i * 2];
            const polyB = poly[i * 2 + 1];
            const t = type[i];
            const start = {
                x: pos[i * 6],
                y: pos[i * 6 + 1],
                z: pos[i * 6 + 2]
            };
            const end = {
                x: pos[i * 6 + 3],
                y: pos[i * 6 + 4],
                z: pos[i * 6 + 5]
            };
            Instance.DebugLine({
                start,
                end,
                color: { r: 0, g: (t === 1 ? 255 : 0), b: 255 },
                duration
            });
            // 可选：画起点终点球体
            // Instance.DebugSphere({ center: start, radius: 4, color: { r: 0, g: 255, b: 0 }, duration });
            // Instance.DebugSphere({ center: end, radius: 4, color: { r: 255, g: 0, b: 0 }, duration });
            // 绘制PolyB边界
            if (mesh && mesh.polys && mesh.verts) {
                const startVertB = mesh.polys[polyB * 2];
                const endVertB = mesh.polys[polyB * 2 + 1];
                const vertCountB = endVertB - startVertB+1;
                for (let j = 0; j < vertCountB; j++) {
                    const vi0 = startVertB + j;
                    const vi1 = startVertB + ((j + 1) % vertCountB);
                    const v0 = {
                        x: mesh.verts[vi0 * 3],
                        y: mesh.verts[vi0 * 3 + 1],
                        z: mesh.verts[vi0 * 3 + 2]
                    };
                    const v1 = {
                        x: mesh.verts[vi1 * 3],
                        y: mesh.verts[vi1 * 3 + 1],
                        z: mesh.verts[vi1 * 3 + 2]
                    };
                    Instance.DebugLine({ start: v0, end: v1, color: { r: 255, g: 0, b: 255 }, duration });
                }
                // 绘制PolyA边界
                const startVertA = mesh.polys[polyA * 2];
                const endVertA = mesh.polys[polyA * 2 + 1];
                const vertCountA = endVertA - startVertA + 1;
                for (let j = 0; j < vertCountA; j++) {
                    const vi0 = startVertA + j;
                    const vi1 = startVertA + ((j + 1) % vertCountA);
                    const v0 = {
                        x: mesh.verts[vi0 * 3],
                        y: mesh.verts[vi0 * 3 + 1],
                        z: mesh.verts[vi0 * 3 + 2]
                    };
                    const v1 = {
                        x: mesh.verts[vi1 * 3],
                        y: mesh.verts[vi1 * 3 + 1],
                        z: mesh.verts[vi1 * 3 + 2]
                    };
                    Instance.DebugLine({ start: v0, end: v1, color: { r: 255, g: 0, b: 255 }, duration });
                }
            }
        }
    }
}
