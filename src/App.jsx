import { useState, useEffect } from "react";

// ─── Google Sheets API ───────────────────────────────────────────────────────
// 部署 Apps Script 後，把網址貼到這裡
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwdkquDzl1hlDPODmsmDh5moRgwPjJg3UTa3PgyqLAjQ2KtXDFzkMchmmRpQX6y0e8pvg/exec";

async function gsLoad() {
  const res = await fetch(`${APPS_SCRIPT_URL}?action=load`, { redirect: "follow" });
  const text = await res.text();
  const data = JSON.parse(text);
  if (data.error) throw new Error(data.error);
  return data;
}

async function gsSave(payload) {
  // 分批儲存每個分頁，避免網址過長
  const sheets = [
    { sheet: "students",         data: payload.students },
    { sheet: "assignments",      data: payload.assignments },
    { sheet: "progress",         data: payload.progress },
    { sheet: "english_progress", data: payload.english_progress },
    { sheet: "categories",       data: payload.categories },
  ];
  for (const item of sheets) {
    const encoded = encodeURIComponent(JSON.stringify(item.data));
    const url = `${APPS_SCRIPT_URL}?action=save&sheet=${item.sheet}&data=${encoded}`;
    const res = await fetch(url, { redirect: "follow" });
    const text = await res.text();
    const result = JSON.parse(text);
    if (result && result.error) throw new Error(result.error);
  }
}

// ─── Helper ──────────────────────────────────────────────────────────────────
const today = () => new Date().toLocaleDateString("zh-TW");
const STATUS = ["未繳", "訂正", "完成"];
const STATUS_COLOR = ["#e5e7eb", "#fb923c", "#4ade80"];

// ─── Tabs ────────────────────────────────────────────────────────────────────
const TABS = ["學生名單", "每日進度", "英文作業", "表格列印"];

const DEFAULT_CATEGORIES = ["評量", "背書", "考卷", "其他"];

