/**
 * @module 怪物系统/怪物组件/生命与战斗
 */
import { BaseModelEntity, CSPlayerPawn, Instance } from "cs_script/point_script";
import { MonsterBuffEvents, MonsterState } from "../../monster_const";

export class MonsterHealthCombat {
    /**
     * @param {import("../monster").Monster} monster
     */
    constructor(monster) {
        this.monster = monster;
        /** @type {((amount: number) => number)[]} */
        this._damageModifiers = [];
    }

    /**
     * @param {(amount: number) => number} modifier
     */
    addDamageModifier(modifier) {
        this._damageModifiers.push(modifier);
    }

    /**
     * @param {(amount: number) => number} modifier
     */
    removeDamageModifier(modifier) {
        const idx = this._damageModifiers.indexOf(modifier);
        if (idx !== -1) this._damageModifiers.splice(idx, 1);
    }

    /**
     * @param {number} amount
     * @param {import("cs_script/point_script").CSPlayerPawn | null} attacker
     * @param {{ source?: import("cs_script/point_script").Entity | null, reason?: string } | null} [meta]
     * @returns {boolean}
     */
    takeDamage(amount, attacker, meta = null) {
        if (this.monster.state === MonsterState.DEAD) return true;

        const modifiedAmount = this.monster.requestBeforeTakeDamage(amount, attacker);
        if (typeof modifiedAmount === "number") {
            amount = modifiedAmount;
        }

        const ctx = {
            damage: amount,
            attacker,
            source: meta?.source ?? null,
            reason: meta?.reason,
        };
        this.monster.emitBuffEvent(MonsterBuffEvents.BeforeTakeDamage, ctx);
        amount = ctx.damage;

        if (amount <= 0) {
            this.monster.emitBuffEvent(MonsterBuffEvents.TakeDamage, { ...ctx, damage: 0 });
            this.monster.emitEvent({ type: MonsterBuffEvents.TakeDamage, value: 0, health: this.monster.health });
            return false;
        }

        let finalAmount = amount;
        for (const mod of this._damageModifiers) {
            finalAmount = mod(finalAmount);
            if (finalAmount <= 0) {
                this.monster.emitBuffEvent(MonsterBuffEvents.TakeDamage, { ...ctx, damage: 0 });
                this.monster.emitEvent({ type: MonsterBuffEvents.TakeDamage, value: 0, health: this.monster.health });
                return false;
            }
        }

        const previousHealth = this.monster.health;
        this.monster.health = Math.max(0, Math.min(this.monster.health - finalAmount, this.monster.maxhealth));
        this.monster.emitBuffEvent(MonsterBuffEvents.TakeDamage, { ...ctx, damage: finalAmount });
        this.monster.emitEvent({ type: MonsterBuffEvents.TakeDamage, value: finalAmount, health: this.monster.health });
        Instance.Msg(`鎬墿 #${this.monster.id} 鍙楀埌 ${finalAmount} 鐐逛激瀹?(鍘熷:${amount}) (${previousHealth} -> ${this.monster.health})`);

        if (this.monster.health <= 0) {
            this.die(attacker);
            return true;
        }
        return false;
    }

    /**
     * @param {import("cs_script/point_script").Entity | null | undefined} killer
     */
    die(killer) {
        if (this.monster.state === MonsterState.DEAD) return;

        const breakable = this.monster.breakable;
        if (breakable?.IsValid()) {
            Instance.EntFireAtTarget({
                target: breakable,
                input: "fireuser1",
                activator: killer ?? this.monster.target ?? undefined,
            });
        }

        const prevState = this.monster.state;
        this.monster.state = MonsterState.DEAD;
        this.monster.emitBuffEvent("OnStateChange", { oldState: prevState, nextState: MonsterState.DEAD });
        this.monster.clearBuffs();
        if (this.monster.model instanceof BaseModelEntity) {
            this.monster.model.Unglow();
        }
        this.monster.emitEvent({ type: MonsterBuffEvents.Die });
        this.monster.killer = killer instanceof CSPlayerPawn ? killer : null;
        this.monster.emitDeathEvent(killer);
        this.monster.animation.enter(MonsterState.DEAD);
        Instance.Msg(`鎬墿 #${this.monster.id} 姝讳骸`);
    }

    enterAttack() {
        const model = this.monster.model;
        const target = this.monster.target;
        if (!model?.IsValid() || !target) return;

        this.monster.animation.setOccupation("attack");
        this.monster.movementPath.onOccupationChanged();
        this.monster.attackCooldown = this.monster.atc;

        const origin = model.GetAbsOrigin();
        const targetPos = target.GetAbsOrigin();
        const distsq = this.monster.distanceTosq(target);
        if (distsq > this.monster.attackdist * this.monster.attackdist) {
            this.monster.emitEvent({ type: MonsterBuffEvents.AttackFalse });
            return;
        }

        this.monster.emitEvent({ type: MonsterBuffEvents.AttackTrue });
        this.monster.emitAttackEvent(this.monster.damage, target);

        const l = 300 / Math.hypot(targetPos.x - origin.x, targetPos.y - origin.y);
        void l;
    }
}
