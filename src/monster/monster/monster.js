/**
 * @module 怪物系统/怪物实体
 */
import { BaseModelEntity, CSPlayerPawn, Entity, Instance } from "cs_script/point_script";
import { MonsterEntityBridge } from "./components/entity_bridge";
import { MonsterHealthCombat } from "./components/health_combat";
import { MonsterBrainState } from "./components/brain_state";
import { MonsterSkillsManager } from "./components/skills_manager";
import { MonsterMovementPathAdapter } from "./components/movement_path_adapter";
import { MonsterAnimator } from "./components/animation";
import { eventBus } from "../../eventBus/event_bus";
import { vec } from "../../util/vector";
import { event, MovementRequestType } from "../../util/definition";
import { MonsterBuffEvents, MonsterState } from "../monster_const";

/** @typedef {import("../../skill/skill_template").SkillTemplate} MonsterSkill */
/** @typedef {import("../../util/definition").MovementRequest} MovementRequest */
/**
 * @typedef {{
 *   buffId: number;
 *   typeId: string;
 *   params: Record<string, any>;
 *   groupKey: string | null;
 *   source: Record<string, any> | null;
 *   context: Record<string, any> | null;
 * }} MonsterBuffRuntime
 */
/** @typedef {{ type: string, [key: string]: any }} MonsterRuntimeEvent */

export class Monster {
    /**
     * @param {number} id
     * @param {import("cs_script/point_script").Vector} position
     * @param {import("../../util/definition").monsterTypes} typeConfig
     */
    constructor(id, position, typeConfig) {
        this.id = id;

        /** @type {Entity | null} */
        this.model = null;
        /** @type {Entity | null} */
        this.breakable = null;
        /** @type {MonsterSkill[]} */
        this.skills = [];

        this.type = typeConfig.name;

        this.baseMaxHealth = typeConfig.baseHealth;
        this.maxhealth = this.baseMaxHealth;
        this.health = this.baseMaxHealth;
        this.preBreakableHealth = 10000;

        this.baseDamage = typeConfig.baseDamage;
        this.damage = this.baseDamage;

        this.baseSpeed = typeConfig.speed;
        this.speed = this.baseSpeed;

        this.attackdist = typeConfig.attackdist;
        this.baseReward = typeConfig.reward;
        this.atc = typeConfig.attackCooldown;

        this.occupation = "";
        /** @type {CSPlayerPawn | null} */
        this.killer = null;

        this.entityBridge = new MonsterEntityBridge(this);
        this.healthCombat = new MonsterHealthCombat(this);
        this.brainState = new MonsterBrainState(this);
        this.skillsManager = new MonsterSkillsManager(this);
        this.movementPath = new MonsterMovementPathAdapter(this);
        /**
         * key 为 buff 类型。
         * value 为 buff id。
         * @type {Map<string, number>}
         */
        this.buffMap = new Map();
        /** @type {Map<string, MonsterBuffRuntime>} */
        this.buffStateMap = new Map();
        /** @type {Array<() => boolean>} */
        this._buffUnsubscribers = [
            eventBus.on(event.Buff.Out.OnBuffRemoved, (/** @type {import("../../buff/buff_const").OnBuffRemoved} */ payload) => {
                this._removeRuntimeByBuffId(payload.buffId);
            }),
        ];

        this.initEntities(position, typeConfig);
        this.animation = new MonsterAnimator(this, this.model, typeConfig.animations);

        this.state = MonsterState.IDLE;
        /** @type {CSPlayerPawn | null} */
        this.target = null;
        this.lastTargetUpdate = 0;
        this.attackCooldown = 0;
        this.lasttick = 0;
        this._runtimeReleased = false;
        this._deathFinalized = false;

        /** @type {string} */
        this.movementStateMovemode ="walk";

        this.initSkills(typeConfig.skill_pool);
        this.movementPath.init(typeConfig);
        this.animation.init(typeConfig.animations);
        this.recomputeDerivedStats();
    }

    init() {
        this.emitEvent({ type: MonsterBuffEvents.Spawn });
    }

