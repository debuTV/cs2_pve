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

import { CSPlayerPawn, Instance } from "cs_script/point_script";
import { eventBus } from "./util/event_bus";
import { event, MovementRequestType } from "./util/definition";

// ——— 各模块独立导入 ———
import { GameState } from "./game/game_const";
import { GameManager } from "./game/game_manager";
import { WaveManager } from "./wave/wave_manager";
import { PlayerManager } from "./player/player_manager";
import { PlayerState } from "./player/player_const";
import { InputManager } from "./input/input_manager";
import { ShopManager } from "./shop/shop_manager";
import { HudManager } from "./hud/hud_manager";
import { HUD_ALWAYS_VISIBLE } from "./hud/hud_const";
import { SkillManager } from "./skill/skill_manager";
import { sentryManager } from "./skill/skills/sentry/sentry_manager";
import { MonsterManager } from "./monster/monster_manager";
import { BuffManager } from "./buff/buff_manager";
import { ParticleManager } from "./particle/particle_manager";
import { NavMesh } from "./navmesh/path_manager";
import { MovementManager } from "./movement/movement_manager";
import { AreaEffectManager } from "./areaEffects/area_manager";
import { ProjectileManager } from "./throw/projectile_manager";
const ticks=1/64;
// ═══════════════════════════════════════════════
// 1. 服务器初始化
// ═══════════════════════════════════════════════

Instance.ServerCommand("mp_warmup_offline_enabled 1");
Instance.ServerCommand("mp_warmup_pausetimer 1");
Instance.ServerCommand("mp_roundtime 60");
Instance.ServerCommand("mp_freezetime 1");
Instance.ServerCommand("mp_ignore_round_win_conditions 1");
Instance.ServerCommand("weapon_accuracy_nospread 1");
Instance.ServerCommand("sv_infinite_ammo 2");
//Instance.ServerCommand("sv_cheats false");
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
const shopManager = new ShopManager(
    (/** @type {import("./shop/shop_const").ShopOpenRequest} */ shopOpenRequest) => {
        const { slot, pawn } = shopOpenRequest;
        if (typeof slot !== "number" || slot < 0) return false;
        if (!pawn?.IsValid?.() || !pawn?.IsAlive?.()) return false;

        const controller = pawn.GetPlayerController?.();
        if (!controller || controller.GetPlayerSlot?.() !== slot) return false;

        const player = playerManager.getPlayer(slot);
        if (!player || player.entityBridge.pawn !== pawn) return false;

        if (gameManager.gameState === GameState.PREPARE) {
            return player.state === PlayerState.PREPARING || player.state === PlayerState.READY;
        }

        if (gameManager.gameState === GameState.PLAYING) {
            return player.state === PlayerState.ALIVE;
        }

        return false;
    });
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
const projectileManager = new ProjectileManager();

sentryManager.setMonsterProvider(() => monsterManager.getActiveMonsters());
function cleanupFinishedMatch() {
    shopManager.closeAll();
    hudManager.clearAll();
    waveManager.resetGame();
    sentryManager.destroyAll();
    monsterManager.stopWave();
    inputManager.cleanup();
    monsterManager.forceCleanup();
    movementManager.clearAll();
    projectileManager.clearAll();
    areaEffectManager.clearAll();
    particleManager.clearAll();
    buffManager.clearAll();
    skillManager.clearAll();
    playerManager.resetAllGameStatus();
    gameManager.clearAll();

    gameManager.onPlayerRespawn();
}

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
    const fp=Instance.FindEntityByName("game_start")?.GetAbsOrigin();
    playerManager.getActivePlayers().forEach(player => {
        player.entityBridge.pawn?.Teleport({
            position:fp
        });
    });
    /** @type {import("./wave/wave_const").WaveStartRequest} */
    const waveStartPayload = { waveIndex: 1, result: false };
    eventBus.emit(event.Wave.In.WaveStartRequest, waveStartPayload);
});

eventBus.on(event.Game.Out.OnGameLost, (payload) => {
    cleanupFinishedMatch();
});

