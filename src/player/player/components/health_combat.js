/**
 * @module 玩家系统/玩家/组件/战斗组件
 */
import { Instance } from "cs_script/point_script";
import { PlayerBuffEvents } from "../../../buff/buff_const";
import { PlayerState } from "../../player_const";

/**
 * 玩家战斗组件 — 受伤、治疗与死亡判定。
 *
 * 所有对玩家的伤害都应通过 `takeDamage(damage, attacker)` 进入本组件。
 * 内部流程：
 * 1. 从引擎 Pawn 同步当前血量/护甲。
 * 2. 将伤害送入玩家 Buff 事件链（Buff 可减伤/增伤）。
 * 3. 优先扣护甲，再扣血量。
 * 4. 写回引擎并发布事件（DAMAGE_TAKEN / DEATH）。
 *
 * `heal(amount)` 提供治疗入口，受 maxHealth 上限限制。
 *
 * 死亡时：切换状态为 DEAD → 通知 Buff 层 → 切换至旁观者队伍。
 *
 * @navigationTitle 玩家战斗组件
 */
export class PlayerHealthCombat {
    /**
     * @param {import("../player.js").Player} player 所属玩家实例
     */
    constructor(player) {
        this.player = player;
    }

    /**
     * 玩家受到伤害（统一入口）
     * @param {number} damage
     * @param {import("cs_script/point_script").Entity|null} [attacker]
     * @returns {boolean} 是否死亡
     */
    takeDamage(damage, attacker) {
        if (this.player.state === PlayerState.DEAD) return true;
        if (!this.player.entityBridge.isPawnValid()) return false;

        // 从引擎同步当前值
        this._syncFromEngine();

        // buff 修饰器链
        const ctx = { damage, attacker };
        // 触发前置事件，允许 buff 修改伤害,例如减伤、增伤、护甲一类的效果
        this.player.emitBuffEvent(PlayerBuffEvents.BeforeTakeDamage, ctx);
        damage = ctx.damage;

        if (damage <= 0) return false;
        // 优先扣护甲
        const armor = this.player.stats.armor;
        const damageToArmor = Math.min(armor, damage);
        const damageToHealth = damage - damageToArmor;
        // 扣护甲
        this.player.stats.setArmor(armor - damageToArmor);
        this.player.entityBridge.syncArmor(this.player.stats.armor);

        // 扣血后同步
        this.player.stats.setHealth(this.player.stats.health - damageToHealth);
        this.player.entityBridge.syncHealth(this.player.stats.health);

        Instance.Msg(`玩家 ${this.player.entityBridge.getPlayerName()} 受到 ${damage} 伤害 (生命: ${this.player.stats.health}, 护甲: ${this.player.stats.armor})`);

        if (this.player.stats.health <= 0) {
            this.die(attacker);
            return true;
        }
        return false;
    }

    /**
     * 引擎伤害事件同步（OnPlayerDamage 回调时调用）
     * 此时引擎已经扣过血，只需同步脚本侧记录并检测死亡。
     * @param {number} damage
     * @param {import("cs_script/point_script").Entity|null} [attacker]
     * @param {import("cs_script/point_script").Entity|null} [inflictor]
     * @returns {boolean} 是否死亡
     */
    syncDamageFromEngine(damage, attacker, inflictor) {
        if (this.player.state === PlayerState.DEAD) return true;

        this._syncFromEngine();

        Instance.Msg(`玩家 ${this.player.entityBridge.getPlayerName()} 受到 ${damage} 伤害 (生命: ${this.player.stats.health}, 护甲: ${this.player.stats.armor})`);

        if (this.player.stats.health <= 0) {
            this.die(attacker);
            return true;
        }
        return false;
    }

    /**
     * 治疗
     * @param {number} amount
     * @returns {boolean}
     */
    heal(amount) {
        if (this.player.state === PlayerState.DEAD) return false;
        if (!this.player.entityBridge.isPawnValid()) return false;

        const stats = this.player.stats;
        const newHealth = Math.min(stats.health + amount, stats.maxHealth);
        const actualHeal = newHealth - stats.health;
        if (actualHeal <= 0) return false;

        stats.setHealth(newHealth);
        this.player.entityBridge.syncHealth(stats.health);

        return true;
    }

    /**
     * 给予护甲
     * @param {number} amount
     * @returns {boolean}
     */
    giveArmor(amount) {
        if (this.player.state === PlayerState.DEAD) return false;
        if (!this.player.entityBridge.isPawnValid()) return false;

        const stats = this.player.stats;
        const newArmor = Math.min(stats.armor + amount, 100);
        const actual = newArmor - stats.armor;
        if (actual <= 0) return false;

        stats.setArmor(newArmor);
        this.player.entityBridge.syncArmor(stats.armor);
        return true;
    }

    /**
     * 死亡流程
     * @param {import("cs_script/point_script").Entity|null} [killer]
     */
    die(killer) {
        if (this.player.state === PlayerState.DEAD) return;

        this.player.applyStateTransition(PlayerState.DEAD);

        // 清理临时战斗 buff
        this.player.emitBuffEvent(PlayerBuffEvents.Die, { killer });

        // 切换到观察者
        this.player.entityBridge.joinTeam(1);

        Instance.Msg(`玩家 ${this.player.entityBridge.getPlayerName()} 死亡`);
    }

    // ——— 内部 ———

    /** 从引擎读取 health/armor 到脚本 */
    _syncFromEngine() {
        const bridge = this.player.entityBridge;
        if (!bridge.isPawnValid()) return;
        this.player.stats.health = bridge.readHealth();
        this.player.stats.armor  = bridge.readArmor();
    }
}
