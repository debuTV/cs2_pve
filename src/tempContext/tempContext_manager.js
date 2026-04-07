/**
 * 维护主循环共享的临时上下文快照。
 */
export class contextManager{
    constructor()
    {
        /** @type {import("../monster/monster/monster").Monster[]} */
        this.activeMonsters = [];
        /** @type {import("cs_script/point_script").Entity[]} */
        this.monsterEntities = [];
        /** @type {import("cs_script/point_script").Vector[]} */
        this.separationPositions = [];
        /** @type {import("cs_script/point_script").Entity[]} */
        this.breakableEntities = [];
        /** @type {import("cs_script/point_script").Vector[]} */
        this.playerPositions = [];
        /** @type {import("cs_script/point_script").Vector[]} */
        this.monsterPositions = [];
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
        this.updateTickContext();
    }
}