/**
 * @module EventBus/EventBus
 */

/**
 * @typedef {(...args: any[]) => void} EventListener
 */

/**
 * 断言事件名称是否合法。
 * 如果 eventName 不是字符串或为空字符串，则抛出 TypeError。
 * @param {string} eventName
 */
function assertEventName(eventName) {
    if (typeof eventName !== "string" || eventName.length === 0) {
        throw new TypeError("Event name must be a non-empty string.");
    }
}

/**
 * 断言监听器是否合法。
 * 如果 listener 不是函数类型，则抛出 TypeError。
 * @param {EventListener} listener
 */
function assertListener(listener) {
    if (typeof listener !== "function") {
        throw new TypeError("Listener must be a function.");
    }
}

/**
 * 同步事件总线类。
 * 使用 Set 进行监听器管理，遍历时采用实时迭代语义
 * （即在 emit 过程中对监听器的增删会影响当前遍历周期）。
 *
 * @navigationTitle EventBus
 */
export class EventBus {
    /** 构造函数，初始化内部的监听器映射表。 */
    constructor() {
        /** @type {Map<string, Set<EventListener>>} */
        this._listeners = new Map();
    }

    /**
     * 注册事件监听器。
     * 为指定事件名称添加一个监听回调，如果该事件尚无监听器集合则自动创建。
     * @param {string} eventName
     * @param {EventListener} listener
     * @returns {() => boolean} 返回一个取消订阅的函数，调用后可移除该监听器。
     */
    on(eventName, listener) {
        assertEventName(eventName);
        assertListener(listener);

        let listeners = this._listeners.get(eventName);
        if (!listeners) {
            listeners = new Set();
            this._listeners.set(eventName, listeners);
        }

        listeners.add(listener);
        return () => this.off(eventName, listener);
    }

    /**
     * 注册一次性事件监听器。
     * 该监听器最多只会被触发一次，触发后自动移除。
     * 如果需要在首次触发前取消，可保留并调用返回的取消订阅函数。
     * @param {string} eventName
     * @param {EventListener} listener
     * @returns {() => boolean} 返回一个取消订阅的函数。
     */
    once(eventName, listener) {
        assertEventName(eventName);
        assertListener(listener);

        const wrappedListener = (/** @type {any[]} */ ...args) => {
            this.off(eventName, wrappedListener);
            listener(...args);
        };

        return this.on(eventName, wrappedListener);
    }

    /**
     * 移除事件监听器。
     * 从指定事件中移除一个监听回调，仅支持精确的函数引用匹配。
     * 当某事件的监听器集合清空时，会自动清理该事件的条目。
     * @param {string} eventName
     * @param {EventListener} listener
     * @returns {boolean} 如果监听器存在并被成功移除则返回 true，否则返回 false。
     */
    off(eventName, listener) {
        assertEventName(eventName);
        assertListener(listener);

        const listeners = this._listeners.get(eventName);
        if (!listeners) {
            return false;
        }

        const removed = listeners.delete(listener);

        if (listeners.size === 0) {
            this._listeners.delete(eventName);
        }

        return removed;
    }

    /**
     * 同步触发（发射）事件。
     * 依次调用该事件下所有已注册的监听器，并传入参数。
     * 遍历是实时的，因此在触发过程中对监听器的增删会影响当前遍历周期。
     * @param {string} eventName
     * @param {...any} args
     * @returns {boolean} 如果至少有一个监听器被调用则返回 true，否则返回 false。
     */
    emit(eventName, ...args) {
        assertEventName(eventName);

        const listeners = this._listeners.get(eventName);
        if (!listeners || listeners.size === 0) {
            return false;
        }

        for (const listener of listeners) {
            listener(...args);
        }

        return true;
    }

    /**
     * 清除监听器。
     * 如果传入事件名称，则清除该事件下的所有监听器；
     * 如果不传参数，则清除所有事件的全部监听器。
     * @param {string} [eventName]
     * @returns {number} 返回被移除的监听器数量。
     */
    clear(eventName) {
        if (typeof eventName === "undefined") {
            const total = this.listenerCount();
            this._listeners.clear();
            return total;
        }

        assertEventName(eventName);

        const listeners = this._listeners.get(eventName);
        if (!listeners) {
            return 0;
        }

        const count = listeners.size;
        this._listeners.delete(eventName);
        return count;
    }

    /**
     * 检查指定事件当前是否存在监听器。
     * @param {string} eventName
     * @returns {boolean} 如果存在至少一个监听器则返回 true，否则返回 false。
     */
    hasListeners(eventName) {
        assertEventName(eventName);
        return (this._listeners.get(eventName)?.size ?? 0) > 0;
    }

    /**
     * 统计监听器数量。
     * 如果传入事件名称，返回该事件的监听器数量；
     * 如果不传参数，返回所有事件的监听器总数。
     * @param {string} [eventName]
     * @returns {number} 监听器数量。
     */
    listenerCount(eventName) {
        if (typeof eventName === "undefined") {
            let total = 0;
            for (const listeners of this._listeners.values()) {
                total += listeners.size;
            }
            return total;
        }

        assertEventName(eventName);
        return this._listeners.get(eventName)?.size ?? 0;
    }
}
export const eventBus=new EventBus();