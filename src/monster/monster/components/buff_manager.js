import { GenericBuffManager } from "../../../buff/buff_manager";
import { TEMP_DISABLE } from "../../../runtime_flags";
import { MonsterBuffHostAdapter } from "./buff_host_adapter";

export class MonsterBuffManager {
    constructor(monster) {
        this.monster = monster;
        this.adapter = new MonsterBuffHostAdapter(monster);
        this._manager = new GenericBuffManager(this.adapter);
    }

    addBuff(typeId, params, source) {
        if (TEMP_DISABLE.monsterBuffs) return null;
        return this._manager.addBuff(typeId, params, source);
    }

    removeBuff(typeIdOrFilter) {
        if (TEMP_DISABLE.monsterBuffs) {
            return typeof typeIdOrFilter === "string" ? false : 0;
        }
        if (typeIdOrFilter == null) return false;
        if (typeof typeIdOrFilter === "string") {
            return this._manager.removeBuff(typeIdOrFilter);
        }
        return this._manager.removeByFilter(typeIdOrFilter ?? {});
    }

    removeById(id) {
        if (TEMP_DISABLE.monsterBuffs) return false;
        return this._manager.removeById(id);
    }

    removeByTag(tag) {
        if (TEMP_DISABLE.monsterBuffs) return 0;
        return this._manager.removeByTag(tag);
    }

    removeByFilter(filter) {
        if (TEMP_DISABLE.monsterBuffs) return 0;
        return this._manager.removeByFilter(filter);
    }

    clearAll() {
        if (TEMP_DISABLE.monsterBuffs) return;
        this._manager.clearAll();
    }

    clearCombatTemporary() {
        if (TEMP_DISABLE.monsterBuffs) return;
        this._manager.clearCombatTemporary();
    }

    getBuff(typeId) {
        if (TEMP_DISABLE.monsterBuffs) return null;
        return this._manager.getBuff(typeId);
    }

    hasBuff(typeId) {
        if (TEMP_DISABLE.monsterBuffs) return false;
        return this._manager.hasBuff(typeId);
    }

    getAllBuffs() {
        if (TEMP_DISABLE.monsterBuffs) return [];
        return this._manager.getAllBuffs();
    }

    tick(dt) {
        if (TEMP_DISABLE.monsterBuffs) return;
        this._manager.tick(dt);
    }

    onBeforeDamageTaken(ctx) {
        if (TEMP_DISABLE.monsterBuffs) return;
        this._manager.onBeforeDamageTaken(ctx);
    }

    onAfterDamageTaken(ctx) {
        if (TEMP_DISABLE.monsterBuffs) return;
        this._manager.onAfterDamageTaken(ctx);
    }

    onStateChange(oldState, newState) {
        if (TEMP_DISABLE.monsterBuffs) return;
        this._manager.onStateChange(oldState, newState);
    }

    onRespawn() {
        if (TEMP_DISABLE.monsterBuffs) return;
        this._manager.onRespawn();
    }

    recomputeModifiers() {
        if (TEMP_DISABLE.monsterBuffs) return;
        this._manager.recomputeModifiers();
    }
}
