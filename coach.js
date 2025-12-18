// تخزين الصفقات (نستعمل نفس المفتاح الشائع)
const TRADES_KEY = "trades";
const EVAL_KEY = "evaluations";

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}
function saveJSON(key, v) { localStorage.setItem(key, JSON.stringify(v)); }

function computeScore(f) {
  let s = 5;
  if (f.followedPlan) s += 2;
  if (f.hadClearSetup) s += 2;
  if (f.riskOk) s += 1.5;
  if (f.waitedForConfirmation) s += 1.5;

  if (f.revengeTrade) s -= 3;
  if (f.overtraded) s -= 2;

  s = Math.max(0, Math.min(10, s));
  return Math.round(s * 10) / 10;
}

const el = (id) => document.getElementById(id);

let trades = [];
let evaluations = [];
let currentId = "";

let form = {
  followedPlan: true,
  hadClearSetup: true,
  riskOk: true,
  waitedForConfirmation: true,
  revengeTrade: false,
  overtraded: false,
  notes: ""
};

function evalMap() {
  const m = {};
  evaluations.forEach(e => (m[e.tradeId] = e));
  return m;
}

function renderSelect() {
  const sel = el("tradeSelect");
  sel.innerHTML = "";

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "— اختر صفقة —";
  sel.appendChild(opt0);

  // ترتيب أحدث أول
  trades.slice().sort((a,b)=> new Date(b.date)-new Date(a.date)).forEach(t=>{
    const opt = document.createElement("option");
    opt.value = t.id || t.tradeId || "";
    opt.textContent = `${t.date || ""} • ${t.pair || ""} • ${t.type || ""} • ${(t.result ?? 0)}$`;
    sel.appendChild(opt);
  });
}

function renderTradeInfo(trade, score) {
  const box = el("tradeInfo");
  box.innerHTML = "";
  if (!trade) return;

  const pills = [
    `Pair: ${trade.pair || "-"}`,
    `Type: ${trade.type || "-"}`,
    `Result: ${(trade.result ?? 0)}$`,
    `Score: ${score}/10`,
  ];

  pills.forEach(p=>{
    const d = document.createElement("div");
    d.className = "pill";
    d.textContent = p;
    box.appendChild(d);
  });
}

function updateButtons() {
  document.querySelectorAll(".toggle").forEach(btn=>{
    const k = btn.getAttribute("data-k");
    const on = !!form[k];
    btn.classList.toggle("on", on);
  });
}

function updateScoreAndVerdict() {
  if (!currentId) { el("score").textContent = "—"; el("verdict").textContent = ""; return; }

  const score = computeScore({ ...form });
  el("score").textContent = score;

  const trade = trades.find(t => (t.id || t.tradeId) === currentId);
  renderTradeInfo(trade, score);

  // مرآة قاسية:
  let msg = "📌 ركّز على جودة القرار قبل التفكير بالنتيجة.";
  if (trade && typeof trade.result === "number") {
    if (trade.result > 0 && score < 6) msg = "✅ ربحت… لكن القرار كان ضعيف. لا تكرر نفس الأسلوب.";
    if (trade.result < 0 && score >= 7) msg = "✅ خسرت… لكن القرار ممتاز. هذا تداول احترافي.";
    if (trade.result < 0 && score < 6) msg = "⚠️ خسارة + قرار ضعيف: هنا السبب الحقيقي لنزيف الحساب.";
  }
  el("verdict").textContent = msg;
}

function loadExistingEvaluation() {
  const m = evalMap();
  const e = m[currentId];
  if (!e) return;

  form.followedPlan = !!e.followedPlan;
  form.hadClearSetup = !!e.hadClearSetup;
  form.riskOk = !!e.riskOk;
  form.waitedForConfirmation = !!e.waitedForConfirmation;
  form.revengeTrade = !!e.revengeTrade;
  form.overtraded = !!e.overtraded;
  form.notes = e.notes || "";
  el("notes").value = form.notes;
}

function saveEvaluation() {
  if (!currentId) return;
  const score = computeScore(form);

  const item = {
    tradeId: currentId,
    score,
    ...form,
    createdAt: new Date().toISOString()
  };

  evaluations = evaluations.filter(x => x.tradeId !== currentId).concat(item);
  saveJSON(EVAL_KEY, evaluations);
  updateScoreAndVerdict();
}

function init() {
  trades = loadJSON(TRADES_KEY, []);
  evaluations = loadJSON(EVAL_KEY, []);

  renderSelect();

  el("tradeSelect").addEventListener("change", (e)=>{
    currentId = e.target.value;
    // reset default
    form = {
      followedPlan: true,
      hadClearSetup: true,
      riskOk: true,
      waitedForConfirmation: true,
      revengeTrade: false,
      overtraded: false,
      notes: ""
    };
    el("notes").value = "";
    loadExistingEvaluation();
    updateButtons();
    updateScoreAndVerdict();
  });

  document.querySelectorAll(".toggle").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      if (!currentId) return;
      const k = btn.getAttribute("data-k");
      form[k] = !form[k];
      updateButtons();
      updateScoreAndVerdict();
    });
  });

  el("notes").addEventListener("input", (e)=>{
    form.notes = e.target.value;
    updateScoreAndVerdict();
  });

  el("saveBtn").addEventListener("click", saveEvaluation);

  updateButtons();
  updateScoreAndVerdict();
}

init();
