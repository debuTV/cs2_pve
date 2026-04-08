/**
 * @module 八叉树/空间索引
 */
import { vec } from "../util/vector";

/** @typedef {import("cs_script/point_script").Entity} Entity */
/** @typedef {import("cs_script/point_script").Vector} Vector */

/**
 * @typedef {object} SpatialItem
 * @property {Entity} entity
 * @property {Vector} position
 */

/**
 * @typedef {SpatialItem & { node: OctreeNode | null }} TrackedSpatialItem
 */

/**
 * @typedef {object} Bounds
 * @property {Vector} min
 * @property {Vector} max
 */

/**
 * @typedef {object} OctreeNode
 * @property {Bounds} bounds
 * @property {number} depth
 * @property {TrackedSpatialItem[]} items
 * @property {OctreeNode[] | null} children
 */

/**
 * 3D 点索引八叉树。
 *
 * 职责：
 * - 基于实体位置构建和增量维护树
 * - 球形范围查询候选邻居
 * - 暴露轻量统计，便于调试查询收益
 */
export class SpatialOctree {
    /**
     * @param {{ maxItems?: number; maxDepth?: number; minNodeSize?: number; padding?: number }} [config]
     */
    constructor(config = {}) {
        /**
         * 每个节点的最大实体数量；超过时会尝试分裂。
         */
        this.maxItems = config.maxItems ?? 8;
        /**
         * 最大树深；超过时不再分裂。
         */
        this.maxDepth = config.maxDepth ?? 6;
        /**
         * 最小节点尺寸；分裂时如果子节点尺寸小于此值则不再分裂。
         */
        this.minNodeSize = config.minNodeSize ?? 64;
        /**
         * 根节点边界相对于包含所有实体的最小包围盒的额外扩展距离，避免频繁重建。
         */
        this.padding = config.padding ?? 1;

        /** @type {OctreeNode | null} */
        this._root = null;
        /** @type {Map<Entity, TrackedSpatialItem>} */
        this._items = new Map();
        this._stats = this._createEmptyStats();
    }

    /** 清空索引。 */
    clear() {
        this._root = null;
        this._items.clear();
        this._stats = this._createEmptyStats();
    }

    /**
     * @param {Entity} entity
     * @returns {boolean}
     */
    has(entity) {
        return this._items.has(entity);
    }

    /**
     * 插入一个实体；若已存在则退化为 update。
     * @param {Entity} entity
     * @param {Vector} position
     * @returns {boolean}
     */
    insert(entity, position) {
        if (!entity || !this._isFiniteVector(position)) return false;
        if (this._items.has(entity)) {
            return this.update(entity, position);
        }

        /** @type {TrackedSpatialItem} */
        const item = {
            entity,
            position: vec.clone(position),
            node: null,
        };

        if (!this._root) {
            const bounds = this._buildBoundsAroundPoint(item.position);
            this._root = this._createNode(bounds, 0);
            this._stats.rootSize = bounds.max.x - bounds.min.x;
        }

        this._items.set(entity, item);
        this._stats.itemCount = this._items.size;

        if (!this._containsPoint(this._root.bounds, item.position)) {
            this._rebuildFromTrackedItems();
            return true;
        }

        this._insertTrackedItem(this._root, item);
        return true;
    }

    /**
     * 更新一个实体的位置；若不存在则插入。
     * @param {Entity} entity
     * @param {Vector} position
     * @returns {boolean}
     */
    update(entity, position) {
        if (!entity || !this._isFiniteVector(position)) return false;
        const item = this._items.get(entity);
        if (!item) {
            return this.insert(entity, position);
        }

        item.position = vec.clone(position);
        if (!this._root) {
            this._rebuildFromTrackedItems();
            return true;
        }
        if (!this._containsPoint(this._root.bounds, item.position)) {
            this._rebuildFromTrackedItems();
            return true;
        }
        if (item.node && this._containsPoint(item.node.bounds, item.position)) {
            return true;
        }

        this._detachTrackedItem(item);
        this._insertTrackedItem(this._root, item);
        return true;
    }

