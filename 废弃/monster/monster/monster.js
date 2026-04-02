/**
 * @module 怪物系统/怪物实体
 */
import { CSPlayerPawn, Entity, Instance } from "cs_script/point_script";
import { MonsterBuffEvents, MonsterState } from "./monster_state";
import { MonsterEntityBridge } from "./components/entity_bridge";
import { MonsterHealthCombat } from "./components/health_combat";
import { MonsterBrainState } from "./components/brain_state";
import { MonsterSkillsManager } from "./components/skills_manager";
import { MonsterMovementPathAdapter } from "./components/movement_path_adapter";
import { MonsterAnimationOccupation } from "./components/animation_occupation";
import { MonsterBuffManager } from "./components/buff_manager";
import { vec } from "../../util/vector";

export class Monster {
    constructor(id, position, typeConfig) {
        this.id = id;

        /** @type {Entity} */
        this.model = undefined;
        /** @type {Entity} */
        this.breakable = undefined;
        /** @type {import("./skill_manager").SkillTemplate[]} */
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
        this.events = new MonsterEvents();
        /** @type {CSPlayerPawn | null} */
        this.killer = null;

        this.entityBridge = new MonsterEntityBridge(this);
        this.healthCombat = new MonsterHealthCombat(this);
        this.buffManager = new MonsterBuffManager(this);
        this.brainState = new MonsterBrainState(this);
        this.skillsManager = new MonsterSkillsManager(this);
        this.movementPath = new MonsterMovementPathAdapter(this);
        this.animationOccupation = new MonsterAnimationOccupation(this);

        this.initEntities(position, typeConfig);

        this.state = MonsterState.IDLE;
        /** @type {CSPlayerPawn | null} */
        this.target = null;
        this.lastTargetUpdate = 0;
        this.attackCooldown = 0;
        this.lasttick = 0;

        /** @type {{ mode: string; onGround: boolean; currentGoalMode: number | null; }} */
        this.movementStateSnapshot = {
            mode: "walk",
            onGround: true,
            currentGoalMode: null,
        };

        /** @type {import("./animator").MonsterAnimator} */
        this.animator = undefined;

        this.initSkills(typeConfig.skill_pool);
        this.movementPath.init(typeConfig);
        this.animationOccupation.init(typeConfig.animations);
        this.buffManager.recomputeModifiers();
    }

    init() {
        this.emitEvent({ type: MonsterBuffEvents.Spawn });
    }

    initSkills(skillPool) {
        this.skillsManager.initSkills(skillPool);
    }

    addSkill(skill) {
        this.skillsManager.addSkill(skill);
    }

    initEntities(position, typeConfig) {
        this.entityBridge.init(position, typeConfig);
    }

    takeDamage(amount, attacker) {
        return this.healthCombat.takeDamage(amount, attacker);
    }

    addBuff(typeId, params, source, context) {
        return this.buffManager.addBuff(typeId, params, source, context);
    }

    removeBuff(typeIdOrFilter) {
        return this.buffManager.removeBuff(typeIdOrFilter);
    }

    hasBuff(typeId) {
        return this.buffManager.hasBuff(typeId);
    }

    getAllBuffs() {
        return this.buffManager.getAllBuffs();
    }

    die(killer) {
        this.healthCombat.die(killer);
    }

    requestSpawn(options) {
        if (!this.events.onSpawnRequest) return false;
        return this.events.onSpawnRequest(this, options) === true;
    }

    tick(allmpos, allppos) {
        if (!this.model || !this.breakable?.IsValid()) return;
        if (this.state === MonsterState.DEAD) return;

        const now = Instance.GetGameTime();
        const dt = this.lasttick > 0 ? now - this.lasttick : 0;
        this.lasttick = now;

        if (this.attackCooldown > 0) {
            this.attackCooldown -= dt;
        }

        if (dt > 0) {
            this.buffManager.tick(dt);
        }
        if (this.state === MonsterState.DEAD) return;

        this.emitEvent({ type: MonsterBuffEvents.Tick, dt, allmpos });
        this.skillsManager.tickRunningSkills();

        if (now - this.lastTargetUpdate > 3.0 || !this.target) {
            this.updateTarget(allppos);
            this.lastTargetUpdate = now;
        }
        if (!this.target) return;
        if (this.isOccupied()) return;

        const intent = this.evaluateIntent();
        this.resolveIntent(intent);
        this.animationOccupation.tick(this.state);
    }

    updateTarget(allppos) {
        const prevTarget = this.target;
        this.brainState.updateTarget(allppos);
        if (this.target !== prevTarget) {
            this.movementPath.onTargetChanged();
        }
    }

    isOccupied() {
        return this.animationOccupation.isOccupied();
    }

    emitEvent(event) {
        this.skillsManager.emitEvent(event);
    }

