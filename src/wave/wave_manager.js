/**
 * @module 波次系统/波次管理器
 */

import { Instance } from "cs_script/point_script";
import { eventBus } from "../eventBus/event_bus";
import { event } from "../util/definition";
import { WaveState,wavesConfig } from "./wave_const";

/**
 * 独立版波次管理器，维护波次推进状态机（IDLE → PREPARING → ACTIVE → COMPLETED）。
 *
 * 支持预热阶段定时广播、波次开始/完成回调、逐波推进和重置。
 *
 * @navigationTitle 波次管理器
 */
export class WaveManager {
    /**
     * @param {import("../util/definition").Adapter} adapter - 外部适配器（日志/广播/时钟）
     */
    constructor(adapter) {
        /** 
         * 当前波次号，从 1 开始计数，0 表示未开始任何波次
         * @type {number} 
         */
        this.currentWave = 0;
        /** 
         * 当前波次状态
         * @type {WaveState} 
         */
        this.waveState = WaveState.IDLE;
        /** 
         * 波次配置列表
         * @type {import("../util/definition").waveConfig[]} 
         */
        this.waves = wavesConfig;
        /**
         * 外部适配器实例，提供日志、广播和游戏时间接口
         * @type {import("../util/definition").Adapter} 
         */
        this._adapter = adapter;
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Wave.In.WaveStartRequest, (/**@type {import("./wave_const").WaveStartRequest}*/ payload) => {
                payload.result = this.startWave(payload);
            }),
            eventBus.on(event.Wave.In.WaveEndRequest, (/**@type {import("./wave_const").WaveEndRequest}*/ payload) => {
                payload.result = this.completeWave();
            })
        ];
        // ——— 预热阶段内部状态 ———
        /**
         * 预热阶段上下文。
         * @type {{ startTime: number, duration: number, broadcastIndex: number, messages: { message: string, delay: number }[] }}
         */
        this._prepareContext = this._createPrepareContext();
        this.init();
    }
    /**
     * 启用实体监听
     * - endWave: 强制结束当前波次
     * - startWave: 开始指定波次，参数格式 "startWave_1"
     */
    init() {
        //强制结束当前波次
        Instance.OnScriptInput("endWave", () => {
            this.completeWave();
        });
        //开启波次
        Instance.OnScriptInput("startWave", (e) => {
            if (!e.caller) return;
            const parts = e.caller.GetEntityName().split('_');
            //脚本输入 startWave 的 parseInt 可能返回 NaN，需要验证
            const waveNumber = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(waveNumber)) {
                this.startWave({ waveIndex: waveNumber, result: false });
            }
        });
    }

    /**
     * 创建预热阶段上下文。
     * @returns {{ startTime: number, duration: number, broadcastIndex: number, messages: { message: string, delay: number }[] }}
     */
    _createPrepareContext() {
        return {
            startTime: -1,
            duration: 0,
            broadcastIndex: 0,
            messages: []
        };
    }

    /**
     * 重置预热阶段临时状态。
     */
    _resetPrepareState() {
        this._prepareContext = this._createPrepareContext();
    }

    /**
     * 进入预热阶段。
     * @param {number} waveNumber
     * @param {import("../util/definition").waveConfig} wave
     */
    _enterPreparingState(waveNumber, wave) {
        this.currentWave = waveNumber;
        this.waveState = WaveState.PREPARING;
        this._prepareContext = {
            startTime: this._adapter.getGameTime(),
            duration: wave.preparationTime,
            broadcastIndex: 0,
            messages: wave.broadcastmessage
        };
    }

    /**
     * 结束预热并进入激活阶段。
     * @param {import("../util/definition").waveConfig} wave
     */
    _activateCurrentWave(wave) {
        this.waveState = WaveState.ACTIVE;
        this._resetPrepareState();
        this._adapter.log(`=== 第 ${this.currentWave} 波开始 ===`);
        /** @type {import("./wave_const").OnWaveStart} */
        const payload = {
            waveIndex: this.currentWave,
            waveConfig: wave,
        };
        eventBus.emit(event.Wave.Out.OnWaveStart, payload);
    }

    // ═══════════════════════════════════════════════
    // 波次操作
    // ═══════════════════════════════════════════════

    /**
     * 开始指定波次。
     * - 若当前波次正在进行中（ACTIVE 或 PREPARING），则拒绝开始新波次。
     * - 参数 waveNumber 从 1 开始计数，必须在配置范围内。
     * @param {import("./wave_const").WaveStartRequest} waveStartRequest 
     * @returns {boolean}
     */
    startWave(waveStartRequest) {
        if (this.waveState === WaveState.ACTIVE || this.waveState === WaveState.PREPARING) {
            this._adapter.log(`无法开始波次 ${waveStartRequest.waveIndex}，当前波次进行中 (state=${this.waveState})`);
            return false;
        }

        if (waveStartRequest.waveIndex < 1 || waveStartRequest.waveIndex > this.waves.length) {
            this._adapter.log(`波次 ${waveStartRequest.waveIndex} 超出范围 (1-${this.waves.length})`);
            return false;
        }

        const wave = this.getWaveConfig(waveStartRequest.waveIndex);

        // 广播波次信息
        const message =
            `=== 第 ${waveStartRequest.waveIndex} 波: ${wave.name} ===\n` +
            `怪物总数: ${wave.totalMonsters}\n` +
            `奖励: $${wave.reward}\n` +
            `准备时间: ${wave.preparationTime} 秒`;
        this._adapter.broadcast(message);

        // 进入预热阶段
        this._enterPreparingState(waveStartRequest.waveIndex, wave);

        return true;
    }

    /**
     * 波次完成（由外部或调试命令调用）。
     * @returns {boolean}
     */
    completeWave() {
        if (this.waveState !== WaveState.ACTIVE) return false;

        this.waveState = WaveState.COMPLETED;
        this._resetPrepareState();
        const wave = this.getWaveConfig(this.currentWave);

        let message =
            `=== 第 ${this.currentWave} 波完成 ===\n` +
            `奖励: $${wave.reward}`;
        if (!this.hasNextWave()) {
            message += "\n=== 所有波次完成 ===";
        }
        this._adapter.broadcast(message);

        /** @type {import("./wave_const").OnWaveEnd} */
        const payload = { waveIndex: this.currentWave};
        eventBus.emit(event.Wave.Out.OnWaveEnd, payload);
        return true;
    }

    /**
     * 开始下一波。
     * @returns {boolean}
     */
    nextWave() {
        if (!this.hasNextWave()) {
            this._adapter.log("所有波次已完成！");
            return false;
        }
        return this.startWave({ waveIndex: this.currentWave + 1 ,result: false});
    }

    /**
     * 重置波次状态。重启游戏或重新进入地图时调用，回到初始状态（currentWave=0, state=IDLE）。
     */
    resetGame() {
        this.currentWave = 0;
        this.waveState = WaveState.IDLE;
        this._resetPrepareState();
        this._adapter.log("波次已重置");
    }

    // ═══════════════════════════════════════════════
    // 查询
    // ═══════════════════════════════════════════════

    /**
     * 获取指定波次的配置对象。
     * @param {number} waveNumber
     * @returns {import("../util/definition").waveConfig}
     */
    getWaveConfig(waveNumber) {
        return this.waves[waveNumber - 1];
    }
    /**
     * 判断是否还有后续波次。
     * @returns {boolean}
     */
    hasNextWave() {
        return this.currentWave < this.waves.length;
    }

    /**
     * 获取配置的波次总数。
     * @returns {number}
     */
    getTotalWaves() {
        return this.waves.length;
    }

    /**
     * 获取当前波次进度快照，包含当前波次号、总波次数、状态和波次配置。
     * @returns {{ current: number, total: number, state: string, wave: import("../util/definition").waveConfig|undefined }}
     */
    getProgress() {
        return {
            current: this.currentWave,
            total: this.waves.length,
            state: this.waveState,
            wave: this.getWaveConfig(this.currentWave)
        };
    }

    // ═══════════════════════════════════════════════
    // Tick（由外部驱动）
    // ═══════════════════════════════════════════════

    /**
     * 每帧由外部驱动调用，处理预热阶段的广播消息播放和倒计时推进。
     * 预热结束后自动切换至 ACTIVE 状态并触发 {@link onWaveStart} 回调。
     */
    tick() {
        if (this.waveState !== WaveState.PREPARING) return;

        const elapsed = this._adapter.getGameTime() - this._prepareContext.startTime;
        const wave = this.getWaveConfig(this.currentWave);
        const messages = this._prepareContext.messages;
        if (!wave) return;
        
        // 播放预热阶段的广播消息
        while (
            this._prepareContext.broadcastIndex < messages.length &&
            elapsed >= messages[this._prepareContext.broadcastIndex].delay
        ) {
            this._adapter.broadcast(messages[this._prepareContext.broadcastIndex].message);
            this._prepareContext.broadcastIndex++;
        }

        // 预热结束 → 进入 ACTIVE
        if (elapsed >= this._prepareContext.duration) {
            this._activateCurrentWave(wave);
        }
    }
}