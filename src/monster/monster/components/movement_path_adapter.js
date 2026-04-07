/**
 * @module 怪物系统/怪物组件/移动意图适配
 */

import { MovementPriority, MovementRequestType } from "../../../util/definition";
import { MonsterState } from "../../monster_const";

/**
 * 怪物移动意图适配器（事件驱动）。
 *
 * 不再每帧推送 Move 请求，而是在状态变化点发出请求：
 * - activate()   — 进入追击态时提交 Move
 * - deactivate() — 进入技能/空闲/死亡时提交 Stop
 * - onTargetChanged()      — 追击目标更换时重新提交
 * - onOccupationChanged()  — 动画占用开始/结束时重新提交 Chase 请求，更新 usePathRefresh
 *
 * MovementManager 持有长期任务，无需每帧重复推送。
 *
 * @navigationTitle 怪物移动意图适配器
 */
export class MonsterMovementPathAdapter {
    /**
     * @param {import("../monster").Monster} monster 所属怪物实例
     */
    constructor(monster) {
        /** 所属怪物实例。 */
        this.monster = monster;
        /** 注册时的默认移动模式。由 init 保存。 */
        this._defaultMode = "walk";
        /** 当前是否有活跃的追击任务。 */
        this._active = false;
    }

    /**
     * 初始化：仅记录配置，不创建运动执行器。
     * @param {import("../../../util/definition").monsterTypes} typeConfig 怪物类型配置
     */
    init(typeConfig) {
        switch (typeConfig.movementmode) {
            case "fly":
                this._defaultMode = "fly";
                break;
            default:
                this._defaultMode = "walk";
                break;
        }
    }

    /**
     * 激活追击。进入 CHASE / ATTACK 等需要持续移动的状态时调用。
     */
    activate() {
        if (!this._getMovementEntity() || !this.monster.target) return;
        this._active = true;
        this._submitChase();
    }

    /**
     * 停止移动。进入 SKILL / IDLE / DEAD 或丢失目标时调用。
     */
    deactivate() {
        if (!this._active) return;
        const entity = this._getMovementEntity();
        this._active = false;
        if (!entity) return;
        this.monster.submitMovementEvent({
            type: MovementRequestType.Stop,
            entity,
            priority: MovementPriority.StateChange,
            clearPath: false,
        });
    }

    /**
     * 追击目标实体变化时调用。若当前活跃则重新提交 Move；
     * 若新目标为 null 则自动停止。
     */
    onTargetChanged() {
        if (!this._active) return;
        if (!this.monster.target) {
            this.deactivate();
            return;
        }
        this._submitChase();
    }

    /**
     * 动画占用状态变化时调用（开始/结束）。
     * 重新提交 Chase 请求，用 usePathRefresh 直接表达“当前是否允许刷新路径”。
     */
    onOccupationChanged() {
        if (!this._active) return;
        this._submitChase();
    }

    refreshMovement() {
        if (!this._active) return;
        if (this.monster.state === MonsterState.DEAD) {
            this.deactivate();
            return;
        }
        if (!this.monster.target) {
            this.deactivate();
            return;
        }
        this._submitChase();
    }

    /** 内部：提交一次 Chase Move 请求。 */
    _submitChase() {
        const entity = this._getMovementEntity();
        const target = this.monster.target;
        if (!entity || !target) return;

        this.monster.submitMovementEvent({
            type: MovementRequestType.Move,
            entity,
            priority: MovementPriority.Chase,
            targetEntity: target,
            usePathRefresh: !this.monster.isOccupied(),
            useNPCSeparation: true,
            maxSpeed: this.monster.speed,
            Mode: this._defaultMode,
        });
    }

    /** @returns {import("cs_script/point_script").Entity | null} */
    _getMovementEntity() {
        const entity = this.monster.model;
        if (!entity?.IsValid()) return null;
        return entity;
    }

    /** 获取注册用的默认模式。 */
    getDefaultMode() {
        return this._defaultMode;
    }
}
