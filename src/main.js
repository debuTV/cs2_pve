/**
 * 已知漏洞
 * 怪物正常死亡后引擎实体从不移除 — 实体泄漏
 * fireuser1相关
 */
/**
 * release 版正式入口。
 *
 * 职责：
 * 1. 设置服务器 cvar。
 * 2. 分别实例化 GameManager、WaveManager、PlayerManager、InputManager、
 *    ShopManager、HudManager 与 BuffManager。
 * 3. 在此文件中完成所有跨模块回调绑定——这里是唯一允许出现跨模块业务回调的地方。
 * 4. 注册统一 think 主循环，按固定顺序推进各模块 tick。
 * 5. 怪物系统已独立拆出，本文件不再直接 import 或调度 monster 相关模块。
 *
 * 设计原则：
 * - game、wave、player、input、shop、hud、buff 各模块彼此独立，不互相 import。
 * - 模块之间的数据流动全部通过本文件的回调绑定完成。
 * @module 主入口
 */

import { Instance } from "cs_script/point_script";
import { eventBus } from "./eventBus/event_bus";
import { event } from "./util/definition";

// ——— 各模块独立导入 ———
import { GameManager } from "./game/game_manager";
import { WaveManager } from "./wave/wave_manager";
import { PlayerManager } from "./player/player_manager";
import { InputManager } from "./input/input_manager";
import { ShopManager } from "./shop/shop_manager";
import { HudManager } from "./hud/hud_manager";
import { CHANNAL } from "./hud/hud_const";
import { SkillManager } from "./skill/skill_manager";
import { MonsterManager } from "./monster/monster_manager";
import { BuffManager } from "./buff/buff_manager";
import { ParticleManager } from "./particle/particle_manager";
import { NavMesh } from "./navmesh/path_manager";
import { MovementManager } from "./movement/movement_manager";
import { contextManager } from "./tempContext/tempContext_manager";
import { AreaEffectManager } from "./areaEffects/area_manager";
// ═══════════════════════════════════════════════
// 1. 服务器初始化
// ═══════════════════════════════════════════════

Instance.ServerCommand("mp_warmup_offline_enabled 1");
Instance.ServerCommand("mp_warmup_pausetimer 1");
Instance.ServerCommand("mp_roundtime 60");
Instance.ServerCommand("mp_freezetime 1");
Instance.ServerCommand("mp_ignore_round_win_conditions 1");
Instance.ServerCommand("weapon_accuracy_nospread 1");

// ═══════════════════════════════════════════════
// 2. 实例化各模块（平级，互不持有）
// ═══════════════════════════════════════════════

/** @type {import("./util/definition").Adapter} */
const adapter = {
    log: (/** @type {string} */ msg) => Instance.Msg(msg),
    broadcast: (/** @type {string} */ msg) => Instance.Msg(`${msg}`),
    sendMessage: (/** @type {number} */ playerSlot, /** @type {string} */ msg) => Instance.Msg(`${playerSlot} "${msg}"`),//////????
    getGameTime: () => Instance.GetGameTime()
};

const gameManager = new GameManager(adapter);
const waveManager = new WaveManager(adapter);
const playerManager = new PlayerManager(adapter);
const inputManager = new InputManager();
const shopManager = new ShopManager();
const hudManager = new HudManager();
const monsterManager = new MonsterManager();
const buffManager = new BuffManager();
const particleManager = new ParticleManager();
const areaEffectManager = new AreaEffectManager();

// ═══════════════════════════════════════════════
// 3. 跨模块回调绑定（全部集中在此）
// ═══════════════════════════════════════════════

// ——— 3.1 波次结算 / Game / Wave / 区域效果编排 ———

eventBus.on(event.Wave.Out.OnWaveEnd, ({ waveIndex }) => {
    const waveNumber = waveIndex;
    const waveConfig = waveManager.getWaveConfig(waveNumber);

    // 给予玩家波次奖励
    playerManager.dispatchReward(null, {
        type: "money",
        amount: waveConfig?.reward ?? 0,
        reason: `第${waveNumber}波通关奖励`
    });

    // 推进下一波或胜利
    if (waveManager.hasNextWave()) {
        eventBus.emit(event.Wave.In.WaveStartRequest, { waveIndex: waveNumber + 1 });
    } else {
        eventBus.emit(event.Game.In.GameWinRequest, { source: "wave-end" });
    }
});

eventBus.on(event.Wave.Out.OnWaveStart, ({ waveConfig }) => {
    if (waveConfig) {
        monsterManager.spawnWave(waveConfig);
    }
});

eventBus.on(event.Game.Out.OnEnterPreparePhase, () => {
    playerManager.dispatchReward(null, {
        type: "ready",
        isReady: false
    });
});

eventBus.on(event.Game.Out.OnStartGame, () => {
    playerManager.enterGameStart();
    eventBus.emit(event.Wave.In.WaveStartRequest, { waveIndex: 1 });
});

