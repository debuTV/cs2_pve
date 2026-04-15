/**
 * @module 技能系统/哨戒炮台/玩家技能
 *
 * 玩家技能：`player_turret`。
 * 玩家使用技能触发时，在当前位置生成一台哨戒炮台实例并注册到全局 sentryManager。
 *
 * typeId: "player_turret"
 */
import { Instance, PointTemplate } from "cs_script/point_script";
import { SkillTemplate } from "../../skill_template";
import { PlayerRuntimeEvents } from "../../../util/runtime_events";
import { SentryTurret } from "./sentry_turret";
import { sentryManager } from "./sentry_manager";
import {
    SENTRY_DEFAULT_PLACEMENT_DISTANCE,
    SENTRY_DEFAULT_TEMPLATE_NAME,
    SENTRY_DEFAULTS,
    SENTRY_PLACEMENT_BOUNDS,
} from "./sentry_const";
import { vec } from "../../../util/vector";

export class SentrySkill extends SkillTemplate {
    /**
    * @param {import("../../../player/player/player").Player | null} player
    * @param {import("../../../monster/monster/monster").Monster | null} monster
     * @param {number} id
     * @param {{
     *   cooldown?:         number;
     *   searchRadius?:     number;
     *   targetLostRange?:  number;
     *   damage?:           number;
     *   lifetime?:         number;
    *   attackInterval?:   number;
    *   turnSpeed?:        number;
    *   templateName?:     string;
    *   placementDistance?:number;
     *   maxPerPlayer?:     number;
     * }} params
     */
    constructor(player, monster, id, params = {}) {
        super(player, monster, "player_turret", id, {
            cooldown: params.cooldown ?? 0,
            ...params,
        });
        this.animation  = null;
        this.events     = [PlayerRuntimeEvents.Input];
        this.inputKey   = "InspectWeapon";

        const rawPlacementDistance = params.placementDistance;
        const rawMaxPerPlayer = params.maxPerPlayer;
        const rawTurnSpeed = params.turnSpeed;
        this._templateName = typeof params.templateName === "string" && params.templateName.trim()
            ? params.templateName.trim()
            : SENTRY_DEFAULT_TEMPLATE_NAME;
        this._placementDistance = typeof rawPlacementDistance === "number" && Number.isFinite(rawPlacementDistance)
            ? Math.max(0, rawPlacementDistance)
            : SENTRY_DEFAULT_PLACEMENT_DISTANCE;
        this._maxPerPlayer = typeof rawMaxPerPlayer === "number" && Number.isFinite(rawMaxPerPlayer)
            ? Math.max(1, Math.floor(rawMaxPerPlayer))
            : 1;
        this._turnSpeed = typeof rawTurnSpeed === "number" && Number.isFinite(rawTurnSpeed)
            ? Math.max(0, rawTurnSpeed)
            : SENTRY_DEFAULTS.turnSpeed;
    }

    /**
     * @param {import("../../../util/runtime_events.js").RuntimeEvent} event
     */
    canTrigger(event) {
        if (!this.player || this.monster) return false;
        if (!this.events.includes(event.type)) return false;
        const key = "key" in event ? event.key : undefined;
        if (event.type === PlayerRuntimeEvents.Input && key !== this.inputKey) return false;
        if (!this._cooldownReady()) return false;

        this.trigger();
        return false;
    }

    trigger() {
        const player = this.player;
        if (!player || this.monster) return false;

        const pawn = player.entityBridge?.pawn;
        if (!pawn?.IsValid?.()) return false;

        const ownerKey = player.slot;
        if (sentryManager.countByOwner(ownerKey) >= this._maxPerPlayer) return false;

        const placement = pawn.GetAbsOrigin?.();
        if (!placement) return false;
        if (!this._canPlaceAt(placement)) return false;

        const ok = this._spawnTurret(vec.Zfly(placement,15), ownerKey);
        if (ok) {
            this._markTriggered();
            return true;
        }
        return false;
    }

    /**
     * 技能移除时同步销毁该玩家的现存炮台。
     */
    onSkillDelete() {
        super.onSkillDelete();
        const ownerKey = this.player?.slot;
        if (typeof ownerKey === "number") {
            sentryManager.destroyByOwner(ownerKey);
        }
    }

    /**
     * @param {import("cs_script/point_script").CSPlayerPawn} pawn
     * @returns {{ position: import("cs_script/point_script").Vector, angles: import("cs_script/point_script").QAngle } | null}
     */
    _getPlacement(pawn) {
        const origin = pawn.GetAbsOrigin?.();
        const angles = pawn.GetAbsAngles?.();
        if (!origin || !angles) return null;

        const yawRad = (angles.yaw ?? 0) * (Math.PI / 180);
        return {
            position: {
                x: origin.x + Math.cos(yawRad) * this._placementDistance,
                y: origin.y + Math.sin(yawRad) * this._placementDistance,
                z: origin.z,
            },
            angles,
        };
    }

    /**
     * @param {import("cs_script/point_script").Vector} position
     * @returns {boolean}
     */
    _canPlaceAt(position) {
        const trace = Instance.TraceBox({
            mins: SENTRY_PLACEMENT_BOUNDS.mins,
            maxs: SENTRY_PLACEMENT_BOUNDS.maxs,
            start: {
                x: position.x,
                y: position.y,
                z: position.z + 4,
            },
            end: {
                x: position.x,
                y: position.y,
                z: position.z + 4,
            },
            ignorePlayers: true,
        });
        return !trace.didHit;
    }

    /**
     * @param {import("cs_script/point_script").Vector} position
      * @param {number} ownerKey
     * @returns {boolean}
     */
    _spawnTurret(position, ownerKey) {
        const template = Instance.FindEntityByName(this._templateName);
        if (!template || !(template instanceof PointTemplate)) {
            Instance.Msg(`Sentry: 找不到 PointTemplate "${this._templateName}"\n`);
            return false;
        }

        const spawned = template.ForceSpawn(position);
        if (!spawned || spawned.length < 2) {
            Instance.Msg(`Sentry: PointTemplate "${this._templateName}" 至少需要生成 2 个实体\n`);
            this._cleanupSpawnedEntities(spawned ?? []);
            return false;
        }

        const [turretBase, turretYaw] = spawned;
        if (!turretBase?.IsValid?.() || !turretYaw?.IsValid?.()) {
            Instance.Msg(`Sentry: PointTemplate "${this._templateName}" 缺少底座或旋转实体\n`);
            this._cleanupSpawnedEntities(spawned);
            return false;
        }

        const turret = new SentryTurret({
            turretBase,
            turretYaw,
            ownerKey,
            turnSpeed: this._turnSpeed,
            spawnedEntities: spawned,
        });
        sentryManager.register(turret);
        return true;
    }

    /**
     * @param {import("cs_script/point_script").Entity[]} entities
     */
    _cleanupSpawnedEntities(entities) {
        for (const entity of entities) {
            if (entity?.IsValid?.()) {
                entity.Remove();
            }
        }
    }
}
