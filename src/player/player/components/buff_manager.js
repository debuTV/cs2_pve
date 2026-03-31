import * as BuffManagerModule from "../../../buff/buff_manager";

const { GenericBuffManager } = /** @type {any} */ (BuffManagerModule);
const BuffTargetType = {
    PLAYER: "player",
};

/**
 * @typedef {{hostKey?: string|null, targetType?: string|null, target?: any, player?: import("../player").Player|null, monster?: any}} PlayerBuffContext
 */

export class PlayerBuffManager {
    /** @param {import("../player").Player} player */
    constructor(player) {
        this.player = player;
        this._manager = new GenericBuffManager({
            targetType: BuffTargetType.PLAYER,
            target: player,
            player,
            hostId: player.id,
        });
        /** @type {any|null} */
        this._controller = null;
    }

    /** @param {any|null} controller */
    bindController(controller) {
        if (this._controller === controller) {
            if (controller) {
                controller.registerHost(BuffTargetType.PLAYER, this.player, this);
            }
            return;
        }

        if (this._controller) {
            this._controller.unregisterHost(BuffTargetType.PLAYER, this.player);
        }

        this._controller = controller;
        if (controller) {
            controller.registerHost(BuffTargetType.PLAYER, this.player, this);
        }
    }

    unbindController() {
        if (!this._controller) return;
        this._controller.unregisterHost(BuffTargetType.PLAYER, this.player);
        this._controller = null;
    }

    /**
     * @param {string} typeId
     * @param {Record<string, any>} [params]
     * @param {Record<string, any>|null} [source]
     * @param {PlayerBuffContext|null} [context]
     */
    addBuff(typeId, params, source, context = null) {
        if (this._controller) {
            return this._controller.createBuff({
                typeId,
                params,
                source,
                targetType: BuffTargetType.PLAYER,
                target: this.player,
                player: context?.player ?? this.player,
                monster: context?.monster ?? null,
            });
        }
        return this.addBuffLocal(typeId, params, source, context);
    }

    /**
     * @param {string} typeId
     * @param {Record<string, any>} [params]
     * @param {Record<string, any>|null} [source]
     * @param {PlayerBuffContext|null} [context]
     */
    addBuffLocal(typeId, params, source, context = null) {
        const before = this.getAllBuffsLocal();
        const result = this._manager.addBuff(typeId, params, source, this._normalizeContext(context));
        const after = this.getAllBuffsLocal();
        const { added, removed } = this._emitBuffCollectionChanges(before, after);

        if (result && added.length === 0 && removed.length === 0 && before.includes(result) && after.includes(result)) {
            this.player.events.OnBuffRefreshed?.(result);
        }
        return result;
    }

    /** @param {string|Record<string, any>|null|undefined} typeIdOrFilter */
    removeBuff(typeIdOrFilter) {
        return this.removeBuffLocal(typeIdOrFilter);
    }

    /** @param {string|Record<string, any>|null|undefined} typeIdOrFilter */
    removeBuffLocal(typeIdOrFilter) {
        return this._runWithBuffDiff(() => {
            if (typeIdOrFilter == null) return false;
            if (typeof typeIdOrFilter === "string") {
                return this._manager.removeBuff(typeIdOrFilter);
            }
            return this._manager.removeByFilter(typeIdOrFilter ?? {});
        });
    }

    /** @param {number} id */
    removeById(id) {
        return this.removeByIdLocal(id);
    }

    /** @param {number} id */
    removeByIdLocal(id) {
        return this._runWithBuffDiff(() => this._manager.removeById(id));
    }

    /** @param {string} tag */
    removeByTag(tag) {
        return this.removeByTagLocal(tag);
    }

    /** @param {string} tag */
    removeByTagLocal(tag) {
        return this._runWithBuffDiff(() => this._manager.removeByTag(tag));
    }

    /** @param {Record<string, any>} filter */
    removeByFilter(filter) {
        return this.removeByFilterLocal(filter);
    }

    /** @param {Record<string, any>} filter */
    removeByFilterLocal(filter) {
        return this._runWithBuffDiff(() => this._manager.removeByFilter(filter));
    }

    clearAll() {
        this.clearAllLocal();
    }

    clearAllLocal() {
        this._runWithBuffDiff(() => {
            this._manager.clearAll();
        });
    }

    clearCombatTemporary() {
        this.clearCombatTemporaryLocal();
    }

    clearCombatTemporaryLocal() {
        this._runWithBuffDiff(() => {
            this._manager.clearCombatTemporary();
        });
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

    /** @param {string} tag */
    getBuffsByTag(tag) {
        return this.getBuffsByTagLocal(tag);
    }

    /** @param {string} tag */
    getBuffsByTagLocal(tag) {
        return this._manager.getAllBuffs().filter((/** @type {any} */ buff) => buff.hasTag(tag));
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
        this._runWithBuffDiff(() => {
            this._manager.tick(dt);
        });
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
        this._runWithBuffDiff(() => {
            this._manager.onStateChange(oldState, newState);
        });
    }

    onRespawn() {
        this.onRespawnLocal();
    }

    onRespawnLocal() {
        this._runWithBuffDiff(() => {
            this._manager.onRespawn();
        });
    }

    recomputeModifiers() {
        this.recomputeModifiersLocal();
    }

    recomputeModifiersLocal() {
        this._manager.recomputeModifiers();
    }

    /**
     * 在本地 Buff 集合发生变化后，统一把 added / removed 事件抛给 Player。
     * 这样 PlayerManager 只需订阅 Player 事件，再由 main 决定如何消费这些运行时变化。
     * @param {any[]} before
     * @param {any[]} after
     * @returns {{added: any[], removed: any[]}}
     */
    _emitBuffCollectionChanges(before, after) {
        const added = after.filter((buff) => !before.includes(buff));
        const removed = before.filter((buff) => !after.includes(buff));

        for (const buff of added) {
            this.player.events.OnBuffAdded?.(buff);
        }
        for (const buff of removed) {
            this.player.events.OnBuffRemoved?.(buff);
        }

        return { added, removed };
    }

    /**
     * 对所有本地会改写 Buff 集合的方法做统一包裹，避免遗漏 removed 事件。
     * @template T
     * @param {() => T} mutation
     * @returns {T}
     */
    _runWithBuffDiff(mutation) {
        const before = this.getAllBuffsLocal();
        const result = mutation();
        const after = this.getAllBuffsLocal();
        this._emitBuffCollectionChanges(before, after);
        return result;
    }

    /** @param {PlayerBuffContext|null} [context] */
    _normalizeContext(context) {
        return {
            targetType: BuffTargetType.PLAYER,
            target: this.player,
            player: context?.player ?? this.player,
            monster: context?.monster ?? null,
            hostKey: context?.hostKey ?? null,
        };
    }
}
