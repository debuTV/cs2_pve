/**
 * @module 输入系统/输入管理器
 */
import { InputDetector } from "./input_detector";

/**
 * 输入管理器。
 *
 * @navigationTitle 输入管理器
 */
export class InputManager {
    constructor() {
        /**
         * 输入源表。slot → 输入源
         * 输入源由 InputDetector + 绑定的 Pawn 组成，Pawn 用于查询当前按键状态（如是否被 UI 锁定）。
         * @type {Map<number, { detector: InputDetector, pawn: import("cs_script/point_script").CSPlayerPawn | null, use: boolean }>}
         */
        this._sources = new Map();

        /** 
         * 输入事件回调。参数为玩家槽位和原始键名，由外部决定如何映射成具体操作。
         * @type {((slot: number, key: string) => void) | null}
         */
        this._onInput = null;
    }
    /**
     * 启用输入检测
     * @param {number} slot - 玩家槽位
     * @param {import("cs_script/point_script").CSPlayerPawn} pawn
     */
    start(slot, pawn)
    {
        const source = this._getOrCreateSource(slot);
        source.pawn = pawn;
        source.use = true;
    }
    /**
     * 停止输入检测
     * @param {number} slot - 玩家槽位
     */
    stop(slot)
    {
        const source = this._getOrCreateSource(slot);
        source.use = false;
        source.pawn = null;
        source.detector.reset();
    }
    /**
     * 每 tick 轮询全部已注册输入源，逐个回调新按键。
     */
    tick() {
        for (const [slot, source] of this._sources) {
            if (!source.use) continue;
            const justPressed = source.detector.pollJustPressed(source.pawn);
            for (const key of justPressed) {
                this._onInput?.(slot, key);
            }
        }
    }

    /**
     * 设置输入事件回调。
     * @param {(slot: number, key: string) => void} callback
     */
    setOnInput(callback) {
        this._onInput = callback;
    }

    /**
     * 获取或创建指定玩家的输入源。
     * @param {number} slot
     * @returns {{ detector: InputDetector, pawn: import("cs_script/point_script").CSPlayerPawn | null, use: boolean }}
     */
    _getOrCreateSource(slot) {
        let source = this._sources.get(slot);
        if (!source) {
            source = {
                detector: new InputDetector(),
                pawn: null,
                use: false,
            };
            this._sources.set(slot, source);
        }
        return source;
    }
}
