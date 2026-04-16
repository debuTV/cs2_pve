/**
 * @module HUD系统/HUD管理器
 */
import { Instance, PointTemplate } from "cs_script/point_script";
import { eventBus } from "../util/event_bus";
import { event } from "../util/definition";
import { CHANNAL, CHANNEL_PRIORITY, HUD_ENTITY_PREFIX, HUD_FACE_ATTACH, HUD_TEMPLATE_NAME, HUD_ALWAYS_VISIBLE } from "./hud_const";
/**
 * HUD 管理器（单 HUD 仲裁模式）。
 *
 * 每个玩家槽位只维护一个 HUD 实体。多个 channel 可同时提交显示请求，
 * 但只有优先级最高的 channel 内容会被投影到唯一实体上。
 * 高优先级释放后自动回退到次高优先级。
 *
 * 优先级由 {@link CHANNEL_PRIORITY} 定义：SHOP > STATUS > NONE。
 *
 * 业务模块不直接 import 本模块，而是通过 main.js 注入回调使用。
 *
 * @navigationTitle HUD管理器
 */
export class HudManager {
    constructor() {
        /**
         * 玩家槽位 → HUD 会话状态。
         * @type {Map<number, import("./hud_const").HudSession>}
         */
        this._sessions = new Map();
        /** @type {Array<() => boolean>} */
        this._unsubscribers = [
            eventBus.on(event.Hud.In.ShowHudRequest, (/** @type {import("./hud_const").ShowHudRequest} */ payload) => {
                payload.result=this.showHud(payload);
            }),
            eventBus.on(event.Hud.In.HideHudRequest, (/** @type {import("./hud_const").HideHudRequest} */ payload) => {
                payload.result=this.hideHud(payload);
            })
        ];
    }

    destroy() {
        this.clearAll();
        for (const unsubscribe of this._unsubscribers) {
            unsubscribe();
        }
        this._unsubscribers.length = 0;
    }

    clearAll() {
        for (const [slot, session] of this._sessions) {
            session.requests.clear();
            this._arbitrate(session);
            if (!session.use) {
                if (session.entity?.IsValid?.()) {
                    session.entity.Remove();
                }
                this._sessions.delete(slot);
            }
        }
    }

    /**
     * 提交指定 channel 的显示请求，并重新仲裁当前应显示的内容。
     * @param {import("./hud_const").ShowHudRequest}showHudRequest
     */
    showHud(showHudRequest) {
        const session = this._getOrCreateSession(showHudRequest.slot);
        session.requests.set(showHudRequest.channel, { text: showHudRequest.text, pawn: showHudRequest.pawn, alwaysVisible: showHudRequest.alwaysVisible ?? false });
        this._arbitrate(session);
        return true;
    }

    /**
     * 撤销指定 channel 的显示请求（或全部请求），并重新仲裁。
     *
     * @param {import("./hud_const").HideHudRequest} hideHudRequest
     */
    hideHud(hideHudRequest) {
        const session = this._sessions.get(hideHudRequest.slot);
        if (!session) return false;

        if (hideHudRequest.channel === undefined) {
            session.requests.clear();
        } else {
            session.requests.delete(hideHudRequest.channel);
        }
        this._arbitrate(session);
        if (!session.use && session.requests.size === 0) {
            this._sessions.delete(hideHudRequest.slot);
        }

        return true;
    }

    /**
     * 每 tick 刷新全部可见 HUD 的贴脸位置。
     * @param {{ id: number; name: string; slot: number; level: number; money: number; health: number; maxHealth: number; armor: number; attack: number; critChance: number; critMultiplier: number; kills: number; score: number; lastMonsterDamage: number; exp: number; expNeeded: number; pawn: import("cs_script/point_script").CSPlayerPawn | null; }[]} [allAlivePlayersSummary=[]]
     * @param {{ remainingMonsters?: number; currentWave?: number; totalWaves?: number; }} [waveSummary={}]
     * @param {Map<number, { buffs?: { id: number; typeId: string; remaining: number; }[]; skill?: { id: number; typeId: string; cooldown: number; remainingCooldown: number; isReady: boolean; isConsumed: boolean; } | null; }>} [runtimeSummaryBySlot=new Map()]
     */
    tick(allAlivePlayersSummary=[], waveSummary={}, runtimeSummaryBySlot=new Map()) {
        const remainingMonsters = Math.max(0, Math.round(waveSummary.remainingMonsters ?? 0));
        const currentWave = Math.max(0, Math.round(waveSummary.currentWave ?? 0));
        const totalWaves = Math.max(0, Math.round(waveSummary.totalWaves ?? 0));
        const waveLabel = totalWaves > 0 ? `${currentWave}/${totalWaves}` : `${currentWave}`;
        
        for (const s of allAlivePlayersSummary) {
            if(!s.pawn)continue;
            const remainingExp = Math.max(0, s.expNeeded - s.exp);
            const runtimeSummary = runtimeSummaryBySlot.get(s.slot);
            const buffLabel = this._formatBuffLabel(runtimeSummary?.buffs ?? []);
            const skillLabel = this._formatSkillCooldownLabel(runtimeSummary?.skill ?? null);
            const text = `Lv.${s.level} \nHP:${s.health}/${s.maxHealth} \n护甲:${s.armor}\nMoney:$${s.money} \n升级还需:${remainingExp}EXP\n伤害:${s.lastMonsterDamage} \nBuff:${buffLabel}\n技能CD:${skillLabel}\n剩余怪物:${remainingMonsters} \n波次:${waveLabel}`;
            this.showHud({ slot: s.slot, pawn: s.pawn, text, channel: CHANNAL.STATUS, alwaysVisible: HUD_ALWAYS_VISIBLE, result: true });
        }
        for (const [, session] of this._sessions) {
            if (!session.use) continue;
            const refreshed = this._refreshHudPosition(session);
            if (!refreshed) {
                this._hideEntity(session);
            }
        }
    }

