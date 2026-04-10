/**
 * @module 实体移动/运动模式控制器
 */
import { MoveWalk, MoveAir, MoveFly, MoveLadder } from "./move_mode";

/**
 * @typedef {import("./move_mode").MoveMode} MoveMode
 * @typedef {import("./move_mode").LocoContext} LocoContext
 * @typedef {import("cs_script/point_script").Entity} Entity
 */

/**
 * 运动模式控制器：管理 walk / air / fly 三种模式的注册、切换和每帧更新。
 *
 * 支持 `autoSwitch` 开关：
 * - true（默认）：MoveMode 内部可通过 ctx.requestModeSwitch 请求切换
 * - false：requestModeSwitch 被屏蔽，只有外部调用 setMode 才能切换
 */
export class MovementController {
    /**
     * @param {LocoContext} ctx
     */
    constructor(ctx) {
        ctx.requestModeSwitch = this.setMode.bind(this);
        this.ctx = ctx;

        /** @type {Record<string, MoveMode>} */
        this.modes = {
            walk: new MoveWalk(),
            air: new MoveAir(),
            fly: new MoveFly(),
            ladder: new MoveLadder(),
        };

        /** @type {MoveMode | null} */
        this.current = null;
        /** @type {string} */
        this.currentName = "";
    }

    /**
     * 外部强制切换模式
     * @param {string} name
     * @param {any} [arg]
     */
    setMode(name, arg) {
        if (this.currentName === name) return;
        if (this.current) this.current.leave(this.ctx);

        this.current = this.modes[name] ?? null;
        this.currentName = name;
        if (this.current) this.current.enter(this.ctx);
    }

    /**
     * 运行时注册自定义模式
     * @param {string} name
     * @param {MoveMode} mode
     */
    registerMode(name, mode) {
        this.modes[name] = mode;
    }

    /**
     * @param {number} dt
     * @param {{
     *   entities: Entity[];
    *   spatialIndex: import("../util/spatial_hash").SpatialHashGrid | null;
     *   selfBreakable: Entity | null;
     * }} sepCtx
     * @returns {import("cs_script/point_script").Vector | undefined}
     */
    update(dt, sepCtx) {
        if (this.current) {
            return this.current.update(this.ctx, dt, sepCtx);
        }
    }
}
