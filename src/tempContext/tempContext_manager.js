/**
 * 维护主循环共享的临时上下文快照。
 */
export class ContextManager {
    constructor()
    {
        /** @type {import("../monster/monster/monster").Monster[]} */
        this.activeMonsters = [];
        /** @type {import("cs_script/point_script").Entity[]} */
        this.monsterEntities = [];
        /** @type {import("cs_script/point_script").Vector[]} */
        this.separationPositions = [];
        this.resetTickContext();
    }

    /**
     * 更新本 tick 用到的怪物相关临时快照。
     * @param {{
     *   activeMonsters?: import("../monster/monster/monster").Monster[];
     *   monsterEntities?: import("cs_script/point_script").Entity[];
     *   separationPositions?: import("cs_script/point_script").Vector[];
     * }} [nextContext]
     */
    updateTickContext(nextContext = {})
    {
        this.activeMonsters = Array.isArray(nextContext.activeMonsters) ? [...nextContext.activeMonsters] : [];
        this.monsterEntities = Array.isArray(nextContext.monsterEntities) ? [...nextContext.monsterEntities] : [];
        this.separationPositions = Array.isArray(nextContext.separationPositions) ? [...nextContext.separationPositions] : [];
    }

    resetTickContext()
    {
        /** @type {import("../monster/monster/monster").Monster[]} */
        this.activeMonsters = [];
        /** @type {import("cs_script/point_script").Entity[]} */
        this.monsterEntities = [];
        /** @type {import("cs_script/point_script").Vector[]} */
        this.separationPositions = [];
    }
}