eventBus.on(event.Game.Out.OnGameLost, () => {
    shopManager.closeAll();
});

eventBus.on(event.Game.Out.OnGameWin, () => {
    shopManager.closeAll();
});

eventBus.on(event.Game.Out.OnResetGame, () => {
    shopManager.closeAll();
    waveManager.resetGame();
    monsterManager.resetAllGameStatus();
    areaEffectManager.cleanup();
    particleManager.cleanup();
    buffManager.clearAll();
    playerManager.resetAllGameStatus();
    Instance.ServerCommand("mp_restartgame 5");
});

eventBus.on(event.AreaEffects.Out.OnHitPlayer, ({ pawn, payload }) => {
    const slot = pawn?.GetPlayerController?.()?.GetPlayerSlot?.();
    const player = typeof slot === "number" ? playerManager.getPlayer(slot) : null;
    if (!player || !payload?.buffTypeId) return;

    player.buffManager.refreshBuff(payload.buffTypeId, {
        ...(payload.buffParams ?? {}),
        source: payload.source ?? null,
    });
});

eventBus.on(event.AreaEffects.Out.OnHitMonster, ({ monster, payload }) => {
    if (!monster || !payload?.buffTypeId) return;

    monster.buffManager.refreshBuff(payload.buffTypeId, {
        ...(payload.buffParams ?? {}),
        source: payload.source ?? null,
    });
});

/**
 * 玩家 Buff 的最终创建统一留在 main。
 * player 模块只负责抛出请求与运行时事件，真正的创建时机由 main 统一决定。
 * @param {number} playerSlot
 * @param {string} buffTypeId
 * @param {Record<string, any>} [params]
 */
function grantPlayerBuff(playerSlot, buffTypeId, params) {
    if (!buffTypeId) return null;

    return playerManager.applyBuff(playerSlot, buffTypeId, params ?? {});
}

/**
 * @param {number} buffId
 * @param {string} event
 * @param {any} params
 * @returns {boolean}
 */
function emitPlayerBuffEvent(buffId, event, params) {
    switch (event) {
        case "OnTick":
            buffManager.OnTick(buffId, params);
            return true;
        case "OnAttack":
            buffManager.OnAttack(buffId, params);
            return true;
        case "OnDamage":
            buffManager.OnDamage(buffId, params);
            return true;
        case "OnDeath":
            buffManager.OnDeath(buffId, params);
            return true;
        case "OnStateChange":
            buffManager.OnStateChange(buffId, params);
            return true;
        case "OnSpawn":
            buffManager.OnSpawn(buffId, params);
            return true;
        case "OnRecompute":
            buffManager.OnRecompute(buffId, params);
            return true;
        default:
            return false;
    }
}

// ——— 3.2 玩家 / 怪物 → 游戏 / Buff ———

playerManager.events.setOnPlayerBuffEmitEvent((player, buffId, event, params) => {
    void player;
    return emitPlayerBuffEvent(buffId, event, params);
});
monsterManager.events.setOnMonsterBuffEmitEvent((monster, buffId, event, params) => {
    void monster;
    return emitPlayerBuffEvent(buffId, event, params);
});
monsterManager.events.setOnAllMonstersDead(() => {
    eventBus.emit(event.Wave.In.WaveEndRequest, {
        waveIndex: waveManager.currentWave,
        survived: true,
    });
});
playerManager.events.setOnPlayerJoin((player) => {
    void player;
    gameManager.onPlayerJoin();
});
playerManager.events.setOnPlayerLeave((player) => {
    shopManager.closeShop(player.slot);
    inputManager.stop(player.slot);
    hudManager.hideHud(player.slot);

    const wasPlaying = gameManager.onPlayerLeave(player.slot);
    if (wasPlaying && !playerManager.hasAlivePlayers()) {
        eventBus.emit(event.Game.In.GameLoseRequest, { source: "player-leave" });
    }
});

playerManager.events.setOnPlayerDeath((playerPawn) => {
    const controller = playerPawn.GetPlayerController();
    if (controller) {
        const slot = controller.GetPlayerSlot();
        shopManager.closeShop(slot);
        inputManager.stop(slot);
        hudManager.hideHud(slot);

        const wasPlaying = gameManager.onPlayerDeath();
        if (wasPlaying && !playerManager.hasAlivePlayers()) {
            eventBus.emit(event.Game.In.GameLoseRequest, { source: "player-death" });
        }
    }
});

playerManager.events.setOnPlayerRespawn((player) => {
    void player;
    gameManager.onPlayerRespawn();
});

// ——— 3.3 全员准备 → 开始游戏 → 开始波次 ———

playerManager.events.setOnAllPlayersReady(() => {
    eventBus.emit(event.Game.In.StartGameRequest, { source: "all-players-ready" });
});

// ——— 3.5 输入 → 商店 ———

inputManager.setOnInput((slot, key) => {
    shopManager.handleRawKey(slot, key);
});

