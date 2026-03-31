import { Instance } from "cs_script/point_script";
import { Monster } from "../monster/monster/monster";
import { Player } from "../player/player/player";
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
     * 目标出生之后调用
     * @param {import("./buff_const").EmitEventPayload} payload
     * @returns {import("./buff_const").EmitEventPayload}
     */
    OnSpawn(payload){return payload;}
}