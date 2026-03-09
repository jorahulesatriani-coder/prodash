import { useState, useEffect, useRef, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend
} from "recharts";

// ══════════════════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════════════════

const BRANDS = [
  { id: "goldbet",  name: "Goldbet",  color: "#D97706", bg: "#FFFBEB", emoji: "🥇" },
  { id: "ultrabet", name: "Ultrabet", color: "#7C3AED", bg: "#F5F3FF", emoji: "⚡" },
  { id: "boostbet", name: "BoostBet", color: "#DC2626", bg: "#FEF2F2", emoji: "🚀" },
  { id: "allbets",  name: "AllBets",  color: "#059669", bg: "#ECFDF5", emoji: "🎯" },
  { id: "betgold",  name: "BetGold",  color: "#EA580C", bg: "#FFF7ED", emoji: "💰" },
  { id: "techdev",  name: "TechDev",  color: "#2563EB", bg: "#EFF6FF", emoji: "💻" },
];

const BRAND_TABS = ["Reporting", "Compliance", "Accounting"];

const PRIORITIES = [
  { key: "low",    label: "Low",    cls: "p-low",    dot: "pd-low" },
  { key: "medium", label: "Medium", cls: "p-medium", dot: "pd-medium" },
  { key: "high",   label: "High",   cls: "p-high",   dot: "pd-high" },
  { key: "urgent", label: "Urgent", cls: "p-urgent", dot: "pd-urgent" },
];

const PIN_COLORS = [
  "#FFF9C4", "#FFEEBA", "#FFE0E0", "#E0F4E0", "#E0E8FF",
  "#F3E8FF", "#FFF0E0", "#E0F8F8"
];

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

const STORAGE_KEY = "prodash_data_v2";

const NAV_ITEMS = [
  { id: "dashboard", icon: "🏠", label: "Dashboard" },
  { id: "analytics", icon: "📊", label: "Analytics" },
  { id: "calendar",  icon: "📅", label: "Calendar" },
  { id: "pinboard",  icon: "📌", label: "Pin Board" },
  { id: "ai",        icon: "🤖", label: "AI Assistant" },
];

// ══════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════

const uid = () => `${Date.now()}_${Math.random().toString(36).substr(2,7)}`;
const todayStr = () => new Date().toISOString().split("T")[0];
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" }) : "";
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString("en-GB", { hour:"2-digit", minute:"2-digit" }) : "";
const daysSince = (d) => Math.floor((Date.now() - new Date(d)) / 86400000);

const emptyData = () => ({
  tasks: {},
  notes: [],
  reminders: [],
  uploads: {},
  meta: { createdAt: new Date().toISOString() }
});

const loadData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData();
    const parsed = JSON.parse(raw);
    // Ensure all fields exist (migration safety)
    return {
      tasks: parsed.tasks || {},
      notes: parsed.notes || [],
      reminders: parsed.reminders || [],
      uploads: parsed.uploads || {},
      meta: parsed.meta || { createdAt: new Date().toISOString() }
    };
  } catch {
    return emptyData();
  }
};

const saveData = (data) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("Storage error:", e);
    return false;
  }
};

// ══════════════════════════════════════════════════════════
//  TOAST HOOK
// ══════════════════════════════════════════════════════════

function useToast() {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((msg, type = "success") => {
    const id = uid();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);
  return { toasts, show };
}

// ══════════════════════════════════════════════════════════
//  SUB-COMPONENTS
// ══════════════════════════════════════════════════════════

function ToastContainer({ toasts }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          {t.type === "success" && "✓"} {t.type === "error" && "✕"} {t.type === "warning" && "⚠"} {t.msg}
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ pct, color }) {
  return (
    <div className="prog-track">
      <div className="prog-fill" style={{ width: `${Math.min(pct, 100)}%`, background: color || "var(--blue)" }} />
    </div>
  );
}

// ── Task ──
function TaskItem({ task, onToggle, onDelete }) {
  const done = task.status === "done";
  const pri = PRIORITIES.find(p => p.key === task.priority) || PRIORITIES[1];
  return (
    <div className={`task-item${done ? " done" : ""}`}>
      <div className={`task-cb${done ? " chk" : ""}`} onClick={onToggle} title={done ? "Mark pending" : "Mark done"}>
        {done && "✓"}
      </div>
      <div className="col flex1 mw0">
        <div className={`task-title${done ? " done" : ""}`}>{task.title}</div>
        <div className="task-meta">
          <div className={`priority-dot ${pri.dot}`} />
          <span className={`badge ${pri.cls}`}>{pri.label}</span>
          {task.dueDate && (
            <span className="text-xs text-mono text-muted">
              📅 {fmtDate(task.dueDate)}
              {!done && daysSince(task.dueDate) > 0 && (
                <span style={{ color: "var(--red)", marginLeft: 3 }}>
                  ({daysSince(task.dueDate)}d overdue)
                </span>
              )}
            </span>
          )}
          {done && task.completedAt && (
            <span className="text-xs text-mono" style={{ color: "var(--green)" }}>
              ✓ {fmtDate(task.completedAt)}
            </span>
          )}
        </div>
        {task.notes && <div className="task-note">{task.notes}</div>}
      </div>
      <button className="task-del" onClick={onDelete} title="Delete task">✕</button>
    </div>
  );
}