    // ——— 内部方法 ———

    /**
     * 获取或创建指定玩家的 HUD 会话。
     * @param {number} slot
     * @returns {import("./hud_const").HudSession}
     */
    _getOrCreateSession(slot) {
        let session = this._sessions.get(slot);
        if (!session) {
            session = {
                slot,
                entityName: `${HUD_ENTITY_PREFIX}_${slot}`,
                entity: undefined,
                activeChannel: CHANNAL.NONE,
                pawn: null,
                use: false,
                lastText: "",
                requests: new Map(),
            };
            this._sessions.set(slot, session);
        }
        return session;
    }

    /**
     * 根据优先级重新决定当前应显示的 channel 内容。
     * @param {import("./hud_const").HudSession} session
     */
    _arbitrate(session) {
        // 找出最高优先级的活跃请求
        let winnerChannel = CHANNAL.NONE;
        for (const ch of session.requests.keys()) {
            if ((CHANNEL_PRIORITY[ch] ?? 0) > (CHANNEL_PRIORITY[winnerChannel] ?? 0)) {
                winnerChannel = ch;
            }
        }

        // 如果无活跃请求，检查是否有 alwaysVisible 请求
        if (winnerChannel === CHANNAL.NONE) {
            for (const [ch, request] of session.requests) {
                if (request.alwaysVisible && (CHANNEL_PRIORITY[ch] ?? 0) > (CHANNEL_PRIORITY[winnerChannel] ?? 0)) {
                    winnerChannel = ch;
                }
            }
        }

        const previousChannel = session.activeChannel;
        const wasVisible = session.use;

        // 无活跃请求且无 alwaysVisible → 隐藏 HUD
        if (winnerChannel === CHANNAL.NONE) {
            if (session.use) {
                this._hideEntity(session);
                /** @type {import("./hud_const").OnHudHidden} */
                const payload = {
                    slot: session.slot,
                    channel: previousChannel,
                };
                eventBus.emit(event.Hud.Out.OnHudHidden, payload);
            }
            session.activeChannel = CHANNAL.NONE;
            session.pawn = null;
            return;
        }

        const request = session.requests.get(winnerChannel);
        if (!request) {
            session.requests.delete(winnerChannel);
            this._arbitrate(session);
            return;
        }
        const channelChanged = previousChannel !== winnerChannel;
        const textChanged = session.lastText !== request.text;
        const pawnChanged = session.pawn !== request.pawn;

        // 无变化且已显示 → 跳过
        if (!channelChanged && !textChanged && !pawnChanged && session.use) return;

        session.activeChannel = winnerChannel;
        session.pawn = request.pawn;

        this._ensureEntity(session);
        if (!session.entity||!session.entity.IsValid()) return;

        // 文本更新
        if (textChanged || channelChanged) {
            session.lastText = request.text;
            Instance.EntFireAtTarget({
                target: session.entity,
                input: "SetMessage",
                value: request.text,
            });
        }

        // 首次启用或 Pawn 变更 → 重新绑定
        if (!session.use) {
            Instance.EntFireAtTarget({ target: session.entity, input: "Enable" });
            Instance.EntFireAtTarget({
                target: session.entity,
                input: "Followentity",
                value: "!activator",
                activator: request.pawn,
            });
            session.use = true;
        } else if (pawnChanged) {
            Instance.EntFireAtTarget({
                target: session.entity,
                input: "Followentity",
                value: "!activator",
                activator: request.pawn,
            });
        }

        this._refreshHudPosition(session);

        if (!wasVisible && session.use) {
            /** @type {import("./hud_const").OnHudShown} */
            const payload = {
                slot: session.slot,
                channel: winnerChannel,
                text: request.text,
            };
            eventBus.emit(event.Hud.Out.OnHudShown, payload);
        } else if ((channelChanged || textChanged || pawnChanged) && session.use) {
            /** @type {import("./hud_const").OnHudUpdated} */
            const payload = {
                slot: session.slot,
                channel: winnerChannel,
                text: request.text,
                previousChannel,
            };
            eventBus.emit(event.Hud.Out.OnHudUpdated, payload);
        }
    }

