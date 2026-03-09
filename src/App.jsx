import { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend } from "recharts";

// ══════════════════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════════════════
const BRANDS = [
  {id:"goldbet", name:"Goldbet", color:"#B45309",bg:"#FFFBEB",emoji:"🥇"},
  {id:"ultrabet",name:"Ultrabet",color:"#6D28D9",bg:"#F5F3FF",emoji:"⚡"},
  {id:"boostbet",name:"BoostBet",color:"#B91C1C",bg:"#FEF2F2",emoji:"🚀"},
  {id:"allbets", name:"AllBets", color:"#065F46",bg:"#ECFDF5",emoji:"🎯"},
  {id:"betgold", name:"BetGold", color:"#C2410C",bg:"#FFF7ED",emoji:"💰"},
  {id:"techdev", name:"TechDev", color:"#1E40AF",bg:"#EFF6FF",emoji:"💻"},
];
const BRAND_TABS  = ["Reporting","Compliance","Accounting"];
const PRIORITIES  = [{key:"low",label:"Low"},{key:"medium",label:"Medium"},{key:"high",label:"High"},{key:"urgent",label:"Urgent"}];
const CATEGORIES  = ["Reporting","Compliance","Accounting","Payroll"];
const RECURRENCE  = [{key:"",label:"None"},{key:"daily",label:"Daily"},{key:"weekly",label:"Weekly"},{key:"monthly",label:"Monthly"}];
const PIN_COLORS  = ["#FFF9C4","#FFEEBA","#FFE0E0","#E0F4E0","#E0E8FF","#F3E8FF","#FFF0E0","#E0F8F8"];
const MONTHS      = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS    = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const STORAGE_KEY = "prodash_v6";
const KANBAN_COLS = ["todo","inprogress","done"];
const KANBAN_LABELS = {todo:"To Do",inprogress:"In Progress",done:"Done"};
const POMODORO_MINS = 25;
const healthGrade = (rate, overdue, total) => {
  if(!total) return {grade:"—",color:"#9099B8",label:"No data"};
  const s = Math.max(0, rate - (overdue * 15));
  if(s>=85) return {grade:"A",color:"#059669",label:"Excellent"};
  if(s>=70) return {grade:"B",color:"#2563EB",label:"Good"};
  if(s>=50) return {grade:"C",color:"#D97706",label:"Fair"};
  if(s>=30) return {grade:"D",color:"#F97316",label:"Poor"};
  return {grade:"F",color:"#DC2626",label:"Critical"};
};
const taskAgeDays = (createdAt) => (Date.now() - new Date(createdAt)) / 86400000;
const fmtSecs = s => { const m=Math.floor(s/60),ss=s%60; return String(m).padStart(2,"0")+":"+String(ss).padStart(2,"0"); };
const loadStreak = () => { try{return JSON.parse(localStorage.getItem("prodash_streak")||"{}")||{};}catch{return{};} };
const saveStreakLS = s => localStorage.setItem("prodash_streak", JSON.stringify(s));
const NAV_ITEMS = [
  {id:"dashboard",icon:"◈",label:"Dashboard"},
  {id:"warroom",  icon:"⚔",label:"War Room"},
  {id:"timelog",  icon:"◷",label:"Time Log"},
  {id:"analytics",icon:"◉",label:"Analytics"},
  {id:"calendar", icon:"◫",label:"Calendar"},
  {id:"pinboard", icon:"◆",label:"Pin Board"},
  {id:"ai",       icon:"◎",label:"AI Assistant"},
];
const LOG_TYPES = {
  task_added:   {color:"#2563EB",label:"Task Added"},
  task_done:    {color:"#059669",label:"Completed"},
  task_deleted: {color:"#DC2626",label:"Deleted"},
  note_added:   {color:"#D97706",label:"Note Added"},
  note_deleted: {color:"#9CA3AF",label:"Note Deleted"},
  reminder_set: {color:"#7C3AED",label:"Reminder Set"},
  timer_start:  {color:"#0891B2",label:"Timer Started"},
  timer_stop:   {color:"#059669",label:"Timer Stopped"},
  session_start:{color:"#6B7280",label:"Session"},
  ai_insight:   {color:"#4F46E5",label:"AI Insight"},
  bulk_action:  {color:"#F59E0B",label:"Bulk Action"},
  recurring:    {color:"#059669",label:"Recurring"},
  recurring:    {color:"#059669",label:"Recurring"},
};

// ══════════════════════════════════════════════════════════
//  SUPABASE
// ══════════════════════════════════════════════════════════
const SB_URL  = "https://qkuhrlmbkicggnkogdew.supabase.co";
const SB_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrdWhybG1ia2ljZ2dua29nZGV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMjE5ODUsImV4cCI6MjA4ODU5Nzk4NX0.ypH5J0rLzIuedEEgTJ5F2ZL9Okl_QI2hG-CioTvybhk";
const SB_HDR  = {"Content-Type":"application/json","apikey":SB_KEY,"Authorization":`Bearer ${SB_KEY}`};

const sbLoad = async () => {
  try {
    const res  = await fetch(`${SB_URL}/rest/v1/prodash_data?id=eq.main&select=data`,{headers:SB_HDR});
    const rows = await res.json();
    if (rows&&rows[0]?.data) {
      const p=rows[0].data;
      return {tasks:p.tasks||{},notes:p.notes||[],reminders:p.reminders||[],uploads:p.uploads||{},timelog:p.timelog||[],aiInsights:p.aiInsights||{},templates:p.templates||[],meta:p.meta||{createdAt:nowISO()}};
    }
    return emptyData();
  } catch { return emptyData(); }
};
const sbSave = async (d) => {
  try {
    await fetch(`${SB_URL}/rest/v1/prodash_data`,{
      method:"POST",
      headers:{...SB_HDR,"Prefer":"resolution=merge-duplicates"},
      body:JSON.stringify({id:"main",data:d,updated_at:nowISO()}),
    });
  } catch(e){console.warn("Supabase save failed:",e);}
};

// ══════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════
const uid         = () => `${Date.now()}_${Math.random().toString(36).substr(2,7)}`;
const todayStr    = () => new Date().toISOString().split("T")[0];
const nowISO      = () => new Date().toISOString();
const fmtDate     = (d) => d?new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"";
const fmtTime     = (d) => d?new Date(d).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}):"";
const fmtDateTime = (d) => d?`${fmtDate(d)} ${fmtTime(d)}`:"";
const fmtDur      = (ms) => { if(!ms||ms<0) return "0m"; const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000); return h?`${h}h ${m}m`:`${m}m`; };
const emptyData   = () => ({tasks:{},notes:[],reminders:[],uploads:{},timelog:[],aiInsights:{},templates:[],meta:{createdAt:nowISO()}});
const loadLocal   = () => { try{const r=localStorage.getItem(STORAGE_KEY); if(!r) return emptyData(); const p=JSON.parse(r); return {tasks:p.tasks||{},notes:p.notes||[],reminders:p.reminders||[],uploads:p.uploads||{},timelog:p.timelog||[],aiInsights:p.aiInsights||{},templates:p.templates||[],meta:p.meta||{createdAt:nowISO()}};} catch{return emptyData();}};
const saveLocal   = (d) => { try{localStorage.setItem(STORAGE_KEY,JSON.stringify(d));}catch{} };

// ══════════════════════════════════════════════════════════
//  TOAST HOOK
// ══════════════════════════════════════════════════════════
function useToast() {
  const [toasts,setToasts]=useState([]);
  const show=useCallback((msg,type="success")=>{
    const id=uid();
    setToasts(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3500);
  },[]);
  return {toasts,show};
}

// ══════════════════════════════════════════════════════════
//  CONFETTI
// ══════════════════════════════════════════════════════════
function Confetti() {
  const pts = Array.from({length:80},(_,i)=>({
    id:i, x:Math.random()*100,
    color:["#2563EB","#059669","#D97706","#7C3AED","#DC2626","#F59E0B","#EC4899"][Math.floor(Math.random()*7)],
    delay:Math.random()*0.6, dur:1.4+Math.random()*1.2, size:5+Math.random()*8, shape:Math.random()>0.5?"50%":"3px",
  }));
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:1000,overflow:"hidden"}}>
      {pts.map(p=>(
        <div key={p.id} style={{position:"absolute",left:p.x+"%",top:-20,width:p.size,height:p.size,
          background:p.color,borderRadius:p.shape,
          animation:`confetti-fall ${p.dur}s ${p.delay}s ease-in forwards`}}/>
      ))}
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
        <div style={{fontSize:56,animation:"confetti-pop .5s ease-out"}}>🎉</div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  FOCUS MODE OVERLAY
// ══════════════════════════════════════════════════════════
function FocusOverlay({task,secs,running,onToggle,onReset,onDone,onExit,elapsed}) {
  const total=POMODORO_MINS*60, pct=((total-secs)/total)*100;
  const r=58, circ=2*Math.PI*r;
  const finished=secs===0;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(5,6,15,.97)",zIndex:200,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:32}}>
      <div style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"rgba(255,255,255,.25)",letterSpacing:4,marginBottom:28,textTransform:"uppercase"}}>PRODASH · FOCUS MODE · POMODORO</div>
      <div style={{position:"relative",width:168,height:168,marginBottom:28}}>
        <svg width={168} height={168} style={{transform:"rotate(-90deg)"}}>
          <circle cx={84} cy={84} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={9}/>
          <circle cx={84} cy={84} r={r} fill="none" stroke={finished?"#059669":"#2563EB"} strokeWidth={9}
            strokeDasharray={circ} strokeDashoffset={circ-(circ*pct/100)} strokeLinecap="round"
            style={{transition:"stroke-dashoffset .6s"}}/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          <div style={{fontFamily:"Martian Mono,monospace",fontSize:36,fontWeight:700,color:"#fff",letterSpacing:-2,lineHeight:1}}>{fmtSecs(secs)}</div>
          <div style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"rgba(255,255,255,.25)",letterSpacing:2,marginTop:6}}>{finished?"COMPLETE!":running?"FOCUSING":"PAUSED"}</div>
        </div>
      </div>
      <div style={{textAlign:"center",maxWidth:440,marginBottom:28}}>
        <div style={{fontSize:11,color:"rgba(255,255,255,.3)",letterSpacing:2,fontFamily:"Martian Mono,monospace",marginBottom:8,textTransform:"uppercase"}}>Current Task</div>
        <div style={{fontSize:20,fontWeight:600,color:"#fff",lineHeight:1.4}}>{task.title}</div>
        {elapsed>5000&&<div style={{fontFamily:"Martian Mono,monospace",fontSize:11,color:"rgba(255,255,255,.3)",marginTop:8}}>Time invested: {fmtDur(elapsed)}</div>}
      </div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",justifyContent:"center"}}>
        {!finished&&<button onClick={onToggle} style={{padding:"11px 28px",background:running?"rgba(255,255,255,.1)":"#2563EB",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer"}}>{running?"⏸ Pause":"▶ Start"}</button>}
        {!finished&&<button onClick={onReset} style={{padding:"11px 18px",background:"rgba(255,255,255,.07)",border:"none",borderRadius:10,color:"rgba(255,255,255,.5)",fontSize:14,cursor:"pointer"}}>↺ Reset</button>}
        {finished&&<button onClick={()=>onDone(true)} style={{padding:"11px 32px",background:"#059669",border:"none",borderRadius:10,color:"#fff",fontSize:14,fontWeight:600,cursor:"pointer"}}>✓ Mark Done & Log</button>}
        <button onClick={()=>onDone(false)} style={{padding:"11px 18px",background:"rgba(255,255,255,.06)",border:"1px solid rgba(255,255,255,.1)",borderRadius:10,color:"rgba(255,255,255,.45)",fontSize:13,cursor:"pointer"}}>
          {elapsed>5000?"Log Time & Exit":"Exit"}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  AI TASK GENERATOR MODAL
// ══════════════════════════════════════════════════════════
function AIGenModal({onAddTasks,onClose,brandId,tab,apiKey}) {
  const [prompt,setPrompt]=useState("");
  const [loading,setLoading]=useState(false);
  const [preview,setPreview]=useState(null);
  const [err,setErr]=useState("");

  const generate=async()=>{
    if(!prompt.trim()) return;
    setLoading(true); setErr(""); setPreview(null);
    try {
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:900,
          system:`You plan tasks for a professional managing betting/gaming brands. Return ONLY a JSON array. No markdown, no backticks.
Each item: {"title":"string","priority":"medium","category":"Reporting","estimatedMins":30,"note":"string"}
priority: low|medium|high|urgent. category: Reporting|Compliance|Accounting|Payroll. 5-12 tasks.`,
          messages:[{role:"user",content:"Break this into specific tasks: "+prompt}]})});
      const json=await res.json();
      const text=json.content?.filter(c=>c.type==="text").map(c=>c.text).join("")||"";
      const tasks=JSON.parse(text.replace(/```json|```/g,"").trim());
      if(!Array.isArray(tasks)) throw new Error("not array");
      setPreview(tasks);
    } catch { setErr("Could not generate — try rephrasing."); }
    setLoading(false);
  };

  const confirm=()=>{
    onAddTasks(preview.map(t=>({...t,brand:brandId,tab,due:"",recurrence:"",kanbanStatus:"todo",attachments:[]})));
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box" style={{maxWidth:540}}>
        <div className="modal-title"><span>◎ AI TASK GENERATOR</span><button className="modal-close" onClick={onClose}>✕</button></div>
        <div style={{fontSize:12.5,color:"var(--ink-3)",marginBottom:14,lineHeight:1.65}}>Describe a project or process in plain English — AI breaks it into specific tasks instantly.</div>
        {!preview?(
          <>
            <textarea className="ta" style={{minHeight:80}} autoFocus
              placeholder={"e.g. \"Month-end compliance review for all brands\" or \"Q2 reporting pack for Goldbet\""}
              value={prompt} onChange={e=>setPrompt(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&e.ctrlKey)generate();}}/>
            <div style={{fontSize:10.5,color:"var(--ink-4)",marginBottom:10}}>Ctrl+Enter to generate</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:14}}>
              {["Month-end reporting pack","Compliance audit checklist","Payroll reconciliation","Regulatory submission","Brand performance review","Accounting close process"].map(s=>(
                <span key={s} onClick={()=>setPrompt(s)} style={{fontSize:11,padding:"3px 10px",background:"var(--surface)",borderRadius:99,cursor:"pointer",color:"var(--ink-3)",border:"1px solid var(--line)"}}>{s}</span>
              ))}
            </div>
            {err&&<div style={{color:"#DC2626",fontSize:12,marginBottom:10}}>{err}</div>}
            <div className="row gap8">
              <button className="btn btn-primary flex1" onClick={generate} disabled={loading||!prompt.trim()}>
                {loading?<span style={{display:"flex",alignItems:"center",gap:8}}><span className="typing-dots"><span/><span/><span/></span> Generating...</span>:"◎ Generate Tasks"}
              </button>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </>
        ):(
          <>
            <div style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"var(--indigo)",letterSpacing:1.5,marginBottom:10,textTransform:"uppercase"}}>◎ {preview.length} TASKS GENERATED — REVIEW BEFORE ADDING</div>
            <div style={{maxHeight:280,overflowY:"auto",marginBottom:14}}>
              {preview.map((t,i)=>(
                <div key={i} style={{display:"flex",gap:10,padding:"9px 12px",borderRadius:8,background:"var(--surface)",marginBottom:6,alignItems:"flex-start"}}>
                  <span style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"var(--ink-4)",marginTop:3,flexShrink:0}}>{String(i+1).padStart(2,"0")}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500,color:"var(--ink)",marginBottom:4}}>{t.title}</div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                      <span className={`badge ${t.priority==="urgent"?"badge-violet":t.priority==="high"?"badge-red":t.priority==="medium"?"badge-amber":"badge-green"}`}>{t.priority}</span>
                      {t.category&&<span className="badge badge-gray">{t.category}</span>}
                      {t.estimatedMins&&<span style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"var(--ink-4)"}}>~{t.estimatedMins}m</span>}
                    </div>
                    {t.note&&<div style={{fontSize:11,color:"var(--ink-4)",marginTop:3}}>{t.note}</div>}
                  </div>
                </div>
              ))}
            </div>
            <div className="row gap8">
              <button className="btn btn-primary flex1" onClick={confirm}>✓ Add All {preview.length} Tasks</button>
              <button className="btn btn-ghost" onClick={()=>setPreview(null)}>← Regen</button>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  TEMPLATES MODAL