export default function App() {
  const [tab, setTab] = useState(0);
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [progress, setProgress] = useState({});
  const [engProgress, setEngProgress] = useState({});
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [saving, setSaving] = useState(false);
  const [loadMsg, setLoadMsg] = useState("載入中…");
  const [loaded, setLoaded] = useState(false);

  // ── Load from Google Sheets ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const data = await gsLoad();

        // students
        setStudents((data.students || []).map(s => ({ number: Number(s.number), name: s.name })));

        // assignments
        setAssignments((data.assignments || []).map(a => ({ id: String(a.id), name: a.name, date: a.date, category: a.category || "其他" })));

        // progress: flat rows → nested map
        const pm = {};
        (data.progress || []).forEach(({ assignment_id, student_number, status }) => {
          if (!pm[assignment_id]) pm[assignment_id] = {};
          pm[assignment_id][Number(student_number)] = Number(status);
        });
        setProgress(pm);

        // english_progress: rows → key/date map
        const em = {};
        (data.english_progress || []).forEach(({ key, date }) => { em[key] = date; });
        setEngProgress(em);

        // categories
        const cats = (data.categories || []).map(c => c.name).filter(Boolean);
        if (cats.length) setCategories(cats);

      } catch (err) {
        setLoadMsg("⚠ 無法連線，使用本地模式（" + err.message + "）");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // ── Save to Google Sheets ──────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    try {
      // Flatten progress map → rows
      const progressRows = [];
      Object.entries(progress).forEach(([aid, sns]) => {
        Object.entries(sns).forEach(([sn, status]) => {
          progressRows.push({ assignment_id: aid, student_number: Number(sn), status });
        });
      });

      // Flatten engProgress map → rows
      const epRows = Object.entries(engProgress).map(([key, date]) => ({ key, date }));

      // categories → rows
      const catRows = categories.map(name => ({ name }));

      await gsSave({
        students,
        assignments,
        progress: progressRows,
        english_progress: epRows,
        categories: catRows,
      });

      alert("✅ 儲存成功！");
    } catch (e) {
      alert("❌ 儲存失敗：" + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif", color: "#f97316", fontSize: 20 }}>
      {loadMsg}
    </div>
  );

  return (
    <div style={{ fontFamily: "'Noto Sans TC', sans-serif", minHeight: "100vh", background: "#f9f7f4" }}>
      {/* Header */}
      <header style={{ background: "linear-gradient(135deg,#f97316,#fb923c)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 12px #f9731633" }}>
        <div style={{ color: "#fff", fontWeight: 800, fontSize: 22, letterSpacing: 2 }}>📚 班務作業系統</div>
        <button onClick={save} disabled={saving} style={{ background: saving ? "#ccc" : "#fff", color: "#f97316", border: "none", borderRadius: 8, padding: "8px 20px", fontWeight: 700, cursor: "pointer", fontSize: 15 }}>
          {saving ? "儲存中…" : "💾 儲存"}
        </button>
      </header>

      {/* Tabs */}
      <nav style={{ display: "flex", background: "#fff", borderBottom: "2px solid #fed7aa", paddingLeft: 16 }}>
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setTab(i)} style={{
            padding: "12px 24px", border: "none", background: "none", cursor: "pointer",
            fontWeight: tab === i ? 800 : 500, fontSize: 15,
            color: tab === i ? "#f97316" : "#6b7280",
            borderBottom: tab === i ? "3px solid #f97316" : "3px solid transparent",
            transition: "all .2s"
          }}>{t}</button>
        ))}
      </nav>

      <main style={{ padding: "24px", maxWidth: 960, margin: "0 auto" }}>
        {tab === 0 && <StudentTab students={students} setStudents={setStudents} />}
        {tab === 1 && <DailyTab students={students} assignments={assignments} setAssignments={setAssignments} progress={progress} setProgress={setProgress} categories={categories} setCategories={setCategories} />}
        {tab === 2 && <EnglishTab students={students} engProgress={engProgress} setEngProgress={setEngProgress} />}
        {tab === 3 && <PrintTab students={students} assignments={assignments} progress={progress} engProgress={engProgress} categories={categories} />}
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 1: 學生名單
// ═══════════════════════════════════════════════════════════════
function StudentTab({ students, setStudents }) {
  const [name, setName] = useState("");
  const [num, setNum] = useState("");
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);

  const addOne = () => {
    if (!name.trim() || !num.trim()) return;
    const n = Number(num);
    if (students.find(s => s.number === n)) return alert("號碼已存在");
    setStudents(prev => [...prev, { number: n, name: name.trim() }].sort((a, b) => a.number - b.number));
    setName(""); setNum("");
  };

  const addBulk = () => {
    const lines = bulk.trim().split("\n").map(l => l.trim()).filter(Boolean);
    const news = [];
    for (const l of lines) {
      const parts = l.split(/[\s,，]+/);
      if (parts.length < 2) continue;
      const n = Number(parts[0]);
      const nm = parts.slice(1).join("");
      if (!isNaN(n) && nm && !students.find(s => s.number === n)) news.push({ number: n, name: nm });
    }
    setStudents(prev => [...prev, ...news].sort((a, b) => a.number - b.number));
    setBulk(""); setShowBulk(false);
  };

  const del = (n) => setStudents(prev => prev.filter(s => s.number !== n));

  return (
    <div>
      <h2 style={h2}>👥 學生名單管理</h2>

      {/* Single add */}
      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 12, color: "#374151" }}>新增單一學生</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input value={num} onChange={e => setNum(e.target.value)} placeholder="號碼" style={{ ...inp, width: 80 }} type="number" />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="姓名" style={{ ...inp, width: 120 }} />
          <button onClick={addOne} style={btnOrange}>新增</button>
          <button onClick={() => setShowBulk(!showBulk)} style={btnGray}>批量新增</button>
        </div>
        {showBulk && (
          <div style={{ marginTop: 12 }}>
            <textarea value={bulk} onChange={e => setBulk(e.target.value)}
              placeholder={"每行一位，格式：號碼 姓名\n例：\n1 王小明\n2 李小華"}
              style={{ ...inp, width: "100%", height: 120, resize: "vertical" }} />
            <button onClick={addBulk} style={{ ...btnOrange, marginTop: 8 }}>批量新增</button>
          </div>
        )}
      </div>

      {/* List */}
      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 12, color: "#374151" }}>全班名單（{students.length} 人）</div>
        {students.length === 0 && <div style={{ color: "#9ca3af" }}>尚無學生</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {students.map(s => (
            <div key={s.number} style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "6px 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#f97316", fontWeight: 700 }}>{s.number}</span>
              <span style={{ color: "#374151" }}>{s.name}</span>
              <button onClick={() => del(s.number)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 16, lineHeight: 1 }}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 2: 每日進度
// ═══════════════════════════════════════════════════════════════
function DailyTab({ students, assignments, setAssignments, progress, setProgress, categories, setCategories }) {
  const [newAssign, setNewAssign] = useState("");
  const [newAssignCat, setNewAssignCat] = useState("");
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState("");
  const [filter, setFilter] = useState(null);       // student number quick search
  const [catFilter, setCatFilter] = useState("全部"); // category filter for display
  const [newCatName, setNewCatName] = useState("");
  const [showCatMgr, setShowCatMgr] = useState(false);

  // Init default selected category
  useEffect(() => {
    if (!newAssignCat && categories.length) setNewAssignCat(categories[0]);
  }, [categories]);

  const addAssign = () => {
    if (!newAssign.trim()) return;
    const id = Date.now().toString();
    setAssignments(prev => [...prev, { id, name: newAssign.trim(), date: today(), category: newAssignCat || categories[0] || "其他" }]);
    setNewAssign("");
  };

  const delAssign = (id) => {
    setAssignments(prev => prev.filter(a => a.id !== id));
    setProgress(prev => { const n = { ...prev }; delete n[id]; return n; });
  };

  const saveEdit = (id) => {
    setAssignments(prev => prev.map(a => a.id === id ? { ...a, name: editName } : a));
    setEditId(null);
  };

  const cycleStatus = (aid, sn) => {
    setProgress(prev => {
      const cur = prev[aid]?.[sn] ?? 0;
      return { ...prev, [aid]: { ...prev[aid], [sn]: (cur + 1) % 3 } };
    });
  };

  const getStatus = (aid, sn) => progress[aid]?.[sn] ?? 0;

  const addCategory = () => {
    const n = newCatName.trim();
    if (!n || categories.includes(n)) return;
    setCategories(prev => [...prev, n]);
    setNewCatName("");
  };

  const delCategory = (cat) => {
    setCategories(prev => prev.filter(c => c !== cat));
  };

  const visibleAssignments = catFilter === "全部"
    ? assignments
    : assignments.filter(a => a.category === catFilter);

  const unfinished = filter !== null
    ? visibleAssignments.filter(a => getStatus(a.id, filter) < 2)
    : null;

  // Category tag color palette
  const catColors = ["#f97316","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#f59e0b","#10b981","#6366f1"];
  const catColor = (cat) => catColors[categories.indexOf(cat) % catColors.length];

  return (
    <div>
      <h2 style={h2}>📋 每日進度</h2>

      {/* ── Category Manager ── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showCatMgr ? 14 : 0 }}>
          <div style={{ fontWeight: 700, color: "#374151" }}>🏷 分類管理</div>
          <button onClick={() => setShowCatMgr(!showCatMgr)} style={{ ...btnGray, padding: "4px 14px", fontSize: 13 }}>
            {showCatMgr ? "收起 ▲" : "管理分類 ▼"}
          </button>
        </div>
        {showCatMgr && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {categories.map(cat => (
                <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6, background: catColor(cat) + "22", border: `1.5px solid ${catColor(cat)}`, borderRadius: 20, padding: "4px 12px" }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: catColor(cat) }}>{cat}</span>
                  <button onClick={() => delCategory(cat)} style={{ background: "none", border: "none", cursor: "pointer", color: catColor(cat), fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addCategory()}
                placeholder="新增分類名稱…" style={{ ...inp, flex: 1 }} />
              <button onClick={addCategory} style={btnOrange}>新增分類</button>
            </div>
          </>
        )}
      </div>

      {/* ── Add Assignment ── */}
      <div style={card}>
        <div style={{ fontWeight: 700, color: "#374151", marginBottom: 12 }}>➕ 新增作業</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select value={newAssignCat} onChange={e => setNewAssignCat(e.target.value)}
            style={{ ...inp, minWidth: 90, background: "#fff" }}>
            {categories.map(c => <option key={c}>{c}</option>)}
          </select>
          <input value={newAssign} onChange={e => setNewAssign(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addAssign()}
            placeholder="作業名稱…" style={{ ...inp, flex: 1, minWidth: 180 }} />
          <button onClick={addAssign} style={btnOrange}>新增</button>
        </div>
      </div>

      {/* ── Category Filter ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
        {["全部", ...categories].map(cat => (
          <button key={cat} onClick={() => setCatFilter(cat)}
            style={{
              ...chipBtn,
              background: catFilter === cat ? (cat === "全部" ? "#374151" : catColor(cat)) : "#f3f4f6",
              color: catFilter === cat ? "#fff" : "#374151",
              border: catFilter === cat ? "none" : `1.5px solid #e5e7eb`
            }}>{cat}</button>
        ))}
      </div>

      {/* ── Quick Search ── */}
      <div style={card}>
        <div style={{ fontWeight: 700, marginBottom: 10, color: "#374151" }}>🔍 快速查找學生未完成項目</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {students.map(s => (
            <button key={s.number} onClick={() => setFilter(filter === s.number ? null : s.number)}
              style={{ ...chipBtn, background: filter === s.number ? "#f97316" : "#f3f4f6", color: filter === s.number ? "#fff" : "#374151" }}>
              {s.number} {s.name}
            </button>
          ))}
          {filter !== null && <button onClick={() => setFilter(null)} style={{ ...chipBtn, background: "#ef4444", color: "#fff" }}>清除</button>}
        </div>
        {filter !== null && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 700, color: "#f97316", marginBottom: 8 }}>
              {students.find(s => s.number === filter)?.name} 未完成項目（{catFilter === "全部" ? "全部分類" : catFilter}）：
            </div>
            {unfinished.length === 0
              ? <div style={{ color: "#4ade80", fontWeight: 700 }}>✅ 全部完成！</div>
              : unfinished.map(a => (
                <div key={a.id} style={{ padding: "4px 0", color: "#374151", display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ background: catColor(a.category) + "22", color: catColor(a.category), borderRadius: 10, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>{a.category}</span>
                  ・{a.name}（{STATUS[getStatus(a.id, filter)]}）
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ── Assignment List ── */}
      {visibleAssignments.length === 0 && <div style={{ color: "#9ca3af", textAlign: "center", padding: 40 }}>尚無作業</div>}
      {visibleAssignments.map(a => (
        <div key={a.id} style={{ ...card, borderLeft: `4px solid ${catColor(a.category)}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
            <span style={{ background: catColor(a.category) + "22", color: catColor(a.category), borderRadius: 10, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{a.category}</span>
            {editId === a.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  style={{ ...inp, flex: 1, minWidth: 160 }} />
                <button onClick={() => saveEdit(a.id)} style={btnOrange}>儲存</button>
                <button onClick={() => setEditId(null)} style={btnGray}>取消</button>
              </>
            ) : (
              <>
                <span style={{ fontWeight: 700, fontSize: 17, color: "#1f2937", flex: 1 }}>{a.name}</span>
                <span style={{ color: "#9ca3af", fontSize: 13 }}>{a.date}</span>
                <button onClick={() => { setEditId(a.id); setEditName(a.name); }} style={btnGray}>✏️ 改名</button>
                <button onClick={() => delAssign(a.id)} style={{ ...btnGray, color: "#ef4444" }}>🗑 刪除</button>
              </>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {students.map(s => {
              const st = getStatus(a.id, s.number);
              return (
                <button key={s.number} onClick={() => cycleStatus(a.id, s.number)}
                  title={STATUS[st]}
                  style={{
                    width: 56, padding: "4px 0", border: "none", borderRadius: 8, cursor: "pointer",
                    background: STATUS_COLOR[st], transition: "all .15s",
                    fontWeight: 700, fontSize: 13, color: st === 0 ? "#9ca3af" : "#1f2937"
                  }}>
                  <div>{s.number}</div>
                  <div style={{ fontSize: 10, fontWeight: 400 }}>{STATUS[st]}</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TAB 3: 英文作業
// ═══════════════════════════════════════════════════════════════
function EnglishTab({ students, engProgress, setEngProgress }) {
  const [section, setSection] = useState(0);
  const units = section === 0 ? [1, 2, 3, 4, 5] : [6, 7, 8, 9, 10];
  const parts = [1, 2, 3, 4];

  const togglePart = (unit, part, studentNum) => {
    const key = `U${unit}-P${part}-${studentNum}`;
    setEngProgress(prev => {
      const n = { ...prev };
      if (n[key]) delete n[key];
      else n[key] = today();
      return n;
    });
  };

  // Column headers: each unit has 4 parts
  const cols = units.flatMap(u => parts.map(p => ({ unit: u, part: p })));

  return (
    <div>
      <h2 style={h2}>📖 英文作業</h2>
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {["U1～5", "U6～10"].map((label, i) => (
          <button key={i} onClick={() => setSection(i)}
            style={{ ...chipBtn, background: section === i ? "#f97316" : "#f3f4f6", color: section === i ? "#fff" : "#374151", padding: "10px 28px", fontSize: 15, fontWeight: 700 }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ ...card, overflowX: "auto", padding: 0 }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 640 }}>
          <thead>
            {/* Unit row */}
            <tr>
              <th rowSpan={2} style={thStyle({ minWidth: 90, borderRight: "2px solid #fed7aa", background: "#fff7ed" })}>姓名</th>
              {units.map(u => (
                <th key={u} colSpan={4} style={thStyle({ background: "#f97316", color: "#fff", fontSize: 14, borderLeft: "2px solid #ea580c" })}>
                  Unit {u}
                </th>
              ))}
            </tr>
            {/* Part row */}
            <tr>
              {cols.map(({ unit, part }, i) => (
                <th key={i} style={thStyle({ background: "#fff7ed", color: "#ea580c", fontSize: 12, fontWeight: 700, borderLeft: part === 1 ? "2px solid #fed7aa" : "1px solid #fde8cc" })}>
                  P{part}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.length === 0 && (
              <tr><td colSpan={cols.length + 1} style={{ textAlign: "center", padding: 32, color: "#9ca3af" }}>尚無學生</td></tr>
            )}
            {students.map((s, si) => (
              <tr key={s.number} style={{ background: si % 2 === 0 ? "#fff" : "#fafafa" }}>
                <td style={{ padding: "6px 12px", fontWeight: 700, fontSize: 13, borderRight: "2px solid #fed7aa", borderBottom: "1px solid #f3f4f6", whiteSpace: "nowrap", color: "#374151" }}>
                  <span style={{ color: "#f97316", marginRight: 6 }}>{s.number}</span>{s.name}
                </td>
                {cols.map(({ unit, part }, i) => {
                  const key = `U${unit}-P${part}-${s.number}`;
                  const done = !!engProgress[key];
                  return (
                    <td key={i} style={{ padding: 3, borderBottom: "1px solid #f3f4f6", borderLeft: part === 1 ? "2px solid #fed7aa" : "1px solid #f3f4f6", textAlign: "center" }}>
                      <button
                        onClick={() => togglePart(unit, part, s.number)}
                        title={done ? `完成於 ${engProgress[key]}` : "點擊標記完成"}
                        style={{
                          width: "100%", minWidth: 44, padding: "5px 2px", border: "none", borderRadius: 6, cursor: "pointer",
                          background: done ? "#4ade80" : "#f3f4f6",
                          color: done ? "#14532d" : "#d1d5db",
                          fontSize: 11, fontWeight: 700, transition: "all .15s", lineHeight: 1.3
                        }}>
                        {done ? "✓" : "－"}
                        {done && <div style={{ fontSize: 8, fontWeight: 400, color: "#166534", marginTop: 1 }}>{engProgress[key]}</div>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 16, marginTop: 8, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6b7280" }}>
          <div style={{ width: 20, height: 20, background: "#4ade80", borderRadius: 4 }} /> 已完成（顯示日期）
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6b7280" }}>
          <div style={{ width: 20, height: 20, background: "#f3f4f6", borderRadius: 4 }} /> 未完成
        </div>
      </div>
    </div>
  );
}

const thStyle = (extra = {}) => ({
  padding: "8px 6px", fontSize: 13, fontWeight: 700, textAlign: "center",
  borderBottom: "2px solid #fed7aa", position: "sticky", top: 0, zIndex: 1,
  ...extra
});

// ═══════════════════════════════════════════════════════════════
// TAB 4: 表格列印
// ═══════════════════════════════════════════════════════════════
function PrintTab({ students, assignments, progress, engProgress, categories }) {
  const [printType, setPrintType] = useState("overview");
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [catFilter, setCatFilter] = useState("全部");

  const getStatus = (aid, sn) => progress[aid]?.[sn] ?? 0;

  const toggleStudent = (n) => setSelectedStudents(prev =>
    prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]
  );

  const catColors = ["#f97316","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#f59e0b","#10b981","#6366f1"];
  const catColor = (cat) => {
    const idx = categories.indexOf(cat);
    return catColors[idx >= 0 ? idx % catColors.length : 0];
  };

  const filteredAssignments = catFilter === "全部"
    ? assignments
    : assignments.filter(a => a.category === catFilter);

  // ── Build HTML string for each print type ────────────────────────────────
  const buildOverviewHTML = () => {
    const header = `<tr><th>號</th><th>姓名</th>${filteredAssignments.map(a =>
      `<th style="background:${catColor(a.category)}33;color:#1f2937">${a.category ? `<span style="font-size:9px;color:${catColor(a.category)}">[${a.category}]</span><br>` : ""}${a.name}</th>`
    ).join("")}</tr>`;
    const rows = students.map(s =>
      `<tr><td>${s.number}</td><td>${s.name}</td>${filteredAssignments.map(a => {
        const st = getStatus(a.id, s.number);
        return `<td style="background:${["#e5e7eb","#fb923c","#4ade80"][st]}">${STATUS[st]}</td>`;
      }).join("")}</tr>`
    ).join("");
    return `<h3>進度總覽${catFilter !== "全部" ? ` — ${catFilter}` : ""} — ${today()}</h3><table><thead>${header}</thead><tbody>${rows}</tbody></table>`;
  };

  const buildDebtHTML = () => {
    const targets = selectedStudents.length ? students.filter(s => selectedStudents.includes(s.number)) : students;
    const slips = targets.map(s => {
      const missing = filteredAssignments.filter(a => getStatus(a.id, s.number) < 2);
      const rows = missing.length === 0
        ? `<tr><td colspan="3" style="color:#4ade80;text-align:center">✅ 全部完成</td></tr>`
        : missing.map(a => {
            const st = getStatus(a.id, s.number);
            return `<tr><td style="background:${catColor(a.category)}22;color:${catColor(a.category)};font-size:10px;white-space:nowrap">${a.category||""}</td><td style="text-align:left">${a.name}</td><td style="background:${["#e5e7eb","#fb923c","#4ade80"][st]}">${STATUS[st]}</td></tr>`;
          }).join("");
      return `<div class="card"><div class="card-header">${s.number} 號 ${s.name}</div><table><thead><tr><th>分類</th><th>作業</th><th>狀態</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }).join("");
    return `<h3>學生欠繳單${catFilter !== "全部" ? ` — ${catFilter}` : ""} — ${today()}</h3><div class="four-up">${slips}</div>`;
  };

  const buildEnglishHTML = () => {
    const sections = [["U1～5",[1,2,3,4,5]],["U6～10",[6,7,8,9,10]]];
    return `<h3>英文進度總覽 — ${today()}</h3>` + sections.map(([label, units]) => {
      const ths = units.flatMap(u => [1,2,3,4].map(p => `<th>U${u}-P${p}</th>`)).join("");
      const rows = students.map(s =>
        `<tr><td>${s.number}</td><td>${s.name}</td>${units.flatMap(u => [1,2,3,4].map(p => {
          const done = !!engProgress[`U${u}-P${p}-${s.number}`];
          return `<td style="background:${done ? "#4ade80" : "#fee2e2"};font-size:10px">${done ? "✓" : ""}</td>`;
        })).join("")}</tr>`
      ).join("");
      return `<div style="margin-bottom:20px"><div style="font-weight:700;margin-bottom:6px">${label}</div><table><thead><tr><th>號</th><th>姓名</th>${ths}</tr></thead><tbody>${rows}</tbody></table></div>`;
    }).join("");
  };

  const openPrintWindow = () => {
    let bodyHTML = "";
    if (printType === "overview") bodyHTML = buildOverviewHTML();
    else if (printType === "debt") bodyHTML = buildDebtHTML();
    else bodyHTML = buildEnglishHTML();

    const css = `
      *{box-sizing:border-box}
      body{font-family:sans-serif;font-size:12px;margin:20px;color:#1f2937}
      h3{color:#f97316;margin:0 0 14px;font-size:16px}
      table{border-collapse:collapse;width:100%;margin-bottom:12px}
      th,td{border:1px solid #ccc;padding:4px 8px;text-align:center}
      th{background:#fed7aa;font-weight:700;font-size:11px}
      .four-up{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .card{border:2px solid #f97316;border-radius:8px;padding:12px;page-break-inside:avoid}
      .card-header{font-weight:700;border-bottom:1px solid #fed7aa;padding-bottom:6px;margin-bottom:8px;font-size:13px}
      @media print{
        body{margin:10px}
        @page{margin:10mm}
      }
    `;
    const w = window.open("", "print_preview", "width=900,height=720,scrollbars=yes,resizable=yes");
    if (!w) { alert("請允許瀏覽器開啟彈出視窗後再試"); return; }
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>列印預覽</title><style>${css}</style></head><body>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #fed7aa">
        <div style="font-size:18px;font-weight:800;color:#f97316">📚 班務作業系統</div>
        <div style="display:flex;gap:10px">
          <button onclick="window.print()" style="background:#f97316;color:#fff;border:none;border-radius:6px;padding:8px 20px;font-size:14px;font-weight:700;cursor:pointer">🖨 列印</button>
          <button onclick="window.close()" style="background:#f3f4f6;color:#374151;border:none;border-radius:6px;padding:8px 16px;font-size:14px;cursor:pointer">✕ 關閉</button>
        </div>
      </div>
      ${bodyHTML}
    </body></html>`);
    w.document.close();
    w.focus();
  };

  // ── In-page preview (lightweight) ─────────────────────────────────────────
  const PreviewOverview = () => (
    <div style={{ overflowX: "auto" }}>
      <h3 style={{ color: "#f97316", marginBottom: 10 }}>進度總覽{catFilter !== "全部" ? ` — ${catFilter}` : ""} — {today()}</h3>
      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
        <thead>
          <tr>
            <th style={pth}>號</th><th style={pth}>姓名</th>
            {filteredAssignments.map(a => (
              <th key={a.id} style={{ ...pth, background: catColor(a.category) + "33" }}>
                <div style={{ fontSize: 9, color: catColor(a.category), fontWeight: 700 }}>{a.category}</div>
                {a.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map(s => (
            <tr key={s.number}>
              <td style={ptd}>{s.number}</td>
              <td style={ptd}>{s.name}</td>
              {filteredAssignments.map(a => {
                const st = getStatus(a.id, s.number);
                return <td key={a.id} style={{ ...ptd, background: STATUS_COLOR[st], fontSize: 11 }}>{STATUS[st]}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const PreviewDebt = () => {
    const targets = selectedStudents.length ? students.filter(s => selectedStudents.includes(s.number)) : students;
    return (
      <div>
        <h3 style={{ color: "#f97316", marginBottom: 10 }}>學生欠繳單 — {today()}</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {targets.map(s => {
            const missing = filteredAssignments.filter(a => getStatus(a.id, s.number) < 2);
            return (
              <div key={s.number} style={{ border: "2px solid #f97316", borderRadius: 8, padding: 10 }}>
                <div style={{ fontWeight: 700, borderBottom: "1px solid #fed7aa", paddingBottom: 4, marginBottom: 8, fontSize: 13 }}>
                  {s.number} 號 {s.name}
                </div>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                  <thead><tr><th style={pth}>分類</th><th style={pth}>作業</th><th style={pth}>狀態</th></tr></thead>
                  <tbody>
                    {missing.length === 0
                      ? <tr><td colSpan={3} style={{ ...ptd, color: "#4ade80", textAlign: "center" }}>✅ 全部完成</td></tr>
                      : missing.map(a => {
                          const st = getStatus(a.id, s.number);
                          return (
                            <tr key={a.id}>
                              <td style={{ ...ptd, background: catColor(a.category) + "22", color: catColor(a.category), fontSize: 10, whiteSpace: "nowrap" }}>{a.category}</td>
                              <td style={{ ...ptd, textAlign: "left" }}>{a.name}</td>
                              <td style={{ ...ptd, background: STATUS_COLOR[st] }}>{STATUS[st]}</td>
                            </tr>
                          );
                        })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const PreviewEnglish = () => (
    <div style={{ overflowX: "auto" }}>
      <h3 style={{ color: "#f97316", marginBottom: 10 }}>英文進度總覽 — {today()}</h3>
      {[["U1～5",[1,2,3,4,5]],["U6～10",[6,7,8,9,10]]].map(([label, units]) => (
        <div key={label} style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={pth}>號</th><th style={pth}>姓名</th>
                {units.flatMap(u => [1,2,3,4].map(p => <th key={`${u}${p}`} style={pth}>U{u}-P{p}</th>))}
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <tr key={s.number}>
                  <td style={ptd}>{s.number}</td><td style={ptd}>{s.name}</td>
                  {units.flatMap(u => [1,2,3,4].map(p => {
                    const done = !!engProgress[`U${u}-P${p}-${s.number}`];
                    return <td key={`${u}${p}`} style={{ ...ptd, background: done ? "#4ade80" : "#fee2e2" }}>{done ? "✓" : ""}</td>;
                  }))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <h2 style={h2}>🖨 表格列印</h2>

      <div style={card}>
        {/* Print type */}
        <div style={{ fontWeight: 700, color: "#374151", marginBottom: 10 }}>列印類型</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          {[["overview","A. 進度總覽"],["debt","B. 學生欠繳單"],["english","C. 英文進度"]].map(([v,l]) => (
            <button key={v} onClick={() => setPrintType(v)}
              style={{ ...chipBtn, background: printType === v ? "#f97316" : "#f3f4f6", color: printType === v ? "#fff" : "#374151", padding: "8px 18px", fontWeight: 700 }}>
              {l}
            </button>
          ))}
        </div>

        {/* Category filter (not for english) */}
        {printType !== "english" && (
          <>
            <div style={{ fontWeight: 700, color: "#374151", marginBottom: 10 }}>篩選分類</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {["全部", ...categories].map(cat => (
                <button key={cat} onClick={() => setCatFilter(cat)}
                  style={{ ...chipBtn, background: catFilter === cat ? (cat === "全部" ? "#374151" : catColor(cat)) : "#f3f4f6", color: catFilter === cat ? "#fff" : "#374151", border: catFilter === cat ? "none" : "1.5px solid #e5e7eb" }}>
                  {cat}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Student selector for debt */}
        {printType === "debt" && (
          <>
            <div style={{ fontWeight: 700, color: "#374151", marginBottom: 10 }}>選擇學生（不選則全班）</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {students.map(s => (
                <button key={s.number} onClick={() => toggleStudent(s.number)}
                  style={{ ...chipBtn, background: selectedStudents.includes(s.number) ? "#f97316" : "#f3f4f6", color: selectedStudents.includes(s.number) ? "#fff" : "#374151" }}>
                  {s.number} {s.name}
                </button>
              ))}
            </div>
          </>
        )}

        <button onClick={openPrintWindow} style={{ ...btnOrange, padding: "10px 28px", fontSize: 15 }}>
          🖨 開啟列印視窗
        </button>
        <span style={{ marginLeft: 12, color: "#9ca3af", fontSize: 13 }}>彈出視窗內可按列印或另存PDF</span>
      </div>

      {/* In-page preview */}
      <div style={{ ...card, padding: 24 }}>
        <div style={{ fontWeight: 700, color: "#6b7280", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          👁 預覽
          {catFilter !== "全部" && printType !== "english" && (
            <span style={{ background: "#f97316", color: "#fff", borderRadius: 10, padding: "2px 10px", fontSize: 12 }}>分類：{catFilter}</span>
          )}
        </div>
        <div style={{ border: "1px dashed #fed7aa", borderRadius: 8, padding: 16 }}>
          {printType === "overview" && <PreviewOverview />}
          {printType === "debt" && <PreviewDebt />}
          {printType === "english" && <PreviewEnglish />}
        </div>
      </div>
    </div>
  );
}

const pth = { border: "1px solid #ccc", padding: "4px 6px", background: "#fed7aa", fontWeight: 700, textAlign: "center", fontSize: 11 };
const ptd = { border: "1px solid #e5e7eb", padding: "3px 6px", textAlign: "center", fontSize: 11 };

// ─── Shared styles ────────────────────────────────────────────────────────────
const h2 = { fontSize: 22, fontWeight: 800, color: "#1f2937", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 };
const card = { background: "#fff", borderRadius: 14, padding: 20, marginBottom: 18, boxShadow: "0 1px 8px #0000000d", border: "1px solid #f3f4f6" };
const inp = { border: "1.5px solid #d1d5db", borderRadius: 8, padding: "8px 12px", fontSize: 14, outline: "none", fontFamily: "inherit" };
const btnOrange = { background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, cursor: "pointer", fontSize: 14 };
const btnGray = { background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, padding: "8px 14px", fontWeight: 600, cursor: "pointer", fontSize: 14 };
const chipBtn = { border: "none", borderRadius: 20, padding: "5px 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all .15s" };