eventBus.on(event.Game.Out.OnGameWin, (payload) => {
    //传送到终点房
    playerManager.dispatchReward(null,{
        type:"respawn"
    });
    const fp=Instance.FindEntityByName("game_complete")?.GetAbsOrigin();
    playerManager.getActivePlayers().forEach(player => {
        player.entityBridge.pawn?.Teleport({
            position:fp
        });
    });
    cleanupFinishedMatch();
});

eventBus.on(event.Game.Out.OnResetGame, (payload) => {
    cleanupFinishedMatch();
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

    const killerPawn = /** @type {import("cs_script/point_script").CSPlayerPawn | null | undefined} */ (payload.killer);
    const killerSlot = killerPawn?.GetPlayerController?.()?.GetPlayerSlot?.();
    if (typeof killerSlot === "number" && killerSlot >= 0 && payload.reward > 0) {
        playerManager.dispatchReward(killerSlot, {
            type: "exp",
            amount: payload.reward,
            reason: `击杀 ${payload.monster.type} 经验`,
        });
    }
});
eventBus.on(event.Monster.Out.OnMonsterDamaged, (/** @type {import("./monster/monster_const").OnMonsterDamaged} */ payload) => {
    const attackerSlot = payload.attacker?.GetPlayerController?.()?.GetPlayerSlot?.();
    if (typeof attackerSlot !== "number" || attackerSlot < 0) return;

    playerManager.recordMonsterDamage(attackerSlot, payload.damage);
});
eventBus.on(event.Monster.Out.OnAttack, (/** @type {import("./monster/monster_const").OnMonsterAttack} */ payload) => {
    const targetSlot = payload.target?.GetPlayerController?.()?.GetPlayerSlot?.();
    if (typeof targetSlot !== "number" || targetSlot < 0) return;

    const player = playerManager.getPlayer(targetSlot);
    if (!player) return;

    player.takeDamage(payload.damage, payload.monster.model ?? null);
});
eventBus.on(event.Throw.Out.OnProjectileHit, (/** @type {import("./throw/throw_const").OnProjectileHit} */ payload) => {
    const damage = Number(payload.meta?.damage ?? 0);
    if (!Number.isFinite(damage) || damage <= 0) return;

    const attackerEntity = payload.source?.IsValid?.()
        ? payload.source
        : null;
    const attackerPawn = payload.source instanceof CSPlayerPawn ? payload.source : null;
    const reason = typeof payload.meta?.reason === "string" ? payload.meta.reason : "projectile";

    for (const hit of payload.hitResults) {
        if (hit.targetType === "player" && "player" in hit) {
            hit.player.takeDamage(damage, attackerEntity);
            continue;
        }

        if (hit.targetType === "monster" && "monster" in hit) {
            hit.monster.takeDamage(damage, attackerPawn, {
                source: attackerEntity,
                reason,
            });
        }
    }
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

// ——— 3.5 输入 → 玩家技能 / 商店 ———

eventBus.on(event.Input.Out.OnInput, (/** @type {import("./input/input_const").OnInput} */ payload) => {
    if (payload.key !== "InspectWeapon") return;
    playerManager.handleInput(payload.slot, payload.key);
});

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
    playerManager.toggleReadyByPawn(pawn,true);
});
Instance.OnScriptInput("unready", (scriptEvent) => {
    const pawn = /** @type {import("cs_script/point_script").CSPlayerPawn|undefined} */ (scriptEvent.activator);
    playerManager.toggleReadyByPawn(pawn,false);
});

Instance.OnScriptInput("openshop", (scriptEvent) => {
    const pawn = /** @type {import("cs_script/point_script").CSPlayerPawn|undefined} */ (scriptEvent.activator);
    const slot = pawn?.GetPlayerController()?.GetPlayerSlot?.();

    if (typeof slot !== "number" || !pawn) return;

    /** @type {import("./shop/shop_const").ShopOpenRequest} */
    const payload = { slot, pawn, result: false };
    eventBus.emit(event.Shop.In.ShopOpenRequest, payload);
});

