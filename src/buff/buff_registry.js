import { BuffPersistPolicy, BuffPolarity, BuffStackMode, BuffTargetType } from "./buff_const";
import { registerBuiltinBuffs } from "./builtin_effects";

function normalizeArray(value, fallback = []) {
    return Array.isArray(value) ? [...value] : [...fallback];
}

function normalizeDefinition(typeId, definition) {
    return {
        typeId,
        groupKey: definition.groupKey ?? typeId,
        targetTypes: normalizeArray(definition.targetTypes, [BuffTargetType.PLAYER, BuffTargetType.MONSTER]),
        polarity: definition.polarity ?? BuffPolarity.BUFF,
        stackMode: definition.stackMode ?? BuffStackMode.REFRESH,
        persistPolicy: definition.persistPolicy ?? BuffPersistPolicy.COMBAT_TEMPORARY,
        duration: Number(definition.duration ?? 0),
        maxStacks: Math.max(1, Number(definition.maxStacks ?? 1)),
        priority: Number(definition.priority ?? 0),
        expireAfterApply: definition.expireAfterApply === true,
        tags: normalizeArray(definition.tags),
        effects: normalizeArray(definition.effects),
        hooks: definition.hooks ?? {},
    };
}

export class BuffRegistry {
    static _registry = new Map();

    static register(typeId, definition) {
        if (!typeId || !definition) return;
        BuffRegistry._registry.set(typeId, normalizeDefinition(typeId, definition));
    }

    static has(typeId) {
        return BuffRegistry._registry.has(typeId);
    }

    static get(typeId) {
        const definition = BuffRegistry._registry.get(typeId);
        if (!definition) return null;
        return {
            ...definition,
            targetTypes: [...definition.targetTypes],
            tags: [...definition.tags],
            effects: [...definition.effects],
            hooks: definition.hooks ? { ...definition.hooks } : {},
        };
    }

    static getAll() {
        return Array.from(BuffRegistry._registry.values()).map((definition) => BuffRegistry.get(definition.typeId));
    }
}

registerBuiltinBuffs(BuffRegistry);
