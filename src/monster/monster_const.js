/**
 * @module 怪物系统/脚本全局配置
 */

//===================游戏参数========================
/**
 * 游戏模式开关。
 * - `true`：线性游戏——`!r` 准备后第一波结束自动开启第二波，直到最后。
 * - `false`：观赏模式（ZE 模式）——无准备选项，关闭脚本玩家管理器，由外部 `OnScriptInput` 触发 / 结束指定波次，波次结束后不会自动触发下一波。
 */
//export const linearGame=true;
/** 怪物选取目标的阵营范围。`2` = T，`3` = CT，`5` = T + CT。 */
export const targetTeam=5;
/** 观赏模式下，玩家是否受到怪物基础伤害（直接造成原始伤害，不进行修改）。 */
//export const playerDamage=true;
/** 是否在新回合开始或结束时重置脚本。观赏模式（ZE 模式）推荐开启。 */
//export const clearbyRound=true;
///** 怪物生成点到最近玩家的距离阈值，大于此值则关闭该生成点。`-1` 表示不检测。 */
//export const spawnPointsDistance=-1;
/**
 * 怪物死亡后，是否在死亡动画播放完成时删除模型。
 * - `true`：动画结束后删除模型。
 * - `false`：动画结束后保留模型，不删除。
 */
export const removeModelAfterDeathAnimation=true;
//==================怪物移动相关设置================
/** 世界重力加速度（单位/秒²）。 */
export const gravity=800;
/** 地面摩擦力系数，影响怪物减速效果。 */
//export const friction=6;
/** 怪物可攀爬的最大台阶高度（单位），建议与 NavMesh 设置保持一致。 */
//export const stepHeight=13;
/** 路径节点切换距离——怪物距下一个导航点小于此值时切换到再下一个点。 */
//export const goalTolerance=8;
/** 到达最后一个导航点后的停止距离——距目标小于此值后怪物不再前进。 */
//export const arriveDistance=1;
/** 移动判定阈值——单帧位移小于此值时视为怪物未移动。 */
//export const moveEpsilon=0.5;
/** 卡死判定时间（秒）——连续无移动超过此时长视为怪物卡死。 */
//export const timeThreshold=2;

/** 怪物移动碰撞盒最小角（负半尺寸）。盒子过大容易过不去门，过小则怪物看起来会穿墙。 */
//export const Tracemins={x:-4,y:-4,z:1};
/** 怪物移动碰撞盒最大角（正半尺寸）。 */
//export const Tracemaxs={x:4,y:4,z:4};
/** 地面检测射线向下延伸的距离（单位）。 */
//export const groundCheckDist=8;
/** 每次移动后与碰撞面保持的安全距离（单位）。 */
//export const surfaceEpsilon=4;

/**
 * 怪物状态枚举。
 *
 * 定义了怪物在战斗循环中可能处于的所有状态。
 * Monster 的 `brainState` 组件和 `tickDispatcher` 会根据这些值
 * 决定每帧应该执行的行为（移动、攻击、施法或待机）。
 *
 * 状态流转典型路径：
 * `IDLE → CHASE → ATTACK → CHASE` 或 `IDLE → CHASE → SKILL → CHASE`，
 * 死亡后进入 `DEAD` 终态。
 *
 * - `IDLE` (0)：空闲状态，刚生成或无目标时的默认状态。
 * - `CHASE` (1)：追击状态，正在寻路并移动向目标玩家。
 * - `ATTACK` (2)：攻击状态，到达攻击距离后执行普通攻击动作。
 * - `SKILL` (3)：技能状态，正在施放主动技能，此时移动和普攻被暂停。
 * - `DEAD` (4)：死亡终态，怪物已被击杀，等待清理。
 */
export const MonsterState = {
    IDLE: 0,//空闲
    CHASE: 1,//追人
    ATTACK: 2,//攻击
    SKILL:  3,//技能
    DEAD: 4//死亡
};
/**
 * @typedef {object} OnMonsterSpawn
 * @property {import("./monster/monster").Monster} monster
 */
