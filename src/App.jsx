import { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend
} from "recharts";

// ══════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════
const BRANDS = [
  { id:"goldbet",  name:"Goldbet",  color:"#B45309", bg:"#FFFBEB", emoji:"🥇" },
  { id:"ultrabet", name:"Ultrabet", color:"#6D28D9", bg:"#F5F3FF", emoji:"⚡" },
  { id:"boostbet", name:"BoostBet", color:"#B91C1C", bg:"#FEF2F2", emoji:"🚀" },
  { id:"allbets",  name:"AllBets",  color:"#065F46", bg:"#ECFDF5", emoji:"🎯" },
  { id:"betgold",  name:"BetGold",  color:"#C2410C", bg:"#FFF7ED", emoji:"💰" },
  { id:"techdev",  name:"TechDev",  color:"#1E40AF", bg:"#EFF6FF", emoji:"💻" },
];
const BRAND_TABS = ["Reporting","Compliance","Accounting"];
const PRIORITIES = [
  {key:"low",label:"Low",cls:"p-low",dot:"pd-low"},
  {key:"medium",label:"Medium",cls:"p-medium",dot:"pd-medium"},
  {key:"high",label:"High",cls:"p-high",dot:"pd-high"},
  {key:"urgent",label:"Urgent",cls:"p-urgent",dot:"pd-urgent"},
];
const CATEGORIES = ["Reporting","Compliance","Accounting","Payroll"];
const PIN_COLORS = ["#FFF9C4","#FFEEBA","#FFE0E0","#E0F4E0","#E0E8FF","#F3E8FF","#FFF0E0","#E0F8F8"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const STORAGE_KEY = "prodash_v4";
const NAV_ITEMS = [
  {id:"dashboard",icon:"◈",label:"Dashboard"},
  {id:"timelog",  icon:"◷",label:"Time Log"},
  {id:"analytics",icon:"◉",label:"Analytics"},
  {id:"calendar", icon:"◫",label:"Calendar"},
  {id:"pinboard", icon:"◆",label:"Pin Board"},
  {id:"ai",       icon:"◎",label:"AI Assistant"},
];
const LOG_TYPES = {
  task_added:    {color:"#2563EB",label:"Task Added"},
  task_done:     {color:"#059669",label:"Completed"},
  task_deleted:  {color:"#DC2626",label:"Deleted"},
  note_added:    {color:"#D97706",label:"Note Added"},
  note_deleted:  {color:"#9CA3AF",label:"Note Deleted"},
  reminder_set:  {color:"#7C3AED",label:"Reminder Set"},
  timer_start:   {color:"#0891B2",label:"Timer Started"},
  timer_stop:    {color:"#059669",label:"Timer Stopped"},
  session_start: {color:"#6B7280",label:"Session"},
  ai_insight:    {color:"#4F46E5",label:"AI Insight"},
};

// ══════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════
const uid = () => `${Date.now()}_${Math.random().toString(36).substr(2,7)}`;
const todayStr = () => new Date().toISOString().split("T")[0];
const nowISO = () => new Date().toISOString();
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "";
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"}) : "";
const fmtDateTime = (d) => d ? `${fmtDate(d)} ${fmtTime(d)}` : "";
const fmtDuration = (ms) => {
  if (!ms||ms<0) return "0m";
  const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000);
  return h?`${h}h ${m}m`:`${m}m`;
};

// ══════════════════════════════════════
//  SUPABASE CONFIG
// ══════════════════════════════════════
const SB_URL  = "https://qkuhrlmbkicggnkogdew.supabase.co";
const SB_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFrdWhybG1ia2ljZ2dua29nZGV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMjE5ODUsImV4cCI6MjA4ODU5Nzk4NX0.ypH5J0rLzIuedEEgTJ5F2ZL9Okl_QI2hG-CioTvybhk";
const SB_HEADERS = {"Content-Type":"application/json","apikey":SB_KEY,"Authorization":`Bearer ${SB_KEY}`};

const sbLoad = async () => {
  try {
    const res = await fetch(`${SB_URL}/rest/v1/prodash_data?id=eq.main&select=data`,{headers:SB_HEADERS});
    const rows = await res.json();
    if (rows&&rows[0]?.data) {
      const p=rows[0].data;
      return {tasks:p.tasks||{},notes:p.notes||[],reminders:p.reminders||[],uploads:p.uploads||{},timelog:p.timelog||[],aiInsights:p.aiInsights||{},meta:p.meta||{createdAt:nowISO()}};
    }
    return emptyData();
  } catch { return emptyData(); }
};

const sbSave = async (d) => {
  try {
    await fetch(`${SB_URL}/rest/v1/prodash_data`,{
      method:"POST",
      headers:{...SB_HEADERS,"Prefer":"resolution=merge-duplicates"},
      body:JSON.stringify({id:"main",data:d,updated_at:nowISO()}),
    });
  } catch(e) { console.warn("Supabase save failed:",e); }
};

const emptyData = () => ({tasks:{},notes:[],reminders:[],uploads:{},timelog:[],aiInsights:{},meta:{createdAt:nowISO()}});
const loadData  = () => {
  // fallback to localStorage while Supabase loads
  try {
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return emptyData();
    const p=JSON.parse(raw);
    return {tasks:p.tasks||{},notes:p.notes||[],reminders:p.reminders||[],uploads:p.uploads||{},timelog:p.timelog||[],aiInsights:p.aiInsights||{},meta:p.meta||{createdAt:nowISO()}};
  } catch { return emptyData(); }
};
const saveLocal = (d) => { try{localStorage.setItem(STORAGE_KEY,JSON.stringify(d));}catch{} };

// ══════════════════════════════════════
//  TOAST HOOK
// ══════════════════════════════════════
function useToast() {
  const [toasts,setToasts]=useState([]);
  const show=useCallback((msg,type="success")=>{
    const id=uid();
    setToasts(p=>[...p,{id,msg,type}]);
    setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3500);
  },[]);
  return {toasts,show};
}

// ══════════════════════════════════════
//  SCORE RING
// ══════════════════════════════════════
function ScoreRing({score,size=72,stroke=6}) {
  const r=(size-stroke*2)/2, circ=2*Math.PI*r;
  const dash=circ-(circ*score/100);
  const color=score>=80?"#059669":score>=60?"#2563EB":score>=40?"#D97706":"#DC2626";
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E4E7F0" strokeWidth={stroke}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
          style={{transition:"stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)"}}/>
      </svg>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Martian Mono,monospace",fontSize:size>60?16:12,fontWeight:600,color}}>{score}</div>
    </div>
  );
}

// ══════════════════════════════════════
//  AI INSIGHT PANEL — used in every section
// ══════════════════════════════════════
function AIPanel({insight,loading,onRefresh,label="◎ AI INSIGHT",compact=false}) {
  if (compact && !insight && !loading) return null;
  return (
    <div className="ai-panel" style={{marginBottom:compact?0:16}}>
      <div className="ai-panel-title">
        <span>{label}</span>
        {onRefresh&&<button className="ai-btn" style={{padding:"2px 10px",fontSize:10}} onClick={onRefresh} disabled={loading}>
          {loading?"...":"↻ Refresh"}
        </button>}
      </div>
      {loading
        ? <div className="ai-panel-loading"><span className="typing-dots"><span/><span/><span/></span> Analysing your data...</div>
        : insight
          ? <div className="ai-panel-text">{insight}</div>
          : <div style={{fontSize:12,color:"#9099B8"}}>Click refresh to get an AI insight for this section.</div>
      }
    </div>
  );
}

// ══════════════════════════════════════
//  TOAST CONTAINER
// ══════════════════════════════════════
function ToastContainer({toasts}) {
  if(!toasts.length) return null;
  return (
    <div className="toast-wrap">
      {toasts.map(t=>(
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type==="success"?"✓":t.type==="error"?"✕":"⚠"} {t.msg}
        </div>
      ))}
    </div>
  );
}

