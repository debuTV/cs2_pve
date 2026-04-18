/**
 * @module 技能系统/哨戒炮台/炮台实例
 *
 * 封装单个哨戒炮台实例的完整生命周期。
 * 炮台自身只负责索敌、旋转与直接伤害判定，
 * 不再依赖部署点或资源收益逻辑。
 */
import { Instance } from "cs_script/point_script";
import { MonsterState } from "../../../monster/monster_const";
import { createLaserEndpoints } from "../../../util/laser";
import { createSoundEntity } from "../../../util/sound";
import {
    SENTRY_ATTACK_SOUND_EVENT_NAME,
    SENTRY_DEFAULTS,
    SENTRY_LASER_ORBIT_HEIGHT,
    SENTRY_LASER_ORBIT_RADIUS,
    SentryState,
} from "./sentry_const";

export class SentryTurret {
    /**
     * @param {import("./sentry_const").SentryTurretOptions} options
     */
    constructor(options) {
        const cfg = SENTRY_DEFAULTS;

        this.base = options.turretBase;
        this.yaw = options.turretYaw;
        this.spawnedEntities = Array.isArray(options.spawnedEntities) && options.spawnedEntities.length > 0
            ? options.spawnedEntities
            : [options.turretBase, options.turretYaw];
        this.ownerKey = options.ownerKey;
        this.laserStart = null;
        this.laserEnd = null;
        this.soundEntity = null;

        /** @type {import("../../../monster/monster/monster").Monster|null} */
        this.target = null;
        /** @type {SentryState} */
        this.state = SentryState.IDLE;

        this.searchRadius = cfg.searchRadius;
        this.targetLostRange = cfg.targetLostRange;
        this.damage = cfg.damage;
        this.lifetime = cfg.lifetime;
        this.attackInterval = cfg.attackInterval;
        this.turnSpeed = typeof options.turnSpeed === "number" && Number.isFinite(options.turnSpeed)
            ? Math.max(0, options.turnSpeed)
            : cfg.turnSpeed;
        this._basePosition = this.base.GetAbsOrigin();
        this._baseAngles = this.base.GetAbsAngles();
        this._yawPosition = this.yaw.GetAbsOrigin();
        this._currentYaw = this._normalizeYaw(this.yaw?.GetAbsAngles?.()?.yaw ?? this._baseAngles?.yaw ?? 0);

        /** @type {() => import("../../../monster/monster/monster").Monster[]} */
        this.getActiveMonsters = () => [];

        this._nextAttackTime = 0;
        this._destroyTime = Instance.GetGameTime() + this.lifetime;
        this._lastTickTime = Instance.GetGameTime();

        this._init();
    }

    _init() {
        this._syncAnchors();
        const laserStartPos = this._getLaserStartPosition();
        if (!laserStartPos || !this._createLaserEndpoints(laserStartPos)) {
            Instance.Msg(`Sentry: 创建激光端点失败\n`);
            this.destroy();
            return;
        }
        const soundOrigin = this._getSoundOrigin();
        if (!soundOrigin || !this._createSoundEntity(soundOrigin)) {
            Instance.Msg(`Sentry: 创建声音实体失败\n`);
            this.destroy();
            return;
        }
        this._syncLaserEndpoints(laserStartPos, laserStartPos);
        this._ceaseFire();
    }

    tick() {
        if (this.state === SentryState.DESTROYED) return;
        if (!this._hasRequiredEntities()) {
            this.destroy();
            return;
        }

        const now = Instance.GetGameTime();
        const dt = Math.max(0, now - this._lastTickTime);
        this._lastTickTime = now;
        if (now >= this._destroyTime) {
            this.destroy();
            return;
        }

        this._syncAnchors();
        const turretPos = this._getTurretBasePosition();
        const restingLaserStartPos = this._getLaserStartPosition();
        if (!turretPos || !restingLaserStartPos) {
            this.destroy();
            return;
        }

        let targetPos = null;
        let aimSolution = null;

        if (this._isTargetValid() && this._isTargetInRange(turretPos)) {
            targetPos = this._getTargetAimPosition(this.target);
            aimSolution = targetPos ? this._createAimSolution(turretPos, targetPos) : null;
            if (!aimSolution || !this._hasLineOfSight(aimSolution.laserStartPos, this.target, targetPos)) {
                targetPos = null;
                aimSolution = null;
            }
        }

        if (!aimSolution) {
            this.target = this._findTarget(turretPos);
            this._nextAttackTime = now;
            targetPos = this._getTargetAimPosition(this.target);
            aimSolution = targetPos ? this._createAimSolution(turretPos, targetPos) : null;
        }

        if (!this.target || !targetPos || !aimSolution) {
            this.target = null;
            this._syncLaserEndpoints(restingLaserStartPos, restingLaserStartPos);
            if (this.state === SentryState.COMBAT) {
                this._ceaseFire();
            }
            return;
        }

        const activeYaw = this._rotateToward(aimSolution.yaw, dt);
        const activeLaserStartPos = this._getLaserStartPosition(activeYaw, turretPos);
        if (!activeLaserStartPos) {
            this.destroy();
            return;
        }

        this._syncLaserEndpoints(activeLaserStartPos, targetPos);
        if (this.state !== SentryState.COMBAT) {
            this._openFire();
        }

        if (now >= this._nextAttackTime) {
            this.target.takeDamage(this.damage, null);
            this._playAttackSound();
            this._nextAttackTime = now + this.attackInterval;
        }
    }