/**
 * @typedef {object} OnMonsterDeath
 * @property {import("./monster/monster").Monster} monster
 * @property {import("cs_script/point_script").Entity|null|undefined} killer
 * @property {number} moneyReward
 * @property {number} expReward
 */
/**
 * @typedef {object} OnMonsterDamaged
 * @property {import("./monster/monster").Monster} monster
 * @property {number} damage
 * @property {number} previousHealth
 * @property {number} currentHealth
 * @property {import("cs_script/point_script").CSPlayerPawn|null} attacker
 */
/**
 * @typedef {object} OnMonsterAttack
 * @property {import("./monster/monster").Monster} monster
 * @property {number} damage
 * @property {import("cs_script/point_script").CSPlayerPawn} target
 */
/**
 * @typedef {object} MonsterBeforeTakeDamageRequest
 * @property {import("./monster/monster").Monster} monster
 * @property {number} amount
 * @property {import("cs_script/point_script").CSPlayerPawn|null} attacker
 * @property {number|void} result
 */
/**
 * @typedef {object} MonsterSpawnRequest
 * @property {import("./monster/monster").Monster} monster
 * @property {{typeName?: string, radiusMin?: number, radiusMax?: number, tries?: number}} options
 * @property {boolean} result
 */
/**
 * @typedef {object} MonsterSkillAddRequest
 * @property {import("./monster/monster").Monster} monster
 * @property {string} typeId
 * @property {Record<string, any>} params
 * @property {number|null} result
 */
/**
 * @typedef {object} MonsterSkillUseRequest
 * @property {import("./monster/monster").Monster} monster
 * @property {number} skillId
 * @property {Record<string, any>} params
 * @property {boolean} result
 */
/**
 * @typedef {object} MonsterSkillEmitRequest
 * @property {import("./monster/monster").Monster} monster
 * @property {number} skillId
 * @property {string} eventName
 * @property {Record<string, any>} params
 * @property {boolean} result
 */

/**
 * 怪物配置
 * @type {{ [key: string]: import("../util/definition").monsterTypes }} 
 */
