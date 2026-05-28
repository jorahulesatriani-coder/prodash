// PRODASH v8.1 — build:202603101209
import React, { useState, useEffect, useRef, useCallback } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend } from "recharts";

// ── Error Boundary — prevents blank page on crash ──
export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) { console.error("PRODASH Error:", e, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100vh",fontFamily:"monospace",padding:24,background:"#0D0F1A",color:"#E8EAF6"}}>
          <div style={{fontSize:32,marginBottom:16}}>⚠️</div>
          <div style={{fontSize:18,fontWeight:700,marginBottom:8,color:"#F87171"}}>PRODASH crashed</div>
          <div style={{fontSize:12,color:"#9099B8",marginBottom:24,maxWidth:400,textAlign:"center"}}>{this.state.error?.message}</div>
          <button onClick={()=>{localStorage.clear();window.location.reload();}} style={{padding:"10px 20px",background:"#4F46E5",color:"#fff",border:"none",borderRadius:8,cursor:"pointer",fontSize:14}}>
            Clear data &amp; reload
          </button>
          <div style={{fontSize:10,color:"#52576E",marginTop:12}}>Or hard refresh: Ctrl+Shift+R</div>
        </div>
      );
    }
    return this.props.children;
  }
}


// ══════════════════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════════════════
const BRANDS = [
  {id:"goldbet", name:"Goldbet",       color:"#B45309",bg:"#FFFBEB",emoji:""},
  {id:"ultrabet",name:"Ultrabet",      color:"#6D28D9",bg:"#F5F3FF",emoji:""},
  {id:"boostbet",name:"BoostBet",      color:"#B91C1C",bg:"#FEF2F2",emoji:""},
  {id:"allbets", name:"AllBets",       color:"#065F46",bg:"#ECFDF5",emoji:""},
  {id:"betgold", name:"BetGold",       color:"#C2410C",bg:"#FFF7ED",emoji:""},
  {id:"techdev", name:"TechDev",       color:"#1E40AF",bg:"#EFF6FF",emoji:""},
  {id:"misc",    name:"Miscellaneous", color:"#6B7280",bg:"#F9FAFB",emoji:""},
];
const BRAND_TABS  = ["Reporting","Compliance","Accounting","Miscellaneous"];

// "All brands" in natural-language commands means the 5 wagering brands
// (excludes TechDev which is internal/tech, and Misc which is a catch-all)
const CORE_BRAND_IDS = ["goldbet","ultrabet","boostbet","allbets","betgold"];
const CORE_BRANDS = () => BRANDS.filter(b => CORE_BRAND_IDS.includes(b.id));
const PRIORITIES  = [{key:"low",label:"Low"},{key:"medium",label:"Medium"},{key:"high",label:"High"},{key:"urgent",label:"Urgent"}];
const CATEGORIES  = ["Reporting","Compliance","Accounting","Payroll"];
const RECURRENCE  = [{key:"",label:"None"},{key:"daily",label:"Daily"},{key:"weekly",label:"Weekly"},{key:"monthly",label:"Monthly"}];
const PIN_COLORS  = ["#FFF9C4","#FFEEBA","#FFE0E0","#E0F4E0","#E0E8FF","#F3E8FF","#FFF0E0","#E0F8F8"];
const MONTHS      = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS    = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const STORAGE_KEY = "prodash_v8";
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
const taskAgeDays    = (createdAt) => (Date.now() - new Date(createdAt)) / 86400000;
const daysUntilDue   = (due) => { if(!due) return null; const d=Math.ceil((new Date(due)-new Date(todayStr()))/86400000); return d; };
const dueBadge       = (due) => { const d=daysUntilDue(due); if(d===null) return null; if(d<0) return {label:`${Math.abs(d)}d overdue`,color:"#DC2626",bg:"#FEE2E2"}; if(d===0) return {label:"Due today",color:"#D97706",bg:"#FEF3C7"}; if(d===1) return {label:"Due tmrw",color:"#D97706",bg:"#FEF3C7"}; if(d<=3) return {label:`${d}d left`,color:"#D97706",bg:"#FEF3C7"}; if(d<=7) return {label:`${d}d left`,color:"#2563EB",bg:"#EFF6FF"}; return {label:`${d}d`,color:"#6B7280",bg:"var(--surface)"}; };
const brandTemp = (b, tasks) => {
  // 0-100 temperature: activity + completion - overdue - aging
  const recency = tasks.filter(t=>t.done&&t.doneAt&&(Date.now()-new Date(t.doneAt))<3*86400000).length;
  const aging   = tasks.filter(t=>!t.done&&taskAgeDays(t.createdAt)>7).length;
  const temp    = Math.min(100, Math.max(0, b.rate + (recency*8) - (b.overdue*12) - (aging*5)));
  if(temp>=75) return {temp,label:"🔥 Hot",color:"#DC2626",desc:"Active & progressing"};
  if(temp>=50) return {temp,label:"⚡ Warm",color:"#D97706",desc:"Steady progress"};
  if(temp>=25) return {temp,label:"❄ Cool",color:"#2563EB",desc:"Slowing down"};
  return {temp,label:"🧊 Cold",color:"#6B7280",desc:"Needs attention"};
};
const fmtSecs = s => { const m=Math.floor(s/60),ss=s%60; return String(m).padStart(2,"0")+":"+String(ss).padStart(2,"0"); };
const loadStreak = () => { try{return JSON.parse(localStorage.getItem("prodash_streak")||"{}")||{};}catch{return{};} };
const saveStreakLS = s => localStorage.setItem("prodash_streak", JSON.stringify(s));
const SCORE_HIST_KEY = "prodash_score_hist";
const PA_CHAT_KEY    = "prodash_pa_chat";
const loadPAChat     = () => { try{return JSON.parse(localStorage.getItem(PA_CHAT_KEY)||"[]");}catch{return[];} };
const savePAChat     = (c) => { try{localStorage.setItem(PA_CHAT_KEY,JSON.stringify(c.slice(-100)));}catch{} };
const loadScoreHist  = () => { try{return JSON.parse(localStorage.getItem(SCORE_HIST_KEY)||"[]");}catch{return[];} };
const saveScoreHist  = h => { try{localStorage.setItem(SCORE_HIST_KEY,JSON.stringify(h));}catch{} };
const WEEKLY_KEY     = "prodash_weekly";
const loadWeekly     = () => { try{return JSON.parse(localStorage.getItem(WEEKLY_KEY)||"[]");}catch{return[];} };
const saveWeekly     = w => { try{localStorage.setItem(WEEKLY_KEY,JSON.stringify(w));}catch{} };
const ACCT_KEY       = "prodash_acct";
const MOOD_KEY       = "prodash_mood";
const loadMoods      = () => { try{return JSON.parse(localStorage.getItem(MOOD_KEY)||"[]");}catch{return[];} };
const saveMoods      = m => { try{localStorage.setItem(MOOD_KEY,JSON.stringify(m));}catch{} };
const loadAcct       = () => { try{return JSON.parse(localStorage.getItem(ACCT_KEY)||"{}")||{};}catch{return{};} };
const saveAcct       = a => { try{localStorage.setItem(ACCT_KEY,JSON.stringify(a));}catch{} };
const NAV_PRIMARY = [
  {id:"dashboard",icon:"◈",label:"Dashboard"},
  {id:"pa",       icon:"◎",label:"PA Assistant"},
  {id:"warroom",  icon:"⚔",label:"War Room"},
  {id:"weekplan", icon:"◫",label:"This Week"},
  {id:"calendar", icon:"⏱",label:"Calendar"},
  {id:"analytics",icon:"◉",label:"Analytics"},
];
const NAV_MORE = [
  {id:"goals",    icon:"◇",label:"Goals"},
  {id:"decisions",icon:"§",label:"Decisions"},
  {id:"journal",  icon:"▤",label:"Journal"},
  {id:"timelog",  icon:"◷",label:"Time Log"},
  {id:"pinboard", icon:"◆",label:"Pin Board"},
];
// Combined for view lookups - DO NOT remove
const NAV_ITEMS = [...NAV_PRIMARY, ...NAV_MORE];
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
      return {tasks:p.tasks||{},notes:p.notes||[],reminders:p.reminders||[],uploads:p.uploads||{},timelog:p.timelog||[],aiInsights:p.aiInsights||{},templates:p.templates||[],goals:p.goals||[],decisions:p.decisions||[],journal:p.journal||{},meta:p.meta||{createdAt:nowISO()}};
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
const emptyData   = () => ({tasks:{},notes:[],reminders:[],uploads:{},timelog:[],aiInsights:{},templates:[],goals:[],decisions:[],journal:{},meta:{createdAt:nowISO()}});
const loadLocal   = () => { try{const r=localStorage.getItem(STORAGE_KEY); if(!r) return emptyData(); const p=JSON.parse(r); return {tasks:p.tasks||{},notes:p.notes||[],reminders:p.reminders||[],uploads:p.uploads||{},timelog:p.timelog||[],aiInsights:p.aiInsights||{},templates:p.templates||[],goals:p.goals||[],decisions:p.decisions||[],journal:p.journal||{},meta:p.meta||{createdAt:nowISO()}};} catch{return emptyData();}};
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
    // goals
    (data.goals||[]).forEach(g=>{
      if(g.title.toLowerCase().includes(ql)||g.description?.toLowerCase().includes(ql)){
        results.push({type:"goal",icon:"🎯",label:g.title,sub:`Goal · ${g.progress||0}% · ${g.achieved?"Achieved":"Active"}`,color:"#059669",action:()=>{onNavigate("goals");onClose();}});
      }
    });
    // decisions
    (data.decisions||[]).forEach(d=>{
      if(d.title.toLowerCase().includes(ql)||d.decision?.toLowerCase().includes(ql)||d.context?.toLowerCase().includes(ql)){
        results.push({type:"decision",icon:"⚖",label:d.title,sub:`Decision · ${fmtDate(d.createdAt)}`,color:"#7C3AED",action:()=>{onNavigate("decisions");onClose();}});
      }
    });
    // journal
    Object.entries(data.journal||{}).forEach(([date,entry])=>{
      const text=(entry.worked||"")+" "+(entry.mattered||"")+" "+(entry.mind||"")+" "+(entry.tomorrow||"");
      if(text.toLowerCase().includes(ql)){
        results.push({type:"journal",icon:"📖",label:`Journal: ${fmtDate(date)}`,sub:text.slice(0,60)+"...",color:"#2563EB",action:()=>{onNavigate("journal");onClose();}});
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
function BrainDumpView({addTask,addNote,addReminder,showToast,apiKey,activeBrand,brandTab}) {
  const [dumpText,setDumpText]=useState("");
  const [dumpLoading,setDumpLoading]=useState(false);
  const [dumpResult,setDumpResult]=useState(null);
  const [dumpErr,setDumpErr]=useState("");
  const process=async()=>{
    if(!dumpText.trim())return;
    setDumpLoading(true);setDumpErr("");setDumpResult(null);
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1500,
          system:`You sort brain dumps for a professional managing 6 betting/gaming brands: Goldbet,Ultrabet,BoostBet,AllBets,BetGold,TechDev.
Return ONLY valid JSON, no markdown. Format:
{
"tasks":[{"title":"string","priority":"medium","brand":"goldbet","tab":"Reporting","category":"Compliance","estimatedMins":30,"note":""}],
"reminders":[{"title":"string","date":"YYYY-MM-DD","time":"09:00","brand":""}],
"notes":[{"title":"string","content":"string"}],
"insights":"string (1-2 sentence summary of what this brain dump reveals)"
}
priority: low|medium|high|urgent. brand: goldbet|ultrabet|boostbet|allbets|betgold|techdev or "". tab: Reporting|Compliance|Accounting.`,
          messages:[{role:"user",content:"Sort this brain dump: "+dumpText}]})});

      const json=await res.json();
      const text=json.content?.filter(c=>c.type==="text").map(c=>c.text).join("")||"";
      const parsed=JSON.parse(text.replace(/```json|```/g,"").trim());
      setDumpResult(parsed);
    }catch(e){setDumpErr("Could not process — try again.");}
    setDumpLoading(false);
  };
  const applyAll=()=>{
    if(!dumpResult)return;
    dumpResult.tasks?.forEach(t=>addTask(t));
    dumpResult.reminders?.forEach(r=>addReminder(r));
    dumpResult.notes?.forEach(n=>addNote(n));
    setDumpText("");setDumpResult(null);
    showToast("Brain dump sorted! "+(dumpResult.tasks?.length||0)+" tasks, "+(dumpResult.reminders?.length||0)+" reminders, "+(dumpResult.notes?.length||0)+" notes added.");
  };
  return(
    <div className="anim-up">
      <div className="briefing-card" style={{marginBottom:20,borderColor:"rgba(124,58,237,.3)",background:"linear-gradient(135deg,rgba(124,58,237,.06),rgba(79,70,229,.04))"}}>
        <div className="briefing-title" style={{color:"#7C3AED"}}>⚡ BRAIN DUMP</div>
        <div style={{fontSize:13,color:"var(--ink-3)",lineHeight:1.7,marginBottom:16}}>
          Type <strong>everything</strong> in your head right now — tasks, worries, ideas, reminders, random thoughts. Don't organise. Don't filter. Just dump it all out. AI will sort it instantly.
        </div>
        {!dumpResult?(
          <>
            <textarea value={dumpText} onChange={e=>setDumpText(e.target.value)} className="ta"
              style={{minHeight:200,fontSize:14,lineHeight:1.8,letterSpacing:.01,fontFamily:"inherit"}}
              placeholder="e.g. Need to call compliance team about Goldbet regs... Ultrabet reporting due Friday... Follow up accounting month-end..."
              autoFocus/>
            {dumpErr&&<div style={{color:"#DC2626",fontSize:12.5,marginTop:8}}>{dumpErr}</div>}
            <div style={{display:"flex",gap:10,marginTop:14,alignItems:"center"}}>
              <button className="btn btn-primary" style={{padding:"10px 28px",fontSize:14}} onClick={process} disabled={dumpLoading||!dumpText.trim()}>
                {dumpLoading?<span style={{display:"flex",alignItems:"center",gap:8}}><span className="typing-dots"><span/><span/><span/></span> Sorting...</span>:"⚡ Sort My Brain"}
              </button>
              {dumpText.length>0&&<span style={{fontFamily:"Martian Mono,monospace",fontSize:10,color:"var(--ink-4)"}}>{dumpText.split(/\s+/).filter(Boolean).length} words</span>}
            </div>
          </>
        ):(
          <div>
            {dumpResult.insights&&<div style={{background:"rgba(79,70,229,.08)",border:"1px solid rgba(79,70,229,.2)",borderRadius:10,padding:"12px 16px",marginBottom:16}}>
              <div style={{fontFamily:"Martian Mono,monospace",fontSize:8,color:"var(--indigo)",letterSpacing:1.5,marginBottom:5,textTransform:"uppercase"}}>◎ WHAT THIS REVEALS</div>
              <div style={{fontSize:13,color:"var(--ink-2)",lineHeight:1.7}}>{dumpResult.insights}</div>
            </div>}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:14,marginBottom:16}}>
              {[{label:"TASKS",items:dumpResult.tasks||[],icon:"✓",color:"#2563EB",render:t=><div key={t.title} style={{fontSize:12,padding:"8px 10px",background:"var(--surface)",borderRadius:7,marginBottom:5}}><div style={{fontWeight:500,color:"var(--ink)",marginBottom:3}}>{t.title}</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{t.brand&&<span style={{fontFamily:"Martian Mono,monospace",fontSize:8.5,color:BRANDS.find(b=>b.id===t.brand)?.color||"var(--ink-4)"}}>{BRANDS.find(b=>b.id===t.brand)?.emoji} {t.brand}</span>}<span className={`badge ${t.priority==="urgent"?"badge-violet":t.priority==="high"?"badge-red":"badge-amber"}`}>{t.priority}</span></div></div>},
               {label:"REMINDERS",items:dumpResult.reminders||[],icon:"🔔",color:"#7C3AED",render:r=><div key={r.title} style={{fontSize:12,padding:"8px 10px",background:"var(--surface)",borderRadius:7,marginBottom:5}}><div style={{fontWeight:500,color:"var(--ink)",marginBottom:2}}>{r.title}</div><div style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"var(--ink-4)"}}>{r.date} {r.time}</div></div>},
               {label:"NOTES",items:dumpResult.notes||[],icon:"📌",color:"#D97706",render:n=><div key={n.title} style={{fontSize:12,padding:"8px 10px",background:"var(--surface)",borderRadius:7,marginBottom:5}}><div style={{fontWeight:500,color:"var(--ink)",marginBottom:2}}>{n.title||"Note"}</div><div style={{fontSize:11,color:"var(--ink-4)",lineHeight:1.5}}>{n.content?.slice(0,80)}</div></div>}
              ].map(col=>(
                <div key={col.label}>
                  <div style={{fontFamily:"Martian Mono,monospace",fontSize:8.5,color:col.color,letterSpacing:1.5,marginBottom:8,textTransform:"uppercase"}}>{col.icon} {col.label} ({col.items.length})</div>
                  {col.items.map(col.render)}
                  {!col.items.length&&<div style={{fontSize:11,color:"var(--ink-4)",padding:"8px 0"}}>None found</div>}
                </div>
              ))}
            </div>
            <div className="row gap8">
              <button className="btn btn-primary" style={{padding:"10px 28px"}} onClick={applyAll}>✓ Add Everything to PRODASH</button>
              <button className="btn btn-ghost" onClick={()=>setDumpResult(null)}>← Edit</button>
              <button className="btn btn-ghost" onClick={()=>{setDumpText("");setDumpResult(null);}}>Start Over</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════
//  WORK JOURNAL
// ══════════════════════════════════════════════════════════