// ══════════════════════════════════════════════════════════
function TemplatesModal({templates,onSave,onDeploy,onDelete,onClose,activeBrand,activeTab}) {
  const [name,setName]=useState("");
  const [deployTarget,setDeployTarget]=useState({brand:activeBrand||"goldbet",tab:activeTab||"Reporting"});
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box" style={{maxWidth:500}}>
        <div className="modal-title"><span>📋 SMART TEMPLATES</span><button className="modal-close" onClick={onClose}>✕</button></div>
        <div style={{fontSize:12,color:"var(--ink-3)",marginBottom:14}}>Save your current tasks as a template. Deploy to any brand instantly.</div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <input className="inp" style={{flex:1}} placeholder="Template name..." value={name} onChange={e=>setName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&name.trim()&&onSave(activeBrand,activeTab,name.trim())&&setName("")}/>
          <button className="btn btn-primary btn-sm" onClick={()=>{if(name.trim()){onSave(activeBrand,activeTab,name.trim());setName("");}}} disabled={!name.trim()}>💾 Save Current</button>
        </div>
        {!templates?.length&&<div style={{textAlign:"center",padding:"20px 0",color:"var(--ink-4)",fontSize:12}}>No templates yet</div>}
        {(templates||[]).map(t=>{
          const brand=BRANDS.find(b=>b.id===t.brandId);
          return (
            <div key={t.id} style={{display:"flex",gap:10,padding:"11px 14px",border:"1px solid var(--line)",borderRadius:10,marginBottom:8,alignItems:"center",background:"var(--surface)"}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:"var(--ink)"}}>{t.name}</div>
                <div style={{fontSize:11,color:"var(--ink-4)",marginTop:3}}>{brand?.emoji} {brand?.name} · {t.tab} · {t.tasks.length} tasks · {fmtDate(t.createdAt)}</div>
              </div>
              <div style={{display:"flex",gap:6,alignItems:"center"}}>
                <select className="sel" style={{fontSize:10.5,padding:"4px 6px",width:90}} value={deployTarget.brand} onChange={e=>setDeployTarget(p=>({...p,brand:e.target.value}))}>
                  {BRANDS.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
                <button className="btn btn-primary btn-xs" onClick={()=>{onDeploy(t,deployTarget.brand,deployTarget.tab);onClose();}}>▶ Deploy</button>
                <button className="task-del" style={{opacity:1}} onClick={()=>onDelete(t.id)}>✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  SCORE RING
// ══════════════════════════════════════════════════════════
function ScoreRing({score,size=72,stroke=6}) {
  const r=(size-stroke*2)/2, circ=2*Math.PI*r, dash=circ-(circ*score/100);
  const color=score>=80?"#059669":score>=60?"#2563EB":score>=40?"#D97706":"#DC2626";
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
          style={{transition:"stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Martian Mono,monospace",fontSize:size>60?16:12,fontWeight:600,color}}>{score}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  AI PANEL
// ══════════════════════════════════════════════════════════
function AIPanel({insight,loading,onRefresh,label="◎ AI INSIGHT"}) {
  return (
    <div className="ai-panel" style={{marginBottom:16}}>
      <div className="ai-panel-title">
        <span>{label}</span>
        {onRefresh&&<button className="ai-btn" style={{padding:"2px 10px",fontSize:10}} onClick={onRefresh} disabled={loading}>{loading?"...":"↻ Refresh"}</button>}
      </div>
      {loading
        ?<div className="ai-panel-loading"><span className="typing-dots"><span/><span/><span/></span> Analysing your data...</div>
        :insight
          ?<div className="ai-panel-text">{insight}</div>
          :<div style={{fontSize:12,color:"var(--ink-4)"}}>Click refresh to get an AI insight.</div>
      }
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  TOAST CONTAINER
// ══════════════════════════════════════════════════════════
function ToastContainer({toasts}) {
  if(!toasts.length) return null;
  return (
    <div className="toast-wrap">
      {toasts.map(t=><div key={t.id} className={`toast ${t.type}`}>{t.type==="success"?"✓":t.type==="error"?"✕":"⚠"} {t.msg}</div>)}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  GLOBAL SEARCH MODAL  (Cmd+K)
// ══════════════════════════════════════════════════════════
function GlobalSearch({data,onClose,onNavigate}) {
  const [q,setQ]=useState("");
  const ref=useRef(null);
  useEffect(()=>{ref.current?.focus();},[]);

  const results=[];
  if(q.trim().length>1){
    const ql=q.toLowerCase();
    // tasks
    Object.entries(data.tasks).forEach(([key,tasks])=>{
      const [bId,...tabParts]=key.split("_"); const tab=tabParts.join("_");
      const brand=BRANDS.find(b=>b.id===bId);
      tasks.forEach(t=>{
        if(t.title.toLowerCase().includes(ql)||t.note?.toLowerCase().includes(ql)){
          results.push({type:"task",icon:"✓",label:t.title,sub:`${brand?.emoji||""} ${brand?.name||bId} · ${tab}`,color:brand?.color||"#9099B8",action:()=>{onNavigate("brand",bId);onClose();}});
        }
      });
    });
    // notes
    data.notes.forEach(n=>{
      if(n.title?.toLowerCase().includes(ql)||n.content.toLowerCase().includes(ql)){
        results.push({type:"note",icon:"📌",label:n.title||n.content.slice(0,50),sub:"Pin Board",color:"#D97706",action:()=>{onNavigate("pinboard");onClose();}});
      }
    });
    // reminders
    data.reminders.forEach(r=>{
      if(r.title.toLowerCase().includes(ql)){
        results.push({type:"reminder",icon:"🔔",label:r.title,sub:`${fmtDate(r.date)} · ${r.time||""}`,color:"#7C3AED",action:()=>{onNavigate("calendar");onClose();}});
      }
    });
    // brands
    BRANDS.forEach(b=>{
      if(b.name.toLowerCase().includes(ql)){
        results.push({type:"brand",icon:b.emoji,label:b.name,sub:"Brand page",color:b.color,action:()=>{onNavigate("brand",b.id);onClose();}});
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box" style={{maxWidth:560,padding:0,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,padding:"14px 16px",borderBottom:"1px solid var(--line)"}}>
          <span style={{fontSize:16,color:"var(--ink-4)"}}>🔍</span>
          <input ref={ref} className="inp" style={{border:"none",padding:0,fontSize:14,background:"transparent",flex:1,outline:"none",color:"var(--ink)"}}
            placeholder="Search tasks, notes, reminders, brands..." value={q} onChange={e=>setQ(e.target.value)}
            onKeyDown={e=>{if(e.key==="Escape")onClose(); if(e.key==="Enter"&&results[0])results[0].action();}}/>
          <kbd style={{fontFamily:"Martian Mono,monospace",fontSize:9,padding:"3px 6px",background:"var(--surface)",border:"1px solid var(--line-2)",borderRadius:4,color:"var(--ink-4)"}}>ESC</kbd>
        </div>
        <div style={{maxHeight:400,overflowY:"auto"}}>
          {q.trim().length>1&&results.length===0&&(
            <div style={{padding:"32px 16px",textAlign:"center",color:"var(--ink-4)",fontSize:13}}>No results for "{q}"</div>
          )}
          {q.trim().length<=1&&(
            <div style={{padding:"22px 16px",textAlign:"center",color:"var(--ink-4)",fontSize:12.5}}>
              Type to search across all tasks, notes, reminders and brands
              <div style={{marginTop:12,display:"flex",justifyContent:"center",gap:8,flexWrap:"wrap"}}>
                {BRANDS.map(b=><span key={b.id} onClick={()=>{onNavigate("brand",b.id);onClose();}} style={{padding:"4px 10px",background:"var(--surface)",borderRadius:99,fontSize:12,cursor:"pointer",color:b.color,fontWeight:500}}>{b.emoji} {b.name}</span>)}
              </div>
            </div>
          )}
          {results.map((r,i)=>(
            <div key={i} onClick={r.action} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",cursor:"pointer",borderBottom:"1px solid var(--line)",transition:"background .1s"}}
              onMouseEnter={e=>e.currentTarget.style.background="var(--surface)"} onMouseLeave={e=>e.currentTarget.style.background=""}>
              <span style={{fontSize:16,flexShrink:0}}>{r.icon}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,color:"var(--ink)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.label}</div>
                <div style={{fontSize:11,color:"var(--ink-4)",marginTop:2}}>{r.sub}</div>
              </div>
              <span style={{fontFamily:"Martian Mono,monospace",fontSize:8,padding:"2px 7px",borderRadius:3,background:"var(--surface)",color:r.color,textTransform:"uppercase",letterSpacing:1}}>{r.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  TASK MODAL
// ══════════════════════════════════════════════════════════
function TaskModal({onSave,onClose,brandId,tab,brands}) {
  const [f,setF]=useState({title:"",priority:"medium",due:"",category:"",estimatedMins:"",note:"",brand:brandId||"",tab:tab||BRAND_TABS[0],recurrence:"",kanbanStatus:"todo"});
  const [err,setErr]=useState("");
  const [files,setFiles]=useState([]);
  const [lightbox,setLightbox]=useState(null);
  const fileRef=useRef(null);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));

  const handleFiles=(incoming)=>{
    Array.from(incoming).forEach(file=>{
      if(file.size>5*1024*1024){setErr("File too large — max 5MB");return;}
      const reader=new FileReader();
      reader.onload=e=>setFiles(p=>[...p,{id:uid(),name:file.name,type:file.type,data:e.target.result}]);
      reader.readAsDataURL(file);
    });
  };

  const save=()=>{
    if(!f.title.trim()){setErr("Title is required");return;}
    onSave({...f,title:f.title.trim(),estimatedMins:f.estimatedMins?parseInt(f.estimatedMins):null,attachments:files});
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box">
        <div className="modal-title"><span>ADD TASK</span><button className="modal-close" onClick={onClose}>✕</button></div>
        {err&&<div className="badge badge-red mb12" style={{display:"block",padding:"7px 10px",borderRadius:6}}>{err}</div>}
        <div className="form-group mb12">
          <label className="form-label">Task Title *</label>
          <input className="inp" placeholder="What needs to be done?" value={f.title} onChange={e=>set("title",e.target.value)} autoFocus onKeyDown={e=>e.key==="Enter"&&save()}/>
        </div>
        <div className="form-row mb12">
          <div className="form-group"><label className="form-label">Priority</label>
            <select className="sel" value={f.priority} onChange={e=>set("priority",e.target.value)}>
              {PRIORITIES.map(p=><option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Category</label>
            <select className="sel" value={f.category} onChange={e=>set("category",e.target.value)}>
              <option value="">— Select —</option>
              {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row mb12">
          <div className="form-group"><label className="form-label">Due Date</label>
            <input className="inp" type="date" value={f.due} onChange={e=>set("due",e.target.value)}/>
          </div>
          <div className="form-group"><label className="form-label">Est. Time (mins)</label>
            <input className="inp" type="number" placeholder="e.g. 30" min="1" value={f.estimatedMins} onChange={e=>set("estimatedMins",e.target.value)}/>
          </div>
        </div>
        <div className="form-row mb12">
          <div className="form-group"><label className="form-label">Recurrence</label>
            <select className="sel" value={f.recurrence} onChange={e=>set("recurrence",e.target.value)}>
              {RECURRENCE.map(r=><option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          <div className="form-group"><label className="form-label">Kanban Status</label>
            <select className="sel" value={f.kanbanStatus} onChange={e=>set("kanbanStatus",e.target.value)}>
              {KANBAN_COLS.map(c=><option key={c} value={c}>{KANBAN_LABELS[c]}</option>)}
            </select>
          </div>
        </div>
        {!brandId&&(
          <div className="form-row mb12">
            <div className="form-group"><label className="form-label">Brand</label>
              <select className="sel" value={f.brand} onChange={e=>set("brand",e.target.value)}>
                <option value="">— None —</option>
                {brands.map(b=><option key={b.id} value={b.id}>{b.emoji} {b.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Department</label>
              <select className="sel" value={f.tab} onChange={e=>set("tab",e.target.value)}>
                {BRAND_TABS.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
        )}
        <div className="form-group mb12">
          <label className="form-label">Notes / Context</label>
          <textarea className="ta" placeholder="Context, links, details..." value={f.note} onChange={e=>set("note",e.target.value)}/>
        </div>
        {/* File upload */}
        <div className="form-group mb20">
          <label className="form-label">Attachments</label>
          <div className="drop-zone" style={{padding:"13px 16px",cursor:"pointer"}}
            onClick={()=>fileRef.current?.click()}
            onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor="var(--blue)";}}
            onDragLeave={e=>{e.currentTarget.style.borderColor="";}}
            onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor="";handleFiles(e.dataTransfer.files);}}>
            <div style={{fontSize:20,marginBottom:4}}>📎</div>
            <div style={{fontSize:12.5,fontWeight:500,color:"var(--ink-2)"}}>Drop files or click to browse</div>
            <div style={{fontSize:11,color:"var(--ink-4)",marginTop:2}}>Images, PDFs, docs — max 5MB</div>
            <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" style={{display:"none"}} onChange={e=>handleFiles(e.target.files)}/>
          </div>
          {files.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))",gap:8,marginTop:10}}>
              {files.map(file=>(
                <div key={file.id} style={{position:"relative",border:"1px solid var(--line)",borderRadius:8,overflow:"hidden",background:"var(--surface)",cursor:file.type.startsWith("image/")?"pointer":"default"}}
                  onClick={()=>file.type.startsWith("image/")&&setLightbox(file)}>
                  {file.type.startsWith("image/")
                    ?<img src={file.data} alt={file.name} style={{width:"100%",height:72,objectFit:"cover",display:"block"}}/>
                    :<div style={{height:72,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26}}>{file.type.includes("pdf")?"📄":file.type.includes("sheet")||file.type.includes("excel")?"📊":"📝"}</div>
                  }
                  <div style={{padding:"4px 6px",fontFamily:"Martian Mono,monospace",fontSize:8.5,color:"var(--ink-3)",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",borderTop:"1px solid var(--line)"}}>{file.name}</div>
                  <button onClick={e=>{e.stopPropagation();setFiles(p=>p.filter(x=>x.id!==file.id));}} style={{position:"absolute",top:3,right:3,background:"rgba(0,0,0,.55)",border:"none",color:"#fff",borderRadius:3,padding:"1px 5px",fontSize:9.5,cursor:"pointer"}}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="row gap8">
          <button className="btn btn-primary flex1" onClick={save}>+ Add Task</button>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
      {lightbox&&(
        <div onClick={()=>setLightbox(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24,cursor:"zoom-out"}}>
          <div onClick={e=>e.stopPropagation()} style={{position:"relative",maxWidth:"90vw",maxHeight:"90vh"}}>
            <img src={lightbox.data} alt={lightbox.name} style={{maxWidth:"100%",maxHeight:"85vh",borderRadius:10,boxShadow:"0 20px 60px rgba(0,0,0,.5)",display:"block"}}/>
            <button onClick={()=>setLightbox(null)} style={{position:"absolute",top:-12,right:-12,background:"#fff",border:"none",borderRadius:"50%",width:28,height:28,fontSize:12,cursor:"pointer",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,0,0,.3)"}}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  PIN MODAL
// ══════════════════════════════════════════════════════════
function PinModal({onSave,onClose}) {
  const [f,setF]=useState({title:"",content:"",color:PIN_COLORS[0]});
  const save=()=>{ if(!f.content.trim()) return; onSave(f); onClose(); };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box">
        <div className="modal-title"><span>NEW NOTE</span><button className="modal-close" onClick={onClose}>✕</button></div>
        <div className="form-group mb12"><label className="form-label">Title (optional)</label><input className="inp" placeholder="Note title..." value={f.title} onChange={e=>setF(p=>({...p,title:e.target.value}))}/></div>
        <div className="form-group mb14"><label className="form-label">Content *</label><textarea className="ta" style={{minHeight:100}} placeholder="Write anything..." value={f.content} onChange={e=>setF(p=>({...p,content:e.target.value}))} autoFocus/></div>
        <div className="form-group mb20"><label className="form-label">Colour</label>
          <div className="row gap6 wrap">{PIN_COLORS.map(c=><div key={c} onClick={()=>setF(p=>({...p,color:c}))} style={{width:26,height:26,borderRadius:6,background:c,cursor:"pointer",border:f.color===c?"2px solid var(--ink)":"1.5px solid rgba(0,0,0,.12)"}}/>)}</div>
        </div>
        <div className="row gap8"><button className="btn btn-primary flex1" onClick={save}>+ Add Note</button><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  REMINDER MODAL
// ══════════════════════════════════════════════════════════
function ReminderModal({onSave,onClose,defaultDate}) {
  const [f,setF]=useState({title:"",date:defaultDate||todayStr(),time:"09:00",brand:"",note:""});
  const save=()=>{ if(!f.title.trim()) return; onSave(f); onClose(); };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box">
        <div className="modal-title"><span>SET REMINDER</span><button className="modal-close" onClick={onClose}>✕</button></div>
        <div className="form-group mb12"><label className="form-label">Title *</label><input className="inp" placeholder="What to remind you about?" value={f.title} onChange={e=>setF(p=>({...p,title:e.target.value}))} autoFocus/></div>
        <div className="form-row mb12">
          <div className="form-group"><label className="form-label">Date *</label><input className="inp" type="date" value={f.date} onChange={e=>setF(p=>({...p,date:e.target.value}))}/></div>
          <div className="form-group"><label className="form-label">Time</label><input className="inp" type="time" value={f.time} onChange={e=>setF(p=>({...p,time:e.target.value}))}/></div>
        </div>
        <div className="form-group mb12"><label className="form-label">Brand (optional)</label>
          <select className="sel" value={f.brand} onChange={e=>setF(p=>({...p,brand:e.target.value}))}>
            <option value="">— General —</option>
            {BRANDS.map(b=><option key={b.id} value={b.id}>{b.emoji} {b.name}</option>)}
          </select>
        </div>
        <div className="form-group mb20"><label className="form-label">Note</label><textarea className="ta" placeholder="Additional context..." value={f.note} onChange={e=>setF(p=>({...p,note:e.target.value}))}/></div>
        <div className="row gap8"><button className="btn btn-primary flex1" onClick={save}>Set Reminder</button><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  TOOLTIP
// ══════════════════════════════════════════════════════════
function CT({active,payload,label}) {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:"var(--white)",border:"1px solid var(--line)",borderRadius:8,padding:"8px 12px",boxShadow:"var(--s2)"}}>
      <div style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"var(--ink-4)",letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>{label}</div>
      {payload.map((p,i)=><div key={i} style={{fontSize:12,color:p.color,fontWeight:500}}>{p.name}: {p.value}</div>)}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS MODAL
// ══════════════════════════════════════════════════════════
function ShortcutsModal({onClose}) {
  const shortcuts = [
    ["Cmd/Ctrl + K","Global search"],
    ["N","New task (on dashboard/brand)"],
    ["Escape","Close any modal"],
    ["Enter","Submit form / quick add task"],
    ["D","Dashboard"],["W","Toggle War Room"],["F","Focus mode (AI page)"],
    ["A","Go to AI Assistant"],
    ["T","Toggle dark/light mode"],
  ];
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box" style={{maxWidth:420}}>
        <div className="modal-title"><span>KEYBOARD SHORTCUTS</span><button className="modal-close" onClick={onClose}>✕</button></div>
        {shortcuts.map(([k,v])=>(
          <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:"1px solid var(--line)"}}>
            <span style={{fontSize:12.5,color:"var(--ink-3)"}}>{v}</span>
            <kbd style={{fontFamily:"Martian Mono,monospace",fontSize:10,padding:"3px 9px",background:"var(--surface)",border:"1px solid var(--line-2)",borderRadius:5,color:"var(--ink-2)",whiteSpace:"nowrap"}}>{k}</kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════════════════════
export default function App() {
  const [data,setData]            = useState(loadLocal);
  const [view,setView]            = useState("dashboard");
  const [activeBrand,setActiveBrand] = useState(null);
  const [brandTab,setBrandTab]    = useState("Reporting");
  const [brandView,setBrandView]  = useState("list"); // "list" | "kanban"
  const [sidebarOpen,setSidebarOpen] = useState(false);
  const [taskFilter,setTaskFilter] = useState("all");
  const [searchQ,setSearchQ]      = useState("");
  const [showTaskModal,setShowTaskModal]         = useState(false);
  const [showPinModal,setShowPinModal]           = useState(false);
  const [showReminderModal,setShowReminderModal] = useState(false);
  const [showGlobalSearch,setShowGlobalSearch]   = useState(false);
  const [showShortcuts,setShowShortcuts]         = useState(false);
  const [reminderDate,setReminderDate] = useState(null);
  const [calMonth,setCalMonth]    = useState(new Date().getMonth());
  const [calYear,setCalYear]      = useState(new Date().getFullYear());
  const [chatMsgs,setChatMsgs]    = useState([]);
  const [chatInput,setChatInput]  = useState("");
  const [aiLoading,setAiLoading]  = useState(false);
  const [insights,setInsights]    = useState({});
  const [insightLoading,setInsightLoading] = useState({});
  const [activeTimers,setActiveTimers] = useState({});
  const [logFilter,setLogFilter]  = useState("all");
  const [dbStatus,setDbStatus]    = useState("loading");
  const [darkMode,setDarkMode]    = useState(()=>localStorage.getItem("prodash_dark")==="1");
  const [notifPerm,setNotifPerm]  = useState("default");
  const [activeAlerts,setActiveAlerts] = useState([]);
  const [selectedTasks,setSelectedTasks] = useState(new Set());
  const [focusMode,setFocusMode]   = useState(null); // {task, key}
  const [focusSecs,setFocusSecs]   = useState(POMODORO_MINS*60);
  const [focusRunning,setFocusRunning] = useState(false);
  const [focusStarted,setFocusStarted] = useState(null);
  const [showConfetti,setShowConfetti] = useState(false);
  const [taskLightbox,setTaskLightbox] = useState(null);
  const [showAIGen,setShowAIGen]   = useState(false);
  const [showTemplates,setShowTemplates] = useState(false);
  const [streak,setStreak]         = useState(loadStreak);
  const prevRates = useRef({});
  const focusTimer = useRef(null);
  const chatEndRef  = useRef(null);
  const saveTimer   = useRef(null);
  const notifTimer  = useRef(null);
  const confettiTimer = useRef(null);
  const {toasts,show:showToast} = useToast();
  const API_KEY = ["sk-ant-api03-VoyKgpprTtpngkF82LLonW2vPR1dpkHWqVOY35FG06LKuVPJj6vGpmZY4Ef25-lsykGlFwWw1HCb1LV8qmfv0g","hc3LgwAA"].join("-");

  // ── Dark mode ──
  useEffect(()=>{
    document.body.setAttribute("data-dark",darkMode?"1":"0");
    localStorage.setItem("prodash_dark",darkMode?"1":"0");
  },[darkMode]);

  // ── Supabase load ──
  useEffect(()=>{
    sbLoad().then(cloudData=>{
      const allTasks=Object.values(cloudData.tasks||{}).flat();
      if(allTasks.length>0||cloudData.notes?.length>0||cloudData.reminders?.length>0){
        setData(cloudData); saveLocal(cloudData);
      }
      setDbStatus("ok");
    }).catch(()=>setDbStatus("error"));
  },[]);

  // ── Auto-save ──
  useEffect(()=>{
    saveLocal(data);
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{
      sbSave(data).then(()=>setDbStatus("ok")).catch(()=>setDbStatus("error"));
    },1200);
    return()=>clearTimeout(saveTimer.current);
  },[data]);

  // ── Auto scroll chat ──
  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[chatMsgs]);

  // ── Session log ──
  useEffect(()=>{addLog("session_start","Session started",null,null,null);},[]);

  // ── Streak save ──
  useEffect(()=>{ saveStreakLS(streak); },[streak]);

  // ── Confetti: detect brand hitting 100% ──
  useEffect(()=>{
    const bs = getBrandStatsRaw();
    bs.forEach(b=>{
      const prev = prevRates.current[b.id];
      if(prev!==undefined && prev<100 && b.rate===100 && b.tasks>0){
        setShowConfetti(true);
        showToast("🎉 "+b.name+" hit 100%!");
        clearTimeout(confettiTimer.current);
        confettiTimer.current = setTimeout(()=>setShowConfetti(false), 3800);
      }
      prevRates.current[b.id] = b.rate;
    });
  // eslint-disable-next-line
  },[data.tasks]);

  // ── Recurring tasks ──
  useEffect(()=>{
    const today=todayStr(); const lastCheck=localStorage.getItem("prodash_recur_check");
    if(lastCheck===today) return;
    localStorage.setItem("prodash_recur_check",today);
    const now=new Date();
    setData(p=>{
      let changed=false; const newTasks={...p.tasks};
      Object.entries(newTasks).forEach(([key,tasks])=>{
        tasks.forEach(t=>{
          if(!t.recurrence||!t.done) return;
          const doneDate=new Date(t.doneAt||t.createdAt); let next=new Date(doneDate);
          if(t.recurrence==="daily") next.setDate(next.getDate()+1);
          else if(t.recurrence==="weekly") next.setDate(next.getDate()+7);
          else if(t.recurrence==="monthly") next.setMonth(next.getMonth()+1);
          if(next<=now){
            const nt={...t,id:uid(),done:false,doneAt:null,createdAt:nowISO(),due:next.toISOString().split("T")[0],timeSpent:0};
            newTasks[key]=[...newTasks[key],nt]; changed=true;
          }
        });
      });
      return changed?{...p,tasks:newTasks}:p;
    });
  // eslint-disable-next-line
  },[]);

  // ── Focus/Pomodoro timer tick ──
  useEffect(()=>{
    if(focusRunning){
      focusTimer.current=setInterval(()=>{
        setFocusSecs(s=>{ if(s<=1){clearInterval(focusTimer.current);setFocusRunning(false);showToast("🎯 Pomodoro done! Take a break.");return 0;} return s-1; });
      },1000);
    } else clearInterval(focusTimer.current);
    return()=>clearInterval(focusTimer.current);
  },[focusRunning]);

  // ── Auto AI briefing on load ──
  useEffect(()=>{
    const timer=setTimeout(()=>{
      fetchInsight("briefing","Give me a sharp executive morning briefing. Cover top risks, today's priority, and one strategic insight. Max 3 sentences. Be specific about brands and numbers.");
    },2000);
    return()=>clearTimeout(timer);
  },[]);

  // ── Browser notifications permission ──
  useEffect(()=>{
    if("Notification" in window) setNotifPerm(Notification.permission);
  },[]);

  // ── Reminder notification checker ──
  useEffect(()=>{
    const checkReminders=()=>{
      const now=new Date();
      const dateStr=now.toISOString().split("T")[0];
      const timeStr=`${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
      data.reminders.forEach(r=>{
        if(r.date===dateStr&&r.time===timeStr&&!r.notified){
          if(Notification.permission==="granted"){
            new Notification(`PRODASH Reminder`,{body:r.title,icon:"data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='20' fill='%232563EB'/><text y='.9em' font-size='72' x='10'>⚡</text></svg>"});
          }
          showToast(`🔔 Reminder: ${r.title}`,"warning");
          setData(p=>({...p,reminders:p.reminders.map(rem=>rem.id===r.id?{...rem,notified:true}:rem)}));
        }
      });
    };
    notifTimer.current=setInterval(checkReminders,30000);
    return()=>clearInterval(notifTimer.current);
  },[data.reminders,showToast]);

  // ── Proactive AI alerts ──
  useEffect(()=>{
    const today=todayStr();
    const alerts=[];
    const allTasks=Object.values(data.tasks).flat();
    const overdueTasks=allTasks.filter(t=>!t.done&&t.due&&t.due<today);
    if(overdueTasks.length>0) alerts.push({type:"overdue",msg:`${overdueTasks.length} overdue task${overdueTasks.length>1?"s":""} need attention`,color:"#DC2626",icon:"⚠"});
    const dueTodayTasks=allTasks.filter(t=>!t.done&&t.due===today);
    if(dueTodayTasks.length>0) alerts.push({type:"duetoday",msg:`${dueTodayTasks.length} task${dueTodayTasks.length>1?"s":""} due today`,color:"#D97706",icon:"📅"});
    const todayRems=data.reminders.filter(r=>r.date===today&&!r.notified);
    if(todayRems.length>0) alerts.push({type:"reminder",msg:`${todayRems.length} reminder${todayRems.length>1?"s":""} today`,color:"#7C3AED",icon:"🔔"});
    setActiveAlerts(alerts);
  },[data.tasks,data.reminders]);

  // ── Recurring tasks ──
  useEffect(()=>{
    const today=todayStr();
    const lastCheck=localStorage.getItem("prodash_recur_check");
    if(lastCheck===today) return;
    localStorage.setItem("prodash_recur_check",today);
    const now=new Date();
    setData(p=>{
      let changed=false;
      const newTasks={...p.tasks};
      Object.entries(newTasks).forEach(([key,tasks])=>{
        tasks.forEach(t=>{
          if(!t.recurrence||!t.done) return;
          const doneDate=new Date(t.doneAt||t.createdAt);
          let nextDue=new Date(doneDate);
          if(t.recurrence==="daily") nextDue.setDate(nextDue.getDate()+1);
          else if(t.recurrence==="weekly") nextDue.setDate(nextDue.getDate()+7);
          else if(t.recurrence==="monthly") nextDue.setMonth(nextDue.getMonth()+1);
          if(nextDue<=now){
            const newTask={...t,id:uid(),done:false,doneAt:null,createdAt:nowISO(),due:nextDue.toISOString().split("T")[0],timeSpent:0};
            newTasks[key]=[...(newTasks[key]||[]),newTask];
            changed=true;
            addLog("recurring",`Recurring: "${t.title}"`,key.split("_")[0],key.split("_").slice(1).join("_"),"");
          }
        });
      });
      return changed?{...p,tasks:newTasks}:p;
    });
  },[]);

  // ── Keyboard shortcuts ──
  useEffect(()=>{
    const handler=(e)=>{
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA"||e.target.tagName==="SELECT") return;
      if((e.metaKey||e.ctrlKey)&&e.key==="k"){e.preventDefault();setShowGlobalSearch(true);return;}
      if(e.key==="Escape"){setShowGlobalSearch(false);setShowShortcuts(false);return;}
      if(e.key==="n"||e.key==="N"){setShowTaskModal(true);return;}
      if(e.key==="d"||e.key==="D"){setView("dashboard");setActiveBrand(null);return;}
      if(e.key==="a"||e.key==="A"){setView("ai");setActiveBrand(null);return;}
      if(e.key==="t"||e.key==="T"){setDarkMode(p=>!p);return;}
      if(e.key==="w"||e.key==="W"){setView(v=>v==="warroom"?"dashboard":"warroom");setActiveBrand(null);return;}
      if(e.key==="f"||e.key==="F"){setView("ai");setActiveBrand(null);return;}
      if(e.key==="?"){setShowShortcuts(true);return;}
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[]);

  const requestNotifPermission=async()=>{
    if("Notification" in window){
      const p=await Notification.requestPermission();
      setNotifPerm(p);
      if(p==="granted") showToast("Notifications enabled! You'll be alerted for reminders.");
    }
  };

  const addLog=useCallback((type,title,brand=null,brandTab=null,detail=null)=>{
    const entry={id:uid(),ts:nowISO(),type,title,brand,brandTab,detail};
    setData(p=>({...p,timelog:[entry,...(p.timelog||[])].slice(0,500)}));
  },[]);

  // ── STATS (raw sync — no deps array, called inline) ──
  const getBrandStatsRaw = () => BRANDS.map(b=>{
    const tasks=Object.entries(data.tasks).filter(([k])=>k.startsWith(b.id)).flatMap(([,v])=>v);
    const done=tasks.filter(t=>t.done).length;
    const overdue=tasks.filter(t=>!t.done&&t.due&&t.due<todayStr()).length;
    const timeSpent=tasks.reduce((s,t)=>s+(t.timeSpent||0),0);
    const rate=tasks.length?Math.round(done/tasks.length*100):0;
    return {...b,tasks:tasks.length,done,pending:tasks.length-done,overdue,rate,timeSpent,hg:healthGrade(rate,overdue,tasks.length)};
  });

  // ── STATS ──
  const getStats=useCallback(()=>{
    const all=Object.values(data.tasks).flat();
    const today=todayStr();
    const weekAgo=new Date(Date.now()-7*86400000).toISOString().split("T")[0];
    const done=all.filter(t=>t.done).length;
    const overdue=all.filter(t=>!t.done&&t.due&&t.due<today).length;
    const todayTasks=all.filter(t=>t.createdAt?.startsWith(today));
    const weekTasks=all.filter(t=>t.createdAt>=weekAgo);
    const totalEstMins=all.filter(t=>t.estimatedMins).reduce((s,t)=>s+(t.estimatedMins||0),0);
    const totalTimeSpent=all.reduce((s,t)=>s+(t.timeSpent||0),0);
    return {total:all.length,done,pending:all.length-done,overdue,rate:all.length?Math.round(done/all.length*100):0,
      todayTotal:todayTasks.length,todayDone:todayTasks.filter(t=>t.done).length,
      weekTotal:weekTasks.length,weekDone:weekTasks.filter(t=>t.done).length,totalEstMins,totalTimeSpent};
  },[data.tasks]);

  const getBrandStats=useCallback(()=>BRANDS.map(b=>{
    const tasks=Object.entries(data.tasks).filter(([k])=>k.startsWith(b.id)).flatMap(([,v])=>v);
    const done=tasks.filter(t=>t.done).length;
    const overdue=tasks.filter(t=>!t.done&&t.due&&t.due<todayStr()).length;
    const timeSpent=tasks.reduce((s,t)=>s+(t.timeSpent||0),0);
    const rate=tasks.length?Math.round(done/tasks.length*100):0;
    return {...b,tasks:tasks.length,done,pending:tasks.length-done,overdue,rate,timeSpent,hg:healthGrade(rate,overdue,tasks.length)};
  }),[data.tasks]);

  const getScore=useCallback(()=>{
    const s=getStats(); const bs=getBrandStats();
    if(s.total===0) return 50;
    let sc=s.rate*0.4;
    sc+=s.todayTotal>0?(s.todayDone/s.todayTotal)*25:10;
    sc+=Math.max(0,20-(s.overdue*5));
    sc+=(bs.filter(b=>b.tasks>0).length/BRANDS.length)*15;
    return Math.round(Math.min(100,sc));
  },[getStats,getBrandStats]);

  // ── CRUD ──
  const addTask=useCallback((form)=>{
    const brand=form.brand||activeBrand||"goldbet";
    const tab=form.tab||brandTab;
    const key=`${brand}_${tab}`;
    const task={id:uid(),title:form.title,priority:form.priority||"medium",due:form.due||"",category:form.category||"",note:form.note||"",estimatedMins:form.estimatedMins||null,timeSpent:0,done:false,createdAt:nowISO(),recurrence:form.recurrence||"",kanbanStatus:form.kanbanStatus||"todo",attachments:form.attachments||[]};
    setData(p=>({...p,tasks:{...p.tasks,[key]:[...(p.tasks[key]||[]),task]}}));
    addLog("task_added",`Task: "${task.title}"`,brand,tab,task.category?`Category: ${task.category}`:"");
    showToast(`Task added to ${BRANDS.find(b=>b.id===brand)?.name||brand} · ${tab}`);
  },[activeBrand,brandTab,addLog,showToast]);

  const toggleTask=useCallback((key,id)=>{
    setData(p=>{
      const tasks=(p.tasks[key]||[]).map(t=>{
        if(t.id!==id) return t;
        const done=!t.done;
        if(done){
          setStreak(s=>{
            const today=todayStr(); const dates=new Set(s.dates||[]);
            dates.add(today); const arr=[...dates].sort();
            let cur=0; let d=new Date();
            for(let i=0;i<365;i++){const ds=d.toISOString().split('T')[0]; if(dates.has(ds)){cur++;d.setDate(d.getDate()-1);}else if(i===0){d.setDate(d.getDate()-1);}else break;}
            return{dates:arr.slice(-365),current:cur,best:Math.max(s.best||0,cur),lastDate:today};
          });
        }
        return {...t,done,doneAt:done?nowISO():null,kanbanStatus:done?"done":t.kanbanStatus==="done"?"todo":t.kanbanStatus};
      });
      const task=tasks.find(t=>t.id===id);
      if(task) addLog(task.done?"task_done":"task_added",`"${task.title}" ${task.done?"completed":"reopened"}`,key.split("_")[0],key.split("_").slice(1).join("_"),"");
      return {...p,tasks:{...p.tasks,[key]:tasks}};
    });
  },[addLog]);

  const moveKanban=useCallback((key,id,status)=>{
    setData(p=>{
      const tasks=(p.tasks[key]||[]).map(t=>t.id===id?{...t,kanbanStatus:status,done:status==="done",doneAt:status==="done"?nowISO():null}:t);
      return {...p,tasks:{...p.tasks,[key]:tasks}};
    });
  },[]);

  const deleteTask=useCallback((key,id)=>{
    setData(p=>{
      const task=(p.tasks[key]||[]).find(t=>t.id===id);
      if(task) addLog("task_deleted",`Deleted: "${task.title}"`,key.split("_")[0],key.split("_").slice(1).join("_"),"");
      return {...p,tasks:{...p.tasks,[key]:(p.tasks[key]||[]).filter(t=>t.id!==id)}};
    });
    showToast("Task deleted","warning");
  },[addLog,showToast]);

  const startTimer=useCallback((taskId,title,brand,tab)=>{
    setActiveTimers(p=>({...p,[taskId]:Date.now()}));
    addLog("timer_start",`Timer: "${title}"`,brand,tab,"");
    showToast("Timer started");
  },[addLog,showToast]);

  const stopTimer=useCallback((taskId,title,brand,tab,key)=>{
    const start=activeTimers[taskId]; if(!start) return;
    const elapsed=Date.now()-start;
    setActiveTimers(p=>{const n={...p};delete n[taskId];return n;});
    setData(p=>{const tasks=(p.tasks[key]||[]).map(t=>t.id===taskId?{...t,timeSpent:(t.timeSpent||0)+elapsed}:t); return {...p,tasks:{...p.tasks,[key]:tasks}};});
    addLog("timer_stop",`Timer stopped: "${title}" — ${fmtDur(elapsed)}`,brand,tab,`Logged: ${fmtDur(elapsed)}`);
    showToast(`Logged ${fmtDur(elapsed)}`);
  },[activeTimers,addLog,showToast]);

  const addNote=useCallback((form)=>{
    const note={id:uid(),title:form.title,content:form.content,color:form.color,createdAt:nowISO()};
    setData(p=>({...p,notes:[note,...p.notes]}));
    addLog("note_added",`Note: "${form.title||form.content.slice(0,40)}"`,null,null,"");
    showToast("Note added");
  },[addLog,showToast]);

  const addReminder=useCallback((form)=>{
    const rem={id:uid(),title:form.title,date:form.date,time:form.time,brand:form.brand,note:form.note,createdAt:nowISO(),notified:false};
    setData(p=>({...p,reminders:[...p.reminders,rem].sort((a,b)=>a.date.localeCompare(b.date))}));
    addLog("reminder_set",`Reminder: "${form.title}" on ${fmtDate(form.date)}`,form.brand||null,null,"");
    showToast("Reminder set");
  },[addLog,showToast]);

  const deleteReminder=useCallback((id)=>{
    setData(p=>({...p,reminders:p.reminders.filter(r=>r.id!==id)}));
    showToast("Reminder removed","warning");
  },[showToast]);

  // ── Bulk actions ──
  const bulkComplete=useCallback((key,ids)=>{
    setData(p=>{const tasks=(p.tasks[key]||[]).map(t=>ids.has(t.id)?{...t,done:true,doneAt:nowISO(),kanbanStatus:"done"}:t);return{...p,tasks:{...p.tasks,[key]:tasks}};});
    addLog("bulk_action",`Bulk completed ${ids.size} tasks`,activeBrand,brandTab,"");
    showToast(ids.size+" tasks completed"); setSelectedTasks(new Set());
  },[addLog,activeBrand,brandTab,showToast]);

  const bulkDelete=useCallback((key,ids)=>{
    setData(p=>({...p,tasks:{...p.tasks,[key]:(p.tasks[key]||[]).filter(t=>!ids.has(t.id))}}));
    addLog("bulk_action",`Bulk deleted ${ids.size} tasks`,activeBrand,brandTab,"");
    showToast(ids.size+" tasks deleted","warning"); setSelectedTasks(new Set());
  },[addLog,activeBrand,brandTab,showToast]);

  // ── Templates ──
  const saveTemplate=useCallback((brand,tab,name)=>{
    const key=brand+"_"+tab;
    const tasks=(data.tasks[key]||[]).filter(t=>!t.done).map(({id,done,createdAt,doneAt,timeSpent,...t})=>t);
    if(!tasks.length){showToast("No pending tasks to save","warning");return;}
    const tpl={id:uid(),name,brandId:brand,tab,createdAt:nowISO(),tasks};
    setData(p=>({...p,templates:[...(p.templates||[]),tpl]}));
    showToast("Template \""+name+"\" saved ("+tasks.length+" tasks)");
  },[data.tasks,showToast]);

  const deployTemplate=useCallback((tpl,targetBrand,targetTab)=>{
    const key=targetBrand+"_"+targetTab;
    const tasks=tpl.tasks.map(t=>({...t,id:uid(),done:false,doneAt:null,createdAt:nowISO(),timeSpent:0,attachments:[]}));
    setData(p=>({...p,tasks:{...p.tasks,[key]:[...(p.tasks[key]||[]),...tasks]}}));
    showToast("Deployed "+tasks.length+" tasks from \""+tpl.name+"\"");
  },[showToast]);

  const deleteTemplate=useCallback((id)=>{
    setData(p=>({...p,templates:(p.templates||[]).filter(t=>t.id!==id)}));
    showToast("Template deleted","warning");
  },[showToast]);

  // ── CSV export ──
  const exportCSV=(brand,tab)=>{
    const tasks=(data.tasks[brand+"_"+tab]||[]);
    const hdr=["Title","Priority","Category","Due","Status","Est.Mins","TimeSpent(mins)","Notes"];
    const rows=tasks.map(t=>["\""+t.title.replace(/"/g,'\"\"')+"\"",t.priority,t.category,t.due,t.done?"Done":"Pending",t.estimatedMins||"",t.timeSpent?Math.round(t.timeSpent/60000):"","\""+((t.note||"").replace(/"/g,'\"\"'))+"\"" ]);
    const csv=[hdr,...rows].map(r=>r.join(",")).join("\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    const a=document.createElement("a"); a.href=url; a.download=brand+"-"+tab+"-"+todayStr()+".csv"; a.click(); URL.revokeObjectURL(url);
    showToast("CSV exported");
  };

  // ── Focus mode actions ──
  const startFocus=(task,key)=>{
    setFocusMode({task,key}); setFocusSecs(POMODORO_MINS*60); setFocusRunning(false); setFocusStarted(Date.now());
  };
  const endFocus=(markDone)=>{
    if(!focusMode) return;
    const elapsed=focusStarted?Date.now()-focusStarted:0;
    if(elapsed>5000){
      setData(p=>{const tasks=(p.tasks[focusMode.key]||[]).map(t=>t.id===focusMode.task.id?{...t,timeSpent:(t.timeSpent||0)+elapsed,...(markDone?{done:true,doneAt:nowISO(),kanbanStatus:"done"}:{})}:t);return{...p,tasks:{...p.tasks,[focusMode.key]:tasks}};});
      addLog("timer_stop","Focus: \""+focusMode.task.title+"\": "+fmtDur(elapsed),activeBrand,brandTab,"");
      showToast((markDone?"✓ Done! ":"")+"Logged "+fmtDur(elapsed));
    }
    setFocusMode(null); setFocusRunning(false); clearInterval(focusTimer.current);
  };

  const exportData=()=>{
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a");
    a.href=url; a.download=`prodash-${todayStr()}.json`; a.click(); URL.revokeObjectURL(url);
    showToast("Data exported");
  };
  const importData=(file)=>{
    const reader=new FileReader();
    reader.onload=e=>{try{const p=JSON.parse(e.target.result);if(p.tasks!==undefined){setData({tasks:p.tasks||{},notes:p.notes||[],reminders:p.reminders||[],uploads:p.uploads||{},timelog:p.timelog||[],aiInsights:p.aiInsights||{},meta:p.meta||{}});showToast("Imported");}else showToast("Invalid file","error");}catch{showToast("Failed to parse","error");}};
    reader.readAsText(file);
  };

  // ── AI ENGINE ──
  const buildContext=useCallback(()=>{
    const s=getStats(); const bs=getBrandStats(); const score=getScore();
    const recentLog=(data.timelog||[]).slice(0,15).map(l=>`[${fmtTime(l.ts)}] ${l.title}`).join("\n");
    return `PRODASH LIVE DATA — ${new Date().toLocaleString("en-GB")}
PRODUCTIVITY SCORE: ${score}/100
TASKS: ${s.total} total | ${s.done} done | ${s.pending} pending | ${s.overdue} OVERDUE | Rate: ${s.rate}%
TODAY: ${s.todayDone}/${s.todayTotal} done | WEEK: ${s.weekDone}/${s.weekTotal} done
TIME TRACKED: ${fmtDur(s.totalTimeSpent)} total across all tasks
BRANDS:
${bs.map(b=>`  ${b.emoji} ${b.name}: ${b.done}/${b.tasks} (${b.rate}%)${b.overdue>0?` ⚠${b.overdue} overdue`:""} | Time: ${fmtDur(b.timeSpent)}`).join("\n")}
NOTES: ${data.notes.length} | REMINDERS: ${data.reminders.filter(r=>r.date>=todayStr()).length} upcoming
RECENT ACTIVITY:\n${recentLog||"No recent activity"}`;
  },[data,getStats,getBrandStats,getScore]);

  const callAI=useCallback(async(messages,extra="")=>{
    const system=`You are PRODASH AI — elite personal productivity intelligence for a professional managing 6 betting/gaming brands (Goldbet, Ultrabet, BoostBet, AllBets, BetGold, TechDev).

${buildContext()}

YOUR MANDATE: Be brutally specific — reference actual brand names, exact numbers, real patterns. Executive-level insights. No fluff. Proactively identify problems. Direct, focused answers.${extra}`;
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:600,system,messages}),
    });
    const json=await res.json();
    return json.content?.filter(c=>c.type==="text").map(c=>c.text).join("")||"";
  },[buildContext]);

  const fetchInsight=useCallback(async(key,prompt,extra="")=>{
    setInsightLoading(p=>({...p,[key]:true}));
    try{
      const text=await callAI([{role:"user",content:prompt}],extra);
      setInsights(p=>({...p,[key]:text}));
      addLog("ai_insight",`AI insight: ${key}`,null,null,"");
    }catch(e){setInsights(p=>({...p,[key]:"Could not load — check connection."}));}
    setInsightLoading(p=>({...p,[key]:false}));
  },[callAI,addLog]);

  const sendMessage=async()=>{
    if(!chatInput.trim()||aiLoading) return;
    const userMsg={role:"user",content:chatInput.trim()};
    const history=[...chatMsgs,userMsg];
    setChatMsgs(history); setChatInput(""); setAiLoading(true);
    try{
      const text=await callAI(history);
      setChatMsgs([...history,{role:"assistant",content:text||"Couldn't get a response."}]);
    }catch{setChatMsgs(h=>[...h,{role:"assistant",content:"Connection error — please try again."}]);}
    setAiLoading(false);
  };

  // ── COMPUTED ──
  const stats=getStats(); const bStats=getBrandStats(); const score=getScore();
  const currentBrand=BRANDS.find(b=>b.id===activeBrand);
  const todayReminders=data.reminders.filter(r=>r.date===todayStr());
  const getBrandTasks=(brand,tab)=>(data.tasks[`${brand}_${tab}`]||[]);

  // ══════════════════════════════════════════════════════════
  //  DASHBOARD
  // ══════════════════════════════════════════════════════════
  const renderWarRoom=()=>{
    const today=todayStr();
    const allTasks=Object.entries(data.tasks).flatMap(([key,tasks])=>
      tasks.map(t=>{const[bId,...tp]=key.split("_");const tab=tp.join("_");return{...t,key,brandId:bId,tab,brand:BRANDS.find(b=>b.id===bId)};})
    );
    const overdue=allTasks.filter(t=>!t.done&&t.due&&t.due<today).sort((a,b)=>a.due.localeCompare(b.due));
    const urgent=allTasks.filter(t=>!t.done&&t.priority==="urgent"&&(!t.due||t.due>=today));
    const stale=allTasks.filter(t=>!t.done&&taskAgeDays(t.createdAt)>7&&t.priority!=="urgent");
    const critical=overdue.length+urgent.length;
    return (
      <div style={{background:"#05060F",minHeight:"100%",padding:"28px 32px"}}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:28}}>
          <div>
            <div style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"rgba(220,38,38,.6)",letterSpacing:4,marginBottom:6,textTransform:"uppercase"}}>PRODASH · COMMAND CENTER</div>
            <div style={{fontFamily:"Martian Mono,monospace",fontSize:28,fontWeight:700,color:"#fff",letterSpacing:-1,lineHeight:1,marginBottom:5}}>⚔ WAR ROOM</div>
            <div style={{fontSize:12.5,color:"rgba(255,255,255,.3)"}}>{new Date().toLocaleString("en-GB",{weekday:"long",day:"numeric",month:"long",hour:"2-digit",minute:"2-digit"})}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontFamily:"Martian Mono,monospace",fontSize:44,fontWeight:700,color:critical>0?"#DC2626":"#059669",lineHeight:1,letterSpacing:-2}}>{critical}</div>
            <div style={{fontFamily:"Martian Mono,monospace",fontSize:8.5,color:"rgba(255,255,255,.25)",letterSpacing:2,marginTop:3,textTransform:"uppercase"}}>CRITICAL ITEMS</div>
          </div>
        </div>
        {/* Brand health grid */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8,marginBottom:24}}>
          {bStats.map(b=>(
            <div key={b.id} onClick={()=>{setActiveBrand(b.id);setView("brand");}} style={{background:"rgba(255,255,255,.04)",border:`1px solid ${b.overdue>0?"rgba(220,38,38,.4)":"rgba(255,255,255,.07)"}`,borderRadius:10,padding:"12px 10px",cursor:"pointer",transition:"background .15s"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.08)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,.04)"}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <span style={{fontSize:16}}>{b.emoji}</span>
                <span style={{fontFamily:"Martian Mono,monospace",fontSize:18,fontWeight:700,color:b.hg?.color||"#9099B8"}}>{b.hg?.grade||"—"}</span>
              </div>
              <div style={{fontFamily:"Martian Mono,monospace",fontSize:8.5,fontWeight:600,color:"rgba(255,255,255,.4)",letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>{b.name}</div>
              <div style={{height:3,background:"rgba(255,255,255,.08)",borderRadius:99,marginBottom:5}}>
                <div style={{height:"100%",width:b.rate+"%",background:b.hg?.color||"#9099B8",borderRadius:99}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span style={{fontFamily:"Martian Mono,monospace",fontSize:8.5,color:"rgba(255,255,255,.25)"}}>{b.rate}%</span>
                {b.overdue>0&&<span style={{fontFamily:"Martian Mono,monospace",fontSize:8.5,color:"#DC2626",fontWeight:700}}>⚠{b.overdue}</span>}
              </div>
            </div>
          ))}
        </div>
        {/* AI Emergency Brief */}
        <div style={{background:"rgba(79,70,229,.1)",border:"1px solid rgba(79,70,229,.25)",borderRadius:12,padding:"14px 18px",marginBottom:20}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:insights["warroom"]?10:0}}>
            <span style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"rgba(79,70,229,.8)",letterSpacing:2,textTransform:"uppercase"}}>◎ AI EMERGENCY ASSESSMENT</span>
            <button onClick={()=>fetchInsight("warroom","WAR ROOM: "+overdue.length+" overdue, "+urgent.length+" urgent. In 3 sharp sentences: the single biggest risk right now, the 2 most critical tasks, one decisive action. Be brutally direct.")}
              disabled={insightLoading["warroom"]} style={{fontFamily:"Martian Mono,monospace",fontSize:9.5,padding:"4px 12px",background:"rgba(79,70,229,.25)",border:"1px solid rgba(79,70,229,.4)",borderRadius:6,color:"#A5B4FC",cursor:"pointer"}}>
              {insightLoading["warroom"]?"Analysing...":"◎ Emergency Brief"}
            </button>
          </div>
          {insightLoading["warroom"]&&<div style={{color:"rgba(165,180,252,.7)",fontSize:12,display:"flex",gap:8,alignItems:"center"}}><span className="typing-dots"><span/><span/><span/></span> Assessing...</div>}
          {insights["warroom"]&&<div style={{fontSize:13,color:"rgba(255,255,255,.75)",lineHeight:1.75}}>{insights["warroom"]}</div>}
        </div>
        {/* Three columns */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16}}>
          {[
            {label:"OVERDUE",items:overdue,color:"#DC2626",bg:"rgba(220,38,38,.07)",border:"rgba(220,38,38,.2)"},
            {label:"URGENT",items:urgent,color:"#D97706",bg:"rgba(217,119,6,.07)",border:"rgba(217,119,6,.2)"},
            {label:"STALE (7+ days)",items:stale.slice(0,8),color:"#F97316",bg:"rgba(249,115,22,.06)",border:"rgba(249,115,22,.15)"},
          ].map(({label,items,color,bg,border})=>(
            <div key={label}>
              <div style={{fontFamily:"Martian Mono,monospace",fontSize:8.5,color:color+"cc",letterSpacing:2.5,marginBottom:12,textTransform:"uppercase"}}>{label} ({items.length})</div>
              {!items.length&&<div style={{color:"rgba(255,255,255,.15)",fontSize:12,padding:"12px 0"}}>✓ Clear</div>}
              {items.slice(0,8).map(t=>(
                <div key={t.id} onClick={()=>{setActiveBrand(t.brandId);setBrandTab(t.tab);setView("brand");}} style={{background:bg,border:"1px solid "+border,borderRadius:8,padding:"9px 12px",marginBottom:7,cursor:"pointer"}}>
                  <div style={{fontSize:12.5,fontWeight:500,color:"#fff",marginBottom:5,lineHeight:1.35}}>{t.title}</div>
                  <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
                    <span style={{fontFamily:"Martian Mono,monospace",fontSize:8.5,color:t.brand?.color||"#9099B8"}}>{t.brand?.emoji} {t.brand?.name}</span>
                    {t.due&&<span style={{fontFamily:"Martian Mono,monospace",fontSize:8.5,color:color+"cc"}}>📅 {fmtDate(t.due)}</span>}
                    <span style={{fontFamily:"Martian Mono,monospace",fontSize:8.5,color:"rgba(255,255,255,.25)"}}>{t.tab}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDashboard=()=>{
    const today=todayStr();
    const allTasks=Object.values(data.tasks).flat();
    const chartData=Array.from({length:7},(_,i)=>{
      const d=new Date(); d.setDate(d.getDate()-(6-i));
      const ds=d.toISOString().split("T")[0];
      const dayTasks=allTasks.filter(t=>t.createdAt?.startsWith(ds));
      return {day:["S","M","T","W","T","F","S"][d.getDay()],added:dayTasks.length,done:dayTasks.filter(t=>t.done).length};
    });
    return (
      <div className="anim-up">
        {/* Proactive alerts strip */}
        {activeAlerts.length>0&&(
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            {activeAlerts.map((a,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:7,padding:"7px 14px",background:`${a.color}12`,border:`1px solid ${a.color}30`,borderRadius:8,cursor:"pointer"}}
                onClick={()=>a.type==="overdue"?setTaskFilter("overdue"):setView("calendar")}>
                <span style={{fontSize:14}}>{a.icon}</span>
                <span style={{fontSize:12.5,fontWeight:500,color:a.color}}>{a.msg}</span>
                <button className="ai-btn" style={{fontSize:10,padding:"2px 8px",marginLeft:4}} disabled={insightLoading[`alert_${a.type}`]}
                  onClick={e=>{e.stopPropagation();fetchInsight(`alert_${a.type}`,`I have an alert: ${a.msg}. What should I do about this right now? Give me 2 specific actions.`);}}>
                  {insightLoading[`alert_${a.type}`]?"...":"◎ AI"}
                </button>
                {insights[`alert_${a.type}`]&&<span style={{fontSize:11.5,color:"var(--ink-3)",borderLeft:"1px solid var(--line)",paddingLeft:8,maxWidth:300}}>{insights[`alert_${a.type}`]}</span>}
              </div>
            ))}
          </div>
        )}

        {/* AI Briefing */}
        <div className="briefing-card">
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16}}>
            <div style={{flex:1}}>
              <div className="briefing-title">◎ AI DAILY BRIEFING</div>
              {insightLoading["briefing"]
                ?<div style={{color:"var(--ink-3)",fontSize:12.5,display:"flex",alignItems:"center",gap:8}}><span className="typing-dots"><span/><span/><span/></span> Analysing your data...</div>
                :insights["briefing"]
                  ?<div className="briefing-text">{insights["briefing"]}</div>
                  :<div style={{color:"var(--ink-4)",fontSize:12.5}}>Generating your briefing...</div>
              }
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,flexShrink:0}}>
              <ScoreRing score={score}/>
              <div style={{fontFamily:"Martian Mono,monospace",fontSize:8,color:"var(--ink-4)",letterSpacing:1,textTransform:"uppercase"}}>SCORE</div>
            </div>
          </div>
          <div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}>
            {[
              {k:"briefing",label:insights["briefing"]?"↻ Refresh":"▶ Briefing",prompt:"Sharp executive morning briefing. Top risks, today's priority, one strategic insight. 3 sentences."},
              {k:"plan",label:"📋 Action Plan",prompt:"List top 5 actions for today by urgency and brand performance. Specific brand/task names."},
              {k:"risks",label:"⚠ Risk Analysis",prompt:"Top 3 risks right now. Brand, issue, immediate action. Be specific."},
              {k:"forecast",label:"📈 Week Forecast",prompt:"Based on current trajectory, forecast how this week will end. Will I hit my targets? What's at risk?"},
            ].map(b=>(
              <button key={b.k} className="ai-btn" disabled={insightLoading[b.k]} onClick={()=>fetchInsight(b.k,b.prompt)}>
                {insightLoading[b.k]?"...":b.label}
              </button>
            ))}
          </div>
          {(insights["plan"]||insights["risks"]||insights["forecast"])&&(
            <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid rgba(79,70,229,.15)",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:12}}>
              {["plan","risks","forecast"].filter(k=>insights[k]).map(k=>(
                <div key={k}>
                  <div style={{fontFamily:"Martian Mono,monospace",fontSize:7.5,color:k==="risks"?"#DC2626":"#4F46E5",letterSpacing:1.5,marginBottom:5,textTransform:"uppercase"}}>{k==="plan"?"TODAY'S PLAN":k==="risks"?"RISK ANALYSIS":"WEEK FORECAST"}</div>
                  <div style={{fontSize:12,color:"var(--ink-2)",lineHeight:1.75}}>{insights[k]}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today reminder banner */}
        {todayReminders.length>0&&(
          <div className="today-banner mb16">
            <span style={{fontSize:16}}>🔔</span>
            <div><div style={{fontWeight:600,fontSize:13,color:"#92400E"}}>Today's Reminders ({todayReminders.length})</div>
              <div style={{fontSize:12,color:"#B45309"}}>{todayReminders.map(r=>`${r.time?r.time+" · ":""}${r.title}`).join(" · ")}</div>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="g4 mb14">
          {[
            {label:"TOTAL TASKS",val:stats.total,sub:"All time",color:"#2563EB",cls:"blue"},
            {label:"COMPLETED",  val:stats.done, sub:`${stats.rate}% rate`,color:"#059669",cls:"green"},
            {label:"TODAY",      val:`${stats.todayDone}/${stats.todayTotal}`,sub:"Tasks done",color:"#D97706",cls:"amber"},
            {label:"OVERDUE",    val:stats.overdue,sub:stats.overdue>0?"Needs attention":"All clear",color:stats.overdue>0?"#DC2626":"#059669",cls:stats.overdue>0?"red":"green"},
          ].map(k=>(
            <div key={k.label} className={`kpi-card ${k.cls}`}>
              <span className="kpi-label-top">{k.label}</span>
              <span className="kpi-val" style={{color:k.color,fontSize:36}}>{k.val}</span>
              <div className="kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Time tracked KPI */}
        <div className="g4 mb14">
          {[
            {label:"TIME TRACKED",val:fmtDur(stats.totalTimeSpent),sub:"Logged across all tasks",color:"#7C3AED"},
            {label:"EST. PIPELINE",val:stats.totalEstMins?fmtDur(stats.totalEstMins*60000):"—",sub:"Estimated remaining",color:"#0891B2"},
            {label:"NOTES",       val:data.notes.length,sub:"On pin board",color:"#D97706"},
            {label:"REMINDERS",   val:data.reminders.filter(r=>r.date>=todayStr()).length,sub:"Upcoming",color:"#7C3AED"},
          ].map(k=>(
            <div key={k.label} className="kpi-card" style={{borderTop:"none",borderLeft:`3px solid ${k.color}`,paddingLeft:16}}>
              <span className="kpi-label-top">{k.label}</span>
              <span style={{fontFamily:"Martian Mono,monospace",fontSize:26,fontWeight:600,color:k.color,lineHeight:1,letterSpacing:-1,display:"block",marginBottom:4}}>{k.val}</span>
              <div className="kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Brand table + right col */}
        <div className="g2 mb14">
          <div className="card" style={{padding:0,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid var(--line)",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span className="card-title">BRAND PERFORMANCE</span>
              <button className="ai-btn" style={{fontSize:10,padding:"3px 10px"}} disabled={insightLoading["brand_summary"]}
                onClick={()=>fetchInsight("brand_summary","In 2 sentences: which brands need intervention and the single most important action to take today.")}>
                {insightLoading["brand_summary"]?"...":"◎ AI Summary"}
              </button>
            </div>
            {insights["brand_summary"]&&(
              <div style={{padding:"9px 16px",background:"var(--ai-bg)",borderBottom:"1px solid var(--ai-border)"}}>
                <div style={{fontFamily:"Martian Mono,monospace",fontSize:7.5,color:"var(--indigo)",letterSpacing:1.5,marginBottom:3,textTransform:"uppercase"}}>◎ AI TAKE</div>
                <div style={{fontSize:12,color:"var(--ink-2)",lineHeight:1.65}}>{insights["brand_summary"]}</div>
              </div>
            )}
            {bStats.map((b,i)=>(
              <div key={b.id} onClick={()=>{setActiveBrand(b.id);setView("brand");}}
                style={{display:"grid",gridTemplateColumns:"1.8fr .5fr .5fr .8fr 1fr",padding:"9px 16px",borderBottom:i<5?"1px solid var(--surface)":"none",alignItems:"center",cursor:"pointer",transition:"background .12s"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--surface)"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:13}}>{b.emoji}</span>
                  <span style={{fontSize:12.5,fontWeight:500,color:b.color}}>{b.name}</span>
                  {b.overdue>0&&<span className="badge badge-red">{b.overdue}▲</span>}
                  {b.hg&&<span style={{fontFamily:"Martian Mono,monospace",fontSize:10,fontWeight:700,color:b.hg.color}}>{b.hg.grade}</span>}
                </div>
                <span style={{fontFamily:"Martian Mono,monospace",fontSize:11,color:"var(--ink-4)"}}>{b.tasks}</span>
                <span style={{fontFamily:"Martian Mono,monospace",fontSize:11,color:b.color,fontWeight:500}}>{b.done}</span>
                <span style={{fontFamily:"Martian Mono,monospace",fontSize:10,color:"var(--ink-4)"}}>{b.timeSpent>0?fmtDur(b.timeSpent):"—"}</span>
                <div style={{display:"flex",alignItems:"center",gap:7}}>
                  <div style={{flex:1,height:5,background:"var(--surface)",borderRadius:99,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${b.rate}%`,background:b.color,borderRadius:99,transition:"width 1s"}}/>
                  </div>
                  <span style={{fontFamily:"Martian Mono,monospace",fontSize:10,color:b.color,width:30,textAlign:"right"}}>{b.rate}%</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div className="card">
              <div className="card-header"><span className="card-title">PROGRESS TRACKER</span></div>
              {[{label:"Today",pct:stats.todayTotal?Math.round(stats.todayDone/stats.todayTotal*100):0,val:`${stats.todayDone}/${stats.todayTotal}`,c:"#059669"},{label:"This Week",pct:stats.weekTotal?Math.round(stats.weekDone/stats.weekTotal*100):0,val:`${stats.weekDone}/${stats.weekTotal}`,c:"#2563EB"},{label:"All Time",pct:stats.rate,val:`${stats.done}/${stats.total}`,c:"#D97706"}].map(p=>(
                <div key={p.label} className="mb12">
                  <div className="row-sb mb6"><span style={{fontSize:12.5,fontWeight:500,color:"var(--ink-3)"}}>{p.label}</span><span style={{fontFamily:"Martian Mono,monospace",fontSize:11,color:p.c,fontWeight:500}}>{p.val}</span></div>
                  <div className="prog-track"><div className="prog-fill" style={{width:`${p.pct}%`,background:p.c}}/></div>
                </div>
              ))}
              <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid var(--surface)",display:"flex",justifyContent:"space-around"}}>
                {[[stats.overdue,"Overdue","#DC2626"],[data.reminders.filter(r=>r.date>=todayStr()).length,"Upcoming","#7C3AED"],[Object.keys(activeTimers).length,"Timers","#D97706"]].map(([v,l,c])=>(
                  <div key={l} style={{textAlign:"center"}}>
                    <div style={{fontFamily:"Martian Mono,monospace",fontSize:22,fontWeight:600,color:c,lineHeight:1,letterSpacing:-1}}>{v}</div>
                    <div style={{fontFamily:"Martian Mono,monospace",fontSize:8,color:"var(--ink-4)",letterSpacing:1,marginTop:3,textTransform:"uppercase"}}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{flex:1}}>
              <div className="card-header"><span className="card-title">RECENT ACTIVITY</span><button className="btn btn-ghost btn-xs" onClick={()=>setView("timelog")}>All →</button></div>
              {(data.timelog||[]).filter(l=>l.type!=="session_start").slice(0,5).map(l=>{
                const lt=LOG_TYPES[l.type]||{color:"#9099B8"};
                return (
                  <div key={l.id} style={{display:"flex",gap:9,padding:"7px 0",borderBottom:"1px solid var(--surface)",alignItems:"flex-start"}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:lt.color,flexShrink:0,marginTop:5}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,color:"var(--ink)",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.title}</div>
                      <div style={{fontFamily:"Martian Mono,monospace",fontSize:8.5,color:"var(--ink-4)",marginTop:2}}>{fmtDateTime(l.ts)}</div>
                    </div>
                  </div>
                );
              })}
              {!(data.timelog||[]).filter(l=>l.type!=="session_start").length&&<div style={{fontSize:12,color:"var(--ink-4)",textAlign:"center",padding:"16px 0"}}>No activity yet</div>}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">7-DAY ACTIVITY</span>
            <div style={{display:"flex",gap:14,alignItems:"center"}}>
              {[["#2563EB","Added"],["#059669","Done"]].map(([c,l])=><div key={l} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:8,height:8,borderRadius:2,background:c}}/><span style={{fontSize:10.5,color:"var(--ink-4)"}}>{l}</span></div>)}
              <button className="ai-btn" style={{fontSize:10,padding:"3px 10px"}} disabled={insightLoading["weekly"]} onClick={()=>fetchInsight("weekly","Analyse my 7-day activity pattern. What does it reveal about my habits? Any concerns? 2 sentences.")}>◎ Analyse</button>
            </div>
          </div>
          {insights["weekly"]&&<div className="ai-panel" style={{marginBottom:14}}><div className="ai-panel-title">◎ WEEKLY PATTERN ANALYSIS</div><div className="ai-panel-text">{insights["weekly"]}</div></div>}
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid vertical={false} stroke="var(--surface)"/>
              <XAxis dataKey="day" tick={{fontFamily:"Martian Mono,monospace",fontSize:9,fill:"var(--ink-4)"}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontFamily:"Martian Mono,monospace",fontSize:9,fill:"var(--ink-4)"}} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip content={<CT/>}/>
              <Bar dataKey="added" name="Added" fill="#2563EB" radius={[3,3,0,0]}/>
              <Bar dataKey="done"  name="Done"  fill="#059669" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════
  //  BRAND
  // ══════════════════════════════════════════════════════════
  const renderBrand=()=>{
    if(!currentBrand) return null;
    const key=`${activeBrand}_${brandTab}`;
    let tasks=getBrandTasks(activeBrand,brandTab);
    const today=todayStr();
    const brandStat=bStats.find(b=>b.id===activeBrand);
    const bik=`brand_${activeBrand}_${brandTab}`;

    // filtered list tasks
    let filteredTasks=tasks;
    if(taskFilter!=="all") filteredTasks=filteredTasks.filter(t=>taskFilter==="done"?t.done:taskFilter==="pending"?!t.done:!t.done&&t.due&&t.due<today);
    if(searchQ) filteredTasks=filteredTasks.filter(t=>t.title.toLowerCase().includes(searchQ.toLowerCase())||t.note?.toLowerCase().includes(searchQ.toLowerCase()));

    const TaskItem=({t})=>{
      const isOverdue=!t.done&&t.due&&t.due<today;
      const timerRunning=activeTimers[t.id];
      const isSel=selectedTasks.has(t.id);
      const ageDays=!t.done?taskAgeDays(t.createdAt):0;
      const ageColor=ageDays>9?"#DC2626":ageDays>4?"#F97316":ageDays>2?"#D97706":null;
      const ageLabel=ageDays>9?"💀 STALE":ageDays>4?"🔥 AGING":null;
      const borderColor=isSel?"#2563EB":isOverdue?"#DC2626":ageColor||undefined;
      const bgColor=isSel?"rgba(37,99,235,.05)":ageDays>9?"rgba(220,38,38,.04)":ageDays>4?"rgba(249,115,22,.03)":undefined;
      return (
        <div className={`task-item${t.done?" done":""}`} style={{...(borderColor?{borderLeftColor:borderColor,borderLeftWidth:3}:{}),background:bgColor}}>
          <div onClick={()=>setSelectedTasks(p=>{const n=new Set(p);n.has(t.id)?n.delete(t.id):n.add(t.id);return n;})}
            style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${isSel?"#2563EB":"var(--line-2)"}`,background:isSel?"#2563EB":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,cursor:"pointer",marginRight:4,transition:"all .12s"}}>
            {isSel&&<span style={{color:"#fff",fontSize:9,lineHeight:1}}>✓</span>}
          </div>
          <div className={`task-cb${t.done?" chk":""}`} onClick={()=>toggleTask(key,t.id)}>{t.done?"✓":""}</div>
          <div style={{flex:1,minWidth:0}}>
            <div className={`task-title${t.done?" done":""}`}>{t.title}</div>
            <div className="task-meta">
              {t.priority&&<span className={`badge ${t.priority==="low"?"badge-green":t.priority==="medium"?"badge-amber":t.priority==="high"?"badge-red":"badge-violet"}`}>{t.priority}</span>}
              {t.category&&<span className="badge badge-gray">{t.category}</span>}
              {t.recurrence&&<span className="badge badge-blue">🔁 {t.recurrence}</span>}
              {isOverdue&&<span className="badge badge-red">⚠ OVERDUE</span>}
              {ageLabel&&!t.done&&<span style={{fontFamily:"Martian Mono,monospace",fontSize:8,color:ageColor,fontWeight:600}}>{ageLabel}</span>}
              {t.due&&<span style={{fontFamily:"Martian Mono,monospace",fontSize:9.5,color:isOverdue?"#DC2626":"var(--ink-4)"}}>Due {fmtDate(t.due)}</span>}
              {t.estimatedMins&&<span style={{fontFamily:"Martian Mono,monospace",fontSize:9.5,color:"var(--ink-4)"}}>~{t.estimatedMins}m</span>}
              {t.timeSpent>0&&<span style={{fontFamily:"Martian Mono,monospace",fontSize:9.5,color:"#059669"}}>⏱ {fmtDur(t.timeSpent)}</span>}
              {timerRunning&&<span className="timer-badge">⏱ Running</span>}
            </div>
            {t.note&&<div className="task-note">{t.note}</div>}
            {t.attachments?.length>0&&(
              <div style={{display:"flex",gap:5,marginTop:6,flexWrap:"wrap"}}>
                {t.attachments.map(a=>(
                  <div key={a.id} style={{borderRadius:5,overflow:"hidden",border:"1px solid var(--line)",cursor:a.type.startsWith("image/")?"pointer":"default",fontSize:11,position:"relative"}}
                    onClick={()=>a.type.startsWith("image/")&&setTaskLightbox({data:a.data,name:a.name})}>
                    {a.type.startsWith("image/")?<img src={a.data} alt={a.name} style={{height:48,width:48,objectFit:"cover",display:"block"}}/>:<span style={{padding:"4px 7px",display:"block",color:"var(--ink-3)"}}>📄 {a.name.slice(0,15)}</span>}
                    {a.type.startsWith("image/")&&<div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0)",transition:"background .15s"}} onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,.35)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(0,0,0,0)"}><span style={{color:"#fff",fontSize:14,opacity:0,transition:"opacity .15s"}} onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0}>🔍</span></div>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{display:"flex",gap:4,alignItems:"flex-start"}}>
            {!t.done&&<button className="btn btn-ghost btn-xs" title="Focus Mode" onClick={()=>startFocus(t,key)} style={{fontSize:12}}>🎯</button>}
            {!t.done&&(timerRunning
              ?<button className="btn btn-amber btn-xs" onClick={()=>stopTimer(t.id,t.title,activeBrand,brandTab,key)}>Stop</button>
              :<button className="btn btn-ghost btn-xs" onClick={()=>startTimer(t.id,t.title,activeBrand,brandTab)}>⏱</button>
            )}
            <button className="task-del" onClick={()=>deleteTask(key,t.id)}>✕</button>
          </div>
        </div>
      );
    };

    return (
      <div className="anim-up">
        {/* Brand header */}
        <div className="brand-hdr">
          <div className="brand-logo" style={{background:currentBrand.bg}}>{currentBrand.emoji}</div>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{fontFamily:"Martian Mono,monospace",fontSize:15,fontWeight:600,color:currentBrand.color,letterSpacing:.5}}>{currentBrand.name.toUpperCase()}</div>
              {brandStat?.hg&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",width:30,height:30,borderRadius:7,background:brandStat.hg.color+"18",border:"1.5px solid "+brandStat.hg.color+"40"}}>
                <span style={{fontFamily:"Martian Mono,monospace",fontSize:14,fontWeight:700,color:brandStat.hg.color}}>{brandStat.hg.grade}</span>
              </div>}
            </div>
            <div style={{display:"flex",gap:12,marginTop:6,flexWrap:"wrap"}}>
              {[[brandStat?.tasks||0,"Tasks","var(--ink-4)"],[brandStat?.done||0,"Done","#059669"],[brandStat?.pending||0,"Pending","#D97706"],[brandStat?.overdue||0,"Overdue",brandStat?.overdue?"#DC2626":"var(--ink-4)"],[fmtDur(brandStat?.timeSpent||0),"Tracked","#7C3AED"]].map(([v,l,c])=>(
                <div key={l} style={{display:"flex",gap:5,alignItems:"center"}}>
                  <span style={{fontFamily:"Martian Mono,monospace",fontSize:16,fontWeight:600,color:c,lineHeight:1}}>{v}</span>
                  <span style={{fontSize:10.5,color:"var(--ink-4)"}}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
            <div style={{width:160}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:11,color:"var(--ink-4)"}}>Completion</span><span style={{fontFamily:"Martian Mono,monospace",fontSize:11,color:currentBrand.color,fontWeight:500}}>{brandStat?.rate||0}%</span></div>
              <div className="prog-track"><div className="prog-fill" style={{width:`${brandStat?.rate||0}%`,background:currentBrand.color}}/></div>
            </div>
            <button className="ai-btn" style={{fontSize:10.5}} disabled={insightLoading[bik]}
              onClick={()=>fetchInsight(bik,`Analyse ${currentBrand.name} in depth. Status, risks, 3 specific actions for today. Reference actual task details if any exist.`)}>
              {insightLoading[bik]?"...":"◎ AI Brand Analysis"}
            </button>
          </div>
        </div>

        {insights[bik]&&<AIPanel insight={insights[bik]} loading={insightLoading[bik]} label={`◎ AI — ${currentBrand.name.toUpperCase()}`}/>}

        <div className="tab-bar mb16">
          {BRAND_TABS.map(t=><button key={t} className={`tab-btn${brandTab===t?" active":""}`} onClick={()=>setBrandTab(t)}>{t}</button>)}
        </div>

        {/* Controls row */}
        <div className="row-sb mb14 gap8">
          <div className="row gap6 flex1 mw0">
            <div className="inp-wrap flex1">
              <span className="inp-icon">🔍</span>
              <input className="inp has-icon" placeholder={`Search ${brandTab} tasks...`} value={searchQ} onChange={e=>setSearchQ(e.target.value)}/>
            </div>
            <div className="pill-tabs">
              {["all","pending","done","overdue"].map(f=>(
                <div key={f} className={`pill-tab${taskFilter===f?" active":""}`} onClick={()=>setTaskFilter(f)}>
                  {f.charAt(0).toUpperCase()+f.slice(1)}
                </div>
              ))}
            </div>
          </div>
          <div className="row gap6">
            <div className="tab-bar" style={{padding:2,gap:1}}>
              {[["list","☰ List"],["kanban","⬛ Kanban"]].map(([v,l])=>(
                <button key={v} className={`tab-btn${brandView===v?" active":""}`} style={{padding:"5px 12px",fontSize:11.5}} onClick={()=>setBrandView(v)}>{l}</button>
              ))}
            </div>
            <button className="btn btn-primary btn-sm" onClick={()=>setShowTaskModal(true)}>+ Task</button>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedTasks.size>0&&(
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 16px",background:"#EFF4FF",border:"1px solid #BFDBFE",borderRadius:10,marginBottom:12}}>
            <span style={{fontFamily:"Martian Mono,monospace",fontSize:10,color:"#2563EB",fontWeight:600}}>{selectedTasks.size} SELECTED</span>
            <button className="btn btn-primary btn-sm" onClick={()=>bulkComplete(key,selectedTasks)}>✓ Complete All</button>
            <button className="btn btn-ghost btn-sm" style={{color:"#DC2626",borderColor:"#FCA5A5"}} onClick={()=>{if(window.confirm("Delete "+selectedTasks.size+" tasks?"))bulkDelete(key,selectedTasks);}}>🗑 Delete</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>setSelectedTasks(new Set(filteredTasks.map(t=>t.id)))}>Select All</button>
            <button className="btn btn-ghost btn-sm" onClick={()=>setSelectedTasks(new Set())}>✕ Cancel</button>
          </div>
        )}
        {/* List view */}
        {brandView==="list"&&(
          <>
            {!filteredTasks.length
              ?<div className="empty-state"><div className="empty-icon">📋</div><div className="empty-title">No tasks</div><div className="empty-desc">Add your first {brandTab} task for {currentBrand.name}</div></div>
              :filteredTasks.map(t=><TaskItem key={t.id} t={t}/>)
            }
          </>
        )}

        {/* Kanban view */}
        {brandView==="kanban"&&(
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
            {KANBAN_COLS.map(col=>{
              const colTasks=tasks.filter(t=>t.kanbanStatus===col||(col==="done"&&t.done&&!t.kanbanStatus)||(col==="todo"&&!t.kanbanStatus&&!t.done));
              const colColors={todo:"#9099B8",inprogress:"#2563EB",done:"#059669"};
              return (
                <div key={col} style={{background:"var(--surface)",borderRadius:12,padding:12,minHeight:200}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:12}}>
                    <div style={{width:8,height:8,borderRadius:2,background:colColors[col]}}/>
                    <span style={{fontFamily:"Martian Mono,monospace",fontSize:9,fontWeight:600,color:colColors[col],letterSpacing:1.5,textTransform:"uppercase"}}>{KANBAN_LABELS[col]}</span>
                    <span style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"var(--ink-4)",marginLeft:"auto"}}>{colTasks.length}</span>
                  </div>
                  {colTasks.map(t=>(
                    <div key={t.id} style={{background:"var(--white)",border:"1px solid var(--line)",borderRadius:8,padding:"10px 12px",marginBottom:8,cursor:"pointer",transition:"box-shadow .15s",boxShadow:"var(--s0)"}}
                      onMouseEnter={e=>e.currentTarget.style.boxShadow="var(--s1)"} onMouseLeave={e=>e.currentTarget.style.boxShadow="var(--s0)"}>
                      <div style={{fontSize:12.5,fontWeight:500,color:"var(--ink)",marginBottom:6,lineHeight:1.4}}>{t.title}</div>
                      <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
                        {t.priority&&<span className={`badge ${t.priority==="low"?"badge-green":t.priority==="medium"?"badge-amber":t.priority==="high"?"badge-red":"badge-violet"}`}>{t.priority}</span>}
                        {t.due&&<span style={{fontFamily:"Martian Mono,monospace",fontSize:8.5,color:t.due<today&&!t.done?"#DC2626":"var(--ink-4)"}}>📅 {fmtDate(t.due)}</span>}
                        {t.timeSpent>0&&<span style={{fontFamily:"Martian Mono,monospace",fontSize:8.5,color:"#7C3AED"}}>⏱ {fmtDur(t.timeSpent)}</span>}
                      </div>
                      <div style={{display:"flex",gap:4}}>
                        {KANBAN_COLS.filter(c=>c!==col).map(c=>(
                          <button key={c} className="btn btn-ghost btn-xs" style={{fontSize:10,padding:"3px 8px"}} onClick={()=>moveKanban(key,t.id,c)}>→ {KANBAN_LABELS[c]}</button>
                        ))}
                        <button className="task-del" style={{opacity:1,marginLeft:"auto"}} onClick={()=>deleteTask(key,t.id)}>✕</button>
                      </div>
                    </div>
                  ))}
                  <button className="btn btn-ghost btn-xs w-full" style={{fontSize:11,marginTop:4}} onClick={()=>{setShowTaskModal(true);}}>+ Add task</button>
                </div>
              );
            })}
          </div>
        )}

        {/* AI task recs */}
        <div style={{marginTop:16}}>
          <button className="ai-btn" disabled={insightLoading[`${bik}_tasks`]}
            onClick={()=>fetchInsight(`${bik}_tasks`,`For ${currentBrand.name} ${brandTab}: immediate task priorities, what's at risk, 3 specific recommendations.`)}>
            {insightLoading[`${bik}_tasks`]?"...":"◎ AI Task Recommendations"}
          </button>
          {insights[`${bik}_tasks`]&&<div className="ai-panel mt8"><div className="ai-panel-title">◎ TASK RECOMMENDATIONS</div><div className="ai-panel-text">{insights[`${bik}_tasks`]}</div></div>}
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════
  //  TIME LOG
  // ══════════════════════════════════════════════════════════
  const renderTimeLog=()=>{
    const logs=(data.timelog||[]).filter(l=>logFilter==="all"||l.type===logFilter);
    return (
      <div className="anim-up">
        <AIPanel insight={insights["timelog"]} loading={insightLoading["timelog"]}
          onRefresh={()=>fetchInsight("timelog","Analyse my activity log. What patterns concern you? Am I spending time on the right things? 2 specific recommendations.")}
          label="◎ AI ACTIVITY ANALYSIS"/>
        <div className="row-sb mb16">
          <div><div className="section-title" style={{marginBottom:4}}>ACTIVITY LOG</div><div style={{fontSize:12,color:"var(--ink-4)"}}>Full timestamped audit trail</div></div>
          <div className="row gap8">
            <select className="sel" style={{width:160,padding:"6px 10px",fontSize:12}} value={logFilter} onChange={e=>setLogFilter(e.target.value)}>
              <option value="all">All Activity</option>
              {Object.entries(LOG_TYPES).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm" onClick={()=>{if(window.confirm("Clear all logs?"))setData(p=>({...p,timelog:[]}));}}>Clear</button>
          </div>
        </div>
        <div className="g4 mb16">
          {[{l:"TOTAL ACTIONS",v:(data.timelog||[]).length,c:"#2563EB"},{l:"TASKS ADDED",v:(data.timelog||[]).filter(l=>l.type==="task_added").length,c:"#059669"},{l:"COMPLETED",v:(data.timelog||[]).filter(l=>l.type==="task_done").length,c:"#D97706"},{l:"TIME SESSIONS",v:(data.timelog||[]).filter(l=>l.type==="timer_stop").length,c:"#7C3AED"}].map(s=>(
            <div key={s.l} className="card" style={{padding:"14px 16px"}}>
              <span className="kpi-label-top">{s.l}</span>
              <span style={{fontFamily:"Martian Mono,monospace",fontSize:28,fontWeight:600,color:s.c,lineHeight:1,letterSpacing:-1,display:"block"}}>{s.v}</span>
            </div>
          ))}
        </div>
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div style={{padding:"10px 16px",borderBottom:"1px solid var(--line)",display:"grid",gridTemplateColumns:"110px 1fr 120px 100px",gap:8}}>
            {["TIMESTAMP","ACTION","BRAND","TYPE"].map(h=><span key={h} style={{fontFamily:"Martian Mono,monospace",fontSize:8,color:"var(--ink-4)",letterSpacing:1.5}}>{h}</span>)}
          </div>
          <div style={{maxHeight:500,overflowY:"auto"}}>
            {!logs.length&&<div style={{padding:32,textAlign:"center",color:"var(--ink-4)",fontSize:12.5}}>No activity logged yet</div>}
            {logs.map((l,i)=>{
              const lt=LOG_TYPES[l.type]||{color:"#9099B8",label:l.type};
              const brand=BRANDS.find(b=>b.id===l.brand);
              return (
                <div key={l.id} style={{display:"grid",gridTemplateColumns:"110px 1fr 120px 100px",gap:8,padding:"10px 16px",borderBottom:i<logs.length-1?"1px solid var(--surface)":"none",alignItems:"start",transition:"background .12s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="var(--surface)"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <div style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"var(--ink-4)"}}>
                    <div>{new Date(l.ts).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}</div>
                    <div>{fmtTime(l.ts)}</div>
                  </div>
                  <div>
                    <div style={{fontSize:12.5,color:"var(--ink)",fontWeight:500}}>{l.title}</div>
                    {l.detail&&<div style={{fontSize:11,color:"var(--ink-4)",marginTop:2}}>{l.detail}</div>}
                  </div>
                  <div style={{fontSize:12,color:brand?.color||"var(--ink-4)",fontWeight:brand?500:400}}>
                    {brand?`${brand.emoji} ${brand.name}`:"—"}
                    {l.brandTab&&<div style={{fontSize:10,color:"var(--ink-4)"}}>{l.brandTab}</div>}
                  </div>
                  <span style={{display:"inline-flex",alignItems:"center",gap:5}}>
                    <div style={{width:5,height:5,borderRadius:"50%",background:lt.color,flexShrink:0}}/>
                    <span style={{fontFamily:"Martian Mono,monospace",fontSize:8.5,color:lt.color,letterSpacing:.5}}>{lt.label}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════
  //  ANALYTICS
  // ══════════════════════════════════════════════════════════
  const renderAnalytics=()=>{
    const allTasks=Object.values(data.tasks).flat();
    const pieData=bStats.filter(b=>b.tasks>0).map(b=>({name:b.name,value:b.tasks,color:b.color}));
    const completionData=bStats.map(b=>({name:b.name,rate:b.rate,done:b.done,pending:b.pending}));
    const catCount={};
    allTasks.forEach(t=>{if(t.category)(catCount[t.category]=(catCount[t.category]||0)+1);});
    const catData=Object.entries(catCount).sort((a,b)=>b[1]-a[1]).map(([n,v])=>({name:n,value:v}));
    // time spent by brand
    const timeData=bStats.filter(b=>b.timeSpent>0).map(b=>({name:b.name,hours:Math.round(b.timeSpent/3600000*10)/10,color:b.color}));
    // week-over-week
    const weeks=Array.from({length:4},(_,i)=>{
      const end=new Date(); end.setDate(end.getDate()-(i*7));
      const start=new Date(end); start.setDate(start.getDate()-7);
      const es=start.toISOString().split("T")[0]; const ee=end.toISOString().split("T")[0];
      const weekTasks=allTasks.filter(t=>t.createdAt>=es&&t.createdAt<=ee);
      return {week:`-${i+1}w`,added:weekTasks.length,done:weekTasks.filter(t=>t.done).length};
    }).reverse();
    return (
      <div className="anim-up">
        <AIPanel insight={insights["analytics"]} loading={insightLoading["analytics"]}
          onRefresh={()=>fetchInsight("analytics","Comprehensive analytics review: completion rates, underperforming brands, resource allocation, 3 strategic recommendations to improve productivity score.")}
          label="◎ AI ANALYTICS INTELLIGENCE"/>
        {/* Health grades grid */}
        <div className="card mb14">
          <div className="card-header"><span className="card-title">BRAND HEALTH GRADES</span></div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:8}}>
            {bStats.map(b=>(
              <div key={b.id} onClick={()=>{setActiveBrand(b.id);setView("brand");}} style={{textAlign:"center",padding:"12px 8px",border:"1px solid var(--line)",borderRadius:10,cursor:"pointer",transition:"background .12s"}}
                onMouseEnter={e=>e.currentTarget.style.background="var(--surface)"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                <div style={{fontSize:18,marginBottom:5}}>{b.emoji}</div>
                <div style={{fontFamily:"Martian Mono,monospace",fontSize:26,fontWeight:700,color:b.hg?.color||"#9099B8",lineHeight:1,marginBottom:3}}>{b.hg?.grade||"—"}</div>
                <div style={{fontSize:10,fontWeight:500,color:"var(--ink-3)",marginBottom:3}}>{b.name}</div>
                <div style={{fontSize:9.5,color:b.hg?.color||"var(--ink-4)"}}>{b.hg?.label}</div>
                {b.overdue>0&&<div style={{fontFamily:"Martian Mono,monospace",fontSize:8,color:"#DC2626",marginTop:3}}>⚠ {b.overdue} OVR</div>}
              </div>
            ))}
          </div>
        </div>
        <div className="g4 mb16">
          {[{l:"PRODUCTIVITY SCORE",v:`${score}/100`,c:score>=70?"#059669":"#D97706"},{l:"COMPLETION RATE",v:`${stats.rate}%`,c:"#2563EB"},{l:"TOTAL TIME TRACKED",v:fmtDur(stats.totalTimeSpent),c:"#7C3AED"},{l:"ACTIVE BRANDS",v:bStats.filter(b=>b.tasks>0).length,c:"#B45309"}].map(s=>(
            <div key={s.l} className="kpi-card" style={{borderTop:"none",borderLeft:`3px solid ${s.c}`}}>
              <span className="kpi-label-top">{s.l}</span>
              <span style={{fontFamily:"Martian Mono,monospace",fontSize:28,fontWeight:600,color:s.c,lineHeight:1,display:"block",marginBottom:4,letterSpacing:-1}}>{s.v}</span>
            </div>
          ))}
        </div>
        <div className="g2 mb14">
          <div className="card">
            <div className="card-header"><span className="card-title">COMPLETION BY BRAND</span>
              <button className="ai-btn" style={{fontSize:10,padding:"3px 10px"}} disabled={insightLoading["brand_chart"]} onClick={()=>fetchInsight("brand_chart","Which brands are completion outliers? What's causing the gap? Specific actions to bring lowest performers up.")}>◎ Insight</button>
            </div>
            {insights["brand_chart"]&&<div className="ai-panel mb12"><div className="ai-panel-title">◎ INSIGHT</div><div className="ai-panel-text">{insights["brand_chart"]}</div></div>}
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={completionData} layout="vertical" margin={{left:50}}>
                <XAxis type="number" domain={[0,100]} tick={{fontFamily:"Martian Mono,monospace",fontSize:9,fill:"var(--ink-4)"}} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="name" tick={{fontFamily:"Martian Mono,monospace",fontSize:9,fill:"var(--ink-4)"}} axisLine={false} tickLine={false} width={50}/>
                <Tooltip content={<CT/>}/>
                <Bar dataKey="rate" name="Rate %" radius={[0,3,3,0]}>{completionData.map((e,i)=><Cell key={i} fill={bStats.find(b=>b.name===e.name)?.color||"#2563EB"}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">TASKS BY BRAND</span></div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                  {pieData.map((e,i)=><Cell key={i} fill={e.color}/>)}
                </Pie>
                <Tooltip content={<CT/>}/>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"var(--ink-4)"}}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Time spent report */}
        {timeData.length>0&&(
          <div className="card mb14">
            <div className="card-header">
              <span className="card-title">TIME SPENT BY BRAND</span>
              <button className="ai-btn" style={{fontSize:10,padding:"3px 10px"}} disabled={insightLoading["time_report"]} onClick={()=>fetchInsight("time_report","Based on time spent per brand, am I allocating my time correctly? Which brand deserves more/less attention? 2 sentences.")}>◎ Analyse</button>
            </div>
            {insights["time_report"]&&<div className="ai-panel mb12"><div className="ai-panel-title">◎ TIME ANALYSIS</div><div className="ai-panel-text">{insights["time_report"]}</div></div>}
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={timeData}>
                <XAxis dataKey="name" tick={{fontFamily:"Martian Mono,monospace",fontSize:9,fill:"var(--ink-4)"}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontFamily:"Martian Mono,monospace",fontSize:9,fill:"var(--ink-4)"}} axisLine={false} tickLine={false}/>
                <Tooltip content={<CT/>}/>
                <Bar dataKey="hours" name="Hours" radius={[3,3,0,0]}>{timeData.map((e,i)=><Cell key={i} fill={e.color}/>)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Week over week */}
        <div className="card mb14">
          <div className="card-header">
            <span className="card-title">WEEK-OVER-WEEK TREND</span>
            <button className="ai-btn" style={{fontSize:10,padding:"3px 10px"}} disabled={insightLoading["wow"]} onClick={()=>fetchInsight("wow","Analyse my week-over-week trend. Am I improving? What does the trajectory look like? 2 sentences.")}>◎ Analyse</button>
          </div>
          {insights["wow"]&&<div className="ai-panel mb12"><div className="ai-panel-title">◎ TREND INSIGHT</div><div className="ai-panel-text">{insights["wow"]}</div></div>}
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={weeks}>
              <CartesianGrid vertical={false} stroke="var(--surface)"/>
              <XAxis dataKey="week" tick={{fontFamily:"Martian Mono,monospace",fontSize:9,fill:"var(--ink-4)"}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontFamily:"Martian Mono,monospace",fontSize:9,fill:"var(--ink-4)"}} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip content={<CT/>}/>
              <Line type="monotone" dataKey="added" name="Added" stroke="#2563EB" strokeWidth={2} dot={{r:3}}/>
              <Line type="monotone" dataKey="done"  name="Done"  stroke="#059669" strokeWidth={2} dot={{r:3}}/>
            </LineChart>
          </ResponsiveContainer>
        </div>

        {catData.length>0&&(
          <div className="card mb14">
            <div className="card-header"><span className="card-title">TASKS BY CATEGORY</span></div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={catData}>
                <XAxis dataKey="name" tick={{fontFamily:"Martian Mono,monospace",fontSize:9,fill:"var(--ink-4)"}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontFamily:"Martian Mono,monospace",fontSize:9,fill:"var(--ink-4)"}} axisLine={false} tickLine={false} allowDecimals={false}/>
                <Tooltip content={<CT/>}/>
                <Bar dataKey="value" name="Tasks" fill="#2563EB" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid var(--line)"}}><span className="card-title">FULL BRAND BREAKDOWN</span></div>
          <div className="overflow-x">
            <table className="data-table"><thead><tr>{["Brand","Total","Done","Pending","Overdue","Rate","Est. Time","Tracked"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>
              {bStats.map(b=>{
                const allBT=BRAND_TABS.flatMap(t=>getBrandTasks(b.id,t));
                const estMins=allBT.filter(t=>t.estimatedMins).reduce((s,t)=>s+(t.estimatedMins||0),0);
                return (
                  <tr key={b.id} style={{cursor:"pointer"}} onClick={()=>{setActiveBrand(b.id);setView("brand");}}>
                    <td><span style={{fontWeight:500,color:b.color}}>{b.emoji} {b.name}</span></td>
                    <td><span style={{fontFamily:"Martian Mono,monospace",fontSize:12}}>{b.tasks}</span></td>
                    <td><span style={{fontFamily:"Martian Mono,monospace",fontSize:12,color:"#059669"}}>{b.done}</span></td>
                    <td><span style={{fontFamily:"Martian Mono,monospace",fontSize:12,color:"#D97706"}}>{b.pending}</span></td>
                    <td><span style={{fontFamily:"Martian Mono,monospace",fontSize:12,color:b.overdue>0?"#DC2626":"var(--ink-4)"}}>{b.overdue}</span></td>
                    <td><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:60,height:4,background:"var(--surface)",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${b.rate}%`,background:b.color,borderRadius:99}}/></div><span style={{fontFamily:"Martian Mono,monospace",fontSize:11,color:b.color}}>{b.rate}%</span></div></td>
                    <td><span style={{fontFamily:"Martian Mono,monospace",fontSize:11,color:"var(--ink-4)"}}>{estMins?fmtDur(estMins*60000):"—"}</span></td>
                    <td><span style={{fontFamily:"Martian Mono,monospace",fontSize:11,color:"#7C3AED"}}>{b.timeSpent>0?fmtDur(b.timeSpent):"—"}</span></td>
                  </tr>
                );
              })}
            </tbody></table>
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════
  //  CALENDAR
  // ══════════════════════════════════════════════════════════
  const renderCalendar=()=>{
    const firstDay=new Date(calYear,calMonth,1).getDay();
    const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
    const today=todayStr();
    const cells=Array.from({length:firstDay+daysInMonth},(_,i)=>{
      const day=i-firstDay+1; if(day<1) return null;
      const dateStr=`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      const rems=data.reminders.filter(r=>r.date===dateStr);
      const dueTasks=Object.values(data.tasks).flat().filter(t=>t.due===dateStr&&!t.done);
      return {day,dateStr,rems,dueTasks};
    });
    return (
      <div className="anim-up">
        <AIPanel insight={insights["calendar"]} loading={insightLoading["calendar"]}
          onRefresh={()=>fetchInsight("calendar",`I have ${data.reminders.filter(r=>r.date>=todayStr()).length} reminders and ${Object.values(data.tasks).flat().filter(t=>!t.done&&t.due).length} tasks with due dates. Scheduling risks, deadline conflicts, what to prioritise this month?`)}
          label="◎ AI SCHEDULE INTELLIGENCE"/>
        <div className="g2 gap14">
          <div className="card">
            <div className="cal-nav">
              <button className="btn btn-ghost btn-sm" onClick={()=>{if(calMonth===0){setCalMonth(11);setCalYear(y=>y-1);}else setCalMonth(m=>m-1);}}>‹</button>
              <span className="cal-month">{MONTHS[calMonth]} {calYear}</span>
              <button className="btn btn-ghost btn-sm" onClick={()=>{if(calMonth===11){setCalMonth(0);setCalYear(y=>y+1);}else setCalMonth(m=>m+1);}}>›</button>
            </div>
            <div className="cal-grid">
              {WEEKDAYS.map(d=><div key={d} className="cal-day-hdr">{d.slice(0,2)}</div>)}
              {cells.map((c,i)=>c===null
                ?<div key={`e${i}`} className="cal-day cal-other"/>
                :<div key={c.dateStr} className={`cal-day${c.dateStr===today?" cal-today":""}${c.rems.length?" cal-has-rem":""}`}
                    onClick={()=>{setReminderDate(c.dateStr);setShowReminderModal(true);}}>
                  {c.day}
                  {(c.rems.length>0||c.dueTasks.length>0)&&<div className="cal-rem-dot" style={{background:c.dueTasks.length?"#DC2626":"var(--amber)"}}/>}
                </div>
              )}
            </div>
            <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid var(--line)",display:"flex",gap:12,fontSize:11,color:"var(--ink-4)"}}>
              <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:"50%",background:"#D97706"}}/> Reminder</div>
              <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:8,height:8,borderRadius:"50%",background:"#DC2626"}}/> Task due</div>
            </div>
          </div>
          <div>
            <div className="card mb14">
              <div className="card-header"><span className="card-title">UPCOMING REMINDERS</span><button className="btn btn-primary btn-sm" onClick={()=>setShowReminderModal(true)}>+ Add</button></div>
              {data.reminders.filter(r=>r.date>=todayStr()).length===0
                ?<div style={{fontSize:12.5,color:"var(--ink-4)",textAlign:"center",padding:"14px 0"}}>No upcoming reminders</div>
                :data.reminders.filter(r=>r.date>=todayStr()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,8).map(r=>{
                  const brand=BRANDS.find(b=>b.id===r.brand);
                  return (
                    <div key={r.id} className="rem-row">
                      <span className="rem-icon">🔔</span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:500,fontSize:13,color:"var(--ink)"}}>{r.title}</div>
                        <div style={{fontFamily:"Martian Mono,monospace",fontSize:9.5,color:"var(--ink-4)",marginTop:3}}>
                          {fmtDate(r.date)}{r.time?` · ${r.time}`:""}
                          {brand&&<span style={{color:brand.color}}> · {brand.name}</span>}
                        </div>
                        {r.note&&<div style={{fontSize:11.5,color:"var(--ink-4)",marginTop:3}}>{r.note}</div>}
                      </div>
                      <button className="task-del" style={{opacity:1}} onClick={()=>deleteReminder(r.id)}>✕</button>
                    </div>
                  );
                })
              }
            </div>
            <div className="card">
              <div className="card-header"><span className="card-title">OVERDUE TASKS</span></div>
              {Object.values(data.tasks).flat().filter(t=>!t.done&&t.due&&t.due<todayStr()).length===0
                ?<div style={{fontSize:12.5,color:"#059669",textAlign:"center",padding:"14px 0"}}>✓ All clear — no overdue tasks</div>
                :Object.entries(data.tasks).flatMap(([key,tasks])=>tasks.filter(t=>!t.done&&t.due&&t.due<todayStr()).map(t=>({...t,key}))).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,8).map(t=>{
                  const [bId,tab]=t.key.split("_");
                  const brand=BRANDS.find(b=>b.id===bId);
                  return (
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid var(--surface)"}}>
                      <div style={{width:6,height:6,borderRadius:"50%",background:"#DC2626",flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12.5,fontWeight:500,color:"var(--ink)"}}>{t.title}</div>
                        <div style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"#DC2626",marginTop:2}}>Overdue: {fmtDate(t.due)} · {brand?.emoji} {brand?.name} · {tab}</div>
                      </div>
                      <button className="btn btn-ghost btn-xs" onClick={()=>{setActiveBrand(bId);setView("brand");setTaskFilter("overdue");}}>View →</button>
                    </div>
                  );
                })
              }
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════
  //  PINBOARD
  // ══════════════════════════════════════════════════════════
  const renderPinboard=()=>(
    <div className="anim-up">
      <AIPanel insight={insights["pinboard"]} loading={insightLoading["pinboard"]}
        onRefresh={()=>fetchInsight("pinboard",`I have ${data.notes.length} notes. What patterns do you see? Any buried action items or strategic insights I should act on?`)}
        label="◎ AI NOTE ANALYSIS"/>
      <div className="row-sb mb16">
        <div>
          <div className="section-title" style={{marginBottom:4}}>PIN BOARD</div>
          <div style={{fontSize:12,color:"var(--ink-4)"}}>{data.notes.length} notes</div>
        </div>
        <div className="row gap8">
          <button className="ai-btn" disabled={insightLoading["pinboard_actions"]}
            onClick={()=>fetchInsight("pinboard_actions","Extract any action items or follow-ups from my pinboard notes. List them specifically.")}>
            {insightLoading["pinboard_actions"]?"...":"◎ Extract Actions"}
          </button>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowPinModal(true)}>+ New Note</button>
        </div>
      </div>
      {insights["pinboard_actions"]&&<AIPanel insight={insights["pinboard_actions"]} loading={false} label="◎ ACTION ITEMS FROM NOTES"/>}
      {!data.notes.length
        ?<div className="empty-state"><div className="empty-icon">📌</div><div className="empty-title">No notes yet</div><div className="empty-desc">Add ideas, strategies, and anything worth remembering</div></div>
        :<div className="pinboard">
          {data.notes.map(n=>(
            <div key={n.id} className="pin-card" style={{background:n.color}}>
              <button className="pin-del" onClick={e=>{e.stopPropagation();setData(p=>({...p,notes:p.notes.filter(x=>x.id!==n.id)}))}}>✕</button>
              {n.title&&<div className="pin-title">{n.title}</div>}
              <div className="pin-content">{n.content}</div>
              <div className="pin-footer">{fmtDateTime(n.createdAt)}</div>
            </div>
          ))}
        </div>
      }
    </div>
  );

  // ══════════════════════════════════════════════════════════
  //  AI ASSISTANT
  // ══════════════════════════════════════════════════════════
  const renderAI=()=>(
    <div className="anim-up">
      <div className="g2 gap14">
        <div>
          <div className="chat-container">
            <div className="chat-head">
              <div className="chat-avatar">◎</div>
              <div style={{flex:1}}>
                <div className="chat-name">PRODASH AI</div>
                <div className="chat-sub">Full data access · Live intelligence · Your personal advisor</div>
              </div>
              <div className="chat-online"/>
            </div>
            <div className="chat-msgs">
              {!chatMsgs.length&&(
                <div style={{margin:"auto",textAlign:"center",padding:"20px 0"}}>
                  <div style={{fontSize:28,marginBottom:12,color:"var(--ai-border)"}}>◎</div>
                  <div style={{fontSize:13,color:"var(--ink-4)",marginBottom:5,fontWeight:500}}>Full visibility of all your data</div>
                  <div style={{fontSize:12,color:"var(--ink-5)",maxWidth:300,margin:"0 auto 16px",lineHeight:1.6}}>Every task, brand, overdue item, time log, note and reminder. Ask me anything.</div>
                  <div className="ai-suggestions">
                    {["What should I focus on today?","Which brand is at most risk?","Am I on track this week?","Analyse my productivity","What are my top 3 risks?","Plan my day for maximum output","Where am I spending most time?","Give me a weekly forecast","What recurring tasks do I have?","Which tasks are most overdue?"].map(s=>(
                      <button key={s} className="ai-suggestion" onClick={()=>{setChatInput(s);setTimeout(()=>sendMessage(),50);}}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {chatMsgs.map((m,i)=><div key={i} className={`chat-msg ${m.role}`}>{m.content}</div>)}
              {aiLoading&&<div className="chat-msg assistant"><span className="typing-dots"><span/><span/><span/></span></div>}
              <div ref={chatEndRef}/>
            </div>
            <div className="chat-footer">
              <input className="inp" style={{flex:1}} placeholder="Ask anything about your tasks, brands, priorities..." value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&sendMessage()}/>
              <button className="btn btn-primary" onClick={sendMessage} disabled={!chatInput.trim()||aiLoading}>Send →</button>
            </div>
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div style={{background:"linear-gradient(135deg,var(--ai-bg) 0%,#E0E7FF 55%,var(--violet-lt) 100%)",border:"1px solid var(--ai-border)",borderRadius:16,padding:"18px 20px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,var(--blue),var(--indigo),var(--violet),var(--blue))",backgroundSize:"200%",animation:"brief-line 4s linear infinite"}}/>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <ScoreRing score={score} size={64}/>
              <div>
                <div style={{fontFamily:"Martian Mono,monospace",fontSize:7.5,color:"var(--indigo)",letterSpacing:2,marginBottom:4,textTransform:"uppercase"}}>PRODUCTIVITY SCORE</div>
                <div style={{fontFamily:"Martian Mono,monospace",fontSize:26,fontWeight:600,color:"var(--ink)",lineHeight:1,letterSpacing:-1}}>{score}<span style={{fontSize:13,color:"var(--ink-4)",fontWeight:400}}>/100</span></div>
                <div style={{fontSize:11,color:"var(--ink-3)",marginTop:3}}>{score>=80?"Excellent":score>=60?"Good — improving":score>=40?"Needs focus":"Alert — take action"}</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[[`${stats.rate}%`,"Rate","#059669"],[`${stats.overdue}`,"Overdue","#DC2626"],[`${stats.todayDone}/${stats.todayTotal}`,"Today","#2563EB"],[fmtDur(stats.totalTimeSpent),"Tracked","#7C3AED"]].map(([v,l,c])=>(
                <div key={l} style={{background:"rgba(255,255,255,.6)",borderRadius:8,padding:"9px 11px"}}>
                  <div style={{fontFamily:"Martian Mono,monospace",fontSize:16,fontWeight:600,color:c,lineHeight:1,letterSpacing:-.5}}>{v}</div>
                  <div style={{fontFamily:"Martian Mono,monospace",fontSize:7.5,color:"var(--ink-4)",letterSpacing:1,marginTop:4,textTransform:"uppercase"}}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><span className="card-title">◎ SMART ACTIONS</span></div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[
                {l:"What did I miss this week?",p:"What tasks or items did I miss, forget, or leave incomplete this week? Specific list."},
                {l:"Prioritise my overdue tasks",p:`${stats.overdue} overdue tasks. Rank by business impact. Which to tackle first and why?`},
                {l:"How to improve my score?",p:`My score is ${score}/100. 4 specific achievable actions to improve it today.`},
                {l:"Time allocation review",p:`I've tracked ${fmtDur(stats.totalTimeSpent)} total. Am I spending time on the right brands and tasks? What should change?`},
                {l:"Weekly performance review",p:"Concise weekly review: what went well, what didn't, what to change next week."},
                {l:"Strategic recommendations",p:"Top 3 strategic recommendations for running my 6 brands more effectively."},
              ].map(s=>(
                <button key={s.l} className="ai-btn" style={{justifyContent:"flex-start",borderRadius:8,padding:"8px 12px",fontSize:12,textAlign:"left"}}
                  onClick={()=>{if(s.action){s.action();}else{setChatInput(s.p);setTimeout(()=>sendMessage(),50);}}}>
                  → {s.l}
                </button>
              ))}
            </div>
          </div>
          {stats.overdue>0&&(
            <div className="card" style={{borderLeft:"3px solid #DC2626"}}>
              <div className="card-header"><span className="card-title" style={{color:"#DC2626"}}>⚠ ALERTS</span></div>
              {bStats.filter(b=>b.overdue>0).map(b=>(
                <div key={b.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:"1px solid var(--surface)"}}>
                  <span style={{fontSize:14}}>{b.emoji}</span>
                  <div style={{flex:1}}>
                    <span style={{fontWeight:500,fontSize:12.5,color:b.color}}>{b.name}</span>
                    <span style={{fontFamily:"Martian Mono,monospace",fontSize:9.5,color:"#DC2626",marginLeft:8}}>{b.overdue} overdue</span>
                  </div>
                  <button className="btn btn-ghost btn-xs" onClick={()=>{setActiveBrand(b.id);setView("brand");setTaskFilter("overdue");}}>View →</button>
                </div>
              ))}
            </div>
          )}
          {/* Notification enable */}
          {notifPerm!=="granted"&&(
            <div className="card" style={{background:"var(--amber-lt)",borderColor:"rgba(217,119,6,.3)"}}>
              <div style={{fontWeight:600,fontSize:13,marginBottom:5,color:"#92400E"}}>🔔 Enable Notifications</div>
              <div style={{fontSize:12,color:"#B45309",marginBottom:10}}>Get browser alerts when reminders are due — even when another tab is open.</div>
              <button className="btn btn-amber btn-sm" onClick={requestNotifPermission}>Enable Browser Notifications</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  //  MAIN RETURN
  // ══════════════════════════════════════════════════════════
  const pageTitle=view==="brand"&&currentBrand?currentBrand.name.toUpperCase():{dashboard:"DASHBOARD",timelog:"TIME LOG",analytics:"ANALYTICS",calendar:"CALENDAR",pinboard:"PIN BOARD",ai:"AI ASSISTANT"}[view]||"";

  return (
    <div className="app">
      {showConfetti&&<Confetti/>}
      {focusMode&&<FocusOverlay
        task={focusMode.task} secs={focusSecs} running={focusRunning}
        elapsed={focusStarted?Date.now()-focusStarted:0}
        onToggle={()=>setFocusRunning(r=>!r)}
        onReset={()=>{setFocusSecs(POMODORO_MINS*60);setFocusRunning(false);setFocusStarted(Date.now());}}
        onDone={(markDone)=>endFocus(markDone)}
        onExit={()=>endFocus(false)}/>}
      <div className={`mob-overlay${sidebarOpen?" open":""}`} onClick={()=>setSidebarOpen(false)}/>
      <nav className={`sidebar${sidebarOpen?" open":""}`}>
        <div className="logo-area">
          <div className="logo">
            <div className="logo-icon">⚡</div>
            <span className="logo-text">PRODASH</span>
            <span className="logo-badge">LIVE</span>
          </div>
          <div className="logo-date">{new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</div>
        </div>
        <div className="nav-section">
          <div className="nav-section-label">Navigate</div>
          {NAV_ITEMS.map(item=>(
            <div key={item.id} className={`nav-item${view===item.id&&!activeBrand?" active":""}`} onClick={()=>{setView(item.id);setActiveBrand(null);setSidebarOpen(false);}}>
              <span className="nav-icon">{item.icon}</span>{item.label}
            </div>
          ))}
        </div>
        <div className="nav-section">
          <div className="nav-section-label">Brands</div>
          {BRANDS.map(b=>{
            const bs=bStats.find(x=>x.id===b.id);
            return (
              <div key={b.id} className={`nav-item${view==="brand"&&activeBrand===b.id?" active":""}`}
                onClick={()=>{setActiveBrand(b.id);setView("brand");setBrandTab("Reporting");setTaskFilter("all");setSearchQ("");setSidebarOpen(false);}}>
                <div className="brand-marker" style={{background:b.color}}/>
                {b.emoji} {b.name}
                {bs?.overdue>0&&<div className="nav-alert"/>}
              </div>
            );
          })}
        </div>
        <div className="sidebar-stats">
          {(streak.current||0)>0&&<div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"rgba(245,158,11,.1)",borderRadius:8,marginBottom:10,border:"1px solid rgba(245,158,11,.2)"}}>
            <span style={{fontSize:16}}>🔥</span>
            <div><div style={{fontFamily:"Martian Mono,monospace",fontSize:13,fontWeight:700,color:"#F59E0B",lineHeight:1}}>{streak.current} day streak</div>
              <div style={{fontSize:10,color:"rgba(245,158,11,.6)",marginTop:2}}>Best: {streak.best||0} days</div>
            </div>
          </div>}
          <div className="sidebar-stats-row">
            <div><div className="ss-val">{stats.done}</div><div className="ss-lbl">Done</div></div>
            <div style={{textAlign:"right"}}><div className="ss-val" style={{color:"var(--ink-4)"}}>{stats.pending}</div><div className="ss-lbl">Left</div></div>
          </div>
          <div className="sidebar-prog"><div className="sidebar-prog-fill" style={{width:`${stats.rate}%`}}/></div>
          <div className="sidebar-rate">{stats.rate}% completion · Score {score}</div>
          <div style={{display:"flex",gap:6,marginTop:10}}>
            <button className="btn btn-ghost btn-xs w-full" style={{fontSize:10}} onClick={exportData}>↓ Export</button>
            <label className="btn btn-ghost btn-xs w-full" style={{fontSize:10,cursor:"pointer",textAlign:"center"}}>
              ↑ Import<input type="file" accept=".json" style={{display:"none"}} onChange={e=>e.target.files[0]&&importData(e.target.files[0])}/>
            </label>
          </div>
        </div>
      </nav>

      <div className="main">
        <div className="topbar">
          <div className="row gap10">
            <button className="hamburger" onClick={()=>setSidebarOpen(p=>!p)}><span/><span/><span/></button>
            <span className="page-title">{pageTitle}</span>
            {view==="brand"&&currentBrand&&(
              <div style={{display:"flex",gap:6}}>
                {BRAND_TABS.map(t=><button key={t} className={`btn btn-xs${brandTab===t?" btn-dark":" btn-ghost"}`} onClick={()=>setBrandTab(t)}>{t}</button>)}
              </div>
            )}
          </div>
          <div className="topbar-right">
            {/* Global search */}
            <button className="btn btn-ghost btn-xs" style={{gap:8,fontFamily:"Inter,sans-serif"}} onClick={()=>setShowGlobalSearch(true)}>
              🔍 <span style={{color:"var(--ink-4)"}}>Search</span>
              <kbd style={{fontFamily:"Martian Mono,monospace",fontSize:8,padding:"2px 5px",background:"var(--surface)",border:"1px solid var(--line-2)",borderRadius:3,color:"var(--ink-4)"}}>⌘K</kbd>
            </button>
            {/* Dark mode toggle */}
            <button className="btn btn-ghost btn-xs btn-icon" onClick={()=>setDarkMode(p=>!p)} title="Toggle dark mode (T)">{darkMode?"☀️":"🌙"}</button>
            {/* Shortcuts */}
            <button className="btn btn-ghost btn-xs btn-icon" onClick={()=>setShowShortcuts(true)} title="Keyboard shortcuts">⌨️</button>
            <div style={{fontFamily:"Martian Mono,monospace",fontSize:9,padding:"4px 10px",background:score>=70?"var(--green-lt)":score>=50?"var(--amber-lt)":"var(--red-lt)",borderRadius:99,color:score>=70?"#059669":score>=50?"#D97706":"#DC2626",fontWeight:600,letterSpacing:.5,border:`1px solid ${score>=70?"#A7F3D0":score>=50?"#FDE68A":"#FCA5A5"}`}}>◎ {score}</div>
            {data.reminders.filter(r=>r.date>=todayStr()).length>0&&(
              <button className="bell-btn" onClick={()=>setView("calendar")}>🔔<span className="bell-count">{data.reminders.filter(r=>r.date>=todayStr()).length}</span></button>
            )}
            <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:99,background:dbStatus==="ok"?"var(--green-lt)":dbStatus==="loading"?"var(--ai-bg)":"var(--red-lt)",border:`1px solid ${dbStatus==="ok"?"#A7F3D0":dbStatus==="loading"?"var(--ai-border)":"#FCA5A5"}`}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:dbStatus==="ok"?"#059669":dbStatus==="loading"?"#2563EB":"#DC2626",boxShadow:dbStatus==="ok"?"0 0 6px #059669":"none"}}/>
              <span style={{fontFamily:"Martian Mono,monospace",fontSize:8,color:dbStatus==="ok"?"#059669":dbStatus==="loading"?"#2563EB":"#DC2626",fontWeight:600,letterSpacing:.5}}>{dbStatus==="ok"?"CLOUD":dbStatus==="loading"?"SYNC...":"LOCAL"}</span>
            </div>
            {stats.overdue>0&&<button onClick={()=>setView("warroom")} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 10px",background:"rgba(220,38,38,.1)",border:"1px solid rgba(220,38,38,.3)",borderRadius:99,fontFamily:"Martian Mono,monospace",fontSize:8.5,color:"#DC2626",cursor:"pointer",fontWeight:600}}>⚔ WAR ROOM <span style={{background:"#DC2626",color:"#fff",borderRadius:99,padding:"0 5px",fontSize:7.5,marginLeft:2}}>{stats.overdue}</span></button>}
            <div className="topbar-date">{new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</div>
            <div className="topbar-dot" style={{background:"#4ADE80",boxShadow:"0 0 8px #4ADE80"}}/>
          </div>
        </div>

        {/* Quick add bar */}
        {(view==="dashboard"||view==="brand")&&(
          <div style={{background:"var(--ai-bg)",borderBottom:"1px solid var(--ai-border)",padding:"8px 26px",display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
            <span style={{fontFamily:"Martian Mono,monospace",fontSize:7.5,color:"var(--indigo)",letterSpacing:2,textTransform:"uppercase",whiteSpace:"nowrap"}}>QUICK ADD</span>
            <input className="inp" style={{flex:1,maxWidth:420,padding:"6px 12px",fontSize:12.5,background:"rgba(255,255,255,.7)",border:"1px solid var(--ai-border)"}}
              placeholder={`New task${currentBrand?" for "+currentBrand.name:""}... press Enter to add`}
              onKeyDown={e=>{if(e.key==="Enter"&&e.target.value.trim()){addTask({title:e.target.value.trim(),priority:"medium",brand:activeBrand||"goldbet",tab:brandTab});e.target.value="";}}}/>
            <button className="btn btn-primary btn-sm" onClick={()=>setShowTaskModal(true)}>+ Full Details</button>
            <button className="btn btn-ai btn-sm" onClick={()=>setShowPinModal(true)}>📌 Note</button>
            <button className="btn btn-ai btn-sm" onClick={()=>setShowReminderModal(true)}>🔔 Remind</button>
          </div>
        )}

        <div className="page-content">
          {view==="dashboard"&&renderDashboard()}
          {view==="warroom"  &&<div style={{flex:1,overflow:"auto"}}>{renderWarRoom()}</div>}
          {view==="timelog" &&renderTimeLog()}
          {view==="brand"  &&renderBrand()}
          {view==="analytics"&&renderAnalytics()}
          {view==="calendar" &&renderCalendar()}
          {view==="pinboard" &&renderPinboard()}
          {view==="ai"       &&renderAI()}
        </div>
      </div>

      {showTaskModal    &&<TaskModal onSave={addTask} onClose={()=>setShowTaskModal(false)} brandId={activeBrand} tab={brandTab} brands={BRANDS}/>}
      {showPinModal     &&<PinModal onSave={addNote} onClose={()=>setShowPinModal(false)}/>}
      {showReminderModal&&<ReminderModal onSave={addReminder} onClose={()=>setShowReminderModal(false)} defaultDate={reminderDate}/>}
      {showAIGen&&<AIGenModal onAddTasks={(forms)=>forms.forEach(f=>addTask(f))} onClose={()=>setShowAIGen(false)} brandId={activeBrand||"goldbet"} tab={brandTab} apiKey={API_KEY}/>}
      {showTemplates&&<TemplatesModal templates={data.templates||[]} onSave={saveTemplate} onDeploy={deployTemplate} onDelete={deleteTemplate} onClose={()=>setShowTemplates(false)} activeBrand={activeBrand||"goldbet"} activeTab={brandTab}/>}
      {showGlobalSearch &&<GlobalSearch data={data} onClose={()=>setShowGlobalSearch(false)} onNavigate={(v,b)=>{setView(v);if(b)setActiveBrand(b);}}/>}
      {showShortcuts    &&<ShortcutsModal onClose={()=>setShowShortcuts(false)}/>}
      {/* Global lightbox for task attachments */}
      {taskLightbox&&(
        <div onClick={()=>setTaskLightbox(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:500,display:"flex",alignItems:"center",justifyContent:"center",padding:24,cursor:"zoom-out"}}>
          <div onClick={e=>e.stopPropagation()} style={{position:"relative",maxWidth:"92vw",maxHeight:"92vh"}}>
            <img src={taskLightbox.data} alt={taskLightbox.name} style={{maxWidth:"92vw",maxHeight:"88vh",borderRadius:10,boxShadow:"0 20px 80px rgba(0,0,0,.7)",display:"block",objectFit:"contain"}}/>
            <div style={{position:"absolute",bottom:-36,left:0,right:0,textAlign:"center",fontFamily:"Martian Mono,monospace",fontSize:10,color:"rgba(255,255,255,.4)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{taskLightbox.name}</div>
            <button onClick={()=>setTaskLightbox(null)} style={{position:"absolute",top:-14,right:-14,background:"#fff",border:"none",borderRadius:"50%",width:32,height:32,fontSize:13,cursor:"pointer",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 12px rgba(0,0,0,.4)"}}>✕</button>
            <a href={taskLightbox.data} download={taskLightbox.name} onClick={e=>e.stopPropagation()} style={{position:"absolute",top:-14,right:26,background:"#2563EB",border:"none",borderRadius:"50%",width:32,height:32,fontSize:14,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",textDecoration:"none",boxShadow:"0 2px 12px rgba(0,0,0,.4)"}}>⬇</a>
          </div>
        </div>
      )}
      <ToastContainer toasts={toasts}/>
    </div>
  );
}