    /**
     * @param {import("../../util/definition").skill_pool[] | undefined} skillPool
     */
    initSkills(skillPool) {
        this.skillsManager.initSkills(skillPool);
    }

    /**
     * @param {MonsterSkill} skill
     */
    addSkill(skill) {
        this.skillsManager.addSkill(skill);
    }

    /**
     * @param {import("cs_script/point_script").Vector} position
     * @param {import("../../util/definition").monsterTypes} typeConfig
     */
    initEntities(position, typeConfig) {
        this.entityBridge.init(position, typeConfig);
    }

    /**
     * @param {number} amount
     * @param {CSPlayerPawn | null} attacker
     * @param {{ source?: Entity | null, reason?: string } | null} [meta]
     * @returns {boolean}
     */
    takeDamage(amount, attacker, meta = null) {
        return this.healthCombat.takeDamage(amount, attacker, meta);
    }

    /**
     * @param {string} typeId
     * @param {Record<string, any>} [params]
     * @param {Record<string, any> | null} [source]
     * @param {Record<string, any> | null} [context]
     * @returns {boolean}
     */
    addBuff(typeId, params = {}, source = null, context = null) {
        if (this.buffMap.has(typeId)) return false;
        const normalizedParams = { ...(params ?? {}) };
        /** @type {import("../../buff/buff_const").BuffAddRequest} */
        const addRequest = {
            configid: typeId,
            target: this,
            targetType: "monster",
            result: -1,
        };
        eventBus.emit(event.Buff.In.BuffAddRequest, addRequest);
        if (addRequest.result <= 0) return false;

        this.buffMap.set(typeId, addRequest.result);
        this.buffStateMap.set(typeId, {
            buffId: addRequest.result,
            typeId,
            params: normalizedParams,
            groupKey: typeof normalizedParams.groupKey === "string" ? normalizedParams.groupKey : null,
            source,
            context,
        });
        this.recomputeDerivedStats();
        return true;
    }

    /**
     * @param {string} typeId
     * @param {Record<string, any>} [params]
     * @returns {boolean}
     */
    refreshBuff(typeId, params = {}) {
        const id = this.buffMap.get(typeId);
        if (id == null) return this.addBuff(typeId, params);

        /** @type {import("../../buff/buff_const").BuffRefreshRequest} */
        const refreshRequest = {
            buffId: id,
            result: false,
        };
        eventBus.emit(event.Buff.In.BuffRefreshRequest, refreshRequest);
        if (!refreshRequest.result) return false;

        const runtime = this.buffStateMap.get(typeId);
        if (runtime) {
            runtime.params = { ...(params ?? runtime.params) };
            runtime.groupKey = typeof runtime.params.groupKey === "string" ? runtime.params.groupKey : null;
        }
        this.recomputeDerivedStats();
        return true;
    }

    /**
     * @param {string | ((buff: MonsterBuffRuntime) => boolean)} typeIdOrFilter
     * @returns {boolean}
     */
    removeBuff(typeIdOrFilter) {
        if (typeof typeIdOrFilter === "string") {
            return this._removeBuffByTypeId(typeIdOrFilter);
        }

        let removed = false;
        for (const buff of this.getAllBuffs()) {
            if (!typeIdOrFilter(buff)) continue;
            removed = this._removeBuffByTypeId(buff.typeId) || removed;
        }
        return removed;
    }

    /**
     * @param {string} typeId
     * @returns {boolean}
     */
    hasBuff(typeId) {
        return this.buffMap.has(typeId);
    }

    /**
     * @returns {MonsterBuffRuntime[]}
     */
    getAllBuffs() {
        return Array.from(this.buffStateMap.values());
    }

    clearBuffs() {
        for (const typeId of Array.from(this.buffMap.keys())) {
            this._removeBuffByTypeId(typeId);
        }
    }

    dispose() {
        if (this.state !== MonsterState.DEAD) {
            this.state = MonsterState.DEAD;
            this.clearBuffs();
        }
        this.finalizeDeath(true);
    }

