/**
 * @module 游戏系统/游戏配置
 */

/**
 * 游戏状态枚举。
 *
 * - `WAITING`  – 等待玩家加入。
 * - `PREPARE`  – 准备阶段，等待所有玩家 ready。
 * - `PLAYING`  – 游戏进行中。
 * - `WON`      – 所有波次通关，游戏胜利。
 * - `LOST`     – 所有玩家阵亡，游戏失败。
 *
 * @enum {string}
 * @navigationTitle 游戏状态枚举
 */
export const GameState = {
    WAITING: 'WAITING',
    PREPARE: 'PREPARE',
    PLAYING: 'PLAYING',
    WON: 'WON',
    LOST: 'LOST'
};