/**
 * @module 输入系统/输入管理器
 */
import { eventBus } from "../eventBus/event_bus";
import { event } from "../util/definition";
import { InputDetector } from "./input_const";

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
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Input.In.StartRequest, (/** @type {import("./input_const").StartRequest} */ payload) => {
                payload.result=this.start(payload);
            }),
            eventBus.on(event.Input.In.StopRequest, (/** @type {import("./input_const").StopRequest} */ payload) => {
                payload.result=this.stop(payload);
            })
        ];
    }
    /**
     * 启用输入检测
     * @param {import("./input_const").StartRequest} startRequest
     */
    start(startRequest)
    {
        const source = this._getOrCreateSource(startRequest.slot);
        source.pawn = startRequest.pawn;
        source.use = true;
        return true;
    }
    /**
     * 停止输入检测
     * @param {import("./input_const").StopRequest} stopRequest
     */
    stop(stopRequest)
    {
        const source = this._getOrCreateSource(stopRequest.slot);
        source.use = false;
        source.pawn = null;
        source.detector.reset();
        return true;
    }

    destroy() {
        for (const unsubscribe of this._unsubscribers) {
            unsubscribe();
        }
        this._unsubscribers.length = 0;
    }

    /**
     * 每 tick 轮询全部已注册输入源，逐个回调新按键。
     */
    tick() {
        for (const [slot, source] of this._sources) {
            if (!source.use) continue;
            const justPressed = source.detector.pollJustPressed(source.pawn);
            for (const key of justPressed) {
                /** @type {import("./input_const").OnInput} */
                const payload = {
                    slot,
                    key: /** @type {import("./input_const").InputKey} */ (key),
                };
                eventBus.emit(event.Input.Out.OnInput, payload);
            }
        }
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