    /**
     * 确保 HUD 实体已创建。
     * @param {import("./hud_const").HudSession} session
     */
    _ensureEntity(session) {
        if (session.entity?.IsValid()) return;

        session.entity = Instance.FindEntityByName(session.entityName);
        if (session.entity?.IsValid()) return;

        const template = Instance.FindEntityByName(HUD_TEMPLATE_NAME);
        if (template && template instanceof PointTemplate) {
            const spawned = template.ForceSpawn();
            if (spawned && spawned.length > 0) {
                spawned[0].SetEntityName(session.entityName);
                session.entity = spawned[0];
            }
        }

        const entity = session.entity;
        if (entity?.IsValid()) {
            Instance.EntFireAtTarget({ target: entity, input: session.use ? "Enable" : "Disable" });
        }
    }


    /**
     * @param {{ id: number; typeId: string; remaining: number; }[]} buffSummaries
     * @returns {string}
     */
    _formatBuffLabel(buffSummaries) {
        if (buffSummaries.length === 0) return "无";

        const labels = buffSummaries.slice(0, 2).map((buffSummary) => this._formatSingleBuffLabel(buffSummary));
        if (buffSummaries.length > 2) {
            labels.push(`+${buffSummaries.length - 2}`);
        }
        return labels.join(", ");
    }

    /**
     * @param {{ id: number; typeId: string; remaining: number; }} buffSummary
     * @returns {string}
     */
    _formatSingleBuffLabel(buffSummary) {
        const displayName = this._getEffectDisplayName(buffSummary.typeId);
        if (buffSummary.remaining >= 0) {
            return `${displayName}(${buffSummary.remaining.toFixed(1)}s)`;
        }
        return `${displayName}`;
    }

    /**
     * @param {{ id: number; typeId: string; cooldown: number; remainingCooldown: number; isReady: boolean; isConsumed: boolean; } | null} skillSummary
     * @returns {string}
     */
    _formatSkillCooldownLabel(skillSummary) {
        if (!skillSummary) return "无";
        const displayName = this._getEffectDisplayName(skillSummary.typeId);
        if (skillSummary.isConsumed) return `${displayName}(已使用)`;
        if (!skillSummary.isReady) return `${displayName}(${skillSummary.remainingCooldown.toFixed(1)}s)`;
        return `${displayName}(就绪)`;
    }

    /**
     * @param {string | null | undefined} typeId
     * @returns {string}
     */
    _getEffectDisplayName(typeId) {
        switch (typeId) {
            case "fire":
            case "burn":
                return "燃烧";
            default:
                return typeId ?? "未知";
        }
    }

    /**
     * 禁用 HUD 实体。
     * @param {import("./hud_const").HudSession} session
     */
    _hideEntity(session) {
        if (!session.entity?.IsValid?.() || !session.use) return;

        Instance.EntFireAtTarget({
            target: session.entity,
            input: "Disable",
        });

        session.use = false;
        session.lastText = "";
    }

    /**
     * 刷新 HUD 贴脸位置（基于当前生效 channel 的偏移配置）。
     * @param {import("./hud_const").HudSession} session
     * @returns {boolean}
     */
    _refreshHudPosition(session) {
        if (!session.entity?.IsValid() || !session.pawn) return false;

        const ps = session.pawn.GetEyePosition();
        const ag = session.pawn.GetEyeAngles();
        if (!ps || !ag) return false;

        const radius = HUD_FACE_ATTACH.radius;
        const lateralOffset = HUD_FACE_ATTACH.lateralOffset;

        const pitchRad = ag.pitch * Math.PI / 180;
        const yawRad = ag.yaw * Math.PI / 180;
        const x = ps.x + radius * Math.cos(pitchRad) * Math.cos(yawRad);
        const y = ps.y + radius * Math.cos(pitchRad) * Math.sin(yawRad);
        const ox = ps.x + radius * Math.cos(0) * Math.cos(yawRad);
        const oy = ps.y + radius * Math.cos(0) * Math.sin(yawRad);

        session.entity.Teleport({
            position: {
                x: x - lateralOffset * (oy - ps.y) / radius,
                y: y + lateralOffset * (ox - ps.x) / radius,
                z: ps.z - radius * Math.sin(pitchRad),
            },
            angles: {
                pitch: 0,
                yaw: 270 + ag.yaw,
                roll: 90 - ag.pitch,
            },
        });

        return true;
    }
}