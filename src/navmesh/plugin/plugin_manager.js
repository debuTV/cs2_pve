/**
 * @module 导航网格/插件管理器
 */
import { Instance } from "cs_script/point_script";
import { NVpluginStaticData } from "./plugin_static";
import { StaticData } from "../path_navemeshstatic";
import { TILE_OPTIMIZATION_1 } from "../path_const";
import { Tool } from "../util/tool";
import { JumpLinkBuilder } from "../path_jumplinkbuild";
/** @typedef {import("../path_tilemanager").TileManager} TileManager */
/** @typedef {import("../path_tile").tile} tile */
/** @typedef {import("../path_manager").NavMesh} NavMesh */
/** @typedef {import("../path_tilemanager").TileData} TileData */
/**
 * NavMesh 插件管理器。
 *
 * 支持动态 Tile 的添加 / 设置和增量更新。
 * 处理 `navmesh_地名_坐标` 命名规则的 Tile 预生成与加载，
 * 支持异步延迟更新窗口和导航数据存档导入导出。
 *
 * @navigationTitle NavMesh 插件
 */
export class NVplugin {
    /**
     * 初始化 NavMesh 插件，绑定所属 NavMesh 实例。
     * @param {NavMesh} nav
     */
    constructor(nav) {
        /** @type {NavMesh} 所属 NavMesh 实例 */
        this.nav=nav;
        //aaabbccc_1_2,tiledata
        //aaabbccc_2_2,tiledata
        /** @type {Map<string, TileData>} 备选 Tile 数据集（key = "场景名_tx_ty"） */
        this.tiles = new Map();
        /** @type {Map<string, TileData>} 默认 Tile 数据集，用于恢复 / 回滚 */
        this.deftiles=new Map();
        /** @type {number} 当前 tick 更新阶段（0~5 状态机） */
        this.up=0;
        /**
         * 等待应用的 Tile 更新队列。
         * 每个元素包含 Tile ID 和对应的 TileData。
         * @type {{name:string, td: TileData; }[]}
         */
        this.updata=[];
        /** @type {TileManager} Tile 管理器引用 */
        this.tileManager;
        this.importNavData(new NVpluginStaticData().Data,new StaticData().Data);
    }
    /**
     * 初始化插件管理器，注册 addtile / settile 脚本输入事件监听。
     *
     * `addtile`：按实体名 `navmesh_场景_tx-ty` 触发动态 Tile 构建并导出。
     * `settile`：按同样命名规则触发 Tile 替换（default 场景使用回滚数据）。
     *
     * @param {TileManager} tilemanager - Tile 管理器
     * @param {tile} tile - Tile 构建器
     */
    init(tilemanager,tile)
    {
        this.tileManager = tilemanager;

        /** @type {tile} Tile 构建器，用于按坐标动态生成 TileData */
        this.tile=tile;
        
        Instance.OnScriptInput("addtile",(e)=>{
            Instance.Msg("addtile");
            if(!e.caller)return;
            let name=e.caller?.GetEntityName();
            if (!name.startsWith("navmesh_")) return;
            const sp=name.split("_");
            if(sp.length<3)return;
            this.addTile(sp[1],sp.slice(2));
        });
        Instance.OnScriptInput("settile",(e)=>{
            if(!e.caller)return;
            let name=e.caller?.GetEntityName();
            if (!name.startsWith("navmesh_")) return;
            const sp=name.split("_");
            if(sp.length<3)return;
            if(sp[1]=="default")this.setTile(sp[1],sp.slice(2),true);
            else this.setTile(sp[1],sp.slice(2));
        });
    }
    /**
     * 导出导航网格数据为文本字符串
     */
    exportNavData() {
        const charsPerLine = 500;
        const data = {
            tiles: Array.from(this.tiles, ([key, td]) => [key, Tool._compactTileData(td)])
        };

        // 使用 JSON 序列化
        const jsonStr = JSON.stringify(data);
        // 2. 将字符串切割成指定长度的块
        Instance.Msg("--- NAV DATA START ---");
        for (let i = 0; i < jsonStr.length; i += charsPerLine) {
            Instance.Msg("+`"+jsonStr.substring(i, i + charsPerLine)+"`");
        }
        Instance.Msg("--- NAV DATA END ---");
    }
    /**
     * 从 JSON 字符串恢复导航网格数据。
     *
     * 将普通对象转为 TypedArray 结构后分别存入 `tiles` 和 `deftiles`。
     * `jsonStr` 为备选数据；`defaultJsonStr` 为默认回滚数据。
     *
     * @param {string} jsonStr - 备选场景的序列化 JSON
     * @param {string} defaultJsonStr - 默认场景的序列化 JSON
     * @returns {boolean} 加载是否成功
     */
    importNavData(jsonStr, defaultJsonStr) {
        try {
            const cleanJson = jsonStr.replace(/\s/g, "");
            if(cleanJson.length==0)throw new Error("空数据");
            const data = JSON.parse(cleanJson);
            for (const [key,value] of data.tiles) {
                const mesh = Tool.toTypedMesh(value.mesh);
                const detail = Tool.toTypedDetail(value.detail);
                const links = Tool.toTypedLinks(value.links);
                value.mesh=mesh;
                value.detail=detail;
                value.links=links;
                this.tiles.set(key, value);
            }

            const dfcleanJson = defaultJsonStr.replace(/\s/g, "");
            if(dfcleanJson.length==0)throw new Error("空数据");

            const dfdata = JSON.parse(dfcleanJson);

            for (const [key,value] of dfdata.tiles) {
                const mesh = Tool.toTypedMesh(value.mesh);
                const detail = Tool.toTypedDetail(value.detail);
                const links = Tool.toTypedLinks(value.links);
                value.mesh=mesh;
                value.detail=detail;
                value.links=links;
                this.deftiles.set(value.tileId, value);
            }
            Instance.Msg(`加载备选数据成功！`);
            return true;
        } catch (e) {
            Instance.Msg(`加载备选数据失败: ${e}`);
            return false;
        }
    }
    /**
     * 构建并缓存指定位置的 Tile 数据，然后导出完整导航数据。
     *
     * 解析 key 数组中的 "tx_ty" / "tx-ty" 字符串，逐个调用 tile.buildTile，
     * 结果存入 `this.tiles`（key 格式 "场景名_tx_ty"）。
     *
     * @param {string} name - 场景名称
     * @param {string[]} key - Tile 坐标字符串数组（如 ["2_3", "4_5"]）
     */
    addTile(name,key)
    {
        if(!this.tile)return;
        for(let k of key)
        {
            k=k.replace("-","_");
            const tx=parseInt(k.split("_")[0]);
            const ty=parseInt(k.split("_")[1]);
            //这里获取数据
            this.tiles.set(name+"_"+k,this.tile.buildTile(tx, ty));
        }
        this.exportNavData();
    }
    /**
     * 每帧驱动的增量更新状态机。
     *
     * 将 Tile 替换拆分为 5 个阶段（每阶段 ≤7ms），避免单帧卡顿：
     * - 0：检查是否有待更新数据
     * - 1：移除旧 Tile、追加新 Tile 数据
     * - 2：收集受影响 Tile 的边连接信息
     * - 3：重建跨 Tile 跳跃链接
     * - 4：合并链接、裁剪不可达多边形、刷新运行时
     */
    tick()
    {
        switch(this.up)
        {
            case 0:
                if(this.updata.length!=0)this.up=1;
                break;
            case 1:
                //5ms;
                this.tileManager.removetile(this.updata[0].name);
                const td=this.updata[0].td;
                this.tileManager.tiles.set(td.tileId, {
                    tileId: td.tileId,
                    tx: td.tx,
                    ty: td.ty,
                    mesh: td.mesh,
                    detail: td.detail,
                    links: td.links
                });
                this.tileManager._appendTileData(td.tileId, td.mesh, td.detail, td.links);
                this.up++;
                break;
            case 2:
                //1ms
                const { edgeCount, result, tilemark } = this.tileManager.getedgebytileid(this.updata[0].name);
                this.edgeCount=edgeCount;
                this.result=result;
                this.tilemark=tilemark;
                this.up++;
                break;
            case 3:
                //7ms
                if(this.edgeCount&&this.result&&this.tilemark)this.tileManager.Extlink = new JumpLinkBuilder(this.tileManager.mesh).initInterTileIn(this.edgeCount,this.result,this.tilemark,this.tileManager.Extlink);
                this.up++;
                break;
            case 4:
                Tool.buildSpatialIndex(this.tileManager.mesh);
                this.tileManager.supprlink= this.tileManager.buildSupperLinksForMesh(this.tileManager.mesh);
                let merged = this.tileManager.copyLinks(this.tileManager.baseLinks, this.tileManager.Extlink);
                merged = this.tileManager.copyLinks(merged, this.tileManager.supprlink);
                this.tileManager.links = merged;
                if(TILE_OPTIMIZATION_1)this.tileManager.pruneUnreachablePolys();
                this.tileManager.updatemesh();
                this.nav._refreshRuntime();
                this.updata.shift();
                this.up++;
                break;
            default:
                this.up=0;
                break;
        }
    }
    /**
     * 将指定 Tile 加入更新队列，下一帧通过 tick() 逐步应用。
     *
     * - `pre=true`（name=="default"）：使用 `deftiles` 中的默认数据进行回滚。
     * - `pre=false`：使用 `tiles` 中已缓存的数据；若缺失则先调用 addTile 构建。
     *
     * @param {string} name - 场景名称
     * @param {string[]} key - Tile 坐标字符串数组
     * @param {boolean} [pre=false] - 是否恢复默认设置
     */
    setTile(name,key,pre=false)
    {
        if(!this.tileManager)return;
        if(pre)
        {   //2-3->2_3
            for(let k of key)
            {
                k=k.replace("-","_");
                const td=this.deftiles.get(k);
                if(!td)continue;
                //这里替换数据
                this.updata.push({name:k,td:td});
            }
        }
        else
        {
            for(let k of key)
            {
                k=k.replace("-","_");
                let td=this.tiles.get(name+"_"+k);
                if(!td)
                {//没有数据，必定是开发环境
                    this.addTile(name,[k]);
                    td=this.tiles.get(name+"_"+k);
                }
                if(!td)continue;
                //这里替换数据
                this.updata.push({name:k,td:td});
            }
        }
    }
}
