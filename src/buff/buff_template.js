import { applyInstantEffects, tickPeriodicEffects } from "./builtin_effects";

export class BuffTemplate {
    constructor(manager, definition, params = {}, source = null) {
        this.manager = manager;
        this.adapter = manager.adapter;
        this.definition = definition;
        this.params = { ...params };

        this.id = -1;
        this.typeId = definition.typeId;
        this.groupKey = params.groupKey ?? definition.groupKey ?? definition.typeId;
        this.duration = Number(params.duration ?? definition.duration ?? 0);
        this.remainingTime = this.duration;
        this.maxStacks = Math.max(1, Number(params.maxStacks ?? definition.maxStacks ?? 1));
        this.stacks = 1;
        this.stackMode = params.stackMode ?? definition.stackMode;
        this.persistPolicy = params.persistPolicy ?? definition.persistPolicy;
        this.polarity = params.polarity ?? definition.polarity;
        this.priority = Number(params.priority ?? definition.priority ?? 0);
        this.tags = Array.isArray(params.tags) ? [...params.tags] : [...(definition.tags ?? [])];
        this.effects = Array.isArray(params.effects) ? [...params.effects] : [...(definition.effects ?? [])];
        this.hooks = definition.hooks ?? {};
        this.source = source ?? params.source ?? null;
        this.expireAfterApply = params.expireAfterApply === true || definition.expireAfterApply === true;

        this.expired = false;
        this._periodicAccums = new Map();
    }

    onAdd() {
        applyInstantEffects(this, "add");
        this.hooks.onAdd?.(this);
        if (this.expireAfterApply) {
            this.expired = true;
        }
    }

    onRefresh(newBuff) {
        this.remainingTime = newBuff.duration;
        this.priority = Math.max(this.priority, newBuff.priority);
        this.params = { ...this.params, ...newBuff.params };
        this.source = newBuff.source ?? this.source;
        this.hooks.onRefresh?.(this, newBuff);
    }

    onStack(newBuff) {
        this.stacks = Math.min(this.stacks + 1, this.maxStacks);
        this.remainingTime = newBuff.duration;
        this.params = { ...this.params, ...newBuff.params };
        this.priority = Math.max(this.priority, newBuff.priority);
        this.source = newBuff.source ?? this.source;
        this.hooks.onStack?.(this, newBuff);
    }

    onTick(dt) {
        if (this.duration > 0) {
            this.remainingTime -= dt;
            if (this.remainingTime <= 0) {
                this.expired = true;
            }
        }
        tickPeriodicEffects(this, dt);
        this.hooks.onTick?.(this, dt);
    }

    onIntervalTick(dt) {
        this.hooks.onIntervalTick?.(this, dt);
    }

    onBeforeDamageTaken(ctx) {
        this.hooks.onBeforeDamageTaken?.(this, ctx);
    }

    onAfterDamageTaken(ctx) {
        this.hooks.onAfterDamageTaken?.(this, ctx);
    }

    onStateChange(oldState, newState) {
        this.hooks.onStateChange?.(this, oldState, newState);
    }

    onRespawn() {
        this.hooks.onRespawn?.(this);
    }

    onRemove() {
        applyInstantEffects(this, "remove");
        this.hooks.onRemove?.(this);
    }

    hasTag(tag) {
        return this.tags.includes(tag);
    }

    getRemainingTime() {
        return this.duration <= 0 ? Infinity : Math.max(0, this.remainingTime);
    }
}
