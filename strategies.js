const STRAT_KEY = "fx_strategies_v2";
const THEME_KEY = "fx_theme";

function applyTheme(){
  const t = localStorage.getItem(THEME_KEY) || "dark";
  document.body.classList.toggle("light", t === "light");
}
applyTheme();

document.getElementById("toggleTheme").onclick = () => {
  const isLight = document.body.classList.contains("light");
  localStorage.setItem(THEME_KEY, isLight ? "dark" : "light");
  applyTheme();
};

function loadStrats(){
  try { return JSON.parse(localStorage.getItem(STRAT_KEY) || "[]"); }
  catch { return []; }
}
function saveStrats(a){
  localStorage.setItem(STRAT_KEY, JSON.stringify(a));
}

function n(v){ return Number(v || 0); }
function pct(x){ return (x*100).toFixed(1) + "%"; }
function clampNonNeg(x){ return Number.isFinite(x) ? Math.max(0, Math.floor(x)) : 0; }

function rates(s){
  const t = Math.max(0, n(s.trades));
  if(t === 0) return { tp1:0, tp2:0, be:0, sl:0 };
  return { tp1:n(s.tp1)/t, tp2:n(s.tp2)/t, be:n(s.be)/t, sl:n(s.sl)/t };
}

// Score: TP2 أعلى، TP1 متوسط، BE قليل، SL خصم
function score(s){
  const t = Math.max(1, n(s.trades));
  const tp1 = n(s.tp1), tp2 = n(s.tp2), be = n(s.be), sl = n(s.sl);
  return (tp2*2 + tp1*1 + be*0.2 - sl*1.5) / t;
}

function analysis(s){
  const r = rates(s);
  const strengths = [];
  const weaknesses = [];
  const tips = [];

  if(r.tp2 >= 0.25) strengths.push("وصول TP2 عالي");
  if(r.tp1 >= 0.45) strengths.push("وصول TP1 ممتاز");
  if(r.sl <= 0.20) strengths.push("ستوب منخفض (تحكم بالمخاطرة)");
  if(r.be >= 0.20) strengths.push("تأمين دخول جيد (BE)");

  if(r.sl >= 0.30) weaknesses.push("الستوب عالي");
  if(r.tp2 < 0.10) weaknesses.push("وصول TP2 ضعيف");
  if(r.tp1 < 0.25) weaknesses.push("وصول TP1 ضعيف");
  if(r.be < 0.05) weaknesses.push("التأمين قليل");

  if(r.sl >= 0.30) tips.push("خفف المخاطرة أو حسّن شروط الدخول/الوقف.");
  if(r.tp1 >= 0.40 && r.tp2 < 0.12) tips.push("جرّب تقسيم العقود: جزء عند TP1 وجزء يترك لـ TP2.");
  if(r.be >= 0.30 && r.tp2 < 0.12) tips.push("قد تكون تحرّك الوقف مبكرًا؛ جرّب تأخير BE قليلًا.");
  if(r.tp1 < 0.25 && r.sl >= 0.30) tips.push("احتاج فلترة أقوى (وقت/جلسة/منطقة).");
  if(tips.length === 0) tips.push("استمر وراقب الأداء مع زيادة العينة (Trades أكثر).");

  return {
    strengths: strengths.length ? strengths.join("، ") : "لا توجد نقاط واضحة بعد (عينة قليلة).",
    weaknesses: weaknesses.length ? weaknesses.join("، ") : "لا توجد نقاط ضعف واضحة حاليًا.",
    tip: tips[0]
  };
}