    finalizeDeath(removeModelAfterDeathAnimation = true) {
        if (this._deathFinalized) return false;
        this._deathFinalized = true;
        this.emitEvent({ type: MonsterBuffEvents.ModelRemove });
        this._releaseRuntime();
        this.entityBridge.removeAfterDeath(removeModelAfterDeathAnimation);
        this.model = null;
        this.breakable = null;
        this.state = MonsterState.DEAD;
        return true;
    }

    /**
     * @param {string} eventName
     * @param {any} params
     */
    emitBuffEvent(eventName, params) {
        for (const id of this.buffMap.values()) {
            /** @type {import("../../buff/buff_const").BuffEmitRequest} */
            const emitRequest = {
                buffId: id,
                eventName,
                params,
                result: { result: false },
            };
            eventBus.emit(event.Buff.In.BuffEmitRequest, emitRequest);
        }
    }

    /**
     * @param {string} typeId
     * @returns {boolean}
     */
    _removeBuffByTypeId(typeId) {
        const id = this.buffMap.get(typeId);
        if (id == null) return false;

        /** @type {import("../../buff/buff_const").BuffRemoveRequest} */
        const removeRequest = {
            buffId: id,
            result: false,
        };
        eventBus.emit(event.Buff.In.BuffRemoveRequest, removeRequest);
        return removeRequest.result;
    }

    recomputeDerivedStats() {
        this.damage = this.baseDamage;
        this.speed = this.baseSpeed;
        this.emitBuffEvent("OnRecompute", { recompute: true });
        this.movementPath.refreshMovement();
    }

    /**
     * @param {number} buffId
     */
    _removeRuntimeByBuffId(buffId) {
        for (const [typeId, id] of this.buffMap.entries()) {
            if (id !== buffId) continue;
            this.buffMap.delete(typeId);
            this.buffStateMap.delete(typeId);
            this.recomputeDerivedStats();
            break;
        }
    }

    _releaseRuntime() {
        if (this._runtimeReleased) return;
        this._runtimeReleased = true;
        for (const unsubscribe of this._buffUnsubscribers) {
            unsubscribe();
        }
        this._buffUnsubscribers.length = 0;
        this.skillsManager.clear();
        this.buffMap.clear();
        this.buffStateMap.clear();
        this.target = null;
        this.killer = null;
    }

    /**
     * @param {Entity | null | undefined} killer
     */
    die(killer) {
        this.healthCombat.die(killer);
    }

    /**
     * @param {import("../monster_const").MonsterSpawnRequest["options"]} options
     * @returns {boolean}
     */
    requestSpawn(options) {
        /** @type {import("../monster_const").MonsterSpawnRequest} */
        const payload = {
            monster: this,
            options,
            result: false,
        };
        eventBus.emit(event.Monster.In.SpawnRequest, payload);
        return payload.result;
    }

    /**
     * @param {number} amount
     * @param {CSPlayerPawn|null|undefined} attacker
     * @returns {number|void}
     */
    requestBeforeTakeDamage(amount, attacker) {
        /** @type {import("../monster_const").MonsterBeforeTakeDamageRequest} */
        const payload = {
            monster: this,
            amount,
            attacker: attacker ?? null,
            result: amount,
        };
        eventBus.emit(event.Monster.In.BeforeTakeDamageRequest, payload);
        return payload.result;
    }

    /**
     * @param {number} damage
     * @param {CSPlayerPawn} target
     */
    emitAttackEvent(damage, target) {
        /** @type {import("../monster_const").OnMonsterAttack} */
        const payload = { monster: this, damage, target };
        eventBus.emit(event.Monster.Out.OnAttack, payload);
    }

    /**
     * @param {Entity|null|undefined} killer
     */
    emitDeathEvent(killer) {
        /** @type {import("../monster_const").OnMonsterDeath} */
        const payload = { monster: this, killer, reward: this.baseReward };
        eventBus.emit(event.Monster.Out.OnMonsterDeath, payload);
    }

