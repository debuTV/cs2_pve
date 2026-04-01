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

// ——— 各模块独立导入 ———
import { GameManager } from "./game/game_manager";
import { WaveManager } from "./wave/wave_manager";
import { PlayerManager } from "./player/player_manager";
import { InputManager } from "./input/input_manager";
import { ShopManager } from "./shop/shop_manager";
import { HudManager } from "./hud/hud_manager";
import { CHANNAL } from "./hud/hud_const";
import {SkillManager} from "./skill/skill_manager";

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
const buffManager = new BuffManager();

// ═══════════════════════════════════════════════
// 3. 跨模块回调绑定（全部集中在此）
// ═══════════════════════════════════════════════

// ——— 3.1 波次结算 → 玩家 / 游戏 ———

waveManager.setOnWaveComplete((waveNumber) => {
    const waveConfig = waveManager.getWaveConfig(waveNumber);

    // 给予玩家波次奖励
    playerManager.dispatchReward(null, {
        type: "money",
        amount: waveConfig?.reward ?? 0,
        reason: `第${waveNumber}波通关奖励`
    });

    // 推进下一波或胜利
    if (waveManager.hasNextWave()) {
        waveManager.nextWave();
    } else {
        gameManager.gameWon();
    }
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

// ——— 3.2 玩家 → 游戏 / Buff ———

playerManager.events.setOnPlayerBuffAddRequest((player, typeId, params) => {
    return buffManager.addbuff(player, { ...(params ?? {}), id: typeId });
});
playerManager.events.setOnPlayerBuffDeleteRequest((player, buffid) => {
    void player;
    return buffManager.deletebuff(buffid);
});
playerManager.events.setOnPlayerBuffRefreshRequest((player, buffid, params) => {
    void player;
    return buffManager.refreshbuff(buffid, params);
});
playerManager.events.setOnPlayerBuffEmitEvent((player, buffId, event, params) => {
    void player;
    return emitPlayerBuffEvent(buffId, event, params);
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
        gameManager.gameLost();
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
            gameManager.gameLost();
        }
    }
});

playerManager.events.setOnPlayerRespawn((player) => {
    void player;
    gameManager.onPlayerRespawn();
});

// ——— 3.3 全员准备 → 开始游戏 → 开始波次 ———

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
});
//游戏胜利
gameManager.setOnGameWin(() => {
    shopManager.closeAll();
});
// ——— 3.4 游戏重置 → 联动各模块 ———

gameManager.setOnResetGame(() => {
    shopManager.closeAll();
    waveManager.resetGame();
    playerManager.resetAllGameStatus();
    Instance.ServerCommand("mp_restartgame 5");
});

// ——— 3.5 输入 → 商店 ———

inputManager.setOnInput((slot, key) => {
    shopManager.handleRawKey(slot, key);
});

// ——— 3.6 商店 ← 玩家 ———

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

    // ── 5.1 输入 / 玩家 / 波次 / Buff ──
    inputManager.tick();
    playerManager.tick();
    waveManager.tick();
    buffManager.tick();

    // ── 5.2 其他模块 tick ──
    shopManager.tick();
    hudManager.tick(playerManager.getActivePlayers().map(p => p.getSummary()));

    // ── 5.3 玩家状态 HUD 同步 ──
    Instance.SetNextThink(now + 1 / 64);
});
Instance.SetNextThink(Instance.GetGameTime() + 1 / 64);

Instance.Msg("=== PvE Release 已启动 ===");

playerManager.refresh();
