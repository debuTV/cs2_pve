# Minidemo Scripts API

这个站点用于展示 minidemo 脚本工程中可复用的模块 API，重点覆盖玩家、怪物、Buff、粒子和导航相关代码。

## 文档范围

- 入口目录：src/class
- 主要输出：类、常量、工厂、事件总线、工具函数
- 不包含：调试启动脚本和运行时 side-effect 入口文件

## 模块概览

### 玩家系统

玩家系统采用聚合根加组件的结构，核心入口包括：

- Player：单玩家聚合根
- PlayerManager：在线玩家生命周期与引擎事件桥接
- BuffFactory / PlayerBuffManager：Buff 创建、叠层和 tick 调度

### 怪物系统

怪物系统负责刷怪、状态机、技能和移动：

- Monster：单怪物实体行为聚合
- MonsterManager：怪物集合调度与领域事件转发
- SpawnService / PathScheduler：刷怪与寻路调度

### 导航系统

导航模块提供从体素化到路径拉直的一整套实现：

- NavMesh：导航网格管理入口
- PolyGraphAStar：A* 搜索
- FunnelPath / FunnelHeightFixer：路径拉直与高度修正
- TileManager：瓦片化网格数据管理

### 运行辅助

- Particle：粒子对象与全局 tick
- game_const：全局游戏配置
- vector / game_sleep：通用工具模块

## 推荐阅读顺序

1. 先看 PlayerManager 和 MonsterManager，理解顶层调度边界。
2. 再看 Player 与 Monster，理解单实体聚合结构。
3. 最后进入 buffs、skills、movement、navmesh 等子模块。

## 说明

本首页是文档导航页，不替代详细设计文档。更完整的模块职责说明可参考 PROJECT_MODULES_GUIDE.md。