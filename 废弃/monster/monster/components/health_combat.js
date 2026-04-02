/**
 * @module 怪物系统/怪物组件/生命与战斗
 */
import { Instance } from "cs_script/point_script";
import { MonsterBuffEvents, MonsterState } from "../monster_state";

export class MonsterHealthCombat {
    constructor(monster) {
        this.monster = monster;
        /** @type {((amount: number) => number)[]} */
        this._damageModifiers = [];
    }

    addDamageModifier(modifier) {
        this._damageModifiers.push(modifier);
    }

    removeDamageModifier(modifier) {
        const idx = this._damageModifiers.indexOf(modifier);
        if (idx !== -1) this._damageModifiers.splice(idx, 1);
    }

    takeDamage(amount, attacker, meta = null) {
        if (this.monster.state === MonsterState.DEAD) return true;

        const modifiedAmount = this.monster.events.OnBeforeTakeDamage?.(this.monster, amount, attacker);
        if (typeof modifiedAmount === "number") {
            amount = modifiedAmount;
        }

        const ctx = {
            damage: amount,
            attacker,
            source: meta?.source ?? null,
            reason: meta?.reason,
        };
        this.monster.buffManager.onBeforeDamageTaken(ctx);
        amount = ctx.damage;

        if (amount <= 0) {
            this.monster.buffManager.onAfterDamageTaken({ ...ctx, damage: 0 });
            this.monster.emitEvent({ type: MonsterBuffEvents.TakeDamage, value: 0, health: this.monster.health });
            return false;
        }

        let finalAmount = amount;
        for (const mod of this._damageModifiers) {
            finalAmount = mod(finalAmount);
            if (finalAmount <= 0) {
                this.monster.buffManager.onAfterDamageTaken({ ...ctx, damage: 0 });
                this.monster.emitEvent({ type: MonsterBuffEvents.TakeDamage, value: 0, health: this.monster.health });
                return false;
            }
        }

        const previousHealth = this.monster.health;
        this.monster.health = Math.max(0, Math.min(this.monster.health - finalAmount, this.monster.maxhealth));
        this.monster.buffManager.onAfterDamageTaken({ ...ctx, damage: finalAmount });
        this.monster.emitEvent({ type: MonsterBuffEvents.TakeDamage, value: finalAmount, health: this.monster.health });
        Instance.Msg(`鎬墿 #${this.monster.id} 鍙楀埌 ${finalAmount} 鐐逛激瀹?(鍘熷:${amount}) (${previousHealth} -> ${this.monster.health})`);

        if (this.monster.health <= 0) {
            this.die(attacker);
            return true;
        }
        return false;
    }

    die(killer) {
        if (this.monster.state === MonsterState.DEAD) return;

        Instance.EntFireAtTarget({
            target: this.monster.breakable,
            input: "fireuser1",
            activator: killer ?? this.monster.target ?? undefined,
        });

        const prevState = this.monster.state;
        this.monster.state = MonsterState.DEAD;
        this.monster.buffManager.onStateChange(prevState, MonsterState.DEAD);
        this.monster.buffManager.clearAll();
        this.monster.model?.Unglow?.();
        this.monster.emitEvent({ type: MonsterBuffEvents.Die });
        this.monster.killer = killer;
        this.monster.events.OnDie?.(this.monster, killer);
        this.monster.animator.enter(MonsterState.DEAD);
        Instance.Msg(`鎬墿 #${this.monster.id} 姝讳骸`);
    }

    enterAttack() {
        if (!this.monster.target) return;

        this.monster.animationOccupation.setOccupation("attack");
        this.monster.movementPath.onOccupationChanged();
        this.monster.attackCooldown = this.monster.atc;

        const origin = this.monster.model.GetAbsOrigin();
        const target = this.monster.target.GetAbsOrigin();
        const distsq = this.monster.distanceTosq(this.monster.target);
        if (distsq > this.monster.attackdist * this.monster.attackdist) {
            this.monster.emitEvent({ type: MonsterBuffEvents.AttackFalse });
            return;
        }

        this.monster.emitEvent({ type: MonsterBuffEvents.AttackTrue });
        this.monster.events.OnAttackTrue?.(this.monster.damage, this.monster.target);

        const l = 300 / Math.hypot(target.x - origin.x, target.y - origin.y);
        void l;
    }
}