    _openFire() {
        this.state = SentryState.COMBAT;
    }

    _ceaseFire() {
        this.state = SentryState.IDLE;
    }

    destroy() {
        if (this.state === SentryState.DESTROYED) return;
        this._ceaseFire();
        this.state = SentryState.DESTROYED;
        this.target = null;

        const entities = this.spawnedEntities.length > 0
            ? [...this.spawnedEntities]
            : [this.base, this.yaw];
        if (this.laserStart&&this.laserStart?.IsValid?.()) {
            if(this.laserStart.GetClassName?.()=="info_particle_system")
            {
                Instance.EntFireAtTarget({
                    target: this.laserStart,
                    input: "destroyimmediately",
                });
            }
            entities.push(this.laserStart);
        }
        if (this.laserEnd&&this.laserEnd?.IsValid?.()) {
            if(this.laserEnd.GetClassName?.()=="info_particle_system")
            {
                Instance.EntFireAtTarget({
                    target: this.laserEnd,
                    input: "destroyimmediately",
                });
            }
            entities.push(this.laserEnd);
        }
        if (this.soundEntity?.IsValid?.()) {
            entities.push(this.soundEntity);
        }
        const uniqueEntities = new Set(entities.filter((entity) => entity?.IsValid?.()));
        for (const entity of uniqueEntities) {
            entity.Remove();
        }

        this.laserStart = null;
        this.laserEnd = null;
        this.soundEntity = null;
    }

    _isTargetValid() {
        return this._isMonsterValid(this.target);
    }

    _hasRequiredEntities() {
        return this.base?.IsValid?.()
            && this.yaw?.IsValid?.()
            && this.laserStart?.IsValid?.()
            && this.laserEnd?.IsValid?.()
            && this.soundEntity?.IsValid?.();
    }

    _getTurretBasePosition() {
        return this._cloneVector(this._basePosition ?? (this.base?.IsValid?.() ? this.base.GetAbsOrigin() : null));
    }

    /**
     * @param {number} [yaw=this._currentYaw]
     * @param {{x:number,y:number,z:number} | null} [turretPos=null]
     * @returns {{x:number,y:number,z:number} | null}
     */
    _getLaserStartPosition(yaw = this._currentYaw, turretPos = null) {
        const basePosition = this._cloneVector(turretPos ?? this._basePosition ?? (this.base?.IsValid?.() ? this.base.GetAbsOrigin() : null));
        if (!basePosition || !Number.isFinite(yaw)) return null;

        const yawRad = yaw * (Math.PI / 180);
        return {
            x: basePosition.x + Math.cos(yawRad) * SENTRY_LASER_ORBIT_RADIUS,
            y: basePosition.y + Math.sin(yawRad) * SENTRY_LASER_ORBIT_RADIUS,
            z: basePosition.z + SENTRY_LASER_ORBIT_HEIGHT,
        };
    }

    _syncAnchors() {
        if (this._basePosition || this._baseAngles) {
            this.base.Teleport({
                position: this._basePosition ?? undefined,
                angles: this._baseAngles ?? undefined,
            });
        }

        if (this._yawPosition) {
            this.yaw.Teleport({
                position: this._yawPosition,
            });
        }
    }

    /**
     * @returns {{x:number,y:number,z:number} | null}
     */
    _getSoundOrigin() {
        return this._cloneVector(this._yawPosition ?? this._basePosition ?? (this.yaw?.IsValid?.() ? this.yaw.GetAbsOrigin() : null));
    }

