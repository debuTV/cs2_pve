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
 * 2. 分别实例化 GameManager、WaveManager、PlayerManager、MonsterManager、
 *    MovementManager、NavMesh、InputManager、ShopManager、HudManager。
 * 3. 在此文件中完成所有跨模块回调绑定——这里是唯一允许出现跨模块业务回调的地方。
 * 4. 注册统一 think 主循环，按固定顺序推进各模块 tick。
 * 5. 消费怪物移动意图事件，驱动 MovementManager 执行实际移动，
 *    并将移动状态回写给 Monster。
 *
 * 设计原则：
 * - game、wave、player、monster、movement、navmesh、input、shop、hud 各模块彼此独立，不互相 import。
 * - 模块之间的数据流动全部通过本文件的回调绑定完成。
 * @module 主入口
 */

import { BaseModelEntity, CSPlayerController, CSPlayerPawn, Entity, Instance, PointTemplate } from "cs_script/point_script";

// ——— 各模块独立导入 ———
import { GameManager } from "./game/game_manager";
import { WaveManager } from "./wave/wave_manager";
import { PlayerManager } from "./player/player_manager";
import { MonsterManager } from "./monster/monster_manager";
import { MovementManager } from "./movement/movement_manager";
import { NavMesh } from "./navmesh/path_manager";
import { AreaEffectManager } from "./areaEffects/area_manager";
import { ParticleManager } from "./particle/particle_manager";

import { InputManager } from "./input/input_manager";
import { ShopManager } from "./shop/shop_manager";
import { HudManager } from "./hud/hud_manager";
import { CHANNAL } from "./hud/hud_const";
import { TEMP_DISABLE, getActiveTempDisableKeys } from "./runtime_flags";

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

const activeTempDisableKeys = getActiveTempDisableKeys();
if (activeTempDisableKeys.length > 0) {
    Instance.Msg(`[TempDisable] Active: ${activeTempDisableKeys.join(", ")}`);
}

const gameManager = new GameManager(adapter);
const waveManager = new WaveManager(adapter);
const playerManager = new PlayerManager(adapter);
const monsterManager = new MonsterManager();
const movementManager = new MovementManager();
const navMesh = new NavMesh();
const areaEffectManager = new AreaEffectManager();
const particleManager = new ParticleManager();
const inputManager = new InputManager();
const shopManager = new ShopManager();
const hudManager = new HudManager();

function cleanupMonsterSystems() {
    monsterManager.cleanup();
    areaEffectManager.cleanup();
    particleManager.cleanup();
    movementManager.cleanup();
    monsterManager.resetStats();
}

// ── 初始化导航网格 ──
navMesh.init();

// ── 装配路径调度依赖 ──
movementManager.initPathScheduler(
    (start, end) => navMesh.findPath(start, end)
);

// ═══════════════════════════════════════════════
// 3. 跨模块回调绑定（全部集中在此）
// ═══════════════════════════════════════════════

// ——— 3.1 波次 → 怪物 ———

waveManager.setOnWaveStart((waveNumber, waveConfig) => {
    monsterManager.spawnWave(waveConfig);
});

waveManager.setOnWaveComplete((waveNumber) => {
    const waveConfig = waveManager.getWaveConfig(waveNumber);

    // 给予玩家波次奖励
    playerManager.dispatchReward(null, {
        type: "money",
        amount: waveConfig?.reward ?? 0,
        reason: `第${waveNumber}波通关奖励`
    });

    // 清理怪物
    monsterManager.stopWave();
    cleanupMonsterSystems();

    // 推进下一波或胜利
    if (waveManager.hasNextWave()) {
        waveManager.nextWave();
    } else {
        gameManager.gameWon();
    }
});

// ——— 3.2 怪物 → 玩家 ———

monsterManager.events.setOnMonsterDeath((monster, killer, reward) => {
    // 注销移动实例
    movementManager.unregister(monster.model);

    if (killer && killer instanceof CSPlayerPawn) {
        const controller = killer.GetPlayerController();
        if (controller) {
            const playerSlot = controller.GetPlayerSlot();
            playerManager.dispatchReward(playerSlot, {
                type: "exp",
                amount: reward,
                reason: "击杀怪物"
            });
            playerManager.dispatchReward(playerSlot, {
                type: "money",
                amount: reward,
                reason: "击杀怪物"
            });
        }
    }
});

