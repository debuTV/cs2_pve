import { SkillFactory } from "../skill_factory";
import { TEMP_DISABLE } from "../../../runtime_flags";

class SkillRequestQueue {
    constructor() {
        /** @type {import("../skill_manager").SkillTemplate[]} */
        this._items = [];
    }

    push(skill) {
        if (this._items.includes(skill)) return;
        this._items.push(skill);
        this._items.sort((a, b) => a.id - b.id);
    }

    has() {
        return this._items.length > 0;
    }

    pop() {
        return this._items.shift();
    }

    clear() {
        this._items.length = 0;
    }
}

export class MonsterSkillsManager {
    constructor(monster) {
        this.monster = monster;
        this._queue = new SkillRequestQueue();
    }

    initSkills(skillPool) {
        if (TEMP_DISABLE.monsterSkills) {
            this._queue.clear();
            this.monster.skills.length = 0;
            return;
        }
        if (!skillPool) return;

        for (const cfg of skillPool) {
            if (Math.random() > cfg.chance) continue;
            const skill = SkillFactory.create(this.monster, cfg.id, cfg.params);
            if (!skill) continue;
            this.addSkill(skill);
        }
    }

    addSkill(skill) {
        if (TEMP_DISABLE.monsterSkills) return;
        skill.id = this.monster.skills.length;
        this.monster.skills.push(skill);
    }

    emitEvent(event) {
        if (TEMP_DISABLE.monsterSkills) return;

        for (const skill of this.monster.skills) {
            if (!skill.canTrigger(event)) continue;
            skill.request();
        }
    }

    tickRunningSkills() {
        if (TEMP_DISABLE.monsterSkills) return;

        for (const skill of this.monster.skills) {
            if (!skill.running) continue;
            skill.tick();
        }
    }

    requestSkill(skill) {
        if (TEMP_DISABLE.monsterSkills) {
            this._queue.clear();
            return;
        }
        if (this.monster.movementStateSnapshot.mode === "ladder") {
            this._queue.clear();
            return;
        }
        this._queue.push(skill);
    }

    hasRequestedSkill() {
        if (TEMP_DISABLE.monsterSkills) {
            this._queue.clear();
            return false;
        }
        if (this.monster.movementStateSnapshot.mode === "ladder") {
            this._queue.clear();
            return false;
        }
        return this._queue.has();
    }

    triggerRequestedSkill() {
        if (TEMP_DISABLE.monsterSkills) {
            this._queue.clear();
            return;
        }
        if (this.monster.movementStateSnapshot.mode === "ladder") {
            this._queue.clear();
            return;
        }

        const skill = this._queue.pop();
        if (!skill) return;

        if (skill.animation) this.monster.animator.play(skill.animation);
        skill.trigger();
    }
}
