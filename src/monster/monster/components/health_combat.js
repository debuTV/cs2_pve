/**
 * @module 怪物系统/怪物组件/生命与战斗
 */
import { BaseModelEntity, CSPlayerPawn, Instance } from "cs_script/point_script";
import { eventBus } from "../../../util/event_bus";
import { event } from "../../../util/definition";
import { formatScopedMessage } from "../../../util/log";
import { MonsterState } from "../../monster_const";
import { MonsterRuntimeEvents } from "../../../util/runtime_events.js";

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
        this.monster.emitRuntimeEvent(MonsterRuntimeEvents.BeforeTakeDamage, ctx);
        amount = ctx.damage;

        const previousHealth = this.monster.health;

        if (amount <= 0) {
            this.monster.emitRuntimeEvent(MonsterRuntimeEvents.TakeDamage, {
                ...ctx,
                damage: 0,
                value: 0,
                health: this.monster.health,
                previousHealth,
                currentHealth: this.monster.health,
            });
            return false;
        }

        let finalAmount = amount;
        for (const mod of this._damageModifiers) {
            finalAmount = mod(finalAmount);
            if (finalAmount <= 0) {
                this.monster.emitRuntimeEvent(MonsterRuntimeEvents.TakeDamage, {
                    ...ctx,
                    damage: 0,
                    value: 0,
                    health: this.monster.health,
                    previousHealth,
                    currentHealth: this.monster.health,
                });
                return false;
            }
        }

        this.monster.health = Math.max(0, Math.min(this.monster.health - finalAmount, this.monster.maxhealth));
        this.monster.emitRuntimeEvent(MonsterRuntimeEvents.TakeDamage, {
            ...ctx,
            damage: finalAmount,
            value: finalAmount,
            health: this.monster.health,
            previousHealth,
            currentHealth: this.monster.health,
        });
        /** @type {import("../../monster_const").OnMonsterDamaged} */
        const payload = {
            monster: this.monster,
            damage: finalAmount,
            previousHealth,
            currentHealth: this.monster.health,
            attacker: attacker instanceof CSPlayerPawn ? attacker : null,
        };
        eventBus.emit(event.Monster.Out.OnMonsterDamaged, payload);
        Instance.Msg(formatScopedMessage("MonsterHealthCombat/takeDamage", `怪物 #${this.monster.id} 受到 ${finalAmount} 点伤害 (原始:${amount}) (${previousHealth} -> ${this.monster.health})`));

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
                activator: killer ?? this.monster.target?.entityBridge.pawn ?? undefined,
            });
        }

        const prevState = this.monster.state;
        this.monster.state = MonsterState.DEAD;
        this.monster.emitRuntimeEvent(MonsterRuntimeEvents.StateChange, { oldState: prevState, nextState: MonsterState.DEAD });
        this.monster.emitRuntimeEvent(MonsterRuntimeEvents.Die, { killer });
        this.monster.clearBuffs();
        if (this.monster.model instanceof BaseModelEntity) {
            this.monster.model.Unglow();
        }
        this.monster.killer = killer instanceof CSPlayerPawn ? killer : null;
        this.monster.emitDeathEvent(killer);
        this.monster.animation.enter(MonsterState.DEAD);
        Instance.Msg(formatScopedMessage("MonsterHealthCombat/die", `怪物 #${this.monster.id} 死亡`));
    }

    enterAttack() {
        const model = this.monster.model;
        const target = this.monster.target;
        if (!model?.IsValid() || !target) return;

        this.monster.animation.setOccupation("attack");
        this.monster.movementPath.onOccupationChanged();
        this.monster.attackCooldown = this.monster.atc;

        const origin = this.monster.pos;
        const targetPos = target.pos;
        const distsq = this.monster.distanceTosq(targetPos);
        if (distsq > this.monster.attackdist * this.monster.attackdist) {
            this.monster.emitRuntimeEvent(MonsterRuntimeEvents.AttackFalse, { target });
            return;
        }

        this.monster.emitRuntimeEvent(MonsterRuntimeEvents.AttackTrue, { target, damage: this.monster.damage });
        const targetpawn=target?.entityBridge.pawn;
        if(targetpawn)this.monster.emitAttackEvent(this.monster.damage, targetpawn);

        const l = 300 / Math.hypot(targetPos.x - origin.x, targetPos.y - origin.y);
        void l;
    }
}
