/**
 * @module 导航网格/A星寻路
 */
import { Instance } from "cs_script/point_script";
import { ASTAR_HEURISTIC_SCALE, PathState } from "./path_const";
import { FunnelHeightFixer } from "./path_funnelheightfixer";
import { Tool } from "./util/tool";

/** @typedef {import("./path_manager").NavMeshMesh} NavMeshMesh */
/** @typedef {import("./path_manager").NavMeshLink} NavMeshLink */
/** @typedef {import("cs_script/point_script").Vector} Vector */

/**
 * A* 多边形图寻路器。
 *
 * 在多边形邻接图上使用启发式距离执行 A* 搜索，
 * 返回起点到终点的多边形序列路径。
 * 内部使用 MinHeap 作为优先队列，支持跨 Tile 的 Link 连接。
 *
 * @navigationTitle A* 寻路器
 */
export class PolyGraphAStar {
    /**
     * 初始化 A* 寻路器，绑定网格数据、链接映射和高度修正器。
    * @param {NavMeshMesh} polys
    * @param {Map<number,import("./path_manager").NavMeshLinkARRAY[]>} links
     * @param {FunnelHeightFixer} heightfixer
     */
    constructor(polys, links, heightfixer) {
        /** @type {NavMeshMesh} 导航网格数据引用 */
        this.mesh = polys;
        /** @type {number} 多边形总数 */
        this.polyCount = polys.polyslength;
        /**@type {Map<number,import("./path_manager").NavMeshLinkARRAY[]>} 特殊连接点映射（跳点/梯子/传送门） */
        this.links = links;
        /** @type {FunnelHeightFixer} 高度修正器引用 */
        this.heightfixer = heightfixer;
        //预计算中心点
        this.centers = new Array(this.polyCount);
        for (let i = 0; i < this.polyCount; i++) {
            const startVert = this.mesh.polys[i * 2];
            const endVert = this.mesh.polys[i * 2 + 1];
            let x = 0, y = 0, z = 0;
            for (let vi = startVert; vi <= endVert; vi++) {
                const base = vi * 3;
                x += this.mesh.verts[base];
                y += this.mesh.verts[base + 1];
                z += this.mesh.verts[base + 2];
            }
            const n = endVert - startVert + 1;
            this.centers[i] = {
                x: x / n,
                y: y / n,
                z: z / n
            };
        }
        /** @type {number} 启发式估价缩放系数的平方 */
        this.heuristicScale = ASTAR_HEURISTIC_SCALE*ASTAR_HEURISTIC_SCALE;
        /** @type {MinHeap} A* 内部优先队列 */
        this.open = new MinHeap(this.polyCount);
    }

