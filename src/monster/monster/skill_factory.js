/**
 * @module 怪物系统/技能工厂
 */
import { CoreStats } from "./skills/corestats";
import { PounceSkill } from "./skills/pounce";
import { InitAnimSkill } from "./skills/initanim";
import { DoubleAttackSkill } from "./skills/doubleattack";
import { PowerAttackSkill } from "./skills/powerattack";
import { PoisonGasSkill } from "./skills/poisongas";
import { SpawnSkill } from "./skills/spawn";
import { ShieldSkill } from "./skills/shield";
import { SpeedBoostSkill } from "./skills/speedboost";
import { ThrowStoneSkill } from "./skills/throwstone";
import { LaserBeamSkill } from "./skills/laserbeam";
import { SkillTemplate } from "./skill_manager";
/*
技能分类规则（唯一权威）：
  有 animation 参数（非 null）= 有动作：canTrigger 返回 true 后 request 入队，
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

powerattack   重击（默认 AttackTrue 触发，可击飞玩家）
  { cooldown?, events?, animation? }

poisongas     毒气（默认 Die 触发，可释放毒气粒子）
  { cooldown?, events?, animation? }

shield      能量护盾（默认 [OnSpawn, OnTick]，Spawn 始终保留以初始化修饰器）
  { runtime: number, value: number, cooldown?, events?, animation? }

speedboost  急速（默认 OnTick，临时提升移动速度，超时后恢复）
  { runtime: number, speed_mult?, speed_value?, cooldown?, events?, animation?,
    glow?: {r,g,b} }

throwstone  投掷石头（默认 OnTick，距离判定后投掷，trigger 待实现）
  { distanceMin?, distanceMax?, damage?, projectileSpeed?, gravityScale?,
    radius?, maxTargets?, cooldown?, events?, animation? }

laserbeam   发射激光（默认 OnTick，distance 内判定，trigger 待实现）
  { distance?, duration?, damagePerSecond?, tickInterval?, width?,
    pierce?, maxTargets?, startDelay?, cooldown?, events?, animation? }

spawn       事件触发产卵（默认 OnDie）
  { events?, event?(旧单值兄容), count?, typeName?, cooldown?,
    maxSummons?, radiusMin?, radiusMax?, tries?, animation? }
 */
/**
 * 技能工厂。根据 typeId 创建对应的技能实例。
 *
 * 当前支持的 typeId：
 * corestats、pounce、initanim、doubleattack、powerattack、
 * poisongas、spawn、shield、speedboost、throwstone、laserbeam。
 *
 * 所有技能均支持 `params.events`、`params.animation`、`params.cooldown`。
 * 详细参数见各技能类的 JSDoc。
 */
export const SkillFactory = {
    /**
     * 根据 typeId 创建对应的技能实例。未识别的 id 返回 null。
     * @param {import("./monster").Monster} monster 所属怪物实例
     * @param {string} id 技能类型标识（如 "corestats"、"pounce"）
     * @param {any} params 技能配置参数
     * @returns {SkillTemplate|null}
     */
    create(monster,id, params) {
        switch (id) {
            case "corestats":
                return new CoreStats(monster, params);
            case "pounce":
                return new PounceSkill(monster, params);
            case "initanim":
                return new InitAnimSkill(monster, params);
            case "doubleattack":
                return new DoubleAttackSkill(monster, params);
            case "powerattack":
                return new PowerAttackSkill(monster, params);
            case "poisongas":
                return new PoisonGasSkill(monster, params);
            case "spawn":
                return new SpawnSkill(monster, params);
            case "shield":
                return new ShieldSkill(monster, params);
            case "speedboost":
                return new SpeedBoostSkill(monster, params);
            case "throwstone":
                return new ThrowStoneSkill(monster, params);
            case "laserbeam":
                return new LaserBeamSkill(monster, params);
            default:
                return null;
        } 
    }
};