/**
 * @module 投掷物系统/投掷物管理器
 */
import { eventBus } from "../util/event_bus";
import { event } from "../util/definition";
import { ProjectileRunner } from "./projectile_runner";

/**
 * 投掷物管理器。
 *
 * 负责：
 * - 监听创建/停止请求
 * - 统一管理所有活跃投掷物实例
 * - 每帧驱动飞行
 * - 在命中或停止时桥接 Throw 模块事件
 *
 * @navigationTitle 投掷物管理器
 */
export class ProjectileManager {
    constructor() {
        /** @type {Map<number, ProjectileRunner>} */
        this._projectiles = new Map();
        this._nextProjectileId = 1;
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Throw.In.CreateRequest, (/** @type {import("./throw_const").ThrowCreateRequest} */ payload) => {
                payload.result = this.create(payload);
            }),
            eventBus.on(event.Throw.In.StopRequest, (/** @type {import("./throw_const").ThrowStopRequest} */ payload) => {
                payload.result = this.stop(payload.projectileId, payload.removeEntity !== false);
            }),
        ];
    }

    /**
     * @param {import("./throw_const").ThrowCreateRequest} desc
     * @returns {number}
     */
    create(desc) {
        if (!this._isValidCreateRequest(desc)) {
            return -1;
        }

        const projectileId = this._nextProjectileId++;
        const runner = new ProjectileRunner(projectileId, desc);
        this._projectiles.set(projectileId, runner);

        /** @type {import("./throw_const").OnProjectileCreated} */
        const payload = {
            projectileId,
            entity: runner.entity,
            targetType: runner.targetType,
            source: runner.source,
            meta: runner.meta,
        };
        eventBus.emit(event.Throw.Out.OnProjectileCreated, payload);

        return projectileId;
    }

    /**
     * @param {number} projectileId
     * @param {boolean} [removeEntity]
     * @returns {boolean}
     */
    stop(projectileId, removeEntity = true) {
        const runner = this._projectiles.get(projectileId);
        if (!runner) return false;

        this._projectiles.delete(projectileId);
        runner.abort();
        const removedEntity = removeEntity ? runner.removeEntity() : false;
        this._emitStopped(runner, removedEntity);
        return true;
    }

    /**
     * @param {number} now
     * @param {number} dt
     * @param {import("./throw_const").ProjectileTickContext} tickContext
     */
    tick(now, dt, tickContext) {
        void now;

        for (const [projectileId, runner] of this._projectiles.entries()) {
            if (runner.update(dt, tickContext)) {
                continue;
            }

            this._projectiles.delete(projectileId);
            this._emitCompletion(runner);
        }
    }

    clearAll() {
        for (const [projectileId, runner] of this._projectiles.entries()) {
            runner.abort();
            const removedEntity = runner.removeEntity();
            this._emitStopped(runner, removedEntity);
        }
        this._projectiles.clear();
    }

    destroy() {
        this.clearAll();
        for (const unsubscribe of this._unsubscribers) {
            unsubscribe();
        }
        this._unsubscribers.length = 0;
    }

    /**
     * @param {import("./throw_const").ThrowCreateRequest} desc
     * @returns {boolean}
     */
    _isValidCreateRequest(desc) {
        if (!desc) return false;
        if (!desc.entity?.IsValid?.()) return false;
        if (!desc.startPos || !desc.endPos) return false;
        if (typeof desc.speed !== "number" || !Number.isFinite(desc.speed) || desc.speed <= 0) return false;
        if (desc.targetType !== "player" && desc.targetType !== "monster") return false;
        return true;
    }

    /**
     * @param {ProjectileRunner} runner
     */
    _emitCompletion(runner) {
        const impactPos = runner.getImpactPos();
        const hitResults = runner.getHitResults();

        if (impactPos && hitResults.length > 0) {
            /** @type {import("./throw_const").OnProjectileHit} */
            const hitPayload = {
                projectileId: runner.id,
                entity: runner.entity,
                impactPos,
                radius: runner.radius,
                targetType: runner.targetType,
                source: runner.source,
                hitResults,
                hitCount: hitResults.length,
                meta: runner.meta,
            };
            eventBus.emit(event.Throw.Out.OnProjectileHit, hitPayload);
        }

        const removedEntity = runner.removeEntity();
        this._emitStopped(runner, removedEntity);
    }

    /**
     * @param {ProjectileRunner} runner
     * @param {boolean} removedEntity
     */
    _emitStopped(runner, removedEntity) {
        /** @type {import("./throw_const").OnProjectileStopped} */
        const payload = {
            projectileId: runner.id,
            entity: runner.entity,
            impactPos: runner.getImpactPos(),
            removedEntity,
            targetType: runner.targetType,
            source: runner.source,
            meta: runner.meta,
        };
        eventBus.emit(event.Throw.Out.OnProjectileStopped, payload);
    }
}