    /**
     * 删除一个实体。
     * @param {Entity} entity
     * @returns {boolean}
     */
    remove(entity) {
        const item = this._items.get(entity);
        if (!item) return false;

        this._detachTrackedItem(item);
        this._items.delete(entity);
        this._stats.itemCount = this._items.size;

        if (this._items.size === 0) {
            this._root = null;
            this._stats.nodeCount = 0;
            this._stats.maxDepth = 0;
            this._stats.rootSize = 0;
        }
        return true;
    }

    /**
     * 基于当前帧的实体快照重建索引。
     * @param {SpatialItem[]} items
     */
    rebuild(items = []) {
        /** @type {SpatialItem[]} */
        const normalized = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item?.entity || !this._isFiniteVector(item.position)) continue;
            if (typeof item.entity.IsValid === "function" && !item.entity.IsValid()) continue;
            normalized.push({
                entity: item.entity,
                position: vec.clone(item.position),
            });
        }

        this._rebuildFromSnapshots(normalized, false);
    }

    /**
     * 球形范围查询。
     * @param {Vector} center
     * @param {number} radius
     * @param {{ excludeEntity?: Entity | null }} [options]
     * @returns {SpatialItem[]}
     */
    querySphere(center, radius, options = {}) {
        if (!this._root || !this._isFiniteVector(center) || radius <= 0) {
            this._stats.lastQueryHits = 0;
            return [];
        }

        /** @type {SpatialItem[]} */
        const results = [];
        const radiusSq = radius * radius;
        this._queryNode(this._root, center, radiusSq, options.excludeEntity ?? null, results);
        this._stats.queryCount += 1;
        this._stats.queryHitsTotal += results.length;
        this._stats.lastQueryHits = results.length;
        return results;
    }

    /**
     * 获取轻量统计信息。
     * @returns {{
     *   itemCount: number;
     *   nodeCount: number;
     *   maxDepth: number;
     *   rootSize: number;
     *   queryCount: number;
     *   queryHitsTotal: number;
     *   lastQueryHits: number;
     *   averageQueryHits: number;
     * }}
     */
    getStats() {
        const averageQueryHits = this._stats.queryCount > 0
            ? this._stats.queryHitsTotal / this._stats.queryCount
            : 0;
        return {
            ...this._stats,
            averageQueryHits,
        };
    }

    /**
     * @returns {{
     *   itemCount: number;
     *   nodeCount: number;
     *   maxDepth: number;
     *   rootSize: number;
     *   queryCount: number;
     *   queryHitsTotal: number;
     *   lastQueryHits: number;
     * }}
     */
    _createEmptyStats() {
        return {
            itemCount: 0,
            nodeCount: 0,
            maxDepth: 0,
            rootSize: 0,
            queryCount: 0,
            queryHitsTotal: 0,
            lastQueryHits: 0,
        };
    }

    /**
     * @param {Vector} position
     * @returns {Bounds}
     */
    _buildBoundsAroundPoint(position) {
        const cubeSize = this.minNodeSize + this.padding * 2;
        const half = cubeSize * 0.5;
        return {
            min: vec.get(position.x - half, position.y - half, position.z - half),
            max: vec.get(position.x + half, position.y + half, position.z + half),
        };
    }

    /**
     * @param {SpatialItem[]} items
     * @returns {Bounds}
     */
    _buildRootBounds(items) {
        let minX = Infinity;
        let minY = Infinity;
        let minZ = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;

        for (let i = 0; i < items.length; i++) {
            const position = items[i].position;
            if (position.x < minX) minX = position.x;
            if (position.y < minY) minY = position.y;
            if (position.z < minZ) minZ = position.z;
            if (position.x > maxX) maxX = position.x;
            if (position.y > maxY) maxY = position.y;
            if (position.z > maxZ) maxZ = position.z;
        }

        const center = vec.get(
            (minX + maxX) * 0.5,
            (minY + maxY) * 0.5,
            (minZ + maxZ) * 0.5
        );
        const extentX = maxX - minX;
        const extentY = maxY - minY;
        const extentZ = maxZ - minZ;
        const cubeSize = Math.max(extentX, extentY, extentZ, this.minNodeSize) + this.padding * 2;
        const half = cubeSize * 0.5;
        return {
            min: vec.get(center.x - half, center.y - half, center.z - half),
            max: vec.get(center.x + half, center.y + half, center.z + half),
        };
    }

    /**
     * @param {Bounds} bounds
     * @param {number} depth
     * @returns {OctreeNode}
     */
    _createNode(bounds, depth) {
        this._stats.nodeCount += 1;
        if (depth > this._stats.maxDepth) {
            this._stats.maxDepth = depth;
        }
        return {
            bounds,
            depth,
            items: [],
            children: null,
        };
    }

    /**
     * @param {OctreeNode} node
     * @param {TrackedSpatialItem} item
     */
    _insertTrackedItem(node, item) {
        if (node.children) {
            const child = node.children[this._getChildIndex(node.bounds, item.position)];
            if (child && this._containsPoint(child.bounds, item.position)) {
                this._insertTrackedItem(child, item);
                return;
            }
        }

        node.items.push(item);
        item.node = node;
        if (!node.children && this._shouldSplit(node)) {
            const retainedItems = node.items.slice();
            node.items = [];
            for (let i = 0; i < retainedItems.length; i++) {
                retainedItems[i].node = null;
            }
            node.children = this._createChildren(node);
            for (let i = 0; i < retainedItems.length; i++) {
                this._insertTrackedItem(node, retainedItems[i]);
            }
        }
    }

    /**
     * @param {TrackedSpatialItem} item
     */
    _detachTrackedItem(item) {
        const node = item.node;
        if (!node) return;
        const index = node.items.indexOf(item);
        if (index >= 0) {
            node.items.splice(index, 1);
        }
        item.node = null;
    }

    /**
     * @param {boolean} [preserveQueryStats=true]
     */
    _rebuildFromTrackedItems(preserveQueryStats = true) {
        /** @type {SpatialItem[]} */
        const snapshots = [];
        for (const item of this._items.values()) {
            snapshots.push({
                entity: item.entity,
                position: vec.clone(item.position),
            });
        }
        this._rebuildFromSnapshots(snapshots, preserveQueryStats);
    }

    /**
     * @param {SpatialItem[]} snapshots
     * @param {boolean} preserveQueryStats
     */
    _rebuildFromSnapshots(snapshots, preserveQueryStats) {
        const queryStats = preserveQueryStats
            ? {
                queryCount: this._stats.queryCount,
                queryHitsTotal: this._stats.queryHitsTotal,
                lastQueryHits: this._stats.lastQueryHits,
            }
            : null;

        this.clear();
        if (queryStats) {
            this._stats.queryCount = queryStats.queryCount;
            this._stats.queryHitsTotal = queryStats.queryHitsTotal;
            this._stats.lastQueryHits = queryStats.lastQueryHits;
        }
        if (snapshots.length === 0) return;

        const bounds = this._buildRootBounds(snapshots);
        this._stats.rootSize = bounds.max.x - bounds.min.x;
        this._root = this._createNode(bounds, 0);

        for (let i = 0; i < snapshots.length; i++) {
            const snapshot = snapshots[i];
            /** @type {TrackedSpatialItem} */
            const item = {
                entity: snapshot.entity,
                position: vec.clone(snapshot.position),
                node: null,
            };
            this._items.set(item.entity, item);
            this._insertTrackedItem(this._root, item);
        }
        this._stats.itemCount = this._items.size;
    }

    /**
     * @param {OctreeNode} node
     * @returns {boolean}
     */
    _shouldSplit(node) {
        if (node.depth >= this.maxDepth) return false;
        if (node.items.length <= this.maxItems) return false;
        const size = node.bounds.max.x - node.bounds.min.x;
        return size * 0.5 >= this.minNodeSize;
    }

    /**
     * @param {OctreeNode} node
     * @returns {OctreeNode[]}
     */
    _createChildren(node) {
        const { min, max } = node.bounds;
        const mid = vec.get(
            (min.x + max.x) * 0.5,
            (min.y + max.y) * 0.5,
            (min.z + max.z) * 0.5
        );

        /** @type {OctreeNode[]} */
        const children = new Array(8);
        for (let zBit = 0; zBit < 2; zBit++) {
            for (let yBit = 0; yBit < 2; yBit++) {
                for (let xBit = 0; xBit < 2; xBit++) {
                    const index = xBit | (yBit << 1) | (zBit << 2);
                    const childMin = vec.get(
                        xBit === 0 ? min.x : mid.x,
                        yBit === 0 ? min.y : mid.y,
                        zBit === 0 ? min.z : mid.z
                    );
                    const childMax = vec.get(
                        xBit === 0 ? mid.x : max.x,
                        yBit === 0 ? mid.y : max.y,
                        zBit === 0 ? mid.z : max.z
                    );
                    children[index] = this._createNode({ min: childMin, max: childMax }, node.depth + 1);
                }
            }
        }
        return children;
    }

    /**
     * @param {Bounds} bounds
     * @param {Vector} position
     * @returns {number}
     */
    _getChildIndex(bounds, position) {
        const midX = (bounds.min.x + bounds.max.x) * 0.5;
        const midY = (bounds.min.y + bounds.max.y) * 0.5;
        const midZ = (bounds.min.z + bounds.max.z) * 0.5;
        let index = 0;
        if (position.x >= midX) index |= 1;
        if (position.y >= midY) index |= 2;
        if (position.z >= midZ) index |= 4;
        return index;
    }

    /**
     * @param {OctreeNode} node
     * @param {Vector} center
     * @param {number} radiusSq
     * @param {Entity | null} excludeEntity
     * @param {SpatialItem[]} results
     */
    _queryNode(node, center, radiusSq, excludeEntity, results) {
        if (!this._sphereIntersectsBounds(center, radiusSq, node.bounds)) return;

        for (let i = 0; i < node.items.length; i++) {
            const item = node.items[i];
            if (excludeEntity && item.entity === excludeEntity) continue;
            if (vec.lengthsq(item.position, center) <= radiusSq) {
                results.push(item);
            }
        }

        if (!node.children) return;
        for (let i = 0; i < node.children.length; i++) {
            this._queryNode(node.children[i], center, radiusSq, excludeEntity, results);
        }
    }

    /**
     * @param {Vector} center
     * @param {number} radiusSq
     * @param {Bounds} bounds
     * @returns {boolean}
     */
    _sphereIntersectsBounds(center, radiusSq, bounds) {
        let dx = 0;
        let dy = 0;
        let dz = 0;

        if (center.x < bounds.min.x) dx = bounds.min.x - center.x;
        else if (center.x > bounds.max.x) dx = center.x - bounds.max.x;

        if (center.y < bounds.min.y) dy = bounds.min.y - center.y;
        else if (center.y > bounds.max.y) dy = center.y - bounds.max.y;

        if (center.z < bounds.min.z) dz = bounds.min.z - center.z;
        else if (center.z > bounds.max.z) dz = center.z - bounds.max.z;

        return dx * dx + dy * dy + dz * dz <= radiusSq;
    }

    /**
     * @param {Bounds} bounds
     * @param {Vector} position
     * @returns {boolean}
     */
    _containsPoint(bounds, position) {
        return position.x >= bounds.min.x && position.x <= bounds.max.x &&
            position.y >= bounds.min.y && position.y <= bounds.max.y &&
            position.z >= bounds.min.z && position.z <= bounds.max.z;
    }

    /**
     * @param {Vector} position
     * @returns {boolean}
     */
    _isFiniteVector(position) {
        return !!position &&
            Number.isFinite(position.x) &&
            Number.isFinite(position.y) &&
            Number.isFinite(position.z);
    }
}