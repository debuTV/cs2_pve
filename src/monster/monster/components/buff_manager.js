import { eventBus } from "../../../eventBus/event_bus";
import { event as eventDefs } from "../../../util/definition";


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
    }

    /**
     * 添加 Buff。成功添加返回 true，已存在同类型 Buff 或添加失败返回 false。
     * @param {string} typeId
     * @param {Record<string, any>} params
     */
    addBuff(typeId, params) {
        if(this.buffMap.has(typeId))return false;
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
        return true;
    }

    /** 
     * 移除 Buff。成功移除返回 true，未找到对应类型 Buff 或移除失败返回 false。
     * @param {string} typeId
     */
    removeBuff(typeId) {
        const id=this.buffMap.get(typeId);
        if(id == null)return false;
        /** @type {import("../../../buff/buff_const").BuffRemoveRequest} */
        const removeRequest = {
            buffId: id,
            result: false,
        };
        eventBus.emit(eventDefs.Buff.In.BuffRemoveRequest, removeRequest);
        if(!removeRequest.result)return false;
        this.buffMap.delete(typeId);
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
        return true;
    }
    clearAll() {
        for(const [typeId] of this.buffMap.entries()){
            this.removeBuff(typeId);
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
}