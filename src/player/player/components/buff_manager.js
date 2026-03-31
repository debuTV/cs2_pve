export class PlayerBuffManager {
    /** @param {import("../player").Player} player */
    constructor(player) {
        this.player = player;
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
        const id=this.player.events.OnBuffAddedRequest?.(typeId, params);
        if(!id)return false;
        this.buffMap.set(typeId, id);
        return true;
    }

    /** 
     * 移除 Buff。成功移除返回 true，未找到对应类型 Buff 或移除失败返回 false。
     * @param {string} typeId
     */
    removeBuff(typeId) {
        const id=this.buffMap.get(typeId);
        if(!id)return false;
        const success=this.player.events.OnBuffRemovedRequest?.(id);
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
        if(!id)return this.addBuff(typeId, params);
        const success=this.player.events.OnBuffRefreshedRequest?.(id, params);
        if(!success)return false;
        return true;
    }
    clearAll() {
        for(const [typeId] of this.buffMap.entries()){
            this.removeBuff(typeId);
        }
    }
}
