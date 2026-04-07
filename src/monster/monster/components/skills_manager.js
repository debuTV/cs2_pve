import { SkillFactory } from "../../../skill/skill_factory";

/** @typedef {import("../../../skill/skill_template").SkillTemplate & { animation?: string | null }} MonsterSkill */

export class MonsterSkillsManager {
    /**
     * @param {import("../monster").Monster} monster
     */
    constructor(monster) {
        this.monster = monster;
        /** @type {MonsterSkill | null} */
        this._requestedSkill = null;
    }

    /**
     * @param {import("../../../util/definition").skill_pool[] | undefined} skillPool
     */
    initSkills(skillPool) {
        if (!skillPool) return;

        for (const cfg of skillPool) {
            if (Math.random() > cfg.chance) continue;
            const skill = SkillFactory.create(null, this.monster, cfg.id, this.monster.skills.length, cfg.params);
            if (!skill) continue;
            this.addSkill(skill);
        }
    }

    /**
     * @param {MonsterSkill} skill
     */
    addSkill(skill) {
        skill.id = this.monster.skills.length;
        this.monster.skills.push(skill);
    }

    /**
     * @param {import("../../../skill/skill_const").EmitEventPayload & { type: string }} event
     */
    emitEvent(event) {
        for (const skill of this.monster.skills) {
            if (!skill.canTrigger(event)) continue;
            skill._request();
            break;
        }
    }

    tickRunningSkills() {
        for (const skill of this.monster.skills) {
            if (!skill.running) continue;
            skill.tick();
        }
    }

    /**
     * @param {MonsterSkill} skill
     */
    requestSkill(skill) {
        if (this.monster.movementStateSnapshot.mode === "ladder") {
            this._requestedSkill = null;
            return false;
        }
        if (this._requestedSkill) return false;
        this._requestedSkill = skill;
        return true;
    }

    hasRequestedSkill() {
        if (this.monster.movementStateSnapshot.mode === "ladder") {
            this._requestedSkill = null;
            return false;
        }
        return this._requestedSkill !== null;
    }

    triggerRequestedSkill() {
        if (this.monster.movementStateSnapshot.mode === "ladder") {
            this._requestedSkill = null;
            return;
        }

        const skill = this._requestedSkill;
        this._requestedSkill = null;
        if (!skill) return;

        if (skill.animation) this.monster.animation.play(skill.animation);
        skill.trigger();
    }
}