// ══════════════════════════════════════
//  TASK MODAL
// ══════════════════════════════════════
function TaskModal({onSave,onClose,brandId,tab,brands}) {
  const [f,setF]=useState({title:"",priority:"medium",due:"",category:"",estimatedMins:"",note:"",brand:brandId||"",tab:tab||BRAND_TABS[0]});
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

  const removeFile=(id)=>setFiles(p=>p.filter(f=>f.id!==id));

  const save=()=>{
    if(!f.title.trim()){setErr("Title is required");return;}
    onSave({...f,title:f.title.trim(),estimatedMins:f.estimatedMins?parseInt(f.estimatedMins):null,attachments:files});
    onClose();
  };

  const isImg=(type)=>type.startsWith("image/");

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

        {/* ── File / Image Upload ── */}
        <div className="form-group mb20">
          <label className="form-label">Attachments</label>
          <div
            className="drop-zone"
            style={{padding:"14px 16px",cursor:"pointer"}}
            onClick={()=>fileRef.current?.click()}
            onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor="#2563EB";}}
            onDragLeave={e=>{e.currentTarget.style.borderColor="";}}
            onDrop={e=>{e.preventDefault();e.currentTarget.style.borderColor="";handleFiles(e.dataTransfer.files);}}
          >
            <div style={{fontSize:20,marginBottom:5}}>📎</div>
            <div style={{fontSize:12.5,fontWeight:500,color:"#374151"}}>Drop files here or click to browse</div>
            <div style={{fontSize:11,color:"#9099B8",marginTop:3}}>Images, PDFs, docs — max 5MB each</div>
            <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" style={{display:"none"}} onChange={e=>handleFiles(e.target.files)}/>
          </div>

          {/* File preview grid */}
          {files.length>0&&(
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(90px,1fr))",gap:8,marginTop:10}}>
              {files.map(file=>(
                <div key={file.id} style={{position:"relative",border:"1px solid #E4E7F0",borderRadius:8,overflow:"hidden",background:"#F8F9FC",cursor:isImg(file.type)?"pointer":"default"}}
                  onClick={()=>isImg(file.type)&&setLightbox(file)}>
                  {isImg(file.type)
                    ?<img src={file.data} alt={file.name} style={{width:"100%",height:72,objectFit:"cover",display:"block"}}/>
                    :<div style={{height:72,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4}}>
                      <span style={{fontSize:24}}>{file.type.includes("pdf")?"📄":file.type.includes("sheet")||file.type.includes("excel")?"📊":"📝"}</span>
                    </div>
                  }
                  <div style={{padding:"4px 6px",fontFamily:"Martian Mono,monospace",fontSize:8.5,color:"#52576E",overflow:"hidden",whiteSpace:"nowrap",textOverflow:"ellipsis",borderTop:"1px solid #E4E7F0"}}>
                    {file.name}
                  </div>
                  <button onClick={e=>{e.stopPropagation();removeFile(file.id);}} style={{position:"absolute",top:3,right:3,background:"rgba(0,0,0,.55)",border:"none",color:"#fff",borderRadius:3,padding:"1px 5px",fontSize:9.5,cursor:"pointer",lineHeight:1.4}}>✕</button>
                  {isImg(file.type)&&<div style={{position:"absolute",bottom:22,right:3,background:"rgba(0,0,0,.45)",borderRadius:3,padding:"2px 5px",fontSize:8.5,color:"#fff"}}>🔍</div>}
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

      {/* ── Lightbox for image preview ── */}
      {lightbox&&(
        <div onClick={()=>setLightbox(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:24,cursor:"zoom-out"}}>
          <div onClick={e=>e.stopPropagation()} style={{position:"relative",maxWidth:"90vw",maxHeight:"90vh"}}>
            <img src={lightbox.data} alt={lightbox.name} style={{maxWidth:"100%",maxHeight:"85vh",borderRadius:10,boxShadow:"0 20px 60px rgba(0,0,0,.5)",display:"block"}}/>
            <div style={{textAlign:"center",marginTop:10,fontFamily:"Martian Mono,monospace",fontSize:10,color:"rgba(255,255,255,.5)"}}>{lightbox.name}</div>
            <button onClick={()=>setLightbox(null)} style={{position:"absolute",top:-12,right:-12,background:"#fff",border:"none",borderRadius:"50%",width:28,height:28,fontSize:12,cursor:"pointer",fontWeight:700,color:"#0D0F1A",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 8px rgba(0,0,0,.3)"}}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════
//  PIN MODAL
// ══════════════════════════════════════
function PinModal({onSave,onClose}) {
  const [f,setF]=useState({title:"",content:"",color:PIN_COLORS[0]});
  const [err,setErr]=useState("");
  const save=()=>{ if(!f.content.trim()){setErr("Content required");return;} onSave(f); onClose(); };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box">
        <div className="modal-title"><span>NEW NOTE</span><button className="modal-close" onClick={onClose}>✕</button></div>
        {err&&<div className="badge badge-red mb12" style={{display:"block",padding:"7px 10px",borderRadius:6}}>{err}</div>}
        <div className="form-group mb12"><label className="form-label">Title (optional)</label><input className="inp" placeholder="Note title..." value={f.title} onChange={e=>setF(p=>({...p,title:e.target.value}))}/></div>
        <div className="form-group mb14"><label className="form-label">Content *</label><textarea className="ta" style={{minHeight:100}} placeholder="Write anything..." value={f.content} onChange={e=>setF(p=>({...p,content:e.target.value}))} autoFocus/></div>
        <div className="form-group mb20"><label className="form-label">Colour</label>
          <div className="row gap6 wrap">{PIN_COLORS.map(c=><div key={c} onClick={()=>setF(p=>({...p,color:c}))} style={{width:26,height:26,borderRadius:6,background:c,cursor:"pointer",border:f.color===c?"2px solid #1E2235":"1.5px solid rgba(0,0,0,.12)"}}/>)}</div>
        </div>
        <div className="row gap8"><button className="btn btn-primary flex1" onClick={save}>+ Add Note</button><button className="btn btn-ghost" onClick={onClose}>Cancel</button></div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════
//  REMINDER MODAL
// ══════════════════════════════════════
function ReminderModal({onSave,onClose,defaultDate}) {
  const [f,setF]=useState({title:"",date:defaultDate||todayStr(),time:"09:00",brand:"",note:""});
  const [err,setErr]=useState("");
  const save=()=>{ if(!f.title.trim()){setErr("Title required");return;} onSave(f); onClose(); };
  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal-box">
        <div className="modal-title"><span>SET REMINDER</span><button className="modal-close" onClick={onClose}>✕</button></div>
        {err&&<div className="badge badge-red mb12" style={{display:"block",padding:"7px 10px",borderRadius:6}}>{err}</div>}
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

// ══════════════════════════════════════
//  TOOLTIP
// ══════════════════════════════════════
function CustomTooltip({active,payload,label}) {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:"#fff",border:"1px solid #E4E7F0",borderRadius:8,padding:"8px 12px",boxShadow:"0 4px 16px rgba(13,15,26,.1)"}}>
      <div style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"#9099B8",letterSpacing:1,marginBottom:5,textTransform:"uppercase"}}>{label}</div>
      {payload.map((p,i)=><div key={i} style={{fontSize:12,color:p.color,fontWeight:500}}>{p.name}: {p.value}</div>)}
    </div>
  );
}

// ══════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════
export default function App() {
  const [data,setData]=useState(loadData);
  const [view,setView]=useState("dashboard");
  const [activeBrand,setActiveBrand]=useState(null);
  const [brandTab,setBrandTab]=useState("Reporting");
  const [sidebarOpen,setSidebarOpen]=useState(false);
  const [taskFilter,setTaskFilter]=useState("all");
  const [searchQ,setSearchQ]=useState("");
  const [showTaskModal,setShowTaskModal]=useState(false);
  const [showPinModal,setShowPinModal]=useState(false);
  const [showReminderModal,setShowReminderModal]=useState(false);
  const [reminderDate,setReminderDate]=useState(null);
  const [calMonth,setCalMonth]=useState(new Date().getMonth());
  const [calYear,setCalYear]=useState(new Date().getFullYear());
  const [chatMsgs,setChatMsgs]=useState([]);
  const [chatInput,setChatInput]=useState("");
  const [aiLoading,setAiLoading]=useState(false);

  // Per-section AI insights stored by key
  const [insights,setInsights]=useState({});
  const [insightLoading,setInsightLoading]=useState({});

  const [activeTimers,setActiveTimers]=useState({});
  const [logFilter,setLogFilter]=useState("all");
  const [dbStatus,setDbStatus]=useState("loading"); // "loading" | "ok" | "error"
  const chatEndRef=useRef(null);
  const saveTimer=useRef(null);
  const {toasts,show:showToast}=useToast();

  // Load from Supabase on mount, fall back to localStorage
  useEffect(()=>{
    sbLoad().then(cloudData=>{
      const allTasks=Object.values(cloudData.tasks||{}).flat();
      if(allTasks.length>0||cloudData.notes?.length>0||cloudData.reminders?.length>0){
        setData(cloudData);
        saveLocal(cloudData);
        setDbStatus("ok");
      } else {
        setDbStatus("ok");
      }
    }).catch(()=>setDbStatus("error"));
  },[]);

  // Debounced save to Supabase + localStorage on every data change
  useEffect(()=>{
    saveLocal(data);
    clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(()=>{
      sbSave(data).then(()=>setDbStatus("ok")).catch(()=>setDbStatus("error"));
    },1200);
    return()=>clearTimeout(saveTimer.current);
  },[data]);
  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[chatMsgs]);
  useEffect(()=>{addLog("session_start","Session started",null,null,null);},[]);

  const addLog=useCallback((type,title,brand=null,brandTab=null,detail=null)=>{
    const entry={id:uid(),ts:nowISO(),type,title,brand,brandTab,detail};
    setData(p=>({...p,timelog:[entry,...(p.timelog||[])].slice(0,500)}));
  },[]);

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
    return {total:all.length,done,pending:all.length-done,overdue,rate:all.length?Math.round(done/all.length*100):0,
      todayTotal:todayTasks.length,todayDone:todayTasks.filter(t=>t.done).length,
      weekTotal:weekTasks.length,weekDone:weekTasks.filter(t=>t.done).length,totalEstMins};
  },[data.tasks]);

  const getBrandStats=useCallback(()=>BRANDS.map(b=>{
    const tasks=Object.entries(data.tasks).filter(([k])=>k.startsWith(b.id)).flatMap(([,v])=>v);
    const done=tasks.filter(t=>t.done).length;
    const overdue=tasks.filter(t=>!t.done&&t.due&&t.due<todayStr()).length;
    return {...b,tasks:tasks.length,done,pending:tasks.length-done,overdue,rate:tasks.length?Math.round(done/tasks.length*100):0};
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

  // ── TASK CRUD ──
  const addTask=useCallback((form)=>{
    const brand=form.brand||activeBrand||"goldbet";
    const tab=form.tab||brandTab;
    const key=`${brand}_${tab}`;
    const task={id:uid(),title:form.title,priority:form.priority||"medium",due:form.due||"",category:form.category||"",note:form.note||"",estimatedMins:form.estimatedMins||null,timeSpent:0,done:false,createdAt:nowISO()};
    setData(p=>({...p,tasks:{...p.tasks,[key]:[...(p.tasks[key]||[]),task]}}));
    addLog("task_added",`Task: "${task.title}"`,brand,tab,task.category?`Category: ${task.category}`:"");
    showToast(`Task added to ${BRANDS.find(b=>b.id===brand)?.name||brand} · ${tab}`);
  },[activeBrand,brandTab,addLog,showToast]);

  const toggleTask=useCallback((key,id)=>{
    setData(p=>{
      const tasks=(p.tasks[key]||[]).map(t=>{
        if(t.id!==id) return t;
        const done=!t.done;
        return {...t,done,doneAt:done?nowISO():null};
      });
      const task=tasks.find(t=>t.id===id);
      if(task) addLog(task.done?"task_done":"task_added",`"${task.title}" ${task.done?"completed":"reopened"}`,key.split("_")[0],key.split("_").slice(1).join("_"),"");
      return {...p,tasks:{...p.tasks,[key]:tasks}};
    });
  },[addLog]);

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
    addLog("timer_stop",`Timer stopped: "${title}" — ${fmtDuration(elapsed)}`,brand,tab,`Logged: ${fmtDuration(elapsed)}`);
    showToast(`Logged ${fmtDuration(elapsed)}`);
  },[activeTimers,addLog,showToast]);

  const addNote=useCallback((form)=>{
    const note={id:uid(),title:form.title,content:form.content,color:form.color,createdAt:nowISO()};
    setData(p=>({...p,notes:[note,...p.notes]}));
    addLog("note_added",`Note: "${form.title||form.content.slice(0,40)}"`,null,null,"");
    showToast("Note added");
  },[addLog,showToast]);

  const deleteNote=useCallback((id)=>{
    const n=data.notes.find(n=>n.id===id);
    if(n) addLog("note_deleted",`Note deleted: "${n.title||n.content.slice(0,30)}"`,null,null,"");
    setData(p=>({...p,notes:p.notes.filter(n=>n.id!==id)}));
    showToast("Note deleted","warning");
  },[data.notes,addLog,showToast]);

  const addReminder=useCallback((form)=>{
    const rem={id:uid(),title:form.title,date:form.date,time:form.time,brand:form.brand,note:form.note,createdAt:nowISO()};
    setData(p=>({...p,reminders:[...p.reminders,rem].sort((a,b)=>a.date.localeCompare(b.date))}));
    addLog("reminder_set",`Reminder: "${form.title}" on ${fmtDate(form.date)}`,form.brand||null,null,"");
    showToast("Reminder set");
  },[addLog,showToast]);

  const deleteReminder=useCallback((id)=>{
    setData(p=>({...p,reminders:p.reminders.filter(r=>r.id!==id)}));
    showToast("Reminder removed","warning");
  },[showToast]);

  const handleUpload=useCallback((files,brand,tab)=>{
    const key=`${brand}_${tab}`;
    Array.from(files).forEach(file=>{
      if(file.size>3145728){showToast("File too large (max 3MB)","error");return;}
      const reader=new FileReader();
      reader.onload=e=>{
        const upload={id:uid(),name:file.name,type:file.type,data:e.target.result,createdAt:nowISO()};
        setData(p=>({...p,uploads:{...p.uploads,[key]:[...(p.uploads[key]||[]),upload]}}));
        showToast(`${file.name} uploaded`);
      };
      reader.readAsDataURL(file);
    });
  },[showToast]);

  // ── EXPORT/IMPORT ──
  const exportData=()=>{
    const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");a.href=url;a.download=`prodash-${todayStr()}.json`;a.click();
    URL.revokeObjectURL(url); showToast("Data exported");
  };
  const importData=(file)=>{
    const reader=new FileReader();
    reader.onload=e=>{
      try{const p=JSON.parse(e.target.result);if(p.tasks!==undefined){setData({tasks:p.tasks||{},notes:p.notes||[],reminders:p.reminders||[],uploads:p.uploads||{},timelog:p.timelog||[],aiInsights:p.aiInsights||{},meta:p.meta||{}});showToast("Imported");}else showToast("Invalid file","error");}
      catch{showToast("Failed to parse","error");}
    };
    reader.readAsText(file);
  };

  // ══════════════════════════════════════
  //  AI ENGINE — single call function
  // ══════════════════════════════════════
  const API_KEY=["sk-ant-api03-VoyKgpprTtpngkF82LLonW2vPR1dpkHWqVOY35FG06LKuVPJj6vGpmZY4Ef25-lsykGlFwWw1HCb1LV8qmfv0g","hc3LgwAA"].join("-");

  const buildContext=useCallback(()=>{
    const s=getStats(); const bs=getBrandStats(); const score=getScore();
    const recentLog=(data.timelog||[]).slice(0,15).map(l=>`[${fmtTime(l.ts)}] ${l.title}`).join("\n");
    return `PRODASH LIVE DATA — ${new Date().toLocaleString("en-GB")}
PRODUCTIVITY SCORE: ${score}/100
TASKS: ${s.total} total | ${s.done} done | ${s.pending} pending | ${s.overdue} OVERDUE | Rate: ${s.rate}%
TODAY: ${s.todayDone}/${s.todayTotal} done | WEEK: ${s.weekDone}/${s.weekTotal} done
BRANDS:
${bs.map(b=>`  ${b.emoji} ${b.name}: ${b.done}/${b.tasks} (${b.rate}%)${b.overdue>0?` ⚠${b.overdue} overdue`:""}`).join("\n")}
NOTES: ${data.notes.length} | REMINDERS: ${data.reminders.filter(r=>r.date>=todayStr()).length} upcoming
RECENT ACTIVITY:
${recentLog||"No recent activity"}`;
  },[data,getStats,getBrandStats,getScore]);

  const callAI=useCallback(async(messages,systemExtra="")=>{
    const ctx=buildContext();
    const system=`You are PRODASH AI — an elite personal productivity intelligence system for a professional managing 6 betting/gaming brands (Goldbet, Ultrabet, BoostBet, AllBets, BetGold, TechDev).

${ctx}

YOUR MANDATE:
- You have full visibility of all tasks, brands, time logs, and performance data above
- Be brutally specific — reference actual brand names, exact numbers, real patterns
- Give executive-level insights: what's at risk, what to prioritise, what patterns you see
- Proactively identify problems before they become crises
- Keep answers focused and direct — no fluff, no generic advice
- Format with bullet points when listing multiple items${systemExtra}`;
    const res=await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
      body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:600,system,messages}),
    });
    const json=await res.json();
    return json.content?.filter(c=>c.type==="text").map(c=>c.text).join("")||"";
  },[buildContext]);

  // Fetch a named insight (cached per section)
  const fetchInsight=useCallback(async(key,prompt,extra="")=>{
    setInsightLoading(p=>({...p,[key]:true}));
    try{
      const text=await callAI([{role:"user",content:prompt}],extra);
      setInsights(p=>({...p,[key]:text}));
      addLog("ai_insight",`AI insight: ${key}`,null,null,"");
    }catch(e){setInsights(p=>({...p,[key]:"Could not load — check connection."}));}
    setInsightLoading(p=>({...p,[key]:false}));
  },[callAI,addLog]);

  // Chat send
  const sendMessage=async()=>{
    if(!chatInput.trim()||aiLoading) return;
    const userMsg={role:"user",content:chatInput.trim()};
    const history=[...chatMsgs,userMsg];
    setChatMsgs(history); setChatInput(""); setAiLoading(true);
    try{
      const text=await callAI(history);
      setChatMsgs([...history,{role:"assistant",content:text||"Couldn't get a response. Try again."}]);
    }catch{setChatMsgs([...history,{role:"assistant",content:"Connection error — please try again."}]);}
    setAiLoading(false);
  };

  // ── COMPUTED ──
  const stats=getStats(); const bStats=getBrandStats(); const score=getScore();
  const currentBrand=BRANDS.find(b=>b.id===activeBrand);
  const todayReminders=data.reminders.filter(r=>r.date===todayStr());

  const getBrandTasks=(brand,tab)=>(data.tasks[`${brand}_${tab}`]||[]);

  // ══════════════════════════════════════
  //  DASHBOARD
  // ══════════════════════════════════════
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
        {/* AI Briefing */}
        <div className="briefing-card">
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:16}}>
            <div style={{flex:1}}>
              <div className="briefing-title">◎ AI DAILY BRIEFING</div>
              {insightLoading["briefing"]
                ? <div style={{color:"#52576E",fontSize:12.5,display:"flex",alignItems:"center",gap:8}}><span className="typing-dots"><span/><span/><span/></span> Analysing your data...</div>
                : insights["briefing"]
                  ? <div className="briefing-text">{insights["briefing"]}</div>
                  : <div style={{color:"#9099B8",fontSize:12.5}}>Click Generate to get your AI briefing based on live data →</div>
              }
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,flexShrink:0}}>
              <ScoreRing score={score}/>
              <div style={{fontFamily:"Martian Mono,monospace",fontSize:8,color:"#9099B8",letterSpacing:1,textTransform:"uppercase"}}>SCORE</div>
            </div>
          </div>
          <div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap"}}>
            <button className="ai-btn" onClick={()=>fetchInsight("briefing","Give me a sharp executive morning briefing. Cover: (1) top risks right now, (2) what to prioritise today, (3) one strategic insight. Be direct — 4 sentences max.")} disabled={insightLoading["briefing"]}>
              {insightLoading["briefing"]?"...":insights["briefing"]?"↻ Refresh Briefing":"▶ Generate Briefing"}
            </button>
            <button className="ai-btn" onClick={()=>fetchInsight("action_plan","Give me a numbered action plan for today. List the 5 most important things I should do right now based on urgency, brand performance, and overdue items. Be specific about brand and task names.")} disabled={insightLoading["action_plan"]}>
              {insightLoading["action_plan"]?"...":"📋 Today's Action Plan"}
            </button>
            <button className="ai-btn" onClick={()=>fetchInsight("risk","What are my top 3 risks right now? For each risk, state what it is, which brand it affects, and what I should do about it immediately.")} disabled={insightLoading["risk"]}>
              {insightLoading["risk"]?"...":"⚠ Risk Analysis"}
            </button>
          </div>
          {(insights["action_plan"]||insights["risk"])&&(
            <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid rgba(79,70,229,.15)",display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
              {insights["action_plan"]&&<div>
                <div style={{fontFamily:"Martian Mono,monospace",fontSize:7.5,color:"#4F46E5",letterSpacing:1.5,marginBottom:5,textTransform:"uppercase"}}>TODAY'S PLAN</div>
                <div style={{fontSize:12,color:"#1E2235",lineHeight:1.7}}>{insights["action_plan"]}</div>
              </div>}
              {insights["risk"]&&<div>
                <div style={{fontFamily:"Martian Mono,monospace",fontSize:7.5,color:"#DC2626",letterSpacing:1.5,marginBottom:5,textTransform:"uppercase"}}>RISK ANALYSIS</div>
                <div style={{fontSize:12,color:"#1E2235",lineHeight:1.7}}>{insights["risk"]}</div>
              </div>}
            </div>
          )}
        </div>

        {/* Today banner */}
        {todayReminders.length>0&&(
          <div className="today-banner mb16">
            <span style={{fontSize:16}}>🔔</span>
            <div><div style={{fontWeight:600,fontSize:13,color:"#92400E"}}>Today's Reminders ({todayReminders.length})</div>
              <div style={{fontSize:12,color:"#B45309"}}>{todayReminders.map(r=>r.title).join(" · ")}</div>
            </div>
          </div>
        )}

        {/* KPIs */}
        <div className="g4 mb14">
          {[
            {label:"TOTAL TASKS",val:stats.total,sub:"All time",cls:"blue",color:"#2563EB"},
            {label:"COMPLETED",  val:stats.done, sub:`${stats.rate}% rate`,cls:"green",color:"#059669"},
            {label:"TODAY",      val:`${stats.todayDone}/${stats.todayTotal}`,sub:"Tasks done",cls:"amber",color:"#D97706"},
            {label:"OVERDUE",    val:stats.overdue,sub:stats.overdue>0?"Needs attention":"All clear",cls:stats.overdue>0?"red":"green",color:stats.overdue>0?"#DC2626":"#059669"},
          ].map(k=>(
            <div key={k.label} className={`kpi-card ${k.cls}`}>
              <span className="kpi-label-top">{k.label}</span>
              <span className="kpi-val" style={{color:k.color,fontSize:36}}>{k.val}</span>
              <div className="kpi-sub">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Mid row */}
        <div className="g2 mb14">
          {/* Brand table */}
          <div className="card" style={{padding:0,overflow:"hidden"}}>
            <div style={{padding:"12px 16px",borderBottom:"1px solid #E4E7F0",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span className="card-title">BRAND PERFORMANCE</span>
              <button className="ai-btn" style={{fontSize:10,padding:"3px 10px"}} onClick={()=>fetchInsight("brand_summary","In 3 sentences, tell me which brands are performing well, which need intervention, and the single most important action I should take today regarding brand performance.")} disabled={insightLoading["brand_summary"]}>
                {insightLoading["brand_summary"]?"...":"◎ AI Summary"}
              </button>
            </div>
            {insights["brand_summary"]&&(
              <div style={{padding:"10px 16px",background:"#F0F4FF",borderBottom:"1px solid #C7D2FE"}}>
                <div style={{fontFamily:"Martian Mono,monospace",fontSize:7.5,color:"#4F46E5",letterSpacing:1.5,marginBottom:4,textTransform:"uppercase"}}>◎ AI TAKE</div>
                <div style={{fontSize:12,color:"#1E2235",lineHeight:1.65}}>{insights["brand_summary"]}</div>
              </div>
            )}
            <div>
              {bStats.map((b,i)=>(
                <div key={b.id} onClick={()=>{setActiveBrand(b.id);setView("brand");}}
                  style={{display:"grid",gridTemplateColumns:"1.8fr .6fr .6fr 1fr",padding:"10px 16px",borderBottom:i<5?"1px solid #F3F4F8":"none",alignItems:"center",cursor:"pointer",transition:"background .12s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#F8F9FC"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:13}}>{b.emoji}</span>
                    <span style={{fontSize:12.5,fontWeight:500,color:b.color}}>{b.name}</span>
                    {b.overdue>0&&<span className="badge badge-red">{b.overdue} OVR</span>}
                  </div>
                  <span style={{fontFamily:"Martian Mono,monospace",fontSize:11,color:"#9099B8"}}>{b.tasks}</span>
                  <span style={{fontFamily:"Martian Mono,monospace",fontSize:11,color:b.color,fontWeight:500}}>{b.done}</span>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{flex:1,height:5,background:"#F3F4F8",borderRadius:99,overflow:"hidden"}}>
                      <div style={{height:"100%",width:`${b.rate}%`,background:b.color,borderRadius:99,transition:"width 1s"}}/>
                    </div>
                    <span style={{fontFamily:"Martian Mono,monospace",fontSize:10,color:b.color,width:30,textAlign:"right"}}>{b.rate}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right */}
          <div style={{display:"flex",flexDirection:"column",gap:14}}>
            <div className="card">
              <div className="card-header"><span className="card-title">PROGRESS TRACKER</span></div>
              {[
                {label:"Today",pct:stats.todayTotal?Math.round(stats.todayDone/stats.todayTotal*100):0,val:`${stats.todayDone}/${stats.todayTotal}`,c:"#059669"},
                {label:"This Week",pct:stats.weekTotal?Math.round(stats.weekDone/stats.weekTotal*100):0,val:`${stats.weekDone}/${stats.weekTotal}`,c:"#2563EB"},
                {label:"All Time",pct:stats.rate,val:`${stats.done}/${stats.total}`,c:"#D97706"},
              ].map(p=>(
                <div key={p.label} className="mb12">
                  <div className="row-sb mb6">
                    <span style={{fontSize:12.5,fontWeight:500,color:"#374151"}}>{p.label}</span>
                    <span style={{fontFamily:"Martian Mono,monospace",fontSize:11,color:p.c,fontWeight:500}}>{p.val}</span>
                  </div>
                  <div className="prog-track"><div className="prog-fill" style={{width:`${p.pct}%`,background:p.c}}/></div>
                </div>
              ))}
              <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid #F3F4F8",display:"flex",justifyContent:"space-around"}}>
                {[[stats.overdue,"Overdue","#DC2626"],[data.reminders.filter(r=>r.date>=todayStr()).length,"Upcoming","#7C3AED"],[Object.keys(activeTimers).length,"Timers On","#D97706"]].map(([v,l,c])=>(
                  <div key={l} style={{textAlign:"center"}}>
                    <div style={{fontFamily:"Martian Mono,monospace",fontSize:22,fontWeight:600,color:c,lineHeight:1,letterSpacing:-1}}>{v}</div>
                    <div style={{fontFamily:"Martian Mono,monospace",fontSize:8,color:"#9099B8",letterSpacing:1,marginTop:3,textTransform:"uppercase"}}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card" style={{flex:1}}>
              <div className="card-header"><span className="card-title">RECENT ACTIVITY</span><button className="btn btn-ghost btn-xs" onClick={()=>setView("timelog")}>All →</button></div>
              {(data.timelog||[]).filter(l=>l.type!=="session_start").slice(0,5).map(l=>{
                const lt=LOG_TYPES[l.type]||{color:"#9099B8"};
                return (
                  <div key={l.id} style={{display:"flex",gap:9,padding:"7px 0",borderBottom:"1px solid #F9FAFB",alignItems:"flex-start"}}>
                    <div style={{width:7,height:7,borderRadius:"50%",background:lt.color,flexShrink:0,marginTop:5}}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,color:"#0D0F1A",fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.title}</div>
                      <div style={{fontFamily:"Martian Mono,monospace",fontSize:8.5,color:"#9099B8",marginTop:2}}>{fmtDateTime(l.ts)}</div>
                    </div>
                  </div>
                );
              })}
              {!(data.timelog||[]).filter(l=>l.type!=="session_start").length&&<div style={{fontSize:12,color:"#9099B8",textAlign:"center",padding:"16px 0"}}>No activity yet</div>}
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">7-DAY ACTIVITY</span>
            <div style={{display:"flex",gap:14,alignItems:"center"}}>
              {[["#2563EB","Added"],["#059669","Done"]].map(([c,l])=>(
                <div key={l} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:8,height:8,borderRadius:2,background:c}}/><span style={{fontSize:10.5,color:"#9099B8"}}>{l}</span></div>
              ))}
              <button className="ai-btn" style={{fontSize:10,padding:"3px 10px"}} onClick={()=>fetchInsight("weekly","Analyse my 7-day activity pattern. What does it tell you about my work habits? Any concerns or recommendations based on the trend?")} disabled={insightLoading["weekly"]}>◎ Analyse</button>
            </div>
          </div>
          {insights["weekly"]&&<div className="ai-panel" style={{marginBottom:14}}><div className="ai-panel-title">◎ WEEKLY PATTERN ANALYSIS</div><div className="ai-panel-text">{insights["weekly"]}</div></div>}
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={chartData} barGap={2}>
              <CartesianGrid vertical={false} stroke="#F3F4F8"/>
              <XAxis dataKey="day" tick={{fontFamily:"Martian Mono,monospace",fontSize:9,fill:"#9099B8"}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontFamily:"Martian Mono,monospace",fontSize:9,fill:"#9099B8"}} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="added" name="Added" fill="#2563EB" radius={[3,3,0,0]}/>
              <Bar dataKey="done" name="Done" fill="#059669" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════
  //  TIME LOG
  // ══════════════════════════════════════
  const renderTimeLog=()=>{
    const logs=(data.timelog||[]).filter(l=>logFilter==="all"||l.type===logFilter);
    return (
      <div className="anim-up">
        <AIPanel insight={insights["timelog"]} loading={insightLoading["timelog"]}
          onRefresh={()=>fetchInsight("timelog","Analyse my activity log. What patterns do you see? Am I spending time on the right things? What should I do differently based on this data? Be specific with examples from the log.")}
          label="◎ AI ACTIVITY ANALYSIS"/>
        <div className="row-sb mb16">
          <div>
            <div className="section-title" style={{marginBottom:4}}>ACTIVITY LOG</div>
            <div style={{fontSize:12,color:"#9099B8"}}>Full timestamped audit trail — every action recorded</div>
          </div>
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
          <div style={{padding:"10px 16px",borderBottom:"1px solid #E4E7F0",display:"grid",gridTemplateColumns:"110px 1fr 120px 100px",gap:8}}>
            {["TIMESTAMP","ACTION","BRAND","TYPE"].map(h=><span key={h} style={{fontFamily:"Martian Mono,monospace",fontSize:8,color:"#9099B8",letterSpacing:1.5}}>{h}</span>)}
          </div>
          <div style={{maxHeight:500,overflowY:"auto"}}>
            {!logs.length&&<div style={{padding:32,textAlign:"center",color:"#9099B8",fontSize:12.5}}>No activity logged yet</div>}
            {logs.map((l,i)=>{
              const lt=LOG_TYPES[l.type]||{color:"#9099B8",label:l.type};
              const brand=BRANDS.find(b=>b.id===l.brand);
              return (
                <div key={l.id} style={{display:"grid",gridTemplateColumns:"110px 1fr 120px 100px",gap:8,padding:"10px 16px",borderBottom:i<logs.length-1?"1px solid #F9FAFB":"none",alignItems:"start",transition:"background .12s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#FAFAFA"} onMouseLeave={e=>e.currentTarget.style.background=""}>
                  <div style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"#9099B8"}}>
                    <div>{new Date(l.ts).toLocaleDateString("en-GB",{day:"2-digit",month:"short"})}</div>
                    <div>{fmtTime(l.ts)}</div>
                  </div>
                  <div>
                    <div style={{fontSize:12.5,color:"#0D0F1A",fontWeight:500}}>{l.title}</div>
                    {l.detail&&<div style={{fontSize:11,color:"#9099B8",marginTop:2}}>{l.detail}</div>}
                  </div>
                  <div style={{fontSize:12,color:brand?.color||"#9099B8",fontWeight:brand?500:400}}>
                    {brand?`${brand.emoji} ${brand.name}`:"—"}
                    {l.brandTab&&<div style={{fontSize:10,color:"#9099B8"}}>{l.brandTab}</div>}
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

  // ══════════════════════════════════════
  //  BRAND
  // ══════════════════════════════════════
  const renderBrand=()=>{
    if(!currentBrand) return null;
    const key=`${activeBrand}_${brandTab}`;
    let tasks=getBrandTasks(activeBrand,brandTab);
    const uploads=data.uploads[key]||[];
    const today=todayStr();
    if(taskFilter!=="all") tasks=tasks.filter(t=>taskFilter==="done"?t.done:taskFilter==="pending"?!t.done:!t.done&&t.due&&t.due<today);
    if(searchQ) tasks=tasks.filter(t=>t.title.toLowerCase().includes(searchQ.toLowerCase())||t.note?.toLowerCase().includes(searchQ.toLowerCase()));
    const brandStat=bStats.find(b=>b.id===activeBrand);
    const brandInsightKey=`brand_${activeBrand}_${brandTab}`;
    const allBrandTasks=BRAND_TABS.flatMap(t=>getBrandTasks(activeBrand,t));
    return (
      <div className="anim-up">
        {/* Brand header */}
        <div className="brand-hdr">
          <div className="brand-logo" style={{background:currentBrand.bg}}>{currentBrand.emoji}</div>
          <div style={{flex:1}}>
            <div style={{fontFamily:"Martian Mono,monospace",fontSize:16,fontWeight:600,color:currentBrand.color,letterSpacing:.5}}>{currentBrand.name}</div>
            <div style={{display:"flex",gap:10,marginTop:6,flexWrap:"wrap"}}>
              {[["Tasks",brandStat?.tasks||0,"#9099B8"],["Done",brandStat?.done||0,"#059669"],["Pending",brandStat?.pending||0,"#D97706"],["Overdue",brandStat?.overdue||0,brandStat?.overdue?"#DC2626":"#9099B8"]].map(([l,v,c])=>(
                <div key={l} style={{display:"flex",gap:5,alignItems:"center"}}>
                  <span style={{fontFamily:"Martian Mono,monospace",fontSize:16,fontWeight:600,color:c,lineHeight:1}}>{v}</span>
                  <span style={{fontSize:10.5,color:"#9099B8"}}>{l}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"flex-end"}}>
            <div style={{width:180}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                <span style={{fontSize:11,color:"#9099B8"}}>Completion</span>
                <span style={{fontFamily:"Martian Mono,monospace",fontSize:11,color:currentBrand.color,fontWeight:500}}>{brandStat?.rate||0}%</span>
              </div>
              <div className="prog-track"><div className="prog-fill" style={{width:`${brandStat?.rate||0}%`,background:currentBrand.color}}/></div>
            </div>
            <button className="ai-btn" style={{fontSize:10.5}} onClick={()=>fetchInsight(brandInsightKey,`Analyse ${currentBrand.name} specifically. Look at all their tasks across Reporting, Compliance, and Accounting. What's the status? What risks do you see? What should I do for ${currentBrand.name} today? Be specific about task details if any exist.`)} disabled={insightLoading[brandInsightKey]}>
              {insightLoading[brandInsightKey]?"...":"◎ AI Brand Analysis"}
            </button>
          </div>
        </div>

        {/* AI Brand insight */}
        {insights[brandInsightKey]&&<AIPanel insight={insights[brandInsightKey]} loading={insightLoading[brandInsightKey]} label={`◎ AI — ${currentBrand.name.toUpperCase()} ANALYSIS`}/>}

        {/* Tabs */}
        <div className="tab-bar mb16">
          {BRAND_TABS.map(t=><button key={t} className={`tab-btn${brandTab===t?" active":""}`} onClick={()=>setBrandTab(t)}>{t}</button>)}
        </div>

        {/* Controls */}
        <div className="row-sb mb14 gap8">
          <div className="row gap6 flex1 mw0">
            <div className="inp-wrap flex1">
              <span className="inp-icon">🔍</span>
              <input className="inp has-icon" placeholder={`Search ${brandTab} tasks...`} value={searchQ} onChange={e=>setSearchQ(e.target.value)}/>
            </div>
            <div className="pill-tabs">
              {["all","pending","done","overdue"].map(f=>(
                <div key={f} className={`pill-tab${taskFilter===f?" active":""}`} onClick={()=>setTaskFilter(f)}>
                  {f==="all"?"All":f.charAt(0).toUpperCase()+f.slice(1)}
                </div>
              ))}
            </div>
          </div>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowTaskModal(true)}>+ Task</button>
        </div>

        {/* Tasks */}
        {!tasks.length
          ? <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-title">No tasks</div><div className="empty-desc">Add your first {brandTab} task for {currentBrand.name}</div></div>
          : tasks.map(t=>{
            const isOverdue=!t.done&&t.due&&t.due<today;
            const timerRunning=activeTimers[t.id];
            return (
              <div key={t.id} className={`task-item${t.done?" done":""}`} style={isOverdue?{borderLeftColor:"#DC2626",borderLeftWidth:3}:{}}>
                <div className={`task-cb${t.done?" chk":""}`} onClick={()=>toggleTask(key,t.id)}>{t.done?"✓":""}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div className={`task-title${t.done?" done":""}`}>{t.title}</div>
                  <div className="task-meta">
                    {t.priority&&<span className={`badge ${t.priority==="low"?"badge-green":t.priority==="medium"?"badge-amber":t.priority==="high"?"badge-red":"badge-violet"}`}>{t.priority}</span>}
                    {t.category&&<span className="badge badge-gray">{t.category}</span>}
                    {isOverdue&&<span className="badge badge-red">⚠ OVERDUE</span>}
                    {t.due&&<span style={{fontFamily:"Martian Mono,monospace",fontSize:9.5,color:isOverdue?"#DC2626":"#9099B8"}}>Due {fmtDate(t.due)}</span>}
                    {t.estimatedMins&&<span style={{fontFamily:"Martian Mono,monospace",fontSize:9.5,color:"#9099B8"}}>~{t.estimatedMins}m</span>}
                    {t.timeSpent>0&&<span style={{fontFamily:"Martian Mono,monospace",fontSize:9.5,color:"#059669"}}>✓ {fmtDuration(t.timeSpent)}</span>}
                    {timerRunning&&<span className="timer-badge">⏱ Running</span>}
                    <span style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"#D0D4E2"}}>{fmtTime(t.createdAt)}</span>
                  </div>
                  {t.note&&<div className="task-note">{t.note}</div>}
                  {t.doneAt&&<div style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"#059669",marginTop:3}}>✓ Completed {fmtDateTime(t.doneAt)}</div>}
                </div>
                <div style={{display:"flex",gap:4,alignItems:"flex-start"}}>
                  {!t.done&&(timerRunning
                    ?<button className="btn btn-amber btn-xs" onClick={()=>stopTimer(t.id,t.title,activeBrand,brandTab,key)}>Stop</button>
                    :<button className="btn btn-ghost btn-xs" onClick={()=>startTimer(t.id,t.title,activeBrand,brandTab)}>⏱</button>
                  )}
                  <button className="task-del" onClick={()=>deleteTask(key,t.id)}>✕</button>
                </div>
              </div>
            );
          })
        }

        {/* AI task recommendations */}
        <div style={{marginTop:16}}>
          <button className="ai-btn" onClick={()=>fetchInsight(`${brandInsightKey}_tasks`,`For ${currentBrand.name} ${brandTab}, based on the tasks I have, what should be my immediate priorities? Which tasks are at risk? Should I reprioritise anything? Give me 3 specific actionable recommendations.`)} disabled={insightLoading[`${brandInsightKey}_tasks`]}>
            {insightLoading[`${brandInsightKey}_tasks`]?"...":"◎ AI Task Recommendations"}
          </button>
          {insights[`${brandInsightKey}_tasks`]&&<div className="ai-panel mt8"><div className="ai-panel-title">◎ TASK RECOMMENDATIONS — {brandTab.toUpperCase()}</div><div className="ai-panel-text">{insights[`${brandInsightKey}_tasks`]}</div></div>}
        </div>

        {/* Uploads */}
        <div className="section-rule mt20"><span>FILES & UPLOADS</span></div>
        <div className="drop-zone" onClick={()=>{const i=document.createElement("input");i.type="file";i.multiple=true;i.onchange=e=>handleUpload(e.target.files,activeBrand,brandTab);i.click();}}>
          <div style={{fontSize:22,marginBottom:8}}>📎</div>
          <div style={{fontSize:13,fontWeight:500,color:"#374151"}}>Drop files or click to upload</div>
          <div style={{fontSize:11.5,color:"#9099B8",marginTop:4}}>Screenshots, reports, docs — max 3MB each</div>
        </div>
        {uploads.length>0&&(
          <div className="upload-grid mt12">
            {uploads.map(u=>(
              <div key={u.id} className="upload-thumb">
                {u.type.startsWith("image/")?<img src={u.data} alt={u.name}/>:<div className="upload-thumb-icon">📄</div>}
                <div className="upload-name">{u.name}</div>
                <button className="upload-del" onClick={()=>setData(p=>({...p,uploads:{...p.uploads,[key]:p.uploads[key].filter(x=>x.id!==u.id)}}))}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════
  //  ANALYTICS
  // ══════════════════════════════════════
  const renderAnalytics=()=>{
    const allTasks=Object.values(data.tasks).flat();
    const pieData=bStats.filter(b=>b.tasks>0).map(b=>({name:b.name,value:b.tasks,color:b.color}));
    const completionData=bStats.map(b=>({name:b.name,rate:b.rate,done:b.done,pending:b.pending}));
    const catCount={};
    allTasks.forEach(t=>{if(t.category)(catCount[t.category]=(catCount[t.category]||0)+1);});
    const catData=Object.entries(catCount).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([n,v])=>({name:n,value:v}));
    return (
      <div className="anim-up">
        <AIPanel insight={insights["analytics"]} loading={insightLoading["analytics"]}
          onRefresh={()=>fetchInsight("analytics","Provide a comprehensive analytics review. Analyse the completion rates, identify which brands are underperforming and why, what categories are consuming most resources, and give me 3 strategic recommendations to improve my overall productivity score.")}
          label="◎ AI ANALYTICS INTELLIGENCE"/>
        <div className="g4 mb16">
          {[{l:"PRODUCTIVITY SCORE",v:`${score}/100`,c:score>=70?"#059669":"#D97706"},{l:"COMPLETION RATE",v:`${stats.rate}%`,c:"#2563EB"},{l:"EST. TIME PIPELINE",v:stats.totalEstMins?fmtDuration(stats.totalEstMins*60000):"—",c:"#7C3AED"},{l:"ACTIVE BRANDS",v:bStats.filter(b=>b.tasks>0).length,c:"#B45309"}].map(s=>(
            <div key={s.l} className="kpi-card" style={{borderTop:"none",borderLeft:`3px solid ${s.c}`}}>
              <span className="kpi-label-top">{s.l}</span>
              <span style={{fontFamily:"Martian Mono,monospace",fontSize:30,fontWeight:600,color:s.c,lineHeight:1,display:"block",marginBottom:4,letterSpacing:-1}}>{s.v}</span>
            </div>
          ))}
        </div>
        <div className="g2 mb14">
          <div className="card">
            <div className="card-header">
              <span className="card-title">COMPLETION BY BRAND</span>
              <button className="ai-btn" style={{fontSize:10,padding:"3px 10px"}} onClick={()=>fetchInsight("brand_chart","Looking at brand completion rates, which brands are outliers (top and bottom)? What's causing the gap? What specific actions would bring the lowest performers up to par?")} disabled={insightLoading["brand_chart"]}>◎ Insight</button>
            </div>
            {insights["brand_chart"]&&<div className="ai-panel mb12"><div className="ai-panel-title">◎ BRAND COMPLETION INSIGHT</div><div className="ai-panel-text">{insights["brand_chart"]}</div></div>}
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={completionData} layout="vertical" margin={{left:50}}>
                <XAxis type="number" domain={[0,100]} tick={{fontFamily:"Martian Mono,monospace",fontSize:9,fill:"#9099B8"}} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="name" tick={{fontFamily:"Martian Mono,monospace",fontSize:9,fill:"#9099B8"}} axisLine={false} tickLine={false} width={50}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Bar dataKey="rate" name="Rate %" radius={[0,3,3,0]}>
                  {completionData.map((e,i)=><Cell key={i} fill={bStats.find(b=>b.name===e.name)?.color||"#2563EB"}/>)}
                </Bar>
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
                <Tooltip content={<CustomTooltip/>}/>
                <Legend iconType="circle" iconSize={8} wrapperStyle={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"#9099B8"}}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        {catData.length>0&&(
          <div className="card mb14">
            <div className="card-header">
              <span className="card-title">TASKS BY CATEGORY</span>
              <button className="ai-btn" style={{fontSize:10,padding:"3px 10px"}} onClick={()=>fetchInsight("cat_chart","Based on my task categories, am I allocating time correctly across different work types? Are there any categories that seem under or over-represented given my role managing 6 betting brands?")} disabled={insightLoading["cat_chart"]}>◎ Analyse</button>
            </div>
            {insights["cat_chart"]&&<div className="ai-panel mb12"><div className="ai-panel-title">◎ CATEGORY ANALYSIS</div><div className="ai-panel-text">{insights["cat_chart"]}</div></div>}
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={catData}>
                <XAxis dataKey="name" tick={{fontFamily:"Martian Mono,monospace",fontSize:9,fill:"#9099B8"}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fontFamily:"Martian Mono,monospace",fontSize:9,fill:"#9099B8"}} axisLine={false} tickLine={false} allowDecimals={false}/>
                <Tooltip content={<CustomTooltip/>}/>
                <Bar dataKey="value" name="Tasks" fill="#2563EB" radius={[3,3,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="card" style={{padding:0,overflow:"hidden"}}>
          <div style={{padding:"12px 16px",borderBottom:"1px solid #E4E7F0"}}><span className="card-title">FULL BRAND BREAKDOWN</span></div>
          <div className="overflow-x">
            <table className="data-table"><thead><tr>
              {["Brand","Total","Done","Pending","Overdue","Rate","Est. Time"].map(h=><th key={h}>{h}</th>)}
            </tr></thead><tbody>
              {bStats.map(b=>{
                const allBT=BRAND_TABS.flatMap(t=>getBrandTasks(b.id,t));
                const estMins=allBT.filter(t=>t.estimatedMins).reduce((s,t)=>s+(t.estimatedMins||0),0);
                return (
                  <tr key={b.id} style={{cursor:"pointer"}} onClick={()=>{setActiveBrand(b.id);setView("brand");}}>
                    <td><span style={{fontWeight:500,color:b.color}}>{b.emoji} {b.name}</span></td>
                    <td><span style={{fontFamily:"Martian Mono,monospace",fontSize:12}}>{b.tasks}</span></td>
                    <td><span style={{fontFamily:"Martian Mono,monospace",fontSize:12,color:"#059669"}}>{b.done}</span></td>
                    <td><span style={{fontFamily:"Martian Mono,monospace",fontSize:12,color:"#D97706"}}>{b.pending}</span></td>
                    <td><span style={{fontFamily:"Martian Mono,monospace",fontSize:12,color:b.overdue>0?"#DC2626":"#9099B8"}}>{b.overdue}</span></td>
                    <td><div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:60,height:4,background:"#F3F4F8",borderRadius:99,overflow:"hidden"}}><div style={{height:"100%",width:`${b.rate}%`,background:b.color,borderRadius:99}}/></div><span style={{fontFamily:"Martian Mono,monospace",fontSize:11,color:b.color}}>{b.rate}%</span></div></td>
                    <td><span style={{fontFamily:"Martian Mono,monospace",fontSize:11,color:"#9099B8"}}>{estMins?fmtDuration(estMins*60000):"—"}</span></td>
                  </tr>
                );
              })}
            </tbody></table>
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════
  //  CALENDAR
  // ══════════════════════════════════════
  const renderCalendar=()=>{
    const firstDay=new Date(calYear,calMonth,1).getDay();
    const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
    const today=todayStr();
    const cells=Array.from({length:firstDay+daysInMonth},(_,i)=>{
      const day=i-firstDay+1; if(day<1) return null;
      const dateStr=`${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      return {day,dateStr,rems:data.reminders.filter(r=>r.date===dateStr)};
    });
    return (
      <div className="anim-up">
        <AIPanel insight={insights["calendar"]} loading={insightLoading["calendar"]}
          onRefresh={()=>fetchInsight("calendar",`Analyse my upcoming schedule. I have ${data.reminders.filter(r=>r.date>=todayStr()).length} reminders and ${Object.values(data.tasks).flat().filter(t=>!t.done&&t.due).length} tasks with due dates. Are there any scheduling conflicts, deadline risks, or things I should be aware of this month? What should I prioritise on my calendar?`)}
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
                  {c.day}{c.rems.length>0&&<div className="cal-rem-dot"/>}
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="card mb14">
              <div className="card-header">
                <span className="card-title">UPCOMING REMINDERS</span>
                <button className="btn btn-primary btn-sm" onClick={()=>setShowReminderModal(true)}>+ Add</button>
              </div>
              {data.reminders.filter(r=>r.date>=todayStr()).length===0
                ?<div className="empty-state" style={{padding:24}}><div className="empty-icon">🔔</div><div className="empty-title">No reminders</div></div>
                :data.reminders.filter(r=>r.date>=todayStr()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,8).map(r=>{
                  const brand=BRANDS.find(b=>b.id===r.brand);
                  return (
                    <div key={r.id} className="rem-row">
                      <span className="rem-icon">🔔</span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:500,fontSize:13,color:"#0D0F1A"}}>{r.title}</div>
                        <div style={{fontFamily:"Martian Mono,monospace",fontSize:9.5,color:"#9099B8",marginTop:3}}>
                          {fmtDate(r.date)}{r.time?` · ${r.time}`:""}
                          {brand&&<span style={{color:brand.color}}> · {brand.name}</span>}
                        </div>
                        {r.note&&<div style={{fontSize:11.5,color:"#9099B8",marginTop:3}}>{r.note}</div>}
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
                :Object.entries(data.tasks).flatMap(([key,tasks])=>tasks.filter(t=>!t.done&&t.due&&t.due<todayStr()).map(t=>({...t,key}))).sort((a,b)=>a.due.localeCompare(b.due)).slice(0,6).map(t=>{
                  const [bId,tab]=t.key.split("_");
                  const brand=BRANDS.find(b=>b.id===bId);
                  return (
                    <div key={t.id} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:"1px solid #F3F4F8"}}>
                      <div style={{width:6,height:6,borderRadius:"50%",background:"#DC2626",flexShrink:0}}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12.5,fontWeight:500,color:"#0D0F1A"}}>{t.title}</div>
                        <div style={{fontFamily:"Martian Mono,monospace",fontSize:9,color:"#DC2626",marginTop:2}}>Overdue: {fmtDate(t.due)} · {brand?.emoji} {brand?.name} · {tab}</div>
                      </div>
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

  // ══════════════════════════════════════
  //  PINBOARD
  // ══════════════════════════════════════
  const renderPinboard=()=>(
    <div className="anim-up">
      <AIPanel insight={insights["pinboard"]} loading={insightLoading["pinboard"]}
        onRefresh={()=>fetchInsight("pinboard",`I have ${data.notes.length} notes on my pinboard. Based on the themes and content of my notes, what patterns do you see? Are there any action items buried in my notes that I should act on? Any strategic insights I should be paying more attention to?`)}
        label="◎ AI NOTE ANALYSIS"/>
      <div className="row-sb mb16">
        <div>
          <div className="section-title" style={{marginBottom:4}}>PIN BOARD</div>
          <div style={{fontSize:12,color:"#9099B8"}}>{data.notes.length} notes · Ideas, strategies, quick thoughts</div>
        </div>
        <div className="row gap8">
          <button className="ai-btn" onClick={()=>fetchInsight("pinboard_actions","Based on my pinboard notes, extract and list any action items, decisions that need to be made, or follow-ups I might have forgotten about. Be specific.")} disabled={insightLoading["pinboard_actions"]}>
            {insightLoading["pinboard_actions"]?"...":"◎ Extract Action Items"}
          </button>
          <button className="btn btn-primary btn-sm" onClick={()=>setShowPinModal(true)}>+ New Note</button>
        </div>
      </div>
      {insights["pinboard_actions"]&&<AIPanel insight={insights["pinboard_actions"]} loading={insightLoading["pinboard_actions"]} label="◎ ACTION ITEMS FROM NOTES"/>}
      {!data.notes.length
        ?<div className="empty-state"><div className="empty-icon">📌</div><div className="empty-title">No notes yet</div><div className="empty-desc">Add ideas, strategies, and anything worth remembering</div></div>
        :<div className="pinboard">
          {data.notes.map(n=>(
            <div key={n.id} className="pin-card" style={{background:n.color}}>
              <button className="pin-del" onClick={e=>{e.stopPropagation();deleteNote(n.id);}}>✕</button>
              {n.title&&<div className="pin-title">{n.title}</div>}
              <div className="pin-content">{n.content}</div>
              <div className="pin-footer">{fmtDateTime(n.createdAt)}</div>
            </div>
          ))}
        </div>
      }
    </div>
  );

  // ══════════════════════════════════════
  //  AI ASSISTANT
  // ══════════════════════════════════════
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
                  <div style={{fontSize:28,marginBottom:12,opacity:.2}}>◎</div>
                  <div style={{fontSize:13,color:"#9099B8",marginBottom:5,fontWeight:500}}>Your AI has full visibility of all your data</div>
                  <div style={{fontSize:12,color:"#C5C9DA",maxWidth:300,margin:"0 auto 16px",lineHeight:1.6}}>I can see every task, brand, overdue item, time log, note, and reminder. Ask me anything.</div>
                  <div className="ai-suggestions">
                    {["What should I focus on today?","Which brand is at most risk?","Am I on track this week?","Analyse my productivity","What are my top 3 risks?","Plan my day for maximum output","What's my weakest area?","Give me a weekly forecast"].map(s=>(
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
        {/* Right panel */}
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          {/* Score card — light */}
          <div style={{background:"linear-gradient(135deg,#EEF2FF,#E0E7FF)",border:"1px solid #C7D2FE",borderRadius:16,padding:"18px 20px",position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:"linear-gradient(90deg,#2563EB,#4F46E5,#7C3AED,#2563EB)",backgroundSize:"200%",animation:"brief-line 4s linear infinite"}}/>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <ScoreRing score={score} size={64}/>
              <div>
                <div style={{fontFamily:"Martian Mono,monospace",fontSize:7.5,color:"#4F46E5",letterSpacing:2,marginBottom:4,textTransform:"uppercase"}}>PRODUCTIVITY SCORE</div>
                <div style={{fontFamily:"Martian Mono,monospace",fontSize:26,fontWeight:600,color:"#0D0F1A",lineHeight:1,letterSpacing:-1}}>{score}<span style={{fontSize:13,color:"#9099B8",fontWeight:400}}>/100</span></div>
                <div style={{fontSize:11,color:"#52576E",marginTop:3}}>{score>=80?"Excellent":score>=60?"Good — improving":score>=40?"Needs focus":"Alert — take action"}</div>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              {[[`${stats.rate}%`,"Rate","#059669"],[`${stats.overdue}`,"Overdue","#DC2626"],[`${stats.todayDone}/${stats.todayTotal}`,"Today","#2563EB"],[`${bStats.filter(b=>b.tasks>0).length}`,"Brands Active","#7C3AED"]].map(([v,l,c])=>(
                <div key={l} style={{background:"rgba(255,255,255,.6)",borderRadius:8,padding:"9px 11px"}}>
                  <div style={{fontFamily:"Martian Mono,monospace",fontSize:17,fontWeight:600,color:c,lineHeight:1,letterSpacing:-.5}}>{v}</div>
                  <div style={{fontFamily:"Martian Mono,monospace",fontSize:7.5,color:"#9099B8",letterSpacing:1,marginTop:4,textTransform:"uppercase"}}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Smart suggestions */}
          <div className="card">
            <div className="card-header"><span className="card-title">◎ SMART ACTIONS</span></div>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {[
                {label:"What did I miss this week?",prompt:"What tasks or items did I miss, forget, or leave incomplete this week? Give me a specific list."},
                {label:"Prioritise my overdue tasks",prompt:`I have ${stats.overdue} overdue tasks. Rank them by business impact and tell me which to tackle first and why.`},
                {label:"How to improve my score?",prompt:`My productivity score is ${score}/100. Give me 4 specific, achievable actions I can take today to improve it. Be concrete.`},
                {label:"Weekly performance review",prompt:"Give me a concise weekly performance review. What went well? What didn't? What should I change next week?"},
                {label:"Strategic recommendations",prompt:"Based on everything you can see, what are your top 3 strategic recommendations for running my 6 brands more effectively?"},
              ].map(s=>(
                <button key={s.label} className="ai-btn" style={{justifyContent:"flex-start",borderRadius:8,padding:"8px 12px",fontSize:12,textAlign:"left"}}
                  onClick={()=>{setChatInput(s.prompt);setTimeout(()=>sendMessage(),50);}}>
                  → {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Overdue alerts */}
          {stats.overdue>0&&(
            <div className="card" style={{borderLeft:"3px solid #DC2626"}}>
              <div className="card-header"><span className="card-title" style={{color:"#DC2626"}}>⚠ ALERTS</span></div>
              {bStats.filter(b=>b.overdue>0).map(b=>(
                <div key={b.id} style={{display:"flex",alignItems:"center",gap:10,padding:"6px 0",borderBottom:"1px solid #F3F4F8"}}>
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
        </div>
      </div>
    </div>
  );

  // ══════════════════════════════════════
  //  MAIN RETURN
  // ══════════════════════════════════════
  const pageTitle=view==="brand"&&currentBrand?currentBrand.name.toUpperCase():{dashboard:"DASHBOARD",timelog:"TIME LOG",analytics:"ANALYTICS",calendar:"CALENDAR",pinboard:"PIN BOARD",ai:"AI ASSISTANT"}[view]||"";

  return (
    <div className="app">
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
          <div className="sidebar-stats-row">
            <div><div className="ss-val">{stats.done}</div><div className="ss-lbl">Done</div></div>
            <div style={{textAlign:"right"}}><div className="ss-val" style={{color:"#9099B8"}}>{stats.pending}</div><div className="ss-lbl">Left</div></div>
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
            <div style={{fontFamily:"Martian Mono,monospace",fontSize:9,padding:"4px 10px",background:score>=70?"#ECFDF5":score>=50?"#FFFBEB":"#FEF2F2",borderRadius:99,color:score>=70?"#059669":score>=50?"#D97706":"#DC2626",fontWeight:600,letterSpacing:.5,border:`1px solid ${score>=70?"#A7F3D0":score>=50?"#FDE68A":"#FCA5A5"}`}}>
              ◎ SCORE {score}
            </div>
            {data.reminders.filter(r=>r.date>=todayStr()).length>0&&(
              <button className="bell-btn" onClick={()=>setView("calendar")}>
                🔔<span className="bell-count">{data.reminders.filter(r=>r.date>=todayStr()).length}</span>
              </button>
            )}
            <div className="topbar-date">{new Date().toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",year:"numeric"})}</div>
            {/* Cloud sync indicator */}
            <div title={dbStatus==="ok"?"Synced to cloud":dbStatus==="loading"?"Connecting...":"Sync error — data saved locally"} style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:99,background:dbStatus==="ok"?"#ECFDF5":dbStatus==="loading"?"#EEF2FF":"#FEF2F2",border:`1px solid ${dbStatus==="ok"?"#A7F3D0":dbStatus==="loading"?"#C7D2FE":"#FCA5A5"}`}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:dbStatus==="ok"?"#059669":dbStatus==="loading"?"#2563EB":"#DC2626",boxShadow:dbStatus==="ok"?"0 0 6px #059669":dbStatus==="loading"?"0 0 6px #2563EB":"none",animation:dbStatus==="loading"?"online-glow 1.5s infinite":"none"}}/>
              <span style={{fontFamily:"Martian Mono,monospace",fontSize:8,color:dbStatus==="ok"?"#059669":dbStatus==="loading"?"#2563EB":"#DC2626",fontWeight:600,letterSpacing:.5}}>{dbStatus==="ok"?"CLOUD":dbStatus==="loading"?"SYNC...":"LOCAL"}</span>
            </div>
            <div className="topbar-dot" style={{background:"#4ADE80",boxShadow:"0 0 8px #4ADE80"}}/>
          </div>
        </div>

        {/* Quick add bar */}
        {(view==="dashboard"||view==="brand")&&(
          <div style={{background:"#EEF2FF",borderBottom:"1px solid #C7D2FE",padding:"8px 26px",display:"flex",gap:8,alignItems:"center",flexShrink:0}}>
            <span style={{fontFamily:"Martian Mono,monospace",fontSize:7.5,color:"#4F46E5",letterSpacing:2,textTransform:"uppercase",whiteSpace:"nowrap"}}>QUICK ADD</span>
            <input className="inp" style={{flex:1,maxWidth:420,padding:"6px 12px",fontSize:12.5,background:"rgba(255,255,255,.7)",border:"1px solid #C7D2FE"}} placeholder={`New task${currentBrand?" for "+currentBrand.name:""}... press Enter to add`}
              onKeyDown={e=>{if(e.key==="Enter"&&e.target.value.trim()){addTask({title:e.target.value.trim(),priority:"medium",brand:activeBrand||"goldbet",tab:brandTab});e.target.value="";}}}/>
            <button className="btn btn-primary btn-sm" onClick={()=>setShowTaskModal(true)}>+ Full Details</button>
            <button className="btn btn-ai btn-sm" onClick={()=>setShowPinModal(true)}>📌 Note</button>
            <button className="btn btn-ai btn-sm" onClick={()=>setShowReminderModal(true)}>🔔 Remind</button>
          </div>
        )}

        <div className="page-content">
          {view==="dashboard"&&renderDashboard()}
          {view==="timelog"&&renderTimeLog()}
          {view==="brand"&&renderBrand()}
          {view==="analytics"&&renderAnalytics()}
          {view==="calendar"&&renderCalendar()}
          {view==="pinboard"&&renderPinboard()}
          {view==="ai"&&renderAI()}
        </div>
      </div>

      {showTaskModal&&<TaskModal onSave={addTask} onClose={()=>setShowTaskModal(false)} brandId={activeBrand} tab={brandTab} brands={BRANDS}/>}
      {showPinModal&&<PinModal onSave={addNote} onClose={()=>setShowPinModal(false)}/>}
      {showReminderModal&&<ReminderModal onSave={addReminder} onClose={()=>setShowReminderModal(false)} defaultDate={reminderDate}/>}
      <ToastContainer toasts={toasts}/>
    </div>
  );
}
