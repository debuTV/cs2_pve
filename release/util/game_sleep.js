/**
 * @module 工具/定时器
 */
import {Instance} from "cs_script/point_script";
/**
 * 基于游戏时间的单次定时器。到达 `runtime` 后触发回调并标记为已使用。
 * @navigationTitle 定时器
 */
export class sleep
{
    /**
     * 创建一个在指定秒数后触发的单次定时器。
     * @param {number} runtime
     */
    constructor(runtime)
    {
        /** @type {(() => void) | null} 超时时触发的回调函数 */
        this.onTime=null;
        /**@type {number} */
        this.runtime=runtime+Instance.GetGameTime();
        /**@type {boolean} */
        this.use=false;
    }
    /**
     * 检查当前时间是否已到达触发时间，到达则执行回调并标记为已使用。
     * @param {number} nowtime
     */
    tick(nowtime)
    {
        if(nowtime>=this.runtime&&this.onTime)
        {
            this.use=true;
            this.onTime();
        }
    }
    /**
     * 设置定时器到期时的回调函数。
     * @param {any} callback
     */
    setonTime(callback)
    {
        this.onTime=callback;
    }
}
/**
 * 定时器列表，内部管理多个 {@link sleep} 实例的批量 tick 与自动清理。
 */
class sleepList
{
    constructor()
    {
        /**@type {Map<number,sleep>} */
        this.list = new Map();
        /**@type {number} */
        this.totalwork=0;
    }
    /**
     * 遍历所有定时器执行 tick，并清理已使用的定时器。
     * @param {number} nowtime
     */
    tick(nowtime)
    {
        for (const [id, work] of this.list) {
            if (work.use) this.list.delete(id);
            work.tick(nowtime);
        }
    }
    /**
     * 将一个定时器实例注册到列表中统一管理。
     * @param {sleep} work
     */
    add(work)
    {
        this.list.set(this.totalwork++,work);
    }
}
/** 全局定时器列表实例，管理所有 {@link sleep} 定时器的注册与 tick。 */
export let m_sleepList=new sleepList();

/**
 * @type {any[]}
 */
const onTicks = [];
/**
 * @type {any[]}
 */
let delayActions = [];

/** 每帧调用——依次执行注册的 tick 回调，并检查延迟动作是否到期。 */
export function tickCallback() {
    for (const cb of onTicks) {
        cb();
    }

    delayActions = delayActions.filter(act => {
        if (act.targetTime > Instance.GetGameTime())
            return true;

        act.resolve();
        return false;
    });
}

/**
 * 注册一个每帧执行的 tick 回调函数。
 * @param {any} callback
 */
export function scheduleTick(callback) {
    onTicks.push(callback);
}

/**
 * 返回一个在指定秒数后 resolve 的 Promise。
 * @param {number} sec
 */
export function delaySec(sec) {
    const targetTime = Instance.GetGameTime() + sec;
    return new Promise((resolve) => {
        delayActions.push({ targetTime, resolve });
    });
}

/**
 * 返回一个在指定毫秒数后 resolve 的 Promise。
 * @param {number} msec
 */
export function delay(msec) {
    return delaySec(msec / 1000);
}

/** 返回一个在下一帧 resolve 的 Promise。 */
export function nextTick() {
    return new Promise((resolve) => {
        delayActions.push({ targetTime: 0, resolve });
    });
}