export const MonsterType={
    "headcrab_classic":{            
        template_name:"headcrab_classic_template",
        model_name:"headcrab_classic_model",//模型本体，animations播放的是这个模型的动画
        name: "headcrab_classic",
        baseHealth: 210,
        baseDamage: 16,
        speed: 70,
        moneyReward: 150,
        expReward: 24,
        attackdist:80,
        attackCooldown:0.85,
        movementmode:"walk",
        skill_pool:[
            {
                id:"pounce",
                chance: 1,
                params:{ cooldown:5, distance:350, duration:0.5, animation:"pounce" }
            },
            //{
            //    id:"sound",
            //    chance: 1,
            //    params:{ cooldown:5, templateName:"headcrab_classic_sound", eventSoundMap:{ OnSpawn:"Headcrab.Classic.Spawn", OnTakeDamage:"Headcrab.Classic.Hurt" } }
            //},
            //// 示例：同类型技能重复（分别叠加不同属性）
            //{
            //    id:"corestats",
            //    chance: 1,
            //    params:{ health_value:200 }          // 实例 id=0
            //},
            //{
            //    id:"corestats",
            //    chance: 1,
            //    params:{ speed_mult:1.5 }            // 实例 id=1，两个 corestats 独立生效
            //},
            //// 示例：单个技能绑定多个触发事件
            //{
            //    id:"spawn",
            //    chance: 1,
            //    params:{ events:["OnSpawn","OnTakeDamage"], count:1, typeName:"Zombie", maxSummons:3 }
            //},
            //// 示例：有动画的 pounce
            //{
            //    id:"pounce",
            //    chance: 1,
            //    params:{ cooldown:5, distance:500, duration:0.5, animation:"pounce" }
            //},                        触发距离        飞扑时间(小：更快、更平、更像猛扑,大：更慢、更高、更像抛起来再落下)
            //// 示例：无动画的 pounce（在 canTrigger 内直接执行）
            //{
            //    id:"pounce",
            //    chance: 1,
            //    params:{ cooldown:5, distance:500, duration:0.5}  // 无 animation → 无动画直触发
            //},
            //// 示例：护盾
            //{
            //    id: "shield",
            //    chance: 1,
            //    params: { cooldown:15, runtime:-1, value:50 }
            //},
            //// 示例：急速（5秒内速度×1.8，冷却10秒，可选发光）
            //{
            //    id: "speedboost",
            //    chance: 1,
            //    params: { cooldown:10, buffConfigId:"speed_up", glow:{r:255,g:128,b:0} }
            //},
            //// 示例：投掷石头（通过投掷物管理器创建运行时投掷物）
            //{
            //    id: "throwstone",
            //    chance: 1,
            //    params: { cooldown:6, distanceMin:100, distanceMax:500, damage:15, projectileSpeed:600, templateName:"throwstone_projectile_template" }
            //},
            //// 示例：持续激光（trigger 待实现，2秒持续，每0.25秒结算一次）
            //{
            //    id: "laserbeam",
            //    chance: 1,
            //    params: { cooldown:8, distance:400, duration:2, damagePerSecond:30, tickInterval:0.25 }
            //},
            //// 示例：死亡时产卵
            //{
            //    id: "spawn",
            //    chance: 1,
            //    params: { count:1, typeName:"Zombie", maxSummons:3, radiusMin:24, radiusMax:96, tries:6 }
            //}
        ],
        animations:{
            "idle":[
                "headcrab_classic_idle",
                "headcrab_classic_idle_b",
                "headcrab_classic_idle_c"
            ],
            "walk":[
                "headcrab_classic_walk",
                "headcrab_classic_run"
            ],
            "attack":[
                "headcrab_classic_attack_antic_02",
                "headcrab_classic_attack_antic_03",
                "headcrab_classic_attack_antic_04"
            ],
            "skill":[
                "headcrab_classic_attack_antic_02",
                "headcrab_classic_attack_antic_03",
                "headcrab_classic_attack_antic_04"
            ],
            "dead":[
                "headcrab_classic_death_directional_0",
                "headcrab_classic_death_directional_180",
                "headcrab_classic_death_directional_90_left",
                "headcrab_classic_death_directional_90_right"
            ],
            "pounce":[
                "headcrab_classic_jumpattack"
            ]
        }
    },
    //"headcrab_reviver":{            
    //    template_name:"headcrab_reviver_template",
    //    model_name:"headcrab_reviver_model",//模型本体，animations播放的是这个模型的动画
    //    name: "headcrab_reviver",
    //    baseHealth: 240,
    //    baseDamage: 18,
    //    speed: 170,
    //    moneyReward: 210,
    //    expReward: 28,
    //    attackdist:80,
    //    attackCooldown:0.95,
    //    movementmode:"walk",
    //    skill_pool:[
    //        {
    //            id:"pounce",
    //            chance: 1,
    //            params:{ cooldown:5, distance:250, duration:1, animation:"pounce" }
    //        }
    //    ],
    //    animations:{
    //        "idle":[
    //            "rhc_aggro_idle",
    //            "rhc_aggro_idle_twitch_01",
    //            "rhc_sneak_idle_lookaround"
    //        ],
    //        "walk":[
    //            "rhc_scorpion_run_angled"
    //        ],
    //        "attack":[
    //            "rhc_aggro_jumpattack"
    //        ],
    //        "skill":[
    //            "rhc_aggro_jumpattack"
    //        ],
    //        "dead":[
    //            "rhc_die"
    //        ]
    //    }
    //},
    "headcrab_black":{            
        template_name:"headcrab_black_template",
        model_name:"headcrab_black_model",//模型本体，animations播放的是这个模型的动画
        name: "headcrab_black",
        baseHealth: 300,
        baseDamage: 18,
        speed: 160,
        moneyReward: 225,
        expReward: 32,
        attackdist:80,
        attackCooldown:1.05,
        movementmode:"walk",
        skill_pool:[
            {
                id:"pounce",
                chance: 1,
                params:{ cooldown:5, distance:400, duration:1, animation:"pounce" }
            },
            {
                id:"powerattack",
                chance: 1,
                params:{ cooldown:0, buffConfigId:"poison", bonusDamageMultiplier:0 }
            }
        ],
        animations:{
            "idle":[
                "headcrabblack_idlesniff"
            ],
            "walk":[
                "walk_n",
                "headcrabblack_scurry"
            ],
            "attack":[
                "headcrabblack_spitattack"
            ],
            "skill":[
                "headcrabblack_idle_b"
            ],
            "dead":[
                "headcrabblack_dieplaceholder"
            ],
            "pounce":[
                "headcrabblack_jumpattack"
            ]
        }
    },
    "headcrab_armored":{            
        template_name:"headcrab_armored_template",
        model_name:"headcrab_armored_model",//模型本体，animations播放的是这个模型的动画
        name: "headcrab_armored",
        baseHealth: 630,
        baseDamage: 24,
        speed: 55,
        moneyReward: 300,
        expReward: 44,
        attackdist:80,
        attackCooldown:1.0,
        movementmode:"walk",
        skill_pool:[
            {
                id:"pounce",
                chance: 1,
                params:{ cooldown:5, distance:180, duration:1, animation:"pounce" }
            },
            {
                id: "shield",
                chance: 1,
                params: { cooldown:15, runtime:-1, value:50 }
            },
        ],
        animations:{
            "idle":[
                "headcrab_classic_idle",
                "headcrab_classic_idle_b",
                "headcrab_classic_idle_c"
            ],
            "walk":[
                "headcrab_classic_walk",
                "headcrab_classic_run"
            ],
            "attack":[
                "headcrab_classic_attack_antic_02",
                "headcrab_classic_attack_antic_03",
                "headcrab_classic_attack_antic_04"
            ],
            "skill":[
                "headcrab_classic_attack_antic_02",
                "headcrab_classic_attack_antic_03",
                "headcrab_classic_attack_antic_04"
            ],
            "dead":[
                "headcrab_classic_death_directional_0",
                "headcrab_classic_death_directional_180",
                "headcrab_classic_death_directional_90_left",
                "headcrab_classic_death_directional_90_right"
            ],
            "pounce":[
                "headcrab_classic_jumpattack"
            ]
        }
    },
    "headcrab":{            
        template_name:"headcrab_template",
        model_name:"headcrab_model",//模型本体，animations播放的是这个模型的动画
        name: "headcrab",
        baseHealth: 285,
        baseDamage: 22,
        speed: 220,
        moneyReward: 180,
        expReward: 28,
        attackdist:80,
        attackCooldown:0.95,
        movementmode:"walk",
        skill_pool:[
            {
                id:"pounce",
                chance: 1,
                params:{ cooldown:15, distance:800, duration:2, animation:"pounce" }
            }
        ],
        animations:{
            "idle":[
                "headcrab_idle",
                "headcrab_idlesearch"
            ],
            "walk":[
                "headcrab_walk",
                "headcrab_run"
            ],
            "attack":[
                "headcrab_rearup"
            ],
            "skill":[
                "headcrab_jumpflinch"
            ],
            "dead":[
                "headcrab_die"
            ],
            "pounce":[
                "headcrab_jumpattack"
            ]
        }
    },
    "zombie_classic":{            
        template_name:"zombie_classic_template",
        model_name:"zombie_classic_model",//模型本体，animations播放的是这个模型的动画
        name: "zombie_classic",
        baseHealth: 405,
        baseDamage: 24,
        speed: 40,
        moneyReward: 180,
        expReward: 28,
        attackdist:80,
        attackCooldown:2,
        movementmode:"walk",
        skill_pool:[],
        animations:{
            "idle":[
                "ragdoll"
            ],
            "walk":[
                "walk4",
                "a_walk1",
                "a_walk2",
                "a_walk3"
            ],
            "attack":[
                "swatleftmid",
                "swatrightmid",
                "swatleftlow",
                "swatrightlow"
            ],
            "skill":[],
            "dead":[]
        }
    },
    "zombie_fast":{            
        template_name:"zombie_fast_template",
        model_name:"zombie_fast_model",//模型本体，animations播放的是这个模型的动画
        name: "zombie_fast",
        baseHealth: 360,
        baseDamage: 28,
        speed: 180,
        moneyReward: 225,
        expReward: 32,
        attackdist:80,
        attackCooldown:0.92,
        movementmode:"walk",
        skill_pool:[
            {
                id:"pounce",
                chance: 1,
                params:{ cooldown:25, distance:1000, duration:3, animation:"pounce" }
            }
        ],
        animations:{
            "idle":[
                "idle_angry"
            ],
            "walk":[
                "Run"
            ],
            "attack":[
                "BR2_Attack",
                "Melee"
            ],
            "skill":[
                "idle_angry"
            ],
            "dead":[],
            "pounce":[
                "JumpNavMove"
            ]
        }
    },
    "zombie_poison":{            
        template_name:"zombie_poison_template",
        model_name:"zombie_poison_model",//模型本体，animations播放的是这个模型的动画
        name: "zombie_poison",
        baseHealth: 720,
        baseDamage: 28,
        speed: 130,
        moneyReward: 360,
        expReward: 48,
        attackdist:80,
        attackCooldown:1.12,
        movementmode:"walk",
        skill_pool:[
            {
                id:"spawn",
                chance: 1,
                params: { count:1, typeName:"headcrab_black", maxSummons:1, radiusMin:0, radiusMax:48, tries:10 }
            }
        ],
        animations:{
            "idle":[
                "Idle01"
            ],
            "walk":[
                "Run",
                "Walk"
            ],
            "attack":[
                "melee_01"
            ],
            "skill":[],
            "dead":[
                "releasecrab"
            ]
        }
    },
    //"antlion_worker":{            
    //    template_name:"antlion_worker_template",
    //    model_name:"antlion_worker_model",//模型本体，animations播放的是这个模型的动画
    //    name: "antlion_worker",
    //    baseHealth: 630,
    //    baseDamage: 34,
    //    speed: 190,
    //    moneyReward: 390,
    //    expReward: 52,
    //    attackdist:80,
    //    attackCooldown:0.95,
    //    movementmode:"walk",
    //    skill_pool:[],
    //    animations:{
    //        "idle":[
    //            "distractidle01",
    //            "distractidle03",
    //            "idle01"
    //        ],
    //        "walk":[
    //            "runn"
    //        ],
    //        "attack":[
    //            "attack_02",
    //            "attack_03"
    //        ],
    //        "skill":[
    //            "flyattack05all"
    //        ],
    //        "dead":[],
    //        "pounce":[
    //            "flyattack01all",
    //            "flyattack02all"
    //        ]
    //    }
    //},
    "antlion":{            
        template_name:"antlion_template",
        model_name:"antlion_model",//模型本体，animations播放的是这个模型的动画
        name: "antlion",
        baseHealth: 450,
        baseDamage: 30,
        speed: 205,
        moneyReward: 270,
        expReward: 40,
        attackdist:80,
        attackCooldown:0.9,
        movementmode:"walk",
        skill_pool:[],
        animations:{
            "idle":[
                "distractidle01",
                "distractidle03",
                "idle01"
            ],
            "walk":[
                "runn"
            ],
            "attack":[
                "attack_02",
                "attack_03"
            ],
            "skill":[
                "flyattack05all"
            ],
            "dead":[],
            "pounce":[
                "flyattack01all",
                "flyattack02all"
            ]
        }
    },
}