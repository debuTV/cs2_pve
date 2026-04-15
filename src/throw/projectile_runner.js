/**
 * @module 投掷物系统/投掷物运行单元
 */
import { Instance } from "cs_script/point_script";
import { vec } from "../util/vector";
import { gravity as worldGravity, surfaceEpsilon } from "../movement/movement_const";
import { ThrowTarget } from "./throw_const";

/** @typedef {import("cs_script/point_script").Vector} Vector */
/** @typedef {import("./throw_const").ThrowCreateRequest} ThrowCreateRequest */
/** @typedef {import("./throw_const").ProjectileTickContext} ProjectileTickContext */
/** @typedef {import("./throw_const").ProjectileHitEntry} ProjectileHitEntry */

/**
 * 单个投掷物实例的飞行与命中采样逻辑。
 *
 * 该类不直接依赖 eventBus；它只负责：
 * - 根据初始参数推进飞行
 * - 在结束时记录落点
 * - 按目标类型与半径采样命中结果
 * - 由 manager 在外层统一把结果组装成事件
 *
 * @navigationTitle 投掷物运行单元
 */
export class ProjectileRunner {
    /**
     * @param {number} id
     * @param {ThrowCreateRequest} params
     */
    constructor(id, params) {
        this.id = id;
        this.entity = params.entity;
        this.source = params.source ?? null;
        this.meta = params.meta ?? {};
        this.speed = params.speed;
        this.gravityScale = Math.max(0, params.gravityScale ?? 1);
        this.radius = Math.max(0, params.radius ?? 128);
        this.maxLifetime = Math.max(0.05, params.maxLifetime ?? 10);
        this.maxTargets = Number.isFinite(params.maxTargets)
            ? Math.max(0, Math.trunc(params.maxTargets ?? 0))
            : 0;
        this.targetType = params.targetType;

        this._finished = false;
        this._entityRemoved = false;
        this._elapsed = 0;
        /** @type {Vector|null} */
        this._impactPos = null;
        /** @type {ProjectileHitEntry[]} */
        this._hitResults = [];

        const startPos = vec.clone(params.startPos);
        const endPos = vec.clone(params.endPos);
        const toTarget = vec.sub(endPos, startPos);
        const distance = vec.length(toTarget);
        const duration = this.speed > 0 ? distance / this.speed : this.maxLifetime;
        this._duration = Math.max(duration, 0.05);

        if (this.gravityScale > 0) {
            const gravity = worldGravity * this.gravityScale;
            this.velocity = vec.get(
                toTarget.x / this._duration,
                toTarget.y / this._duration,
                (toTarget.z + 0.5 * gravity * this._duration * this._duration) / this._duration
            );
        } else {
            const direction = distance > 1e-6 ? vec.scale(toTarget, 1 / distance) : vec.get(0, 0, 0);
            this.velocity = vec.scale(direction, this.speed);
        }

        this.entity.Teleport({
            position: startPos,
            velocity: vec.clone(this.velocity),
        });
    }

    /**
     * @param {number} dt
     * @param {ProjectileTickContext} tickContext
     * @returns {boolean} true 表示仍在飞行，false 表示已结束
     */
    update(dt, tickContext) {
        if (this._finished) return false;
        if (!this.entity?.IsValid?.()) {
            this.abort();
            return false;
        }

        const remainingDuration = this._duration - this._elapsed;
        const remainingLifetime = this.maxLifetime - this._elapsed;
        const stepDt = Math.min(dt, remainingDuration, remainingLifetime);
        if (stepDt <= 0) {
            this._finish(this.entity.GetAbsOrigin(), tickContext);
            return false;
        }

        const start = this.entity.GetAbsOrigin();
        const end = this._computeStepEnd(start, stepDt);
        const trace = Instance.TraceLine({
            start,
            end,
            ignorePlayers: false,
            ignoreEntity: this._getIgnoredEntities(),
        });

        this._elapsed += stepDt;

        if (trace?.didHit) {
            const hitPos = vec.add(trace.end, vec.scale(trace.normal, surfaceEpsilon));
            this.entity.Teleport({
                position: hitPos,
                velocity: vec.clone(this.velocity),
            });
            this._finish(hitPos, tickContext);
            return false;
        }

        this.entity.Teleport({
            position: end,
            velocity: vec.clone(this.velocity),
        });

        if (this._elapsed >= this._duration || this._elapsed >= this.maxLifetime) {
            this._finish(end, tickContext);
            return false;
        }

        return true;
    }

