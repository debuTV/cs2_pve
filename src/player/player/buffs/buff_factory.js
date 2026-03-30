/**
 * @module 玩家系统/玩家/Buff/Buff工厂
 */
import { Instance } from "cs_script/point_script";
import { PoisonBuff } from "./poison_buff";
import { KnockUpBuff } from "./knockup_buff";
import { StackTestBuff, PersistentTestBuff, IndependentTestBuff, ReplaceWeakerTestBuff, DamageReductionTestBuff } from "./test_buffs";

/**
 * Buff 工厂。通过 typeId 注册和创建 Buff 实例。
 *
 * 用法：
 * ```js
 * // 注册：在模块加载时执行一次
 * BuffFactory.register("poison", PoisonBuff, { dps: 5 });
 * // 创建：运行时按需调用
 * const buff = BuffFactory.create(player, "poison", { duration: 8 });
 * ```
 *
 * 创建时会自动将 `register` 时的默认参数与运行时传入的 params 合并，
 * 运行时参数优先级更高。
 *
 * 模块尾部已预注册内置 Buff：poison、knockup 及 5 种测试 Buff。
 *
 * @navigationTitle Buff 工厂
 */
export class BuffFactory {
    /** @type {Map<string, typeof import("./buff_template").BuffTemplate>} */
    static _registry = new Map();

    /** @type {Map<string, Record<string,any>>} */
    static _defaults = new Map();

    /**
     * 注册一个 Buff 类型。
     * @param {string} typeId Buff 类型标识
     * @param {typeof import("./buff_template").BuffTemplate} BuffClass Buff 类
     * @param {Record<string,any>} [defaultParams] 默认参数，可被运行时 params 覆盖
     */
    static register(typeId, BuffClass, defaultParams) {
        BuffFactory._registry.set(typeId, BuffClass);
        if (defaultParams) BuffFactory._defaults.set(typeId, defaultParams);
    }

    /**
     * 创建 Buff 实例，自动合并默认参数。
     * @param {import("../player.js").Player} player 所属玩家实例
     * @param {string} typeId Buff 类型标识
     * @param {Record<string,any>} [params] 运行时参数
     * @returns {import("./buff_template").BuffTemplate | null} 创建的 Buff 实例，未注册时返回 null
     */
    static create(player, typeId, params) {
        const BuffClass = BuffFactory._registry.get(typeId);
        if (!BuffClass) {
            Instance.Msg(`BuffFactory: 未注册的 buff 类型 "${typeId}"`);
            return null;
        }
        const defaults = BuffFactory._defaults.get(typeId);
        const merged = defaults ? { ...defaults, ...params } : params;
        const buff = new BuffClass(player, merged);
        buff.typeId = typeId;
        return buff;
    }
}

// ——— 内置 Buff 注册 ———
BuffFactory.register("poison",  PoisonBuff);
BuffFactory.register("knockup", KnockUpBuff);

// ——— 测试用 Buff 注册 ———
BuffFactory.register("test_stack",       StackTestBuff);
BuffFactory.register("test_persistent",  PersistentTestBuff);
BuffFactory.register("test_independent", IndependentTestBuff);
BuffFactory.register("test_replace",     ReplaceWeakerTestBuff);
BuffFactory.register("test_dmg_reduce",  DamageReductionTestBuff);
