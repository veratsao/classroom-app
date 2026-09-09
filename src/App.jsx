<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>班務作業系統</title>
  <!-- React & ReactDOM -->
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <!-- Babel for JSX -->
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <!-- Tailwind CSS (for smooth base styling) -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Google Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Noto Sans TC', sans-serif; background-color: #f9f7f4; margin: 0; }
    input, select, textarea { outline: none; }
  </style>
</head>
<body>
  <div id="root"></div>

  <script type="text/babel">
    const { useState, useEffect, useRef, useCallback } = React;

    // ─── Google Apps Script API ───────────────────────────────────────────────────
    const GAS_URL = "https://script.google.com/macros/s/AKfycbwdkquDzl1hlDPODmsmDh5moRgwPjJg3UTa3PgyqLAjQ2KtXDFzkMchmmRpQX6y0e8pvg/exec";

    async function gsLoad() {
      const res = await fetch(`${GAS_URL}?action=load&_=${Date.now()}`, { cache: "no-store" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data;
    }

    async function saveSheet(sheetName, data) {
      const BATCH_SIZE = 25;
      const arr = data || [];
      await fetch(`${GAS_URL}?action=save&sheet=${sheetName}&data=${encodeURIComponent("[]")}&_=${Date.now()}`, { cache: "no-store" });
      if (arr.length === 0) return;

      if (arr.length <= BATCH_SIZE) {
        const encoded = encodeURIComponent(JSON.stringify(arr));
        await fetch(`${GAS_URL}?action=save&sheet=${sheetName}&data=${encoded}&_=${Date.now()}`, { cache: "no-store" });
        return;
      }

      for (let i = 0; i < arr.length; i += BATCH_SIZE) {
        const batch = arr.slice(i, i + BATCH_SIZE);
        const action = i === 0 ? "save" : "append";
        const encoded = encodeURIComponent(JSON.stringify(batch));
        await fetch(`${GAS_URL}?action=${action}&sheet=${sheetName}&data=${encoded}&_=${Date.now()}`, { cache: "no-store" });
      }
    }

    async function gsSave(payload) {
      await saveSheet("students",         payload.students);
      await saveSheet("groups",           payload.groups || []);
      await saveSheet("assignments",      payload.assignments);
      await saveSheet("categories",       payload.categories);
      await saveSheet("todos",            payload.todos || []);
      await saveSheet("progress",         payload.progress);
      await saveSheet("english_progress", payload.english_progress);
    }

    // ─── Constants & Styles ───────────────────────────────────────────────────────
    const today = () => {
      const d = new Date();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${d.getFullYear()}-${month}-${day}`;
    };
    const STATUS = ["未繳", "訂正", "完成"];
    const STATUS_COLOR = ["#e5e7eb", "#fb923c", "#4ade80"];
    const TEACHER_PASSWORD = "800914";
    const TABS = ["學生名單", "學生分組", "每日進度", "英文作業", "待辦事項", "表格列印"];
    const DEFAULT_CATEGORIES = ["評量", "背書", "考卷", "其他"];

    const card = { background: "#fff", borderRadius: 16, padding: 20, marginBottom: 16, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" };
    const inp = { border: "1.5px solid #fed7aa", borderRadius: 8, padding: "8px 12px", fontSize: 14, background: "#fff" };
    const btnOrange = { background: "#f97316", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 14 };
    const btnGray = { background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 600, cursor: "pointer", fontSize: 14 };
    const chipBtn = { border: "none", borderRadius: 20, padding: "6px 14px", cursor: "pointer", fontWeight: 600, fontSize: 13, transition: "all .15s" };
    const h2 = { fontSize: 20, fontWeight: 800, color: "#1f2937", marginBottom: 16 };

    // ═══════════════════════════════════════════════════════════════
    // LOGIN SCREEN
    // ═══════════════════════════════════════════════════════════════
    function LoginScreen({ students, onTeacherLogin, onParentLogin }) {
      const [input, setInput] = useState("");
      const [error, setError] = useState("");
      const [showPw, setShowPw] = useState(false);

      const handleLogin = () => {
        setError("");
        if (input === TEACHER_PASSWORD) {
          onTeacherLogin();
          return;
        }
        const sn = Number(input);
        const student = students.find(s => s.number === sn || s.password === input);
        if (student) {
          onParentLogin(student);
          return;
        }
        setError("密碼錯誤，請再試一次");
      };

      return (
        <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#fff7ed,#fed7aa)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "40px 36px", width: 340, boxShadow: "0 8px 40px rgba(249,115,22,0.15)", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>📚</div>
            <div style={{ fontWeight: 800, fontSize: 22, color: "#f97316", marginBottom: 4 }}>班務作業系統</div>
            <div style={{ color: "#9ca3af", fontSize: 13, marginBottom: 28 }}>老師請輸入管理密碼，家長請輸入學生號碼</div>
            <div style={{ position: "relative", marginBottom: 16 }}>
              <input
                type={showPw ? "text" : "password"}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()}
                placeholder="請輸入密碼或學生號碼"
                style={{ ...inp, width: "100%", fontSize: 16, textAlign: "center", letterSpacing: 2, paddingRight: 40 }}
                autoFocus
              />
              <button onClick={() => setShowPw(!showPw)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 16 }}>
                {showPw ? "🙈" : "👁"}
              </button>
            </div>
            {error && <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <button onClick={handleLogin} style={{ ...btnOrange, width: "100%", padding: "12px 0", fontSize: 16 }}>登入</button>
          </div>
        </div>
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // PARENT VIEW
    // ═══════════════════════════════════════════════════════════════
    function ParentView({ student, assignments, progress, setProgress, engProgress, todos, onLogout, onPasswordChange }) {
      const [showChangePw, setShowChangePw] = useState(false);
      const [newPw, setNewPw] = useState("");
      const [confirmPw, setConfirmPw] = useState("");
      const [pwMsg, setPwMsg] = useState("");
      const [engSection, setEngSection] = useState(0);

      const getStatus = (aid, sn) => progress[aid]?.[sn] ?? 0;

      const handleChangePw = () => {
        if (newPw.length < 4) { setPwMsg("密碼至少需要4位"); return; }
        if (newPw !== confirmPw) { setPwMsg("兩次輸入不一致"); return; }
        onPasswordChange(student.number, newPw);
        setPwMsg("✅ 密碼已更新！");
        setNewPw(""); setConfirmPw("");
        setTimeout(() => { setPwMsg(""); setShowChangePw(false); }, 1500);
      };

      const handleBookDone = (assignmentId) => {
        const newProgress = { ...progress, [assignmentId]: { ...progress[assignmentId], [student.number]: 2 } };
        setProgress(newProgress);
      };

      const studentAssign = assignments.filter(a => {
        if (!a.assigned_to || a.assigned_to.length === 0) return true;
        return a.assigned_to.includes(student.number);
      });

      const unfinishedAssign = studentAssign.filter(a => getStatus(a.id, student.number) < 2);
      const pendingTodos = (todos || []).filter(t => t.student_number === student.number && !t.done);
      const units = engSection === 0 ? [1,2,3,4,5] : [6,7,8,9,10];
      const parts = [1,2,3,4];

      const catGroups = unfinishedAssign.reduce((acc, a) => {
        const cat = a.category || "其他";
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(a);
        return acc;
      }, {});
      const sortedCats = Object.keys(catGroups).sort((a, b) => a.localeCompare(b, "zh-TW"));

      return (
        <div style={{ minHeight: "100vh", background: "#f9f7f4" }}>
          <header style={{ background: "linear-gradient(135deg,#f97316,#fb923c)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 12px rgba(249,115,22,0.2)" }}>
            <div>
              <div style={{ color: "#fff", fontWeight: 800, fontSize: 18 }}>📚 班務作業系統</div>
              <div style={{ color: "#fed7aa", fontSize: 13 }}>{student.number} 號 {student.name} 的學習進度</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowChangePw(!showChangePw)} style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>🔑 改密碼</button>
              <button onClick={onLogout} style={{ background: "#fff", color: "#f97316", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>登出</button>
            </div>
          </header>

          {showChangePw && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", padding: "16px 24px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="新密碼（至少4位）" style={{ ...inp, width: 160 }} />
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="確認新密碼" style={{ ...inp, width: 160 }} />
              <button onClick={handleChangePw} style={btnOrange}>確認更改</button>
              {pwMsg && <span style={{ color: pwMsg.startsWith("✅") ? "#4ade80" : "#ef4444", fontWeight: 700 }}>{pwMsg}</span>}
            </div>
          )}

          <main style={{ padding: "20px", maxWidth: 760, margin: "0 auto" }}>
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 17, color: "#f97316", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                📋 每日進度未完成
                <span style={{ background: unfinishedAssign.length > 0 ? "#ef4444" : "#4ade80", color: "#fff", borderRadius: 10, padding: "1px 10px", fontSize: 13, fontWeight: 700 }}>
                  {unfinishedAssign.length} 項
                </span>
              </div>
              {unfinishedAssign.length === 0
                ? <div style={{ color: "#4ade80", fontWeight: 700 }}>✅ 全部完成！</div>
                : sortedCats.map(cat => (
                  <div key={cat} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#f97316", background: "#fff7ed", borderRadius: 6, padding: "3px 10px", display: "inline-block", marginBottom: 8 }}>{cat}</div>
                    {catGroups[cat].map(a => {
                      const st = getStatus(a.id, student.number);
                      const isBookRecite = cat === "背書";
                      return (
                        <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f3f4f6", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 600, fontSize: 15, color: "#1f2937", flex: 1 }}>
                            {String(a.name)} {a.date && <span style={{ fontSize: 12, color: "#9ca3af" }}>({a.date})</span>}
                          </span>
                          {isBookRecite ? (
                            <button onClick={() => handleBookDone(a.id)}
                              style={{ border: "2px solid #4ade80", borderRadius: 8, padding: "5px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13, background: "#fff", color: "#4ade80" }}>
                              ✓ 背完了
                            </button>
                          ) : (
                            <span style={{ background: STATUS_COLOR[st], borderRadius: 8, padding: "3px 12px", fontWeight: 700, fontSize: 13, color: st === 0 ? "#9ca3af" : "#1f2937", whiteSpace: "nowrap" }}>
                              {STATUS[st]}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 17, color: "#f97316", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                📝 待辦事項
                <span style={{ background: pendingTodos.length > 0 ? "#ef4444" : "#4ade80", color: "#fff", borderRadius: 10, padding: "1px 10px", fontSize: 13, fontWeight: 700 }}>
                  {pendingTodos.length} 項
                </span>
              </div>
              {pendingTodos.length === 0
                ? <div style={{ color: "#4ade80", fontWeight: 700 }}>✅ 沒有待辦事項！</div>
                : pendingTodos.map(t => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                    <span style={{ flex: 1, fontSize: 15, color: "#374151" }}>・{String(t.title)}</span>
                  </div>
                ))}
            </div>

            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 17, color: "#f97316", marginBottom: 14 }}>📖 英文作業</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                {["U1～5","U6～10"].map((label,i) => (
                  <button key={i} onClick={() => setEngSection(i)}
                    style={{ ...chipBtn, background: engSection === i ? "#f97316" : "#f3f4f6", color: engSection === i ? "#fff" : "#374151", padding: "8px 20px", fontSize: 14, fontWeight: 700 }}>
                    {label}
                  </button>
                ))}
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "8px", borderBottom: "2px solid #fed7aa", background: "#fff7ed" }}>Unit</th>
                      <th style={{ padding: "8px", borderBottom: "2px solid #fed7aa", background: "#fff7ed" }}>Part</th>
                      <th style={{ padding: "8px", borderBottom: "2px solid #fed7aa", background: "#f97316", color: "#fff" }}>狀態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {units.flatMap(u => parts.map((p, pi) => {
                      const key = `U${u}-P${p}-${student.number}`;
                      const done = !!engProgress[key];
                      return (
                        <tr key={`${u}-${p}`} style={{ background: pi % 2 === 0 ? "#fff" : "#fafafa" }}>
                          {pi === 0 && (
                            <td rowSpan={4} style={{ padding: "6px 10px", fontWeight: 800, fontSize: 14, color: "#f97316", borderRight: "2px solid #fed7aa", borderBottom: "2px solid #fed7aa", textAlign: "center", background: "#fff7ed" }}>U{u}</td>
                          )}
                          <td style={{ padding: "4px 10px", fontWeight: 700, fontSize: 12, color: "#ea580c", borderRight: "2px solid #fed7aa", borderBottom: pi === 3 ? "2px solid #fed7aa" : "1px solid #f3f4f6", textAlign: "center", background: "#fff7ed" }}>P{p}</td>
                          <td style={{ padding: "4px 10px", textAlign: "center", borderBottom: pi === 3 ? "2px solid #fed7aa" : "1px solid #f3f4f6" }}>
                            <span style={{ background: done ? "#4ade80" : "#f3f4f6", color: done ? "#14532d" : "#9ca3af", borderRadius: 6, padding: "3px 14px", fontWeight: 700, fontSize: 13 }}>
                              {done ? `✓ ${engProgress[key]}` : "未完成"}
                            </span>
                          </td>
                        </tr>
                      );
                    }))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </div>
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // MAIN APP
    // ═══════════════════════════════════════════════════════════════
    function App() {
      const [tab, setTab] = useState(0);
      const [students, setStudents] = useState([]);
      const [groups, setGroups] = useState([]); 
      const [assignments, setAssignments] = useState([]);
      const [progress, setProgress] = useState({});
      const [engProgress, setEngProgress] = useState({});
      const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
      const [todos, setTodos] = useState([]);
      const [syncStatus, setSyncStatus] = useState("synced"); 
      const [loadMsg, setLoadMsg] = useState("載入中…");
      const [loaded, setLoaded] = useState(false);
      const [role, setRole] = useState(null);
      const [currentStudent, setCurrentStudent] = useState(null);

      // ── Initial Cloud Load ────────────────────────────────────────────────
      useEffect(() => {
        (async () => {
          try {
            const data = await gsLoad();
            const s = (data.students || []).map(s => ({
              number: Number(s.number),
              name: String(s.name),
              password: s.password ? String(s.password) : String(Number(s.number)),
            }));
            setStudents(s);

            const g = (data.groups || []).map(grp => ({
              id: String(grp.id),
              name: String(grp.name),
              student_numbers: grp.student_numbers ? JSON.parse(grp.student_numbers) : []
            }));
            setGroups(g);

            // assignments：直接採用原始字串，完全不轉成 Date 物件
            const a = (data.assignments || []).map(a => ({
              id: Number(a.id),
              name: String(a.name),
              date: a.date ? String(a.date) : "",
              category: String(a.category || "其他"),
              assigned_to: a.assigned_to ? JSON.parse(a.assigned_to) : []
            }));
            setAssignments(a);

            const pm = {};
            (data.progress || []).forEach(({ assignment_id, student_number, status }) => {
              const aid = Number(assignment_id);
              if (!pm[aid]) pm[aid] = {};
              pm[aid][Number(student_number)] = Number(status);
            });
            setProgress(pm);

            const em = {};
            (data.english_progress || []).forEach(({ key, date }) => { em[key] = String(date); });
            setEngProgress(em);

            const cats = (data.categories || []).map(c => String(c.name)).filter(Boolean);
            if (cats.length) setCategories(cats);

            const todosData = (data.todos || []).map(t => ({
              id: String(t.id),
              title: String(t.title),
              student_number: Number(t.student_number),
              done: t.done === "true" || t.done === true,
            }));
            setTodos(todosData);

          } catch (err) {
            console.error("載入失敗：", err);
            setLoadMsg("⚠ 連線失敗，請重新整理頁面");
          } finally {
            setLoaded(true);
          }
        })();
      }, []);

      // ── Real-time Auto Backup (Debounced Cloud Sync) ────────────────────────
      const isFirstRender = useRef(true);

      const autoSave = useCallback(async () => {
        if (!loaded) return;
        setSyncStatus("saving");
        try {
          const progressRows = [];
          Object.entries(progress).forEach(([aid, sns]) => {
            Object.entries(sns).forEach(([sn, status]) => {
              progressRows.push({ assignment_id: aid, student_number: Number(sn), status });
            });
          });

          const epRows = Object.entries(engProgress).map(([key, date]) => ({ key, date: String(date) }));
          const catRows = categories.map(name => ({ name: String(name) }));
          const groupRows = groups.map(g => ({ id: g.id, name: String(g.name), student_numbers: JSON.stringify(g.student_numbers) }));
          const assignmentRows = assignments.map(a => ({ id: a.id, name: String(a.name), date: String(a.date || ""), category: String(a.category), assigned_to: JSON.stringify(a.assigned_to || []) }));

          await gsSave({
            students,
            groups: groupRows,
            assignments: assignmentRows,
            progress: progressRows,
            english_progress: epRows,
            categories: catRows,
            todos,
          });
          setSyncStatus("synced");
        } catch (e) {
          console.error("即時同步失敗:", e);
          setSyncStatus("error");
        }
      }, [students, groups, assignments, progress, engProgress, categories, todos, loaded]);

      useEffect(() => {
        if (isFirstRender.current) {
          if (loaded) isFirstRender.current = false;
          return;
        }

        setSyncStatus("saving");
        const timer = setTimeout(() => {
          autoSave();
        }, 1500);

        return () => clearTimeout(timer);
      }, [students, groups, assignments, progress, engProgress, categories, todos, autoSave]);

      const handleTeacherLogin = () => setRole("teacher");
      const handleParentLogin = (student) => { setRole("parent"); setCurrentStudent(student); };
      const handleLogout = () => { setRole(null); setCurrentStudent(null); };
      const handlePasswordChange = (studentNumber, newPw) => {
        setStudents(prev => prev.map(s => s.number === studentNumber ? { ...s, password: String(newPw) } : s));
      };

      if (!loaded) return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#f97316", fontSize: 20, fontWeight: 700 }}>
          {loadMsg}
        </div>
      );

      if (role === null) return (
        <LoginScreen students={students} onTeacherLogin={handleTeacherLogin} onParentLogin={handleParentLogin} />
      );

      if (role === "parent") return (
        <ParentView
          student={currentStudent}
          assignments={assignments}
          progress={progress}
          setProgress={setProgress}
          engProgress={engProgress}
          todos={todos}
          onLogout={handleLogout}
          onPasswordChange={handlePasswordChange}
        />
      );

      return (
        <div style={{ minHeight: "100vh", background: "#f9f7f4" }}>
          {/* Header */}
          <header style={{ background: "linear-gradient(135deg,#f97316,#fb923c)", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 12px rgba(249,115,22,0.2)" }}>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 22, letterSpacing: 1 }}>📚 班務作業系統</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 13, background: "rgba(255,255,255,0.2)", color: "#fff", padding: "4px 12px", borderRadius: 20, fontWeight: 600 }}>
                {syncStatus === "saving" && "🔄 雲端同步中..."}
                {syncStatus === "synced" && "☁️ 雲端備份完成"}
                {syncStatus === "error"  && "⚠️ 同步失敗，重試中"}
              </div>
              <button onClick={handleLogout} style={{ background: "#fff", color: "#f97316", border: "none", borderRadius: 8, padding: "6px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>登出</button>
            </div>
          </header>

          {/* Nav Tabs */}
          <nav style={{ display: "flex", background: "#fff", borderBottom: "2px solid #fed7aa", paddingLeft: 16, overflowX: "auto" }}>
            {TABS.map((t, i) => (
              <button key={i} onClick={() => setTab(i)} style={{
                padding: "12px 20px", border: "none", background: "none", cursor: "pointer",
                fontWeight: tab === i ? 800 : 500, fontSize: 15, whiteSpace: "nowrap",
                color: tab === i ? "#f97316" : "#6b7280",
                borderBottom: tab === i ? "3px solid #f97316" : "3px solid transparent",
              }}>{t}</button>
            ))}
          </nav>

          <main style={{ padding: "24px", maxWidth: 960, margin: "0 auto" }}>
            {tab === 0 && <StudentTab students={students} setStudents={setStudents} />}
            {tab === 1 && <GroupTab students={students} groups={groups} setGroups={setGroups} />}
            {tab === 2 && <DailyTab students={students} groups={groups} assignments={assignments} setAssignments={setAssignments} progress={progress} setProgress={setProgress} categories={categories} setCategories={setCategories} todos={todos} setTodos={setTodos} />}
            {tab === 3 && <EnglishTab students={students} engProgress={engProgress} setEngProgress={setEngProgress} />}
            {tab === 4 && <TodoTab students={students} groups={groups} todos={todos} setTodos={setTodos} />}
            {tab === 5 && <PrintTab students={students} assignments={assignments} progress={progress} engProgress={engProgress} categories={categories} groups={groups} />}
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
        setStudents(prev => [...prev, { number: n, name: String(name).trim() }].sort((a, b) => a.number - b.number));
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
          if (!isNaN(n) && nm && !students.find(s => s.number === n)) news.push({ number: n, name: String(nm) });
        }
        setStudents(prev => [...prev, ...news].sort((a, b) => a.number - b.number));
        setBulk(""); setShowBulk(false);
      };

      const del = (n) => setStudents(prev => prev.filter(s => s.number !== n));

      return (
        <div>
          <h2 style={h2}>👥 學生名單管理</h2>
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

          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 12, color: "#374151" }}>全班名單（{students.length} 人）</div>
            {students.length === 0 && <div style={{ color: "#9ca3af" }}>尚無學生</div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {students.map(s => (
                <div key={s.number} style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "6px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#f97316", fontWeight: 700 }}>{s.number}</span>
                  <span style={{ color: "#374151" }}>{s.name}</span>
                  <button onClick={() => del(s.number)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 16 }}>✕</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // TAB 2: 學生分組
    // ═══════════════════════════════════════════════════════════════
    function GroupTab({ students, groups, setGroups }) {
      const [groupName, setGroupName] = useState("");

      const addGroup = () => {
        if (!groupName.trim()) return;
        const newGroup = { id: String(Date.now()), name: String(groupName).trim(), student_numbers: [] };
        setGroups(prev => [...prev, newGroup]);
        setGroupName("");
      };

      const delGroup = (id) => {
        setGroups(prev => prev.filter(g => g.id !== id));
      };

      const toggleStudentInGroup = (groupId, studentNumber) => {
        setGroups(prev => prev.map(g => {
          if (g.id !== groupId) return g;
          const exists = g.student_numbers.includes(studentNumber);
          const newSns = exists
            ? g.student_numbers.filter(sn => sn !== studentNumber)
            : [...g.student_numbers, studentNumber].sort((a,b)=>a-b);
          return { ...g, student_numbers: newSns };
        }));
      };

      return (
        <div>
          <h2 style={h2}>🧩 學生分組管理</h2>
          
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 12, color: "#374151" }}>➕ 新增小組</div>
            <div style={{ display: "flex", gap: 10 }}>
              <input value={groupName} onChange={e => setGroupName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addGroup()}
                placeholder="組別名稱 (如: 第一組、英文加強組)..." style={{ ...inp, flex: 1 }} />
              <button onClick={addGroup} style={btnOrange}>建立組別</button>
            </div>
          </div>

          {groups.map(g => (
            <div key={g.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#f97316" }}>
                  🏆 {g.name} <span style={{ fontSize: 13, color: "#6b7280" }}>({g.student_numbers.length} 人)</span>
                </div>
                <button onClick={() => delGroup(g.id)} style={{ ...btnGray, color: "#ef4444", padding: "4px 10px", fontSize: 12 }}>刪除組別</button>
              </div>
              <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8 }}>點擊選擇加入或移除學生：</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {students.map(s => {
                  const inGroup = g.student_numbers.includes(s.number);
                  return (
                    <button key={s.number} onClick={() => toggleStudentInGroup(g.id, s.number)}
                      style={{
                        ...chipBtn,
                        background: inGroup ? "#f97316" : "#f3f4f6",
                        color: inGroup ? "#fff" : "#374151",
                        border: inGroup ? "none" : "1px solid #e5e7eb"
                      }}>
                      {s.number} {s.name} {inGroup && "✓"}
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
    // TAB 3: 每日進度 (增加日期欄位與修改名稱/日期)
    // ═══════════════════════════════════════════════════════════════
    function DailyTab({ students, groups, assignments, setAssignments, progress, setProgress, categories, setCategories, todos, setTodos }) {
      const [newAssign, setNewAssign] = useState("");
      const [newAssignDate, setNewAssignDate] = useState(today());
      const [newAssignCat, setNewAssignCat] = useState("");
      const [assignTarget, setAssignTarget] = useState("ALL"); 
      const [customStudents, setCustomStudents] = useState([]);
      const [editId, setEditId] = useState(null);
      const [editName, setEditName] = useState("");
      const [editDate, setEditDate] = useState("");
      const [filter, setFilter] = useState(null);
      const [catFilter, setCatFilter] = useState("全部");
      const [newCatName, setNewCatName] = useState("");
      const [showCatMgr, setShowCatMgr] = useState(false);

      useEffect(() => {
        if (!newAssignCat && categories.length) setNewAssignCat(categories[0]);
      }, [categories]);

      const addAssign = () => {
        const taskName = String(newAssign).trim();
        if (!taskName) return;
        
        let assignedTo = [];
        if (assignTarget === "ALL") {
          assignedTo = []; 
        } else if (assignTarget === "CUSTOM") {
          assignedTo = customStudents;
        } else {
          const grp = groups.find(g => g.id === assignTarget);
          assignedTo = grp ? grp.student_numbers : [];
        }

        const id = Date.now();
        setAssignments(prev => [{
          id,
          name: taskName, // 完全不轉換，輸入什麼就顯示什麼
          date: String(newAssignDate), // 儲存使用者選擇或輸入的日期
          category: newAssignCat || categories[0] || "其他",
          assigned_to: assignedTo
        }, ...prev]);
        setNewAssign("");
      };

      const delAssign = (id) => {
        setAssignments(prev => prev.filter(a => a.id !== id));
        setProgress(prev => { const n = { ...prev }; delete n[id]; return n; });
      };

      const saveEdit = (id) => {
        const updatedName = String(editName).trim();
        if (!updatedName) return alert("任務名稱不可為空");
        setAssignments(prev => prev.map(a => a.id === id ? { ...a, name: updatedName, date: String(editDate) } : a));
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
        const n = String(newCatName).trim();
        if (!n || categories.includes(n)) return;
        setCategories(prev => [...prev, n]);
        setNewCatName("");
      };

      const delCategory = (cat) => setCategories(prev => prev.filter(c => c !== cat));

      const visibleAssignments = catFilter === "全部"
        ? assignments
        : assignments.filter(a => a.category === catFilter);

      const unfinished = filter !== null
        ? visibleAssignments.filter(a => {
            const isAssigned = !a.assigned_to || a.assigned_to.length === 0 || a.assigned_to.includes(filter);
            return isAssigned && getStatus(a.id, filter) < 2;
          })
        : null;

      const catColors = ["#f97316","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#f59e0b","#10b981","#6366f1"];
      const catColor = (cat) => catColors[categories.indexOf(cat) % catColors.length] || "#f97316";

      return (
        <div>
          <h2 style={h2}>📋 每日進度</h2>

          {/* Category Manager */}
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
                      <button onClick={() => delCategory(cat)} style={{ background: "none", border: "none", cursor: "pointer", color: catColor(cat), fontSize: 14 }}>✕</button>
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

          {/* Add Assignment with Date Input */}
          <div style={card}>
            <div style={{ fontWeight: 700, color: "#374151", marginBottom: 12 }}>➕ 新增作業任務</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
              <select value={newAssignCat} onChange={e => setNewAssignCat(e.target.value)} style={{ ...inp, minWidth: 100, background: "#fff" }}>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
              <input value={newAssign} onChange={e => setNewAssign(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addAssign()}
                placeholder="作業名稱 (如：9/9)..." style={{ ...inp, flex: 1, minWidth: 180 }} />
              <input type="date" value={newAssignDate} onChange={e => setNewAssignDate(e.target.value)} style={{ ...inp, width: 140 }} />
              <button onClick={addAssign} style={btnOrange}>新增</button>
            </div>

            {/* Target Select */}
            <div style={{ background: "#fff7ed", padding: 12, borderRadius: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#ea580c", marginBottom: 6 }}>🎯 派發對象：</div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <label style={{ fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  <input type="radio" name="assignTarget" value="ALL" checked={assignTarget === "ALL"} onChange={() => setAssignTarget("ALL")} /> 全班
                </label>
                {groups.map(g => (
                  <label key={g.id} style={{ fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    <input type="radio" name="assignTarget" value={g.id} checked={assignTarget === g.id} onChange={() => setAssignTarget(g.id)} /> {g.name}
                  </label>
                ))}
                <label style={{ fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  <input type="radio" name="assignTarget" value="CUSTOM" checked={assignTarget === "CUSTOM"} onChange={() => setAssignTarget("CUSTOM")} /> 自訂學生
                </label>
              </div>

              {assignTarget === "CUSTOM" && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {students.map(s => {
                    const sel = customStudents.includes(s.number);
                    return (
                      <button key={s.number} onClick={() => {
                        setCustomStudents(prev => sel ? prev.filter(x => x !== s.number) : [...prev, s.number]);
                      }} style={{ ...chipBtn, padding: "3px 10px", fontSize: 12, background: sel ? "#ea580c" : "#fff", color: sel ? "#fff" : "#374151" }}>
                        {s.number} {s.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Category Filter */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
            {["全部", ...categories].map(cat => (
              <button key={cat} onClick={() => setCatFilter(cat)}
                style={{
                  ...chipBtn,
                  background: catFilter === cat ? (cat === "全部" ? "#374151" : catColor(cat)) : "#f3f4f6",
                  color: catFilter === cat ? "#fff" : "#374151",
                }}>{cat}</button>
            ))}
          </div>

          {/* Quick Search */}
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
                <div style={{ fontWeight: 700, color: "#f97316", marginBottom: 12, fontSize: 15 }}>
                  {students.find(s => s.number === filter)?.name} 未完成項目：
                </div>
                {unfinished.map(a => {
                  const st = getStatus(a.id, filter);
                  return (
                    <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", marginBottom: 8, background: "#f9f7f4", borderRadius: 10 }}>
                      <span style={{ background: catColor(a.category) + "22", color: catColor(a.category), borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{a.category}</span>
                      <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{a.name}</span>
                      <div style={{ display: "flex", gap: 6 }}>
                        {STATUS.map((label, i) => (
                          <button key={i} onClick={() => {
                            setProgress(prev => ({ ...prev, [a.id]: { ...prev[a.id], [filter]: i } }));
                          }} style={{
                            borderRadius: 8, padding: "4px 12px", cursor: "pointer", fontWeight: 700, fontSize: 13,
                            background: st === i ? STATUS_COLOR[i] : "#fff", border: "1px solid #ccc"
                          }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Assignments List */}
          {visibleAssignments.map(a => {
            const targetStudents = (!a.assigned_to || a.assigned_to.length === 0)
              ? students
              : students.filter(s => a.assigned_to.includes(s.number));

            return (
              <div key={a.id} style={{ ...card, borderLeft: `4px solid ${catColor(a.category)}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                  <span style={{ background: catColor(a.category) + "22", color: catColor(a.category), borderRadius: 10, padding: "2px 10px", fontSize: 12, fontWeight: 700 }}>{a.category}</span>
                  {editId === a.id ? (
                    <>
                      <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...inp, flex: 1 }} />
                      <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} style={{ ...inp, width: 140 }} />
                      <button onClick={() => saveEdit(a.id)} style={btnOrange}>儲存</button>
                      <button onClick={() => setEditId(null)} style={btnGray}>取消</button>
                    </>
                  ) : (
                    <>
                      <span style={{ fontWeight: 700, fontSize: 16, color: "#1f2937", flex: 1 }}>
                        {a.name}
                        {a.assigned_to && a.assigned_to.length > 0 && <span style={{ fontSize: 12, color: "#ea580c", ml: 2, background: "#fff7ed", padding: "2px 6px", borderRadius: 4 }}> (指定 {a.assigned_to.length} 人)</span>}
                      </span>
                      <span style={{ color: "#9ca3af", fontSize: 13 }}>{a.date || "無日期"}</span>
                      <button onClick={() => { setEditId(a.id); setEditName(a.name); setEditDate(a.date || ""); }} style={btnGray}>✏️</button>
                      <button onClick={() => delAssign(a.id)} style={{ ...btnGray, color: "#ef4444" }}>🗑</button>
                    </>
                  )}
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {targetStudents.map(s => {
                    const st = getStatus(a.id, s.number);
                    return (
                      <button key={s.number} onClick={() => cycleStatus(a.id, s.number)}
                        style={{ width: 52, padding: "4px 0", border: "none", borderRadius: 8, cursor: "pointer", background: STATUS_COLOR[st], fontWeight: 700, fontSize: 13 }}>
                        <div>{s.number}</div>
                        <div style={{ fontSize: 10 }}>{STATUS[st]}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // TAB 4: 英文作業
    // ═══════════════════════════════════════════════════════════════
    function EnglishTab({ students, engProgress, setEngProgress }) {
      const [section, setSection] = useState(0);
      const [datePopup, setDatePopup] = useState({ key: null, value: "" });
      const units = section === 0 ? [1, 2, 3, 4, 5] : [6, 7, 8, 9, 10];
      const parts = [1, 2, 3, 4];

      const handleClick = (u, p, sn) => {
        const key = `U${u}-P${p}-${sn}`;
        if (engProgress[key]) {
          setEngProgress(prev => { const n = { ...prev }; delete n[key]; return n; });
        } else {
          const now = new Date();
          setDatePopup({ key, value: `${now.getMonth() + 1}/${now.getDate()}` });
        }
      };

      const confirmDate = () => {
        if (!datePopup.key || !datePopup.value.trim()) return;
        setEngProgress(prev => ({ ...prev, [datePopup.key]: String(datePopup.value).trim() }));
        setDatePopup({ key: null, value: "" });
      };

      return (
        <div>
          <h2 style={h2}>📖 英文作業</h2>

          {datePopup.key && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 280, textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#f97316", marginBottom: 6 }}>✏️ 輸入完成日期</div>
                <input autoFocus value={datePopup.value} onChange={e => setDatePopup(prev => ({ ...prev, value: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && confirmDate()} placeholder="例：5/15"
                  style={{ ...inp, width: "100%", fontSize: 18, textAlign: "center", marginBottom: 16 }} />
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={confirmDate} style={{ ...btnOrange, flex: 1 }}>確認</button>
                  <button onClick={() => setDatePopup({ key: null, value: "" })} style={{ ...btnGray, flex: 1 }}>取消</button>
                </div>
              </div>
            </div>
          )}

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
                <tr>
                  <th style={{ padding: "8px", borderBottom: "2px solid #fed7aa", background: "#fff7ed" }}>Unit</th>
                  <th style={{ padding: "8px", borderBottom: "2px solid #fed7aa", background: "#fff7ed" }}>Part</th>
                  {students.map(s => (
                    <th key={s.number} style={{ padding: "8px", borderBottom: "2px solid #fed7aa", background: "#f97316", color: "#fff", fontSize: 12 }}>
                      <div>{s.number}</div>
                      <div>{s.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {units.flatMap(u => parts.map((p, pi) => (
                  <tr key={`${u}-${p}`} style={{ background: pi % 2 === 0 ? "#fff" : "#fafafa" }}>
                    {pi === 0 && (
                      <td rowSpan={4} style={{ padding: "6px", fontWeight: 800, fontSize: 14, color: "#f97316", borderRight: "2px solid #fed7aa", borderBottom: "2px solid #fed7aa", textAlign: "center", background: "#fff7ed" }}>
                        U{u}
                      </td>
                    )}
                    <td style={{ padding: "4px", fontWeight: 700, fontSize: 12, color: "#ea580c", borderRight: "2px solid #fed7aa", borderBottom: pi === 3 ? "2px solid #fed7aa" : "1px solid #f3f4f6", textAlign: "center", background: "#fff7ed" }}>
                      P{p}
                    </td>
                    {students.map(s => {
                      const key = `U${u}-P${p}-${s.number}`;
                      const done = !!engProgress[key];
                      return (
                        <td key={s.number} style={{ padding: 3, borderBottom: pi === 3 ? "2px solid #fed7aa" : "1px solid #f3f4f6", textAlign: "center" }}>
                          <button onClick={() => handleClick(u, p, s.number)}
                            style={{ width: "100%", padding: "5px 2px", border: "none", borderRadius: 6, cursor: "pointer", background: done ? "#4ade80" : "#f3f4f6", color: done ? "#14532d" : "#d1d5db", fontSize: 11, fontWeight: 700 }}>
                            {done ? "✓" : "－"}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // TAB 5: 待辦事項
    // ═══════════════════════════════════════════════════════════════
    function TodoTab({ students, groups, todos, setTodos }) {
      const [selectedStudent, setSelectedStudent] = useState(null);
      const [newTitles, setNewTitles] = useState("");
      const [selectedFor, setSelectedFor] = useState([]);

      const selectGroup = (grpId) => {
        const grp = groups.find(g => g.id === grpId);
        if (grp) setSelectedFor(grp.student_numbers);
      };

      const addTodo = () => {
        const lines = newTitles.split("\n").map(l => String(l).trim()).filter(Boolean);
        if (lines.length === 0 || selectedFor.length === 0) return;
        const ts = Date.now();
        const newItems = [];
        lines.forEach((title, li) => {
          selectedFor.forEach((sn, si) => {
            newItems.push({ id: `${ts}-${li}-${si}-${sn}`, title, student_number: sn, done: false });
          });
        });
        setTodos(prev => [...newItems, ...prev]);
        setNewTitles("");
        setSelectedFor([]);
      };

      const toggleDone = (id) => setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
      const deleteTodo = (id) => setTodos(prev => prev.filter(t => t.id !== id));

      const studentTodos = selectedStudent !== null ? todos.filter(t => t.student_number === selectedStudent) : [];

      return (
        <div>
          <h2 style={h2}>📝 待辦事項</h2>

          <div style={card}>
            <div style={{ fontWeight: 700, color: "#374151", marginBottom: 8 }}>➕ 新增待辦事項</div>
            <textarea value={newTitles} onChange={e => setNewTitles(e.target.value)}
              placeholder={"每行一項：\n國語第三課預習\n聯絡簿簽名"}
              style={{ ...inp, width: "100%", height: 90, resize: "vertical", marginBottom: 12 }} />

            <div style={{ fontWeight: 700, color: "#374151", marginBottom: 8, fontSize: 13 }}>快速選擇分組：</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <button onClick={() => setSelectedFor(students.map(s => s.number))} style={{ ...chipBtn, background: "#f97316", color: "#fff" }}>全班</button>
              {groups.map(g => (
                <button key={g.id} onClick={() => selectGroup(g.id)} style={{ ...chipBtn, background: "#fff7ed", color: "#ea580c", border: "1px solid #fed7aa" }}>{g.name}</button>
              ))}
              <button onClick={() => setSelectedFor([])} style={{ ...chipBtn, background: "#f3f4f6", color: "#374151" }}>清除</button>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
              {students.map(s => {
                const sel = selectedFor.includes(s.number);
                return (
                  <button key={s.number} onClick={() => setSelectedFor(prev => sel ? prev.filter(x=>x!==s.number) : [...prev, s.number])}
                    style={{ ...chipBtn, background: sel ? "#f97316" : "#f3f4f6", color: sel ? "#fff" : "#374151" }}>
                    {s.number} {s.name}
                  </button>
                );
              })}
            </div>

            <button onClick={addTodo} disabled={selectedFor.length === 0 || !newTitles.trim()} style={btnOrange}>
              新增至已選取的 {selectedFor.length} 位學生
            </button>
          </div>

          <div style={card}>
            <div style={{ fontWeight: 700, color: "#374151", marginBottom: 12 }}>👤 選擇學生查看待辦</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {students.map(s => (
                <button key={s.number} onClick={() => setSelectedStudent(selectedStudent === s.number ? null : s.number)}
                  style={{ ...chipBtn, background: selectedStudent === s.number ? "#f97316" : "#f3f4f6", color: selectedStudent === s.number ? "#fff" : "#374151" }}>
                  {s.number} {s.name}
                </button>
              ))}
            </div>
          </div>

          {selectedStudent !== null && (
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 17, color: "#f97316", marginBottom: 14 }}>
                {students.find(s => s.number === selectedStudent)?.name} 的待辦事項
              </div>
              {studentTodos.length === 0
                ? <div style={{ color: "#9ca3af", textAlign: "center" }}>沒有待辦事項 🎉</div>
                : studentTodos.map(t => (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                    <button onClick={() => toggleDone(t.id)} style={{ width: 24, height: 24, borderRadius: "50%", background: t.done ? "#4ade80" : "#fff", border: "1px solid #ccc", cursor: "pointer" }}>{t.done ? "✓" : ""}</button>
                    <span style={{ flex: 1, textDecoration: t.done ? "line-through" : "none", color: "#374151" }}>{t.title}</span>
                    <button onClick={() => deleteTodo(t.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "#ef4444" }}>🗑</button>
                  </div>
                ))}
            </div>
          )}
        </div>
      );
    }

    // ═══════════════════════════════════════════════════════════════
    // TAB 6: 表格列印
    // ═══════════════════════════════════════════════════════════════
    function PrintTab({ students, assignments, progress, engProgress, categories, groups }) {
      const [printType, setPrintType] = useState("overview");
      const getStatus = (aid, sn) => progress[aid]?.[sn] ?? 0;

      const openPrintWindow = () => {
        const w = window.open("", "print_preview", "width=900,height=720");
        if (!w) return alert("請允許彈出視窗");

        let content = "";
        if (printType === "overview") {
          const rows = assignments.map(a => `
            <tr>
              <td>${a.category}</td>
              <td style="text-align:left">${a.name} ${a.date ? `(${a.date})` : ''}</td>
              ${students.map(s => {
                const isAssigned = !a.assigned_to || a.assigned_to.length === 0 || a.assigned_to.includes(s.number);
                if (!isAssigned) return `<td style="background:#f3f4f6;color:#ccc">-</td>`;
                const st = getStatus(a.id, s.number);
                return `<td style="background:${STATUS_COLOR[st]}">${STATUS[st]}</td>`;
              }).join("")}
            </tr>
          `).join("");

          content = `
            <h3>進度總覽 — ${today()}</h3>
            <table border="1" style="border-collapse:collapse;width:100%;text-align:center">
              <thead>
                <tr><th>分類</th><th>作業</th>${students.map(s=>`<th>${s.number}<br>${s.name}</th>`).join("")}</tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          `;
        }

        w.document.write(`<html><head><title>列印</title><style>body{font-family:sans-serif;padding:20px}table{margin-top:10px}</style></head><body>
          <button onclick="window.print()" style="padding:8px 16px;background:#f97316;color:#fff;border:none;border-radius:4px;cursor:pointer">🖨 列印</button>
          ${content}
        </body></html>`);
        w.document.close();
      };

      return (
        <div>
          <h2 style={h2}>🖨 表格列印預覽</h2>
          <div style={card}>
            <button onClick={openPrintWindow} style={btnOrange}>🖨 開啟列印頁面</button>
          </div>
        </div>
      );
    }

    const container = document.getElementById('root');
    const root = ReactDOM.createRoot(container);
    root.render(<App />);
  </script>
</body>
</html>
