/**
 * @module 空间哈希/空间索引
 */
import { vec } from "../util/vector";

/** @typedef {import("cs_script/point_script").Entity} Entity */
/** @typedef {import("cs_script/point_script").Vector} Vector */

// XY 使用 16bit 无符号槽位，Z 使用 17bit 无符号槽位，总计 49bit，
// 可以在 JS 的安全整数范围内无冲突地打包成 number key。
const XY_CELL_BIAS = 32768;
const XY_CELL_RANGE = XY_CELL_BIAS * 2;
const Z_CELL_BIAS = 65536;
const Z_CELL_RANGE = Z_CELL_BIAS * 2;
const CELL_Y_STRIDE = Z_CELL_RANGE;
const CELL_X_STRIDE = XY_CELL_RANGE * Z_CELL_RANGE;

/**
 * @typedef {object} SpatialItem
 * @property {Entity} entity
 * @property {Vector} position
 */

/**
 * @typedef {SpatialItem & {
 *   cellKey: number;
 *   cellX: number;
 *   cellY: number;
 *   cellZ: number;
 *   bucketIndex: number;
 * }} TrackedSpatialItem
 */

/**
 * 3D 点索引空间哈希网格。
 *
 * 职责：
 * - 基于实体位置构建和增量维护哈希桶
 * - 球形范围查询候选邻居
 * - 暴露轻量统计，便于调试查询收益
 */
export class SpatialHashGrid {
    /**
     * @param {{ cellSize?: number; minNodeSize?: number; padding?: number }} [config]
     */
    constructor(config = {}) {
        /**
         * 单元格边长。较小的 cellSize 可以减少每个桶内的实体数量，提高查询效率，但会增加桶的总数和维护开销。
         */
        const legacyMinNodeSize = config.minNodeSize ?? 48;
        /**
         * 哈希网格边长。
         * 默认沿用旧 minNodeSize 的一半，使默认值为 32，贴近当前分离查询半径。
         */
        this.cellSize = Math.max(1, config.cellSize ?? Math.max(48, legacyMinNodeSize * 0.5));
        /**
         * 保留旧配置字段，避免外部传参报废；空间哈希本身不依赖该值。
         */
        this.padding = config.padding ?? 0;

        /** @type {Map<number, TrackedSpatialItem[]>} */
        this._cells = new Map();
        /** @type {Map<Entity, TrackedSpatialItem>} */
        this._items = new Map();
        this._stats = this._createEmptyStats();
    }

    /** 清空索引。 */
    clear() {
        this._cells.clear();
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
            cellKey: -1,
            cellX: 0,
            cellY: 0,
            cellZ: 0,
            bucketIndex: -1,
        };

        this._items.set(entity, item);
        this._insertIntoCell(item);
        this._stats.itemCount = this._items.size;
        this._stats.nodeCount = this._cells.size;
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

        item.position.x = position.x;
        item.position.y = position.y;
        item.position.z = position.z;

        const cellX = this._getCellCoord(position.x);
        const cellY = this._getCellCoord(position.y);
        const cellZ = this._getCellCoord(position.z);
        if (item.cellX === cellX && item.cellY === cellY && item.cellZ === cellZ) {
            return true;
        }