    /**
     * 从世界坐标寻路。
     *
     * 将起点/终点投射到最近多边形，然后调用 {@link findPolyPath}
     * 执行 A* 搜索。若起终点在同一多边形则直接返回。
     *
     * @param {import("cs_script/point_script").Vector} start 起点世界坐标
     * @param {import("cs_script/point_script").Vector} end 终点世界坐标
     * @returns {{start: Vector, end: Vector, path: {id: number, mode: number}[]}} 投影后的起终点及多边形序列路径
     */
    findPath(start, end) {
        const startPoly = Tool.findNearestPoly(start, this.mesh,this.heightfixer,true);
        const endPoly = Tool.findNearestPoly(end, this.mesh,this.heightfixer,true);
        //Instance.Msg(startPoly.poly+"   "+endPoly.poly);
        if (startPoly.poly < 0 || endPoly.poly < 0) {
            Instance.Msg(`跑那里去了?`);
            return { start: startPoly.pos, end: endPoly.pos, path: [] };
        }

        if (startPoly.poly == endPoly.poly) {
            return { start: startPoly.pos, end: endPoly.pos, path: [{ id: endPoly.poly, mode: PathState.WALK }] };
        }
        return { start: startPoly.pos, end: endPoly.pos, path: this.findPolyPath(startPoly.poly, endPoly.poly) };
    }
    /**
     * A* 多边形图搜索。
     *
     * 在多边形邻接图上执行带启发式的 A* 搜索，同时考虑
     * 普通邻接边和特殊连接点（跳点/梯子/传送门）。
     * 若未找到终点则返回距终点最近的可达多边形路径。
     *
     * @param {number} start 起始多边形 ID
     * @param {number} end 目标多边形 ID
     * @returns {{id: number, mode: number}[]} 多边形序列路径，每项包含多边形 ID 和移动模式
     */
    findPolyPath(start, end) {
        const open = this.open;
        const g = new Float32Array(this.polyCount);
        const parent = new Int32Array(this.polyCount);
        const walkMode = new Uint8Array(this.polyCount);// 0=none,1=walk,2=jump,//待更新3=climb
        const state = new Uint8Array(this.polyCount); // 0=none,1=open,2=closed
        g.fill(Infinity);
        parent.fill(-1);
        open.clear();
        g[start] = 0;
        open.push(start, this.distsqr(start, end) * this.heuristicScale);
        state[start] = 1;

        let closestNode = start;
        let minH = Infinity;

        while (!open.isEmpty()) {
            const current = open.pop();

            if (current === end) return this.reconstruct(parent, walkMode, end);
            state[current] = 2;

            const hToTarget = this.distsqr(current, end);
            if (hToTarget < minH) {
                minH = hToTarget;
                closestNode = current;
            }

            const neighbors = this.mesh.neighbors[current];
            if (neighbors)
            {
                for (let i = 0; i < neighbors.length; i++) {
                    const entry = neighbors[i];
                    if (!entry) continue;
                    const count = entry[0];
                    if (count <= 0) continue;
                    for (let k = 1; k <= count; k++) {
                        const n = entry[k];
                        if (state[n] == 2) continue;
                        const tentative = g[current] + this.distsqr(current, n);
                        if (tentative < g[n]) {
                            parent[n] = current;
                            walkMode[n] = PathState.WALK;
                            g[n] = tentative;
                            const f = tentative + this.distsqr(n, end) * this.heuristicScale;
                            if (state[n] != 1) {
                                open.push(n, f);
                                state[n] = 1;
                            } else open.update(n, f);
                        }
                    }
                }
            }
            const linkSet = this.links.get(current);
            if (!linkSet) continue;
            for (const link of linkSet) {
                let v = -1;
                if (link.PolyA == current) v = link.PolyB;
                else if (link.PolyB == current) v = link.PolyA;
                if (v == -1 || state[v] == 2) continue;
                const moveCost = link.cost;
                if (g[current] + moveCost < g[v]) {
                    g[v] = g[current] + moveCost;

                    const f = g[v] + this.distsqr(v, end) * this.heuristicScale;
                    parent[v] = current;
                    walkMode[v] = link.type;
                    if (state[v] != 1) {
                        open.push(v, f);
                        state[v] = 1;
                    }
                    else open.update(v, f);
                }
            }
            //for (let li = 0; li < linkSet.length; li++) {
            //    let v = -1;
            //    const a = linkSet.poly[li * 2];
            //    const b = linkSet.poly[li * 2 + 1];
            //    if (a === current) v = b;
            //    else if (b === current) v = a;
            //    if (state[v] == 2) continue;
            //    const moveCost = linkSet.cost[li];
            //    if (g[current] + moveCost < g[v]) {
            //        g[v] = g[current] + moveCost;
            //        const f = g[v] + this.distsqr(v, end) * this.heuristicScale;
            //        parent[v] = current;
            //        walkMode[v] = linkSet.type[li];
            //        if (state[v] != 1) {
            //            open.push(v, f);
            //            state[v] = 1;
            //        }
            //        else open.update(v, f);
            //    }
            //}
        }
        return this.reconstruct(parent, walkMode, closestNode);
    }
    /**
     * 从 parent 数组重建路径。
     *
     * 沿 parent 链回溯并反转，产生从起点到 cur 的多边形序列。
     *
     * @param {Int32Array} parent 每个多边形的前驱索引
     * @param {Uint8Array} walkMode 每个多边形的移动方式
     * @param {number} cur 终点多边形 ID
     * @returns {{id: number, mode: number}[]}
     */
    reconstruct(parent, walkMode, cur) {
        const path = [];
        while (cur !== -1) {
            path.push({ id: cur, mode: walkMode[cur] });
            cur = parent[cur];
        }
        return path.reverse();
    }

