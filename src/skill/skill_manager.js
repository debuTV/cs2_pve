import { Instance } from "cs_script/point_script";
import { Player } from "../player/player/player";
import { Monster } from "../monster/monster/monster";
import { SkillFactory } from "./skill_factory";
import { SkillTemplate } from "./skill_template";
import { eventBus } from "../util/event_bus";
import { event } from "../util/definition";
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
        this.id = 0;
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Skill.In.SkillAddRequest, (/** @type {import("./skill_const").SkillAddRequest} */ payload) => {
                payload.result = this.addSkill(payload.target, payload.typeId, payload.params);
            }),
            eventBus.on(event.Skill.In.SkillRemoveRequest, (/** @type {import("./skill_const").SkillRemoveRequest} */ payload) => {
                payload.result = this.deleteSkill(payload.skillId, payload.target ?? null);
            }),
            eventBus.on(event.Skill.In.SkillUseRequest, (/** @type {import("./skill_const").SkillUseRequest} */ payload) => {
                payload.result = this.useSkill(payload);
            }),
            eventBus.on(event.Skill.In.SkillEmitRequest, (/** @type {import("./skill_const").SkillEmitRequest} */ payload) => {
                payload.result = this.emitEvent(payload.skillId, payload.eventName, payload.params, payload.target ?? null);
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
     * @param {SkillTemplate} skill
     * @param {Player|Monster|null} target
     * @returns {boolean}
     */
    _matchTarget(skill, target)
    {
        if (target == null) return true;
        return skill.player === target || skill.monster === target;
    }

    /**
     * @param {Player|Monster} target
     * @param {string} typeid 技能类型标识（如 "corestats"、"pounce"）
     * @param {any} params
     * @returns {number|null} 返回 skill 的 id，如果创建失败则返回 null
     */
    addSkill(target,typeid,params)
    {
        const skill = SkillFactory.create(target instanceof Player ? target : null, target instanceof Monster ? target : null, typeid, this.id++, params);
        if(skill)
        {
            this.SkillMap.set(skill.id, skill);
            skill.onSkillAdd();
            return skill.id;
        }
        return null;
    }

    /**
     * @param {number} skillId
     * @param {Player|Monster|null} [target]
     * @returns {boolean}
     */
    deleteSkill(skillId, target = null)
    {
        const skill = this.SkillMap.get(skillId);
        if (skill === undefined) return false;
        if (!this._matchTarget(skill, target)) return false;
        skill.onSkillDelete();
        this.SkillMap.delete(skillId);
        return true;
    }

    /**
     * @param {import("./skill_const").SkillUseRequest} skillUseRequest
     * @returns {boolean}
     */
    useSkill(skillUseRequest)
    {
        const skill = this.SkillMap.get(skillUseRequest.skillId);
        if (skill === undefined) return false;
        if (!this._matchTarget(skill, skillUseRequest.target)) return false;
        skill.trigger();
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

    /**
     * @param {number} skillId
     * @param {Player|Monster|null} [target]
     * @returns {{ id: number; typeId: string; cooldown: number; remainingCooldown: number; isReady: boolean; isConsumed: boolean; } | null}
     */
    getSkillSummary(skillId, target = null)
    {
        const skill = this.SkillMap.get(skillId);
        if (skill === undefined) return null;
        if (!this._matchTarget(skill, target)) return null;

        const neverTriggered = skill.lastTriggerTime === -999;
        const isConsumed = skill.cooldown === -1 && !neverTriggered;
        const remainingCooldown = skill.cooldown > 0
            ? Math.max(0, skill.cooldown - (Instance.GetGameTime() - skill.lastTriggerTime))
            : 0;

        return {
            id: skill.id,
            typeId: skill.typeId,
            cooldown: skill.cooldown,
            remainingCooldown,
            isReady: !isConsumed && remainingCooldown <= 0,
            isConsumed,
        };
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
        * @param {import("../util/runtime_events.js").RuntimeEventPayload} payload
     * @param {Player|Monster|null} [target]
     * @returns {boolean}
     */
    emitEvent(skillId,event,payload,target = null)
    {
        const skill = this.SkillMap.get(skillId);
        if (skill === undefined) return false;
        if (!this._matchTarget(skill, target)) return false;
        skill._emitEvent(event, payload);
        return true;
    }
}