    evaluateIntent() {
        return this.brainState.evaluateIntent();
    }

    resolveIntent(intent) {
        this.brainState.resolveIntent(intent);
    }

    trySwitchState(nextState) {
        return this.brainState.trySwitchState(nextState);
    }

    applyStateTransition(nextState) {
        if (this.state === nextState) return true;
        if (this.state === MonsterState.DEAD) return false;
        if (this.isOccupied()) return false;
        if (!this.animationOccupation.canSwitch()) return false;

        const prevState = this.state;
        this.state = nextState;
        this.buffManager.onStateChange(prevState, nextState);
        this.animationOccupation.enter(nextState);

        if (nextState === MonsterState.CHASE || nextState === MonsterState.ATTACK) {
            this.movementPath.activate();
        } else if (prevState === MonsterState.CHASE || prevState === MonsterState.ATTACK) {
            this.movementPath.deactivate();
        }
        return true;
    }

    enterSkill() {
        this.movementPath.deactivate();
        this.animationOccupation.setOccupation("skill");
        this.skillsManager.triggerRequestedSkill();
    }

    enterAttack() {
        this.healthCombat.enterAttack();
    }

    distanceTosq(ent) {
        const a = this.model.GetAbsOrigin();
        const b = ent.GetAbsOrigin();
        return vec.lengthsq(a, b);
    }

    onOccupationEnd(type) {
        this.animationOccupation.onOccupationEnd(type);
        this.movementPath.onOccupationChanged();
    }

    requestSkill(skill) {
        this.skillsManager.requestSkill(skill);
    }

    submitMovementEvent(request) {
        this.events.onMovementEvent?.(request);
    }

    updateMovementSnapshot(snapshot) {
        this.movementStateSnapshot = snapshot;
    }
}

export class MonsterEvents {
    constructor() {
        /** @type {((monster: Monster, killer: CSPlayerPawn | null) => void) | null} */
        this.OnDie = null;
        /** @type {((damage: number, target: CSPlayerPawn) => void) | null} */
        this.OnAttackTrue = null;
        /** @type {((id: string, target: CSPlayerPawn, payload?: any) => void) | null} */
        this.OnSkillCast = null;
        /** @type {((monster: Monster, amount: number, attacker: CSPlayerPawn | null) => number | void) | null} */
        this.OnBeforeTakeDamage = null;
        /** @type {((caster: Monster, options: any) => boolean) | null} */
        this.onSpawnRequest = null;
        /** @type {((desc: any) => void) | null} */
        this.onAreaEffectRequest = null;
        /** @type {((event: any) => void) | null} */
        this.onMovementEvent = null;
        this.OnBuffAddedRequest = null;
        this.OnBuffRemovedRequest = null;
        this.OnBuffRefreshedRequest = null;
        this.OnBuffEmitEvent=null;
    }
    /**
     * @param {(typeId: string, params: Record<string, any>) => number|null} _OnBuffAddedRequest
     * @param {(buffId: number) => boolean} _OnBuffRemovedRequest
     * @param {(buffId: number, params: Record<string, any>) => boolean} _OnBuffRefreshedRequest
     * @param {(buffId: number, event: string, params: any) => boolean} _OnBuffEmitEvent
     */
    setBuffEvent(_OnBuffAddedRequest, _OnBuffRemovedRequest, _OnBuffRefreshedRequest,_OnBuffEmitEvent)
    {
        /**
         * 请求获得Buff事件回调。
         * @type {null|((typeId: string, params: Record<string, any>) => number|null)}
         */
        this.OnBuffAddedRequest = _OnBuffAddedRequest;
        /**
         * 请求失去Buff事件回调。
         * @type {null|((buffId: number) => boolean)}
         */
        this.OnBuffRemovedRequest = _OnBuffRemovedRequest;
        /**
         * 请求刷新Buff事件回调。
         * @type {null|((buffId: number, params: Record<string, any>) => boolean)}
         */
        this.OnBuffRefreshedRequest = _OnBuffRefreshedRequest;
        /**
         * Buff 发出事件回调。
         * @type {null|((buffId: number, event: string, params: any) => boolean)}
         */
        this.OnBuffEmitEvent = _OnBuffEmitEvent;
    }
    setOnDie(callback) {
        this.OnDie = callback;
    }

    setOnAttackTrue(callback) {
        this.OnAttackTrue = callback;
    }

    setOnSkillCast(callback) {
        this.OnSkillCast = callback;
    }

    setOnBeforeTakeDamage(callback) {
        this.OnBeforeTakeDamage = callback;
    }

    setOnSpawnRequest(callback) {
        this.onSpawnRequest = callback;
    }

    setOnAreaEffectRequest(callback) {
        this.onAreaEffectRequest = callback;
    }

    setOnMovementEvent(callback) {
        this.onMovementEvent = callback;
    }
}
