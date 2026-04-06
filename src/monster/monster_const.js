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
/** 怪物生成点到最近玩家的距离阈值，大于此值则关闭该生成点。`-1` 表示不检测。 */
export const spawnPointsDistance=-1;
/** 怪物死亡后是否留下尸体。开启后尸体将永远不会被脚本删除。 */
export const monstercorpse=true;
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
 * 怪物事件类型常量。
 *
 * 收录怪物技能内部事件名称字符串。
 * 使用统一常量替代散落的字符串，防止拼写错误导致事件丢失。
 *
 * 事件按职责分为四组：
 * - **生命周期**：生成（Spawn）、死亡（Die）、模型移除（ModelRemove）。
 * - **战斗**：受伤（TakeDamage）、攻击命中（AttackTrue）、攻击未命中（AttackFalse）。
 * - **AI**：每帧心跳（Tick）、目标更新（TargetUpdate）。
 * - **技能**：技能施放（SkillCast）。
 *
 */
export const MonsterBuffEvents = {
    // 生命周期
    Spawn:        "OnSpawn",
    Die:          "OnDie",
    ModelRemove:  "OnModelRemove",
    // 战斗
    BeforeTakeDamage: "BeforeTakeDamage", // 受伤前事件，允许修改伤害
    TakeDamage:   "OnTakeDamage",        // 受伤后事件，提供最终伤害值
    AttackTrue:   "OnAttackTrue",
    AttackFalse:  "OnAttackFalse",
    // AI
    Tick:         "OnTick",
    TargetUpdate: "OnupdateTarget",
    // 技能施放（领域总线键）
    SkillCast:    "OnSkillCast",
};

/**
 * @typedef {object} OnMonsterSpawn
 * @property {import("./monster/monster").Monster} monster
 */
/**
 * @typedef {object} OnMonsterDeath
 * @property {import("./monster/monster").Monster} monster
 * @property {import("cs_script/point_script").Entity|null|undefined} killer
 * @property {number} reward
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
    "Zombie":{            
            template_name:"headcrab_classic_template",
            model_name:"headcrab_classic_model",//模型本体，animations播放的是这个模型的动画
            name: "Zombie",
            baseHealth: 100,
            baseDamage: 10,
            speed: 150,
            reward: 100,
            attackdist:80,
            attackCooldown:0.1,
            movementmode:"walk",
            skill_pool:[
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
                //    params:{ cooldown:5, distance:250, animation:"pounce" }
                //},
                //// 示例：无动画的 pounce（在 canTrigger 内直接执行）
                //{
                //    id:"pounce",
                //    chance: 1,
                //    params:{ cooldown:10, distance:400 }  // 无 animation → 无动画直触发
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
                //    params: { cooldown:10, runtime:5, speed_mult:1.8, glow:{r:255,g:128,b:0} }
                //},
                //// 示例：投掷石头（trigger 待实现）
                //{
                //    id: "throwstone",
                //    chance: 1,
                //    params: { cooldown:6, distanceMin:100, distanceMax:500, damage:15, projectileSpeed:600 }
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
                "pounce":[
                    "headcrab_classic_jumpattack"
                ]
            }
        }
}