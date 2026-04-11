import { Instance } from "cs_script/point_script";
import { eventBus } from "../util/event_bus";
import { event } from "../util/definition";

export class BuffTemplate{
    /**
     * @param {number}id
     * @param {import("../monster/monster/monster").Monster|import("../player/player/player").Player} target Buff 作用的目标
     * @param {string} targetType Buff 目标类型
     * @param {string} typeId Buff 类型标识
     * @param {Record<string, any>} params Buff 运行参数
     */
    constructor(id, target, targetType, typeId, params)
    {
        this.id = id;
        this.target = target;
        this.targetType = targetType;
        this.typeId = typeId;
        /**@type {number} */
        this.duration = params.duration;
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
        /** @type {import("./buff_const").OnBuffAdded} */
        const payload = { buffId: this.id };
        eventBus.emit(event.Buff.Out.OnBuffAdded, payload);
        return true;
    }
    stop()
    {
        if (!this.use) return false;
        this.use = false;
        /** @type {import("./buff_const").OnBuffRemoved} */
        const payload = { buffId: this.id };
        eventBus.emit(event.Buff.Out.OnBuffRemoved, payload);
        return true;
    }
    refresh()
    {
        if (typeof this.params.duration === "number") {
            this.duration = this.params.duration;
        }
        this.startTime = Instance.GetGameTime();
        /** @type {import("./buff_const").OnBuffRefreshed} */
        const payload = { buffId: this.id };
        eventBus.emit(event.Buff.Out.OnBuffRefreshed, payload);
        return true;
    }
    /**
     * 事件对外接口
     */
    /**
     * 目标每tick调用
     * @param {string} eventName
     * @param {any} params
     */
    OnBuffEmit(eventName,params)
    {
        void eventName;
        void params;
        return {result:false};
    }
}