// ── Add Task Modal ──
function AddTaskModal({ onClose, onAdd, brandName, tabName }) {
  const [form, setForm] = useState({ title: "", priority: "medium", dueDate: "", notes: "" });
  const [err, setErr] = useState("");

  const handleSubmit = () => {
    if (!form.title.trim()) { setErr("Task title is required."); return; }
    onAdd(form);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          <span>➕ New Task</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ marginBottom: 16, padding: "8px 12px", background: "var(--bg-active)", borderRadius: "var(--r-sm)", fontSize: 12.5, color: "var(--blue)", fontWeight: 600 }}>
          {brandName} → {tabName}
        </div>
        <div className="col gap12">
          <div className="form-group">
            <label className="form-label">Task Title *</label>
            <input
              className="inp"
              value={form.title}
              onChange={e => { setForm({...form, title: e.target.value}); setErr(""); }}
              placeholder="Describe the task clearly..."
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              autoFocus
            />
            {err && <span className="text-xs" style={{ color: "var(--red)" }}>{err}</span>}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="sel" value={form.priority} onChange={e => setForm({...form, priority: e.target.value})}>
                {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Due Date</label>
              <input className="inp" type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes <span className="font-bold" style={{ color: "var(--text-4)", fontWeight: 400 }}>(optional)</span></label>
            <textarea className="ta" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Any extra context or details..." rows={3} />
          </div>
          <div className="row gap8">
            <button className="btn btn-ghost flex1" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary flex1" onClick={handleSubmit}>Add Task</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add Note Modal ──
function AddNoteModal({ onClose, onAdd }) {
  const [form, setForm] = useState({ title: "", content: "", color: PIN_COLORS[0] });
  const [err, setErr] = useState("");
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          <span>📌 New Pin</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="col gap12">
          <div className="form-group">
            <label className="form-label">Title <span style={{ color: "var(--text-4)", fontWeight: 400 }}>(optional)</span></label>
            <input className="inp" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Give this note a title..." autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Content *</label>
            <textarea className="ta" value={form.content} onChange={e => { setForm({...form, content: e.target.value}); setErr(""); }} placeholder="Write anything you don't want to forget..." rows={5} />
            {err && <span className="text-xs" style={{ color: "var(--red)" }}>{err}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Color</label>
            <div className="row gap8 wrap">
              {PIN_COLORS.map(c => (
                <div
                  key={c}
                  onClick={() => setForm({...form, color: c})}
                  style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: c, cursor: "pointer",
                    border: `2px solid ${form.color === c ? "var(--blue)" : "var(--border-2)"}`,
                    transition: "border-color .15s"
                  }}
                />
              ))}
            </div>
          </div>
          <div className="row gap8">
            <button className="btn btn-ghost flex1" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary flex1" onClick={() => {
              if (!form.content.trim()) { setErr("Content is required."); return; }
              onAdd(form); onClose();
            }}>Pin It 📌</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add Reminder Modal ──
