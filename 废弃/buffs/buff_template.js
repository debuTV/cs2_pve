/**
 * @module 玩家系统/玩家/Buff/Buff基类
 */
import { Instance } from "cs_script/point_script";

/**
 * Buff 叠层模式枚举。
 *
 * 当同 typeId 的 Buff 被重复添加时，PlayerBuffManager 根据此值决定如何处理：
 *
 * | 模式              | 行为                                       |
 * |-------------------|--------------------------------------------|
 * | `REJECT`          | 拒绝重复，同 typeId 只允许一个实例          |
 * | `REFRESH`         | 刷新持续时间，保持一个实例              |
 * | `INDEPENDENT`     | 每次添加都新建独立实例                  |
 * | `STACK`           | 层数累计，上限 maxStacks                 |
 * | `REPLACE_WEAKER`  | 替换更弱实例，按 priority 比较           |
 */
export const BuffStackMode = {
    /** 拒绝重复，同 typeId 只允许一个实例 */
    REJECT:           "reject",
    /** 刷新持续时间，保持一个实例 */
    REFRESH:          "refresh",
    /** 独立多实例，每次添加都新建 */
    INDEPENDENT:      "independent",
    /** 层数累计，maxStacks 为上限 */
    STACK:            "stack",
    /** 替换更弱实例（按 priority 比较） */
    REPLACE_WEAKER:   "replace_weaker",
};

/**
 * Buff 持久策略枚举。
 *
 * 决定玩家死亡时该 Buff 是否保留：
 * - `COMBAT_TEMPORARY` — 临时战斗 Buff，死亡时由 BuffManager 自动清除。
 * - `PERSISTENT` — 持久 Buff，死亡后保留并在重生时触发 `onRespawn` 回调。
 */
export const BuffPersistPolicy = {
    /** 临时战斗 buff，死亡时清除 */
    COMBAT_TEMPORARY: "combat-temporary",
    /** 持续型/永久型 buff，死亡后保留 */
    PERSISTENT:       "persistent",
};

/*
Buff 生命周期方法说明：
  onAdd()              — 首次被添加到玩家身上
  onRefresh(newBuff)   — 同 typeId 已存在时被刷新
  onStack(newBuff)     — 同 typeId 叠层时
  onTick(dt)           — 每帧更新（仅 duration > 0 或需要持续逻辑的 buff）
  onBeforeDamageTaken(ctx) — 玩家受伤前，可修改 ctx.damage
  onAfterDamageTaken(ctx)  — 玩家受伤后
  onBeforeDealDamage(ctx)  — 玩家造成伤害前（预留）
  onAfterDealDamage(ctx)   — 玩家造成伤害后（预留）
  onStateChange(oldState, newState) — 玩家状态切换时
  onRespawn()          — 玩家重生时（仅 persistent buff 会触发）
  onRemove()           — 被移除时的清理

tags 示例：
  ["control"]           — 控制类（眩晕/禁锢等）
  ["dot"]               — 持续伤害
  ["hot"]               — 持续治疗
  ["shield"]            — 护盾
  ["persistent"]        — 永久型标记
  ["combat-temporary"]  — 临时战斗buff标记
*/

/**
 * Buff 基类。所有具体 Buff 继承此类并重写需要的生命周期方法。
 *
 * 子类只需在构造函数中配置属性（stackMode / tags / duration 等），
 * 然后按需重写下列生命周期方法：
 *
 * | 方法                       | 触发时机                           |
 * |----------------------------|--------------------------------------|
 * | `onAdd()`                  | 首次被添加到玩家身上                 |
 * | `onRefresh(newBuff)`       | 同 typeId 已存在时被刷新             |
 * | `onStack(newBuff)`         | STACK 模式下叠层时                  |
 * | `onTick(dt)`               | 每帧更新                               |
 * | `onIntervalTick(dt)`       | 每过 tickInterval 秒触发一次         |
 * | `onBeforeDamageTaken(ctx)` | 玩家受伤前，可修改 ctx.damage       |
 * | `onAfterDamageTaken(ctx)`  | 玩家受伤后                           |
 * | `onStateChange(old, new)`  | 玩家状态切换时                       |
 * | `onRespawn()`              | 重生时（仅 PERSISTENT Buff）           |
 * | `onRemove()`               | 被移除时的清理                         |
 *
 * 标签示例：`["dot"]`（持续伤害）、`["cc"]`（控制）、`["shield"]`（护盾）。
 *
 * @navigationTitle Buff 基类
 */
