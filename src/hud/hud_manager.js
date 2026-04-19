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
            ,
            eventBus.on(event.Hud.In.StatusUpdateRequest, (/** @type {{slot:number} & import("./hud_const").HudPlayerSummary} */ payload) => {
                this.handlePlayerStatusUpdateRequest(payload);
            })
        ];
        /** 全局波次摘要，供文本合并显示 */
        /**@type {import("./hud_const").HudWaveSummary} */
        this._waveSummary={
            currentWave: 0,
            totalWaves: 0,
            monstersRemaining: 0,
            prepareTime:0
        };
        this._wavetime=0;
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
     * @param {import("./hud_const").HudWaveSummary} waveSummary
     */
    setwaveSummary(waveSummary){
        if (waveSummary.currentWave !== undefined) this._waveSummary.currentWave = waveSummary.currentWave;
        if (waveSummary.totalWaves !== undefined) this._waveSummary.totalWaves = waveSummary.totalWaves;
        if (waveSummary.monstersRemaining !== undefined) this._waveSummary.monstersRemaining = waveSummary.monstersRemaining;
        if (waveSummary.prepareTime !== undefined)
        {
            this._waveSummary.prepareTime=waveSummary.prepareTime;
            this._wavetime=0;
        }
        for (const [, session] of this._sessions) {
            // 只要会话中有 playerInfo（或此前缓存过 pendingText），都要尝试刷新文本
            if (!session.playerInfo) continue;
            this._refreshSessionText(session);
        }
    }
    /**
     * 处理结构化的 HUD 状态更新请求（可合并）。
     * payload 示例： { updates: [{ slot, pawn, health, maxHealth, money, lastDamage, level, exp, expNeeded }], waveSummary: { remainingMonsters, currentWave, totalWaves }, flags: { shouldMerge, immediate } }
     * @param {{slot:number} & import("./hud_const").HudPlayerSummary} payload
     */
    handlePlayerStatusUpdateRequest(payload) {
        const slot = payload.slot;
        const session = this._getOrCreateSession(slot);
        session.playerInfo = this._mergePlayerInfo(session.playerInfo, payload);
        this._refreshSessionText(session);
    }

    /**
     * 每 tick 刷新全部可见 HUD 的贴脸位置。
     * @param {number} dt 
     */
    tick(dt) {
        let shouldRefreshWaveText = false;
        const prepareTime = this._waveSummary.prepareTime ?? 0;
        if (prepareTime > 0 && this._wavetime < prepareTime) {
            const nextWaveTime = Math.min(prepareTime, this._wavetime + dt);
            shouldRefreshWaveText = nextWaveTime !== this._wavetime;
            this._wavetime = nextWaveTime;
        }

        for (const [, session] of this._sessions) {
            if (!session.use) continue;
            const refreshed = this._refreshHudPosition(session);
            if (!refreshed) {
                this._hideEntity(session);
            }
        }

        for (const [, session] of this._sessions) {
            if (!session.playerInfo) continue;
            const countdownChanged = this._tickCountdownState(session.playerInfo, dt);
            if (!countdownChanged && !shouldRefreshWaveText) continue;
            this._refreshSessionText(session);
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
                requests: new Map(),
                renderedText: "",
            };
            this._sessions.set(slot, session);
        }
        return session;
    }

    /**
     * @param {import("./hud_const").HudPlayerSummary | undefined} current
     * @param {import("./hud_const").HudPlayerSummary} update
     * @returns {import("./hud_const").HudPlayerSummary}
     */
    _mergePlayerInfo(current, update) {
        return {
            ...(current ?? { slot: update.slot }),
            ...update,
        };
    }

    /**
     * 统一刷新单个会话的显示文本：使用会话的 playerInfo 与 manager 的 waveSummary 拼接文本并在需要时显示。
     * - 若存在 pawn 则立即调用 showHud 刷新
     * - 若不存在 pawn 则缓存到 session.pendingText
     * @param {import("./hud_const").HudSession} session
     */
    _refreshSessionText(session) {
        const status = session.playerInfo ?? null;
        if(!status)return;
        const text = this._buildTextFromStatusAndWave(status, this._waveSummary);

        const pawn = status?.pawn ?? session.pawn ?? null;

        if (!text) {
            // 无文本则清除 pending 并隐藏（若已显示）
            if (session.use) this._hideEntity(session);
            return;
        }

        if (pawn) {
            // 有 pawn 时立即显示
            this.showHud({ slot: session.slot, pawn, text, channel: CHANNAL.STATUS, alwaysVisible: HUD_ALWAYS_VISIBLE, result: true });
            return;
        }
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
        const pawnChanged = session.pawn !== request.pawn;
        const textChanged = session.renderedText !== request.text;

        // 无变化且已显示 → 跳过
        if (!channelChanged && !pawnChanged && !textChanged && session.use) return;

        session.activeChannel = winnerChannel;
        session.pawn = request.pawn;

        this._ensureEntity(session);
        if (!session.entity||!session.entity.IsValid()) return;

        Instance.EntFireAtTarget({
            target: session.entity,
            input: "SetMessage",
            value: request.text,
        });
        session.renderedText = request.text;

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
     * @param {import("./hud_const").HudBuffSummary[]} buffSummaries
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
     * @param {import("./hud_const").HudBuffSummary} buffSummary
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
     * @param {import("./hud_const").HudSkillSummary | null} skillSummary
     * @returns {string}
     */
    _formatSkillCooldownLabel(skillSummary) {
        if (!skillSummary) return "无";
        const displayName = this._getEffectDisplayName(skillSummary.typeId);
        if (skillSummary.isConsumed) return `${displayName}(已使用)`;
        if (!skillSummary.isReady) return `${displayName}(${skillSummary.remainingCooldown.toFixed(1)}s)`;
        return `${displayName}("F"触发)`;
    }

    /**
     * @param {import("./hud_const").HudPlayerSummary} playerInfo
     * @param {number} dt
     * @returns {boolean}
     */
    _tickCountdownState(playerInfo, dt) {
        let changed = false;

        if (Array.isArray(playerInfo.buffs)) {
            const nextBuffs = [];
            let removedExpiredBuff = false;

            for (const buff of playerInfo.buffs) {
                if (buff.remaining < 0) {
                    nextBuffs.push(buff);
                    continue;
                }
                const nextRemaining = Math.max(0, buff.remaining - dt);
                if (nextRemaining <= 0) {
                    removedExpiredBuff = true;
                    continue;
                }
                if (nextRemaining === buff.remaining) {
                    nextBuffs.push(buff);
                    continue;
                }
                buff.remaining = nextRemaining;
                nextBuffs.push(buff);
                changed = true;
            }

            if (removedExpiredBuff) {
                playerInfo.buffs = nextBuffs;
                changed = true;
            }
        }

        if (playerInfo.skill && playerInfo.skill.cooldown > 0 && !playerInfo.skill.isConsumed) {
            const nextRemaining = Math.max(0, playerInfo.skill.remainingCooldown - dt);
            if (nextRemaining !== playerInfo.skill.remainingCooldown) {
                playerInfo.skill.remainingCooldown = nextRemaining;
                playerInfo.skill.isReady = nextRemaining <= 0;
                changed = true;
            }
        }

        return changed;
    }

    /**
     * @param {number | undefined} value
     * @returns {boolean}
     */
    _hasNumber(value) {
        return typeof value === "number";
    }

    /**
     * 根据单个玩家的状态与当前波次摘要构建显示文本（多行）。
     * @param {import("./hud_const").HudPlayerSummary} status
     * @param {import("./hud_const").HudWaveSummary} waveSummary
     */
    _buildTextFromStatusAndWave(status, waveSummary) {
        const parts = [];

        if (this._hasNumber(status.level)) {
            const prof = status.professionDisplayName? status.professionDisplayName : (status.professionId ?? "未知");
            parts.push(`Lv.${status.level} ${prof}`);
        }

        if (this._hasNumber(status.health) && this._hasNumber(status.maxHealth)) parts.push(`HP:${status.health}/${status.maxHealth}`);
        else if (this._hasNumber(status.health)) parts.push(`HP:${status.health}`);
        if (this._hasNumber(status.armor)) parts.push(`护甲:${status.armor}`);

        if (this._hasNumber(status.money)) parts.push(`Money:$${status.money}`);
        if (typeof status.exp === "number" && typeof status.expNeeded === "number") {
            const currentExp = status.exp;
            const expNeeded = status.expNeeded;
            parts.push(`升级还需:${Math.max(0, expNeeded - currentExp)}EXP`);
        }

        if (this._hasNumber(status.lastMonsterDamage)) parts.push(`伤害:${status.lastMonsterDamage}`);

        const buffLabel = Array.isArray(status.buffs) ? this._formatBuffLabel(status.buffs) : null;
        const skillLabel = status.skill !== undefined ? this._formatSkillCooldownLabel(status.skill ?? null) : null;
        if (buffLabel) parts.push(`Buff:${buffLabel}`);
        if (skillLabel) parts.push(`技能:${skillLabel}`);
        parts.push(`波次:${waveSummary.currentWave}/${waveSummary.totalWaves}`);
        const nexttime=Math.max(0,waveSummary.prepareTime? (waveSummary.prepareTime - this._wavetime):0);
        if (nexttime>0) 
        {
            parts.push(`准备时间:${nexttime}s`);
        }
        else
        {
            parts.push(`剩余怪物:${Math.max(0, waveSummary.monstersRemaining??0)}`);
        }

        return parts.join(" \n");
    }

    /**
     * @param {string | null | undefined} typeId
     * @returns {string}
     */
    _getEffectDisplayName(typeId) {
        /** @type {Record<string, string>} */
        const names = {
            fire: "火焰",
            burn: "灼烧",
            regeneration: "再生",
            attack_up: "强攻",
            speed_up: "加速",
            corestats: "核心属性",
            pounce: "突袭",
            initanim: "准备",
            doubleattack: "双重攻击",
            powerattack: "破甲",
            shield: "护盾",
            throwstone: "掷石",
            sound: "音波",
            spawn: "召唤",
            player_guard: "防御脉冲",
            player_mend: "治疗脉冲",
            player_mend_field: "医疗场",
            player_vanguard: "恢复自身",
            player_turret: "炮台",
        };
        if (!typeId) return "未知";
        const displayName = names[typeId];
        return displayName ?? typeId;
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
        session.renderedText = "";
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