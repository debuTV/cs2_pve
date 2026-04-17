import { Instance } from "cs_script/point_script";
const start = new Date().getTime();
let s=Instance.GetGameTime();
for(let i=0;i<10000000;i++){
    if(s<0)Instance.Msg("1111");
}
const end = new Date().getTime();
Instance.Msg(`total time: ${end - start} ms`);