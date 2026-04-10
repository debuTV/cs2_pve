import { Player } from "../player/player/player";
import { Monster } from "../monster/monster/monster";
import { BuffTemplate } from "./buff_template";
import { BuffFactory } from "./buff_factory";
import { eventBus } from "../util/event_bus";
import { event } from "../util/definition";
import { buffconfig } from "./buff_const";
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
        this.id = 1;
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Buff.In.BuffAddRequest, (/**@type {import("./buff_const").BuffAddRequest} */payload) => {
                payload.result = this.addbuff(payload);
            }),
            eventBus.on(event.Buff.In.BuffRemoveRequest, (/**@type {import("./buff_const").BuffRemoveRequest} */payload) => {
                payload.result = this.deletebuff(payload);
            }),
            eventBus.on(event.Buff.In.BuffRefreshRequest, (/**@type {import("./buff_const").BuffRefreshRequest} */payload) => {
                payload.result = this.refreshbuff(payload);
            }),
            eventBus.on(event.Buff.In.BuffEmitRequest, (/**@type {import("./buff_const").BuffEmitRequest} */payload) => {
                payload.result = this.emitBuffEvent(payload);
            })
        ];
    }
    destroy()
    {
        for (const unsubscribe of this._unsubscribers) {
            unsubscribe();
        }
        this._unsubscribers.length = 0;
        this.clearAll();
    }

    /**
     * @param {import("./buff_const").BuffAddRequest} buffAddRequest
     * @returns {number} 返回 buff 的 id，如果创建失败则返回 -1
     */
    addbuff(buffAddRequest)
    {
        const config=buffconfig[buffAddRequest.configid];
        if (!config) {
            return -1;
        }
        const params = { ...(config.params ?? {}) };
        const buff = BuffFactory.create(buffAddRequest.target,buffAddRequest.targetType,config.typeid,this.id++, params);
        if (buff) {
            buff.start();
            this.buffMap.set(buff.id, buff);
            return buff.id;
        }
        return -1;
    }

    /**
     * @param {import("./buff_const").BuffRemoveRequest} buffRemoveRequest
     * @returns {boolean}
     */
    deletebuff(buffRemoveRequest)
    {
        const buff = this.buffMap.get(buffRemoveRequest.buffId);
        if (buff === undefined) return false;
        buff.stop();
        this.buffMap.delete(buffRemoveRequest.buffId);
        return true;
    }

    /**
     * @param {import("./buff_const").BuffRefreshRequest} buffRefreshRequest
     * @returns {boolean}
     */
    refreshbuff(buffRefreshRequest)
    {
        const buff = this.buffMap.get(buffRefreshRequest.buffId);
        if (buff === undefined) return false;
        buff.refresh();
        return true;
    }

    /**
     * 驱动单个 Buff 运行时事件，并在处理后发出 Out 通知。
     * @param {import("./buff_const").BuffEmitRequest} buffEmitRequest
     */
    emitBuffEvent(buffEmitRequest)
    {
        const buff = this.buffMap.get(buffEmitRequest.buffId);
        if (buff === undefined) return {result:false};

        return buff.OnBuffEmit(buffEmitRequest.eventName,buffEmitRequest.params);
    }
    tick()
    {
        for (const [buffId, buff] of this.buffMap)
        {
            if (buff.use === false)
            {
                this.buffMap.delete(buffId);
                continue;
            }
            buff.tick();
        }
    }
    clearAll()
    {
        for (const buff of this.buffMap.values())
        {
            buff.stop();
        }
        this.buffMap.clear();
    }
}
