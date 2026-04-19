/**
 * @module 工具/定义
 */
/**
 * @typedef {Object} broadcastMessage - 广播消息对象
 * @property {string} message - 发送的信息
 * @property {number} delay - 距波次开始的延迟时间（秒）
 */
/**
 * @typedef {object} skill_pool - 技能池配置对象。同类型技能可重复出现多次。
 * 所有技能均支持：params.events（触发事件数组，可选）、params.cooldown（可选，默认 -1，一次性）、params.animation（可选）。
 * @property {string} id - 技能类型名称，必须在 SkillFactory 中注册（同类型可重复出现多次）
 * @property {number} chance - 技能获得概率（0~1）
 * @property {object} params - 技能参数（各技能自定义，详见 skill_factory.js 注释）
 */
/**
 * 通用动画集合类型：任意键对应动画名数组。
 * 例如 `{ idle: string[], walk: string[] }`。`idle`、`walk`、`attack`、`skill`、`dead` 在对应状态切换时播放。
 * 当vel为-1时，用设置自身的速度取代动画速度
 * @typedef {{ [key: string]: {name:string,vel:number}[] }} animations
 */
/**
 * @typedef {object} monsterTypes - 怪物类型配置对象。每个怪物实例对应一个 monsterTypes 配置项，包含其属性、技能池和动画列表。
 * @property {string} template_name - 怪物模板名称，对应地图中 PointTemplate 的实体名称
 * @property {string} model_name - 模型名称，对应游戏内模型资源路径（不含前缀 `models/` 和后缀 `.mdl`）
 * @property {string} name - 怪物名称（仅作记录/展示）
 * @property {number} baseHealth - 基础生命值
 * @property {number} baseDamage - 基础伤害
 * @property {number} speed - 移动速度
 * @property {number} moneyReward - 击杀金钱奖励
 * @property {number} expReward - 击杀经验奖励
 * @property {number} attackdist - 攻击距离
 * @property {number} attackCooldown - 攻击冷却时间（秒）
 * @property {string} movementmode - 移动模式（例如 `walk`、`fly` 等，具体逻辑由怪物系统实现）
 * @property {skill_pool[]} skill_pool - 技能池配置数组
 * @property {animations} animations - 动画配置对象，键为状态名，值为对应动画名数组
 */
/**
 * @typedef {object} waveConfig - 波次配置对象。每波包含一个或多个 monsterTypes 配置项，定义该波次的怪物类型和属性。
 * @property {string} name - 波次名称
 * @property {number} totalMonsters - 怪物总数（仅作记录/展示）
 * @property {number} moneyReward - 波次金钱奖励
 * @property {number} expReward - 波次经验奖励
 * @property {number} spawnInterval - 怪物生成间隔（秒）
 * @property {number} preparationTime - 波次准备时间（秒）
 * @property {number} aliveMonster - 同时存在的怪物数量（仅作记录/展示）
 * @property {string[]} monster_spawn_points_name - 怪物生成点名称数组，对应地图中 PointTemplate 的实体名称
 * @property {broadcastMessage[]} broadcastmessage - 准备阶段广播消息
 * @property {monsterTypes[]} monsterTypes - 怪物类型配置数组，定义该波次的怪物类型和属性
 */
/**
 * @typedef {object} particleConfig - 粒子配置项。每个粒子对应一个地图中的 PointTemplate，ForceSpawn 后生成 info_particle_system。
 * @property {string} id - 业务粒子 id（代码中引用的 key）
 * @property {string} spawnTemplateName - 地图中 PointTemplate 的实体名称
 * @property {string} middleEntityName - PointTemplate 内目标 info_particle_system 的实体名称；如果是范围特效，选择范围中心点的实体用于精确匹配
 */
/**
 * @typedef {object} Adapter - 外部适配器接口
 * @property {(msg: string) => void} log - 输出日志
 * @property {(msg: string) => void} broadcast - 广播消息给玩家
 * @property {(playerSlot: number, msg: string) => void} sendMessage - 发送消息给指定玩家
 * @property {() => number} getGameTime - 获取当前游戏时间（秒）
 */

