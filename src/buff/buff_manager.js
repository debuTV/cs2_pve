import { Player } from "../player/player/player";
import { BuffFactory, BuffTemplate } from "./buff_template";
/**
 * Buff 管理器。
 */
export class BuffManager {
    constructor() {
        /**
         * key 为 buff id。
         * value 为 buff 实例。
         * @type {Map<number, BuffTemplate>}
         */
        this.buffMap = new Map();
        this.id=0;
    }
    /**
     * @param {Player|Monster} target
     * @param {any} params
     * @returns {number|null} 返回 buff 的 id，如果创建失败则返回 null
     */
    addbuff(target,params)
    {
        const buff=BuffFactory.create(target,this.id++,params);
        if(buff)
        {
            const currentBuff=this.buffMap.get(buff.id);
            if(currentBuff!==undefined)currentBuff.stop();
            buff.start();
            this.buffMap.set(buff.id,buff);
            return buff.id;
        }
        return null;
    }

    /**
     * @param {number} buffId
     * @returns {boolean}
     */
    deletebuff(buffId)
    {
        const buff=this.buffMap.get(buffId);
        if(buff===undefined)return false;
        buff.stop();
        this.buffMap.delete(buffId);
        return true;
    }

    tick()
    {
        for(const [buffId,buff] of this.buffMap)
        {
            if(buff.use===false)
            {
                this.buffMap.delete(buffId);
                continue;
            }
            buff.tick();
        }
    }

    clearAll()
    {
        for(const buff of this.buffMap.values())
        {
            buff.stop();
        }
        this.buffMap.clear();
    }

    /**
     * @param {number} buffId
     * @param {import("./buff_const").EmitEventPayload} payload
     * @returns {import("./buff_const").EmitEventPayload}
     */
    OnTick(buffId,payload)
    {
        const buff=this.buffMap.get(buffId);
        if(buff===undefined)return payload;
        return buff.OnTick(payload);
    }

    /**
     * @param {number} buffId
     * @param {import("./buff_const").EmitEventPayload} payload
     * @returns {import("./buff_const").EmitEventPayload}
     */
    OnAttack(buffId,payload)
    {
        const buff=this.buffMap.get(buffId);
        if(buff===undefined)return payload;
        return buff.OnAttack(payload);
    }

    /**
     * @param {number} buffId
     * @param {import("./buff_const").EmitEventPayload} payload
     * @returns {import("./buff_const").EmitEventPayload}
     */
    OnDamage(buffId,payload)
    {
        const buff=this.buffMap.get(buffId);
        if(buff===undefined)return payload;
        return buff.OnDamage(payload);
    }

    /**
     * @param {number} buffId
     * @param {import("./buff_const").EmitEventPayload} payload
     * @returns {import("./buff_const").EmitEventPayload}
     */
    OnDeath(buffId,payload)
    {
        const buff=this.buffMap.get(buffId);
        if(buff===undefined)return payload;
        return buff.OnDeath(payload);
    }

    /**
     * @param {number} buffId
     * @param {import("./buff_const").EmitEventPayload} payload
     * @returns {import("./buff_const").EmitEventPayload}
     */
    OnSpawn(buffId,payload)
    {
        const buff=this.buffMap.get(buffId);
        if(buff===undefined)return payload;
        return buff.OnSpawn(payload);
    }
}