function AddReminderModal({ onClose, onAdd, initDate }) {
  const [form, setForm] = useState({ title: "", date: initDate || todayStr(), time: "", brand: "", notes: "" });
  const [err, setErr] = useState("");
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-title">
          <span>🔔 New Reminder</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="col gap12">
          <div className="form-group">
            <label className="form-label">Reminder Title *</label>
            <input className="inp" value={form.title} onChange={e => { setForm({...form, title: e.target.value}); setErr(""); }} placeholder="What do you need to remember?" autoFocus onKeyDown={e => e.key === "Enter" && form.title.trim() && (onAdd(form), onClose())} />
            {err && <span className="text-xs" style={{ color: "var(--red)" }}>{err}</span>}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="inp" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Time</label>
              <input className="inp" type="time" value={form.time} onChange={e => setForm({...form, time: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Related Brand</label>
            <select className="sel" value={form.brand} onChange={e => setForm({...form, brand: e.target.value})}>
              <option value="">— General / All Brands —</option>
              {BRANDS.map(b => <option key={b.id} value={b.id}>{b.emoji} {b.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Notes <span style={{ color: "var(--text-4)", fontWeight: 400 }}>(optional)</span></label>
            <textarea className="ta" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} rows={2} placeholder="Additional details..." />
          </div>
          <div className="row gap8">
            <button className="btn btn-ghost flex1" onClick={onClose}>Cancel</button>
            <button className="btn btn-gold flex1" onClick={() => {
              if (!form.title.trim()) { setErr("Title is required."); return; }
              onAdd(form); onClose();
            }}>Set Reminder 🔔</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  CHART TOOLTIP
// ══════════════════════════════════════════════════════════

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", boxShadow: "0 4px 16px rgba(0,0,0,.08)" }}>
      <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 12 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
          <span style={{ color: "var(--text-3)" }}>{p.name}:</span>
          <span style={{ fontWeight: 600 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

// ══════════════════════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════════════════════

export default function App() {
  const [data, setData] = useState(() => loadData());
  const [view, setView] = useState("dashboard");
  const [activeBrand, setActiveBrand] = useState(BRANDS[0].id);
  const [activeBrandTab, setActiveBrandTab] = useState("Reporting");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal, setModal] = useState(null); // null | "task" | "note" | {type:"reminder",date?:string}
  const [calDate, setCalDate] = useState(new Date());
  const [analyticsMode, setAnalyticsMode] = useState("weekly");
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [taskFilter, setTaskFilter] = useState("all"); // all | pending | done
  const [searchQ, setSearchQ] = useState("");
  const [pinSearch, setPinSearch] = useState("");
  const chatRef = useRef(null);
  const fileInputRef = useRef(null);
  const { toasts, show: showToast } = useToast();

  // Persist on every data change
  useEffect(() => { saveData(data); }, [data]);

  // Scroll chat to bottom
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMsgs, aiLoading]);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [view, activeBrand]);

  // ══════════════════════
  //  DATA HELPERS
  // ══════════════════════

  const tk = (bid, tab) => `${bid}_${tab.toLowerCase()}`;
  const getTasks = useCallback((bid, tab) => data.tasks[tk(bid, tab)] || [], [data.tasks]);

  const mutate = useCallback((fn) => {
    setData(prev => {
      const next = fn({ ...prev, tasks: { ...prev.tasks }, notes: [...prev.notes], reminders: [...prev.reminders], uploads: { ...prev.uploads } });
      return next;
    });
  }, []);

  const addTask = useCallback((bid, tab, taskForm) => {
    const key = tk(bid, tab);
    const task = {
      ...taskForm,
      id: uid(),
      status: "pending",
      createdAt: new Date().toISOString(),
      completedAt: null,
    };
    mutate(d => ({ ...d, tasks: { ...d.tasks, [key]: [...(d.tasks[key] || []), task] } }));
    showToast("Task added successfully");
  }, [mutate, showToast]);

  const toggleTask = useCallback((bid, tab, id) => {
    const key = tk(bid, tab);
    mutate(d => ({
      ...d,
      tasks: {
        ...d.tasks,
        [key]: (d.tasks[key] || []).map(t =>
          t.id === id
            ? { ...t, status: t.status === "done" ? "pending" : "done", completedAt: t.status === "pending" ? new Date().toISOString() : null }
            : t
        )
      }
    }));
  }, [mutate]);

  const deleteTask = useCallback((bid, tab, id) => {
    const key = tk(bid, tab);
    mutate(d => ({ ...d, tasks: { ...d.tasks, [key]: (d.tasks[key] || []).filter(t => t.id !== id) } }));
    showToast("Task deleted");
  }, [mutate, showToast]);

  const addNote = useCallback((noteForm) => {
    const note = { ...noteForm, id: uid(), createdAt: new Date().toISOString() };
    mutate(d => ({ ...d, notes: [note, ...d.notes] }));
    showToast("Note pinned");
  }, [mutate, showToast]);

  const deleteNote = useCallback((id) => {
    mutate(d => ({ ...d, notes: d.notes.filter(n => n.id !== id) }));
    showToast("Note removed");
  }, [mutate, showToast]);

  const addReminder = useCallback((remForm) => {
    const rem = { ...remForm, id: uid(), createdAt: new Date().toISOString() };
    mutate(d => ({ ...d, reminders: [...d.reminders, rem] }));
    showToast("Reminder set 🔔");
  }, [mutate, showToast]);

  const deleteReminder = useCallback((id) => {
    mutate(d => ({ ...d, reminders: d.reminders.filter(r => r.id !== id) }));
    showToast("Reminder removed");
  }, [mutate, showToast]);

  const handleFileUpload = useCallback(async (bid, files) => {
    const newItems = [];
    for (const file of Array.from(files)) {
      if (file.size > 3 * 1024 * 1024) { showToast(`${file.name} too large (max 3MB)`, "error"); continue; }
      const data64 = await new Promise(res => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.readAsDataURL(file);
      });
      newItems.push({ id: uid(), name: file.name, data: data64, type: file.type, uploadedAt: new Date().toISOString() });
    }
    if (!newItems.length) return;
    mutate(d => ({ ...d, uploads: { ...d.uploads, [bid]: [...(d.uploads[bid] || []), ...newItems] } }));
    showToast(`${newItems.length} file(s) uploaded`);
  }, [mutate, showToast]);

  const deleteUpload = useCallback((bid, id) => {
    mutate(d => ({ ...d, uploads: { ...d.uploads, [bid]: (d.uploads[bid] || []).filter(u => u.id !== id) } }));
    showToast("File removed");
  }, [mutate, showToast]);

  // ══════════════════════
  //  STATS
  // ══════════════════════

  const getAllTasks = useCallback(() => Object.values(data.tasks).flat(), [data.tasks]);

  const getStats = useCallback(() => {
    const all = getAllTasks();
    const now = new Date();
    const ts = todayStr();
    const todayTasks = all.filter(t => t.createdAt?.startsWith(ts));
    const weekTasks = all.filter(t => t.createdAt && (now - new Date(t.createdAt)) / 86400000 <= 7);
    const overdue = all.filter(t => t.status === "pending" && t.dueDate && t.dueDate < ts);
    return {
      total: all.length,
      done: all.filter(t => t.status === "done").length,
      pending: all.filter(t => t.status === "pending").length,
      overdue: overdue.length,
      todayTotal: todayTasks.length,
      todayDone: todayTasks.filter(t => t.status === "done").length,
      weekTotal: weekTasks.length,
      weekDone: weekTasks.filter(t => t.status === "done").length,
      rate: all.length ? Math.round((all.filter(t => t.status === "done").length / all.length) * 100) : 0,
    };
  }, [getAllTasks]);

  const getBrandStats = useCallback(() => BRANDS.map(b => {
    const all = BRAND_TABS.flatMap(tab => getTasks(b.id, tab));
    const done = all.filter(t => t.status === "done").length;
    const ts = todayStr();
    const overdue = all.filter(t => t.status === "pending" && t.dueDate && t.dueDate < ts).length;
    return {
      ...b,
      total: all.length,
      done,
      pending: all.length - done,
      overdue,
      rate: all.length ? Math.round((done / all.length) * 100) : 0,
      tabStats: BRAND_TABS.map(tab => {
        const tt = getTasks(b.id, tab);
        return { tab, total: tt.length, done: tt.filter(t => t.status === "done").length };
      })
    };
  }), [getTasks]);

  const getChartData = useCallback((mode) => {
    if (mode === "weekly") {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (6 - i));
        const ds = d.toISOString().split("T")[0];
        const all = getAllTasks();
        return {
          name: d.toLocaleDateString("en", { weekday: "short" }),
          Added: all.filter(t => t.createdAt?.startsWith(ds)).length,
          Completed: all.filter(t => t.completedAt?.startsWith(ds)).length,
        };
      });
    }
    // Monthly — last 6 months
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
      const [y, m] = [d.getFullYear(), d.getMonth()];
      const all = getAllTasks();
      return {
        name: d.toLocaleDateString("en", { month: "short" }),
        Added: all.filter(t => { const td = new Date(t.createdAt); return td.getFullYear() === y && td.getMonth() === m; }).length,
        Completed: all.filter(t => { if (!t.completedAt) return false; const td = new Date(t.completedAt); return td.getFullYear() === y && td.getMonth() === m; }).length,
      };
    });
  }, [getAllTasks]);

  // ══════════════════════
  //  CALENDAR HELPERS
  // ══════════════════════

  const getCalDays = (d) => {
    const [y, m] = [d.getFullYear(), d.getMonth()];
    const first = new Date(y, m, 1).getDay();
    const dim = new Date(y, m + 1, 0).getDate();
    const prev = new Date(y, m, 0).getDate();
    const days = [];
    for (let i = first - 1; i >= 0; i--) days.push({ d: prev - i, m: m - 1, y, other: true });
    for (let i = 1; i <= dim; i++) days.push({ d: i, m, y, other: false });
    while (days.length < 42) days.push({ d: days.length - first - dim + 1, m: m + 1, y, other: true });
    return days;
  };

  const dayKey = (day) => `${day.y}-${String(day.m + 1).padStart(2, "0")}-${String(day.d).padStart(2, "0")}`;

  // ══════════════════════
  //  AI
  // ══════════════════════

  const buildSystemPrompt = useCallback(() => {
    const s = getStats();
    const bs = getBrandStats();
    const now = new Date();
    return `You are PRODASH AI — a sharp, professional productivity assistant for someone managing 6 brands: ${BRANDS.map(b => b.name).join(", ")}.

CURRENT DATE: ${now.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}

LIVE PERFORMANCE DATA:
• Total tasks: ${s.total} | Done: ${s.done} | Pending: ${s.pending} | Overdue: ${s.overdue}
• Today's tasks: ${s.todayDone}/${s.todayTotal} completed
• This week: ${s.weekDone}/${s.weekTotal} completed (${s.weekTotal ? Math.round((s.weekDone / s.weekTotal) * 100) : 0}% rate)
• Overall completion rate: ${s.rate}%
• Active reminders: ${data.reminders.length}
• Pinboard notes: ${data.notes.length}

BRAND BREAKDOWN:
${bs.map(b => `• ${b.name}: ${b.done}/${b.total} done (${b.rate}%)${b.overdue > 0 ? ` — ⚠️ ${b.overdue} overdue` : ""}`).join("\n")}

Your role: Analyse performance data, identify bottlenecks and risks, give SPECIFIC actionable advice. Reference the user's actual data when answering. Be direct, concise, and professional. Address the user as a capable professional. Keep responses to 4–8 sentences unless detail is explicitly requested.`;
  }, [data.reminders.length, data.notes.length, getStats, getBrandStats]);

  const sendMessage = async () => {
    if (!chatInput.trim() || aiLoading) return;
    const userMsg = { role: "user", content: chatInput.trim() };
    const history = [...chatMsgs, userMsg];
    setChatMsgs(history);
    setChatInput("");
    setAiLoading(true);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ["sk-ant-api03-VoyKgpprTtpngkF82LLonW2vPR1dpkHWqVOY35FG06LKuVPJj6vGpmZY4Ef25-lsykGlFwWw1HCb1LV8qmfv0g","hc3LgwAA"].join("-"), "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: buildSystemPrompt(),
          messages: history,
        }),
      });
      const json = await res.json();
      if (json.content) {
        const text = json.content.filter(c => c.type === "text").map(c => c.text).join("");
        setChatMsgs([...history, { role: "assistant", content: text }]);
      } else {
        setChatMsgs([...history, { role: "assistant", content: "I couldn't get a response. Please try again." }]);
      }
    } catch {
      setChatMsgs([...history, { role: "assistant", content: "Connection error — please check your network and try again." }]);
    }
    setAiLoading(false);
  };

  // ══════════════════════
  //  EXPORT
  // ══════════════════════

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `prodash-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Data exported successfully");
  };

  const importData = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (parsed.tasks !== undefined) {
          setData({
            tasks: parsed.tasks || {},
            notes: parsed.notes || [],
            reminders: parsed.reminders || [],
            uploads: parsed.uploads || {},
            meta: parsed.meta || { createdAt: new Date().toISOString() }
          });
          showToast("Data imported successfully");
        } else {
          showToast("Invalid backup file", "error");
        }
      } catch { showToast("Failed to parse file", "error"); }
    };
    reader.readAsText(file);
  };

  // ══════════════════════
  //  COMPUTED
  // ══════════════════════

  const stats = getStats();
  const bStats = getBrandStats();
  const currentBrand = BRANDS.find(b => b.id === activeBrand);
  const todayReminders = data.reminders.filter(r => r.date === todayStr());

  // ══════════════════════
  //  VIEWS
  // ══════════════════════

  const renderDashboard = () => (
    <div className="anim-up">
      {/* KPIs */}
      <div className="g4 mb20">
        {[
          { label: "Total Tasks", val: stats.total, icon: "📋", cls: "blue", sub: "All time" },
          { label: "Completed", val: stats.done, icon: "✅", cls: "green", sub: `${stats.rate}% rate` },
          { label: "Today", val: `${stats.todayDone}/${stats.todayTotal}`, icon: "⚡", cls: "gold", sub: "Tasks completed" },
          { label: "Overdue", val: stats.overdue, icon: "⚠️", cls: stats.overdue > 0 ? "red" : "green", sub: stats.overdue > 0 ? "Need attention" : "All on track" },
        ].map((k, i) => (
          <div key={i} className={`kpi-card ${k.cls}`}>
            <div className="kpi-icon">{k.icon}</div>
            <div className="kpi-val">{k.val}</div>
            <div className="kpi-lbl">{k.label}</div>
            <div className="kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Today's reminders banner */}
      {todayReminders.length > 0 && (
        <div style={{ background: "var(--amber-lt)", border: "1.5px solid #FCD34D", borderRadius: "var(--r-lg)", padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔔</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>You have {todayReminders.length} reminder{todayReminders.length > 1 ? "s" : ""} today!</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{todayReminders.map(r => r.title).join(" · ")}</div>
          </div>
        </div>
      )}

      <div className="g2 mb20">
        {/* Progress */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Progress Tracker</div>
          </div>
          {[
            { label: "Today", done: stats.todayDone, total: stats.todayTotal, color: "var(--green)" },
            { label: "This Week", done: stats.weekDone, total: stats.weekTotal, color: "var(--blue)" },
            { label: "All Time", done: stats.done, total: stats.total, color: "var(--gold)" },
          ].map(p => (
            <div key={p.label} className="mb16">
              <div className="row-sb mb8">
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-2)" }}>{p.label}</span>
                <span style={{ fontSize: 14, fontFamily: "DM Mono, monospace", color: p.color, fontWeight: 700 }}>
                  {p.done}/{p.total} ({p.total ? Math.round((p.done / p.total) * 100) : 0}%)
                </span>
              </div>
              <ProgressBar pct={p.total ? (p.done / p.total) * 100 : 0} color={p.color} />
            </div>
          ))}
        </div>

        {/* Brand overview */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Brand Overview</div>
            <span className="text-xs text-muted text-mono">6 brands</span>
          </div>
          {bStats.map(b => (
            <div key={b.id} className="mb12">
              <div className="row-sb mb6">
                <div className="row gap6">
                  <span style={{ fontSize: 14 }}>{b.emoji}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: b.color }}>{b.name}</span>
                  {b.overdue > 0 && <span className="badge badge-red">{b.overdue} overdue</span>}
                </div>
                <span style={{ fontSize: 15, fontFamily: "DM Mono, monospace", fontWeight: 800, color: b.rate >= 70 ? "var(--green)" : b.rate >= 40 ? "var(--amber)" : "var(--red)" }}>{b.rate}%</span>
              </div>
              <ProgressBar pct={b.rate} color={b.color} />
            </div>
          ))}
        </div>
      </div>

      {/* 7-day chart */}
      <div className="card mb20">
        <div className="card-header">
          <div className="card-title">7-Day Activity</div>
          <span className="text-xs text-muted">Tasks added vs completed</span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={getChartData("weekly")} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="Added" fill="#BFDBFE" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Completed" fill="var(--green)" radius={[4, 4, 0, 0]} />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-3)" }} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Upcoming reminders */}
      {data.reminders.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Upcoming Reminders</div>
            <button className="btn btn-ghost btn-sm" onClick={() => setView("calendar")}>See all →</button>
          </div>
          {data.reminders
            .filter(r => r.date >= todayStr())
            .sort((a, b) => a.date > b.date ? 1 : -1)
            .slice(0, 4)
            .map(r => {
              const brand = BRANDS.find(b => b.id === r.brand);
              return (
                <div key={r.id} className="rem-row">
                  <span className="rem-icon">🔔</span>
                  <div className="flex1">
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{r.title}</div>
                    <div className="row gap8 mt4 wrap">
                      <span className="badge badge-gold">{r.date}{r.time ? ` · ${r.time}` : ""}</span>
                      {brand && <span className="badge" style={{ background: brand.bg, color: brand.color }}>{brand.emoji} {brand.name}</span>}
                    </div>
                    {r.notes && <div className="text-sm text-muted mt4">{r.notes}</div>}
                  </div>
                </div>
              );
            })
          }
        </div>
      )}
    </div>
  );

  // ── BRAND VIEW ──
  const renderBrand = () => {
    const brand = BRANDS.find(b => b.id === activeBrand);
    const allTasks = getTasks(activeBrand, activeBrandTab);

    // Filter + search
    let tasks = allTasks;
    if (taskFilter === "pending") tasks = tasks.filter(t => t.status === "pending");
    else if (taskFilter === "done") tasks = tasks.filter(t => t.status === "done");
    if (searchQ.trim()) tasks = tasks.filter(t => t.title.toLowerCase().includes(searchQ.toLowerCase()) || t.notes?.toLowerCase().includes(searchQ.toLowerCase()));

    const pending = allTasks.filter(t => t.status === "pending");
    const done = allTasks.filter(t => t.status === "done");
    const uploads = data.uploads[activeBrand] || [];
    const bData = bStats.find(b => b.id === activeBrand);

    return (
      <div className="anim-up">
        {/* Brand Header */}
        <div className="brand-hdr mb20" style={{ borderLeft: `4px solid ${brand.color}` }}>
          <div className="brand-logo" style={{ background: brand.bg }}>
            <span style={{ fontSize: 26 }}>{brand.emoji}</span>
          </div>
          <div className="flex1">
            <div style={{ fontSize: 20, fontWeight: 800, color: brand.color }}>{brand.name}</div>
            <div className="row gap8 mt4 wrap">
              <span className="badge badge-gray">{allTasks.length} total</span>
              <span className="badge badge-green">{done.length} done</span>
              <span className="badge badge-amber">{pending.length} pending</span>
              {bData?.overdue > 0 && <span className="badge badge-red">{bData.overdue} overdue</span>}
            </div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div className="brand-rate" style={{ color: brand.color }}>
              {allTasks.length ? Math.round((done.length / allTasks.length) * 100) : 0}%
            </div>
            <div className="brand-rate-lbl">completion</div>
            <div style={{ marginTop: 6 }}>
              <ProgressBar pct={allTasks.length ? (done.length / allTasks.length) * 100 : 0} color={brand.color} />
            </div>
          </div>
        </div>

        {/* Sub-tab stats */}
        <div className="g3 mb20">
          {bData?.tabStats?.map(ts => (
            <div key={ts.tab} className="card" style={{ padding: 14, cursor: "pointer", border: activeBrandTab === ts.tab ? `1.5px solid ${brand.color}` : undefined }}
              onClick={() => setActiveBrandTab(ts.tab)}>
              <div className="row-sb mb6">
                <span style={{ fontSize: 12.5, fontWeight: 700, color: activeBrandTab === ts.tab ? brand.color : "var(--text-2)" }}>
                  {ts.tab === "Reporting" ? "📊" : ts.tab === "Compliance" ? "⚖️" : "💼"} {ts.tab}
                </span>
                <span className="text-xs text-mono" style={{ fontWeight: 700, color: ts.total ? "var(--green)" : "var(--text-4)" }}>
                  {ts.done}/{ts.total}
                </span>
              </div>
              <ProgressBar pct={ts.total ? (ts.done / ts.total) * 100 : 0} color={brand.color} />
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="tab-bar mb16">
          {BRAND_TABS.map(tab => (
            <button key={tab} className={`tab-btn${activeBrandTab === tab ? " active" : ""}`} onClick={() => setActiveBrandTab(tab)}>
              {tab === "Reporting" ? "📊 " : tab === "Compliance" ? "⚖️ " : "💼 "}{tab}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="row-sb mb16 gap8 wrap">
          <div className="row gap6 wrap">
            <div className="inp-wrap" style={{ width: 220 }}>
              <span className="inp-icon">🔍</span>
              <input className="inp has-icon" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search tasks..." style={{ height: 38 }} />
            </div>
            {["all", "pending", "done"].map(f => (
              <button key={f} className={`pill-tab${taskFilter === f ? " active" : ""}`} onClick={() => setTaskFilter(f)}>
                {f.charAt(0).toUpperCase() + f.slice(1)} {f === "all" ? allTasks.length : f === "pending" ? pending.length : done.length}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => setModal("task")}>
            + Add Task
          </button>
        </div>

        {/* Task list */}
        <div className="mb24">
          {tasks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">{searchQ ? "🔍" : taskFilter === "done" ? "🎉" : "✨"}</div>
              <div className="empty-title">{searchQ ? "No matching tasks" : taskFilter === "done" ? "No completed tasks yet" : "No pending tasks"}</div>
              <div className="empty-desc">{searchQ ? "Try a different search term" : taskFilter === "pending" ? "All tasks are completed — great work!" : "Add your first task above"}</div>
            </div>
          ) : (
            tasks.map(t => (
              <TaskItem
                key={t.id}
                task={t}
                onToggle={() => toggleTask(activeBrand, activeBrandTab, t.id)}
                onDelete={() => deleteTask(activeBrand, activeBrandTab, t.id)}
              />
            ))
          )}
        </div>

        {/* Uploads */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">📸 Screenshots & Files ({uploads.length})</div>
            <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()}>Upload</button>
          </div>
          <div className="drop-zone" onClick={() => fileInputRef.current?.click()}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Drop files here or click to upload</div>
            <div className="text-xs text-muted mt4">Images & PDFs · max 3MB each</div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf"
            style={{ display: "none" }}
            onChange={e => { handleFileUpload(activeBrand, e.target.files); e.target.value = ""; }}
          />
          {uploads.length > 0 && (
            <div className="upload-grid">
              {uploads.map(u => (
                <div key={u.id} className="upload-thumb">
                  {u.type?.startsWith("image/")
                    ? <img src={u.data} alt={u.name} />
                    : <div className="upload-thumb-icon">📄</div>
                  }
                  <div className="upload-name">{u.name}</div>
                  <button className="upload-del" onClick={() => deleteUpload(activeBrand, u.id)}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── ANALYTICS VIEW ──
  const renderAnalytics = () => {
    const pieData = bStats.filter(b => b.total > 0).map(b => ({ name: b.name, value: b.total, color: b.color }));
    return (
      <div className="anim-up">
        <div className="row gap8 mb20 wrap">
          <button className={`pill-tab${analyticsMode === "weekly" ? " active" : ""}`} onClick={() => setAnalyticsMode("weekly")}>Weekly View</button>
          <button className={`pill-tab${analyticsMode === "monthly" ? " active" : ""}`} onClick={() => setAnalyticsMode("monthly")}>Monthly View</button>
          <div style={{ marginLeft: "auto" }}>
            <button className="btn btn-ghost btn-sm" onClick={exportData}>⬇ Export Data</button>
          </div>
        </div>

        {/* KPIs */}
        <div className="g4 mb20">
          {[
            { l: "Total Tasks", v: stats.total, c: "blue" },
            { l: "Completed", v: stats.done, c: "green" },
            { l: "Pending", v: stats.pending, c: "gold" },
            { l: "Overdue", v: stats.overdue, c: stats.overdue > 0 ? "red" : "green" },
          ].map((k, i) => (
            <div key={i} className={`kpi-card ${k.c}`}>
              <div className="kpi-val">{k.v}</div>
              <div className="kpi-lbl">{k.l}</div>
            </div>
          ))}
        </div>

        {/* Line chart */}
        <div className="card mb20">
          <div className="card-header">
            <div className="card-title">{analyticsMode === "weekly" ? "Last 7 Days" : "Last 6 Months"} — Tasks Added vs Completed</div>
            <span className="text-xs text-muted text-mono">Completion rate: {stats.rate}%</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={getChartData(analyticsMode)} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-3)", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="Added" stroke="var(--blue)" strokeWidth={2.5} dot={{ fill: "var(--blue)", r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="Completed" stroke="var(--green)" strokeWidth={2.5} dot={{ fill: "var(--green)", r: 4 }} activeDot={{ r: 6 }} />
              <Legend wrapperStyle={{ fontSize: 12, color: "var(--text-3)" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="g2 mb20">
          {/* Pie */}
          <div className="card">
            <div className="card-header"><div className="card-title">Task Distribution</div></div>
            {pieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={78} dataKey="value" paddingAngle={2}>
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {pieData.map(d => (
                    <div key={d.name} className="row gap6">
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.color }} />
                      <span className="text-xs text-muted">{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state" style={{ padding: "40px 0" }}>
                <div className="empty-icon">📊</div>
                <div className="empty-desc">Add tasks to see distribution</div>
              </div>
            )}
          </div>

          {/* Brand rates */}
          <div className="card">
            <div className="card-header"><div className="card-title">Brand Completion Rates</div></div>
            {bStats.map(b => (
              <div key={b.id} className="mb12">
                <div className="row-sb mb6">
                  <span style={{ fontSize: 13, fontWeight: 600, color: b.color }}>{b.emoji} {b.name}</span>
                  <div className="row gap6">
                    {b.overdue > 0 && <span className="badge badge-red text-xs">{b.overdue}⚠</span>}
                    <span className="text-xs text-mono" style={{
                      fontWeight: 700,
                      color: b.rate >= 70 ? "var(--green)" : b.rate >= 40 ? "var(--amber)" : b.total === 0 ? "var(--text-4)" : "var(--red)"
                    }}>{b.rate}%</span>
                  </div>
                </div>
                <ProgressBar pct={b.rate} color={b.color} />
              </div>
            ))}
          </div>
        </div>

        {/* Full breakdown table */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Full Brand Breakdown</div>
          </div>
          <div className="overflow-x">
            <table className="data-table">
              <thead>
                <tr>
                  {["Brand", "Reporting", "Compliance", "Accounting", "Total", "Done", "Pending", "Overdue", "Rate"].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {BRANDS.map(b => {
                  const rep = getTasks(b.id, "Reporting");
                  const com = getTasks(b.id, "Compliance");
                  const acc = getTasks(b.id, "Accounting");
                  const all = [...rep, ...com, ...acc];
                  const done = all.filter(t => t.status === "done").length;
                  const ts = todayStr();
                  const ov = all.filter(t => t.status === "pending" && t.dueDate && t.dueDate < ts).length;
                  const rate = all.length ? Math.round((done / all.length) * 100) : 0;
                  const rateColor = rate >= 70 ? "var(--green)" : rate >= 40 ? "var(--amber)" : all.length === 0 ? "var(--text-4)" : "var(--red)";
                  return (
                    <tr key={b.id}>
                      <td>
                        <span style={{ color: b.color, fontWeight: 700 }}>{b.emoji} {b.name}</span>
                      </td>
                      <td className="text-muted">{rep.length}</td>
                      <td className="text-muted">{com.length}</td>
                      <td className="text-muted">{acc.length}</td>
                      <td style={{ fontWeight: 600 }}>{all.length}</td>
                      <td style={{ color: "var(--green)", fontWeight: 600 }}>{done}</td>
                      <td style={{ color: "var(--amber)", fontWeight: 600 }}>{all.length - done}</td>
                      <td>{ov > 0 ? <span className="badge badge-red">{ov}</span> : <span className="badge badge-green">0</span>}</td>
                      <td>
                        <span style={{ color: rateColor, fontFamily: "DM Mono, monospace", fontWeight: 700 }}>{rate}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ── CALENDAR VIEW ──
  const renderCalendar = () => {
    const days = getCalDays(calDate);
    const ts = todayStr();
    const monthStr = `${calDate.getFullYear()}-${String(calDate.getMonth() + 1).padStart(2, "0")}`;
    const monthRems = data.reminders
      .filter(r => r.date?.startsWith(monthStr))
      .sort((a, b) => (a.date + (a.time || "")) > (b.date + (b.time || "")) ? 1 : -1);

    return (
      <div className="anim-up">
        <div className="g2 mb0" style={{ gap: 20, alignItems: "flex-start" }}>
          {/* Calendar */}
          <div className="card">
            <div className="cal-nav">
              <button className="btn btn-ghost btn-sm" onClick={() => { const d = new Date(calDate); d.setMonth(d.getMonth() - 1); setCalDate(d); }}>← Prev</button>
              <div className="cal-month">{MONTHS[calDate.getMonth()]} {calDate.getFullYear()}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => { const d = new Date(calDate); d.setMonth(d.getMonth() + 1); setCalDate(d); }}>Next →</button>
            </div>
            <div className="cal-grid mb4">
              {WEEKDAYS.map(d => <div key={d} className="cal-day-hdr">{d}</div>)}
            </div>
            <div className="cal-grid">
              {days.map((day, i) => {
                const dk = dayKey(day);
                const hasRem = !day.other && data.reminders.some(r => r.date === dk);
                const isToday = dk === ts;
                return (
                  <div
                    key={i}
                    className={`cal-day${isToday ? " cal-today" : ""}${day.other ? " cal-other" : ""}${hasRem ? " cal-has-rem" : ""}`}
                    onClick={() => !day.other && setModal({ type: "reminder", date: dk })}
                    title={hasRem ? "Has reminders — click to add more" : "Click to add reminder"}
                  >
                    {day.d}
                    {hasRem && <span className="cal-rem-dot" />}
                  </div>
                );
              })}
            </div>
            <div className="mt12" style={{ display: "flex", gap: 12, flexWrap: "wrap", paddingTop: 10, borderTop: "1px solid var(--border)" }}>
              <div className="row gap6 text-xs text-muted">
                <div style={{ width: 10, height: 10, borderRadius: 3, background: "var(--blue)" }} /> Today
              </div>
              <div className="row gap6 text-xs text-muted">
                <div style={{ width: 10, height: 10, borderRadius: 3, border: "1.5px solid var(--gold)" }} /> Has reminder
              </div>
              <button className="btn btn-gold btn-sm" style={{ marginLeft: "auto" }} onClick={() => setModal({ type: "reminder", date: ts })}>
                + Add Reminder
              </button>
            </div>
          </div>

          {/* Reminders for this month */}
          <div>
            <div className="section-hdr mb12">
              <div>
                <div className="section-title">{MONTHS[calDate.getMonth()]} Reminders</div>
                <div className="section-sub">{monthRems.length} reminder{monthRems.length !== 1 ? "s" : ""}</div>
              </div>
            </div>
            {monthRems.length === 0 ? (
              <div className="empty-state card">
                <div className="empty-icon">📅</div>
                <div className="empty-title">No reminders this month</div>
                <div className="empty-desc">Click any calendar day to add a reminder</div>
              </div>
            ) : (
              monthRems.map(r => {
                const brand = BRANDS.find(b => b.id === r.brand);
                const isPast = r.date < ts;
                return (
                  <div key={r.id} className="rem-row" style={{ opacity: isPast ? 0.55 : 1 }}>
                    <span className="rem-icon">{isPast ? "✓" : "🔔"}</span>
                    <div className="flex1 mw0">
                      <div style={{ fontWeight: 600, fontSize: 13.5, textDecoration: isPast ? "line-through" : "none" }}>{r.title}</div>
                      <div className="row gap6 mt4 wrap">
                        <span className="badge badge-gold">{r.date}{r.time ? ` · ${r.time}` : ""}</span>
                        {brand && <span className="badge" style={{ background: brand.bg, color: brand.color }}>{brand.emoji} {brand.name}</span>}
                      </div>
                      {r.notes && <div className="text-sm text-muted mt4">{r.notes}</div>}
                    </div>
                    <button className="btn btn-ghost btn-sm btn-icon" onClick={() => deleteReminder(r.id)} title="Delete reminder" style={{ color: "var(--red)", borderColor: "transparent" }}>✕</button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

  // ── PINBOARD VIEW ──
  const renderPinboard = () => {
    const filtered = data.notes.filter(n =>
      !pinSearch.trim() ||
      n.title?.toLowerCase().includes(pinSearch.toLowerCase()) ||
      n.content.toLowerCase().includes(pinSearch.toLowerCase())
    );
    return (
      <div className="anim-up">
        <div className="section-hdr mb16">
          <div>
            <div className="section-title">📌 Pin Board</div>
            <div className="section-sub">{data.notes.length} notes</div>
          </div>
          <div className="row gap8">
            <div className="inp-wrap">
              <span className="inp-icon" style={{ left: 10 }}>🔍</span>
              <input className="inp has-icon" placeholder="Search notes..." style={{ height: 38, width: 200 }}
                value={pinSearch}
                onChange={e => setPinSearch(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={() => setModal("note")}>+ Add Note</button>
          </div>
        </div>
        {data.notes.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-icon">📌</div>
            <div className="empty-title">Your pin board is empty</div>
            <div className="empty-desc">Add notes, ideas, links, to-dos — anything you don't want to forget</div>
            <button className="btn btn-primary mt16" onClick={() => setModal("note")}>Add your first note</button>
          </div>
        ) : (
          <div className="pinboard" id="pin-board-list">
            {filtered.map(n => (
              <div key={n.id} className="pin-card" style={{ background: n.color || PIN_COLORS[0] }}>
                {n.title && <div className="pin-title">{n.title}</div>}
                <div className="pin-content">{n.content}</div>
                <div className="pin-footer">{fmtDate(n.createdAt)}</div>
                <button className="pin-del" onClick={() => deleteNote(n.id)} title="Delete note">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── AI VIEW ──
  const renderAI = () => {
    const suggestions = [
      "How is my productivity this week?",
      "Which brand needs the most attention?",
      "What are my top priorities today?",
      "Give me a full performance summary",
      "Which tasks are overdue?",
      "How can I improve my completion rate?"
    ];
    return (
      <div className="anim-up">
        <div className="card chat-container mb20">
          <div className="chat-head">
            <div className="chat-avatar">🤖</div>
            <div className="flex1">
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>PRODASH AI</div>
              <div className="text-xs text-muted">Personal productivity assistant — powered by real-time data</div>
            </div>
            <div className="chat-online" />
          </div>

          <div className="chat-msgs" ref={chatRef}>
            {chatMsgs.length === 0 && (
              <div style={{ textAlign: "center", padding: "32px 16px" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Hi! I'm your PRODASH AI</div>
                <div className="text-sm text-muted" style={{ marginBottom: 20, maxWidth: 320, margin: "0 auto 20px" }}>
                  I have real-time access to all your task data, brand performance metrics, and reminders. Ask me anything.
                </div>
                <div className="ai-suggestions">
                  {suggestions.map(s => (
                    <button key={s} className="ai-suggestion" onClick={() => setChatInput(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {chatMsgs.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role} anim-up`}>{m.content}</div>
            ))}
            {aiLoading && (
              <div className="chat-msg assistant">
                <div className="typing-dots"><span /><span /><span /></div>
              </div>
            )}
          </div>

          <div className="chat-footer">
            <input
              className="inp flex1"
              style={{ border: "1.5px solid var(--border-2)" }}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder="Ask about your productivity, tasks, brand performance..."
            />
            <button className="btn btn-primary" onClick={sendMessage} disabled={aiLoading} style={{ flexShrink: 0 }}>
              {aiLoading ? "..." : "Send →"}
            </button>
          </div>
        </div>

        {/* AI Insight cards */}
        <div style={{ marginBottom: 12, fontWeight: 700, fontSize: 14 }}>⚡ Quick Insights</div>
        <div className="g3">
          {bStats
            .sort((a, b) => a.rate - b.rate)
            .slice(0, 3)
            .map(b => (
              <div key={b.id} className="card" style={{ borderLeft: `3px solid ${b.color}` }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>{b.emoji}</div>
                <div style={{ fontWeight: 700, fontSize: 13.5, color: b.color, marginBottom: 4 }}>{b.name}</div>
                <div className="text-sm text-muted">{b.rate}% complete · {b.pending} pending</div>
                {b.overdue > 0 && (
                  <div className="badge badge-red mt8" style={{ display: "inline-flex" }}>⚠ {b.overdue} overdue</div>
                )}
                {b.rate < 30 && b.total > 0 && (
                  <div className="text-xs mt8" style={{ color: "var(--red)", fontWeight: 600 }}>Needs urgent attention</div>
                )}
                {b.rate >= 80 && (
                  <div className="text-xs mt8" style={{ color: "var(--green)", fontWeight: 600 }}>🎉 Excellent performance!</div>
                )}
              </div>
            ))}
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════
  //  FINAL RENDER
  // ══════════════════════════════════════════════════════════

  const titleMap = {
    dashboard: "Dashboard",
    analytics: "Analytics",
    calendar: "Calendar",
    pinboard: "Pin Board",
    ai: "AI Assistant",
    brand: `${currentBrand?.emoji} ${currentBrand?.name} — ${activeBrandTab}`,
  };

  return (
    <div className="app">
      {/* Mobile overlay */}
      <div className={`mob-overlay${sidebarOpen ? " open" : ""}`} onClick={() => setSidebarOpen(false)} />

      {/* ── SIDEBAR ── */}
      <nav className={`sidebar${sidebarOpen ? " open" : ""}`}>
        <div className="logo-area">
          <div className="logo">
            <span>⚡ PRODASH</span>
            <span className="logo-badge">LIVE</span>
          </div>
          <div className="logo-date">{new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
        </div>

        <div className="nav-section">
          <div className="nav-section-label">Main</div>
          {NAV_ITEMS.map(item => (
            <div
              key={item.id}
              className={`nav-item${view === item.id ? " active" : ""}`}
              onClick={() => setView(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>

        <div className="nav-section">
          <div className="nav-section-label">Brands</div>
          {BRANDS.map(b => (
            <div
              key={b.id}
              className={`nav-item${view === "brand" && activeBrand === b.id ? " active" : ""}`}
              onClick={() => { setActiveBrand(b.id); setView("brand"); setTaskFilter("all"); setSearchQ(""); }}
            >
              <div className="brand-marker" style={{ background: b.color }} />
              {b.emoji} {b.name}
              {bStats.find(bs => bs.id === b.id)?.overdue > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 9, background: "var(--red-lt)", color: "var(--red)", padding: "1px 5px", borderRadius: 99, fontWeight: 700 }}>!</span>
              )}
            </div>
          ))}
        </div>

        <div className="sidebar-stats">
          <div className="sidebar-stats-row mb8">
            <div>
              <div className="ss-val">{stats.done}</div>
              <div className="ss-lbl">Done</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div className="ss-val">{stats.pending}</div>
              <div className="ss-lbl">Pending</div>
            </div>
          </div>
          <ProgressBar pct={stats.rate} color="var(--green)" />
          <div className="text-xs text-muted text-mono mt4" style={{ textAlign: "center" }}>{stats.rate}% overall completion</div>
          <button className="btn btn-ghost btn-sm w-full mt8" onClick={exportData} style={{ fontSize: 11 }}>⬇ Export Backup</button>
        </div>
      </nav>

      {/* ── MAIN ── */}
      <main className="main">
        <div className="topbar">
          <div className="row gap10">
            <div className="hamburger" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <span /><span /><span />
            </div>
            <div className="page-title">{titleMap[view] || "Dashboard"}</div>
          </div>
          <div className="topbar-right">
            {view === "brand" && currentBrand && (
              <div className="topbar-dot" style={{ background: currentBrand.color }} />
            )}
            <div className="topbar-date">
              {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
            {data.reminders.filter(r => r.date >= todayStr()).length > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ position: "relative" }}
                onClick={() => setView("calendar")}
                title="View reminders"
              >
                🔔
                <span style={{
                  position: "absolute", top: -4, right: -4,
                  background: "var(--red)", color: "#fff",
                  width: 16, height: 16, borderRadius: "50%",
                  fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  {data.reminders.filter(r => r.date >= todayStr()).length}
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="page-content">
          {view === "dashboard" && renderDashboard()}
          {view === "brand"     && renderBrand()}
          {view === "analytics" && renderAnalytics()}
          {view === "calendar"  && renderCalendar()}
          {view === "pinboard"  && renderPinboard()}
          {view === "ai"        && renderAI()}
        </div>
      </main>

      {/* ── MODALS ── */}
      {modal === "task" && (
        <AddTaskModal
          onClose={() => setModal(null)}
          onAdd={(t) => addTask(activeBrand, activeBrandTab, t)}
          brandName={currentBrand?.name || ""}
          tabName={activeBrandTab}
        />
      )}
      {modal === "note" && (
        <AddNoteModal onClose={() => setModal(null)} onAdd={addNote} />
      )}
      {modal?.type === "reminder" && (
        <AddReminderModal onClose={() => setModal(null)} onAdd={addReminder} initDate={modal.date} />
      )}

      {/* ── TOASTS ── */}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
