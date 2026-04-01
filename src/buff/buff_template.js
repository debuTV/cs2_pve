import { Instance } from "cs_script/point_script";
import { Monster } from "../monster/monster/monster";
import { Player } from "../player/player/player";
export const BuffFactory = {
    /**
     * 根据 typeId 创建对应的技能实例。未识别的 id 返回 null。
     * @param {Monster|Player} target 所属怪物实例
     * @param {number} id 
     * @param {any} params 技能配置参数
     * @returns {BuffTemplate|null}
     */
    create(target,id, params) {
        switch (params.id) {
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
     * @param {number} duration Buff 持续时间(单位秒，为-1表示无限持续)
     */
    constructor(id,target,duration)
    {
        this.id=id;
        this.target=target;
        this.duration=duration;
        this.startTime=Instance.GetGameTime();
        this.use=false;
    }
    tick()
    {
        const currentTime=Instance.GetGameTime();
        if(this.duration!==-1 && currentTime-this.startTime>=this.duration)this.stop();
    }
    start()
    {
        this.use=true;
        this.startTime=Instance.GetGameTime();
    }
    stop()
    {
        this.use=false;
    }
    /**
     * @param {any} params
     */
    refresh(params)
    {

    }
    /**
     * 事件对外接口
     */
    
    /**
     * 目标每tick调用
     * @param {import("./buff_const").EmitEventPayload} payload
     * @returns {import("./buff_const").EmitEventPayload}
     */
    OnTick(payload){return payload;}
    /**
     * 目标对外发起攻击之前调用
     * @param {import("./buff_const").EmitEventPayload} payload
     * @returns {import("./buff_const").EmitEventPayload}
     */
    OnAttack(payload){return payload;}
    /**
     * 目标受到伤害之前调用
     * @param {import("./buff_const").EmitEventPayload} payload
     * @returns {import("./buff_const").EmitEventPayload}
     */
    OnDamage(payload){return payload;}
    /**
     * 目标死亡之前调用
     * @param {import("./buff_const").EmitEventPayload} payload
     * @returns {import("./buff_const").EmitEventPayload}
     */
    OnDeath(payload){return payload;}
    /**
     * 目标状态切换时调用
     * @param {import("./buff_const").EmitEventPayload} payload
     * @returns {import("./buff_const").EmitEventPayload}
     */
    OnStateChange(payload){return payload;}
    /**
     * 目标出生之后调用
     * @param {import("./buff_const").EmitEventPayload} payload
     * @returns {import("./buff_const").EmitEventPayload}
     */
    OnSpawn(payload){return payload;}
    /**
     * 目标派生属性重算时调用
     * @param {import("./buff_const").EmitEventPayload} payload
     * @returns {import("./buff_const").EmitEventPayload}
     */
    OnRecompute(payload){return payload;}
}