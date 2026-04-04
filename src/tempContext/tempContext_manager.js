/**
 * 维护一个context，包含怪物所有breakable实体，玩家位置数组，怪物位置数组
 */
export class contextManager{
    constructor()
    {
        this.breakableEntities = [];
        this.playerPositions = [];
        this.monsterPositions = [];
    }
}