    /**
     * 提前终止，不产生命中结果。
     */
    abort() {
        this._finished = true;
        this._impactPos = null;
        this._hitResults = [];
    }

    /**
     * 移除投掷物实体。
     * @returns {boolean}
     */
    removeEntity() {
        if (this._entityRemoved) return false;
        if (!this.entity?.IsValid?.()) {
            this._entityRemoved = true;
            return false;
        }

        this.entity.Remove();
        this._entityRemoved = true;
        return true;
    }

    /** @returns {boolean} */
    isFinished() {
        return this._finished;
    }

    /** @returns {Vector|null} */
    getImpactPos() {
        return this._impactPos ? vec.clone(this._impactPos) : null;
    }

    /** @returns {ProjectileHitEntry[]} */
    getHitResults() {
        return this._hitResults.map((entry) => ({ ...entry }));
    }

    /**
     * @param {Vector} start
     * @param {number} dt
     * @returns {Vector}
     */
    _computeStepEnd(start, dt) {
        if (this.gravityScale <= 0) {
            return vec.add(start, vec.scale(this.velocity, dt));
        }

        const gravity = worldGravity * this.gravityScale;
        const end = vec.get(
            start.x + this.velocity.x * dt,
            start.y + this.velocity.y * dt,
            start.z + this.velocity.z * dt - 0.5 * gravity * dt * dt
        );
        this.velocity = vec.get(
            this.velocity.x,
            this.velocity.y,
            this.velocity.z - gravity * dt
        );
        return end;
    }

    /**
     * @param {Vector} impactPos
     * @param {ProjectileTickContext} tickContext
     */
    _finish(impactPos, tickContext) {
        this._finished = true;
        this._impactPos = vec.clone(impactPos);
        this._hitResults = this._collectHits(impactPos, tickContext);
    }

    /**
     * @param {Vector} center
     * @param {ProjectileTickContext} tickContext
     * @returns {ProjectileHitEntry[]}
     */
    _collectHits(center, tickContext) {
        /** @type {ProjectileHitEntry[]} */
        const results = [];

        if (this.targetType === ThrowTarget.Player) {
            for (const player of tickContext?.players ?? []) {
                const pawn = player?.entityBridge?.pawn;
                if (!pawn?.IsValid?.()) continue;

                const distance = vec.length(pawn.GetAbsOrigin(), center);
                if (distance > this.radius) continue;

                results.push({
                    targetType: ThrowTarget.Player,
                    hit: player.slot,
                    distance,
                    player,
                });
            }
        }

        if (this.targetType === ThrowTarget.Monster) {
            for (const monster of tickContext?.monsters ?? []) {
                const model = monster?.model;
                if (!model?.IsValid?.()) continue;

                const distance = vec.length(model.GetAbsOrigin(), center);
                if (distance > this.radius) continue;

                results.push({
                    targetType: ThrowTarget.Monster,
                    hit: monster.id,
                    distance,
                    monster,
                });
            }
        }

        results.sort((left, right) => left.distance - right.distance);
        if (this.maxTargets > 0 && results.length > this.maxTargets) {
            return results.slice(0, this.maxTargets);
        }

        return results;
    }

    /**
     * @returns {import("cs_script/point_script").Entity[]}
     */
    _getIgnoredEntities() {
        /** @type {import("cs_script/point_script").Entity[]} */
        const ignored = [];

        if (this.entity?.IsValid?.()) {
            ignored.push(this.entity);
        }
        if (this.source?.IsValid?.()) {
            ignored.push(this.source);
        }

        return ignored;
    }
}