    /**
     * @param {{x:number,y:number,z:number}} laserStartPos
     * @returns {boolean}
     */
    _createLaserEndpoints(laserStartPos) {
        const endpoints = createLaserEndpoints({
            startPosition: laserStartPos,
            endPosition: laserStartPos,
        });
        if (!endpoints?.start?.IsValid?.() || !endpoints?.end?.IsValid?.()) {
            return false;
        }

        this.laserStart = endpoints.start;
        this.laserEnd = endpoints.end;
        return true;
    }

    /**
     * @param {{x:number,y:number,z:number}} soundOrigin
     * @returns {boolean}
     */
    _createSoundEntity(soundOrigin) {
        this.soundEntity = createSoundEntity({
            position: soundOrigin,
        });
        if (!this.soundEntity?.IsValid?.()) {
            this.soundEntity = null;
            return false;
        }

        Instance.EntFireAtTarget({
            target: this.soundEntity,
            input: "Followentity",
            value: "!activator",
            activator: this.yaw,
        });
        return true;
    }

    /**
     * @param {{x:number,y:number,z:number}} laserStartPos
     * @param {{x:number,y:number,z:number}} laserEndPos
     */
    _syncLaserEndpoints(laserStartPos, laserEndPos) {
        if (!this.laserStart?.IsValid?.() || !this.laserEnd?.IsValid?.()) {
            return;
        }
        this.laserStart.Teleport({ position: laserStartPos });
        this.laserEnd.Teleport({ position: laserEndPos });
    }

    _playAttackSound() {
        if (!this.soundEntity?.IsValid?.()) {
            return;
        }

        Instance.EntFireAtTarget({
            target: this.soundEntity,
            input: "SetSoundEventName",
            value: SENTRY_ATTACK_SOUND_EVENT_NAME,
        });
        Instance.EntFireAtTarget({
            target: this.soundEntity,
            input: "StartSound",
        });
    }

    /**
     * @returns {import("cs_script/point_script").Entity[]}
     */
    _getIgnoredTraceEntities() {
        const entities = this.spawnedEntities.filter((entity) => entity?.IsValid?.());
        if (this.laserStart?.IsValid?.()) {
            entities.push(this.laserStart);
        }
        if (this.laserEnd?.IsValid?.()) {
            entities.push(this.laserEnd);
        }
        return entities;
    }

    /**
     * @param {import("../../../monster/monster/monster").Monster | null} monster
     * @returns {boolean}
     */
    _isMonsterValid(monster) {
        if (!monster) return false;
        if (monster.state === MonsterState.DEAD) return false;
        return this._getTargetEntity(monster) != null;
    }

    /**
     * @param {{x:number,y:number,z:number}} turretPos
     * @returns {import("../../../monster/monster/monster").Monster | null}
     */
    _findTarget(turretPos) {
        let selectedTarget = null;
        let selectedDistancesq = Number.POSITIVE_INFINITY;
        for (const monster of this.getActiveMonsters()) {
            if (!this._isMonsterValid(monster)) continue;
            const targetPos = this._getTargetAimPosition(monster);
            if (!targetPos) continue;
            const aimSolution = this._createAimSolution(turretPos, targetPos);
            if (!aimSolution) continue;

            const distancesq = this._distsq(turretPos, targetPos);
            if (distancesq > this.searchRadius*this.searchRadius || distancesq >= selectedDistancesq) continue;
            if (!this._hasLineOfSight(aimSolution.laserStartPos, monster, targetPos)) continue;

            selectedTarget = monster;
            selectedDistancesq = distancesq;
        }
        return selectedTarget;
    }

    /**
     * @param {{x:number,y:number,z:number}} turretPos
     * @returns {boolean}
     */
    _isTargetInRange(turretPos) {
        const targetPos = this._getTargetAimPosition(this.target);
        if (!targetPos) return false;
        return this._distsq(turretPos, targetPos) <= this.targetLostRange*this.targetLostRange;
    }

