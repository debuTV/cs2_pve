import { GenericBuffManager } from "../../../buff/buff_manager";
import { BuffTargetType } from "../../../buff/buff_const";


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
        const id=this.monster.events.OnBuffAddedRequest?.(typeId, params);
        if(id == null)return false;
        this.buffMap.set(typeId, id);
        return true;
    }

    /** 
     * 移除 Buff。成功移除返回 true，未找到对应类型 Buff 或移除失败返回 false。
     * @param {string} typeId
     */
    removeBuff(typeId) {
        const id=this.buffMap.get(typeId);
        if(id == null)return false;
        const success=this.monster.events.OnBuffRemovedRequest?.(id);
        if(!success)return false;
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
        const success=this.monster.events.OnBuffRefreshedRequest?.(id, params);
        if(!success)return false;
        return true;
    }
    clearAll() {
        for(const [typeId] of this.buffMap.entries()){
            this.removeBuff(typeId);
        }
    }
    /**
     * @param {string} event
     * @param {any} params 
     */
    emitEvent(event,params) {
        for(const [, id] of this.buffMap.entries()){
            this.monster.events.OnBuffEmitEvent?.(id, event, params);
        }
    }
}