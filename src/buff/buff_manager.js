import { Player } from "../player/player/player";
import { Monster } from "../monster/monster/monster";
import { BuffFactory, BuffTemplate } from "./buff_template";
import { eventBus } from "../eventBus/event_bus";
import { event } from "../util/definition";
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
            eventBus.on(event.Buff.In.BuffAddRequest, (payload = {}) => {
                payload.result = this.addbuff(payload);
            }),
            eventBus.on(event.Buff.In.BuffRemoveRequest, (payload = {}) => {
                payload.result = this.deletebuff(payload);
            }),
            eventBus.on(event.Buff.In.BuffRefreshRequest, (payload = {}) => {
                payload.result = this.refreshbuff(payload);
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
     * @param {any} targetOrPayload
     * @param {string|Record<string, any>} [typeid]
     * @param {any} [params]
     * @returns {{target: Player|Monster|null, typeId: string|null, params: Record<string, any>, source: any}}
     */
    _normalizeAddRequest(targetOrPayload, typeid, params) {
        if (targetOrPayload && typeof targetOrPayload === "object" && "target" in targetOrPayload) {
            return {
                target: targetOrPayload.target ?? null,
                typeId: targetOrPayload.typeId ?? null,
                params: targetOrPayload.params ?? {},
                source: targetOrPayload.source ?? null,
            };
        }

        if (typeid && typeof typeid === "object") {
            const requestParams = { ...typeid };
            const requestTypeId = requestParams.id ?? null;
            delete requestParams.id;
            return {
                target: targetOrPayload ?? null,
                typeId: requestTypeId,
                params: requestParams,
                source: null,
            };
        }

        return {
            target: targetOrPayload ?? null,
            typeId: typeof typeid === "string" ? typeid : null,
            params: params ?? {},
            source: null,
        };
    }

    /**
     * @param {number|{buffId?: number, id?: number}} payloadOrId
     * @returns {number|null}
     */
    _normalizeBuffId(payloadOrId) {
        if (typeof payloadOrId === "number") return payloadOrId;
        if (!payloadOrId || typeof payloadOrId !== "object") return null;
        return payloadOrId.buffId ?? payloadOrId.id ?? null;
    }

    /**
     * @param {number} buffId
     * @param {import("./buff_const").EmitEventPayload} payload
     * @param {string} [eventName]
     * @returns {import("./buff_const").EmitEventPayload}
     */
    OnBuffEmit(buffId, payload, eventName = "OnBuffEmit")
    {
        return this.emitBuffEvent(buffId, eventName, payload);
    }

    /**
     * @param {any} targetOrPayload
     * @param {string|Record<string, any>} [typeid]
     * @param {any} [params]
     * @returns {number|null} 返回 buff 的 id，如果创建失败则返回 null
     */
    addbuff(targetOrPayload, typeid, params)
    {
        const request = this._normalizeAddRequest(targetOrPayload, typeid, params);
        if (!request.target || !request.typeId) return null;

        const buff = BuffFactory.create(request.target, request.typeId, this.id++, request.params, request.source);
        if (buff) {
            const currentBuff = this.buffMap.get(buff.id);
            if (currentBuff !== undefined) currentBuff.stop("replaced");
            buff.start();
            this.buffMap.set(buff.id, buff);
            return buff.id;
        }
        return null;
    }

    /**
     * @param {number} buffId
     * @returns {boolean}
     */
    deletebuff(payloadOrId)
    {
        const buffId = this._normalizeBuffId(payloadOrId);
        if (typeof buffId !== "number") return false;

        const buff = this.buffMap.get(buffId);
        if (buff === undefined) return false;
        const reason = payloadOrId && typeof payloadOrId === "object" ? payloadOrId.reason ?? "removed" : "removed";
        buff.stop(reason);
        this.buffMap.delete(buffId);
        return true;
    }

    /**
     * @param {number} buffId
     * @param {any} params
     * @returns {boolean}
     */
    refreshbuff(payloadOrId, params)
    {
        const buffId = this._normalizeBuffId(payloadOrId);
        if (typeof buffId !== "number") return false;

        const buff = this.buffMap.get(buffId);
        if (buff === undefined) return false;
        const nextParams = payloadOrId && typeof payloadOrId === "object" && "params" in payloadOrId
            ? payloadOrId.params
            : params;
        if (typeof buff.refresh === "function") buff.refresh(nextParams);
        return true;
    }

    /**
     * 驱动单个 Buff 运行时事件，并在处理后发出 Out 通知。
     * @param {number} buffId
     * @param {string} eventName
     * @param {import("./buff_const").EmitEventPayload} payload
     * @returns {import("./buff_const").EmitEventPayload}
     */
    emitBuffEvent(buffId, eventName, payload)
    {
        const buff = this.buffMap.get(buffId);
        if (buff === undefined) return payload;

        const nextPayload = buff.OnBuffEmit(payload, eventName) ?? payload;
        eventBus.emit(event.Buff.Out.OnBuffEmit, {
            buffId,
            typeId: buff.typeId,
            target: buff.target,
            event: eventName,
            payload: nextPayload,
        });
        return nextPayload;
    }

    OnTick(buffId, payload) { return this.emitBuffEvent(buffId, "OnTick", payload); }
    OnAttack(buffId, payload) { return this.emitBuffEvent(buffId, "OnAttack", payload); }
    OnDamage(buffId, payload) { return this.emitBuffEvent(buffId, "OnDamage", payload); }
    OnDeath(buffId, payload) { return this.emitBuffEvent(buffId, "OnDeath", payload); }
    OnStateChange(buffId, payload) { return this.emitBuffEvent(buffId, "OnStateChange", payload); }
    OnSpawn(buffId, payload) { return this.emitBuffEvent(buffId, "OnSpawn", payload); }
    OnRecompute(buffId, payload) { return this.emitBuffEvent(buffId, "OnRecompute", payload); }

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
            buff.stop("clearAll");
        }
        this.buffMap.clear();
    }
}
