import {Wa as jsx,Ga as jsxs,wo as useState,ho as useEffect} from './vendor-frame-fwUVJbeJ.js';

const reasons={ssh_failed:'SSH 连接失败，请确认服务器可以连接。',remote_auth:'远端订阅登录已失效，请检查服务器上的 Claude Code 登录状态。',
  network:'服务器暂时无法查询官方用量接口。',rate_limited:'官方用量查询暂时限流，请稍后再试。',
  invalid_response:'未取得有效额度数据。',missing_credentials:'服务器上未找到可用的订阅登录状态。'};
const dateFormat=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
const timeFormat=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
function meter(key,label,value){
  if(!value)return jsxs('div',{className:'text-footnote text-muted-as-secondary',children:[label,'：暂不可用']},key);
  const percent=Math.round(value.utilization*10)/10;
  return jsxs('div',{style:{display:'flex',flexDirection:'column',gap:5},children:[
    jsxs('div',{style:{display:'flex',justifyContent:'space-between',gap:16},children:[jsx('span',{children:label}),jsx('span',{style:{fontVariantNumeric:'tabular-nums'},children:`已用 ${percent}% · 剩余 ${Math.max(0,Math.round((100-percent)*10)/10)}%`})]}),
    jsx('div',{role:'progressbar','aria-label':label,'aria-valuenow':Math.min(100,percent),'aria-valuemin':0,'aria-valuemax':100,
      style:{height:5,borderRadius:4,background:'var(--cds-border-strong)',overflow:'hidden'},children:jsx('div',{style:{height:'100%',width:`${Math.min(100,percent)}%`,background:'var(--cds-fill-accent)',borderRadius:4}})}),
    jsx('span',{className:'text-footnote text-muted-as-secondary',children:value.resets_at?`重置：${dateFormat.format(new Date(value.resets_at))}（北京时间）`:'重置时间暂不可用'})]},key);
}

export function OracleRemoteUsage({sessionRef}){
  const id=sessionRef?.id??null;
  const [state,setState]=useState({id,data:null,loading:!!id});
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    if(!id){setState({id,data:null,loading:false});return;}
    let cancelled=false;
    const controller=new AbortController();
    const load=async()=>{
      setState({id,data:null,loading:true});
      try{
        const url=new URL('/api/oracle-trial/usage',window.location.href);
        url.searchParams.set('session_id',id);
        const result=await fetch(url,{signal:controller.signal,cache:'no-store'});
        const data=result.ok?await result.json():{status:'error',reason:'network'};
        if(!cancelled)setState({id,data,loading:false});
      }catch{if(!cancelled)setState({id,data:{status:'error',reason:'network'},loading:false});}
    };
    load();
    const timer=setInterval(load,300000);
    return()=>{cancelled=true;clearInterval(timer);controller.abort();};
  },[id,refresh]);
  if(!id||state.id!==id||state.data?.status==='not_applicable')return null;
  const data=state.data,ok=data?.status==='ok';
  const plan=ok&&data.subscription?({pro:'Pro',max:'Max',team:'Team',enterprise:'Enterprise'}[data.subscription]??'')+' 订阅':'订阅用量';
  return jsxs('section',{'data-testid':'oracle-remote-usage','aria-label':'远端订阅用量',className:'text-footnote',
    style:{padding:'14px 16px',borderBottom:'1px solid var(--cds-border-strong)',display:'flex',flexDirection:'column',gap:12},children:[
    jsxs('div',{style:{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12},children:[
      jsx('strong',{children:`远端 · ${plan}`}),
      jsx('button',{type:'button',disabled:state.loading,onClick:()=>setRefresh(n=>n+1),'aria-label':'刷新远端订阅用量',
        className:'text-footnote text-muted-as-secondary',style:{cursor:state.loading?'default':'pointer',padding:'2px 4px'},children:state.loading?'查询中…':'刷新'})]}),
    jsx('span',{className:'text-footnote text-muted-as-secondary',children:'账号共享额度 · 通过服务器查询'}),
    state.loading?jsx('span',{role:'status',children:'正在读取远端订阅额度…'}):ok?
      jsxs('div',{style:{display:'flex',flexDirection:'column',gap:12},children:[
        meter('five_hour','5 小时额度',data.windows.five_hour),meter('seven_day','每周额度',data.windows.seven_day),
        jsx('span',{className:'text-footnote text-muted-as-secondary',children:`更新于 ${timeFormat.format(new Date(data.queried_at))} · 1 分钟内复用结果`}),
        data.extra_usage_enabled===false?jsx('span',{className:'text-footnote text-muted-as-secondary',children:'额外用量：未开启'}):null]}):
      jsx('span',{role:'status',children:reasons[data?.reason]??'暂时无法查询远端额度，请稍后刷新。'})]});
}
