/**
 * @module 波次系统/波次配置
 */

import { MonsterType } from "../monster/monster_const";

/**
 * 波次状态枚举。
 *
 * - `IDLE`  – 等待波次开始。
 * - `PREPARING`  – 波次准备阶段。
 * - `ACTIVE`  – 波次进行中。
 * - `COMPLETED` – 当前波次通关。
 *

 * @enum {string}
 * @navigationTitle 波次状态枚举
 */
export const WaveState = {
    IDLE: 'IDLE',
    PREPARING: 'PREPARING',
    ACTIVE: 'ACTIVE',
    COMPLETED: 'COMPLETED'
};

export const MAX_ALIVE_MONSTERS = 300;

/**
 * @typedef {object} PlayerCountScalePoint
 * @property {number} players
 * @property {number} totalMultiplier
 * @property {number} aliveMultiplier
 * @property {number} spawnIntervalMultiplier
 */

/** @typedef {"totalMultiplier" | "aliveMultiplier" | "spawnIntervalMultiplier"} PlayerCountScaleKey */

/** @type {PlayerCountScalePoint[]} */
export const PLAYER_COUNT_SCALE_POINTS = [
    { players: 1, totalMultiplier: 1.0, aliveMultiplier: 1.0, spawnIntervalMultiplier: 1.0 },
    { players: 2, totalMultiplier: 1.4, aliveMultiplier: 1.25, spawnIntervalMultiplier: 0.94 },
    { players: 4, totalMultiplier: 2.2, aliveMultiplier: 1.6, spawnIntervalMultiplier: 0.88 },
    { players: 8, totalMultiplier: 3.8, aliveMultiplier: 2.2, spawnIntervalMultiplier: 0.8 },
    { players: 16, totalMultiplier: 5.9, aliveMultiplier: 3.0, spawnIntervalMultiplier: 0.72 },
    { players: 32, totalMultiplier: 8.8, aliveMultiplier: 4.0, spawnIntervalMultiplier: 0.66 },
    { players: 64, totalMultiplier: 14.6, aliveMultiplier: 5.4, spawnIntervalMultiplier: 0.6 },
];

/**
 * @param {number} playerCount
 */
function normalizePlayerCount(playerCount) {
    if (!Number.isFinite(playerCount)) return 1;
    return Math.max(1, Math.min(64, Math.round(playerCount)));
}

/**
 * @param {number} playerCount
 * @param {PlayerCountScaleKey} key
 */
function interpolateScale(playerCount, key) {
    const normalizedPlayerCount = normalizePlayerCount(playerCount);
    const points = PLAYER_COUNT_SCALE_POINTS;
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];

    if (!firstPoint || !lastPoint) return 1;
    if (normalizedPlayerCount <= firstPoint.players) return firstPoint[key];

    for (let index = 1; index < points.length; index++) {
        const previousPoint = points[index - 1];
        const nextPoint = points[index];
        if (!previousPoint || !nextPoint) continue;
        if (normalizedPlayerCount > nextPoint.players) continue;

        const ratio = (normalizedPlayerCount - previousPoint.players) / (nextPoint.players - previousPoint.players);
        return previousPoint[key] + (nextPoint[key] - previousPoint[key]) * ratio;
    }

    return lastPoint[key];
}

/**
 * 按开波时玩家人数生成当前波次的运行时配置副本。
 *
 * - totalMonsters 随玩家人数扩张。
 * - aliveMonster 单独缩放并硬上限为 100。
 * - spawnInterval 随人数适度缩短。
 * - monsterTypes 直接沿用 const 中显式定义的怪物参数，不再做运行时属性缩放。
 *
 * @param {import("../util/definition").waveConfig} waveConfig
 * @param {number} playerCount
 * @returns {import("../util/definition").waveConfig}
 */
export function createRuntimeWaveConfig(waveConfig, playerCount) {
    const totalMultiplier = interpolateScale(playerCount, "totalMultiplier");
    const aliveMultiplier = interpolateScale(playerCount, "aliveMultiplier");
    const spawnIntervalMultiplier = interpolateScale(playerCount, "spawnIntervalMultiplier");

    const totalMonsters = Math.max(1, Math.round(waveConfig.totalMonsters * totalMultiplier));
    const aliveMonster = Math.max(
        1,
        Math.min(
            MAX_ALIVE_MONSTERS,
            totalMonsters,
            Math.round(waveConfig.aliveMonster * aliveMultiplier)
        )
    );

    return {
        ...waveConfig,
        totalMonsters,
        aliveMonster,
        spawnInterval: Math.max(0.03, Number((waveConfig.spawnInterval * spawnIntervalMultiplier).toFixed(3))),
        monsterTypes: [...waveConfig.monsterTypes],
    };
}
/**
 * @typedef {object} WaveStartRequest - 请求开始波次的消息载荷
 * @property {number} waveIndex - 要开始的波次索引
 * @property {number} playerCount - 开波时确认的当前人数
 * @property {boolean} result - 结果回填字段
 */
