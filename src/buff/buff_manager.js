import { Instance } from "cs_script/point_script";
import { BuffPersistPolicy, BuffStackMode } from "./buff_const";
import { recomputePassiveEffects } from "./builtin_effects";
import { BuffRegistry } from "./buff_registry";
import { BuffTemplate } from "./buff_template";

function matchesFilter(buff, filter) {
    if (!filter) return true;
    if (filter.typeId && buff.typeId !== filter.typeId) return false;
    if (filter.polarity && buff.polarity !== filter.polarity) return false;
    if (filter.persistPolicy && buff.persistPolicy !== filter.persistPolicy) return false;

    if (Array.isArray(filter.tagsAny) && filter.tagsAny.length > 0) {
        if (!filter.tagsAny.some((tag) => buff.hasTag(tag))) return false;
    }

    if (Array.isArray(filter.tagsAll) && filter.tagsAll.length > 0) {
        if (!filter.tagsAll.every((tag) => buff.hasTag(tag))) return false;
    }

    if (filter.sourceType && buff.source?.sourceType !== filter.sourceType) return false;
    if (filter.sourceId !== undefined && buff.source?.sourceId !== filter.sourceId) return false;
    return true;
}

export class GenericBuffManager {
    constructor(adapter) {
        this.adapter = adapter;
        this._buffs = [];
        this._nextId = 1;
        this._previousStatKeys = new Set();
        this._previousGainKeys = new Set();
    }

    addBuff(typeId, params = {}, source = null) {
        const definition = BuffRegistry.get(typeId);
        if (!definition) {
            Instance.Msg(`[Buff] unknown buff type "${typeId}"`);
            return null;
        }
        if (!definition.targetTypes.includes(this.adapter.hostType)) {
            Instance.Msg(`[Buff] "${typeId}" does not support target "${this.adapter.hostType}"`);
            return null;
        }

        const newBuff = new BuffTemplate(this, definition, params, source);
        const existing = this._findByGroupKey(newBuff.groupKey);
        if (existing) {
            switch (newBuff.stackMode) {
                case BuffStackMode.REJECT:
                    return null;
                case BuffStackMode.REFRESH:
                    existing.onRefresh(newBuff);
                    this.recomputeModifiers();
                    this.adapter.emitBuffEvent("refreshed", existing);
                    return existing;
                case BuffStackMode.STACK:
                    if (existing.stacks < existing.maxStacks) {
                        existing.onStack(newBuff);
                        this.recomputeModifiers();
                        this.adapter.emitBuffEvent("refreshed", existing);
                    }
                    return existing;
                case BuffStackMode.REPLACE_WEAKER:
                    if (newBuff.priority > existing.priority) {
                        this._removeInstance(existing);
                        return this._addInstance(newBuff);
                    }
                    return null;
                case BuffStackMode.INDEPENDENT:
                default:
                    break;
            }
        }

        return this._addInstance(newBuff);
    }

    removeBuff(typeId) {
        const buff = this.getBuff(typeId);
        if (!buff) return false;
        this._removeInstance(buff);
        return true;
    }

    removeById(id) {
        const buff = this._buffs.find((entry) => entry.id === id);
        if (!buff) return false;
        this._removeInstance(buff);
        return true;
    }

    removeByTag(tag) {
        return this.removeByFilter({ tagsAny: [tag] });
    }

    removeByFilter(filter) {
        const matched = this._buffs.filter((buff) => matchesFilter(buff, filter));
        for (const buff of matched) {
            this._removeInstance(buff);
        }
        return matched.length;
    }

    clearAll() {
        const snapshot = [...this._buffs];
        for (const buff of snapshot) {
            this._removeInstance(buff);
        }
    }

    clearCombatTemporary() {
        this.removeByFilter({ persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY });
    }

    hasBuff(typeId) {
        return !!this.getBuff(typeId);
    }

    getBuff(typeId) {
        return this._buffs.find((buff) => buff.typeId === typeId);
    }

    getAllBuffs() {
        return [...this._buffs];
    }

    tick(dt) {
        for (const buff of [...this._buffs]) {
            buff.onTick(dt);
        }

        const expired = this._buffs.filter((buff) => buff.expired);
        for (const buff of expired) {
            this._removeInstance(buff);
        }
    }

    onStateChange(oldState, newState) {
        for (const buff of [...this._buffs]) {
            buff.onStateChange(oldState, newState);
        }
    }

    onRespawn() {
        for (const buff of [...this._buffs]) {
            buff.onRespawn();
        }
    }

    onBeforeDamageTaken(ctx) {
        for (const buff of [...this._buffs]) {
            buff.onBeforeDamageTaken(ctx);
            if (ctx.damage <= 0) break;
        }
    }

    onAfterDamageTaken(ctx) {
        for (const buff of [...this._buffs]) {
            buff.onAfterDamageTaken(ctx);
        }
    }

    recomputeModifiers() {
        const result = recomputePassiveEffects(
            this.adapter,
            this._buffs,
            this._previousStatKeys,
            this._previousGainKeys
        );
        this._previousStatKeys = result.statKeys;
        this._previousGainKeys = result.gainKeys;
    }

    _findByGroupKey(groupKey) {
        return this._buffs.find((buff) => buff.groupKey === groupKey);
    }

    _addInstance(buff) {
        buff.id = this._nextId++;
        this._buffs.push(buff);
        buff.onAdd();
        this.recomputeModifiers();
        this.adapter.emitBuffEvent("added", buff);
        if (buff.expired) {
            this._removeInstance(buff);
        }
        return buff;
    }

    _removeInstance(buff) {
        const index = this._buffs.indexOf(buff);
        if (index === -1) return;
        this._buffs.splice(index, 1);
        buff.onRemove();
        this.recomputeModifiers();
        this.adapter.emitBuffEvent("removed", buff);
    }
}