export class BuffTemplate {
    /**
     * @param {import("../player.js").Player} player 所属玩家实例
     * @param {Record<string, any>} [params] 初始化参数
     */
    constructor(player, params) {
        this.player = player;

        /** 运行时实例 id，由 BuffManager 分配 */
        this.id = -1;
        /** buff 类型标识，对应 BuffFactory 注册键，子类构造函数里设置 */
        this.typeId = "unknown";
        /** 效果来源描述 */
        this.source = params?.source ?? "";
        /** 持续时间（秒）。0 = 永久，> 0 = 限时 */
        this.duration = params?.duration ?? 0;
        /** 最大叠层数 */
        this.maxStacks = params?.maxStacks ?? 1;
        /** 当前层数 */
        this.stacks = 1;
        /** @type {string} 叠层模式 */
        this.stackMode = params?.stackMode ?? BuffStackMode.REFRESH;
        /** @type {string} 持久策略 */
        this.persistPolicy = params?.persistPolicy ?? BuffPersistPolicy.COMBAT_TEMPORARY;
        /** @type {string[]} 标签集 */
        this.tags = params?.tags ?? [];
        /** 优先级（用于 REPLACE_WEAKER 模式比较） */
        this.priority = params?.priority ?? 0;
        /** tick 间隔（秒），0 = 每帧触发 onTick，> 0 = 每隔 N 秒触发一次 */
        this.tickInterval = params?.tickInterval ?? 0;
        /** 扩展参数容器，不同 buff 的特有参数放这里 */
        this.effects = params?.effects ?? {};

        /** 剩余持续时间 */
        this.remainingTime = this.duration;
        /** 是否已过期 */
        this.expired = false;
        /** tick间隔计时器（内部用） */
        this._tickAccum = 0;
    }

    // ——— 生命周期方法（子类按需重写） ———

    /** 首次添加 */
    onAdd() {}

    /**
     * 同类型刷新时
     * @param {BuffTemplate} newBuff
     */
    onRefresh(newBuff) {
        this.remainingTime = newBuff.duration;
    }

    /**
     * 同类型叠层
     * @param {BuffTemplate} newBuff
     */
    onStack(newBuff) {
        this.stacks = Math.min(this.stacks + 1, this.maxStacks);
        this.remainingTime = newBuff.duration;
    }

    /**
     * 每帧更新。内置 tickInterval 支持。
     * 子类重写 onIntervalTick(dt) 来处理间隔计时逻辑，或直接重写 onTick(dt)。
     * @param {number} dt
     */
    onTick(dt) {
        if (this.duration > 0) {
            this.remainingTime -= dt;
            if (this.remainingTime <= 0) {
                this.expired = true;
            }
        }
        if (this.tickInterval > 0) {
            this._tickAccum += dt;
            while (this._tickAccum >= this.tickInterval) {
                this._tickAccum -= this.tickInterval;
                this.onIntervalTick(this.tickInterval);
            }
        }
    }

    /**
     * 每隔 tickInterval 秒触发一次，子类可重写。
     * @param {number} dt
     */
    onIntervalTick(dt) {}

    /**
     * 玩家受伤前，可修改 ctx.damage
     * @param {{damage: number, attacker: any}} ctx
     */
    onBeforeDamageTaken(ctx) {}

    /**
     * 玩家受伤后
     * @param {{damage: number, attacker: any}} ctx
     */
    onAfterDamageTaken(ctx) {}

    /**
     * 玩家造成伤害前（预留）
     * @param {{damage: number, target: any}} ctx
     */
    onBeforeDealDamage(ctx) {}

    /**
     * 玩家造成伤害后（预留）
     * @param {{damage: number, target: any}} ctx
     */
    onAfterDealDamage(ctx) {}

    /**
     * 玩家状态切换
     * @param {number} oldState
     * @param {number} newState
     */
    onStateChange(oldState, newState) {}

    /** 玩家重生（仅 persistent buff 触发） */
    onRespawn() {}

    /** 被移除时的清理 */
    onRemove() {}

    // ——— 查询方法 ———

    /** 剩余时间（永久返回 Infinity）。 @returns {number} */
    getRemainingTime() {
        return this.duration <= 0 ? Infinity : this.remainingTime;
    }

    /**
     * 检查是否包含指定标签。
     * @param {string} tag 标签名称
     * @returns {boolean}
     */
    hasTag(tag) {
        return this.tags.includes(tag);
    }
}
