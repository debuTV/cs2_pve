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
import { event, MovementRequestType } from "./util/definition";

// ——— 各模块独立导入 ———
import { GameManager } from "./game/game_manager";
import { WaveManager } from "./wave/wave_manager";
import { PlayerManager } from "./player/player_manager";
import { InputManager } from "./input/input_manager";
import { ShopManager } from "./shop/shop_manager";
import { HudManager } from "./hud/hud_manager";
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
const skillManager = new SkillManager();
const monsterManager = new MonsterManager();
const navMesh = new NavMesh();
navMesh.init();
const movementManager = new MovementManager();
movementManager.initPathScheduler((start, end) => navMesh.findPath(start, end));
const buffManager = new BuffManager();
const particleManager = new ParticleManager();
const areaEffectManager = new AreaEffectManager();

// ═══════════════════════════════════════════════
// 3. 跨模块回调绑定（全部集中在此）
// ═══════════════════════════════════════════════

// ——— 3.1 波次结算 / Game / Wave / 区域效果编排 ———

eventBus.on(event.Wave.Out.OnWaveEnd, (/** @type {import("./wave/wave_const").OnWaveEnd} */ payload) => {
    const waveNumber = payload.waveIndex;
    const waveConfig = waveManager.getWaveConfig(waveNumber);

    // 给予玩家波次奖励
    playerManager.dispatchReward(null, {
        type: "money",
        amount: waveConfig?.reward ?? 0,
        reason: `第${waveNumber}波通关奖励`
    });

    // 推进下一波或胜利
    if (waveManager.hasNextWave()) {
        /** @type {import("./wave/wave_const").WaveStartRequest} */
        const payload = { waveIndex: waveNumber + 1, result: false };
        eventBus.emit(event.Wave.In.WaveStartRequest, payload);
    } else {
        eventBus.emit(event.Game.In.GameWinRequest,{});
    }
});

eventBus.on(event.Wave.Out.OnWaveStart, (/** @type {import("./wave/wave_const").OnWaveStart} */ payload) => {
    const { waveConfig } = payload;
    if (waveConfig) {
        monsterManager.spawnWave(waveConfig);
    }
});

eventBus.on(event.Game.Out.OnEnterPreparePhase, (payload) => {
    void payload;
    playerManager.dispatchReward(null, {
        type: "ready",
        isReady: false
    });
});

eventBus.on(event.Game.Out.OnStartGame, (payload) => {
    void payload;
    playerManager.enterGameStart();
    /** @type {import("./wave/wave_const").WaveStartRequest} */
    const waveStartPayload = { waveIndex: 1, result: false };
    eventBus.emit(event.Wave.In.WaveStartRequest, waveStartPayload);
});

eventBus.on(event.Game.Out.OnGameLost, (payload) => {
    void payload;
    shopManager.closeAll();
});

eventBus.on(event.Game.Out.OnGameWin, (payload) => {
    void payload;
    shopManager.closeAll();
});

eventBus.on(event.Game.Out.OnResetGame, (payload) => {
    void payload;
    shopManager.closeAll();
    waveManager.resetGame();
    skillManager.clearAll();
    monsterManager.resetAllGameStatus();
    movementManager.cleanup();
    areaEffectManager.cleanup();
    particleManager.cleanup();
    buffManager.clearAll();
    playerManager.resetAllGameStatus();
    Instance.ServerCommand("mp_restartgame 5");
});

// ——— 3.2 玩家 / 怪物 → 游戏 / Buff ———