    /**
     * @param {{x:number,y:number,z:number} | null | undefined} laserStartPos
     * @param {import("../../../monster/monster/monster").Monster | null} monster
     * @param {{x:number,y:number,z:number} | null} [targetPos]
     * @returns {boolean}
     */
    _hasLineOfSight(laserStartPos, monster, targetPos = null) {
        const targetEntity = this._getTargetEntity(monster);
        const resolvedTargetPos = targetPos ?? this._getTargetAimPosition(monster);
        if (!targetEntity || !resolvedTargetPos || !laserStartPos) return false;

        const trace = Instance.TraceLine({
            start: laserStartPos,
            end: resolvedTargetPos,
            ignoreEntity: this._getIgnoredTraceEntities(),
            ignorePlayers: true,
        });
        return !trace.didHit || trace.hitEntity === targetEntity;
    }

    /**
     * @param {import("../../../monster/monster/monster").Monster | null} monster
     * @returns {import("cs_script/point_script").Entity | null}
     */
    _getTargetEntity(monster) {
        if (!monster) return null;
        if (monster.model?.IsValid?.()) return monster.model;
        if (monster.breakable?.IsValid?.()) return monster.breakable;
        return null;
    }

    /**
     * @param {import("../../../monster/monster/monster").Monster | null} monster
     * @returns {{x:number,y:number,z:number} | null}
     */
    _getTargetAimPosition(monster) {
        const targetEntity = this._getTargetEntity(monster);
        if (!targetEntity) return null;

        const origin = targetEntity.GetAbsOrigin?.();
        if (!origin) return null;
        const zOffset = monster?.model?.IsValid?.() ? 48 : 24;
        return {
            x: origin.x,
            y: origin.y,
            z: origin.z + zOffset,
        };
    }

    /**
     * @param {{x:number,y:number,z:number}} turretPos
     * @param {{x:number,y:number,z:number}} targetPos
     */
    _createAimSolution(turretPos, targetPos) {
        if (!turretPos || !targetPos) return null;

        const yaw = Math.atan2(targetPos.y - turretPos.y, targetPos.x - turretPos.x) * (180 / Math.PI);
        const laserStartPos = this._getLaserStartPosition(yaw, turretPos);
        if (!laserStartPos) return null;

        return {
            yaw,
            laserStartPos,
        };
    }

    /**
     * @param {number} yaw
     * @param {number} dt
     */
    _rotateToward(yaw, dt = 0) {
        const targetYaw = this._normalizeYaw(yaw);
        if (!Number.isFinite(targetYaw)) {
            return this._currentYaw;
        }

        let nextYaw = Number.isFinite(this._currentYaw)
            ? this._normalizeYaw(this._currentYaw)
            : targetYaw;
        if (this.turnSpeed > 0 && Number.isFinite(dt) && dt > 0) {
            const maxStep = this.turnSpeed * dt;
            const delta = this._getShortestYawDelta(nextYaw, targetYaw);
            if (Math.abs(delta) > maxStep) {
                nextYaw = this._normalizeYaw(nextYaw + Math.sign(delta) * maxStep);
            } else {
                nextYaw = targetYaw;
            }
        } else {
            nextYaw = targetYaw;
        }

        this._currentYaw = nextYaw;
        this.yaw.Teleport({
            position: this._yawPosition ?? this._getTurretBasePosition() ?? undefined,
            angles: {
                pitch: 0,
                yaw: nextYaw,
                roll: 0,
            },
        });
        return nextYaw;
    }

    /**
     * @param {number} currentYaw
     * @param {number} targetYaw
     */
    _getShortestYawDelta(currentYaw, targetYaw) {
        return this._normalizeYaw(targetYaw - currentYaw);
    }

    /**
     * @param {number} yaw
     */
    _normalizeYaw(yaw) {
        if (!Number.isFinite(yaw)) return yaw;

        let normalized = yaw % 360;
        if (normalized <= -180) {
            normalized += 360;
        }
        if (normalized > 180) {
            normalized -= 360;
        }
        return normalized;
    }

    /**
     * @param {{x:number,y:number,z:number} | undefined | null} vector
     */
    _cloneVector(vector) {
        if (!vector) return null;
        return {
            x: vector.x,
            y: vector.y,
            z: vector.z,
        };
    }

    /**
     * @param {{pitch:number,yaw:number,roll:number} | undefined | null} angles
     */
    _cloneAngles(angles) {
        if (!angles) return null;
        return {
            pitch: angles.pitch,
            yaw: angles.yaw,
            roll: angles.roll,
        };
    }

    /**
     * @param {{x:number,y:number,z:number}} a
     * @param {{x:number,y:number,z:number}} b
     */
    _distsq(a, b) {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dz = a.z - b.z;
        return dx * dx + dy * dy + dz * dz;
    }
}