    /**
     * 计算两个多边形中心点的欧氏距离（非平方）。
     *
     * 用作 A* 的边代价和启发式估价。
     *
     * @param {number} a 多边形 ID
     * @param {number} b 多边形 ID
     * @returns {number} 两个多边形中心点的欧氏距离
     */
    distsqr(a, b) {
        const pa = this.centers[a];
        const pb = this.centers[b];
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        const dz = pa.z - pb.z;
        //return Math.sqrt(dx * dx + dy * dy + dz * dz);
        return dx * dx + dy * dy + dz * dz;
    }
}
/**
 * 二叉最小堆，A* 内部使用的优先队列。
 */
class MinHeap {
    /**
     * 创建指定容量的二叉最小堆。
     * @param {number} polyCount
     */
    constructor(polyCount) {
        this.nodes = new Uint16Array(polyCount);
        this.costs = new Float32Array(polyCount);
        this.index = new Int16Array(polyCount).fill(-1);
        this.size = 0;
    }
    clear() {
        this.index.fill(-1);
        this.size = 0;
    }
    isEmpty() {
        return this.size === 0;
    }

    /**
     * 将节点以指定代价插入堆中，并上浮维护堆序。
     * @param {number} node
     * @param {number} cost
     */
    push(node, cost) {
        let i = this.size++;
        this.nodes[i] = node;
        this.costs[i] = cost;
        this.index[node] = i;
        this._up(i);
    }

    pop() {
        if (this.size === 0) return -1;
        const topNode = this.nodes[0];
        this.index[topNode] = -1;
        this.size--;
        if (this.size > 0) {
            this.nodes[0] = this.nodes[this.size];
            this.costs[0] = this.costs[this.size];
            this.index[this.nodes[0]] = 0;
            this._down(0);
        }
        return topNode;
    }

    /**
     * 更新已有节点的代价并上浮调整位置。
     * @param {number} node
     * @param {number} cost
     */
    update(node, cost) {
        const i = this.index[node];
        if (i < 0) return;
        this.costs[i] = cost;
        this._up(i);
    }

    /**
     * 从索引 i 向上冒泡，维护最小堆性质。
     * @param {number} i
     */
    _up(i) {
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.costs[p] <= this.costs[i]) break;
            this._swap(i, p);
            i = p;
        }
    }

    /**
     * 从索引 i 向下筛选，维护最小堆性质。
     * @param {number} i
     */
    _down(i) {
        const n = this.size;
        while (true) {
            let l = i * 2 + 1;
            let r = l + 1;
            let m = i;

            if (l < n && this.costs[l] < this.costs[m]) m = l;
            if (r < n && this.costs[r] < this.costs[m]) m = r;
            if (m === i) break;

            this._swap(i, m);
            i = m;
        }
    }

    /**
     * 交换堆中两个位置的节点、代价及反向索引。
     * @param {number} a
     * @param {number} b
     */
    _swap(a, b) {
        const ca = this.costs[a];
        const cb = this.costs[b];
        const na = this.nodes[a];
        const nb = this.nodes[b];
        this.costs[a] = cb;
        this.costs[b] = ca;
        this.nodes[a] = nb;
        this.nodes[b] = na;
        this.index[na] = b;
        this.index[nb] = a;
    }
}
