export class BuffHostAdapter {
    constructor() {
        this.hostType = "unknown";
        this.hostId = -1;
    }

    getNow() {
        return 0;
    }

    isAlive() {
        return true;
    }

    getState() {
        return null;
    }

    getResource(key) {
        void key;
        return 0;
    }

    setResource(key, value) {
        void key;
        void value;
    }

    addResource(key, delta, meta) {
        void key;
        void delta;
        void meta;
        return 0;
    }

    clampResource(key, value) {
        void key;
        return value;
    }

    getBaseStat(key) {
        void key;
        return 0;
    }

    setDerivedStat(key, value) {
        void key;
        void value;
    }

    recomputeDerivedStats() {}

    getGainModifier(key) {
        void key;
        return 1;
    }

    getBaseGainModifier(key) {
        return this.getGainModifier(key);
    }

    setGainModifier(key, value) {
        void key;
        void value;
    }

    recomputeGainModifiers() {}

    emitBuffEvent(eventType, payload) {
        void eventType;
        void payload;
    }

    supportsEffect(effect) {
        void effect;
        return false;
    }
}
