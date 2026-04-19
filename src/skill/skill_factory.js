/**
 * @module 怪物系统/技能工厂
 */
import { CoreStats } from "./skills/corestats";
import { PounceSkill } from "./skills/pounce";
import { InitAnimSkill } from "./skills/initanim";
import { DoubleAttackSkill } from "./skills/doubleattack";
import { PowerAttackSkill } from "./skills/powerattack";
import { FireSkill } from "./skills/fire";
import { SpawnSkill } from "./skills/spawn";
import { ShieldSkill } from "./skills/shield";
import { ThrowStoneSkill } from "./skills/throwstone";
import { SoundSkill } from "./skills/sound";
import { PlayerPulseSkill } from "./skills/playerpulse";
import { PlayerHealingFieldSkill } from "./skills/playerhealingfield";
import { SentrySkill } from "./skills/sentry/sentry_skill";

/*
技能分类规则（唯一权威）：
  有 animation 参数（非 null）= 有动作：canTrigger 返回 true 后 request 占用当前待执行槽，
    Monster 进入 SKILL 状态，管理器先播放 animation，再调用 trigger()。
  无 animation（null）       = 无动作：canTrigger 内直接执行业务并返回 false。
  cooldown = -1              = 一次性：仅首次触发后永久失效。默认为 -1。
  cooldown = 0               = 无冷却。
  cooldown > 0               = 按秒间隔触发。

实例 id 语义：
  skill.typeId 是技能类型标识（即下方的 id 字段）。
  skill.id 是运行时实例 id，由 MonsterSkillsManager.addSkill 按添加顺序分配，
  id 越小优先级越高。同一怪物可同时拥有多个相同 typeId 的技能实例。

所有技能均支持 params.events（string[]）配置多个触发事件，未提供则使用各技能自身默认。
每个技能均支持可选 animation 参数，不传则默认 null（无动作）。
每个技能均支持可选 cooldown 参数，不传则默认 -1（一次性）。
任何需要显式添加 Buff 的技能，统一只接收 `buffConfigId`；Buff 数值与持续时间由 src/buff/buff_const.js 负责。

技能列表（typeId 均为小写无前缀）：

corestats   基础属性增加（默认 OnSpawn 执行一次，cooldown=-1）
  { health_mult?, health_value?, damage_mult?, damage_value?,
    speed_mult?, speed_value?, reward_mult?, reward_value?,
    cooldown?, events?, animation? }

pounce      飞扑（默认 OnTick 判断距离和冷却）
  { distance: number, cooldown?, events?, animation? }

initanim    初始动画（默认 OnSpawn 一次性）
  { cooldown?, events?, animation? }

doubleattack  双倍攻击（默认 AttackTrue 触发）
  { cooldown?, events?, animation? }

powerattack   重击（默认 AttackTrue 触发，可选给目标追加预配置 Buff，可选补一段额外伤害）
  { cooldown?, events?, animation?, buffConfigId?, bonusDamageMultiplier? }

fire          持续区域效果（怪物默认 Die 触发；玩家默认 InspectWeapon 触发）
  { areaEffectStaticKey?, cooldown?, events?, animation?, inputKey?, zoneDuration?, zoneRadius?, triggerDistance?/distance?, targetTypes? }

shield      能量护盾（默认 [OnSpawn, OnTick]，Spawn 始终保留以初始化修饰器）
  { runtime: number, value: number, cooldown?, events?, animation? }

throwstone  投掷石头（默认 OnTick，距离判定后请求投掷物管理器创建投掷物）
  { distanceMin?, distanceMax?, damage?, projectileSpeed?, gravityScale?,
    radius?, maxTargets?, templateName?, cooldown?, events?, animation? }

sound       怪物声音实体（创建时生成跟随怪物模型的实体，命中事件时设置声音事件并播放）
  { templateName: string, eventSoundMap?: Record<string, string>, cooldown?, events?, animation? }

spawn       事件触发产卵（默认 OnDie）
  { events?, event?(旧单值兼容), count?, typeName?, cooldown?,
    maxSummons?, radiusMin?, radiusMax?, tries?, animation? }

player_guard      玩家守护脉冲（InspectWeapon 触发，加护甲）
player_mend       玩家治疗脉冲（InspectWeapon 触发，回血）
player_mend_field 玩家治疗领域（InspectWeapon 触发，创建跟随玩家的持续回血区域）
player_vanguard   玩家先锋脉冲（InspectWeapon 触发，回血+护甲）
player_turret     玩家哨戒炮台（InspectWeapon 触发，在当前位置部署炮台）
 */
/**
 * 技能工厂。根据 typeId 创建对应的技能实例。
 *
 * 当前支持的 typeId：
 * corestats、pounce、initanim、doubleattack、powerattack、
 * fire、spawn、shield、throwstone、sound、
 * player_guard、player_mend、player_mend_field、player_vanguard、player_turret。
 *
 * 所有技能均支持 `params.events`、`params.animation`、`params.cooldown`。
 * 详细参数见各技能类的 JSDoc。
 */
export const SkillFactory = {
    /**
     * 根据 typeId 创建对应的技能实例。未识别的 id 返回 null。
     * @param {import("../player/player/player.js").Player|null} player 施法玩家
     * @param {import("../monster/monster/monster.js").Monster|null} monster 施法怪物
     * @param {string} typeid 技能类型标识（如 "corestats"、"pounce"）
     * @param {number} id 技能实例 id
     * @param {any} params 技能配置参数
     * @returns {import("./skill_template.js").SkillTemplate|null}
     */
    create(player, monster, typeid, id, params = {}) {
        switch (typeid) {
            case "corestats":
                return new CoreStats(player, monster, id, params);
            case "pounce":
                return new PounceSkill(player, monster, id, params);
            case "initanim":
                return new InitAnimSkill(player, monster, id, params);
            case "doubleattack":
                return new DoubleAttackSkill(player, monster, id, params);
            case "powerattack":
                return new PowerAttackSkill(player, monster, id, params);
            case "fire":
                return new FireSkill(player, monster, id, params);
            case "spawn":
                return new SpawnSkill(player, monster, id, params);
            case "shield":
                return new ShieldSkill(player, monster, id, params);
            case "throwstone":
                return new ThrowStoneSkill(player, monster, id, params);
            case "sound":
                return new SoundSkill(player, monster, id, params);
            case "player_guard":
                return new PlayerPulseSkill(player, monster, "player_guard", id, { inputKey: "InspectWeapon", cooldown: 8, armor: 25, ...params });
            case "player_mend":
                return new PlayerPulseSkill(player, monster, "player_mend", id, { inputKey: "InspectWeapon", cooldown: 8, heal: 35, ...params });
            case "player_mend_field":
                return new PlayerHealingFieldSkill(player, monster, id, { inputKey: "InspectWeapon", cooldown: 10, zoneDuration: 5, zoneRadius: 150, ...params });
            case "player_vanguard":
                return new PlayerPulseSkill(player, monster, "player_vanguard", id, { inputKey: "InspectWeapon", cooldown: 10, heal: 20, armor: 15, ...params });
            case "player_turret":
                return new SentrySkill(player, monster, id, params);
            default:
                return null;
        }
    }
};