function JournalView({data,saveJournalEntry,showToast}) {
  const today=todayStr();
  const [selDate,setSelDate]=useState(today);
  const entry=data.journal?.[selDate]||{};
  const [f,setF]=useState({worked:entry.worked||"",mattered:entry.mattered||"",mind:entry.mind||"",tomorrow:entry.tomorrow||""});
  const [saved,setSaved]=useState(false);
  const save=()=>{saveJournalEntry(selDate,f);setSaved(true);setTimeout(()=>setSaved(false),2000);showToast("Journal saved");};
  const allEntries=Object.entries(data.journal||{}).sort((a,b)=>b[0].localeCompare(a[0]));
  const todayLog=(data.timelog||[]).filter(l=>l.ts?.startsWith(today)&&l.type!=="session_start").slice(0,8);
  return(
    <div className="anim-up">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div><div className="section-title" style={{marginBottom:4}}>📖 WORK JOURNAL</div><div style={{fontSize:12,color:"var(--ink-4)"}}>Your private daily record. {allEntries.length} entries so far.</div></div>
        <input type="date" className="inp" style={{width:160}} value={selDate} onChange={e=>{setSelDate(e.target.value);const ent=data.journal?.[e.target.value]||{};setF({worked:ent.worked||"",mattered:ent.mattered||"",mind:ent.mind||"",tomorrow:ent.tomorrow||""}); setSaved(false);}}/>
      </div>
      <div className="g2 gap14">
        <div>
          {selDate===today&&todayLog.length>0&&<div className="card mb14">
            <div className="card-header"><span className="card-title">TODAY'S ACTIVITY (auto)</span></div>
            {todayLog.map(l=><div key={l.id} style={{fontSize:12,color:"var(--ink-3)",padding:"5px 0",borderBottom:"1px solid var(--surface)"}}>{fmtTime(l.ts)} — {l.title}</div>)}
          </div>}
          {[{k:"worked",l:"What did you actually work on?",p:"Tasks completed, meetings, calls, research..."},
            {k:"mattered",l:"What mattered most today?",p:"The one thing that moved the needle..."},
            {k:"mind",l:"What's in your head right now?",p:"Worries, unfinished thoughts, things you're carrying..."},
            {k:"tomorrow",l:"Tomorrow's single most important thing",p:"Just one. What would make tomorrow a success?"},
          ].map(q=>(
            <div className="form-group mb14" key={q.k}>
              <label className="form-label" style={{fontSize:12.5,marginBottom:6}}>{q.l}</label>
              <textarea className="ta" style={{minHeight:72,fontSize:13}} placeholder={q.p}
                value={f[q.k]} onChange={e=>setF(p=>({...p,[q.k]:e.target.value}))}/>
            </div>
          ))}
          <button className="btn btn-primary" style={{padding:"10px 24px"}} onClick={save}>
            {saved?"✓ Saved!":"💾 Save Entry"}
          </button>
        </div>
        <div>
          <div className="card">
            <div className="card-header"><span className="card-title">PAST ENTRIES</span></div>
            {!allEntries.length&&<div style={{fontSize:12,color:"var(--ink-4)",padding:"12px 0",textAlign:"center"}}>No entries yet — start today</div>}
            {allEntries.slice(0,15).map(([date,ent])=>(
              <div key={date} onClick={()=>{setSelDate(date);setF({worked:ent.worked||"",mattered:ent.mattered||"",mind:ent.mind||"",tomorrow:ent.tomorrow||""});setSaved(false);}}
                style={{padding:"10px 0",borderBottom:"1px solid var(--surface)",cursor:"pointer",transition:"opacity .1s"}} onMouseEnter={e=>e.currentTarget.style.opacity=".7"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3}}>
                  <span style={{fontFamily:"Martian Mono,monospace",fontSize:10,fontWeight:600,color:date===today?"#2563EB":"var(--ink-3)"}}>{date===today?"TODAY":fmtDate(date)}</span>
                  <span style={{fontSize:10,color:"var(--ink-4)"}}>{[ent.worked,ent.mattered,ent.mind,ent.tomorrow].filter(Boolean).length}/4 filled</span>
                </div>
                {ent.mattered&&<div style={{fontSize:11.5,color:"var(--ink-3)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ent.mattered}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════
//  GOALS / OKRs
// ══════════════════════════════════════════════════════════

function GoalsView({data,addGoal,updateGoalProgress,deleteGoal,showToast,fetchInsight,insightLoading,insights}) {
  const [showAdd,setShowAdd]=useState(false);
  const [f,setF]=useState({title:"",description:"",targetDate:"",brand:"",category:"",targetValue:"",unit:""});
  const goals=data.goals||[];
  const active=goals.filter(g=>!g.done);const done=goals.filter(g=>g.done);
  return(
    <div className="anim-up">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div><div className="section-title" style={{marginBottom:4}}>🎯 GOALS</div><div style={{fontSize:12,color:"var(--ink-4)"}}>{active.length} active · {done.length} achieved</div></div>
        <div className="row gap8">
          <button className="ai-btn" disabled={insightLoading["goals"]} onClick={()=>fetchInsight("goals","Review my goals vs my current task/time data. Am I working on the right things? 3 specific insights.")}>◎ AI Review</button>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowAdd(p=>!p)}>+ New Goal</button>
        </div>
      </div>
      {insights["goals"]&&<AIPanel insight={insights["goals"]} loading={false} label="◎ AI GOAL REVIEW"/>}
      {showAdd&&(
        <div className="card mb16" style={{borderColor:"rgba(37,99,235,.3)",background:"rgba(37,99,235,.03)"}}>
          <div className="card-header"><span className="card-title">NEW GOAL</span><button className="modal-close" onClick={()=>setShowAdd(false)}>✕</button></div>
          <div className="form-group mb10"><label className="form-label">Goal Title *</label><input className="inp" placeholder="e.g. Get all brands to A health grade by June" value={f.title} onChange={e=>setF(p=>({...p,title:e.target.value}))} autoFocus/></div>
          <div className="form-row mb10">
            <div className="form-group"><label className="form-label">Target Date</label><input className="inp" type="date" value={f.targetDate} onChange={e=>setF(p=>({...p,targetDate:e.target.value}))}/></div>
            <div className="form-group"><label className="form-label">Brand (optional)</label>
              <select className="sel" value={f.brand} onChange={e=>setF(p=>({...p,brand:e.target.value}))}><option value="">— All brands —</option>{BRANDS.map(b=><option key={b.id} value={b.id}>{b.emoji} {b.name}</option>)}</select>
            </div>
          </div>
          <div className="form-group mb10"><label className="form-label">Description / Why this matters</label><textarea className="ta" style={{minHeight:60}} value={f.description} onChange={e=>setF(p=>({...p,description:e.target.value}))}/></div>
          <div className="row gap8"><button className="btn btn-primary btn-sm" onClick={()=>{addGoal(f);setShowAdd(false);setF({title:"",description:"",targetDate:"",brand:"",category:"",targetValue:"",unit:""});}}>Add Goal</button><button className="btn btn-ghost btn-sm" onClick={()=>setShowAdd(false)}>Cancel</button></div>
        </div>
      )}
      {!goals.length&&<div className="empty-state"><div className="empty-icon">🎯</div><div className="empty-title">No goals yet</div><div className="empty-desc">Set a goal to give your tasks meaning and direction</div></div>}
      {active.map(g=>{
        const brand=BRANDS.find(b=>b.id===g.brand);const daysLeft=g.targetDate?Math.ceil((new Date(g.targetDate)-new Date())/86400000):null;
        return(
          <div key={g.id} className="card mb10" style={{borderLeft:`3px solid ${brand?.color||"#2563EB"}`}}>
            <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:"var(--ink)",marginBottom:6}}>{g.title}</div>
                {g.description&&<div style={{fontSize:12.5,color:"var(--ink-3)",marginBottom:8,lineHeight:1.6}}>{g.description}</div>}
                <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:10}}>
                  {brand&&<span style={{fontFamily:"Martian Mono,monospace",fontSize:9.5,color:brand.color}}>{brand.emoji} {brand.name}</span>}
                  {daysLeft!==null&&<span style={{fontFamily:"Martian Mono,monospace",fontSize:9.5,color:daysLeft<7?"#DC2626":daysLeft<30?"#D97706":"var(--ink-4)"}}>📅 {daysLeft>0?daysLeft+"d left":"Overdue"}</span>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{flex:1,height:6,background:"var(--surface)",borderRadius:99,overflow:"hidden"}}>
                    <div style={{height:"100%",width:g.progress+"%",background:brand?.color||"#2563EB",borderRadius:99,transition:"width .5s"}}/>
                  </div>
                  <span style={{fontFamily:"Martian Mono,monospace",fontSize:10,color:"var(--ink-3)",width:30}}>{g.progress}%</span>
                  <input type="range" min={0} max={100} value={g.progress} onChange={e=>updateGoalProgress(g.id,+e.target.value,+e.target.value===100)} style={{width:80}}/>
                </div>
              </div>
              <div style={{display:"flex",gap:5}}>
                <button className="btn btn-primary btn-xs" onClick={()=>updateGoalProgress(g.id,100,true)}>✓ Done</button>
                <button className="task-del" style={{opacity:1}} onClick={()=>deleteGoal(g.id)}>✕</button>
              </div>
            </div>
          </div>
        );
      })}
      {done.length>0&&<div>
        <div style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"#059669",letterSpacing:2,margin:"16px 0 10px",textTransform:"uppercase"}}>✓ ACHIEVED ({done.length})</div>
        {done.map(g=><div key={g.id} style={{display:"flex",gap:10,padding:"10px 14px",border:"1px solid var(--line)",borderRadius:8,marginBottom:6,opacity:.6}}>
          <span style={{fontSize:16}}>🏆</span><div style={{flex:1}}><div style={{fontSize:13,fontWeight:500,color:"var(--ink)",textDecoration:"line-through"}}>{g.title}</div><div style={{fontSize:10.5,color:"var(--ink-4)",marginTop:2}}>Achieved {fmtDate(g.doneAt)}</div></div>
          <button className="task-del" style={{opacity:1}} onClick={()=>deleteGoal(g.id)}>✕</button>
        </div>)}
      </div>}
    </div>
  );
};

// ══════════════════════════════════════════════════════════
//  DECISION LOG
// ══════════════════════════════════════════════════════════

function DecisionsView({data,addDecision,deleteDecision,showToast,fetchInsight,insightLoading,insights}) {
  const [showAdd,setShowAdd]=useState(false);
  const [f,setF]=useState({title:"",context:"",decision:"",reasoning:"",brand:""});
  const decisions=data.decisions||[];
  return(
    <div className="anim-up">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div><div className="section-title" style={{marginBottom:4}}>⚖ DECISION LOG</div><div style={{fontSize:12,color:"var(--ink-4)"}}>{decisions.length} decisions recorded</div></div>
        <div className="row gap8">
          <button className="ai-btn" disabled={insightLoading["decisions"]} onClick={()=>fetchInsight("decisions","Analyse my decision patterns. What do I tend to decide? Any recurring themes or risks? 2-3 insights.")}>◎ AI Patterns</button>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowAdd(p=>!p)}>+ Log Decision</button>
        </div>
      </div>
      {insights["decisions"]&&<AIPanel insight={insights["decisions"]} loading={false} label="◎ DECISION PATTERNS"/>}
      {showAdd&&(
        <div className="card mb16" style={{borderColor:"rgba(124,58,237,.3)"}}>
          <div className="card-header"><span className="card-title">LOG A DECISION</span><button className="modal-close" onClick={()=>setShowAdd(false)}>✕</button></div>
          <div className="form-group mb10"><label className="form-label">Decision Title *</label><input className="inp" placeholder="e.g. Delayed Goldbet compliance audit until Q3" value={f.title} onChange={e=>setF(p=>({...p,title:e.target.value}))} autoFocus/></div>
          <div className="form-row mb10">
            <div className="form-group"><label className="form-label">Brand</label>
              <select className="sel" value={f.brand} onChange={e=>setF(p=>({...p,brand:e.target.value}))}><option value="">— General —</option>{BRANDS.map(b=><option key={b.id} value={b.id}>{b.emoji} {b.name}</option>)}</select>
            </div>
          </div>
          <div className="form-group mb10"><label className="form-label">Context — what situation led to this?</label><textarea className="ta" style={{minHeight:60}} placeholder="What was happening? What were the options?" value={f.context} onChange={e=>setF(p=>({...p,context:e.target.value}))}/></div>
          <div className="form-group mb10"><label className="form-label">The decision made</label><textarea className="ta" style={{minHeight:48}} placeholder="Exactly what was decided..." value={f.decision} onChange={e=>setF(p=>({...p,decision:e.target.value}))}/></div>
          <div className="form-group mb14"><label className="form-label">Reasoning — why this choice?</label><textarea className="ta" style={{minHeight:60}} placeholder="Why was this the right call?" value={f.reasoning} onChange={e=>setF(p=>({...p,reasoning:e.target.value}))}/></div>
          <div className="row gap8"><button className="btn btn-primary btn-sm" onClick={()=>{addDecision(f);setShowAdd(false);setF({title:"",context:"",decision:"",reasoning:"",brand:""});}}>Log Decision</button><button className="btn btn-ghost btn-sm" onClick={()=>setShowAdd(false)}>Cancel</button></div>
        </div>
      )}
      {!decisions.length&&<div className="empty-state"><div className="empty-icon">⚖</div><div className="empty-title">No decisions logged</div><div className="empty-desc">Start recording important decisions. In 6 months you'll see clear patterns in your thinking.</div></div>}
      {decisions.map(d=>{const brand=BRANDS.find(b=>b.id===d.brand);return(
        <div key={d.id} className="card mb10">
          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                <div style={{fontSize:14,fontWeight:600,color:"var(--ink)"}}>{d.title}</div>
                {brand&&<span style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:brand.color}}>{brand.emoji} {brand.name}</span>}
              </div>
              {d.context&&<div style={{marginBottom:8}}><span className="form-label">CONTEXT</span><div style={{fontSize:12.5,color:"var(--ink-3)",lineHeight:1.6,marginTop:2}}>{d.context}</div></div>}
              {d.decision&&<div style={{marginBottom:8,background:"rgba(37,99,235,.06)",borderRadius:7,padding:"8px 12px"}}><span className="form-label">DECISION</span><div style={{fontSize:12.5,color:"var(--ink-2)",lineHeight:1.6,marginTop:2,fontWeight:500}}>{d.decision}</div></div>}
              {d.reasoning&&<div><span className="form-label">REASONING</span><div style={{fontSize:12.5,color:"var(--ink-3)",lineHeight:1.6,marginTop:2}}>{d.reasoning}</div></div>}
              <div style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"var(--ink-4)",marginTop:8}}>{fmtDateTime(d.createdAt)}</div>
            </div>
            <button className="task-del" style={{opacity:1}} onClick={()=>deleteDecision(d.id)}>✕</button>
          </div>
        </div>
      );})}
    </div>
  );
};

// ══════════════════════════════════════════════════════════
//  WEEKLY PLAN
// ══════════════════════════════════════════════════════════

function WeekPlanView({data,stats,bStats,acctData,setCommitment,weeklyReviews,setWeeklyReviews,showToast,setActiveBrand,setBrandTab,setView}) {
  const today=todayStr();const weekNum=Math.floor(Date.now()/604800000);
  const thisWeek=weeklyReviews.find(w=>w.week===weekNum)||{};
  const [rating,setRating]=useState(thisWeek.rating||0);
  const [reflection,setReflection]=useState(thisWeek.reflection||"");
  const [nextWeek,setNextWeek]=useState(thisWeek.nextWeek||"");
  const allTasks=Object.values(data.tasks).flat();
  const weekAgo=new Date(Date.now()-7*86400000).toISOString().split("T")[0];
  const weekDone=allTasks.filter(t=>t.done&&t.doneAt>=weekAgo);
  const upcoming=data.reminders.filter(r=>r.date>=today).slice(0,6);
  const dueSoon=allTasks.filter(t=>!t.done&&t.due&&t.due>=today&&t.due<=new Date(Date.now()+7*86400000).toISOString().split("T")[0]).sort((a,b)=>a.due.localeCompare(b.due));
  const stale=allTasks.filter(t=>!t.done&&taskAgeDays(t.createdAt)>14).slice(0,5);
  const taskDebt=allTasks.filter(t=>!t.done&&taskAgeDays(t.createdAt)>14);
  const debtHours=taskDebt.reduce((s,t)=>s+(t.estimatedMins||30),0)/60;
  const saveReview=()=>{const r={week:weekNum,date:today,rating,reflection,nextWeek};const upd=[...weeklyReviews.filter(w=>w.week!==weekNum),r];setWeeklyReviews(upd);saveWeekly(upd);showToast("Weekly review saved");};
  return(
    <div className="anim-up">
      <div className="section-title" style={{marginBottom:4}}>📅 WEEKLY PLAN</div>
      <div style={{fontSize:12,color:"var(--ink-4)",marginBottom:20}}>Plan your week, track your commitment, review your performance.</div>

      {/* Task debt */}
      {taskDebt.length>0&&<div style={{background:"rgba(220,38,38,.06)",border:"1px solid rgba(220,38,38,.2)",borderRadius:12,padding:"14px 18px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
          <span style={{fontSize:18}}>💳</span>
          <div style={{fontFamily:"Martian Mono,monospace",fontSize:12,fontWeight:700,color:"#DC2626"}}>TASK DEBT: {taskDebt.length} tasks ({debtHours.toFixed(1)} hours owed)</div>
        </div>
        <div style={{fontSize:12.5,color:"var(--ink-3)",marginBottom:10}}>These tasks have been pending for 14+ days. They are debt accumulating against your productivity.</div>
        {stale.map(t=>{const[bId,tab]=t.key?.split("_")||[];const brand=BRANDS.find(b=>b.id===bId);return(
          <div key={t.id} style={{display:"flex",gap:10,padding:"7px 0",borderBottom:"1px solid rgba(220,38,38,.1)",alignItems:"center"}}>
            <div style={{flex:1}}><div style={{fontSize:12.5,fontWeight:500,color:"var(--ink)"}}>{t.title}</div><div style={{fontSize:10.5,color:"var(--ink-4)"}}>{brand?.emoji} {brand?.name} · {Math.floor(taskAgeDays(t.createdAt))}d old</div></div>
            <button className="btn btn-ghost btn-xs" onClick={()=>{setActiveBrand(bId);setBrandTab(tab);setView("brand");}}>View</button>
          </div>
        );})}
        {taskDebt.length>5&&<div style={{fontSize:11,color:"rgba(220,38,38,.6)",marginTop:6}}>+{taskDebt.length-5} more in task debt</div>}
      </div>}

      {/* Accountability */}
      <div className="card mb14">
        <div className="card-header"><span className="card-title">🤝 WEEKLY COMMITMENT</span></div>
        {acctData.lastWeekCommit>0&&<div style={{padding:"10px 0",borderBottom:"1px solid var(--surface)",marginBottom:12}}>
          <div style={{fontSize:12.5,color:"var(--ink-3)"}}>Last week you committed to <strong>{acctData.lastWeekCommit}</strong> tasks. You completed <strong>{acctData.lastWeekDone}</strong>.</div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginTop:8}}>
            <div style={{flex:1,height:6,background:"var(--surface)",borderRadius:99}}>
              <div style={{height:"100%",width:Math.min(100,acctData.lastWeekPct)+"%",background:acctData.lastWeekPct>=100?"#059669":acctData.lastWeekPct>=70?"#D97706":"#DC2626",borderRadius:99}}/>
            </div>
            <span style={{fontFamily:"Martian Mono,monospace",fontSize:11,fontWeight:600,color:acctData.lastWeekPct>=100?"#059669":acctData.lastWeekPct>=70?"#D97706":"#DC2626"}}>{acctData.lastWeekPct}% follow-through</span>
          </div>
        </div>}
        <div style={{fontSize:12.5,color:"var(--ink-3)",marginBottom:10}}>This week I commit to completing <strong>{acctData.commitment||"?"}</strong> tasks.</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[5,10,15,20,25,30].map(n=><button key={n} className={`btn btn-xs ${acctData.commitment===n?"btn-primary":"btn-ghost"}`} onClick={()=>setCommitment(n)}>{n}</button>)}
        </div>
        {acctData.commitment>0&&<div style={{marginTop:12}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{fontSize:12,color:"var(--ink-3)"}}>Progress this week</span><span style={{fontFamily:"Martian Mono,monospace",fontSize:11,color:"#2563EB"}}>{stats.weekDone}/{acctData.commitment}</span></div>
          <div style={{height:8,background:"var(--surface)",borderRadius:99,overflow:"hidden"}}>
            <div style={{height:"100%",width:Math.min(100,Math.round(stats.weekDone/acctData.commitment*100))+"%",background:"#2563EB",borderRadius:99,transition:"width .5s"}}/>
          </div>
        </div>}
      </div>

      <div className="g2 gap14 mb14">
        {/* Due this week */}
        <div className="card">
          <div className="card-header"><span className="card-title">DUE THIS WEEK ({dueSoon.length})</span></div>
          {!dueSoon.length&&<div style={{fontSize:12,color:"var(--ink-4)",padding:"8px 0"}}>Nothing due this week</div>}
          {dueSoon.map(t=>{const[bId,tab]=t.key?.split("_")||[];const brand=BRANDS.find(b=>b.id===bId);return(
            <div key={t.id} style={{display:"flex",gap:8,padding:"8px 0",borderBottom:"1px solid var(--surface)",alignItems:"center"}}>
              <div style={{flex:1}}><div style={{fontSize:12.5,fontWeight:500,color:"var(--ink)"}}>{t.title}</div><div style={{fontSize:10.5,color:"var(--ink-4)",marginTop:2}}>{brand?.emoji} {brand?.name} · Due {fmtDate(t.due)}</div></div>
              <span className={`badge ${t.priority==="urgent"?"badge-violet":t.priority==="high"?"badge-red":"badge-amber"}`}>{t.priority}</span>
            </div>
          );})}
        </div>
        {/* Upcoming reminders */}
        <div className="card">
          <div className="card-header"><span className="card-title">UPCOMING REMINDERS</span></div>
          {!upcoming.length&&<div style={{fontSize:12,color:"var(--ink-4)",padding:"8px 0"}}>No upcoming reminders</div>}
          {upcoming.map(r=>{const brand=BRANDS.find(b=>b.id===r.brand);return(
            <div key={r.id} style={{display:"flex",gap:8,padding:"8px 0",borderBottom:"1px solid var(--surface)",alignItems:"center"}}>
              <span style={{fontSize:14}}>🔔</span>
              <div style={{flex:1}}><div style={{fontSize:12.5,fontWeight:500}}>{r.title}</div><div style={{fontSize:10.5,color:"var(--ink-4)",marginTop:2}}>{fmtDate(r.date)}{brand?` · ${brand.emoji} ${brand.name}`:""}</div></div>
            </div>
          );})}
        </div>
      </div>

      {/* Weekly review */}
      <div className="card">
        <div className="card-header"><span className="card-title">THIS WEEK'S REVIEW</span><span style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"var(--ink-4)"}}>{weekDone.length} tasks completed</span></div>
        <div style={{marginBottom:14}}>
          <div className="form-label" style={{marginBottom:8}}>Rate your week</div>
          <div style={{display:"flex",gap:8}}>
            {[1,2,3,4,5].map(n=><button key={n} onClick={()=>setRating(n)} style={{width:40,height:40,borderRadius:8,border:`2px solid ${rating>=n?"#F59E0B":"var(--line)"}`,background:rating>=n?"rgba(245,158,11,.1)":"transparent",fontSize:18,cursor:"pointer"}}>{"⭐"}</button>)}
            {rating>0&&<span style={{fontFamily:"Martian Mono,monospace",fontSize:10,color:"#F59E0B",alignSelf:"center",marginLeft:4}}>{["","POOR","BELOW AVERAGE","AVERAGE","GOOD","EXCELLENT"][rating]}</span>}
          </div>
        </div>
        <div className="form-group mb10"><label className="form-label">What worked, what didn't?</label><textarea className="ta" style={{minHeight:72}} value={reflection} onChange={e=>setReflection(e.target.value)} placeholder="Wins, misses, surprises..."/></div>
        <div className="form-group mb14"><label className="form-label">What will I do differently next week?</label><textarea className="ta" style={{minHeight:60}} value={nextWeek} onChange={e=>setNextWeek(e.target.value)} placeholder="One specific change..."/></div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <button className="btn btn-primary btn-sm" onClick={saveReview}>💾 Save Review</button>
          {weeklyReviews.length>0&&<span style={{fontSize:12,color:"var(--ink-4)"}}>{weeklyReviews.length} past reviews saved</span>}
        </div>
      </div>
    </div>
  );
};