// ——— 3.6 商店 ← 玩家 ———

shopManager.events.setOpenShop((slot, pawn) => {
    hudManager.showHud(slot, pawn, "", CHANNAL.SHOP);
    inputManager.start(slot, pawn);
});
shopManager.events.setRefreshText((slot, pawn, text) => {
    hudManager.showHud(slot, pawn, text, CHANNAL.SHOP);
});
shopManager.events.setCloseShop((slot) => {
    hudManager.hideHud(slot, CHANNAL.SHOP);
    inputManager.stop(slot);
});

shopManager.events.setGetPlayerInfo((slot) => {
    const player = playerManager.getPlayer(slot);
    if (!player) return null;
    const s = player.getSummary();
    return {
        money: s.money,
        level: s.level,
        health: s.health,
        armor: s.armor,
        weapons: [],
    };
});

shopManager.events.setGrantReward((slot, item, ctx) => {
    const player = playerManager.getPlayer(slot);
    if (!player) return { success: false, message: "玩家不存在" };

    const payload = item.payload;

    if (!payload) return { success: false, message: "商品无效果定义" };

    player.addMoney(-ctx.price);

    switch (payload.type) {
        case "heal":
            player.heal(payload.amount ?? 0);
            break;
        case "armor":
            player.giveArmor(payload.amount ?? 0);
            break;
        case "buff":
            playerManager.dispatchReward(slot, {
                type: "buff",
                buffTypeId: payload.buffTypeId,
                params: payload.params,
                source: {
                    sourceType: "shop",
                    sourceId: item.id,
                    itemId: item.id,
                },
            });
            break;
        case "weapon":
            // 暂无武器系统集成，待添加
            break;
        case "money":
            player.addMoney(payload.amount ?? 0);
            break;
        default:
            return { success: false, message: `未知效果类型: ${payload.type}` };
    }

    return { success: true, message: `购买成功: ${item.displayName}` };
});

// ═══════════════════════════════════════════════
// 4. 引擎事件注册
// ═══════════════════════════════════════════════
Instance.OnPlayerConnect((event) => {
    playerManager.handlePlayerConnect(event.player);
});

Instance.OnPlayerActivate((event) => {
    playerManager.handlePlayerActivate(event.player);
});

Instance.OnPlayerDisconnect((event) => {
    playerManager.handlePlayerDisconnect(event.playerSlot);
});

Instance.OnPlayerReset((event) => {
    playerManager.handlePlayerReset(event.player);
});

Instance.OnPlayerKill((event) => {
    playerManager.handlePlayerDeath(event.player);
});

Instance.OnModifyPlayerDamage((event) => {
    return playerManager.handleBeforePlayerDamage(event);
});

Instance.OnPlayerDamage((event) => {
    playerManager.handlePlayerDamage(event);
});

Instance.OnPlayerChat((event) => {
    playerManager.handlePlayerChat(event);
    const controller = event.player;
    const text = event.text;
    if (!controller) return;

    const parts = text.trim().toLowerCase().split(/\s+/);
    const command = parts[0];
    const count = Number(parts[1]);

    if (command === "shop" || command === "!shop") {
        const pawn = controller.GetPlayerPawn();
        if (pawn) {
            shopManager.openShop(controller.GetPlayerSlot(), pawn);
        }
    }
    if (command === "debug" || command === "!debug") {

    }
});

// ═══════════════════════════════════════════════
// 5. 主循环（统一 think）
// ═══════════════════════════════════════════════

/** 上一帧时间戳，用于计算 dt */
let _lastTime = Instance.GetGameTime();

Instance.SetThink(() => {
    const now = Instance.GetGameTime();
    _lastTime = now;
    const activePlayers = playerManager.getActivePlayers();
    const alivePlayers = playerManager.getAlivePlayers()
        .map((player) => player.entityBridge.pawn)
        .filter((pawn) => pawn != null);
    const activeMonsters = monsterManager.getActiveMonsters();
    const monsterEntities = activeMonsters
        .map((monster) => monster.model)
        .filter((entity) => entity != null);

    // ── 5.1 输入 / 玩家 / 波次 / Buff ──
    inputManager.tick();
    playerManager.tick();
    waveManager.tick();
    monsterManager.tick(monsterEntities, alivePlayers);
    areaEffectManager.tick(now, {
        players: alivePlayers,
        monsters: activeMonsters,
    });
    particleManager.tickAll(now);
    buffManager.tick();

    // ── 5.2 其他模块 tick ──
    shopManager.tick();
    hudManager.tick(activePlayers.map(p => p.getSummary()));

    // ── 5.3 玩家状态 HUD 同步 ──
    Instance.SetNextThink(now + 1 / 64);
});
Instance.SetNextThink(Instance.GetGameTime() + 1 / 64);

Instance.Msg("=== PvE Release 已启动 ===");

playerManager.refresh();
