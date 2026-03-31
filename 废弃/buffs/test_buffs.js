/**
 * @module 玩家系统/玩家/Buff/测试Buff集
 */
import { BuffTemplate, BuffStackMode, BuffPersistPolicy } from "./buff_template";

/**
 * 可叠层 Buff — 测试 STACK 模式。
 *
 * 每层增加 `attackPerStack` 点 attack 加成，
 * 层数上限 maxStacks（默认 5）。移除或超时后自动取消加成。
 *
 * @navigationTitle 叠层测试 Buff
 */
export class StackTestBuff extends BuffTemplate {
    /**
     * @param {import("../player.js").Player} player
     * @param {Record<string, any>} [params]
     */
    constructor(player, params) {
        super(player, {
            duration:      params?.duration      ?? 10,
            maxStacks:     params?.maxStacks      ?? 5,
            stackMode:     BuffStackMode.STACK,
            persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
            tags:          ["test", "stack"],
            ...params,
        });
        this.typeId = "test_stack";
        /** @type {number} 每层攻击力加成 */
        this.attackPerStack = params?.attackPerStack ?? 2;
    }
}

/**
 * 持久 Buff — 测试 PERSISTENT 策略，死亡后保留。
 *
 * REJECT 叠层模式 + PERSISTENT 策略，死亡不清除。
 * 每次重生时 `respawnCount++` 用于验证 `onRespawn` 回调。
 *
 * @navigationTitle 持久测试 Buff
 */
export class PersistentTestBuff extends BuffTemplate {
    /**
     * @param {import("../player.js").Player} player
     * @param {Record<string, any>} [params]
     */
    constructor(player, params) {
        super(player, {
            duration:      0,   // 永久
            stackMode:     BuffStackMode.REJECT,
            persistPolicy: BuffPersistPolicy.PERSISTENT,
            tags:          ["test", "persistent"],
            ...params,
        });
        this.typeId = "test_persistent";
        /** @type {number} 重生次数计数器 */
        this.respawnCount = 0;
    }

    /**
     * 玩家重生时回调，累加重生计数。
     */
    onRespawn() {
        this.respawnCount++;
    }
}

/**
 * 独立多实例 Buff — 测试 INDEPENDENT 模式。
 *
 * 每次 addBuff 都会新建一个完全独立的实例，
 * 各实例拥有独立的计时和生命周期。
 *
 * @navigationTitle 独立测试 Buff
 */
export class IndependentTestBuff extends BuffTemplate {
    /**
     * @param {import("../player.js").Player} player
     * @param {Record<string, any>} [params]
     */
    constructor(player, params) {
        super(player, {
            duration:      params?.duration ?? 5,
            stackMode:     BuffStackMode.INDEPENDENT,
            persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
            tags:          ["test", "independent"],
            ...params,
        });
        this.typeId = "test_independent";
    }
}

/**
 * 替换更弱 Buff — 测试 REPLACE_WEAKER 模式。
 *
 * 添加时，若已有同 typeId 实例且 `power` 更低，
 * 则自动替换为更强的新实例；否则拒绝添加。
 *
 * @navigationTitle 替换更弱测试 Buff
 */
export class ReplaceWeakerTestBuff extends BuffTemplate {
    /**
     * @param {import("../player.js").Player} player
     * @param {Record<string, any>} [params]
     */
    constructor(player, params) {
        super(player, {
            duration:      params?.duration ?? 8,
            stackMode:     BuffStackMode.REPLACE_WEAKER,
            persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
            tags:          ["test", "replace_weaker"],
            ...params,
        });
        this.typeId = "test_replace";
        /** @type {number} Buff 强度（用于比较是否替换） */
        this.power = params?.power ?? 1;
    }
}

/**
 * 减伤 Buff — 测试 `onBeforeDamageTaken` 修饰器链。
 *
 * 在玩家受伤前将 `ctx.damage` 乘以 `(1 - reduction)`，
 * 默认减伤 50%。REFRESH 叠层模式，重复添加刷新持续时间。
 *
 * @navigationTitle 减伤测试 Buff
 */
export class DamageReductionTestBuff extends BuffTemplate {
    /**
     * @param {import("../player.js").Player} player
     * @param {Record<string, any>} [params]
     */
    constructor(player, params) {
        super(player, {
            duration:      params?.duration ?? 10,
            stackMode:     BuffStackMode.REFRESH,
            persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
            tags:          ["test", "shield", "damage_reduction"],
            ...params,
        });
        this.typeId = "test_dmg_reduce";
        /** @type {number} 减伤比例（0.5 = 50%） */
        this.reduction = params?.reduction ?? 0.5;
    }

    /** @param {{damage: number, attacker: any}} ctx */
    onBeforeDamageTaken(ctx) {
        ctx.damage = Math.max(0, ctx.damage * (1 - this.reduction));
    }
}
