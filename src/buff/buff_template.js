import { Instance } from "cs_script/point_script";
import { Monster } from "../monster/monster/monster";
import { Player } from "../player/player/player";
import { eventBus } from "../eventBus/event_bus";
import { event } from "../util/definition";
export const BuffFactory = {
    /**
     * 根据 typeId 创建对应的buff实例。未识别的 id 返回 null。
     * @param {Monster|Player} target 所属怪物实例
     * @param {string} targetType Buff 目标类型
     * @param {string} typeid buff类型标识
     * @param {number} id 
     * @param {any} params buff配置参数
     * @returns {BuffTemplate|null}
     */
    create(target,targetType,typeid,id, params) {
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
        return {result:false};
    }
}