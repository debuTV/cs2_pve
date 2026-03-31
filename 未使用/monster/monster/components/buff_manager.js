import { GenericBuffManager } from "../../../buff/buff_manager";
import { BuffTargetType } from "../../../buff/buff_const";

/**
 * @typedef {{hostKey?: string|null, targetType?: string|null, target?: any, player?: any, monster?: import("../monster").Monster|null}} MonsterBuffContext
 */

export class MonsterBuffManager {
    /** @param {import("../monster").Monster} monster */
    constructor(monster) {
        this.monster = monster;
        this._manager = new GenericBuffManager({
            targetType: BuffTargetType.MONSTER,
            target: monster,
            monster,
            hostId: monster.id,
        });
        /** @type {import("../../../buff/buff_manager").GlobalBuffManager|null} */
        this._controller = null;
    }

    /** @param {import("../../../buff/buff_manager").GlobalBuffManager|null} controller */
    bindController(controller) {
        if (this._controller === controller) {
            if (controller) {
                controller.registerHost(BuffTargetType.MONSTER, this.monster, this);
            }
            return;
        }

        if (this._controller) {
            this._controller.unregisterHost(BuffTargetType.MONSTER, this.monster);
        }

        this._controller = controller;
        if (controller) {
            controller.registerHost(BuffTargetType.MONSTER, this.monster, this);
        }
    }

    unbindController() {
        if (!this._controller) return;
        this._controller.unregisterHost(BuffTargetType.MONSTER, this.monster);
        this._controller = null;
    }

    /**
     * @param {string} typeId
     * @param {Record<string, any>} [params]
     * @param {Record<string, any>|null} [source]
     * @param {MonsterBuffContext|null} [context]
     */
    addBuff(typeId, params, source, context = null) {
        if (this._controller) {
            return this._controller.createBuff({
                typeId,
                params,
                source,
                targetType: BuffTargetType.MONSTER,
                target: this.monster,
                player: context?.player ?? null,
                monster: context?.monster ?? this.monster,
            });
        }
        return this.addBuffLocal(typeId, params, source, context);
    }

    /**
     * @param {string} typeId
     * @param {Record<string, any>} [params]
     * @param {Record<string, any>|null} [source]
     * @param {MonsterBuffContext|null} [context]
     */
    addBuffLocal(typeId, params, source, context = null) {
        return this._manager.addBuff(typeId, params, source, this._normalizeContext(context));
    }

    /** @param {string|Record<string, any>|null|undefined} typeIdOrFilter */
    removeBuff(typeIdOrFilter) {
        return this.removeBuffLocal(typeIdOrFilter);
    }

    /** @param {string|Record<string, any>|null|undefined} typeIdOrFilter */
    removeBuffLocal(typeIdOrFilter) {
        if (typeIdOrFilter == null) return false;
        if (typeof typeIdOrFilter === "string") {
            return this._manager.removeBuff(typeIdOrFilter);
        }
        return this._manager.removeByFilter(typeIdOrFilter ?? {});
    }

    /** @param {number} id */
    removeById(id) {
        return this.removeByIdLocal(id);
    }

    /** @param {number} id */
    removeByIdLocal(id) {
        return this._manager.removeById(id);
    }

    /** @param {string} tag */
    removeByTag(tag) {
        return this.removeByTagLocal(tag);
    }

    /** @param {string} tag */
    removeByTagLocal(tag) {
        return this._manager.removeByTag(tag);
    }

    /** @param {Record<string, any>} filter */
    removeByFilter(filter) {
        return this.removeByFilterLocal(filter);
    }

    /** @param {Record<string, any>} filter */
    removeByFilterLocal(filter) {
        return this._manager.removeByFilter(filter);
    }

    clearAll() {
        this.clearAllLocal();
    }

    clearAllLocal() {
        this._manager.clearAll();
    }

    clearCombatTemporary() {
        this.clearCombatTemporaryLocal();
    }

    clearCombatTemporaryLocal() {
        this._manager.clearCombatTemporary();
    }

    /** @param {string} typeId */
    getBuff(typeId) {
        return this.getBuffLocal(typeId);
    }

    /** @param {string} typeId */
    getBuffLocal(typeId) {
        return this._manager.getBuff(typeId);
    }

    /** @param {string} typeId */
    hasBuff(typeId) {
        return this.hasBuffLocal(typeId);
    }

    /** @param {string} typeId */
    hasBuffLocal(typeId) {
        return this._manager.hasBuff(typeId);
    }

    getAllBuffs() {
        return this.getAllBuffsLocal();
    }

    getAllBuffsLocal() {
        return this._manager.getAllBuffs();
    }

    /** @param {number} dt */
    tick(dt) {
        if (this._controller) return;
        this.tickLocal(dt);
    }

    /** @param {number} dt */
    tickLocal(dt) {
        this._manager.tick(dt);
    }

    /** @param {any} ctx */
    onBeforeDamageTaken(ctx) {
        this.onBeforeDamageTakenLocal(ctx);
    }

    /** @param {any} ctx */
    onBeforeDamageTakenLocal(ctx) {
        this._manager.onBeforeDamageTaken(ctx);
    }

    /** @param {any} ctx */
    onAfterDamageTaken(ctx) {
        this.onAfterDamageTakenLocal(ctx);
    }

    /** @param {any} ctx */
    onAfterDamageTakenLocal(ctx) {
        this._manager.onAfterDamageTaken(ctx);
    }

    /**
     * @param {number} oldState
     * @param {number} newState
     */
    onStateChange(oldState, newState) {
        this.onStateChangeLocal(oldState, newState);
    }

    /**
     * @param {number} oldState
     * @param {number} newState
     */
    onStateChangeLocal(oldState, newState) {
        this._manager.onStateChange(oldState, newState);
    }

    onRespawn() {
        this.onRespawnLocal();
    }

    onRespawnLocal() {
        this._manager.onRespawn();
    }

    recomputeModifiers() {
        this.recomputeModifiersLocal();
    }

    recomputeModifiersLocal() {
        this._manager.recomputeModifiers();
    }

    /** @param {MonsterBuffContext|null} [context] */
    _normalizeContext(context) {
        return {
            targetType: BuffTargetType.MONSTER,
            target: this.monster,
            player: context?.player ?? null,
            monster: context?.monster ?? this.monster,
            hostKey: context?.hostKey ?? null,
        };
    }
}