function render(){
  const arr = loadStrats();
  const sorted = [...arr].sort((a,b)=> score(b) - score(a));

  // table
  const tb = document.getElementById("s_table");
  tb.innerHTML = "";

  sorted.forEach(s=>{
    const r = rates(s);
    const a = analysis(s);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><b>${s.name}</b><div style="color:var(--muted);font-size:12px;">${s.notes || ""}</div></td>
      <td>${s.trades}</td>
      <td>${s.tp1}</td>
      <td>${s.tp2}</td>
      <td>${s.be}</td>
      <td>${s.sl}</td>
      <td style="white-space:nowrap;">
        TP1 ${pct(r.tp1)}<br/>
        TP2 ${pct(r.tp2)}<br/>
        BE ${pct(r.be)}<br/>
        SL ${pct(r.sl)}
      </td>
      <td>
        <div><b>قوة:</b> ${a.strengths}</div>
        <div><b>ضعف:</b> ${a.weaknesses}</div>
        <div><b>نصيحة:</b> ${a.tip}</div>
      </td>
      <td style="white-space:nowrap;">
        <button class="btn" data-edit="${s.id}">تعديل</button>
        <button class="btn danger" data-del="${s.id}">حذف</button>
      </td>
    `;
    tb.appendChild(tr);
  });

  tb.querySelectorAll("button[data-del]").forEach(btn=>{
    btn.onclick = () => {
      const id = btn.getAttribute("data-del");
      const next = loadStrats().filter(x => x.id !== id);
      saveStrats(next);
      render();
    };
  });

  tb.querySelectorAll("button[data-edit]").forEach(btn=>{
    btn.onclick = () => {
      const id = btn.getAttribute("data-edit");
      const s = loadStrats().find(x => x.id === id);
      if(!s) return;
      document.getElementById("s_name").value = s.name;
      document.getElementById("s_trades").value = s.trades;
      document.getElementById("s_tp1").value = s.tp1;
      document.getElementById("s_tp2").value = s.tp2;
      document.getElementById("s_be").value = s.be;
      document.getElementById("s_sl").value = s.sl;
      document.getElementById("s_notes").value = s.notes || "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
  });

  // top 3
  const top = document.getElementById("top3");
  top.innerHTML = "";
  const top3 = sorted.slice(0,3);

  if(top3.length === 0){
    top.innerHTML = `<div class="miniCard"><div class="label">Top 3</div><div class="value">لا توجد بيانات بعد</div></div>`;
    return;
  }

  top3.forEach((s, idx)=>{
    const a = analysis(s);
    const div = document.createElement("div");
    div.className = "miniCard";
    div.innerHTML = `
      <div class="label">#${idx+1} أفضلية</div>
      <div class="value">${s.name}</div>
      <div style="color:var(--muted);margin-top:6px;">Score: ${score(s).toFixed(3)}</div>
      <div style="margin-top:8px;"><b>قوتها:</b> ${a.strengths}</div>
      <div style="margin-top:6px;"><b>ضعفها:</b> ${a.weaknesses}</div>
      <div style="margin-top:6px;"><b>نصيحة:</b> ${a.tip}</div>
    `;
    top.appendChild(div);
  });
}

// Save (add/update by name)
document.getElementById("s_add").onclick = () => {
  const name = document.getElementById("s_name").value.trim();
  const trades = clampNonNeg(n(document.getElementById("s_trades").value));
  const tp1 = clampNonNeg(n(document.getElementById("s_tp1").value));
  const tp2 = clampNonNeg(n(document.getElementById("s_tp2").value));
  const be  = clampNonNeg(n(document.getElementById("s_be").value));
  const sl  = clampNonNeg(n(document.getElementById("s_sl").value));
  const notes = document.getElementById("s_notes").value.trim();

  if(!name) return alert("اكتب اسم الاستراتيجية");
  if(trades <= 0) return alert("اكتب عدد صفقات صحيح");

  const sum = tp1 + tp2 + be + sl;
  if(sum > trades) return alert("مجموع TP1+TP2+BE+SL لازم يكون ≤ عدد الصفقات");

  const arr = loadStrats();
  const existing = arr.find(x => (x.name||"").toLowerCase() === name.toLowerCase());
  if(existing){
    existing.trades = trades;
    existing.tp1 = tp1;
    existing.tp2 = tp2;
    existing.be = be;
    existing.sl = sl;
    existing.notes = notes;
  } else {
    arr.push({
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      name, trades, tp1, tp2, be, sl, notes
    });
  }
  saveStrats(arr);

  document.getElementById("s_name").value = "";
  document.getElementById("s_trades").value = "";
  document.getElementById("s_tp1").value = "";
  document.getElementById("s_tp2").value = "";
  document.getElementById("s_be").value = "";
  document.getElementById("s_sl").value = "";
  document.getElementById("s_notes").value = "";

  render();
};

document.getElementById("s_clear").onclick = () => {
  if(confirm("تأكيد حذف كل الاستراتيجيات؟")){
    localStorage.removeItem(STRAT_KEY);
    render();
  }
};

render();