monsterManager.events.setOnAllMonstersDead(() => {
    waveManager.completeWave();
});

monsterManager.events.setOnAttack((damage, target) => {
    const controller = target.GetPlayerController();
    if (controller) {
        const playerSlot = controller.GetPlayerSlot();
        playerManager.dispatchReward(playerSlot, {
            type: "damage",
            amount: damage
        });
    }
});

monsterManager.events.setOnSkill((id, target, payload) => {
    if (TEMP_DISABLE.monsterSkills || TEMP_DISABLE.playerBuffs) return;
    const controller = target.GetPlayerController();
    if (controller) {
        const playerSlot = controller.GetPlayerSlot();
        const buffId = payload?.buffTypeId ?? id;
        const params = payload?.params;
        playerManager.applyBuff(playerSlot, buffId, params, payload?.source);
    }
});
monsterManager.events.setOnBeforeTakeDamage((monster, amount, attacker) => {
    if (attacker && attacker instanceof CSPlayerPawn) {
        const controller = attacker.GetPlayerController();
        if (controller) {
            const playerSlot = controller.GetPlayerSlot();
            return playerManager.modifyDamage(playerSlot, amount);
        }
    }
    return amount;
});
areaEffectManager.setOnHitPlayer((targetPawn, payload) => {
    if (TEMP_DISABLE.playerBuffs) return;
    const controller = targetPawn.GetPlayerController();
    if (!controller) return;

    playerManager.applyBuff(
        controller.GetPlayerSlot(),
        payload.buffTypeId,
        payload.buffParams,
        payload.source
    );
});

areaEffectManager.setOnHitMonster((targetMonster, payload) => {
    if (TEMP_DISABLE.monsterBuffs) return;
    monsterManager.applyBuff(targetMonster, payload.buffTypeId, payload.buffParams, payload.source);
});

areaEffectManager.setOnParticleRequest((request) => {
    const particle = particleManager.create(request.particleId, request.position, {
        lifetime: request.lifetime
    });
    if (!particle) return null;

    return {
        stop: () => {
            particle.stop();
        }
    };
});

// ——— 3.2b 怪物生成 → 注册移动实例 + 路径调度 ———

monsterManager.events.setOnMonsterSpawn((monster) => {
    movementManager.register(monster.model, {
        speed: monster.speed,
        mode: monster.movementPath.getDefaultMode(),
        ignoreEntity: monster.model,
    });
    monster.events.setOnAreaEffectRequest((desc) => {
        if (TEMP_DISABLE.monsterSkills) return;
        areaEffectManager.create(desc);
    });
});

// ——— 3.2c 怪物移动请求 → MovementManager 队列 ———

monsterManager.events.setOnMovementRequest((req) => {
    movementManager.submitRequest(req);
});

// ——— 3.3 玩家 → 游戏 ———

playerManager.events.setOnPlayerJoin((player) => {
    if (player.entityBridge.pawn) monsterManager.addPlayerPawn(player.entityBridge.pawn);
    gameManager.onPlayerJoin();
});
playerManager.events.setOnPlayerLeave((player) => {
    if (player.entityBridge.pawn) monsterManager.removePlayerPawn(player.entityBridge.pawn);
    shopManager.closeShop(player.slot);
    inputManager.stop(player.slot);
    hudManager.hideHud(player.slot);

    const wasPlaying = gameManager.onPlayerLeave(player.slot);
    if (wasPlaying && !playerManager.hasAlivePlayers()) {
        gameManager.gameLost();
    }
});

playerManager.events.setOnPlayerDeath((playerPawn) => {
    monsterManager.removePlayerPawn(playerPawn);
    const controller = playerPawn.GetPlayerController();
    if (controller) {
        const slot = controller.GetPlayerSlot();
        shopManager.closeShop(slot);
        inputManager.stop(slot);
        hudManager.hideHud(slot);

        const wasPlaying = gameManager.onPlayerDeath();
        if (wasPlaying && !playerManager.hasAlivePlayers()) {
            gameManager.gameLost();
        }
    }
});

playerManager.events.setOnPlayerRespawn((player) => {
    if (player.entityBridge.pawn) monsterManager.addPlayerPawn(player.entityBridge.pawn);
    gameManager.onPlayerRespawn();
});

// ——— 3.4 全员准备 → 开始游戏 → 开始波次 ———

playerManager.events.setOnAllPlayersReady(() => {
    gameManager.startGame();
});