    /**
     * @param {CSPlayerPawn[]} allppos
     */
    tick(allppos) {
        if (!this.model || !this.breakable?.IsValid()) return;
        if (this.state === MonsterState.DEAD) return;

        const now = Instance.GetGameTime();
        const dt = this.lasttick > 0 ? now - this.lasttick : 0;
        this.lasttick = now;

        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }

        if (dt > 0) {
            this.emitBuffEvent(MonsterBuffEvents.Tick, { dt });
        }
        if (this.state === MonsterState.DEAD) return;

        this.emitEvent({ type: MonsterBuffEvents.Tick, dt });
        this.skillsManager.tickRunningSkills();

        if (now - this.lastTargetUpdate > 3.0 || !this.target) {
            this.updateTarget(allppos);
            this.lastTargetUpdate = now;
        }
        if (!this.target) return;
        if (this.isOccupied()) return;

        const intent = this.evaluateIntent();
        this.resolveIntent(intent);
        this.animation.tick(this.state);
    }

    /**
     * @param {CSPlayerPawn[]} allppos
     */
    updateTarget(allppos) {
        const prevTarget = this.target;
        this.brainState.updateTarget(allppos);
        if (this.target !== prevTarget) {
            this.movementPath.onTargetChanged();
        }
    }

    isOccupied() {
        return this.animation.isOccupied();
    }

    /**
     * @param {MonsterRuntimeEvent} event
     */
    emitEvent(event) {
        this.skillsManager.emitEvent(event);
    }

    /**
     * @returns {number}
     */
    evaluateIntent() {
        return this.brainState.evaluateIntent();
    }

    /**
     * @param {number} intent
     */
    resolveIntent(intent) {
        this.brainState.resolveIntent(intent);
    }

    /**
     * @param {number} nextState
     * @returns {boolean}
     */
    trySwitchState(nextState) {
        return this.brainState.trySwitchState(nextState);
    }

    /**
     * @param {number} nextState
     * @returns {boolean}
     */
    applyStateTransition(nextState) {
        if (this.state === nextState) return true;
        if (this.state === MonsterState.DEAD) return false;
        if (this.isOccupied()) return false;
        if (!this.animation.canSwitch()) return false;

        const prevState = this.state;
        this.state = nextState;
        this.emitBuffEvent("OnStateChange", { oldState: prevState, nextState });
        this.animation.enter(nextState);

        if (nextState === MonsterState.CHASE || nextState === MonsterState.ATTACK) {
            this.movementPath.activate();
        } else if (prevState === MonsterState.CHASE || prevState === MonsterState.ATTACK) {
            this.movementPath.deactivate();
        }
        return true;
    }

    enterSkill() {
        this.movementPath.deactivate();
        this.animation.setOccupation("skill");
        this.skillsManager.triggerRequestedSkill();
    }

    enterAttack() {
        this.healthCombat.enterAttack();
    }

    /**
     * @param {Entity} ent
     * @returns {number}
     */
    distanceTosq(ent) {
        if(!this.model)return Infinity;
        const a = this.model.GetAbsOrigin();
        const b = ent.GetAbsOrigin();
        return vec.lengthsq(a, b);
    }

    /**
     * @param {string} type
     */
    onOccupationEnd(type) {
        this.animation.onOccupationEnd(type);
        this.movementPath.onOccupationChanged();
    }

    /**
     * @param {MonsterSkill} skill
     */
    requestSkill(skill) {
        this.skillsManager.requestSkill(skill);
    }

    /**
     * @param {MovementRequest} request
     * @returns {boolean}
     */
    submitMovementEvent(request) {
        switch (request?.type) {
            case MovementRequestType.Move:
                eventBus.emit(event.Movement.In.MoveRequest, request);
                return true;
            case MovementRequestType.Stop:
                eventBus.emit(event.Movement.In.StopRequest, request);
                return true;
            case MovementRequestType.Remove:
                eventBus.emit(event.Movement.In.RemoveRequest, request);
                return true;
            default:
                return false;
        }
    }

    /**
     * @param {string} movemode
     */
    updateMovementMovemode(movemode) {
        this.movementStateMovemode = movemode;
    }
}