/**
 * 移动请求类型常量。
 *
 * 统一移动请求模型：Monster 侧只提交 MoveRequest / StopRequest / RemoveMovement，
 * main 侧按 priority 合并后统一消费。
 */
export const MovementRequestType = {
    /** 移动请求：追击实体或移动到坐标 */
    Move:   "Move",
    /** 停止请求 */
    Stop:   "Stop",
    /** 注销 Movement 实例 */
    Remove: "Remove",
};
/**@typedef {import("cs_script/point_script").Entity} Entity */
/**@typedef {import("cs_script/point_script").Vector} Vector */
/**
 * @typedef {object} MovementRequest
 * @property {string}  type - MovementRequestType 值
 * @property {Entity}  entity - 移动实体，也是请求合并与定位 Movement 的主键
 * @property {number}  priority - MovementPriority 值
 * @property {Entity}  [targetEntity] - 追击目标实体（与 targetPosition 互斥）
 * @property {Vector}  [targetPosition] - 目标坐标（与 targetEntity 互斥）
 * @property {boolean} [usePathRefresh] - 是否允许刷新路径（默认 true）
 * @property {boolean} [useNPCSeparation] - 是否启用 NPC 分离速度；false 时每 tick 传空分离上下文
 * @property {string}  [Mode] - 切换移动模式（walk / air / fly 等）
 * @property {Vector}  [Velocity] - 设置速度向量（技能位移用，例如飞扑就需要）
 * @property {boolean} [preserveVelocityInAir] - 在 air 模式下保留初始水平速度，不再被常规空中转向覆盖
 * @property {number}  [maxSpeed] - 速度上限
 * @property {boolean} [clearPath] - 是否清空现有路径
 */

/**
 * 移动请求优先级。数值越小优先级越高。
 * main 每帧按 priority 合并同一 entity 的请求，保留最高优先级。
 */
export const MovementPriority = {
    Skill:       0,
    StateChange: 1,
    Chase:       2,
};

