import { Instance } from "cs_script/point_script";
import { Monster } from "../monster/monster/monster";
import { Player } from "../player/player/player";
import { eventBus } from "../eventBus/event_bus";
import { event } from "../util/definition";
export const BuffFactory = {
    /**
     * 根据 typeId 创建对应的buff实例。未识别的 id 返回 null。
     * @param {Monster|Player} target 所属怪物实例
     * @param {string} typeid buff类型标识
     * @param {number} id 
     * @param {any} params buff配置参数
     * @returns {BuffTemplate|null}
     */
    create(target,typeid,id, params) {
        switch (typeid) {
            case "corestats":
                return null;
            default:
                return null;
        } 
    }
};
export class BuffTemplate{
    /**
     * @param {number}id
     * @param {Monster|Player} target Buff 作用的目标
     * @param {string} typeId Buff 类型标识
     * @param {number} duration Buff 持续时间(单位秒，为-1表示无限持续)
     * @param {Record<string, any>} [params] Buff 运行参数
     * @param {any} [source] Buff 来源
     */
    constructor(id, target, typeId, duration, params = {}, source = null)
    {
        this.id = id;
        this.target = target;
        this.typeId = typeId;
        this.duration = duration;
        this.params = { ...(params ?? {}) };
        this.startTime = Instance.GetGameTime();
        this.use = false;
    }
    tick()
    {
        const currentTime=Instance.GetGameTime();
        if(this.duration!==-1 && currentTime-this.startTime>=this.duration)this.stop();
    }
    start()
    {
        if (this.use) return false;
        this.use = true;
        this.startTime = Instance.GetGameTime();
        eventBus.emit(event.Buff.Out.OnBuffAdded, this._createEventPayload());
        return true;
    }
    stop()
    {
        if (!this.use) return false;
        this.use = false;
        eventBus.emit(event.Buff.Out.OnBuffRemoved, this._createEventPayload({ reason }));
        return true;
    }
    /**
     * @param {any} params
     */
    refresh(params)
    {
        this.params = {
            ...this.params,
            ...(params ?? {}),
        };
        if (typeof this.params.duration === "number") {
            this.duration = this.params.duration;
        }
        this.startTime = Instance.GetGameTime();
        eventBus.emit(event.Buff.Out.OnBuffRefreshed, this._createEventPayload());
        return true;
    }
    /**
     * 事件对外接口
     */
    /**
     * 目标每tick调用
     * @param {import("./buff_const").EmitEventPayload} payload
     * @param {string} [eventName]
     * @returns {import("./buff_const").EmitEventPayload}
     */
    OnBuffEmit(payload, eventName)
    {
        void eventName;
        {return payload;}
    }

    /**
     * 构造 Buff 生命周期事件负载。
     * @param {Record<string, any>} [extra]
     * @returns {Record<string, any>}
     */
    _createEventPayload(extra = {}) {
        return {
            buffId: this.id,
            typeId: this.typeId,
            target: this.target,
            duration: this.duration,
            params: { ...this.params },
            source: this.source && typeof this.source === "object" ? { ...this.source } : this.source,
            ...extra,
        };
    }
}