function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const time = now.toLocaleTimeString("en-GB", {hour:"2-digit", minute:"2-digit", second:"2-digit"});
  const date = now.toLocaleDateString("en-GB", {weekday:"short", day:"numeric", month:"short", year:"numeric"});
  return (
    <div style={{textAlign:"right",lineHeight:1.2}}>
      <div style={{fontFamily:"Martian Mono,monospace",fontSize:13,fontWeight:700,color:"var(--ink)",letterSpacing:1}}>{time}</div>
      <div style={{fontFamily:"Martian Mono,monospace",fontSize:8,color:"var(--ink-4)",letterSpacing:.5,marginTop:1}}>{date}</div>
    </div>
  );
}

function LiveClockSmall() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  const date = now.toLocaleDateString("en-AU", {weekday:"short", day:"numeric", month:"short"});
  const time = now.toLocaleTimeString("en-AU", {hour:"2-digit", minute:"2-digit"});
  return <span>{date} · {time}</span>;
}

function LiveDateLine() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);
  return <>{now.toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long"})}</>;
}


// ══════════════════════════════════════════════════════════
//  PA VIEW COMPONENT
// ══════════════════════════════════════════════════════════
function PAView({ paChat, paLoading, sendToPA, setPaChat, bStats, stats, score, data, setView, setActiveBrand, setBrandTab }) {
  const [input, setInput] = useState("");
  const [inputRows, setInputRows] = useState(1);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [paChat, paLoading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const send = () => {
    const msg = input.trim();
    if (!msg || paLoading) return;
    setInput("");
    setInputRows(1);
    sendToPA(msg);
  };

  const suggestions = [
    "Add a compliance task for Goldbet due Friday",
    "Remind me to check Ultrabet reports tomorrow at 9am",
    "What should I focus on today?",
    "Create a goal to improve Goldbet compliance by end of month",
    "Log a decision: we're switching Ultrabet to monthly reporting",
    "Add urgent task: review BoostBet licence renewal for Compliance",
    "What's the status of all my brands?",
    "I need to do payslips for all brands this week",
  ];

  const allTasks = Object.values(data.tasks).flat();
  const overdueCount = allTasks.filter(t => !t.done && t.due && t.due < todayStr()).length;

  return (
    <div className="anim-up" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", maxWidth: 860, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "linear-gradient(135deg,#4F46E5,#7C3AED)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, boxShadow: "0 4px 14px rgba(79,70,229,.35)" }}>🤖</div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)", letterSpacing: -0.5 }}>PRODASH PA</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Your AI personal assistant — tell me anything</div>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <div style={{ padding: "5px 12px", background: score >= 70 ? "var(--green-lt)" : "var(--amber-lt)", borderRadius: 99, fontFamily: "Martian Mono,monospace", fontSize: 10, fontWeight: 600, color: score >= 70 ? "#059669" : "#D97706" }}>◎ {score}</div>
            {overdueCount > 0 && <div style={{ padding: "5px 12px", background: "var(--red-lt)", borderRadius: 99, fontFamily: "Martian Mono,monospace", fontSize: 10, fontWeight: 600, color: "#DC2626" }}>🔥 {overdueCount} overdue</div>}
          </div>
        </div>

        {/* Quick stats strip */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {bStats.slice(0, 6).map(b => (
            <div key={b.id} onClick={() => { setActiveBrand(b.id); setView("brand"); }}
              style={{ padding: "4px 10px", background: b.color + "14", border: `1px solid ${b.color}30`, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 11 }}>{b.emoji}</span>
              <span style={{ fontFamily: "Martian Mono,monospace", fontSize: 8.5, fontWeight: 600, color: b.color }}>{b.name}</span>
              <span style={{ fontFamily: "Martian Mono,monospace", fontSize: 8, color: "var(--ink-4)" }}>{b.rate}%</span>
              {b.overdue > 0 && <span style={{ fontSize: 8, color: "#DC2626", fontWeight: 700 }}>▲{b.overdue}</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0 16px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Empty state */}
        {paChat.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🤖</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>Hi! I'm your PRODASH PA</div>
            <div style={{ fontSize: 13, color: "var(--ink-3)", maxWidth: 480, margin: "0 auto 24px", lineHeight: 1.7 }}>
              Tell me anything — tasks, ideas, reminders, decisions. I know all your brands and I'll automatically put everything in the right place.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 600, margin: "0 auto" }}>
              {suggestions.map((s, i) => (
                <button key={i} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  style={{ padding: "8px 14px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, fontSize: 12, color: "var(--ink-3)", cursor: "pointer", textAlign: "left", transition: "all .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--ai-bg)"; e.currentTarget.style.borderColor = "var(--indigo)"; e.currentTarget.style.color = "var(--ink)"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.borderColor = "var(--line)"; e.currentTarget.style.color = "var(--ink-3)"; }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {paChat.map((msg, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>

            {/* Avatar */}
            <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, background: msg.role === "user" ? "var(--blue)" : "linear-gradient(135deg,#4F46E5,#7C3AED)", boxShadow: "0 2px 8px rgba(0,0,0,.1)" }}>
              {msg.role === "user" ? "👤" : "🤖"}
            </div>

            {/* Bubble */}
            <div style={{ maxWidth: "75%", minWidth: 0 }}>
              <div style={{
                padding: "12px 16px",
                borderRadius: msg.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                background: msg.role === "user" ? "linear-gradient(135deg,#2563EB,#4F46E5)" : "var(--white)",
                color: msg.role === "user" ? "#fff" : "var(--ink)",
                border: msg.role === "user" ? "none" : "1px solid var(--line)",
                fontSize: 13.5,
                lineHeight: 1.65,
                boxShadow: "0 2px 8px rgba(0,0,0,.06)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word"
              }}>
                {msg.content}
              </div>

              {/* Action summary */}
              {msg.actionSummary && (
                <div style={{ marginTop: 6, padding: "6px 12px", background: "var(--green-lt)", border: "1px solid #A7F3D0", borderRadius: 8, fontSize: 11.5, color: "#059669", fontWeight: 500 }}>
                  {msg.actionSummary}
                </div>
              )}

              {/* Task cards created */}
              {msg.actions?.tasks?.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                  {msg.actions.tasks.map((t, ti) => {
                    const brand = BRANDS.find(b => b.id === t.brand);
                    return (
                      <div key={ti} onClick={() => { if (brand) { setActiveBrand(brand.id); setBrandTab(t.tab || "Miscellaneous"); setView("brand"); } }}
                        style={{ padding: "7px 12px", background: brand ? brand.color + "10" : "var(--surface)", border: `1px solid ${brand ? brand.color + "30" : "var(--line)"}`, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, transition: "all .12s" }}
                        onMouseEnter={e => e.currentTarget.style.opacity = ".8"}
                        onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
                        <span style={{ fontSize: 14 }}>{brand?.emoji || "✅"}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: brand?.color || "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                          <div style={{ fontFamily: "Martian Mono,monospace", fontSize: 8.5, color: "var(--ink-4)", marginTop: 1 }}>{brand?.name} · {t.tab} · {t.priority}</div>
                        </div>
                        {t.due && (() => { const db = dueBadge(t.due); return db ? <span style={{ fontFamily: "Martian Mono,monospace", fontSize: 8.5, fontWeight: 600, color: db.color, background: db.bg, padding: "2px 7px", borderRadius: 99 }}>{db.label}</span> : null; })()}
                        <span style={{ fontFamily: "Martian Mono,monospace", fontSize: 8, color: "var(--ink-4)" }}>→</span>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ fontFamily: "Martian Mono,monospace", fontSize: 7.5, color: "var(--ink-5)", marginTop: 4, textAlign: msg.role === "user" ? "right" : "left" }}>
                {fmtTime(msg.ts)}
              </div>
            </div>
          </div>
        ))}

        {/* Loading */}
        {paLoading && (
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}>🤖</div>
            <div style={{ padding: "12px 16px", borderRadius: "4px 16px 16px 16px", background: "var(--white)", border: "1px solid var(--line)", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
              <span className="typing-dots"><span/><span/><span/></span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ flexShrink: 0, padding: "12px 0 4px", borderTop: "1px solid var(--line)" }}>
        {paChat.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
            {["What should I focus on now?", "Any urgent items?", "Summarise my week", "Clear all overdue tasks"].map((s, i) => (
              <button key={i} onClick={() => sendToPA(s)}
                style={{ padding: "4px 12px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 99, fontSize: 11.5, color: "var(--ink-3)", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.background = "var(--ai-bg)"; e.currentTarget.style.color = "var(--ink)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "var(--surface)"; e.currentTarget.style.color = "var(--ink-3)"; }}>
                {s}
              </button>
            ))}
            <button onClick={() => { if (window.confirm("Clear chat history?")) { setPaChat([]); savePAChat([]); } }}
              style={{ padding: "4px 12px", background: "none", border: "1px solid var(--line)", borderRadius: 99, fontSize: 11.5, color: "var(--ink-4)", cursor: "pointer", marginLeft: "auto" }}>
              Clear chat
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "flex-end", background: "var(--white)", border: "2px solid var(--ai-border)", borderRadius: 16, padding: "8px 12px", boxShadow: "0 4px 20px rgba(79,70,229,.1)", transition: "border-color .2s" }}
          onFocusCapture={e => e.currentTarget.style.borderColor = "var(--indigo)"}
          onBlurCapture={e => e.currentTarget.style.borderColor = "var(--ai-border)"}>
          <textarea ref={inputRef}
            value={input}
            onChange={e => { setInput(e.target.value); const lines = e.target.value.split("\n").length; setInputRows(Math.min(lines, 5)); }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Tell me what to do... e.g. 'Add compliance task for Goldbet due Friday, high priority' or ask me anything"
            rows={inputRows}
            style={{ flex: 1, border: "none", outline: "none", resize: "none", fontSize: 13.5, color: "var(--ink)", background: "transparent", fontFamily: "Inter,sans-serif", lineHeight: 1.55, padding: 0 }}
          />
          <button onClick={send} disabled={!input.trim() || paLoading}
            style={{ width: 38, height: 38, borderRadius: 10, background: input.trim() && !paLoading ? "linear-gradient(135deg,#4F46E5,#7C3AED)" : "var(--surface)", border: "none", cursor: input.trim() && !paLoading ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0, transition: "all .2s", boxShadow: input.trim() && !paLoading ? "0 2px 10px rgba(79,70,229,.3)" : "none" }}>
            {paLoading ? <span className="typing-dots" style={{ transform: "scale(.7)" }}><span/><span/><span/></span> : "↑"}
          </button>
        </div>
        <div style={{ fontFamily: "Martian Mono,monospace", fontSize: 8, color: "var(--ink-5)", textAlign: "center", marginTop: 6 }}>
          Enter to send · Shift+Enter for new line · I can create tasks, reminders, notes, goals and decisions
        </div>
      </div>
    </div>
  );
}


function QuickPAInput({ onSend, onExpand }) {
  const [val, setVal] = useState("");
  return (
    <div>
      <textarea className="ta" style={{minHeight:72,fontSize:13,marginBottom:8,borderRadius:10}}
        placeholder="e.g. Add compliance task for Goldbet due Friday..."
        autoFocus value={val} onChange={e=>setVal(e.target.value)}
        onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();if(val.trim()){onSend(val.trim());}}}}/>
      <div style={{display:"flex",gap:6}}>
        <button className="btn btn-primary btn-xs flex1" style={{background:"linear-gradient(135deg,#4F46E5,#7C3AED)",border:"none"}}
          onClick={()=>{if(val.trim()) onSend(val.trim()); else onExpand();}}>
          🤖 {val.trim()?"Send to PA":"Open PA"}
        </button>
        <button className="btn btn-ghost btn-xs" onClick={onExpand}>Full PA →</button>
      </div>
      <div style={{fontSize:9.5,color:"var(--ink-4)",marginTop:5,lineHeight:1.4}}>Enter to send · I'll allocate tasks automatically</div>
    </div>
  );
}

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
  const [darkMode,setDarkMode]    = useState(false);
  const [notifPerm,setNotifPerm]  = useState("default");
  const [activeAlerts,setActiveAlerts] = useState([]);
  const [selectedTasks,setSelectedTasks] = useState(new Set());
  const [focusMode,setFocusMode]   = useState(null); // {task, key}
  const [showScoreBreakdown,setShowScoreBreakdown] = useState(false);
  const [showMoreNav,setShowMoreNav] = useState(false);
  const [showTopbarMore,setShowTopbarMore] = useState(false);
  const [quickAddTitle,setQuickAddTitle] = useState("");
  const [quickAddDue,setQuickAddDue]     = useState("");
  const [quickAddBrand,setQuickAddBrand] = useState("");
  const [quickAddTab,setQuickAddTab]     = useState("Miscellaneous");
  const [quickAddPriority,setQuickAddPriority] = useState("medium");
  const [aiSuggestions,setAiSuggestions] = useState(()=>{
    try{
      const cached=JSON.parse(localStorage.getItem("prodash_ai_suggestions")||"null");
      if(cached && cached.date===new Date().toISOString().split("T")[0]) return cached.suggestions;
    }catch{}
    return [];
  });
  const [aiSuggestionsLoading,setAiSuggestionsLoading] = useState(false);
  const [dashBrandFilter,setDashBrandFilter] = useState("all");
  const [focusSecs,setFocusSecs]   = useState(POMODORO_MINS*60);
  const [focusRunning,setFocusRunning] = useState(false);
  const [focusStarted,setFocusStarted] = useState(null);
  const [showConfetti,setShowConfetti] = useState(false);
  const [taskLightbox,setTaskLightbox] = useState(null);
  const [showAIGen,setShowAIGen]   = useState(false);
  const [showTemplates,setShowTemplates] = useState(false);
  const [streak,setStreak]         = useState(loadStreak);
  const [scoreHistory,setScoreHistory]         = useState(loadScoreHist);
  const [paChat,setPaChat]                     = useState(loadPAChat);
  const [paLoading,setPaLoading]               = useState(false);
  const [moods,setMoods]                       = useState(loadMoods);
  const [showMoodCheck,setShowMoodCheck]       = useState(false);
  const [todayMood,setTodayMood]               = useState(null);
  const [brandColor,setBrandColor]             = useState(null);
  const [showNarrative,setShowNarrative]       = useState(false);
  const [narrativeText,setNarrativeText]       = useState("");
  const [narrativeLoading,setNarrativeLoading] = useState(false);
  const [profileText,setProfileText]           = useState("");
  const [profileLoading,setProfileLoading]     = useState(false);
  const [showProfile,setShowProfile]           = useState(false);
  const [searchScope,setSearchScope]           = useState("tasks");
  const [weeklyReviews,setWeeklyReviews]       = useState(loadWeekly);
  const [acctData,setAcctData]               = useState(loadAcct);
  const [missionTask,setMissionTask]           = useState(null);
  const [missionDone,setMissionDone]           = useState(false);
  const [showMorningPrompt,setShowMorningPrompt] = useState(false);
  const [showEOD,setShowEOD]                   = useState(false);
  const [missedTasks,setMissedTasks]           = useState([]);
  const [eodDismissed,setEodDismissed]         = useState(false);
  const [showBrainDump,setShowBrainDump]       = useState(false);
  const prevRates = useRef({});
  const focusTimer = useRef(null);
  const [radioMode,setRadioMode]           = useState(false);
  const [showWhatIf,setShowWhatIf]         = useState(false);
  const [whatIfLoading,setWhatIfLoading]   = useState(false);
  const [whatIfResult,setWhatIfResult]     = useState(null);
  const [whatIfInput,setWhatIfInput]       = useState("");
  const [voiceActive,setVoiceActive]       = useState(false);
  const [voiceText,setVoiceText]           = useState("");
  const [stuckTasks,setStuckTasks]         = useState([]);
  const [stuckLoading,setStuckLoading]     = useState(false);
  const stuckRef = useRef(false);
  const recogRef = useRef(null);
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

  // session log effect — moved below

  // ── Brand colour immersion ──
  useEffect(()=>{
    if(activeBrand && view==="brand"){
      const b=BRANDS.find(b=>b.id===activeBrand);
      if(b) setBrandColor(b.color);
    } else {
      setBrandColor(null);
    }
  },[activeBrand,view]);

  // Mood check-in removed

  // ── Streak save ──
  useEffect(()=>{ saveStreakLS(streak); },[streak]);


  // score history effect moved below

  // ── Morning prompt: "yesterday I meant to..." ──
  useEffect(()=>{
    const lastVisit=localStorage.getItem("prodash_last_visit");
    const today=todayStr();
    const yesterday=new Date(Date.now()-86400000).toISOString().split("T")[0];
    if(lastVisit&&lastVisit===yesterday){
      const allTasks=Object.values(data.tasks).flat();
      const missed=allTasks.filter(t=>!t.done&&t.due===yesterday);
      if(missed.length>0){setMissedTasks(missed);setShowMorningPrompt(true);}
    }
    localStorage.setItem("prodash_last_visit",today);
  // eslint-disable-next-line
  },[]);

  // ── EOD summary at 5pm ──
  useEffect(()=>{
    const check=()=>{
      const h=new Date().getHours();
      if(h>=17&&h<18&&!eodDismissed) setShowEOD(true);
      else if(h>=18) setShowEOD(false);
    };
    check();
    const t=setInterval(check,60000);
    return()=>clearInterval(t);
  },[eodDismissed]);

  // ── Pick daily mission task ──
  useEffect(()=>{
    const today=todayStr();
    const mKey="prodash_mission_"+today;
    const stored=localStorage.getItem(mKey);
    if(stored){try{const m=JSON.parse(stored);setMissionTask(m.task);setMissionDone(m.done||false);}catch{}}
    else{
      // pick highest priority overdue or urgent task
      const all=Object.entries(data.tasks).flatMap(([k,ts])=>ts.map(t=>({...t,key:k})));
      const candidates=all.filter(t=>!t.done).sort((a,b)=>{
        const pOrder={urgent:0,high:1,medium:2,low:3};
        const ap=pOrder[a.priority]??2, bp=pOrder[b.priority]??2;
        if(ap!==bp)return ap-bp;
        if(a.due&&b.due)return a.due.localeCompare(b.due);
        if(a.due)return -1; if(b.due)return 1;
        return 0;
      });
      if(candidates[0]){setMissionTask(candidates[0]);localStorage.setItem(mKey,JSON.stringify({task:candidates[0],done:false}));}
    }
  // eslint-disable-next-line
  },[]);

  // ── Accountability mirror: Monday check ──
  useEffect(()=>{
    const day=new Date().getDay();
    if(day!==1)return; // Monday only
    const lastMonday=localStorage.getItem("prodash_acct_monday");
    const thisMonday=todayStr();
    if(lastMonday===thisMonday)return;
    localStorage.setItem("prodash_acct_monday",thisMonday);
    const prev=loadAcct();
    if(prev.commitment){
      const allTasks=Object.values(data.tasks).flat();
      const weekAgo=new Date(Date.now()-7*86400000).toISOString().split("T")[0];
      const weekDone=allTasks.filter(t=>t.done&&t.doneAt>=weekAgo).length;
      const followThrough=prev.commitment>0?Math.round(weekDone/prev.commitment*100):0;
      const newAcct={...prev,lastWeekCommit:prev.commitment,lastWeekDone:weekDone,lastWeekPct:followThrough,commitment:0};
      setAcctData(newAcct); saveAcct(newAcct);
    }
  // eslint-disable-next-line
  },[]);

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

  // briefing effect — moved below

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
      if(e.key==="r"||e.key==="R"){setRadioMode(p=>!p);return;}
      if(e.key==="f"||e.key==="F"){setView("ai");setActiveBrand(null);return;}
      if(e.key==="?"){setShowShortcuts(true);return;}
    };
    window.addEventListener("keydown",handler);
    return()=>window.removeEventListener("keydown",handler);
  },[]);

  // ── Service Worker Registration ──
  const swRef = useRef(null);
  useEffect(()=>{
    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("/prodash/sw.js",{scope:"/prodash/"})
        .then(reg=>{
          swRef.current=reg;
          if(reg.active) reg.active.postMessage({type:"CHECK_NOW"});
          if("periodicSync" in reg){
            reg.periodicSync.register("prodash-check",{minInterval:60*60*1000}).catch(()=>{});
          }
        })
        .catch(e=>console.warn("SW registration failed:",e));
      // Listen for SW navigation requests (from notification click)
      navigator.serviceWorker.addEventListener("message", e => {
        if(e.data?.type==="NAVIGATE" && e.data.view){
          setView(e.data.view);
        }
      });
    }
  },[]);

  // ── Send briefing snapshot to SW whenever data changes ──
  // (SW uses this for the 8:30am daily notification)
  const sendBriefingToSW = useCallback(()=>{
    if(!("serviceWorker" in navigator) || Notification.permission !== "granted") return;
    const today = todayStr();
    const allT = Object.values(data.tasks).flat();
    const overdue = allT.filter(t=>!t.done&&t.due&&t.due<today).length;
    const todayDue = allT.filter(t=>!t.done&&t.due===today).length;
    const pending = allT.filter(t=>!t.done).length;
    const sc = getScore();
    // Detect silent brands (nothing logged in 7+ days)
    const todayDone = allT.filter(t=>t.done&&t.doneAt?.startsWith(today)).length;
    const todayTotal = allT.filter(t=>t.createdAt?.startsWith(today)||t.due===today).length;
    const sevenDaysAgo = new Date(Date.now()-7*86400000).toISOString().split("T")[0];
    const brandAlerts = BRANDS.filter(b=>{
      const bTasks = Object.entries(data.tasks)
        .filter(([k])=>k.startsWith(b.id))
        .flatMap(([,v])=>v);
      const recentActivity = bTasks.some(t=>t.createdAt>=sevenDaysAgo||t.doneAt>=sevenDaysAgo);
      return bTasks.length>0 && !recentActivity;
    }).map(b=>`${b.emoji} ${b.name} — no activity in 7+ days`);
    navigator.serviceWorker.ready.then(reg=>{
      reg.active?.postMessage({
        type:"UPDATE_BRIEFING",
        overdue, todayDue, pending, score:sc, brandAlerts,
        todayDone, todayTotal
      });
    }).catch(()=>{});
  },[data]);

  // Send briefing update whenever data changes
  useEffect(()=>{ sendBriefingToSW(); },[data]);

  // ── Schedule a notification via service worker ──
  const scheduleNotification = useCallback((id, title, body, scheduledTime)=>{
    if(!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then(reg=>{
      reg.active?.postMessage({type:"SCHEDULE_NOTIFICATION",id,title,body,scheduledTime});
    }).catch(()=>{});
  },[]);

  const cancelNotification = useCallback((id)=>{
    if(!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.ready.then(reg=>{
      reg.active?.postMessage({type:"CANCEL_NOTIFICATION",id});
    }).catch(()=>{});
  },[]);

  const requestNotifPermission=async()=>{
    if("Notification" in window){
      const p=await Notification.requestPermission();
      setNotifPerm(p);
      if(p==="granted"){
        showToast("Notifications enabled! You'll be notified for all tasks and reminders.");
        // Re-register SW after permission granted
        if("serviceWorker" in navigator){
          navigator.serviceWorker.ready.then(reg=>{
            reg.active?.postMessage({type:"CHECK_NOW"});
          });
        }
      }
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

  // ══════════════════════════════════════════
  //  AUTO-AI ENGINE — reads data, self-improves
  //  Runs on load + every 30 mins
  // ══════════════════════════════════════════
  const runAutoAI = useCallback(async () => {
    const allTasks = Object.values(data.tasks).flat();
    const overdue = allTasks.filter(t=>!t.done&&t.due&&t.due<todayStr());
    const pending = allTasks.filter(t=>!t.done);
    const doneToday = allTasks.filter(t=>t.done&&t.doneAt?.startsWith(todayStr()));
    // Focus brand insights on the 5 core wagering brands (not TechDev/Misc)
    const brandData = CORE_BRANDS().map(b=>{
      const bt = Object.entries(data.tasks).filter(([k])=>k.startsWith(b.id)).flatMap(([,v])=>v);
      return `${b.name}: ${bt.filter(t=>!t.done).length} pending, ${bt.filter(t=>!t.done&&t.due&&t.due<todayStr()).length} overdue, ${bt.filter(t=>t.done).length} done`;
    }).join(" | ");
    const currentScore = getScore();

    const prompt = `You are the PRODASH AI engine. Analyse this real-time data and return smart insights.

CONTEXT: User manages 5 wagering brands (Goldbet, Ultrabet, BoostBet, AllBets, BetGold). TechDev is internal/tech work, Misc is a catch-all. When commenting on "the brands" or "all brands", focus on the 5 wagering brands only.

DATA:
- Score: ${currentScore}/100
- Total pending: ${pending.length}, Overdue: ${overdue.length}, Done today: ${doneToday.length}
- Wagering brands: ${brandData}
- Goals active: ${(data.goals||[]).filter(g=>!g.achieved).length}
- Notes: ${(data.notes||[]).length}
- Today: ${todayStr()} (${new Date().toLocaleDateString('en-AU',{weekday:'long'})})

Return ONLY a valid JSON object (no markdown, no explanation):
{
  "briefing": "2-sentence exec briefing, specific numbers, biggest risk right now",
  "topPriority": "single most important task to do right now, be specific",
  "alerts": ["alert 1 if critical issue exists", "alert 2 if needed"],
  "brandInsight": "one sharp insight about brand performance pattern",
  "suggestion": "one proactive suggestion to improve productivity today"
}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:600,messages:[{role:"user",content:prompt}]})
      });
      const json = await res.json();
      const raw = json.content?.find(c=>c.type==="text")?.text||"";
      const cleaned = raw.replace(/```json|```/g,"").trim();
      const parsed = JSON.parse(cleaned);
      setInsights(p=>({...p,
        briefing: parsed.briefing||p.briefing,
        autoTop: parsed.topPriority||"",
        autoAlerts: parsed.alerts||[],
        autoBrand: parsed.brandInsight||"",
        autoSuggest: parsed.suggestion||""
      }));
    } catch(e) { /* silent fail */ }
  }, [data, API_KEY]);

  // Run auto-AI on first load (after 2s delay) + every 30 mins
  useEffect(()=>{
    const t1 = setTimeout(()=>runAutoAI(), 2000);
    const t2 = setInterval(()=>runAutoAI(), 30*60*1000);
    return ()=>{ clearTimeout(t1); clearInterval(t2); };
  // eslint-disable-next-line
  },[]);

  // Re-run when score changes significantly
  const prevScore = useRef(0);
  useEffect(()=>{
    const s = getScore();
    if(Math.abs(s - prevScore.current) >= 5){
      prevScore.current = s;
      runAutoAI();
    }
  // eslint-disable-next-line
  },[data, runAutoAI]);

  // ── Save score history daily (after getScore is defined) ──
  useEffect(()=>{
    const today=todayStr();
    const hist=loadScoreHist();
    const last=hist[hist.length-1];
    if(!last||last.date!==today){
      const s=getScore();
      const newHist=[...hist,{date:today,score:s}].slice(-90);
      setScoreHistory(newHist); saveScoreHist(newHist);
    }
  // eslint-disable-next-line
  },[]);

  // ── Save score history daily ──

  // ── CRUD ──
  const addTask=useCallback((form)=>{
    const brand=form.brand||activeBrand||"misc";
    const tab=form.tab||brandTab;
    const key=`${brand}_${tab}`;
    const task={id:uid(),title:form.title,priority:form.priority||"medium",due:form.due||"",category:form.category||"",note:form.note||"",estimatedMins:form.estimatedMins||null,timeSpent:0,done:false,createdAt:nowISO(),recurrence:form.recurrence||"",kanbanStatus:form.kanbanStatus||"todo",attachments:form.attachments||[]};
    setData(p=>({...p,tasks:{...p.tasks,[key]:[...(p.tasks[key]||[]),task]}}));
    addLog("task_added",`Task: "${task.title}"`,brand,tab,task.category?`Category: ${task.category}`:"");
    showToast(`Task added to ${BRANDS.find(b=>b.id===brand)?.name||brand} · ${tab}`);
    // Schedule notification if task has a due date and is not already done
    if(task.due && !task.done && Notification.permission==="granted"){
      // Notify at 9am on due date
      const dueDate = new Date(task.due + "T09:00:00");
      const now = new Date();
      if(dueDate > now){
        scheduleNotification(
          `task_${task.id}`,
          `${task.priority==="urgent"?"🚨":"📌"} ${task.title}`,
          `Due today · ${BRANDS.find(b=>b.id===brand)?.name||brand} › ${tab}${task.priority==="urgent"?" · URGENT":""}`,
          dueDate.getTime()
        );
      }
      // Also notify 1 day before if urgent or high
      if((task.priority==="urgent"||task.priority==="high") && dueDate > now){
        const dayBefore = new Date(dueDate.getTime() - 24*60*60*1000);
        if(dayBefore > now){
          scheduleNotification(
            `task_${task.id}_early`,
            `⏰ Tomorrow: ${task.title}`,
            `Due tomorrow · ${task.priority} priority · ${BRANDS.find(b=>b.id===brand)?.name||brand}`,
            dayBefore.getTime()
          );
        }
      }
    }
  },[activeBrand,brandTab,addLog,showToast,scheduleNotification]);

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
        if(done) setTimeout(()=>playDone(),50);
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
    // Cancel any scheduled notifications for this task
    cancelNotification(`task_${id}`);
    cancelNotification(`task_${id}_early`);
    showToast("Task deleted","warning");
  },[addLog,showToast]);

  const snoozeTask=useCallback((key,id,days)=>{
    setData(p=>{
      const tasks=(p.tasks[key]||[]).map(t=>{
        if(t.id!==id) return t;
        const d=new Date(); d.setDate(d.getDate()+days);
        return {...t,due:d.toISOString().split("T")[0]};
      });
      return {...p,tasks:{...p.tasks,[key]:tasks}};
    });
    showToast(`Snoozed ${days===1?"1 day":days===3?"3 days":days===7?"1 week":days+" days"}`);
  },[showToast]);

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
    const rem={id:uid(),title:form.title,date:form.date,time:form.time,brand:form.brand||"misc",note:form.note,createdAt:nowISO(),notified:false};
    setData(p=>({...p,reminders:[...p.reminders,rem].sort((a,b)=>a.date.localeCompare(b.date))}));
    addLog("reminder_set",`Reminder: "${form.title}" on ${fmtDate(form.date)}`,form.brand||null,null,"");
    showToast("Reminder set + task created 📋");
    // Auto-create a task from this reminder
    const brand = form.brand||"misc";
    const tab = form.tab||"Miscellaneous";
    const taskKey = `${brand}_${tab}`;
    const autoTask = {
      id:uid(), title:form.title, priority:form.priority||"medium",
      due:form.date||"", category:"", note:form.note||"",
      estimatedMins:null, timeSpent:0, done:false,
      createdAt:nowISO(), recurrence:"", kanbanStatus:"todo",
      attachments:[], reminderId:rem.id
    };
    setData(p=>({...p,tasks:{...p.tasks,[taskKey]:[...(p.tasks[taskKey]||[]),autoTask]}}));
    // Schedule push notification for the reminder time
    if(form.date && Notification.permission==="granted"){
      const timeStr = form.time||"09:00";
      const scheduledTime = new Date(`${form.date}T${timeStr}:00`).getTime();
      if(scheduledTime > Date.now()){
        scheduleNotification(
          `rem_${rem.id}`,
          `🔔 Reminder: ${form.title}`,
          `${form.date} at ${timeStr}${form.brand?" · "+BRANDS.find(b=>b.id===form.brand)?.name:""}`,
          scheduledTime
        );
      }
    }
  },[addLog,showToast,scheduleNotification]);

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

  // ── Save mood ──
  const saveMood = useCallback((score)=>{
    const today=todayStr();
    const updated=[...loadMoods().filter(m=>m.date!==today),{date:today,score,ts:nowISO()}];
    setMoods(updated); saveMoods(updated);
    setTodayMood(score); setShowMoodCheck(false);
    const msgs={1:"Logged. Take it easy — do the easy wins today.",2:"Noted. Start small, build momentum.",3:"Good. A solid productive day ahead.",4:"Great energy. Tackle the hard stuff now.",5:"On fire! Attack the biggest challenges."};
    showToast(msgs[score]||"Mood logged");
  },[showToast]);

  // ── Generate narrative ──
  const generateNarrative = useCallback(async()=>{
    setNarrativeLoading(true); setShowNarrative(true);
    const bs=getBrandStatsRaw();
    const weekAgo=new Date(Date.now()-7*86400000).toISOString().split("T")[0];
    const allTasks=Object.values(data.tasks).flat();
    const weekDone=allTasks.filter(t=>t.done&&t.doneAt>=weekAgo).length;
    const weekMoods=moods.filter(m=>m.date>=weekAgo);
    const avgMood=weekMoods.length?Math.round(weekMoods.reduce((s,m)=>s+m.score,0)/weekMoods.length*10)/10:null;
    const context=`Week: ${weekDone} tasks completed. Brands: ${bs.map(b=>`${b.name} ${b.rate}% (${b.hg?.grade})`).join(", ")}. Overdue: ${bs.reduce((s,b)=>s+b.overdue,0)}. ${avgMood?`Avg mood: ${avgMood}/5.`:""}`;
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:400,
          system:"Write a brief, human weekly narrative for a professional managing multiple betting/gaming brands. Write in second person, past tense. 3-4 sentences. Be specific, honest, insightful. Not corporate. Like a good manager telling you what your week looked like.",
          messages:[{role:"user",content:"Write my week as a narrative. "+context}]})});
      const json=await res.json();
      setNarrativeText(json.content?.filter(c=>c.type==="text").map(c=>c.text).join("")||"");
    }catch{setNarrativeText("Could not generate — try again.");}
    setNarrativeLoading(false);
  },[getBrandStatsRaw,data.tasks,moods,API_KEY]);

  // ── Generate productivity profile ──
  const generateProfile = useCallback(async()=>{
    setProfileLoading(true); setShowProfile(true);
    const allTasks=Object.values(data.tasks).flat();
    const bs=getBrandStatsRaw();
    const moodHist=moods.slice(-30);
    const avgMood=moodHist.length?Math.round(moodHist.reduce((s,m)=>s+m.score,0)/moodHist.length*10)/10:null;
    const journalEntries=Object.keys(data.journal||{}).length;
    const decisions=(data.decisions||[]).length;
    const totalDone=allTasks.filter(t=>t.done).length;
    const overduePct=allTasks.length?Math.round(allTasks.filter(t=>!t.done&&t.due&&t.due<todayStr()).length/allTasks.length*100):0;
    const context=`Total tasks completed: ${totalDone}. Overdue rate: ${overduePct}%. Brands: ${bs.map(b=>`${b.name} ${b.hg?.grade}`).join(", ")}. Journal entries: ${journalEntries}. Decisions logged: ${decisions}. Average mood: ${avgMood||"not tracked"}/5. Streak: ${streak.current||0} days (best: ${streak.best||0}).`;
    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:700,
          system:"You generate honest, insightful productivity profiles. Be direct, specific, and genuinely useful. Not generic. Write 4 sections: Your Strengths, Your Blind Spots, Your Patterns, One Recommendation. Use second person. Be a trusted advisor, not a cheerleader.",
          messages:[{role:"user",content:"Generate my productivity profile based on: "+context}]})});
      const json=await res.json();
      setProfileText(json.content?.filter(c=>c.type==="text").map(c=>c.text).join("")||"");
    }catch{setProfileText("Could not generate — try again.");}
    setProfileLoading(false);
  },[getBrandStatsRaw,data,moods,streak,API_KEY]);

  // ── Session log ──
  useEffect(()=>{addLog("session_start","Session started",null,null,null);},[]);



  // ── Completion sound ──
  const playDone=useCallback(()=>{
    try{
      const ctx=new(window.AudioContext||window.webkitAudioContext)();
      const osc=ctx.createOscillator(); const gain=ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(523,ctx.currentTime);
      osc.frequency.setValueAtTime(659,ctx.currentTime+0.08);
      osc.frequency.setValueAtTime(784,ctx.currentTime+0.16);
      gain.gain.setValueAtTime(0.15,ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.5);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime+0.5);
    }catch{}
  },[]);

  // ── Goals CRUD ──
  const addGoal=useCallback((g)=>{
    const goal={id:uid(),title:g.title,description:g.description||"",targetDate:g.targetDate||"",brand:g.brand||"",category:g.category||"",targetValue:g.targetValue||"",unit:g.unit||"",progress:0,done:false,createdAt:nowISO()};
    setData(p=>({...p,goals:[...(p.goals||[]),goal]}));
    showToast("Goal added");
  },[showToast]);
  const updateGoalProgress=useCallback((id,progress,done)=>{
    setData(p=>({...p,goals:(p.goals||[]).map(g=>g.id===id?{...g,progress,done,doneAt:done?nowISO():null}:g)}));
  },[]);
  const deleteGoal=useCallback((id)=>{setData(p=>({...p,goals:(p.goals||[]).filter(g=>g.id!==id)}));showToast("Goal deleted","warning");},[showToast]);

  // ── Decisions CRUD ──
  const addDecision=useCallback((d)=>{
    const dec={id:uid(),title:d.title,context:d.context||"",decision:d.decision||"",reasoning:d.reasoning||"",brand:d.brand||"",outcome:d.outcome||"pending",createdAt:nowISO()};
    setData(p=>({...p,decisions:[dec,...(p.decisions||[])]}));
    showToast("Decision logged");
  },[showToast]);
  const deleteDecision=useCallback((id)=>{setData(p=>({...p,decisions:(p.decisions||[]).filter(d=>d.id!==id)}));showToast("Decision deleted","warning");},[showToast]);

  // ── Journal CRUD ──
  const saveJournalEntry=useCallback((date,entry)=>{
    setData(p=>({...p,journal:{...(p.journal||{}), [date]:{...((p.journal||{})[date]||{}), ...entry, updatedAt:nowISO()}}}));
  },[]);

  // ── Mission ──
  const completeMission=useCallback(()=>{
    if(!missionTask)return;
    toggleTask(missionTask.key,missionTask.id);
    setMissionDone(true);
    const today=todayStr();
    localStorage.setItem("prodash_mission_"+today,JSON.stringify({task:missionTask,done:true}));
    playDone();
    showToast("🎯 Mission complete!");
  },[missionTask,toggleTask,playDone,showToast]);

  // ── Set weekly commitment ──
  const setCommitment=useCallback((n)=>{
    const newAcct={...acctData,commitment:n,commitDate:todayStr()};
    setAcctData(newAcct); saveAcct(newAcct);
    showToast("Commitment set: "+n+" tasks this week");
  },[acctData,showToast]);

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

  // ── What-If Simulator ──
  const runWhatIf = async (scenario) => {
    setWhatIfLoading(true); setWhatIfResult(null);
    const bs = getBrandStatsRaw();
    const context = bs.map(b=>`${b.emoji} ${b.name}: ${b.rate}% done, ${b.overdue} overdue, grade ${b.hg?.grade}`).join("\n");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body: JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:600,
          system:"You are a strategic operations analyst. Given brand performance data and a hypothetical scenario, model the likely impact. Be specific with numbers and risks. 4-6 sentences.",
          messages:[{role:"user",content:`Current brand status:\n${context}\n\nScenario: ${scenario}\n\nModel the impact: what happens to each affected brand's health grade, what risks emerge, what opportunities open up, and what is your recommendation?`}]})
      });
      const json = await res.json();
      setWhatIfResult(json.content?.filter(c=>c.type==="text").map(c=>c.text).join("")||"");
    } catch { setWhatIfResult("Could not simulate — try again."); }
    setWhatIfLoading(false);
  };

  // ── Stuck Task Detector ──
  const detectStuck = async () => {
    setStuckLoading(true);
    const allTasks = Object.entries(data.tasks).flatMap(([k,ts])=>ts.map(t=>({...t,key:k})));
    const old14 = allTasks.filter(t=>!t.done&&taskAgeDays(t.createdAt)>14).slice(0,10);
    if(!old14.length){setStuckTasks([]);stuckRef.current="done";setStuckLoading(false);return;}
    const taskList = old14.map((t,i)=>`${i+1}. "${t.title}" (${Math.floor(taskAgeDays(t.createdAt))} days old, ${t.priority} priority)`).join("\n");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body: JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:800,
          system:'You break down stuck tasks. For each stuck task, return ONLY a JSON array — no markdown, no backticks. Format: [{"original":"string","reason":"why it might be stuck","firstStep":"the single smallest next action, 5 min max","rewrite":"rewritten as a smaller actionable task"}]',
          messages:[{role:"user",content:"Break down these stuck tasks:\n"+taskList}]})
      });
      const json = await res.json();
      const text = json.content?.filter(c=>c.type==="text").map(c=>c.text).join("")||"[]";
      const parsed = JSON.parse(text.replace(/```json|```/g,"").trim());
      setStuckTasks(parsed.map((s,i)=>({...s,task:old14[i]})));
    stuckRef.current="done";
    } catch { setStuckTasks([]); stuckRef.current="done"; }
    setStuckLoading(false);
  };

  // ── Voice Capture ──
  const startVoice = () => {
    const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){showToast("Voice not supported in this browser","warning");return;}
    const r = new SR();
    r.lang="en-GB"; r.continuous=false; r.interimResults=true;
    r.onstart = ()=>setVoiceActive(true);
    r.onresult = e=>{
      const t=[...e.results].map(r=>r[0].transcript).join("");
      setVoiceText(t);
    };
    r.onend = async()=>{
      setVoiceActive(false);
      const final = recogRef.current?.text||"";
      if(!final.trim()) return;
      // AI parse the voice input into a task
      try {
        const res = await fetch("https://api.anthropic.com/v1/messages",{
          method:"POST",
          headers:{"Content-Type":"application/json","x-api-key":API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
          body: JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:300,
            system:'Parse voice input into a task. Return ONLY JSON, no markdown: {"title":"string","priority":"medium","brand":"goldbet","tab":"Reporting","due":"YYYY-MM-DD or empty","note":""}. brand must be: goldbet|ultrabet|boostbet|allbets|betgold|techdev. priority: low|medium|high|urgent.',
            messages:[{role:"user",content:'Voice input: "'+final+'"\nToday is '+todayStr()}]})
        });
        const json = await res.json();
        const text = json.content?.filter(c=>c.type==="text").map(c=>c.text).join("")||"";
        const task = JSON.parse(text.replace(/```json|```/g,"").trim());
        addTask(task);
        showToast("🎤 Added: "+task.title);
      } catch {
        // fallback: add as plain task
        addTask({title:final,priority:"medium",brand:activeBrand||"goldbet",tab:brandTab});
        showToast("🎤 Task added: "+final);
      }
      setVoiceText("");
    };
    r.onerror = ()=>{setVoiceActive(false);showToast("Voice error — try again","warning");};
    recogRef.current = {recognition:r,text:""};
    r.onresult = e=>{const t=[...e.results].map(r=>r[0].transcript).join("");setVoiceText(t);recogRef.current.text=t;};
    r.start();
  };
  const stopVoice = ()=>recogRef.current?.recognition?.stop();

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

  // ── Auto AI briefing on load ──
  useEffect(()=>{
    const timer=setTimeout(()=>{
      fetchInsight("briefing","Give me a sharp executive morning briefing. Cover top risks, today's priority, and one strategic insight. Max 3 sentences. Be specific about brands and numbers.");
    },2000);
    return()=>clearTimeout(timer);
  },[]);


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

  // ══════════════════════════════════════════════════════════
  //  AI SUGGESTION ENGINE — learns from history
  // ══════════════════════════════════════════════════════════
  
  // Local pattern detection — finds recurring patterns without API call
  const detectLocalPatterns = useCallback((brandFilter="all") => {
    const allTasks = Object.entries(data.tasks).flatMap(([key,tasks])=>{
      const [bid,...rest]=key.split("_");
      return tasks.map(t=>({...t,brand:bid,tab:rest.join("_")}));
    });
    const scoped = brandFilter==="all" ? allTasks : allTasks.filter(t=>t.brand===brandFilter);
    const done = scoped.filter(t=>t.done&&t.doneAt);
    
    if(done.length<3) return [];
    
    const today = new Date();
    const todayStr_ = today.toISOString().split("T")[0];
    const suggestions = [];
    
    // 1. Find recurring task titles - same title done 2+ times
    const titleGroups = {};
    done.forEach(t=>{
      const norm = t.title.toLowerCase().trim().replace(/\b(20\d{2}|q[1-4]|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|monday|tuesday|wednesday|thursday|friday|january|february|march|april|june|july|august|september|october|november|december)\b/gi,"").replace(/\s+/g," ").trim();
      if(!titleGroups[norm]) titleGroups[norm] = [];
      titleGroups[norm].push(t);
    });
    
    Object.entries(titleGroups).forEach(([norm,occurrences])=>{
      if(occurrences.length<2 || norm.length<5) return;
      // Sort by date, find avg gap
      const sorted = occurrences.sort((a,b)=>new Date(a.doneAt)-new Date(b.doneAt));
      const lastDone = new Date(sorted[sorted.length-1].doneAt);
      const daysSince = Math.floor((today-lastDone)/86400000);
      
      // Calculate typical gap between occurrences
      const gaps = [];
      for(let i=1;i<sorted.length;i++){
        gaps.push((new Date(sorted[i].doneAt)-new Date(sorted[i-1].doneAt))/86400000);
      }
      const avgGap = gaps.reduce((a,b)=>a+b,0)/gaps.length;
      
      // If we're approaching or past the typical recurrence
      if(daysSince >= avgGap*0.8 && daysSince <= avgGap*1.5) {
        const template = sorted[sorted.length-1];
        suggestions.push({
          title: template.title,
          brand: template.brand,
          tab: template.tab,
          priority: template.priority||"medium",
          reason: `Usually done every ${Math.round(avgGap)} days · last ${daysSince}d ago`,
          urgency: daysSince > avgGap*1.2 ? "high" : "normal",
          source: "recurring"
        });
      }
    });
    
    // 2. Day-of-week pattern
    const dowName = today.toLocaleDateString("en-US",{weekday:"long"});
    const dowTasks = done.filter(t=>{
      const td = new Date(t.doneAt);
      return td.toLocaleDateString("en-US",{weekday:"long"})===dowName;
    });
    
    if(dowTasks.length>=3) {
      // Group by title and find most-frequent ones done on this day
      const dowFreq = {};
      dowTasks.forEach(t=>{
        const k=t.title.toLowerCase().trim();
        if(!dowFreq[k]) dowFreq[k]={count:0,task:t};
        dowFreq[k].count++;
      });
      const topDow = Object.values(dowFreq).filter(x=>x.count>=2).sort((a,b)=>b.count-a.count).slice(0,2);
      topDow.forEach(({task,count})=>{
        // Don't double-suggest if already in recurring list
        if(!suggestions.some(s=>s.title.toLowerCase()===task.title.toLowerCase())) {
          suggestions.push({
            title: task.title,
            brand: task.brand,
            tab: task.tab,
            priority: task.priority||"medium",
            reason: `You typically do this on ${dowName}s (${count}× before)`,
            urgency: "normal",
            source: "dow"
          });
        }
      });
    }
    
    // 3. Month-of-month pattern (e.g. month-end reporting)
    const dom = today.getDate();
    const dayOfMonthTasks = done.filter(t=>{
      const td = new Date(t.doneAt);
      return Math.abs(td.getDate()-dom)<=2;
    });
    
    if(dayOfMonthTasks.length>=3) {
      const domFreq = {};
      dayOfMonthTasks.forEach(t=>{
        const k=t.title.toLowerCase().trim();
        if(!domFreq[k]) domFreq[k]={count:0,task:t};
        domFreq[k].count++;
      });
      const topDom = Object.values(domFreq).filter(x=>x.count>=2).sort((a,b)=>b.count-a.count).slice(0,2);
      topDom.forEach(({task,count})=>{
        if(!suggestions.some(s=>s.title.toLowerCase()===task.title.toLowerCase())) {
          const phrase = dom<=5 ? "early month" : dom>=25 ? "month-end" : "mid-month";
          suggestions.push({
            title: task.title,
            brand: task.brand,
            tab: task.tab,
            priority: task.priority||"medium",
            reason: `${phrase} pattern (${count}× before)`,
            urgency: "normal",
            source: "dom"
          });
        }
      });
    }
    
    return suggestions.slice(0,6);
  }, [data]);
  
  // AI-powered generation — calls Claude API with full context
  const generateAISuggestions = useCallback(async (brandFilter="all") => {
    setAiSuggestionsLoading(true);
    try {
      const allTasks = Object.entries(data.tasks).flatMap(([key,tasks])=>{
        const [bid,...rest]=key.split("_");
        return tasks.map(t=>({...t,brand:bid,tab:rest.join("_")}));
      });
      const scoped = brandFilter==="all" ? allTasks : allTasks.filter(t=>t.brand===brandFilter);
      const recentDone = scoped.filter(t=>t.done&&t.doneAt&&(Date.now()-new Date(t.doneAt))<90*86400000)
        .sort((a,b)=>(b.doneAt||"").localeCompare(a.doneAt||""))
        .slice(0,20);
      const recentPending = scoped.filter(t=>!t.done).slice(0,10);
      
      const today = new Date();
      const dowName = today.toLocaleDateString("en-AU",{weekday:"long"});
      const dom = today.getDate();
      const monthName = today.toLocaleDateString("en-AU",{month:"long"});
      
      const prompt = `You are PRODASH AI — a productivity engine that learns from a wagering industry compliance professional managing 5 wagering brands (Goldbet, Ultrabet, BoostBet, AllBets, BetGold) + TechDev (internal/tech) + Miscellaneous (catch-all).

CURRENT MOMENT:
- ${dowName}, ${dom} ${monthName} 2026
- ${dom<=5?"Early month":dom>=25?"Month-end approaching":"Mid-month"}
${brandFilter!=="all"?`- User is focused on ${brandFilter} brand only`:""}

THEIR RECENT COMPLETED WORK (last 90 days, most recent first):
${recentDone.map(t=>`- "${t.title}" [${t.brand}/${t.tab}] done ${t.doneAt?.split("T")[0]}`).join("\n")||"No history yet."}

CURRENT OPEN TASKS:
${recentPending.map(t=>`- "${t.title}" [${t.brand}/${t.tab}] ${t.due?"due "+t.due:"no due"}`).join("\n")||"None."}

YOUR JOB: Generate 4 INTELLIGENT task suggestions for them to consider RIGHT NOW. Base it on:
1. Patterns in their history (recurring work, day-of-week habits, month cycles)
2. The current date context (e.g. month-end = financial reporting, Mondays = planning)
3. Gaps you can spot (e.g. "haven't done X for brand Y this month")
4. Industry knowledge of wagering compliance work (GRV returns, RGNSW reports, MGA filings, AML reviews, KYC audits, monthly turnover figures, product fee agreements)
5. NEVER suggest TechDev brand for "all" context — TechDev is internal only

For each suggestion include a SHORT reason (max 10 words) explaining why NOW.

Return ONLY valid JSON array (no markdown, no preamble):
[
  {"title": "specific actionable task title", "brand": "goldbet|ultrabet|boostbet|allbets|betgold|misc", "tab": "Reporting|Compliance|Accounting|Miscellaneous", "priority": "low|medium|high|urgent", "reason": "why this matters now"},
  ...4 items
]`;
      
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:900,messages:[{role:"user",content:prompt}]})
      });
      const json = await res.json();
      const text = json.content?.filter(c=>c.type==="text").map(c=>c.text).join("")||"";
      const match = text.match(/\[[\s\S]*\]/);
      if(match) {
        const parsed = JSON.parse(match[0]);
        if(Array.isArray(parsed)) {
          const suggestions = parsed.slice(0,6).map(s=>({...s,source:"ai"}));
          setAiSuggestions(suggestions);
          localStorage.setItem("prodash_ai_suggestions",JSON.stringify({
            date: new Date().toISOString().split("T")[0],
            suggestions
          }));
        }
      }
    } catch(e) {
      console.error("AI suggestion error:",e);
      showToast("Couldn't reach AI — using local patterns only","warning");
    }
    setAiSuggestionsLoading(false);
  }, [data, API_KEY, showToast]);

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

    const renderTaskCard = (t,sectionColor)=>{
      const db = t.due ? dueBadge(t.due) : null;
      return (
        <div key={t.id} className="wr-task-card" onClick={()=>{setActiveBrand(t.brandId);setBrandTab(t.tab);setView("brand");}}>
          <div className="wr-task-title">{t.title}</div>
          <div className="wr-task-meta">
            {t.brand && (
              <span className="task-brand-chip" style={{background:t.brand.color+"15",color:t.brand.color}}>
                {t.brand.name}
              </span>
            )}
            {t.tab && <span className="task-tab-chip">{t.tab}</span>}
            {db && <span className="wr-due-badge" style={{background:db.bg,color:db.color}}>{db.label}</span>}
          </div>
        </div>
      );
    };

    return (
      <div className="wr-page">
        {/* Header */}
        <div className="wr-header">
          <div>
            <div className="wr-eyebrow">Command Centre</div>
            <h1 className="wr-title">War Room</h1>
            <div className="wr-date">{new Date().toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long"})}</div>
          </div>
          <div className="wr-critical">
            <div className="wr-critical-num" style={{color:critical>0?"#DC2626":"#059669"}}>{critical}</div>
            <div className="wr-critical-label">{critical===1?"critical item":"critical items"}</div>
          </div>
        </div>

        {/* Brand health grid */}
        <div className="wr-brand-grid">
          {bStats.filter(b=>CORE_BRAND_IDS.includes(b.id)).map(b=>(
            <div key={b.id} onClick={()=>{setActiveBrand(b.id);setView("brand");}}
              className={`wr-brand-card${b.overdue>0?" wr-brand-card-alert":""}`}>
              <div className="wr-brand-head">
                <span className="wr-brand-dot" style={{background:b.color}}/>
                <span className="wr-brand-name">{b.name}</span>
                <span className="wr-brand-grade" style={{color:b.hg?.color||"#9CA3AF"}}>{b.hg?.grade||"—"}</span>
              </div>
              <div className="wr-brand-bar"><div style={{width:b.rate+"%",background:b.hg?.color||"#9CA3AF"}}/></div>
              <div className="wr-brand-meta">
                <span>{b.rate}% complete</span>
                {b.overdue>0&&<span className="wr-brand-overdue">{b.overdue} overdue</span>}
              </div>
            </div>
          ))}
        </div>

        {/* AI Brief */}
        <div className="wr-ai-brief">
          <div className="wr-ai-head">
            <div className="wr-ai-label">AI Emergency Assessment</div>
            <button onClick={()=>fetchInsight("warroom","WAR ROOM: "+overdue.length+" overdue, "+urgent.length+" urgent. In 3 sharp sentences: the single biggest risk right now, the 2 most critical tasks, one decisive action. Be brutally direct.")}
              disabled={insightLoading["warroom"]} className="wr-ai-btn">
              {insightLoading["warroom"]?"Analysing...":"Generate brief →"}
            </button>
          </div>
          {insightLoading["warroom"]&&<div className="wr-ai-loading">Assessing your data...</div>}
          {insights["warroom"]&&<div className="wr-ai-text">{insights["warroom"]}</div>}
          {!insights["warroom"]&&!insightLoading["warroom"]&&<div className="wr-ai-empty">Tap to get an instant assessment of what to do now.</div>}
        </div>

        {/* Three columns */}
        <div className="wr-columns">
          {[
            {label:"Overdue",items:overdue,color:"#B91C1C",bg:"#FEE2E2"},
            {label:"Urgent",items:urgent,color:"#B45309",bg:"#FEF3C7"},
            {label:"Stale (7+ days)",items:stale.slice(0,8),color:"#92400E",bg:"#FED7AA"},
          ].map(({label,items,color,bg})=>(
            <div key={label} className="wr-column">
              <div className="wr-column-head">
                <span style={{color}}>{label}</span>
                <span className="wr-column-count" style={{background:bg,color}}>{items.length}</span>
              </div>
              {!items.length&&<div className="wr-column-empty">✓ All clear</div>}
              {items.slice(0,10).map(t=>renderTaskCard(t,color))}
              {items.length>10&&<div className="wr-column-more">+ {items.length-10} more</div>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDashboard=()=>{
    const today=todayStr();
    const tomorrow=new Date(Date.now()+86400000).toISOString().split("T")[0];

    // Flatten all tasks across brands with their key info
    const allTasksFlat=Object.entries(data.tasks).flatMap(([key,tasks])=>
      tasks.map(t=>{
        const [brand,...rest]=key.split("_");
        return {...t,key,brand,tab:rest.join("_")};
      })
    );

    // Filter by brand if selected
    const filteredByBrand = dashBrandFilter==="all"
      ? allTasksFlat
      : allTasksFlat.filter(t=>t.brand===dashBrandFilter);

    // Only pending tasks for the list
    const pending = filteredByBrand.filter(t=>!t.done);

    // Sort: overdue first, then by priority, then by due date
    const pOrder={urgent:0,high:1,medium:2,low:3};
    const sorted = [...pending].sort((a,b)=>{
      const aOver = a.due && a.due<today;
      const bOver = b.due && b.due<today;
      if(aOver && !bOver) return -1;
      if(!aOver && bOver) return 1;
      const ap = pOrder[a.priority]??2;
      const bp = pOrder[b.priority]??2;
      if(ap!==bp) return ap-bp;
      if(a.due && b.due) return a.due.localeCompare(b.due);
      if(a.due) return -1;
      if(b.due) return 1;
      return (b.createdAt||"").localeCompare(a.createdAt||"");
    });

    const overdueCount = pending.filter(t=>t.due&&t.due<today).length;
    const dueTodayCount = pending.filter(t=>t.due===today).length;

    const relDate = (due) => {
      if(!due) return null;
      if(due<today){
        const d=Math.ceil((new Date(today)-new Date(due))/86400000);
        return {text:`${d}d overdue`, cls:"task-due-overdue"};
      }
      if(due===today) return {text:"Today", cls:"task-due-today"};
      if(due===tomorrow) return {text:"Tomorrow", cls:"task-due-soon"};
      const d=Math.ceil((new Date(due)-new Date(today))/86400000);
      if(d<=7) return {text:`${d}d`, cls:"task-due-soon"};
      const dt=new Date(due);
      return {text:dt.toLocaleDateString("en-AU",{day:"numeric",month:"short"}), cls:"task-due-later"};
    };

    return (
      <div className="anim-up dash-calm">

        {/* DATE LINE */}
        <div className="dash-date">
          {new Date().toLocaleDateString("en-AU",{weekday:"long",day:"numeric",month:"long"})}
        </div>

        {/* HEADLINE */}
        <div className="dash-headline">
          {pending.length===0 ? (
            <span className="dash-headline-zero">All clear. Nothing pending.</span>
          ) : (
            <>
              <span className="dash-num">{pending.length}</span>
              <span className="dash-label">
                {pending.length===1?"task":"tasks"} pending
                {overdueCount>0 && <span className="dash-pill dash-pill-red">{overdueCount} overdue</span>}
                {dueTodayCount>0 && overdueCount===0 && <span className="dash-pill dash-pill-amber">{dueTodayCount} today</span>}
              </span>
            </>
          )}
        </div>

        {/* QUICK ADD — smart, with brand/tab/priority */}
        <div className="qa-card">
          <input
            className="qa-input"
            placeholder="What needs doing? (Press Enter to add)"
            value={quickAddTitle}
            onChange={e=>setQuickAddTitle(e.target.value)}
            onKeyDown={e=>{
              if(e.key==="Enter"&&quickAddTitle.trim()){
                addTask({
                  title:quickAddTitle.trim(),
                  due:quickAddDue,
                  priority:quickAddPriority||"medium",
                  brand:quickAddBrand||(dashBrandFilter==="all"?"misc":dashBrandFilter),
                  tab:quickAddTab||"Miscellaneous"
                });
                setQuickAddTitle(""); setQuickAddDue("");
              }
            }}
          />
          <div className="qa-meta-row">
            <div className="qa-field">
              <label>Brand</label>
              <select className="qa-select" value={quickAddBrand||(dashBrandFilter==="all"?"misc":dashBrandFilter)} onChange={e=>setQuickAddBrand(e.target.value)}>
                {BRANDS.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="qa-field">
              <label>Category</label>
              <select className="qa-select" value={quickAddTab||"Miscellaneous"} onChange={e=>setQuickAddTab(e.target.value)}>
                {BRAND_TABS.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="qa-field">
              <label>Priority</label>
              <select className="qa-select" value={quickAddPriority||"medium"} onChange={e=>setQuickAddPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="qa-field">
              <label>Due</label>
              <input type="date" className="qa-select" value={quickAddDue} onChange={e=>setQuickAddDue(e.target.value)} />
            </div>
            <button className="qa-add-btn"
              disabled={!quickAddTitle.trim()}
              onClick={()=>{
                if(quickAddTitle.trim()){
                  addTask({
                    title:quickAddTitle.trim(),
                    due:quickAddDue,
                    priority:quickAddPriority||"medium",
                    brand:quickAddBrand||(dashBrandFilter==="all"?"misc":dashBrandFilter),
                    tab:quickAddTab||"Miscellaneous"
                  });
                  setQuickAddTitle(""); setQuickAddDue("");
                }
              }}>
              Add task
            </button>
          </div>
        </div>

        {/* BRAND FILTER */}
        <div className="dash-filter">
          <button onClick={()=>setDashBrandFilter("all")} className={`dash-filter-pill${dashBrandFilter==="all"?" active":""}`}>
            All
          </button>
          {BRANDS.map(b=>(
            <button key={b.id} onClick={()=>setDashBrandFilter(b.id)}
              className={`dash-filter-pill${dashBrandFilter===b.id?" active":""}`}
              style={dashBrandFilter===b.id?{background:b.color,borderColor:b.color,color:"#fff"}:{color:b.color,borderColor:b.color+"40"}}>
              <span className="dash-filter-dot" style={{background:dashBrandFilter===b.id?"#fff":b.color}}/>
              {b.name}
            </button>
          ))}
        </div>

        {/* TASK LIST — grouped by Overdue / Today / This week / Later */}
        {(()=>{
          const inWeek = (d) => {
            if(!d) return false;
            const days=Math.ceil((new Date(d)-new Date(today))/86400000);
            return days>=2 && days<=7;
          };
          const grouped = {
            overdue: sorted.filter(t=>t.due&&t.due<today),
            today: sorted.filter(t=>t.due===today),
            soon: sorted.filter(t=>t.due===tomorrow || inWeek(t.due)),
            later: sorted.filter(t=>!t.due || (t.due!==today && t.due!==tomorrow && !inWeek(t.due) && t.due>=today)),
          };
          const sections = [
            {key:"overdue", label:"Overdue", items:grouped.overdue, cls:"sec-overdue"},
            {key:"today", label:"Today", items:grouped.today, cls:"sec-today"},
            {key:"soon", label:"This week", items:grouped.soon, cls:""},
            {key:"later", label:"Later", items:grouped.later, cls:""},
          ].filter(s=>s.items.length>0);

          const renderRow = (t) => {
            const brand=BRANDS.find(b=>b.id===t.brand);
            const due=relDate(t.due);
            return (
              <div key={t.id} className="task-row">
                <button className="task-check" onClick={()=>toggleTask(t.key,t.id)} aria-label="Complete">
                  <span className="task-check-circle"/>
                </button>
                <div className="task-row-main" onClick={()=>{setActiveBrand(t.brand);setBrandTab(t.tab||"Miscellaneous");setView("brand");}}>
                  <div className="task-row-title-line">
                    {t.priority==="urgent" && <span className="task-pri-urgent">●</span>}
                    {t.priority==="high" && <span className="task-pri-high">●</span>}
                    <span className="task-row-title">{t.title}</span>
                  </div>
                  <div className="task-row-meta">
                    {brand && (
                      <span className="task-brand-chip" style={{background:brand.color+"15",color:brand.color}}>
                        {brand.name}
                      </span>
                    )}
                    {t.tab && (
                      <span className="task-tab-chip">{t.tab}</span>
                    )}
                    {due && (
                      <span className={`task-due-text ${due.cls}`}>{due.text}</span>
                    )}
                  </div>
                </div>
                <div className="task-row-actions">
                  <button className="task-snooze-btn" onClick={()=>snoozeTask(t.key,t.id,1)} title="Snooze 1 day">+1d</button>
                  <button className="task-snooze-btn" onClick={()=>snoozeTask(t.key,t.id,7)} title="Snooze 1 week">+1w</button>
                </div>
              </div>
            );
          };

          if(sorted.length===0){
            // Useful content for empty days - not just "nothing here"
            const allDoneRecent = allTasksFlat.filter(t=>t.done && t.doneAt && (Date.now()-new Date(t.doneAt))<7*86400000);
            const allDoneToday = allTasksFlat.filter(t=>t.done && t.doneAt && t.doneAt.startsWith(today));
            // Next 14 days lookahead
            const futureUpcoming = Object.entries(data.tasks).flatMap(([k,ts])=>
              ts.filter(t=>!t.done&&t.due&&t.due>today).map(t=>{
                const [bId,...rest]=k.split("_");
                return {...t,key:k,brand:bId,tab:rest.join("_")};
              })
            ).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,5);
            // 14-day shape bar
            const next14 = Array.from({length:14},(_,i)=>{
              const d=new Date(); d.setDate(d.getDate()+i);
              const dStr=d.toISOString().split("T")[0];
              const count = Object.values(data.tasks).flat().filter(t=>!t.done&&t.due===dStr).length;
              return {date:dStr, day:d.toLocaleDateString("en-AU",{weekday:"short"}).slice(0,1), dayNum:d.getDate(), count, isToday:dStr===today};
            });
            const maxCount = Math.max(1,...next14.map(d=>d.count));
            // Brand activity
            const brandActivity = CORE_BRANDS().map(b=>{
              const tasks = Object.entries(data.tasks).filter(([k])=>k.startsWith(b.id)).flatMap(([,v])=>v);
              const recent = tasks.filter(t=>(t.createdAt||"")>=new Date(Date.now()-7*86400000).toISOString().split("T")[0] || (t.doneAt||"")>=new Date(Date.now()-7*86400000).toISOString().split("T")[0]).length;
              return {brand:b, recent, total:tasks.length, pending:tasks.filter(t=>!t.done).length};
            }).sort((a,b)=>b.recent-a.recent);
            
            const headline = dashBrandFilter==="all"
              ? (allDoneRecent.length>0 ? `All clear. ${allDoneRecent.length} ${allDoneRecent.length===1?"task":"tasks"} done this week.` : "All clear. Nothing pending.")
              : `No pending tasks for ${BRANDS.find(b=>b.id===dashBrandFilter)?.name||"this brand"}.`;
            
            return (
              <div className="dash-empty-rich">
                <div className="dash-empty-rich-header">{headline}</div>

                {/* 14-day shape bar */}
                {futureUpcoming.length>0 && (
                  <div className="dash-shape-section">
                    <div className="dash-shape-label">The next 14 days</div>
                    <div className="dash-shape-bar">
                      {next14.map((d,i)=>(
                        <div key={i} className={`dash-shape-col${d.isToday?" is-today":""}`} title={`${d.date}: ${d.count} task${d.count!==1?"s":""}`}>
                          <div className="dash-shape-fill" style={{height:d.count>0?`${(d.count/maxCount)*100}%`:"3px",background:d.count===0?"#E5E7EB":d.isToday?"#4F46E5":d.count>=3?"#DC2626":d.count>=2?"#D97706":"#9CA3AF"}}/>
                          <div className="dash-shape-day">{d.day}</div>
                          {d.count>0&&<div className="dash-shape-count">{d.count}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Two-column: upcoming + recent done */}
                <div className="dash-empty-grid">
                  {futureUpcoming.length>0 && (
                    <div className="dash-empty-block">
                      <div className="dash-empty-block-head">Coming up</div>
                      {futureUpcoming.map(t=>{
                        const b=BRANDS.find(x=>x.id===t.brand);
                        const dueDate=new Date(t.due);
                        const daysAway=Math.ceil((dueDate-new Date(today))/86400000);
                        return (
                          <div key={t.id} className="dash-upcoming-row" onClick={()=>{setActiveBrand(t.brand);setBrandTab(t.tab||"Miscellaneous");setView("brand");}}>
                            <div className="dash-upcoming-when">
                              <div className="dash-upcoming-day">{daysAway===1?"Tmrw":daysAway<7?dueDate.toLocaleDateString("en-AU",{weekday:"short"}):dueDate.toLocaleDateString("en-AU",{day:"numeric",month:"short"})}</div>
                              <div className="dash-upcoming-rel">in {daysAway}d</div>
                            </div>
                            <div className="dash-upcoming-info">
                              <div className="dash-upcoming-title">{t.title}</div>
                              {b && <span className="task-brand-chip" style={{background:b.color+"15",color:b.color}}>{b.name}</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  {allDoneRecent.length>0 && (
                    <div className="dash-empty-block">
                      <div className="dash-empty-block-head">Recently shipped</div>
                      <div className="dash-recent-strip">
                        <div className="dash-recent-num">{allDoneRecent.length}</div>
                        <div className="dash-recent-text">
                          <div>{allDoneRecent.length===1?"task":"tasks"} completed in the last 7 days</div>
                          {allDoneToday.length>0 && <div className="dash-recent-today">{allDoneToday.length} today</div>}
                        </div>
                      </div>
                      <div className="dash-recent-list">
                        {allDoneRecent.slice(0,5).map(t=>{
                          const b=BRANDS.find(x=>x.id===t.brand);
                          return (
                            <div key={t.id} className="dash-recent-row">
                              <span className="dash-recent-check">✓</span>
                              <span className="dash-recent-title">{t.title}</span>
                              {b && <span className="task-brand-chip" style={{background:b.color+"15",color:b.color,fontSize:10.5}}>{b.name}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Brand activity pulse */}
                {dashBrandFilter==="all" && brandActivity.some(b=>b.total>0) && (
                  <div className="dash-empty-block dash-brand-pulse">
                    <div className="dash-empty-block-head">Brand pulse — last 7 days</div>
                    <div className="dash-pulse-grid">
                      {brandActivity.filter(b=>b.total>0).map(({brand:b,recent,pending})=>(
                        <div key={b.id} className="dash-pulse-row" onClick={()=>{setActiveBrand(b.id);setView("brand");}}>
                          <span className="dash-pulse-dot" style={{background:b.color}}/>
                          <span className="dash-pulse-name">{b.name}</span>
                          <div className="dash-pulse-meter">
                            {Array.from({length:Math.min(7,Math.max(1,recent))}).map((_,i)=><span key={i} style={{background:b.color}}/>)}
                          </div>
                          <span className="dash-pulse-count">{recent} {recent===1?"action":"actions"}</span>
                          {pending>0 && <span className="dash-pulse-pending">{pending} pending</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Suggestions — learns from your data */}
                {(()=>{
                  const localPatterns = detectLocalPatterns(dashBrandFilter);
                  const aiList = aiSuggestions||[];
                  // Filter AI suggestions by brand if a brand is selected  
                  const scopedAI = dashBrandFilter==="all" ? aiList : aiList.filter(s=>s.brand===dashBrandFilter);
                  const allSuggestions = [...localPatterns, ...scopedAI.filter(a=>!localPatterns.some(l=>l.title.toLowerCase()===a.title?.toLowerCase()))].slice(0,6);
                  const hasAnyHistory = Object.values(data.tasks).flat().filter(t=>t.done).length > 0;
                  
                  return (
                    <div className="dash-empty-block dash-ai-block">
                      <div className="dash-ai-block-head">
                        <div>
                          <div className="dash-ai-title">
                            <span className="dash-ai-spark">✦</span>
                            {hasAnyHistory ? "Smart suggestions" : "Get started"}
                          </div>
                          <div className="dash-ai-sub">
                            {hasAnyHistory 
                              ? `Based on ${dashBrandFilter==="all"?"your":BRANDS.find(b=>b.id===dashBrandFilter)?.name+"'s"} patterns`
                              : "I'll learn from every task you add"}
                          </div>
                        </div>
                        <button 
                          className="dash-ai-refresh" 
                          onClick={()=>generateAISuggestions(dashBrandFilter)}
                          disabled={aiSuggestionsLoading}>
                          {aiSuggestionsLoading?"Thinking…":hasAnyHistory?"✦ Refresh with AI":"✦ Ask AI"}
                        </button>
                      </div>
                      
                      {allSuggestions.length>0 ? (
                        <div className="dash-ai-list">
                          {allSuggestions.map((s,i)=>{
                            const b=BRANDS.find(x=>x.id===s.brand);
                            const tagLabel = s.source==="recurring" ? "Recurring" : s.source==="dow" ? "Weekly habit" : s.source==="dom" ? "Monthly cycle" : "AI";
                            const tagClass = s.source==="ai" ? "tag-ai" : "tag-pattern";
                            return (
                              <div key={i} className={`dash-ai-item${s.urgency==="high"?" is-urgent":""}`}>
                                <div className="dash-ai-item-main" onClick={()=>{
                                  addTask({
                                    title: s.title,
                                    brand: s.brand,
                                    tab: s.tab||"Miscellaneous",
                                    priority: s.priority||"medium"
                                  });
                                  setAiSuggestions(prev=>prev.filter((_,idx)=>idx!==i));
                                }}>
                                  <div className="dash-ai-item-title">{s.title}</div>
                                  <div className="dash-ai-item-meta">
                                    {b && <span className="task-brand-chip" style={{background:b.color+"15",color:b.color}}>{b.name}</span>}
                                    <span className="task-tab-chip">{s.tab}</span>
                                    {s.priority==="urgent"&&<span className="dash-ai-pri-urgent">Urgent</span>}
                                    {s.priority==="high"&&<span className="dash-ai-pri-high">High</span>}
                                    <span className={`dash-ai-tag ${tagClass}`}>{tagLabel}</span>
                                  </div>
                                  <div className="dash-ai-reason">{s.reason}</div>
                                </div>
                                <button className="dash-ai-add" onClick={(e)=>{
                                  e.stopPropagation();
                                  addTask({
                                    title: s.title,
                                    brand: s.brand,
                                    tab: s.tab||"Miscellaneous",
                                    priority: s.priority||"medium"
                                  });
                                  setAiSuggestions(prev=>prev.filter((_,idx)=>idx!==i));
                                }}>+</button>
                              </div>
                            );
                          })}
                        </div>
                      ) : aiSuggestionsLoading ? (
                        <div className="dash-ai-loading">
                          <span className="dash-ai-loading-dots"><span/><span/><span/></span>
                          Analysing your patterns…
                        </div>
                      ) : !hasAnyHistory ? (
                        <div className="dash-ai-zerodata">
                          <p>I haven't seen you work yet. Add a few tasks — anything — and I'll start spotting patterns: what brand you work on most, what day you do compliance, when your reporting cycle hits. Within a week, I'll be suggesting work before you have to think about it.</p>
                          <div className="dash-ai-quick-add">
                            <button onClick={()=>addTask({title:"Weekly compliance check",brand:"goldbet",tab:"Compliance",priority:"medium",due:todayStr()})}>+ Compliance check</button>
                            <button onClick={()=>addTask({title:"Submit monthly GRV report",brand:"goldbet",tab:"Reporting",priority:"medium"})}>+ GRV report</button>
                            <button onClick={()=>setView("pa")}>Talk to PA →</button>
                          </div>
                        </div>
                      ) : (
                        <div className="dash-ai-empty">
                          Not enough recurring patterns yet. Tap <strong>✦ Refresh with AI</strong> to generate smart suggestions from your history.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            );
          }
          return (
            <div>
              {sections.map(sec=>(
                <div key={sec.key} className="dash-section-block">
                  <div className={`dash-section-head ${sec.cls}`}>
                    <span>{sec.label}</span>
                    <span className="dash-section-count">{sec.items.length}</span>
                  </div>
                  <div className="dash-list dash-list-section">
                    {sec.items.slice(0,30).map(renderRow)}
                    {sec.items.length>30 && (
                      <div className="dash-list-more">+ {sec.items.length-30} more</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* DONE TODAY FOOTER */}
        {(()=>{
          const doneToday = allTasksFlat.filter(t=>t.done&&t.doneAt?.startsWith(today));
          if(doneToday.length===0) return null;
          return (
            <details className="dash-done-today">
              <summary>
                <span className="dash-done-icon">✓</span>
                <span>{doneToday.length} completed today</span>
                <span className="dash-done-expand">view</span>
              </summary>
              <div className="dash-done-list">
                {doneToday.slice(0,20).map(t=>{
                  const brand=BRANDS.find(b=>b.id===t.brand);
                  return (
                    <div key={t.id} className="dash-done-row">
                      <span className="dash-done-check">✓</span>
                      <span className="dash-done-title">{t.title}</span>
                      {brand && <span className="task-brand-chip" style={{background:brand.color+"15",color:brand.color,fontSize:10}}>{brand.name}</span>}
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })()}

        {/* Expandable extras */}
        <details className="dash-extras">
          <summary>Insights, alerts &amp; analytics</summary>
          <div className="dash-extras-content">

            {/* Brand silence alerts */}
            {(()=>{
              const sevenDaysAgo=new Date(Date.now()-7*86400000).toISOString().split("T")[0];
              const silent=CORE_BRANDS().filter(b=>{
                const bTasks=Object.entries(data.tasks).filter(([k])=>k.startsWith(b.id)).flatMap(([,v])=>v);
                if(bTasks.length===0) return false;
                return !bTasks.some(t=>(t.createdAt||"")>=sevenDaysAgo||(t.doneAt||"")>=sevenDaysAgo);
              });
              return silent.length>0 ? (
                <div className="dash-section">
                  <div className="dash-section-label">Brands gone quiet</div>
                  <div className="dash-section-body">
                    {silent.map(b=>(
                      <button key={b.id} className="dash-silent-row" onClick={()=>{setActiveBrand(b.id);setView("brand");}}>
                        <span className="dash-silent-dot" style={{background:b.color}}/>
                        <span>{b.name}</span>
                        <span className="dash-silent-meta">No activity in 7+ days →</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Score */}
            <div className="dash-section">
              <div className="dash-section-label">Productivity score</div>
              <div className="dash-score-row">
                <div className="dash-score-num">{score}</div>
                <div className="dash-score-bar"><div className="dash-score-bar-fill" style={{width:`${score}%`,background:score>=70?"#059669":score>=50?"#D97706":"#DC2626"}}/></div>
                <button className="dash-score-toggle" onClick={()=>setShowScoreBreakdown(p=>!p)}>{showScoreBreakdown?"Hide":"Why?"}</button>
              </div>
              {showScoreBreakdown && (()=>{
                const s=getStats(); const bs2=getBrandStats();
                const items=[
                  {label:"Task completion",pts:Math.round(s.rate*0.4),max:40},
                  {label:"Done today",pts:s.todayTotal>0?Math.round((s.todayDone/s.todayTotal)*25):10,max:25},
                  {label:"Low overdue",pts:Math.max(0,20-(s.overdue*5)),max:20},
                  {label:"Active brands",pts:Math.round((bs2.filter(b=>b.tasks>0).length/BRANDS.length)*15),max:15},
                ];
                return (
                  <div className="dash-score-breakdown">
                    {items.map(it=>(
                      <div key={it.label} className="dash-score-item">
                        <span>{it.label}</span>
                        <span className="dash-score-pts">{it.pts}/{it.max}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* AI Briefing */}
            {insights.briefing && (
              <div className="dash-section">
                <div className="dash-section-label">Morning briefing</div>
                <div className="dash-briefing-text">{insights.briefing}</div>
              </div>
            )}
            {!insights.briefing && (
              <div className="dash-section">
                <button className="dash-ai-btn" onClick={()=>fetchInsight("briefing","Give me a sharp executive morning briefing. Reference specific brand names and task counts. 2 sentences max.")}>
                  Generate AI briefing
                </button>
              </div>
            )}

          </div>
        </details>

      </div>
    );
  };

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
              {t.due&&(()=>{const db=dueBadge(t.due);return db?<span style={{fontFamily:"Martian Mono,monospace",fontSize:9,fontWeight:600,color:db.color,background:db.bg,padding:"2px 7px",borderRadius:99}}>{db.label}</span>:<span style={{fontFamily:"Martian Mono,monospace",fontSize:9.5,color:"var(--ink-4)"}}>Due {fmtDate(t.due)}</span>;})()}
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
          <div style={{display:"flex",gap:3,alignItems:"flex-start"}}>
            {!t.done&&(
              <div style={{display:"flex",gap:2,marginRight:4}} title="Snooze">
                <button className="btn btn-ghost btn-xs" onClick={()=>snoozeTask(key,t.id,1)} style={{fontSize:10,padding:"3px 7px",minWidth:0}}>+1d</button>
                <button className="btn btn-ghost btn-xs" onClick={()=>snoozeTask(key,t.id,3)} style={{fontSize:10,padding:"3px 7px",minWidth:0}}>+3d</button>
                <button className="btn btn-ghost btn-xs" onClick={()=>snoozeTask(key,t.id,7)} style={{fontSize:10,padding:"3px 7px",minWidth:0}}>+1w</button>
              </div>
            )}
            {!t.done&&(timerRunning
              ?<button className="btn btn-amber btn-xs" onClick={()=>stopTimer(t.id,t.title,activeBrand,brandTab,key)}>Stop</button>
              :<button className="btn btn-ghost btn-xs" onClick={()=>startTimer(t.id,t.title,activeBrand,brandTab)} style={{fontSize:11}}>◷</button>
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
                        {t.due&&(()=>{const db=dueBadge(t.due);return db&&!t.done?<span style={{fontFamily:"Martian Mono,monospace",fontSize:8.5,fontWeight:600,color:db.color,background:db.bg,padding:"1px 6px",borderRadius:99}}>{db.label}</span>:<span style={{fontFamily:"Martian Mono,monospace",fontSize:8.5,color:"var(--ink-4)"}}>📅 {fmtDate(t.due)}</span>;})()}
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
  // ══════════════════════════════════════════════════════════
  //  BRAIN DUMP
  // ══════════════════════════════════════════════════════════
  const renderBrainDump=()=><BrainDumpView addTask={addTask} addNote={addNote} addReminder={addReminder} showToast={showToast} apiKey={API_KEY} activeBrand={activeBrand} brandTab={brandTab}/>;

  const renderJournal=()=><JournalView data={data} saveJournalEntry={saveJournalEntry} showToast={showToast}/>;

  const renderGoals=()=><GoalsView data={data} addGoal={addGoal} updateGoalProgress={updateGoalProgress} deleteGoal={deleteGoal} showToast={showToast} fetchInsight={fetchInsight} insightLoading={insightLoading} insights={insights}/>;

  const renderDecisions=()=><DecisionsView data={data} addDecision={addDecision} deleteDecision={deleteDecision} showToast={showToast} fetchInsight={fetchInsight} insightLoading={insightLoading} insights={insights}/>;


  // ══════════════════════════════════════════════════════════
  //  PA — PERSONAL ASSISTANT
  // ══════════════════════════════════════════════════════════
  const sendToPA = useCallback(async (userMsg) => {
    if (!userMsg.trim()) return;
    const now = nowISO();
    const userBubble = { role: "user", content: userMsg, ts: now };
    const newHistory = [...paChat, userBubble];
    setPaChat(newHistory);
    savePAChat(newHistory);
    setPaLoading(true);

    // Build rich context for the AI
    const allTasks = Object.values(data.tasks).flat();
    const brandSummary = BRANDS.map(b => {
      const tasks = Object.entries(data.tasks)
        .filter(([k]) => k.startsWith(b.id))
        .flatMap(([,v]) => v);
      const pending = tasks.filter(t => !t.done).length;
      const overdue = tasks.filter(t => !t.done && t.due && t.due < todayStr()).length;
      return `${b.name}(${b.id}): ${pending} pending, ${overdue} overdue`;
    }).join(" | ");

    const recentGoals = (data.goals || []).filter(g => !g.achieved).slice(0, 5).map(g => g.title).join(", ");
    const pendingTasks = allTasks.filter(t => !t.done).slice(0, 10).map(t => `"${t.title}"[${t.brand||"?"}]`).join(", ");
    const conversationHistory = newHistory.slice(-10).map(m => ({ role: m.role, content: m.content }));

    const systemPrompt = `You are PRODASH PA — a hyper-intelligent personal assistant for someone managing 6 betting/gaming brands: Goldbet, Ultrabet, BoostBet, AllBets, BetGold, TechDev.

CURRENT STATE:
- Brands: ${brandSummary}
- Active goals: ${recentGoals || "none"}
- Recent pending tasks: ${pendingTasks || "none"}
- Today: ${todayStr()}
- PRODASH score: ${score}/100

BRANDS (for allocation):
- goldbet = Goldbet 🥇 (amber)
- ultrabet = Ultrabet ⚡ (purple)  
- boostbet = BoostBet 🚀 (red)
- allbets = AllBets 🎯 (green)
- betgold = BetGold 💰 (orange)
- techdev = TechDev 💻 (blue)
- misc = Miscellaneous 📋 (grey) ← DEFAULT when no brand mentioned

TABS per brand: Reporting, Compliance, Accounting, Miscellaneous

YOUR JOB:
1. Understand what the user wants — they may tell you tasks, instructions, questions, or anything
2. ALWAYS create tasks in the tasks array — NEVER use notes as a substitute for tasks
3. Always respond conversationally FIRST, then include a JSON actions block
4. Be their trusted chief of staff — proactive, direct, smart

CRITICAL TASK RULES — READ CAREFULLY:
- "X done" or "X is done" or "X completed" → CREATE a task with done:true (already completed). NEVER put this in notes.
- "do X" or "add X" or "need to X" → CREATE a pending task (done:false)
- "GRV reporting done" → task: title="GRV Reporting", brand=goldbet, tab=Reporting, done=true
- "payslips done for Goldbet" → task: title="Payslips", brand=goldbet, tab=Accounting, done=true
- ONLY use notes array for things that are genuinely just notes/memos with no action attached
- ALWAYS prefer creating tasks over notes
- If user says something is done → create the task AND set done:true so it shows as completed

RESPONSE FORMAT — always end with this exact block:
<actions>
{
  "tasks": [
    {"title": "task title", "brand": "brandid", "tab": "Reporting|Compliance|Accounting|Miscellaneous", "priority": "urgent|high|medium|low", "due": "YYYY-MM-DD or empty", "note": "optional note", "estimatedMins": 30, "done": false}
  ],
  "reminders": [
    {"title": "reminder title", "date": "YYYY-MM-DD", "time": "HH:MM", "brand": "brandid or empty", "note": ""}
  ],
  "notes": [
    {"title": "note title", "content": "full note content", "color": "#FFF9C4"}
  ],
  "goals": [
    {"title": "goal title", "description": "details", "brand": "brandid", "targetDate": "YYYY-MM-DD"}
  ],
  "decisions": [
    {"title": "decision title", "context": "why", "decision": "what was decided", "reasoning": "rationale", "brand": "brandid"}
  ],
  "reply": "your conversational reply to the user"
}
</actions>

SMART ALLOCATION RULES:
- "GRV", "reporting", "report", "numbers", "KPIs", "data", "MGA", "returns" → tab: Reporting
- "compliance", "licence", "regulatory", "AML", "KYC", "audit" → tab: Compliance
- "invoice", "payment", "salary", "payslip", "payroll", "accounting", "P&L" → tab: Accounting
- If unclear → tab: Miscellaneous

**TAB SHORTCUT LETTERS — recognise these:**
The user often uses single letters as shortcuts for categories. When you see a standalone uppercase letter R, C, A, or M (often after a brand name or task description), interpret it as the tab:
- "R" or " R " or "/R" → tab: Reporting
- "C" or " C " or "/C" → tab: Compliance
- "A" or " A " or "/A" → tab: Accounting
- "M" or " M " or "/M" → tab: Miscellaneous

Examples:
- "GRNT lodgement for all brands R" → 5 tasks, each tab: Reporting
- "Quarterly audit Goldbet C urgent" → 1 task: Goldbet, Compliance, urgent
- "Pay invoices for ultrabet A" → 1 task: Ultrabet, Accounting
- "Buy office supplies M" → 1 task: misc, Miscellaneous
- "Submit MGA returns for goldbet ultrabet R" → 2 tasks, both Reporting

CRITICAL: only treat as a tab shortcut if it's a standalone letter clearly separated by spaces or punctuation. Don't treat the "A" in "AML" or the "C" in "Q4" as a shortcut — only standalone single letters.

- Match brand by name: Goldbet=goldbet, Ultrabet=ultrabet, BoostBet=boostbet, AllBets=allbets, BetGold=betgold, TechDev=techdev, Misc/Personal/Other=misc
- If brand unknown → brand: "misc", tab: "Miscellaneous"
- **"ALL BRANDS" RULE — IMPORTANT:** When the user says "all brands", "every brand", "across all brands", "each brand", etc., this means the FIVE wagering brands ONLY: Goldbet, Ultrabet, BoostBet, AllBets, BetGold. **DO NOT include TechDev or Miscellaneous** when creating "all brands" tasks. TechDev is an internal/tech operation handled separately. So "do payslips for all brands" creates 5 tasks (one per wagering brand), NOT 7.
- Set priority based on urgency words: "urgent/asap/now" → urgent, "important" → high, default → medium
- ALWAYS be helpful — answer questions AND create tasks`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          system: systemPrompt,
          messages: conversationHistory
        })
      });
      const json = await res.json();
      const rawText = json.content?.filter(c => c.type === "text").map(c => c.text).join("") || "";

      // Parse the actions block - robust multi-attempt parsing
      let actions = { tasks: [], reminders: [], notes: [], goals: [], decisions: [], reply: "" };
      let replyText = rawText;

      // Try <actions> block first
      const actionsMatch = rawText.match(/<actions>([\s\S]*?)<\/actions>/);
      if (actionsMatch) {
        replyText = rawText.replace(/<actions>[\s\S]*?<\/actions>/, "").trim();
        try {
          const parsed = JSON.parse(actionsMatch[1].trim());
          actions = { tasks: parsed.tasks||[], reminders: parsed.reminders||[], notes: parsed.notes||[], goals: parsed.goals||[], decisions: parsed.decisions||[], reply: parsed.reply||replyText };
          replyText = actions.reply || replyText;
        } catch(e) {
          // Try to extract JSON object directly
          try {
            const jsonMatch = actionsMatch[1].match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              actions = { tasks: parsed.tasks||[], reminders: parsed.reminders||[], notes: parsed.notes||[], goals: parsed.goals||[], decisions: parsed.decisions||[], reply: parsed.reply||replyText };
              replyText = actions.reply || replyText;
            }
          } catch(e2) { /* keep empty actions */ }
        }
      }
      actions.reply = replyText || rawText;

      // Execute all actions and track where each task went
      let taskCount = 0, reminderCount = 0, noteCount = 0, goalCount = 0, decisionCount = 0;
      const taskLocations = [];

      (actions.tasks || []).forEach(t => {
        if (t.title) {
          const brand = t.brand || "goldbet";
          const tab = t.tab || "Miscellaneous";
          const isDone = t.done === true || t.done === "true";
          // Add task then immediately mark done if needed
          const taskForm = { title: t.title, brand, tab, priority: t.priority || "medium", due: t.due || "", note: t.note || "", estimatedMins: t.estimatedMins || null };
          if (isDone) {
            // Insert directly as done task
            const key = `${brand}_${tab}`;
            const task = { id: uid(), title: t.title, priority: t.priority || "medium", due: t.due || "", category: t.tab || "", note: t.note || "", estimatedMins: t.estimatedMins || null, timeSpent: 0, done: true, doneAt: nowISO(), createdAt: nowISO(), recurrence: "", kanbanStatus: "done", attachments: [] };
            setData(p => ({ ...p, tasks: { ...p.tasks, [key]: [...(p.tasks[key] || []), task] } }));
          } else {
            addTask(taskForm);
          }
          taskCount++;
          const b = BRANDS.find(x => x.id === brand);
          taskLocations.push(`${b?.emoji||""}${b?.name||brand} › ${tab}${isDone ? " ✓" : ""}`);
        }
      });
      (actions.reminders || []).forEach(r => {
        if (r.title && r.date) { addReminder({ title: r.title, date: r.date, time: r.time || "09:00", brand: r.brand || "", note: r.note || "" }); reminderCount++; }
      });
      (actions.notes || []).forEach(n => {
        if (n.content) { addNote({ title: n.title || "", content: n.content, color: n.color || "#FFF9C4" }); noteCount++; }
      });
      (actions.goals || []).forEach(g => {
        if (g.title) { addGoal({ title: g.title, description: g.description || "", brand: g.brand || "", targetDate: g.targetDate || "" }); goalCount++; }
      });
      (actions.decisions || []).forEach(d => {
        if (d.title) { addDecision({ title: d.title, context: d.context || "", decision: d.decision || "", reasoning: d.reasoning || "", brand: d.brand || "" }); decisionCount++; }
      });

      // Build action summary with exact locations
      const actionParts = [];
      if (taskCount) actionParts.push(`✅ ${taskCount} task${taskCount > 1 ? "s" : ""} added → ${taskLocations.join(", ")}`);
      if (reminderCount) actionParts.push(`🔔 ${reminderCount} reminder${reminderCount > 1 ? "s" : ""} set`);
      if (noteCount) actionParts.push(`📌 ${noteCount} note${noteCount > 1 ? "s" : ""} pinned`);
      if (goalCount) actionParts.push(`🎯 ${goalCount} goal${goalCount > 1 ? "s" : ""} created`);
      if (decisionCount) actionParts.push(`⚖ ${decisionCount} decision${decisionCount > 1 ? "s" : ""} logged`);

      const aiBubble = {
        role: "assistant",
        content: actions.reply,
        ts: nowISO(),
        actions: actions,
        actionSummary: actionParts.join(" · ") || null
      };
      const finalHistory = [...newHistory, aiBubble];
      setPaChat(finalHistory);
      savePAChat(finalHistory);
    } catch(e) {
      const errBubble = { role: "assistant", content: "Sorry, I couldn't connect. Please try again.", ts: nowISO() };
      const finalHistory = [...newHistory, errBubble];
      setPaChat(finalHistory);
      savePAChat(finalHistory);
    }
    setPaLoading(false);
  }, [paChat, data, score, addTask, addNote, addReminder, addGoal, addDecision, API_KEY, showToast]);

  const renderPA = () => <PAView paChat={paChat} paLoading={paLoading} sendToPA={sendToPA} setPaChat={setPaChat} bStats={bStats} stats={stats} score={score} data={data} setView={setView} setActiveBrand={setActiveBrand} setBrandTab={setBrandTab} />;

  const renderWeekPlan=()=><WeekPlanView data={data} stats={stats} bStats={bStats} acctData={acctData} setCommitment={setCommitment} weeklyReviews={weeklyReviews} setWeeklyReviews={setWeeklyReviews} showToast={showToast} setActiveBrand={setActiveBrand} setBrandTab={setBrandTab} setView={setView}/>;

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
              <button className="btn btn-amber btn-sm" onClick={requestNotifPermission}>🔔 Enable Notifications (get alerts when site is closed)</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  //  MAIN RETURN
  // ══════════════════════════════════════════════════════════
  const pageTitle=view==="brand"&&currentBrand?currentBrand.name.toUpperCase():{dashboard:"DASHBOARD",warroom:"WAR ROOM",timelog:"TIME LOG",analytics:"ANALYTICS",calendar:"CALENDAR",pinboard:"PIN BOARD",ai:"AI ASSISTANT",journal:"WORK JOURNAL",goals:"GOALS",decisions:"DECISION LOG",braindump:"BRAIN DUMP",weekplan:"WEEKLY PLAN"}[view]||"";

  return (
    <div className="app">
      {showConfetti&&<Confetti/>}
      {/* Mood check-in */}
      
      {/* Narrative modal */}
      {showNarrative&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowNarrative(false)}>
          <div className="modal-box" style={{maxWidth:500}}>
            <div className="modal-title"><span>📖 YOUR WEEK AS A STORY</span><button className="modal-close" onClick={()=>setShowNarrative(false)}>✕</button></div>
            {narrativeLoading&&<div style={{display:"flex",gap:10,alignItems:"center",padding:"20px 0",color:"var(--ink-3)",fontSize:13}}><span className="typing-dots"><span/><span/><span/></span> Writing your narrative...</div>}
            {narrativeText&&!narrativeLoading&&(
              <div>
                <div style={{fontSize:16,lineHeight:1.9,color:"var(--ink-2)",fontStyle:"italic",borderLeft:"3px solid var(--indigo)",paddingLeft:16}}>{narrativeText}</div>
                <div style={{marginTop:20,display:"flex",gap:8}}>
                  <button className="btn btn-primary btn-sm" onClick={generateNarrative}>↻ Regenerate</button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>{saveJournalEntry(todayStr(),{narrative:narrativeText});showToast("Saved to journal");}}>💾 Save to Journal</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Productivity Profile modal */}
      {showProfile&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowProfile(false)}>
          <div className="modal-box" style={{maxWidth:560}}>
            <div className="modal-title"><span>🧬 YOUR PRODUCTIVITY PROFILE</span><button className="modal-close" onClick={()=>setShowProfile(false)}>✕</button></div>
            {profileLoading&&<div style={{display:"flex",gap:10,alignItems:"center",padding:"20px 0",color:"var(--ink-3)",fontSize:13}}><span className="typing-dots"><span/><span/><span/></span> Analysing your patterns...</div>}
            {profileText&&!profileLoading&&(
              <div>
                <div style={{fontSize:13.5,lineHeight:1.9,color:"var(--ink-2)",whiteSpace:"pre-line"}}>{profileText}</div>
                <div style={{marginTop:20,display:"flex",gap:8}}>
                  <button className="btn btn-primary btn-sm" onClick={generateProfile}>↻ Regenerate</button>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setShowProfile(false)}>Close</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Morning prompt */}
      {showMorningPrompt&&missedTasks.length>0&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div style={{background:"var(--white)",borderRadius:16,padding:"28px 32px",maxWidth:480,width:"100%",boxShadow:"0 20px 60px rgba(0,0,0,.3)"}}>
            <div style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"#D97706",letterSpacing:3,marginBottom:12,textTransform:"uppercase"}}>☀ GOOD MORNING</div>
            <div style={{fontSize:18,fontWeight:700,color:"var(--ink)",marginBottom:8,lineHeight:1.3}}>Yesterday you meant to...</div>
            <div style={{fontSize:13,color:"var(--ink-3)",marginBottom:18}}>{missedTasks.length} task{missedTasks.length>1?"s were":"was"} due yesterday and not completed.</div>
            {missedTasks.slice(0,4).map(t=>(
              <div key={t.id} style={{display:"flex",gap:10,padding:"9px 12px",background:"var(--surface)",borderRadius:8,marginBottom:7,alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:500,color:"var(--ink)",flex:1}}>{t.title}</span>
                <span className={`badge ${t.priority==="urgent"?"badge-violet":t.priority==="high"?"badge-red":"badge-amber"}`}>{t.priority}</span>
              </div>
            ))}
            <div style={{display:"flex",gap:10,marginTop:18}}>
              <button className="btn btn-primary flex1" onClick={()=>{setShowMorningPrompt(false);setView("warroom");}}>Deal with them now ⚔</button>
              <button className="btn btn-ghost" onClick={()=>setShowMorningPrompt(false)}>Dismiss</button>
            </div>
          </div>
        </div>
      )}
      {/* EOD Summary */}
      {showEOD&&!eodDismissed&&(
        <div style={{position:"fixed",bottom:24,right:24,background:"linear-gradient(135deg,#059669,#047857)",borderRadius:14,padding:"16px 20px",maxWidth:320,zIndex:200,boxShadow:"0 8px 32px rgba(5,150,105,.4)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
            <div style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"rgba(255,255,255,.6)",letterSpacing:2,textTransform:"uppercase"}}>END OF DAY</div>
            <button onClick={()=>setEodDismissed(true)} style={{background:"none",border:"none",color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:14,lineHeight:1}}>✕</button>
          </div>
          <div style={{fontSize:20,fontWeight:700,color:"#fff",marginBottom:4}}>Today: {stats.todayDone} tasks done</div>
          <div style={{fontSize:13,color:"rgba(255,255,255,.8)",marginBottom:6}}>Across {bStats.filter(b=>b.done>0).length} brands · {fmtDur(stats.totalTimeSpent)} tracked</div>
          {false&&streak.current>0&&<div style={{fontSize:13,color:"rgba(255,255,255,.9)",fontWeight:600}}>🔥 {streak.current} day streak — keep it going!</div>}
          <button onClick={()=>{setEodDismissed(true);setView("journal");}} style={{marginTop:12,width:"100%",padding:"8px",background:"rgba(255,255,255,.2)",border:"1px solid rgba(255,255,255,.3)",borderRadius:8,color:"#fff",cursor:"pointer",fontSize:13,fontWeight:500}}>📖 Write today's journal entry →</button>
        </div>
      )}
      {/* PRODASH RADIO — ambient focus mode */}
      {radioMode&&(
        <div style={{position:"fixed",inset:0,background:"#05060F",zIndex:400,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
          <div style={{position:"absolute",top:20,right:20}}>
            <button onClick={()=>setRadioMode(false)} style={{background:"rgba(255,255,255,.07)",border:"1px solid rgba(255,255,255,.1)",borderRadius:8,color:"rgba(255,255,255,.4)",fontSize:12,padding:"6px 14px",cursor:"pointer",fontFamily:"Martian Mono,monospace"}}>EXIT RADIO</button>
          </div>
          {/* Ambient animated background */}
          <div style={{position:"absolute",inset:0,overflow:"hidden",pointerEvents:"none"}}>
            {[...Array(6)].map((_,i)=>(
              <div key={i} style={{position:"absolute",borderRadius:"50%",
                width:300+i*120,height:300+i*120,
                left:`${10+i*12}%`,top:`${5+i*10}%`,
                background:`rgba(${i%2?37:79},${i%2?99:70},${i%2?235:229},.03)`,
                animation:`ambient-pulse ${4+i}s ${i*.5}s ease-in-out infinite alternate`}}/>
            ))}
          </div>
          <div style={{fontFamily:"Martian Mono,monospace",fontSize:8,color:"rgba(255,255,255,.2)",letterSpacing:6,marginBottom:48,textTransform:"uppercase",position:"relative"}}>PRODASH RADIO · FOCUS</div>
          {missionTask&&!missionDone?(
            <div style={{textAlign:"center",maxWidth:560,position:"relative"}}>
              <div style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"rgba(37,99,235,.6)",letterSpacing:3,marginBottom:16,textTransform:"uppercase"}}>TODAY'S MISSION</div>
              <div style={{fontSize:32,fontWeight:700,color:"#fff",lineHeight:1.3,marginBottom:24,letterSpacing:-.5}}>{missionTask.title}</div>
              <button onClick={completeMission} style={{padding:"12px 36px",background:"rgba(37,99,235,.2)",border:"1px solid rgba(37,99,235,.4)",borderRadius:10,color:"rgba(255,255,255,.8)",fontSize:14,cursor:"pointer",fontFamily:"Martian Mono,monospace",letterSpacing:1}}>MARK COMPLETE</button>
            </div>
          ):(
            <div style={{textAlign:"center",position:"relative"}}>
              {missionDone&&<div style={{fontSize:48,marginBottom:16}}>🏆</div>}
              <div style={{fontSize:28,fontWeight:700,color:"#fff",marginBottom:8}}>{missionDone?"Mission Complete":"Ready to Focus"}</div>
              <div style={{fontFamily:"Martian Mono,monospace",fontSize:11,color:"rgba(255,255,255,.3)"}}>{new Date().toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</div>
            </div>
          )}
          <div style={{position:"absolute",bottom:32,display:"flex",gap:24,alignItems:"center"}}>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"Martian Mono,monospace",fontSize:22,fontWeight:700,color:"#fff"}}>{stats.todayDone}</div>
              <div style={{fontFamily:"Martian Mono,monospace",fontSize:8,color:"rgba(255,255,255,.25)",letterSpacing:2,marginTop:4,textTransform:"uppercase"}}>done today</div>
            </div>
            <div style={{width:1,height:32,background:"rgba(255,255,255,.1)"}}/>
            <div style={{textAlign:"center"}}>
              <div style={{fontFamily:"Martian Mono,monospace",fontSize:22,fontWeight:700,color:stats.overdue>0?"#DC2626":"#059669"}}>{stats.overdue}</div>
              <div style={{fontFamily:"Martian Mono,monospace",fontSize:8,color:"rgba(255,255,255,.25)",letterSpacing:2,marginTop:4,textTransform:"uppercase"}}>overdue</div>
            </div>
            <div style={{width:1,height:32,background:"rgba(255,255,255,.1)"}}/>
            {false&&<div style={{textAlign:"center"}}>
              <div style={{fontFamily:"Martian Mono,monospace",fontSize:22,fontWeight:700,color:"#F59E0B"}}>{streak.current||0}</div>
              <div style={{fontFamily:"Martian Mono,monospace",fontSize:8,color:"rgba(255,255,255,.25)",letterSpacing:2,marginTop:4,textTransform:"uppercase"}}>day streak 🔥</div>
            </div>}
          </div>
        </div>
      )}
      {/* Voice capture overlay */}
      {voiceActive&&(
        <div style={{position:"fixed",bottom:80,left:"50%",transform:"translateX(-50%)",background:"rgba(5,6,15,.95)",border:"1px solid rgba(37,99,235,.4)",borderRadius:16,padding:"20px 32px",zIndex:300,textAlign:"center",minWidth:320,boxShadow:"0 8px 40px rgba(37,99,235,.3)"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,justifyContent:"center",marginBottom:10}}>
            <div style={{width:10,height:10,borderRadius:"50%",background:"#DC2626",animation:"live-pulse .8s ease-in-out infinite"}}/>
            <span style={{fontFamily:"Martian Mono,monospace",fontSize:10,color:"rgba(255,255,255,.5)",letterSpacing:2,textTransform:"uppercase"}}>LISTENING</span>
          </div>
          <div style={{fontSize:14,color:"#fff",minHeight:20,lineHeight:1.5}}>{voiceText||"Speak now..."}</div>
          <button onClick={stopVoice} style={{marginTop:12,padding:"6px 20px",background:"#DC2626",border:"none",borderRadius:8,color:"#fff",fontSize:12,cursor:"pointer"}}>Stop</button>
        </div>
      )}
      {/* What-If Simulator Modal */}
      {showWhatIf&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowWhatIf(false)}>
          <div className="modal-box" style={{maxWidth:560}}>
            <div className="modal-title"><span>🔮 WHAT-IF SIMULATOR</span><button className="modal-close" onClick={()=>setShowWhatIf(false)}>✕</button></div>
            <div style={{fontSize:12.5,color:"var(--ink-3)",marginBottom:14,lineHeight:1.7}}>Describe a hypothetical scenario. AI models the impact on your brands, health grades, and risks.</div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:12}}>
              {["What if I deprioritised Ultrabet for 2 weeks?","What if I focused only on Compliance tasks this month?","What if I doubled time on Goldbet and cut AllBets?","What if I hired someone to handle Accounting tasks?"].map(s=>(
                <span key={s} onClick={()=>setWhatIfInput(s)} style={{fontSize:11,padding:"4px 10px",background:"var(--surface)",borderRadius:99,cursor:"pointer",color:"var(--ink-3)",border:"1px solid var(--line)"}}>{s}</span>
              ))}
            </div>
            <textarea className="ta" style={{minHeight:80}} placeholder="What if..." value={whatIfInput} onChange={e=>setWhatIfInput(e.target.value)} autoFocus/>
            {whatIfLoading&&<div style={{display:"flex",gap:8,alignItems:"center",padding:"12px 0",color:"var(--ink-3)",fontSize:13}}><span className="typing-dots"><span/><span/><span/></span>Simulating scenario...</div>}
            {whatIfResult&&!whatIfLoading&&<div style={{background:"rgba(79,70,229,.06)",border:"1px solid rgba(79,70,229,.2)",borderRadius:10,padding:"14px 16px",marginTop:12,fontSize:13,color:"var(--ink-2)",lineHeight:1.8}}>{whatIfResult}</div>}
            <div className="row gap8" style={{marginTop:14}}>
              <button className="btn btn-primary flex1" onClick={()=>runWhatIf(whatIfInput)} disabled={whatIfLoading||!whatIfInput.trim()}>🔮 Simulate</button>
              <button className="btn btn-ghost" onClick={()=>setShowWhatIf(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {focusMode&&<FocusOverlay
        task={focusMode.task} secs={focusSecs} running={focusRunning}
        elapsed={focusStarted?Date.now()-focusStarted:0}
        onToggle={()=>setFocusRunning(r=>!r)}
        onReset={()=>{setFocusSecs(POMODORO_MINS*60);setFocusRunning(false);setFocusStarted(Date.now());}}
        onDone={(markDone)=>endFocus(markDone)}
        onExit={()=>endFocus(false)}/>}
      <div className={`mob-overlay${sidebarOpen?" open":""}`} onClick={()=>setSidebarOpen(false)}/>
      <nav className={`sidebar${sidebarOpen?" open":""}`} style={brandColor?{background:`linear-gradient(180deg, ${brandColor}0a 0%, var(--sidebar-bg) 60%)`}:{}}>
        <div className="logo-area">
          <div className="logo">
            <div className="logo-icon">⚡</div>
            <span className="logo-text">PRODASH</span>
            <span className="logo-badge">LIVE</span>
          </div>
          <div className="logo-date"><LiveClockSmall/></div>
        </div>
        <div className="nav-section">
          <div className="nav-section-label">Workspace</div>
          {NAV_PRIMARY.map(item=>(
            <div key={item.id} className={`nav-item${view===item.id&&!activeBrand?" active":""}`} onClick={()=>{setView(item.id);setActiveBrand(null);setSidebarOpen(false);}}>
              <span className="nav-icon">{item.icon}</span>{item.label}
            </div>
          ))}
        </div>
        <div className="nav-section">
          <div className="nav-section-label nav-more-toggle" onClick={()=>setShowMoreNav(p=>!p)}>
            <span>More</span>
            <span className="nav-more-arrow">{showMoreNav?"▾":"▸"}</span>
          </div>
          {showMoreNav && NAV_MORE.map(item=>(
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
                style={view==="brand"&&activeBrand===b.id?{background:b.color+"18",borderLeft:`3px solid ${b.color}`,color:b.color}:{}}
                onClick={()=>{setActiveBrand(b.id);setView("brand");setBrandTab("Reporting");setTaskFilter("all");setSearchQ("");setSidebarOpen(false);}}>
                <div className="brand-marker" style={{background:b.color}}/>
                {b.emoji} {b.name}
                {bs?.overdue>0&&<div className="nav-alert"/>}
              </div>
            );
          })}
        </div>
        <div className="sidebar-stats">
          {/* Only show stats when there's actual data */}
          {stats.total > 0 ? (
            <>
              <div className="sidebar-stats-row">
                <div><div className="ss-val">{stats.done}</div><div className="ss-lbl">Done</div></div>
                <div style={{textAlign:"right"}}><div className="ss-val" style={{color:"var(--ink-4)"}}>{stats.pending}</div><div className="ss-lbl">Left</div></div>
              </div>
              <div className="sidebar-prog"><div className="sidebar-prog-fill" style={{width:`${stats.rate}%`}}/></div>
              <div className="sidebar-rate">{stats.rate}% complete</div>
            </>
          ) : (
            <div className="sidebar-rate" style={{color:"var(--ink-4)"}}>No tasks yet</div>
          )}
          {Object.values(data.tasks).flat().filter(t=>!t.done&&taskAgeDays(t.createdAt)>14).length>0&&(
            <div style={{marginTop:8,padding:"6px 10px",background:"rgba(220,38,38,.08)",borderRadius:6,border:"1px solid rgba(220,38,38,.2)"}}>
              <span style={{fontFamily:"Martian Mono,monospace",fontSize:8.5,color:"#DC2626",fontWeight:600}}>💳 {Object.values(data.tasks).flat().filter(t=>!t.done&&taskAgeDays(t.createdAt)>14).length} TASK DEBT</span>
            </div>
          )}
          <div style={{display:"flex",gap:6,marginTop:10}}>
            <button className="btn btn-ghost btn-xs w-full" style={{fontSize:10}} onClick={exportData}>↓ Export</button>
            <label className="btn btn-ghost btn-xs w-full" style={{fontSize:10,cursor:"pointer",textAlign:"center"}}>
              ↑ Import<input type="file" accept=".json" style={{display:"none"}} onChange={e=>e.target.files[0]&&importData(e.target.files[0])}/>
            </label>
          </div>
        </div>
      </nav>

      <div className="main">
        <div className="topbar" style={brandColor?{borderBottom:`1px solid ${brandColor}30`}:{}}>
          <div className="row gap10">
            <button className="hamburger" onClick={()=>setSidebarOpen(p=>!p)}><span/><span/><span/></button>
            {view==="dashboard" ? null : <span className="page-title">{pageTitle}</span>}
            {view==="brand"&&currentBrand&&(
              <div style={{display:"flex",gap:6,marginLeft:view==="dashboard"?0:14}}>
                {BRAND_TABS.map(t=><button key={t} className={`btn btn-xs${brandTab===t?" btn-dark":" btn-ghost"}`} onClick={()=>setBrandTab(t)}>{t}</button>)}
              </div>
            )}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {stats.overdue>0 && (
              <button onClick={()=>setView("warroom")} style={{padding:"4px 12px",background:"#FEE2E2",border:"1px solid #FCA5A5",borderRadius:99,color:"#B91C1C",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                {stats.overdue} overdue
              </button>
            )}
            <button onClick={()=>setShowGlobalSearch(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 12px",background:"#F3F4F6",border:"none",borderRadius:99,color:"#6B7280",fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>
              <span style={{fontSize:13}}>⌕</span> Search
            </button>
            <div className="topbar-more-wrap">
              <button className="topbar-more-btn" onClick={()=>setShowTopbarMore(p=>!p)}>⋯</button>
              {showTopbarMore && (
                <div className="topbar-more-menu" onClick={()=>setShowTopbarMore(false)}>
                  <button onClick={()=>setShowShortcuts(true)}>⌨ Shortcuts</button>
                  <button onClick={startVoice}>🎤 Voice</button>
                  <div className="topbar-menu-divider"/>
                  <button onClick={generateNarrative}>📖 Weekly story</button>
                  <button onClick={generateProfile}>🧬 Profile</button>
                  <button onClick={()=>setRadioMode(true)}>📻 Focus mode</button>
                  <button onClick={()=>setShowWhatIf(true)}>🔮 What-If</button>
                </div>
              )}
            </div>
            <div className={`topbar-status topbar-status-${dbStatus}`} title={dbStatus==="ok"?"Synced":dbStatus==="loading"?"Syncing...":"Local only"}/>
          </div>
        </div>

        {/* Quick add bar - shown only on brand view (dashboard has its own) */}
        {view==="brand"&&(
          <div className="quick-add-bar" style={{background:"var(--ai-bg)",borderBottom:"1px solid var(--ai-border)",padding:"8px 26px",display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
            <input className="inp" style={{flex:1,maxWidth:420,padding:"6px 12px",fontSize:12.5,background:"rgba(255,255,255,.7)",border:"1px solid var(--ai-border)"}}
              placeholder={`New task${currentBrand?" for "+currentBrand.name:""}... press Enter to add`}
              onKeyDown={e=>{if(e.key==="Enter"&&e.target.value.trim()){addTask({title:e.target.value.trim(),priority:"medium",brand:activeBrand||"misc",tab:brandTab});e.target.value="";}}}/>
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
          {view==="journal"  &&renderJournal()}
          {view==="goals"    &&renderGoals()}
          {view==="decisions"&&renderDecisions()}
          {view==="pa"        &&renderPA()}
          {view==="braindump"&&renderBrainDump()}
          {view==="weekplan" &&renderWeekPlan()}
        </div>
      </div>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav className="mobile-nav">
        <button className={`mob-nav-btn${view==="dashboard"&&!activeBrand?" active":""}`} onClick={()=>{setView("dashboard");setActiveBrand(null);setSidebarOpen(false);}}>
          <span>◈</span><span>Home</span>
        </button>
        <button className={`mob-nav-btn${view==="warroom"?" active":""}`} onClick={()=>{setView("warroom");setActiveBrand(null);}}>
          <span>⚔</span><span>War Room</span>
          {stats.overdue>0&&<span style={{position:"absolute",top:6,right:8,width:8,height:8,background:"#DC2626",borderRadius:"50%"}}/>}
        </button>
        <button className="mob-nav-btn" onClick={()=>setShowTaskModal(true)} style={{position:"relative"}}>
          <span style={{fontSize:26,lineHeight:1,background:"var(--blue)",color:"#fff",borderRadius:"50%",width:40,height:40,display:"flex",alignItems:"center",justifyContent:"center",marginTop:-12,boxShadow:"0 4px 14px rgba(37,99,235,.4)"}}>+</span>
          <span>Add</span>
        </button>
        <button className={`mob-nav-btn${view==="pa"?" active":""}`} onClick={()=>{setView("pa");setActiveBrand(null);}}>
          <span>🤖</span><span>PA</span>
        </button>
        <button className="mob-nav-btn" onClick={()=>setSidebarOpen(true)}>
          <span>☰</span><span>More</span>
        </button>
      </nav>

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
      {/* Floating PA button */}
      {view!=="pa"&&<div style={{position:"fixed",bottom:28,right:24,zIndex:100}} className="float-capture">
        <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
          <button onClick={()=>{setShowBrainDump(p=>!p);}} title="Ask your PA" style={{width:46,height:46,borderRadius:99,background:"linear-gradient(135deg,#4F46E5,#7C3AED)",border:"none",color:"#fff",fontSize:22,cursor:"pointer",boxShadow:"0 4px 20px rgba(79,70,229,.5)",transition:"transform .15s",display:"flex",alignItems:"center",justifyContent:"center"}}
            onMouseEnter={e=>e.currentTarget.style.transform="scale(1.1)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>🤖</button>
          {showBrainDump&&(
            <div style={{background:"var(--white)",borderRadius:16,padding:"14px 16px",boxShadow:"var(--s3)",border:"1px solid var(--ai-border)",width:320,marginBottom:0}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:18}}>🤖</span>
                <div>
                  <div style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"var(--indigo)",letterSpacing:1.5,textTransform:"uppercase",fontWeight:600}}>PA ASSISTANT</div>
                  <div style={{fontSize:10.5,color:"var(--ink-4)"}}>Tell me what to do</div>
                </div>
                <button onClick={()=>setShowBrainDump(false)} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",fontSize:14,color:"var(--ink-4)"}}>✕</button>
              </div>
              <QuickPAInput onSend={(msg)=>{setShowBrainDump(false);setView("pa");setTimeout(()=>sendToPA(msg),100);}} onExpand={()=>{setShowBrainDump(false);setView("pa");}}/>
            </div>
          )}
        </div>
      </div>}
      <ToastContainer toasts={toasts}/>
    </div>
  );
}
