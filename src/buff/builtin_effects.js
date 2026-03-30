import { BuffEffectType, BuffPersistPolicy, BuffPolarity, BuffStackMode, BuffTargetType } from "./buff_const";

function toFiniteNumber(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

export function resolveEffectValue(buff, effect, field, fallback = 0) {
    const resolver = effect?.[`${field}Resolver`];
    if (typeof resolver === "function") {
        return toFiniteNumber(resolver(buff, effect, buff.adapter), fallback);
    }

    const paramKey = effect?.[`${field}From`];
    if (typeof paramKey === "string" && buff.params && buff.params[paramKey] !== undefined) {
        return toFiniteNumber(buff.params[paramKey], fallback);
    }

    const raw = effect?.[field];
    if (typeof raw === "function") {
        return toFiniteNumber(raw(buff, effect, buff.adapter), fallback);
    }
    if (raw !== undefined) {
        return toFiniteNumber(raw, fallback);
    }
    return fallback;
}

function getScaledValue(buff, effect, value) {
    if (!effect?.scaleWithStacks || buff.stacks <= 1) return value;
    if (effect.op === "mul") return Math.pow(value, buff.stacks);
    return value * buff.stacks;
}

export function applyInstantEffects(buff, phase) {
    for (let i = 0; i < buff.effects.length; i++) {
        const effect = buff.effects[i];
        if (effect?.type !== BuffEffectType.INSTANT_RESOURCE) continue;
        if (!buff.adapter.supportsEffect(effect)) continue;

        const applyOn = effect.applyOn ?? "add";
        if (applyOn !== phase) continue;

        const rawValue = resolveEffectValue(buff, effect, "value", 0);
        const delta = getScaledValue(buff, effect, rawValue);
        if (!delta) continue;

        buff.adapter.addResource(effect.key, delta, {
            buff,
            phase,
            reason: `buff:${buff.typeId}:${phase}`,
            source: buff.source,
        });
    }
}

export function tickPeriodicEffects(buff, dt) {
    for (let i = 0; i < buff.effects.length; i++) {
        const effect = buff.effects[i];
        if (effect?.type !== BuffEffectType.PERIODIC_RESOURCE) continue;
        if (!buff.adapter.supportsEffect(effect)) continue;

        const key = effect.id ?? `${effect.type}:${effect.key}:${i}`;
        const interval = Math.max(0, resolveEffectValue(buff, effect, "interval", 0));
        const baseValue = resolveEffectValue(buff, effect, "value", 0);
        const scaledValue = getScaledValue(buff, effect, baseValue);

        if (!scaledValue) continue;

        if (interval <= 0) {
            const delta = effect.perSecond ? scaledValue * dt : scaledValue;
            if (!delta) continue;
            buff.adapter.addResource(effect.key, delta, {
                buff,
                phase: "tick",
                reason: `buff:${buff.typeId}:tick`,
                source: buff.source,
            });
            continue;
        }

        const previous = buff._periodicAccums.get(key) ?? 0;
        let accum = previous + dt;
        while (accum >= interval) {
            accum -= interval;
            const delta = effect.perSecond ? scaledValue * interval : scaledValue;
            if (delta) {
                buff.adapter.addResource(effect.key, delta, {
                    buff,
                    phase: "interval",
                    reason: `buff:${buff.typeId}:interval`,
                    source: buff.source,
                });
            }
        }
        buff._periodicAccums.set(key, accum);
    }
}

export function recomputePassiveEffects(adapter, buffs, previousStatKeys = new Set(), previousGainKeys = new Set()) {
    const statAggregates = new Map();
    const gainAggregates = new Map();

    for (const buff of buffs) {
        for (const effect of buff.effects) {
            if (!adapter.supportsEffect(effect)) continue;

            if (effect.type === BuffEffectType.STAT_MODIFIER) {
                const aggregate = statAggregates.get(effect.key) ?? { add: 0, mul: 1 };
                const resolved = resolveEffectValue(buff, effect, "value", effect.op === "mul" ? 1 : 0);
                const scaled = getScaledValue(buff, effect, resolved);
                if (effect.op === "mul") aggregate.mul *= scaled;
                else aggregate.add += scaled;
                statAggregates.set(effect.key, aggregate);
                continue;
            }

            if (effect.type === BuffEffectType.GAIN_MODIFIER) {
                const aggregate = gainAggregates.get(effect.key) ?? { add: 0, mul: 1 };
                const resolved = resolveEffectValue(buff, effect, "value", effect.op === "mul" ? 1 : 0);
                const scaled = getScaledValue(buff, effect, resolved);
                if (effect.op === "mul") aggregate.mul *= scaled;
                else aggregate.add += scaled;
                gainAggregates.set(effect.key, aggregate);
            }
        }
    }

    const statKeys = new Set([...previousStatKeys, ...statAggregates.keys()]);
    for (const key of statKeys) {
        const base = toFiniteNumber(adapter.getBaseStat(key), 0);
        const aggregate = statAggregates.get(key) ?? { add: 0, mul: 1 };
        adapter.setDerivedStat(key, (base + aggregate.add) * aggregate.mul);
    }
    adapter.recomputeDerivedStats();

    const gainKeys = new Set([...previousGainKeys, ...gainAggregates.keys()]);
    for (const key of gainKeys) {
        const base = Math.max(0, toFiniteNumber(adapter.getBaseGainModifier(key), 1));
        const aggregate = gainAggregates.get(key) ?? { add: 0, mul: 1 };
        adapter.setGainModifier(key, Math.max(0, (base + aggregate.add) * aggregate.mul));
    }
    adapter.recomputeGainModifiers();

    return { statKeys, gainKeys };
}

export function registerBuiltinBuffs(registry) {
    const playerOnly = [BuffTargetType.PLAYER];
    const monsterOnly = [BuffTargetType.MONSTER];
    const playerAndMonster = [BuffTargetType.PLAYER, BuffTargetType.MONSTER];

    registry.register("attack_up", {
        targetTypes: playerAndMonster,
        polarity: BuffPolarity.BUFF,
        stackMode: BuffStackMode.REFRESH,
        persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: 8,
        tags: ["attack", "positive"],
        effects: [
            { type: BuffEffectType.STAT_MODIFIER, key: "attack", op: "mul", value: 1.25, valueFrom: "multiplier" },
            { type: BuffEffectType.STAT_MODIFIER, key: "attack", op: "add", value: 0, valueFrom: "flatBonus" },
        ],
    });

    registry.register("attack_down", {
        targetTypes: playerAndMonster,
        polarity: BuffPolarity.DEBUFF,
        stackMode: BuffStackMode.REFRESH,
        persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: 8,
        tags: ["attack", "negative", "debuff"],
        effects: [
            { type: BuffEffectType.STAT_MODIFIER, key: "attack", op: "mul", value: 0.75, valueFrom: "multiplier" },
            { type: BuffEffectType.STAT_MODIFIER, key: "attack", op: "add", value: 0, valueFrom: "flatBonus" },
        ],
    });

    registry.register("max_health_up", {
        targetTypes: playerAndMonster,
        polarity: BuffPolarity.BUFF,
        stackMode: BuffStackMode.REFRESH,
        persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: 12,
        tags: ["health", "positive"],
        effects: [
            { type: BuffEffectType.STAT_MODIFIER, key: "maxHealth", op: "mul", value: 1.25, valueFrom: "multiplier" },
            { type: BuffEffectType.STAT_MODIFIER, key: "maxHealth", op: "add", value: 0, valueFrom: "flatBonus" },
        ],
    });

    registry.register("max_health_down", {
        targetTypes: playerAndMonster,
        polarity: BuffPolarity.DEBUFF,
        stackMode: BuffStackMode.REFRESH,
        persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: 12,
        tags: ["health", "negative", "debuff"],
        effects: [
            { type: BuffEffectType.STAT_MODIFIER, key: "maxHealth", op: "mul", value: 0.75, valueFrom: "multiplier" },
            { type: BuffEffectType.STAT_MODIFIER, key: "maxHealth", op: "add", value: 0, valueFrom: "flatBonus" },
        ],
    });

    registry.register("poison", {
        targetTypes: playerAndMonster,
        polarity: BuffPolarity.DEBUFF,
        stackMode: BuffStackMode.REFRESH,
        persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: 4,
        tags: ["health", "dot", "poison", "debuff"],
        effects: [
            {
                type: BuffEffectType.PERIODIC_RESOURCE,
                key: "health",
                value: -5,
                valueFrom: "dps",
                perSecond: true,
                interval: 1,
                intervalFrom: "tickInterval",
            },
        ],
    });

    registry.register("regen", {
        targetTypes: playerAndMonster,
        polarity: BuffPolarity.BUFF,
        stackMode: BuffStackMode.REFRESH,
        persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: 4,
        tags: ["health", "hot", "positive"],
        effects: [
            {
                type: BuffEffectType.PERIODIC_RESOURCE,
                key: "health",
                value: 5,
                valueFrom: "hps",
                perSecond: true,
                interval: 1,
                intervalFrom: "tickInterval",
            },
        ],
    });

    registry.register("armor_up", {
        targetTypes: playerOnly,
        polarity: BuffPolarity.BUFF,
        stackMode: BuffStackMode.INDEPENDENT,
        persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: 0,
        expireAfterApply: true,
        tags: ["armor", "positive"],
        effects: [
            { type: BuffEffectType.INSTANT_RESOURCE, key: "armor", value: 25, valueFrom: "amount", applyOn: "add" },
        ],
    });

    registry.register("armor_down", {
        targetTypes: playerOnly,
        polarity: BuffPolarity.DEBUFF,
        stackMode: BuffStackMode.INDEPENDENT,
        persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: 0,
        expireAfterApply: true,
        tags: ["armor", "negative", "debuff"],
        effects: [
            { type: BuffEffectType.INSTANT_RESOURCE, key: "armor", value: -25, valueFrom: "amount", applyOn: "add" },
        ],
    });

    registry.register("money_gain_up", {
        targetTypes: playerOnly,
        polarity: BuffPolarity.BUFF,
        stackMode: BuffStackMode.REFRESH,
        persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: 12,
        tags: ["money", "positive"],
        effects: [
            { type: BuffEffectType.GAIN_MODIFIER, key: "moneyGain", op: "mul", value: 1.5, valueFrom: "multiplier" },
        ],
    });

    registry.register("money_gain_down", {
        targetTypes: playerOnly,
        polarity: BuffPolarity.DEBUFF,
        stackMode: BuffStackMode.REFRESH,
        persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: 12,
        tags: ["money", "negative", "debuff"],
        effects: [
            { type: BuffEffectType.GAIN_MODIFIER, key: "moneyGain", op: "mul", value: 0.5, valueFrom: "multiplier" },
        ],
    });

    registry.register("exp_gain_up", {
        targetTypes: playerOnly,
        polarity: BuffPolarity.BUFF,
        stackMode: BuffStackMode.REFRESH,
        persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: 12,
        tags: ["exp", "positive"],
        effects: [
            { type: BuffEffectType.GAIN_MODIFIER, key: "expGain", op: "mul", value: 1.5, valueFrom: "multiplier" },
        ],
    });

    registry.register("exp_gain_down", {
        targetTypes: playerOnly,
        polarity: BuffPolarity.DEBUFF,
        stackMode: BuffStackMode.REFRESH,
        persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: 12,
        tags: ["exp", "negative", "debuff"],
        effects: [
            { type: BuffEffectType.GAIN_MODIFIER, key: "expGain", op: "mul", value: 0.5, valueFrom: "multiplier" },
        ],
    });

    registry.register("money_over_time", {
        targetTypes: playerOnly,
        polarity: BuffPolarity.BUFF,
        stackMode: BuffStackMode.REFRESH,
        persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: 8,
        tags: ["money", "positive"],
        effects: [
            {
                type: BuffEffectType.PERIODIC_RESOURCE,
                key: "money",
                value: 25,
                valueFrom: "amount",
                interval: 1,
                intervalFrom: "tickInterval",
            },
        ],
    });

    registry.register("money_burn", {
        targetTypes: playerOnly,
        polarity: BuffPolarity.DEBUFF,
        stackMode: BuffStackMode.REFRESH,
        persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: 8,
        tags: ["money", "negative", "debuff"],
        effects: [
            {
                type: BuffEffectType.PERIODIC_RESOURCE,
                key: "money",
                value: -25,
                valueFrom: "amount",
                interval: 1,
                intervalFrom: "tickInterval",
            },
        ],
    });

    registry.register("exp_over_time", {
        targetTypes: playerOnly,
        polarity: BuffPolarity.BUFF,
        stackMode: BuffStackMode.REFRESH,
        persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: 8,
        tags: ["exp", "positive"],
        effects: [
            {
                type: BuffEffectType.PERIODIC_RESOURCE,
                key: "exp",
                value: 15,
                valueFrom: "amount",
                interval: 1,
                intervalFrom: "tickInterval",
            },
        ],
    });

    registry.register("exp_burn", {
        targetTypes: playerOnly,
        polarity: BuffPolarity.DEBUFF,
        stackMode: BuffStackMode.REFRESH,
        persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: 8,
        tags: ["exp", "negative", "debuff"],
        effects: [
            {
                type: BuffEffectType.PERIODIC_RESOURCE,
                key: "exp",
                value: -15,
                valueFrom: "amount",
                interval: 1,
                intervalFrom: "tickInterval",
            },
        ],
    });

    registry.register("speed_up", {
        targetTypes: monsterOnly,
        polarity: BuffPolarity.BUFF,
        stackMode: BuffStackMode.REFRESH,
        persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: 5,
        tags: ["speed", "positive"],
        effects: [
            { type: BuffEffectType.STAT_MODIFIER, key: "speed", op: "mul", value: 1.35, valueFrom: "multiplier" },
            { type: BuffEffectType.STAT_MODIFIER, key: "speed", op: "add", value: 0, valueFrom: "flatBonus" },
        ],
    });

    registry.register("speed_down", {
        targetTypes: monsterOnly,
        polarity: BuffPolarity.DEBUFF,
        stackMode: BuffStackMode.REFRESH,
        persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: 5,
        tags: ["speed", "negative", "debuff"],
        effects: [
            { type: BuffEffectType.STAT_MODIFIER, key: "speed", op: "mul", value: 0.7, valueFrom: "multiplier" },
            { type: BuffEffectType.STAT_MODIFIER, key: "speed", op: "add", value: 0, valueFrom: "flatBonus" },
        ],
    });

    registry.register("knockup", {
        targetTypes: playerOnly,
        polarity: BuffPolarity.DEBUFF,
        stackMode: BuffStackMode.REJECT,
        persistPolicy: BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: 0.6,
        tags: ["cc", "knockup", "debuff", "compat"],
        hooks: {
            onAdd(buff) {
                const pawn = buff.adapter.getPawn?.();
                if (!pawn || !pawn.IsValid?.()) return;

                const direction = buff.params?.direction ?? null;
                const impulse = toFiniteNumber(buff.params?.impulse, 300);
                const verticalBoost = toFiniteNumber(buff.params?.verticalBoost, 400);
                const vx = direction ? toFiniteNumber(direction.x, 0) * impulse : 0;
                const vy = direction ? toFiniteNumber(direction.y, 0) * impulse : 0;
                pawn.Teleport(null, null, { x: vx, y: vy, z: verticalBoost });
            },
        },
    });
}
