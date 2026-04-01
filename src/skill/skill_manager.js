import { Player } from "../player/player/player";
import { Monster } from "../monster/monster/monster";
import { SkillFactory } from "./skill_factory";
import { SkillTemplate } from "./skill_template";
/**
 * 技能管理器。
 */
export class SkillManager {
    constructor() {
        /**
         * key 为 skill id。
         * value 为 skill 实例。
         * @type {Map<number, SkillTemplate>}
         */
        this.SkillMap = new Map();
        this.id=0;
    }
    /**
     * @param {Player|Monster} target
     * @param {string} typeid 技能类型标识（如 "corestats"、"pounce"）
     * @param {any} params
     * @returns {number|null} 返回 skill 的 id，如果创建失败则返回 null
     */
    addSkill(target,typeid,params)
    {
        const skill=SkillFactory.create(target instanceof Player ? target : null, target instanceof Monster ? target : null, typeid,this.id++,params);
        if(skill)
        {
            this.SkillMap.set(skill.id,skill);
            skill.onSkillAdd();
            return skill.id;
        }
        return null;
    }

    /**
     * @param {number} skillId
     * @returns {boolean}
     */
    deleteSkill(skillId)
    {
        const skill=this.SkillMap.get(skillId);
        if(skill===undefined)return false;
        skill.onSkillDelete();
        this.SkillMap.delete(skillId);
        return true;
    }

    tick()
    {
        for(const [skillId,skill] of this.SkillMap)
        {
            if(skill.monster==null&&skill.player==null)
            {
                this.SkillMap.delete(skillId);
                continue;
            }
            skill.tick();
        }
    }

    clearAll()
    {
        for(const skill of this.SkillMap.values())
        {
            skill.onSkillDelete();
        }
        this.SkillMap.clear();
    }
    /**
     * @param {number} skillId
     * @param {string} event 
     * @param {import("./skill_const").EmitEventPayload} payload
     */
    emitEvent(skillId,event,payload)
    {
        const skill=this.SkillMap.get(skillId);
        if(skill===undefined)return payload;
        return skill._emitEvent(event,payload);
    }
}
