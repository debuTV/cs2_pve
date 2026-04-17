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
/**
 * @typedef {object} WaveStartRequest - 请求开始波次的消息载荷
 * @property {number} waveIndex - 要开始的波次索引
 * @property {boolean} result - 结果回填字段
 */
/**
 * @typedef {object} WaveEndRequest - 请求结束波次的消息载荷
 * @property {boolean} result - 结果回填字段
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
        { 
            name: "训练波", 
            totalMonsters: 200, 
            reward: 500, 
            spawnInterval: 0.01, 
            preparationTime: 0, //波次开始到第一个怪物出现时间，这段时间可以用来发消息
            aliveMonster:150, //同时存在的怪物数量
            monster_spawn_points_name:["monster_spawnpoint"],//这一波生成点
            monster_breakablemins:{x:-30,y:-30,z:0},//最大怪物的breakable的mins
            monster_breakablemaxs:{x:30,y:30,z:75},//最大怪物的breakable的maxs
            broadcastmessage:[{message:"",delay:1}],
            // monster 系统已独立拆出，主工程仅保留波次元数据。
            monsterTypes:[MonsterType.headcrab_classic]
        },{ 
            name: "训练波", 
            totalMonsters: 1, 
            reward: 500, 
            spawnInterval: 0.1, 
            preparationTime: 0, //波次开始到第一个怪物出现时间，这段时间可以用来发消息
            aliveMonster:1, //同时存在的怪物数量
            monster_spawn_points_name:["monster_spawnpoint"],//这一波生成点
            monster_breakablemins:{x:-30,y:-30,z:0},//最大怪物的breakable的mins
            monster_breakablemaxs:{x:30,y:30,z:75},//最大怪物的breakable的maxs
            broadcastmessage:[{message:"",delay:1}],
            monsterTypes:[MonsterType.headcrab_classic]
        },
    ];