eventBus.on(event.Monster.Out.OnMonsterDeath, (/** @type {import("./monster/monster_const").OnMonsterDeath} */ payload) => {
    if (!payload.monster.model) return;
    /** @type {import("./util/definition").MovementRequest} */
    const removePayload = {
        type: MovementRequestType.Remove,
        entity: payload.monster.model,
        priority: -1,
    };
    eventBus.emit(event.Movement.In.RemoveRequest, removePayload);
});
eventBus.on(event.Monster.Out.OnAllMonstersDead, () => {
    eventBus.emit(event.Wave.In.WaveEndRequest, {result: false});
});
eventBus.on(event.Player.Out.OnPlayerJoin, (payload) => {
    void payload;
    gameManager.onPlayerJoin();
});
eventBus.on(event.Player.Out.OnPlayerLeave, (payload) => {
    /** @type {import("./shop/shop_const").ShopCloseRequest} */
    const shopClosePayload = { slot: payload.slot, result: false };
    eventBus.emit(event.Shop.In.ShopCloseRequest, shopClosePayload);

    /** @type {import("./input/input_const").StopRequest} */
    const inputStopPayload = { slot: payload.slot, result: false };
    eventBus.emit(event.Input.In.StopRequest, inputStopPayload);

    /** @type {import("./hud/hud_const").HideHudRequest} */
    const hideHudPayload = { slot: payload.slot, result: false };
    eventBus.emit(event.Hud.In.HideHudRequest, hideHudPayload);

    const wasPlaying = gameManager.onPlayerLeave(payload.slot);
    if (wasPlaying && !playerManager.hasAlivePlayers()) {
        eventBus.emit(event.Game.In.GameLoseRequest, {});
    }
});

eventBus.on(event.Player.Out.OnPlayerDeath, (payload) => {
    /** @type {import("./shop/shop_const").ShopCloseRequest} */
    const shopClosePayload = { slot: payload.slot, result: false };
    eventBus.emit(event.Shop.In.ShopCloseRequest, shopClosePayload);

    /** @type {import("./input/input_const").StopRequest} */
    const inputStopPayload = { slot: payload.slot, result: false };
    eventBus.emit(event.Input.In.StopRequest, inputStopPayload);

    /** @type {import("./hud/hud_const").HideHudRequest} */
    const hideHudPayload = { slot: payload.slot, result: false };
    eventBus.emit(event.Hud.In.HideHudRequest, hideHudPayload);

    const wasPlaying = gameManager.onPlayerDeath();
    if (wasPlaying && !playerManager.hasAlivePlayers()) {
        eventBus.emit(event.Game.In.GameLoseRequest, {});
    }
});

eventBus.on(event.Player.Out.OnPlayerRespawn, (payload) => {
    void payload;
    gameManager.onPlayerRespawn();
});

// ——— 3.3 全员准备 → 开始游戏 → 开始波次 ———

eventBus.on(event.Player.Out.OnAllPlayersReady, () => {
    eventBus.emit(event.Game.In.StartGameRequest, {});
});

// ——— 3.5 输入 → 商店 ———

// ═══════════════════════════════════════════════
// 4. 引擎事件注册
// ═══════════════════════════════════════════════
Instance.OnScriptInput("startGame", () => {
    eventBus.emit(event.Game.In.StartGameRequest, {});
});

Instance.OnScriptInput("enterPreparePhase", () => {
    eventBus.emit(event.Game.In.EnterPreparePhaseRequest, { });
});

Instance.OnScriptInput("resetGame", () => {
    eventBus.emit(event.Game.In.ResetGameRequest, { });
});

Instance.OnScriptInput("gameWon", () => {
    eventBus.emit(event.Game.In.GameWinRequest, {});
});

Instance.OnScriptInput("gameLost", () => {
    eventBus.emit(event.Game.In.GameLoseRequest, {});
});

Instance.OnScriptInput("endWave", () => {
    eventBus.emit(event.Wave.In.WaveEndRequest, {result: false});
});

Instance.OnScriptInput("startWave", (scriptEvent) => {
    const entityName = scriptEvent.caller?.GetEntityName?.();
    if (!entityName) return;

    const parts = entityName.split("_");
    const waveNumber = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(waveNumber)) {
        /** @type {import("./wave/wave_const").WaveStartRequest} */
        const payload = { waveIndex: waveNumber, result: false };
        eventBus.emit(event.Wave.In.WaveStartRequest, payload);
    }
});

