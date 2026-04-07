# minidemo

minidemo 是一个运行在 Counter-Strike 2 `cs_script/point_script` 环境里的 PvE 波次脚本工程。仓库里的源码使用原生 JavaScript + JSDoc 编写，通过 Rollup 打包为单入口脚本，再部署到本地 addon 的脚本目录，供地图中的 `point_script` 实体加载。

这个项目不是直接用 Node.js 启动的应用。Node.js 只负责开发期的打包和文档生成，真正的运行时由游戏提供的 `cs_script/point_script` 模块、地图实体、玩家事件和脚本输入组成。

## 项目能做什么

当前主线代码位于 `src/`，围绕一个波次 PvE 玩法组织，主要包含这些模块：

- `game/`：游戏状态、准备阶段、胜负与重置流程
- `wave/`：波次推进、结算与配置查询
- `player/`：玩家生命周期、准备状态、伤害、奖励与摘要同步
- `input/`：输入监听与输入事件分发
- `shop/`：商店会话、翻页、确认、返回和关闭
- `hud/`：HUD 文本显示与同步
- `skill/`：技能管理与技能工厂
- `monster/`：刷怪、怪物生命周期、怪物攻击与死亡回调
- `movement/`：移动请求合并、路径跟随、分离与状态同步
- `navmesh/`：导航网格、A*、漏斗、跳跃链接和瓦片数据
- `buff/`：Buff 添加、刷新、移除与 tick 调度
- `particle/`：粒子创建、销毁和统一 tick
- `areaEffects/`：范围效果、命中结算和持续作用
- `tempContext/`：帧级缓存上下文，减少跨模块重复计算
- `eventBus/`：模块之间的事件通信

主入口是 `src/main.js`。这个文件负责：

1. 设置服务器 cvar。
2. 实例化各个 manager。
3. 绑定跨模块回调。
4. 注册引擎事件和脚本输入。
5. 在统一 think 循环里按固定顺序推进各模块。

如果你要理解项目怎么跑，先看 `src/main.js`，再顺着它读具体模块。

## 目录说明

- `src/`：当前有效源码目录，开发以这里为准。
- `src/main.js`：唯一顶层运行入口，也是跨模块编排中心。
- `output/`：Rollup 打包产物输出目录，默认生成 `output/main.js`。
- `point_script.d.ts`：CS2 `point_script` 的声明文件，为编辑器提供类型提示。
- `tsconfig.json`：为 JavaScript + JSDoc 开启类型检查和编辑器智能提示。
- `rollup.config.js`：打包配置，入口为 `src/main.js`，并将 `cs_script/point_script` 视为外部模块。
- `typedoc.json`：API 文档生成配置，输出到相邻仓库 `../pve-docs/docs`。
- `废弃/`：旧实现或废弃代码，默认只作为历史参考，不应视为当前运行入口。

## 运行方式总览

一个典型的开发闭环是这样的：

1. 在 `src/` 中修改源码。
2. 执行 `npm run build`，将入口打包到 `output/main.js`。
3. 执行 `npm run copy`，把打包结果复制到你的 CS2 addon 目录。
4. 让地图中的 `point_script` 实体加载这份脚本。
5. 在游戏中通过脚本输入、聊天命令或玩家输入触发玩法逻辑。

注意：游戏实际加载的是打包后的单文件，不是 `src/` 里的源文件。所以你改完源码后，必须重新构建并部署，游戏才会看到变化。

## 环境准备

建议至少具备以下环境：

- Windows 开发环境
- Node.js 和 npm
- Counter-Strike 2，本地可用的 addon / 地图开发环境
- 一个会加载 `point_script` 的地图实体或流程

`package.json` 当前内置的复制路径是本机路径：

```json
"copy": "copy \"output\\main.js\" \"D:\\SteamLibrary\\steamapps\\common\\Counter-Strike Global Offensive\\content\\csgo_addons\\minidemo\\scripts\\output\\main.js\""
```

如果你的 Steam 或 addon 目录不在这个位置，先改掉这条脚本，再执行复制命令。

## 安装依赖

首次进入项目后先安装依赖：

```powershell
npm install
```

仓库当前带有 `package-lock.json`，所以优先用 npm 即可。

## 常用命令

### 1. 打包

```powershell
npm run build
```

作用：

- 从 `src/main.js` 开始打包
- 输出到 `output/main.js`
- 保留 `cs_script/point_script` 为外部依赖，由游戏运行时提供

当前构建可以成功完成，但会输出一些警告，例如循环依赖和未使用导入。它们目前不会阻止产物生成。

### 2. 复制到游戏目录

```powershell
npm run copy
```

作用：

- 将 `output/main.js` 复制到你本地 addon 的脚本目录

这一步是把构建结果送到游戏侧，路径不对时最容易失败。

### 3. 一键发布

```powershell
npm run release
```

当前 `release` 脚本实际执行的是：

```powershell
yarn build
yarn copy
```

也就是说：

- 如果你安装了 Yarn，可以直接用它。
- 如果你只用 npm，建议手动执行 `npm run build` 和 `npm run copy`。

### 4. 生成 API 文档

```powershell
npm run typedoc
```

作用：

- 读取当前仓库的源码和 README
- 生成文档到相邻目录 `../pve-docs/docs`

这意味着根目录的 README 不只是项目说明，也会作为文档首页内容来源之一。

## 地图侧如何接入

### point_script 实体

本项目最终要由地图里的 `point_script` 实体加载。通常的接入方式是：

1. 地图中存在一个 `point_script` 实体。
2. 该实体的 `cs_script` 指向打包后的脚本资源。
3. 地图加载并生成该实体后，脚本顶层代码立即执行。
4. 脚本在启动时完成事件注册、模块实例化和 think 循环设置。

