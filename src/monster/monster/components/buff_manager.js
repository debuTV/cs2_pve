import { eventBus } from "../../../eventBus/event_bus";
import { event as eventDefs } from "../../../util/definition";
import { MonsterBuffEvents } from "../../monster_const";

/**
 * @typedef {object} MonsterBuffRuntime
 * @property {number} buffId
 * @property {string} typeId
 * @property {Record<string, any>} params
 * @property {string | null} groupKey
 * @property {Record<string, any> | null} source
 * @property {Record<string, any> | null} context
 */


export class MonsterBuffManager {
    /** @param {import("../monster").Monster} monster */
    constructor(monster) {
        this.monster = monster;
        /**
         * key 为 buff 类型。
         * value 为 buff id。
         * @type {Map<string, number>}
         */
        this.buffMap = new Map();
        /** @type {Map<string, MonsterBuffRuntime>} */
        this.buffStateMap = new Map();
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(eventDefs.Buff.Out.OnBuffRemoved, (/** @type {import("../../../buff/buff_const").OnBuffRemoved} */ payload) => {
                this._removeRuntimeByBuffId(payload.buffId);
            }),
        ];
    }

    /**
     * 添加 Buff。成功添加返回 true，已存在同类型 Buff 或添加失败返回 false。
     * @param {string} typeId
     * @param {Record<string, any>} params
     * @param {Record<string, any> | null} [source]
     * @param {Record<string, any> | null} [context]
     */
    addBuff(typeId, params = {}, source = null, context = null) {
        if(this.buffMap.has(typeId))return false;
        const normalizedParams = { ...(params ?? {}) };
        /** @type {import("../../../buff/buff_const").BuffAddRequest} */
        const addRequest = {
            configid: typeId,
            target: this.monster,
            targetType: "monster",
            result: -1,
        };
        eventBus.emit(eventDefs.Buff.In.BuffAddRequest, addRequest);
        if(addRequest.result <= 0)return false;
        this.buffMap.set(typeId, addRequest.result);
        this.buffStateMap.set(typeId, {
            buffId: addRequest.result,
            typeId,
            params: normalizedParams,
            groupKey: typeof normalizedParams.groupKey === "string" ? normalizedParams.groupKey : null,
            source,
            context,
        });
        return true;
    }

    /**
     * 刷新 Buff。成功刷新返回 true，未找到对应类型 Buff 自动添加，刷新失败返回 false。
     * @param {string} typeId
     * @param {Record<string, any>} params
     */
    refreshBuff(typeId, params) {
        const id=this.buffMap.get(typeId);
        if(id == null)return this.addBuff(typeId, params);
        /** @type {import("../../../buff/buff_const").BuffRefreshRequest} */
        const refreshRequest = {
            buffId: id,
            result: false,
        };
        eventBus.emit(eventDefs.Buff.In.BuffRefreshRequest, refreshRequest);
        if(!refreshRequest.result)return false;
        const runtime = this.buffStateMap.get(typeId);
        if (runtime) {
            runtime.params = { ...(params ?? runtime.params) };
            runtime.groupKey = typeof runtime.params.groupKey === "string" ? runtime.params.groupKey : null;
        }
        return true;
    }

    /**
     * @returns {MonsterBuffRuntime[]}
     */
    getAllBuffs() {
        return Array.from(this.buffStateMap.values());
    }

    /**
     * @param {string} typeId
     * @returns {boolean}
     */
    hasBuff(typeId) {
        return this.buffMap.has(typeId);
    }

    recomputeModifiers() {
        this.emitEvent("OnRecompute", { recompute: true });
    }

    /**
     * @param {number} dt
     * @param {import("cs_script/point_script").Entity[]} [allmpos]
     */
    tick(dt, allmpos = []) {
        this.emitEvent(MonsterBuffEvents.Tick, { dt, allmpos });
    }

    /**
     * @param {{ damage: number, attacker: import("cs_script/point_script").CSPlayerPawn | null, source: any, reason?: string }} ctx
     */
    onBeforeDamageTaken(ctx) {
        this.emitEvent(MonsterBuffEvents.BeforeTakeDamage, ctx);
    }

    /**
     * @param {{ damage: number, attacker: import("cs_script/point_script").CSPlayerPawn | null, source: any, reason?: string }} ctx
     */
    onAfterDamageTaken(ctx) {
        this.emitEvent(MonsterBuffEvents.TakeDamage, ctx);
    }

    /**
     * @param {number} prevState
     * @param {number} nextState
     */
    onStateChange(prevState, nextState) {
        this.emitEvent("OnStateChange", { oldState: prevState, nextState });
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

    clearAll() {
        for(const [typeId] of this.buffMap.entries()){
            this._removeBuffByTypeId(typeId);
        }
    }
    /**
     * @param {string} eventName
     * @param {any} params 
     */
    emitEvent(eventName,params) {
        for(const [, id] of this.buffMap.entries()){
            /** @type {import("../../../buff/buff_const").BuffEmitRequest} */
            const emitRequest = {
                buffId: id,
                eventName,
                params,
                result: { result: false },
            };
            eventBus.emit(eventDefs.Buff.In.BuffEmitRequest, emitRequest);
        }
    }

    /**
     * @param {string} typeId
     * @returns {boolean}
     */
    _removeBuffByTypeId(typeId) {
        const id = this.buffMap.get(typeId);
        if (id == null) return false;

        /** @type {import("../../../buff/buff_const").BuffRemoveRequest} */
        const removeRequest = {
            buffId: id,
            result: false,
        };
        eventBus.emit(eventDefs.Buff.In.BuffRemoveRequest, removeRequest);
        if(!removeRequest.result)return false;

        this.buffMap.delete(typeId);
        this.buffStateMap.delete(typeId);
        return true;
    }

    /**
     * @param {number} buffId
     */
    _removeRuntimeByBuffId(buffId) {
        for (const [typeId, id] of this.buffMap.entries()) {
            if (id !== buffId) continue;
            this.buffMap.delete(typeId);
            this.buffStateMap.delete(typeId);
            break;
        }
    }
}