Instance.OnScriptInput("ready", (scriptEvent) => {
    const pawn = /** @type {import("cs_script/point_script").CSPlayerPawn|undefined} */ (scriptEvent.activator);
    playerManager.toggleReadyByPawn(pawn);
});

Instance.OnScriptInput("openshop", (scriptEvent) => {
    const controller = /** @type {import("cs_script/point_script").CSPlayerController|undefined} */ (scriptEvent.activator);
    const slot = controller?.GetPlayerSlot?.();
    const pawn = controller?.GetPlayerPawn?.();
    if (typeof slot !== "number" || !pawn) return;

    /** @type {import("./shop/shop_const").ShopOpenRequest} */
    const payload = { slot, pawn, result: false };
    eventBus.emit(event.Shop.In.ShopOpenRequest, payload);
});

Instance.OnScriptInput("closeshop", (scriptEvent) => {
    const controller = /** @type {import("cs_script/point_script").CSPlayerController|undefined} */ (scriptEvent.activator);
    const slot = controller?.GetPlayerSlot?.();
    if (typeof slot !== "number") return;

    /** @type {import("./shop/shop_const").ShopCloseRequest} */
    const payload = { slot, result: false };
    eventBus.emit(event.Shop.In.ShopCloseRequest, payload);
});

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

Instance.OnPlayerChat((chatEvent) => {
    playerManager.handlePlayerChat(chatEvent);
    const controller = chatEvent.player;
    const text = chatEvent.text;
    if (!controller) return;

    const parts = text.trim().toLowerCase().split(/\s+/);
    const command = parts[0];
    const count = Number(parts[1]);

    if (command === "shop" || command === "!shop") {
        const pawn = controller.GetPlayerPawn();
        if (pawn) {
            /** @type {import("./shop/shop_const").ShopOpenRequest} */
            const payload = { slot: controller.GetPlayerSlot(), pawn, result: false };
            eventBus.emit(event.Shop.In.ShopOpenRequest, payload);
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
    const dt = Math.max(0, now - _lastTime);
    _lastTime = now;
    const activePlayers = playerManager.getActivePlayers();
    const alivePlayers = playerManager.getAlivePlayers();
    const alivePawns = alivePlayers
        .map((player) => player.entityBridge.pawn)
        .filter((pawn) => pawn != null);
    const currentMonsters = monsterManager.getActiveMonsters();
    const currentMonsterEntities = currentMonsters
        .map((monster) => monster.model)
        .filter((entity) => entity != null);

    // ── 5.1 输入 / 玩家 / 波次 / Buff ──
    inputManager.tick();
    playerManager.tick();
    waveManager.tick();
    monsterManager.tick(currentMonsterEntities, alivePawns);
    skillManager.tick();
    const activeMonsters = monsterManager.getActiveMonsters();
    const monsterEntities = activeMonsters
        .map((monster) => monster.model)
        .filter((entity) => entity != null);
    const separationPositions = monsterEntities
        .map((entity) => entity.GetAbsOrigin())
        .filter((position) => position != null);
    movementManager.tick(now, dt, separationPositions);
    monsterManager.syncMovementStates(movementManager.getAllStates());
    areaEffectManager.tick(now, {
        players: alivePlayers,
        monsters: activeMonsters,
    });
    particleManager.tickAll(now);
    buffManager.tick();
    navMesh.tick(alivePawns[0]?.GetAbsOrigin?.());

    // ── 5.2 其他模块 tick ──
    shopManager.tick();
    hudManager.tick(activePlayers.map(p => p.getSummary()));

    // ── 5.3 玩家状态 HUD 同步 ──
    Instance.SetNextThink(now + 1 / 64);
});
Instance.SetNextThink(Instance.GetGameTime() + 1 / 64);

Instance.Msg("=== PvE Release 已启动 ===");

playerManager.refresh();