export const event = {
    AreaEffects: {
        In: {
            CreateRequest: "AreaEffects_OnCreateRequest",    // 请求创建区域效果，payload 包含 {areaEffectStaticKey: string, position: Vector, radius: number, duration: number, parentEntity?: Entity|null, targetTypes: string[]}
            StopRequest: "AreaEffects_OnStopRequest",        // 请求停止区域效果，payload 包含 {areaEffectId: number}
        },
        Out: {
            OnCreated: "AreaEffects_OnCreated",              // 区域效果创建后
            OnHitPlayer: "AreaEffects_OnHitPlayer",          // 玩家被范围效果命中
            OnHitMonster: "AreaEffects_OnHitMonster",        // 怪物被范围效果命中
            OnStopped: "AreaEffects_OnStopped",              // 区域效果停止后
        },
    },
    Buff: {
        In: {
            BuffAddRequest: "Buff_OnBuffAddRequest",          // 请求添加 Buff
            BuffRefreshRequest: "Buff_OnBuffRefreshRequest",  // 请求刷新 Buff
            BuffRemoveRequest: "Buff_OnBuffRemoveRequest",    // 请求移除 Buff
            BuffEmitRequest: "Buff_OnBuffEmitRequest",        // 其他模块发生活动时转发给 Buff
        },
        Out: {
            OnBuffAdded: "Buff_OnBuffAdded",                 // Buff 添加后
            OnBuffRefreshed: "Buff_OnBuffRefreshed",         // Buff 刷新后
            OnBuffRemoved: "Buff_OnBuffRemoved",             // Buff 移除后
        },
    },
    Game: {
        In: {
            StartGameRequest: "Game_OnStartGameRequest",                    // 请求开始游戏
            EnterPreparePhaseRequest: "Game_OnEnterPreparePhaseRequest",    // 请求进入准备阶段
            ResetGameRequest: "Game_OnResetGameRequest",                    // 请求重置游戏
            GameWinRequest: "Game_OnGameWinRequest",                        // 请求游戏胜利
            GameLoseRequest: "Game_OnGameLoseRequest",                      // 请求游戏失败
        },
        Out: {
            OnStartGame: "Game_OnStartGame",                // 开始游戏后
            OnEnterPreparePhase: "Game_OnEnterPreparePhase",// 进入准备阶段后
            OnResetGame: "Game_OnResetGame",                // 重置游戏后
            OnGameWin: "Game_OnGameWin",                    // 游戏胜利后
            OnGameLost: "Game_OnGameLost",                  // 游戏失败后
        },
    },
    Hud: {
        In: {
            ShowHudRequest: "Hud_OnShowHudRequest",        // 显示 Hud 请求，payload 包含 {slot: number, pawn: CSPlayerPawn, text: string, channel: number, alwaysVisible?: boolean}
            HideHudRequest: "Hud_OnHideHudRequest",        // 隐藏 Hud 请求，payload 包含 {slot: number, channel?: number}
            StatusUpdateRequest: "Hud_OnStatusUpdateRequest", // 结构化状态更新请求，payload 可包含 { updates: [...], waveSummary: {...}, flags: {...} }
        },
        Out: {
            OnHudShown: "Hud_OnHudShown",                  // Hud 显示后，payload 包含 {slot: number, channel: number, text: string}
            OnHudUpdated: "Hud_OnHudUpdated",              // Hud 文本或渠道更新后，payload 包含 {slot: number, channel: number, text: string, previousChannel?: number}
            OnHudHidden: "Hud_OnHudHidden",                // Hud 隐藏后，payload 包含 {slot: number, channel: number}
        },
    },
    Input: {
        In: {
            StartRequest: "Input_OnStartRequest",          // 请求开始输入检测，payload 包含 {slot: number, pawn: CSPlayerPawn}
            StopRequest: "Input_OnStopRequest",            // 请求停止输入检测，payload 包含 {slot: number}
        },
        Out: {
            OnInput: "Input_OnInput",                      // 输入事件，payload 包含 {slot: number, key: string}
        },
    },
    Monster: {
        In: {
            SpawnRequest: "Monster_OnSpawnRequest",                        // 请求由怪物施法者触发产卵，payload 使用 MonsterSpawnRequest
            BeforeTakeDamageRequest: "Monster_OnBeforeTakeDamageRequest",  // 请求怪物受伤前修正伤害，payload 使用 MonsterBeforeTakeDamageRequest
        },
        Out: {
            OnMonsterSpawn: "Monster_OnMonsterSpawn",            // 怪物创建并注册后，payload 使用 OnMonsterSpawn
            OnMonsterDamaged: "Monster_OnMonsterDamaged",        // 怪物实际扣血后，payload 使用 OnMonsterDamaged
            OnMonsterDeath: "Monster_OnMonsterDeath",            // 怪物死亡后，payload 使用 OnMonsterDeath
            OnAllMonstersDead: "Monster_OnAllMonstersDead",      // 当前波次全部怪物死亡后
            OnAttack: "Monster_OnAttack",                        // 怪物普攻命中后，payload 使用 OnMonsterAttack
        },
    },
    Movement: {
        In: {
            MoveRequest: "Movement_OnMoveRequest",          // 请求移动，payload 使用 MovementRequest
            StopRequest: "Movement_OnStopRequest",          // 请求停止移动，payload 使用 MovementRequest
            RemoveRequest: "Movement_OnRemoveRequest",      // 请求移除 Movement 实例，payload 使用 MovementRequest
        },
        Out: {
            OnRegistered: "Movement_OnRegistered",          // Movement 实例注册后
            OnStopped: "Movement_OnStopped",                // Movement 停止后
            OnRemoved: "Movement_OnRemoved",                // Movement 实例移除后
        },
    },
    Particle: {
        In: {
            CreateRequest: "Particle_OnCreateRequest",      // 粒子特效创建请求
            StopRequest: "Particle_OnStopRequest",          // 粒子特效停止请求
        },
    },
    Player: {
        In: {
            GetPlayerSummaryRequest: "Player_OnGetPlayerSummaryRequest",      // 请求玩家信息摘要，payload 包含 {slot: number, result?: any}
            DispatchRewardRequest: "Player_OnDispatchRewardRequest",          // 请求分发玩家奖励，payload 包含 {slot: number|null, reward?: any, rewards?: any[], result?: boolean}
        },
        Out: {
            OnPlayerJoin: "Player_OnPlayerJoin",                // 玩家加入后，payload 包含 {player: Player, slot: number}
            OnPlayerLeave: "Player_OnPlayerLeave",              // 玩家离开后，payload 包含 {player: Player, slot: number}
            OnPlayerReadyChanged: "Player_OnPlayerReadyChanged",// 玩家准备状态变化后
            OnAllPlayersReady: "Player_OnAllPlayersReady",      // 全员准备后
            OnPlayerDeath: "Player_OnPlayerDeath",              // 玩家死亡后
            OnPlayerRespawn: "Player_OnPlayerRespawn",          // 玩家重生后
            OnPlayerStatusChanged: "Player_OnPlayerStatusChanged", // 玩家数值/状态更新，payload 包含 { player, slot, summary }
        },
    },
    Shop: {
        In: {
            ShopOpenRequest: "Shop_OnShopOpenRequest",      // 请求打开商店，payload 包含 {slot: number, pawn?: CSPlayerPawn, result?: boolean}
            ShopCloseRequest: "Shop_OnShopCloseRequest",    // 请求关闭商店，payload 包含 {slot: number, result?: boolean}
        },
        Out: {
            OnShopOpen: "Shop_OnShopOpen",                  // 商店打开后，payload 包含 {slot: number}
            OnShopClose: "Shop_OnShopClose",                // 商店关闭后，payload 包含 {slot: number}
            OnBought: "Shop_OnBought",                      // 购买商品后，payload 包含 {slot: number, itemId: string, price: number}
        },
    },
    Skill: {
        In: {
            SkillAddRequest: "Skill_OnSkillAddRequest",          // 请求为目标添加技能，payload 使用 SkillAddRequest
            SkillRemoveRequest: "Skill_OnSkillRemoveRequest",    // 请求移除技能，payload 使用 SkillRemoveRequest
            SkillUseRequest: "Skill_OnSkillUseRequest",          // 请求直接触发技能，payload 使用 SkillUseRequest
            SkillEmitRequest: "Skill_OnSkillEmitRequest",        // 请求向技能转发运行时事件，payload 使用 SkillEmitRequest
        },
        Out: {
        },
    },
    Throw: {
        In: {
            CreateRequest: "Throw_OnCreateRequest",         // 请求创建投掷物，payload 使用 ThrowCreateRequest
            StopRequest: "Throw_OnStopRequest",             // 请求停止投掷物，payload 使用 ThrowStopRequest
        },
        Out: {
            OnProjectileCreated: "Throw_OnProjectileCreated",  // 投掷物创建后，payload 使用 OnProjectileCreated
            OnProjectileHit: "Throw_OnProjectileHit",          // 投掷物结束并产生命中结果后，payload 使用 OnProjectileHit
            OnProjectileStopped: "Throw_OnProjectileStopped",  // 投掷物停止后，payload 使用 OnProjectileStopped
        },
    },
    Wave: {
        In: {
            WaveStartRequest: "Wave_OnWaveStartRequest",    // 请求开始波次，payload 包含 {waveIndex: number, playerCount: number}
            WaveEndRequest: "Wave_OnWaveEndRequest",        // 请求结束波次，payload 包含 {waveIndex: number, survived: boolean}
        },
        Out: {
            OnWavePreparing: "Wave_OnWavePreparing",        // 波次进入准备阶段，payload 包含 {waveIndex: number, preparationTime: number, broadcastMessage: string}
            OnWaveStart: "Wave_OnWaveStart",                // 波次开始后，payload 包含 {waveIndex: number}
            OnWaveEnd: "Wave_OnWaveEnd",                    // 波次结束后，payload 包含 {waveIndex: number, survived: boolean}
        },
    },
};