        this._detachTrackedItem(item);
        this._insertIntoCell(item, cellX, cellY, cellZ);
        this._stats.nodeCount = this._cells.size;
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
        this._stats.nodeCount = this._cells.size;
        if (this._items.size === 0) {
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
        this.clear();
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (!item?.entity || !this._isFiniteVector(item.position)) continue;
            if (typeof item.entity.IsValid === "function" && !item.entity.IsValid()) continue;
            this.insert(item.entity, item.position);
        }
    }

    /**
     * 球形范围查询。
     * @param {Vector} center
     * @param {number} radius
     * @param {{ excludeEntity?: Entity | null }} [options]
     * @returns {SpatialItem[]}
     */
    querySphere(center, radius, options = {}) {
        /** @type {SpatialItem[]} */
        const results = [];
        this.forEachInSphere(center, radius, (item) => {
            results.push(item);
        }, options);
        return results;
    }

    /**
     * 零额外结果数组分配的球形范围遍历。
     * @param {Vector} center
     * @param {number} radius
     * @param {(item: SpatialItem) => void} visitor
     * @param {{ excludeEntity?: Entity | null }} [options]
     * @returns {number}
     */
    forEachInSphere(center, radius, visitor, options = {}) {
        if (typeof visitor !== "function" || !this._isFiniteVector(center) || radius <= 0 || this._items.size === 0) {
            this._stats.lastQueryHits = 0;
            return 0;
        }

        const radiusSq = radius * radius;
        const minCellX = this._getCellCoord(center.x - radius);
        const maxCellX = this._getCellCoord(center.x + radius);
        const minCellY = this._getCellCoord(center.y - radius);
        const maxCellY = this._getCellCoord(center.y + radius);
        const minCellZ = this._getCellCoord(center.z - radius);
        const maxCellZ = this._getCellCoord(center.z + radius);
        const excludeEntity = options.excludeEntity ?? null;

        let hits = 0;
        for (let cellZ = minCellZ; cellZ <= maxCellZ; cellZ++) {
            for (let cellY = minCellY; cellY <= maxCellY; cellY++) {
                for (let cellX = minCellX; cellX <= maxCellX; cellX++) {
                    
                    const bucket = this._cells.get(this._getCellKey(cellX, cellY, cellZ));
                    if (!bucket) continue;

                    for (let i = 0; i < bucket.length; i++) {
                        const item = bucket[i];
                        if (excludeEntity && item.entity === excludeEntity) continue;
                        if (vec.lengthsq(item.position, center) > radiusSq) continue;
                        visitor(item);
                        hits += 1;
                    }
                }
            }
        }

        this._stats.queryCount += 1;
        this._stats.queryHitsTotal += hits;
        this._stats.lastQueryHits = hits;
        return hits;
    }

    /**
     * 获取轻量统计信息。
     * nodeCount 现在表示非空哈希桶数量；maxDepth 仅为兼容保留字段，固定为 0。
     * @returns {{
     *   itemCount: number;
     *   nodeCount: number;
     *   maxDepth: number;
     *   rootSize: number;
     *   queryCount: number;
     *   queryHitsTotal: number;
     *   lastQueryHits: number;
     *   averageQueryHits: number;
     *   cellSize: number;
     *   maxBucketLoad: number;
     * }}
     */
    getStats() {
        const structureStats = this._collectStructureStats();
        const averageQueryHits = this._stats.queryCount > 0
            ? this._stats.queryHitsTotal / this._stats.queryCount
            : 0;
        return {
            ...this._stats,
            ...structureStats,
            averageQueryHits,
            cellSize: this.cellSize,
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
     *   maxBucketLoad: number;
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
            maxBucketLoad: 0,
        };
    }

    /**
     * @param {TrackedSpatialItem} item
     * @param {number} [cellX]
     * @param {number} [cellY]
     * @param {number} [cellZ]
     */
    _insertIntoCell(item, cellX = this._getCellCoord(item.position.x), cellY = this._getCellCoord(item.position.y), cellZ = this._getCellCoord(item.position.z)) {
        const cellKey = this._getCellKey(cellX, cellY, cellZ);
        let bucket = this._cells.get(cellKey);
        if (!bucket) {
            bucket = [];
            this._cells.set(cellKey, bucket);
        }

        item.cellKey = cellKey;
        item.cellX = cellX;
        item.cellY = cellY;
        item.cellZ = cellZ;
        item.bucketIndex = bucket.length;
        bucket.push(item);
    }

    /**
     * @param {TrackedSpatialItem} item
     */
    _detachTrackedItem(item) {
        if (item.cellKey < 0) return;

        const bucket = this._cells.get(item.cellKey);
        if (!bucket) {
            item.cellKey = -1;
            item.bucketIndex = -1;
            return;
        }

        let index = item.bucketIndex;
        if (index < 0 || index >= bucket.length || bucket[index] !== item) {
            index = bucket.indexOf(item);
        }
        if (index < 0) {
            item.cellKey = -1;
            item.bucketIndex = -1;
            return;
        }

        const lastIndex = bucket.length - 1;
        if (index !== lastIndex) {
            const swapped = bucket[lastIndex];
            bucket[index] = swapped;
            swapped.bucketIndex = index;
        }
        bucket.pop();

        if (bucket.length === 0) {
            this._cells.delete(item.cellKey);
        }

        item.cellKey = -1;
        item.bucketIndex = -1;
    }

    /**
     * @returns {{ nodeCount: number; maxDepth: number; rootSize: number; maxBucketLoad: number }}
     */
    _collectStructureStats() {
        if (this._items.size === 0) {
            return {
                nodeCount: 0,
                maxDepth: 0,
                rootSize: 0,
                maxBucketLoad: 0,
            };
        }

        let minX = Infinity;
        let minY = Infinity;
        let minZ = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxZ = -Infinity;
        for (const item of this._items.values()) {
            const position = item.position;
            if (position.x < minX) minX = position.x;
            if (position.y < minY) minY = position.y;
            if (position.z < minZ) minZ = position.z;
            if (position.x > maxX) maxX = position.x;
            if (position.y > maxY) maxY = position.y;
            if (position.z > maxZ) maxZ = position.z;
        }

        let maxBucketLoad = 0;
        for (const bucket of this._cells.values()) {
            if (bucket.length > maxBucketLoad) {
                maxBucketLoad = bucket.length;
            }
        }

        return {
            nodeCount: this._cells.size,
            maxDepth: 0,
            rootSize: Math.max(maxX - minX, maxY - minY, maxZ - minZ),
            maxBucketLoad,
        };
    }

    /**
     * @param {number} value
     * @returns {number}
     */
    _getCellCoord(value) {
        return Math.floor(value / this.cellSize);
    }

    /**
     * @param {number} cellX
     * @param {number} cellY
     * @param {number} cellZ
     * @returns {number}
     */
    _getCellKey(cellX, cellY, cellZ) {
        const packedX = cellX + XY_CELL_BIAS;
        const packedY = cellY + XY_CELL_BIAS;
        const packedZ = cellZ + Z_CELL_BIAS;
        return packedX * CELL_X_STRIDE + packedY * CELL_Y_STRIDE + packedZ;
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