/**
 * @typedef {object} WaveEndRequest - 请求结束波次的消息载荷
 * @property {boolean} result - 结果回填字段
 */
/**
 * @typedef {object} OnWavePreparing - 波次配置对象
 * @property {number} waveIndex - 已准备的波次索引
 * @property {number} preparationTime - 波次准备时间（秒）
 * @property {string} broadcastMessage - 波次准备阶段的广播消息
 */
/**
 * @typedef {object} OnWaveStart
 * @property {number} waveIndex - 已开始的波次索引
 * @property {import("../util/definition").waveConfig} waveConfig - 当前波次配置
 */
/**
 * @typedef {object} OnWaveEnd
 * @property {number} waveIndex - 已结束的波次索引
 */
/**
 * 内置的默认波次配置列表，包含三波递增难度的演示数据。
 * 实际使用时由 main.js 传入真实配置。
 * @type {import("../util/definition").waveConfig[]}
 * @navigationTitle 默认波次配置
 */
export const wavesConfig=[
    //待处理怪物
    //MonsterType.headcrab_reviver,
    //MonsterType.antlion_worker,
    //{
    //    name: "test",
    //    totalMonsters: 5,
    //    moneyReward: 750,
    //    expReward: 60,
    //    spawnInterval: 0.01,
    //    preparationTime: 1,
    //    aliveMonster: 1,
    //    monster_spawn_points_name:["monster_spawnpoint"],
    //    broadcastmessage:[{message:"第1波即将开始，准备迎敌。",delay:15}],
    //    monsterTypes:[
    //        MonsterType.headcrab_classic,
    //        //MonsterType.headcrab_armored,
    //        //MonsterType.headcrab_black,
    //        //MonsterType.headcrab,
    //        //MonsterType.zombie_classic,
    //        //MonsterType.antlion,
    //        //MonsterType.zombie_fast,
    //        //MonsterType.zombie_poison,
    //        //
    //        //MonsterType.headcrab_reviver,
    //        //MonsterType.antlion_worker,
    //    ]
    //},
    {
        name: "热身波",
        totalMonsters: 16,
        moneyReward: 750,
        expReward: 60,
        spawnInterval: 0.16,
        preparationTime: 15,                  //第一波可以快点
        aliveMonster: 6,
        monster_spawn_points_name:["monster_spawnpoint"],
        broadcastmessage:[{message:"第1波",delay:15}],
        monsterTypes:[
            MonsterType.zombie_classic,
            MonsterType.headcrab_classic,
        ]
    },
    {
        name: "追猎波",
        totalMonsters: 24,
        moneyReward: 1050,
        expReward: 96,
        spawnInterval: 0.14,
        preparationTime: 30,
        aliveMonster: 10,
        monster_spawn_points_name:["monster_spawnpoint"],
        broadcastmessage:[{message:"第2波",delay:30}],
        monsterTypes:[
            MonsterType.zombie_classic,
            MonsterType.zombie_classic,
            MonsterType.headcrab_classic,
            MonsterType.headcrab_classic,
            MonsterType.headcrab,
            MonsterType.zombie_fast,
        ]
    },
    {
        name: "压制波",
        totalMonsters: 36,
        moneyReward: 1500,
        expReward: 144,
        spawnInterval: 0.12,
        preparationTime: 30,
        aliveMonster: 14,
        monster_spawn_points_name:["monster_spawnpoint"],
        broadcastmessage:[{message:"第3波",delay:30}],
        monsterTypes:[
            MonsterType.zombie_classic,
            MonsterType.headcrab,
            MonsterType.zombie_fast,
            MonsterType.headcrab_armored,
            MonsterType.antlion,
            MonsterType.headcrab_black,
        ]
    },
    {
        name: "突破波",
        totalMonsters: 50,
        moneyReward: 2100,
        expReward: 204,
        spawnInterval: 0.10,
        preparationTime: 30,
        aliveMonster: 18,
        monster_spawn_points_name:["monster_spawnpoint"],
        broadcastmessage:[{message:"第4波",delay:30}],
        monsterTypes:[
            MonsterType.zombie_classic,
            MonsterType.zombie_classic,
            MonsterType.zombie_fast,
            MonsterType.headcrab_black,
            MonsterType.zombie_poison,
            MonsterType.antlion,
            MonsterType.headcrab_armored,
        ]
    },
    {
        name: "终局波",
        totalMonsters: 70,
        moneyReward: 2850,
        expReward: 276,
        spawnInterval: 0.09,
        preparationTime: 30,
        aliveMonster: 22,
        monster_spawn_points_name:["monster_spawnpoint"],
        broadcastmessage:[{message:"第5波",delay:30}],
        monsterTypes:[
            MonsterType.zombie_classic,
            MonsterType.zombie_classic,
            MonsterType.zombie_fast,
            MonsterType.zombie_poison,
            MonsterType.antlion,
            MonsterType.antlion,
            MonsterType.antlion,
            MonsterType.headcrab_black,
            MonsterType.headcrab_armored,
        ]
    },
];
