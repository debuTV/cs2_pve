/**
 * @module HUD系统/HUD管理器
 */
import { Instance, PointTemplate } from "cs_script/point_script";
import { CHANNAL, CHANNEL_PRIORITY, HUD_ENTITY_PREFIX, HUD_FACE_ATTACH, HUD_TEMPLATE_NAME } from "./hud_const";

/**
 * @typedef {object} HudRequest
 * @property {string} text - 待显示文本
 * @property {import("cs_script/point_script").CSPlayerPawn} pawn - 关联的玩家 Pawn
 */

/**
 * @typedef {object} HudSession
 * @property {number} slot - 玩家槽位
 * @property {string} entityName - HUD 实体名
 * @property {import("cs_script/point_script").Entity | undefined} entity - HUD 实体引用
 * @property {number} activeChannel - 当前生效的渠道
 * @property {import("cs_script/point_script").CSPlayerPawn | null} pawn - 当前跟随的 Pawn
 * @property {boolean} use - 实体是否处于 Enable 状态
 * @property {string} lastText - 上次渲染的文本（用于去重）
 * @property {Map<number, HudRequest>} requests - 各渠道的显示请求
 */

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
         * @type {Map<number, HudSession>}
         */
        this._sessions = new Map();
    }

    /**
     * 提交指定 channel 的显示请求，并重新仲裁当前应显示的内容。
     *
     * @param {number} slot - 玩家槽位
     * @param {import("cs_script/point_script").CSPlayerPawn} pawn - 玩家 Pawn
     * @param {string} text - HUD 文本
     * @param {number} channel - HUD 渠道
     */
    showHud(slot, pawn, text, channel) {
        const session = this._getOrCreateSession(slot);
        session.requests.set(channel, { text, pawn });
        this._arbitrate(session);
    }

    /**
     * 撤销指定 channel 的显示请求（或全部请求），并重新仲裁。
     *
     * @param {number} slot - 玩家槽位
     * @param {number} [channel] - HUD 渠道；不传时撤销该玩家全部渠道请求
     */
    hideHud(slot, channel) {
        const session = this._sessions.get(slot);
        if (!session) return;

        if (channel === undefined) {
            session.requests.clear();
        } else {
            session.requests.delete(channel);
        }

        this._arbitrate(session);
    }

    /**
     * 每 tick 刷新全部可见 HUD 的贴脸位置。
     * @param {{ id: number; name: string; slot: number; level: number; money: number; health: number; maxHealth: number; armor: number; attack: number; critChance: number; critMultiplier: number; kills: number; score: number; exp: number; expNeeded: number; pawn: import("cs_script/point_script").CSPlayerPawn | null; }[]} [allAlivePlayersSummary=[]]
     */
    tick(allAlivePlayersSummary=[]) {
        for (const s of allAlivePlayersSummary) {
            if(!s.pawn)continue;
            const text = `Lv.${s.level} HP:${s.health}/${s.maxHealth} 护甲:${s.armor}\n$${s.money} 升级还需:${s.expNeeded - s.exp}EXP`;
            this.showHud(s.slot, s.pawn, text, CHANNAL.STATUS);
        }
        for (const [, session] of this._sessions) {
            if (!session.use) continue;
            const s=this._refreshHudPosition(session);
            if(!s)session.use=false;
        }
    }

    // ——— 内部方法 ———

    /**
     * 获取或创建指定玩家的 HUD 会话。
     * @param {number} slot
     * @returns {HudSession}
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
     * @param {HudSession} session
     */
    _arbitrate(session) {
        // 找出最高优先级的活跃请求
        let winnerChannel = CHANNAL.NONE;
        for (const ch of session.requests.keys()) {
            if ((CHANNEL_PRIORITY[ch] ?? 0) > (CHANNEL_PRIORITY[winnerChannel] ?? 0)) {
                winnerChannel = ch;
            }
        }

        // 无活跃请求 → 隐藏 HUD
        if (winnerChannel === CHANNAL.NONE) {
            if (session.use) this._hideEntity(session);
            session.activeChannel = CHANNAL.NONE;
            return;
        }

        const request = session.requests.get(winnerChannel);
        if(!request)return;
        const channelChanged = session.activeChannel !== winnerChannel;
        const textChanged = session.lastText !== request.text;
        const pawnChanged = session.pawn !== request.pawn;

        // 无变化且已显示 → 跳过
        if (!channelChanged && !textChanged && !pawnChanged && session.use) return;

        session.activeChannel = winnerChannel;
        session.pawn = request.pawn;

        this._ensureEntity(session);
        if (!session.entity) return;

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
    }

    /**
     * 确保 HUD 实体已创建。
     * @param {HudSession} session
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

        if (session.entity?.IsValid()) {
            Instance.EntFireAtTarget({target: session.entity,input: session.use?"Enable":"Disable",});
        }
    }

    /**
     * 禁用 HUD 实体。
     * @param {HudSession} session
     */
    _hideEntity(session) {
        if (!session.entity || !session.use) return;

        Instance.EntFireAtTarget({
            target: session.entity,
            input: "Disable",
        });

        session.use = false;
        session.lastText = "";
    }

    /**
     * 刷新 HUD 贴脸位置（基于当前生效 channel 的偏移配置）。
     * @param {HudSession} session
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