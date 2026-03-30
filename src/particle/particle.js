/**
 * @module 粒子系统/单个粒子
 */
import { Instance, PointTemplate } from "cs_script/point_script";

export class Particle {
    /**
     * 创建单个粒子实例。
     * @param {import("./particle_manager").ParticleManager|null} manager
     * @param {import("../util/definition").particleConfig} config
     * @param {{lifetime?: number, followEntity?: import("cs_script/point_script").Entity}} [options]
     */
    constructor(manager, config, options) {
        /** @type {import("./particle_manager").ParticleManager|null} */
        this._manager = manager;
        /** @type {import("../util/definition").particleConfig} */
        this.config = config;
        /** @type {import("cs_script/point_script").Entity[]} 本次 spawn 产生的全部实体 */
        this._spawnedEntities = [];
        /** @type {import("cs_script/point_script").Entity|null} 目标 info_particle_system */
        this._particleEntity = null;
        /** @type {boolean} 粒子当前是否处于存活状态 */
        this._alive = false;

        /** 活动时间（秒），null/undefined = 无限期，仅外部 stop */
        this.lifetime = options?.lifetime ?? config.lifetime ?? null;
        /** 跟随实体，创建后对粒子实体 SetParent */
        this.followEntity = options?.followEntity ?? null;
        /** 创建时的游戏时间戳 */
        this._startTime = 0;
    }

    /**
     * 在指定位置生成粒子实体。
     * 若已生成过，会先 stop 再重建。
     * @param {{x:number, y:number, z:number}} position
     * @returns {boolean}
     */
    start(position) {
        if (this._alive) this.stop();

        const template = Instance.FindEntityByName(this.config.spawnTemplateName);
        if (!template || !(template instanceof PointTemplate)) {
            Instance.Msg(`Particle: 找不到 PointTemplate "${this.config.spawnTemplateName}"\n`);
            return false;
        }

        const spawned = template.ForceSpawn(position);
        if (!spawned || spawned.length === 0) {
            Instance.Msg(`Particle: ForceSpawn 未返回实体 (template="${this.config.spawnTemplateName}")\n`);
            return false;
        }

        this._spawnedEntities = spawned;
        this._particleEntity = this._findParticleEntity(spawned);

        if (!this._particleEntity) {
            Instance.Msg(`Particle: 生成实体中未找到 info_particle_system (template="${this.config.spawnTemplateName}")\n`);
            this._cleanup();
            return false;
        }

        if (this.followEntity && this.followEntity.IsValid()) {
            this._particleEntity.SetParent(this.followEntity);
        }

        this._startTime = Instance.GetGameTime();
        this._alive = true;
        this._register();
        return true;
    }

    /**
     * 每帧由 ParticleManager 调用。检查有效性与超时。
     * @param {number} now
     */
    tick(now) {
        if (!this._alive) return;

        if (!this._particleEntity || !this._particleEntity.IsValid()) {
            this.stop();
            return;
        }

        if (this.lifetime != null && now - this._startTime >= this.lifetime) {
            this.stop();
        }
    }

    /**
     * 停止粒子并删除本次 spawn 产生的全部实体。
     * @returns {boolean} 是否成功移除（已停止/不存在返回 false）
     */
    stop() {
        if (!this._alive) return false;
        this._unregister();
        this._cleanup();
        return true;
    }

    /** @returns {boolean} 粒子是否存活 */
    isAlive() {
        if (!this._alive) {
            this._unregister();
            return false;
        }
        if (!this._particleEntity || !this._particleEntity.IsValid()) {
            this._unregister();
            this._cleanup();
            return false;
        }
        return true;
    }

    /** @returns {import("cs_script/point_script").Entity|null} */
    getEntity() {
        return this._particleEntity;
    }

    /** 注册到所属的 ParticleManager */
    _register() {
        if (this._manager) {
            this._manager._register(this);
        }
    }

    /** 从所属的 ParticleManager 中移除 */
    _unregister() {
        if (this._manager) {
            this._manager._unregister(this);
        }
    }

    /**
     * 从生成实体列表中识别目标 info_particle_system。
     * @param {import("cs_script/point_script").Entity[]} entities
     * @returns {import("cs_script/point_script").Entity|null}
     */
    _findParticleEntity(entities) {
        const targetName = this.config.middleEntityName;
        let fallback = null;

        for (const ent of entities) {
            if (ent.GetClassName() !== "info_particle_system") continue;
            if (targetName && ent.GetEntityName() === targetName) return ent;
            if (!fallback) fallback = ent;
        }

        if (fallback && targetName) {
            Instance.Msg(`Particle: 未精确匹配 middleEntityName "${targetName}"，使用第一个 info_particle_system\n`);
        }
        return fallback;
    }

    /** 删除本次 spawn 产生的全部实体并重置状态 */
    _cleanup() {
        for (const ent of this._spawnedEntities) {
            if (ent && ent.IsValid()) ent.Remove();
        }
        this._spawnedEntities = [];
        this._particleEntity = null;
        this._startTime = 0;
        this._alive = false;
    }
}
