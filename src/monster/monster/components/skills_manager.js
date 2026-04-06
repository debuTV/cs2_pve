import { SkillFactory } from "../../../skill/skill_factory";

/** @typedef {import("../../../skill/skill_template").SkillTemplate & { animation?: string | null }} MonsterSkill */

class SkillRequestQueue {
    constructor() {
        /** @type {MonsterSkill[]} */
        this._items = [];
    }

    /**
     * @param {MonsterSkill} skill
     */
    push(skill) {
        if (this._items.includes(skill)) return;
        this._items.push(skill);
        this._items.sort((a, b) => a.id - b.id);
    }

    has() {
        return this._items.length > 0;
    }

    /**
     * @returns {MonsterSkill | undefined}
     */
    pop() {
        return this._items.shift();
    }

    clear() {
        this._items.length = 0;
    }
}

export class MonsterSkillsManager {
    /**
     * @param {import("../monster").Monster} monster
     */
    constructor(monster) {
        this.monster = monster;
        this._queue = new SkillRequestQueue();
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
            this._queue.clear();
            return;
        }
        this._queue.push(skill);
    }

    hasRequestedSkill() {
        if (this.monster.movementStateSnapshot.mode === "ladder") {
            this._queue.clear();
            return false;
        }
        return this._queue.has();
    }

    triggerRequestedSkill() {
        if (this.monster.movementStateSnapshot.mode === "ladder") {
            this._queue.clear();
            return;
        }

        const skill = this._queue.pop();
        if (!skill) return;

        if (skill.animation) this.monster.animation.play(skill.animation);
        skill.trigger();
    }
}