`point_script.d.ts` 里附带了 Valve 对 `point_script` 生命周期的说明，包含 `OnScriptInput`、`OnPlayerConnect`、`SetThink` 等接口的含义。

### 已注册的脚本输入

当前主入口负责注册的大部分脚本输入都在 `src/main.js` 中：

- `startGame`：请求开始游戏
- `enterPreparePhase`：进入准备阶段
- `resetGame`：重置整局状态
- `gameWon`：强制触发胜利
- `gameLost`：强制触发失败
- `endWave`：强制结束当前波次
- `startWave`：按调用者实体名后缀解析波次数并开始对应波次
- `ready`：切换玩家准备状态
- `openshop`：打开玩家商店
- `closeshop`：关闭玩家商店

其中 `startWave` 不是直接传波次数字，而是读取触发该输入的调用者实体名，并将最后一个下划线后的片段解析为波次编号。例如实体名类似 `wave_trigger_3`，就会尝试开始第 3 波。

导航网格插件还有单独的脚本输入，位于 navmesh 插件内部，不走这里的主入口注册。

### 聊天与按键输入

除了脚本输入，当前还有两类常用触发方式：

- 聊天命令：`shop` 或 `!shop` 可打开商店
- 玩家输入：`InspectWeapon` 会被主入口转发给玩家逻辑处理

商店内部使用的原始输入键映射为：

- `W -> UP`
- `S -> DOWN`
- `A -> PAGE_PREV`
- `D -> PAGE_NEXT`
- `Use -> CONFIRM`
- `Walk -> BACK`

如果你在调试商店时发现按键无效，先确认你发出的是否是这些原始输入键。

## 运行时流程

脚本被加载后，大致按这个顺序工作：

1. 设置服务器相关 cvar。
2. 创建 `GameManager`、`WaveManager`、`PlayerManager`、`InputManager`、`ShopManager`、`HudManager`、`SkillManager`、`MonsterManager`、`NavMesh`、`MovementManager`、`BuffManager`、`ParticleManager`、`AreaEffectManager` 和临时上下文。
3. 通过 `eventBus` 绑定模块之间的协作逻辑。
4. 注册玩家连接、激活、断开、死亡、伤害、聊天等引擎事件。
5. 通过 `SetThink` 建立统一主循环，默认按约 64 tick 的节奏推进。

当前主循环里模块推进顺序大致是：

1. `input`
2. `player`
3. `wave`
4. `monster`
5. `skill`
6. `movement`
7. `areaEffects`
8. `particle`
9. `buff`
10. `navmesh`
11. `shop`
12. `hud`

调试时如果你遇到“同一帧里谁先更新”的问题，这个顺序很重要。

## 开发约定

为了减少耦合，当前工程有几条非常关键的约定：

- `src/main.js` 是唯一允许集中编排跨模块业务回调的地方。
- 各模块之间尽量不要直接互相 import 业务实现，而是通过 `eventBus` 的 `event.<Module>.In / event.<Module>.Out` 协作。
- 当前有效代码以 `src/` 为准，不要把 `废弃/` 当成正式入口。
- 源码是 JavaScript，但依赖 JSDoc 和 `checkJs` 做静态约束，不是裸写脚本。
- `cs_script/point_script` 只能在游戏运行时提供，不能在 Node.js 下直接执行。

如果你要新增模块联动，通常不是去模块间互相调用，而是：

1. 在对应模块里发出或监听 eventBus 事件。
2. 在 `src/main.js` 里完成跨模块绑定。
3. 重新打包并部署到游戏目录验证。

## 文档与编辑器支持

### 编辑器提示

项目通过下面两份文件提供编辑器支持：

- `point_script.d.ts`
- `tsconfig.json`

它们的作用是：

- 为 `cs_script/point_script` 提供类型声明
- 为 JavaScript 文件开启 `checkJs`
- 让编辑器在写 JSDoc 类型时能给出补全和错误提示

### API 文档

如果你要更新 API 文档：

```powershell
npm run typedoc
```

文档会生成到 `../pve-docs/docs`。如果你改了 README，希望文档站首页同步，就需要重新执行这条命令。

## 常见问题

### 为什么不能直接运行 `node src/main.js`

因为入口依赖 `cs_script/point_script`，这个模块不是 npm 包，而是游戏运行时提供的外部模块。Rollup 打包时也明确把它标记成 external。

### 为什么我改了源码，游戏里没变化

因为游戏加载的是部署后的打包文件，不是 `src/` 原文件。正确流程是：改源码 -> `npm run build` -> `npm run copy` -> 回到游戏验证。

### 为什么 `npm run copy` 失败

最常见原因是你的 CS2 addon 路径和 `package.json` 里的硬编码路径不一致，或者目标目录还不存在。

### 为什么 `npm run release` 不能直接用

因为当前脚本内部写的是 `yarn build && yarn copy`。如果本机没装 Yarn，就改用两步执行，或者自行把脚本改成 npm 版本。

## 推荐阅读顺序

如果你是第一次接手这个仓库，建议按下面顺序看：

1. `src/main.js`，先搞清楚整体编排和事件注册。
2. `game/`、`wave/`、`player/`、`monster/`，理解核心玩法主线。
3. `input/`、`shop/`、`hud/`，理解玩家交互。
4. `movement/`、`navmesh/`，理解怪物移动和寻路。
5. `skill/`、`buff/`、`areaEffects/`、`particle/`，理解战斗扩展点。

如果只是想先把项目跑起来，重点看“环境准备”“常用命令”“地图侧如何接入”这三节即可。