/**
 * @module 输入系统/输入检测器
 */
import { CSInputs } from "cs_script/point_script";

/**
 * 当前输入模块要监听的全部键位。
 * 顺序同时决定多键同帧按下时的输出顺序。
 *
 * @type {{ key: string, binding: number }[]}
 */
const MONITORED_INPUTS = [
    { key: "W", binding: CSInputs.FORWARD },
    { key: "A", binding: CSInputs.LEFT },
    { key: "S", binding: CSInputs.BACK },
    { key: "D", binding: CSInputs.RIGHT },
    { key: "Walk", binding: CSInputs.WALK },
    { key: "Duck", binding: CSInputs.DUCK },
    { key: "Jump", binding: CSInputs.JUMP },
    { key: "Use", binding: CSInputs.USE },
    { key: "Attack", binding: CSInputs.ATTACK },
    { key: "Attack2", binding: CSInputs.ATTACK2 },
    { key: "Reload", binding: CSInputs.RELOAD },
    { key: "ShowScores", binding: CSInputs.SHOW_SCORES },
    { key: "InspectWeapon", binding: CSInputs.LOOK_AT_WEAPON },
];

/**
 * 按键边沿检测器。
 *
 * 消费外部传入的 pawn 引用，把"当前是否按下"转换成"本帧刚按下"的一次性事件。
 * 模块本身不持有 Player 或 PlayerManager 引用，只依赖引擎 CSInputs API。
 *
 * @navigationTitle 输入检测器
 */
export class InputDetector {
    constructor() {
        /** @type {Record<string, boolean>} */
        this.pressedState = this._createInitialState();
    }

    /**
     * 返回当前支持监听的键位名称。
     * @returns {string[]}
     */
    getSupportedKeys() {
        return MONITORED_INPUTS.map((item) => item.key);
    }

    /**
     * 清空全部锁存状态。
     */
    reset() {
        this.pressedState = this._createInitialState();
    }

    /**
     * 轮询指定 pawn 的输入，返回本帧所有"新按下"的键位。
     *
     * @param {import("cs_script/point_script").CSPlayerPawn | null | undefined} pawn
     * @returns {string[]}
     */
    pollJustPressed(pawn) {
        if (!pawn || !pawn.IsValid() || !pawn.IsAlive()) {
            this.reset();
            return [];
        }

        /** @type {string[]} */
        const justPressed = [];
        for (const item of MONITORED_INPUTS) {
            const isPressed = pawn.IsInputPressed(item.binding);
            if (isPressed && !this.pressedState[item.key]) {
                justPressed.push(item.key);
            }
            this.pressedState[item.key] = isPressed;
        }
        return justPressed;
    }

    /**
     * 创建默认全 false 的按键状态表。
     * @returns {Record<string, boolean>}
     */
    _createInitialState() {
        /** @type {Record<string, boolean>} */
        const state = {};
        for (const item of MONITORED_INPUTS) {
            state[item.key] = false;
        }
        return state;
    }
}
