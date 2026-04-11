/**
 * @module 粒子系统/粒子管理器
 */
import { Instance } from "cs_script/point_script";
import { eventBus } from "../util/event_bus";
import { event } from "../util/definition";
import { particleConfigs } from "./particle_const";
import { Particle } from "./particle";
/**
 * 粒子管理器。
 *
 * 只负责管理当前所有活跃的单粒子系统实例：
 * - create: 按粒子配置创建并启动单个 Particle
 * - tickAll: 每帧统一驱动粒子生命周期
 * - stopAll / cleanup: 统一销毁所有活跃粒子
 *
 * 单个粒子的具体逻辑在 `particle.js` 中实现。
 */
export class ParticleManager {
    constructor() {
        /**
         * 当前管理器持有的活跃粒子池。
         * @type {Map<number, Particle>}
         */
        this.activeParticles = new Map();
        this._nextParticleId = 1;
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Particle.In.CreateRequest, (/**@type {import("../particle/particle_const").ParticleCreateRequest}*/ payload) => {
                payload.result = this.create(payload);
            }),
            eventBus.on(event.Particle.In.StopRequest, (/**@type {import("../particle/particle_const").ParticleStopRequest}*/ payload) => {
                const particle=this.activeParticles.get(payload.particleId);
                payload.result=particle?.stop()??false;
                this.activeParticles.delete(payload.particleId);
            })
        ];
    }

    /**
     * 按粒子 id 创建并立即在指定位置生成粒子。
     * @param {import("../particle/particle_const").ParticleCreateRequest} particleCreateRequest
     * @returns {number} 成功时返回粒子 id，失败返回 -1
     */
    create(particleCreateRequest) {
        const config = particleConfigs[particleCreateRequest.particleName];
        if (!config) {
            Instance.Msg(`Particle: 未找到粒子配置 "${particleCreateRequest.particleName}"\n`);
            return -1;
        }

        const p = new Particle(this._nextParticleId++,config, particleCreateRequest);
        if (!p.start(particleCreateRequest.position)) return -1;
        this.activeParticles.set(p.id, p);
        return p.id;
    }

    /**
     * 每帧调用，驱动所有活跃粒子的生命周期。
     * @param {number} now  当前游戏时间（Instance.GetGameTime()）
     */
    tick(now) {
        for (const particle of this.activeParticles.values()) {
            if (particle) {
                particle.tick(now);
            }
        }
    }

    /** 停止并清理当前管理器中的全部粒子。 */
    cleanup() {
        for (const particle of this.activeParticles.values()) {
            if (particle) {
                particle.stop();
            }
        }
        this.activeParticles.clear();
    }

    /** 销毁服务并注销事件监听。 */
    destroy() {
        this.cleanup();
        for (const unsubscribe of this._unsubscribers) {
            unsubscribe();
        }
        this._unsubscribers.length = 0;
    }
}