Instance.OnScriptInput("closeshop", (scriptEvent) => {
    const pawn = /** @type {import("cs_script/point_script").CSPlayerPawn|undefined} */ (scriptEvent.activator);
    const slot = pawn?.GetPlayerController()?.GetPlayerSlot?.();
    if (typeof slot !== "number") return;

    /** @type {import("./shop/shop_const").ShopCloseRequest} */
    const payload = { slot, result: false };
    eventBus.emit(event.Shop.In.ShopCloseRequest, payload);
});
Instance.OnScriptInput("profession", (scriptEvent) => {
    const profession = scriptEvent.caller?.GetEntityName?.();
    const pawn = /** @type {import("cs_script/point_script").CSPlayerPawn|undefined} */ (scriptEvent.activator);
    const slot = pawn?.GetPlayerController()?.GetPlayerSlot?.();
    if (!slot || !profession) return;

    // 通过reward系统触发职业切换
    const success = playerManager.dispatchReward(slot, {
        type: "profession",
        professionId: profession
    });
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
Instance.OnRoundStart(()=>{
    cleanupFinishedMatch();
    playerManager.dispatchReward(null,{
        type:"respawn"
    });
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
    const isGamePlaying = gameManager.checkGameState();
    const alivePlayers = playerManager.getAlivePlayers();//游戏中的存活玩家
    const alivePawns = alivePlayers
        .map((player) => player.entityBridge.pawn)
        .filter((pawn) => pawn != null);

    // ── 5.1 输入 / 玩家 / 波次 / Buff ──
    inputManager.tick();
    playerManager.tick();
    if (isGamePlaying) {
        waveManager.tick();
    }
    if (isGamePlaying) {
        monsterManager.tick(alivePawns);
    }
    if (isGamePlaying) {
        skillManager.tick();
        sentryManager.tick();

        const activeMonsters = monsterManager.getActiveMonsters();
        /** @type {import("cs_script/point_script").Entity[]} */
        const activeMonsterBreakables = [];
        for (const monster of activeMonsters) {
            const breakable = monster.breakable;
            if (!breakable?.IsValid?.()) continue;
            activeMonsterBreakables.push(breakable);
        }

        movementManager.tick(now, dt);

        monsterManager.syncMovementStates(movementManager.getAllStates());

        projectileManager.tick(now, dt, {
            players: alivePlayers,
            monsters: activeMonsters,
        });
        areaEffectManager.tick(now, {
            players: alivePlayers,
            monsters: activeMonsters,
        });
        particleManager.tick(now);
        buffManager.tick();
    }

    // ── 5.2 其他模块 tick ──
    shopManager.tick();
    const isHudTickNeeded = HUD_ALWAYS_VISIBLE || gameManager.gameState === GameState.PLAYING;
    if (isHudTickNeeded) {
        const activePlayers = playerManager.getActivePlayers();//活着的所有人
        let waveSummary = {};
        let playerRuntimeSummary = new Map();
        const waveProgress = waveManager.getProgress();
        waveSummary = {
            remainingMonsters: monsterManager.getRemainingMonsters(waveProgress.wave?.totalMonsters),
            currentWave: waveProgress.current,
            totalWaves: waveProgress.total,
        };
        playerRuntimeSummary = new Map(
            activePlayers.map((player) => [
                player.slot,
                {
                    buffs: buffManager.getActiveBuffSummaries(player),
                    skill: player.skillId != null
                        ? skillManager.getSkillSummary(player.skillId, player)
                        : null,
                },
            ])
        );
        hudManager.tick(activePlayers.map(p => p.getSummary()), waveSummary, playerRuntimeSummary);
    } else if (gameManager.gameState === GameState.WON || gameManager.gameState === GameState.LOST) {
        hudManager.clearAll();
    }

    // ── 5.3 玩家状态 HUD 同步 ──
    Instance.SetNextThink(now + ticks);
});
Instance.SetNextThink(Instance.GetGameTime() + ticks);

Instance.Msg("=== PvE Release 已启动 ===");

playerManager.refresh();