gameManager.setOnGamePrepare(() => {
    playerManager.dispatchReward(null, {
        type: "ready",
        isReady: false
    });
});

gameManager.setOnGameStart(() => {
    playerManager.enterGameStart();
    waveManager.startWave(1);
});

gameManager.setOnGameLost(() => {
    shopManager.closeAll();
    monsterManager.stopWave();
    cleanupMonsterSystems();
});
//游戏胜利
gameManager.setOnGameWin(() => {
    shopManager.closeAll();
    monsterManager.stopWave();
    cleanupMonsterSystems();
});
// ——— 3.5 游戏重置 → 联动各模块 ———

gameManager.setOnResetGame(() => {
    shopManager.closeAll();
    waveManager.resetGame();
    playerManager.resetAllGameStatus();
    monsterManager.stopWave();
    cleanupMonsterSystems();
    Instance.ServerCommand("mp_restartgame 5");
});

// ——— 3.6 输入 → 商店 ———

inputManager.setOnInput((slot, key) => {
    shopManager.handleRawKey(slot, key);
});

// ——— 3.7 商店 ← 玩家 ———

shopManager.setOpenShop((slot, pawn) => {
    hudManager.showHud(slot, pawn, "", CHANNAL.SHOP);
    inputManager.start(slot,pawn);
});
shopManager.setRefreshText((slot, pawn, text) => {
    hudManager.showHud(slot, pawn, text, CHANNAL.SHOP);
});
shopManager.setCloseShop((slot) => {
    hudManager.hideHud(slot, CHANNAL.SHOP);
    inputManager.stop(slot);
});

shopManager.setGetPlayerInfo((slot) => {
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

shopManager.setGrantReward((slot, item, ctx) => {
    const player = playerManager.getPlayer(slot);
    if (!player) return { success: false, message: "玩家不存在" };

    const payload = item.payload;
    if (payload?.type === "buff" && TEMP_DISABLE.playerBuffs) {
        return { success: false, message: "Buffs are temporarily disabled." };
    }
    if (!payload) return { success: false, message: "商品无效果定义" };

    player.addMoney(-ctx.price, `购买 ${item.displayName}`);

    switch (payload.type) {
        case "heal":
            player.heal(payload.amount ?? 0);
            break;
        case "armor":
            player.giveArmor(payload.amount ?? 0);
            break;
        case "buff":
            playerManager.applyBuff(slot, payload.buffTypeId, payload.params, {
                sourceType: "shop",
                sourceId: item.id,
                itemId: item.id,
            });
            break;
        case "weapon":
            // 暂无武器系统集成，待添加
            break;
        case "money":
            player.addMoney(payload.amount ?? 0, "商店奖励");
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
    const dt = now - _lastTime;
    _lastTime = now;
    // ── 5.1 输入 / 玩家 / 波次 ──
    inputManager.tick();
    playerManager.tick();
    waveManager.tick();

    // ── 5.2 怪物 AI tick（产出移动请求，自动提交到 movementManager 队列） ──
    const tickContext = monsterManager.tick();
    for (const monster of monsterManager.getActiveMonsters()) {
        movementManager.setSpeed(monster.model, monster.speed);
    }

    // ── 5.3 统一移动 tick（消费请求 → 路径刷新 → 批量 update） ──
    movementManager.tick(now,dt, tickContext.monsterPositions);

    // ── 5.4 移动状态回写：将 movement 状态快照同步给 monster 侧 ──
    monsterManager.syncMovementStates(movementManager.getAllStates());
    areaEffectManager.tick(now, {
        players: tickContext.allppos,
        monsters: monsterManager.getActiveMonsters()
    });
    particleManager.tickAll(now);

    // ── 5.7 NavMesh tick ──
    navMesh.tick();
    // ── 5.8 其他模块 tick ──
    shopManager.tick();
    hudManager.tick(playerManager.getActivePlayers().map(p => p.getSummary()));

    // ── 5.9 玩家状态 HUD 同步 ──
    Instance.SetNextThink(now + 1 / 64);
});
Instance.SetNextThink(Instance.GetGameTime() + 1 / 64);

Instance.Msg("=== PvE Release 已启动 ===");

playerManager.refresh();
monsterManager.syncAllPlayerPawns(
    playerManager
        .getActivePlayers()
        .map((player) => player.entityBridge.pawn)
        .filter((pawn) => !!pawn)
);
