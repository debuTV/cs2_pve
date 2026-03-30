/**
 * @module 粒子系统/粒子管理器
 */
import { Instance } from "cs_script/point_script";
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
         * @type {Particle[]}
         */
        this.activeParticles = [];
    }

    /**
     * 按粒子 id 创建并立即在指定位置生成粒子。
     * @param {string} particleId  particleConfigs 中的 key
     * @param {{x:number, y:number, z:number}} position
     * @param {{lifetime?: number, followEntity?: import("cs_script/point_script").Entity}} [options]
     * @returns {Particle|null}
     */
    create(particleId, position, options) {
        const config = particleConfigs[particleId];
        if (!config) {
            Instance.Msg(`Particle: 未找到粒子配置 "${particleId}"\n`);
            return null;
        }

        const p = new Particle(this, config, options);
        if (!p.start(position)) return null;
        return p;
    }

    /**
     * 每帧调用，驱动所有活跃粒子的生命周期。
     * @param {number} now  当前游戏时间（Instance.GetGameTime()）
     */
    tickAll(now) {
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const particle = this.activeParticles[i];
            if (!particle) {
                this.activeParticles.splice(i, 1);
                continue;
            }
            if (!particle.isAlive()) {
                continue;
            }
            particle.tick(now);
        }
    }

    /** 停止并清理当前管理器中的全部粒子。 */
    stopAll() {
        for (let i = this.activeParticles.length - 1; i >= 0; i--) {
            const particle = this.activeParticles[i];
            if (particle) {
                particle.stop();
            }
        }
        this.activeParticles.length = 0;
    }

    /** cleanup 语义等同于 stopAll，便于和其他 manager 模块保持一致。 */
    cleanup() {
        this.stopAll();
    }

    /** @returns {number} 当前活跃粒子数量 */
    get count() {
        return this.activeParticles.length;
    }

    /** @returns {Particle[]} 当前所有活跃粒子的只读快照 */
    getAll() {
        return [...this.activeParticles];
    }

    /**
     * 注册单个粒子到活跃池。
     * @param {Particle} particle
     */
    _register(particle) {
        if (particle && !this.activeParticles.includes(particle)) {
            this.activeParticles.push(particle);
        }
    }

    /**
     * 从活跃池中注销单个粒子。
     * @param {Particle} particle
     */
    _unregister(particle) {
        const idx = this.activeParticles.indexOf(particle);
        if (idx !== -1) this.activeParticles.splice(idx, 1);
    }
}