const TRADES_KEY = "fx_trades_v2";
const STRAT_KEY  = "fx_strategies_v2";
const THEME_KEY  = "fx_theme";

function applyTheme(){
  const t = localStorage.getItem(THEME_KEY) || "dark";
  document.body.classList.toggle("light", t === "light");
}
applyTheme();

document.getElementById("toggleTheme").onclick = () => {
  const isLight = document.body.classList.contains("light");
  localStorage.setItem(THEME_KEY, isLight ? "dark" : "light");
  applyTheme();
  render();
};

function loadTrades(){
  try { return JSON.parse(localStorage.getItem(TRADES_KEY) || "[]"); }
  catch { return []; }
}
function saveTrades(t){ localStorage.setItem(TRADES_KEY, JSON.stringify(t)); }

function loadStrats(){
  try { return JSON.parse(localStorage.getItem(STRAT_KEY) || "[]"); }
  catch { return []; }
}
function saveStrats(a){ localStorage.setItem(STRAT_KEY, JSON.stringify(a)); }

function sortByDate(a,b){ return new Date(a.date) - new Date(b.date); }
function money(n){ const s=n>=0?"+":""; return `${s}$${Number(n).toFixed(2)}`; }

function ensureStrategyByName(name){
  const n = (name||"").trim();
  if(!n) return null;
  const arr = loadStrats();
  let s = arr.find(x => (x.name||"").toLowerCase() === n.toLowerCase());
  if(!s){
    s = { id:`${Date.now()}_${Math.random().toString(16).slice(2)}`, name:n, trades:0, tp1:0, tp2:0, be:0, sl:0, notes:"" };
    arr.push(s);
    saveStrats(arr);
  }
  return s;
}

function incStrategyOutcome(strategyName, outcome){
  if(!strategyName) return;
  const arr = loadStrats();
  const s = arr.find(x => (x.name||"").toLowerCase() === strategyName.toLowerCase());
  if(!s) return;

  s.trades = Number(s.trades||0) + 1;
  if(outcome === "TP1") s.tp1 = Number(s.tp1||0) + 1;
  if(outcome === "TP2") s.tp2 = Number(s.tp2||0) + 1;
  if(outcome === "BE")  s.be  = Number(s.be||0) + 1;
  if(outcome === "SL")  s.sl  = Number(s.sl||0) + 1;

  saveStrats(arr);
}

function decStrategyOutcome(strategyName, outcome){
  if(!strategyName) return;
  const arr = loadStrats();
  const s = arr.find(x => (x.name||"").toLowerCase() === strategyName.toLowerCase());
  if(!s) return;

  const dec = (k) => s[k] = Math.max(0, Number(s[k]||0) - 1);
  dec("trades");
  if(outcome === "TP1") dec("tp1");
  if(outcome === "TP2") dec("tp2");
  if(outcome === "BE")  dec("be");
  if(outcome === "SL")  dec("sl");

  saveStrats(arr);
}

function fillStrategyDropdown(){
  const sel = document.getElementById("t_strategy");
  const current = sel.value;
  const arr = loadStrats().sort((a,b)=> (a.name||"").localeCompare(b.name||""));
  sel.innerHTML = `<option value="">Strategy (اختياري)</option>` + arr.map(s=>`<option value="${s.name}">${s.name}</option>`).join("");
  if(current) sel.value = current;
}

function stats(trades){
  const total = trades.length;
  const wins = trades.filter(t=> Number(t.result)>0);
  const losses = trades.filter(t=> Number(t.result)<0);

  const winRate = total ? (wins.length/total) : 0;
  const best = total ? Math.max(...trades.map(t=>Number(t.result||0))) : 0;
  const worst = total ? Math.min(...trades.map(t=>Number(t.result||0))) : 0;

  const grossWin = wins.reduce((s,t)=> s+Number(t.result), 0);
  const grossLossAbs = Math.abs(losses.reduce((s,t)=> s+Number(t.result), 0));
  const profitFactor = grossLossAbs > 0 ? (grossWin / grossLossAbs) : (grossWin>0 ? 999 : 0);

  const avgWin = wins.length ? grossWin / wins.length : 0;
  const avgLoss = losses.length ? (losses.reduce((s,t)=> s+Number(t.result),0) / losses.length) : 0; // negative
  const expectancy = (winRate * avgWin) + ((1-winRate) * avgLoss);

  return { total, winRate, best, worst, profitFactor, expectancy };
}

let curveChart;

function render(){
  fillStrategyDropdown();

  const trades = loadTrades().sort(sortByDate);

  const s = stats(trades);
  document.getElementById("t_total").textContent = s.total;
  document.getElementById("t_wr").textContent = `${(s.winRate*100).toFixed(1)}%`;
  document.getElementById("t_best").textContent = money(s.best);
  document.getElementById("t_worst").textContent = money(s.worst);

  // table
  const tb = document.getElementById("t_table");
  tb.innerHTML = "";
  const desc = [...trades].sort((a,b)=> new Date(b.date)-new Date(a.date));
  desc.forEach(t=>{
    const cls = Number(t.result)>=0 ? "good":"bad";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.date||""}</td>
      <td>${(t.pair||"").toUpperCase()}</td>
      <td>${t.type||""}</td>
      <td>${t.strategy || ""}</td>
      <td>${t.outcome || ""}</td>
      <td>${t.size ?? ""}</td>
      <td class="${cls}">${money(Number(t.result||0))}</td>
      <td>${t.pips ?? ""}</td>
      <td>${t.notes ?? ""}</td>
      <td><button class="btn danger" data-id="${t.id}">حذف</button></td>
    `;
    tb.appendChild(tr);
  });

  tb.querySelectorAll("button").forEach(btn=>{
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      const all = loadTrades();
      const found = all.find(x => x.id === id);
      const next = all.filter(x=> x.id !== id);
      saveTrades(next);

      // rollback strategy counters if linked
      if(found?.strategy && found?.outcome){
        decStrategyOutcome(found.strategy, found.outcome);
      }

      render();
    };
  });

  // cumulative curve
  let cum = 0;
  const labels = trades.map((t,i)=> `${t.date || ""} #${i+1}`);
  const vals = trades.map(t=> (cum += Number(t.result||0)));

  const ctx = document.getElementById("tradeCurve");
  if(curveChart) curveChart.destroy();
  curveChart = new Chart(ctx, {
    type:"line",
    data:{ labels, datasets:[{ data: vals, tension:0.35, borderWidth:3, pointRadius:0, fill:true }] },
    options:{ responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:false } }, interaction:{ mode:"index", intersect:false } }
  });

  // tips
  const tips = [];
  if(trades.length >= 10){
    if(s.profitFactor < 1) tips.push("Profit Factor أقل من 1: راقب متوسط الخسارة وحاول تقليلها.");
    if(s.winRate < 0.45) tips.push("Win Rate منخفض: ركّز على جودة الدخول أو قلل التذبذب.");
    if(s.expectancy < 0) tips.push("Expectancy سلبي: غيّر استراتيجية الخروج/الوقف أو حسّن R:R.");
  } else {
    tips.push("أضف 10 صفقات على الأقل ليظهر تحليل أدق.");
  }
  tips.push(`Profit Factor: ${s.profitFactor.toFixed(2)} | Expectancy: ${money(s.expectancy)}`);
  document.getElementById("t_tips").innerHTML = tips.map(x=>`<li>${x}</li>`).join("");
}

// add trade
document.getElementById("t_add").onclick = () => {
  const date = document.getElementById("t_date").value;
  const pair = document.getElementById("t_pair").value.trim();
  const type = document.getElementById("t_type").value;
  const strategy = document.getElementById("t_strategy").value || "";
  const outcome = document.getElementById("t_outcome").value;
  const size = Number(document.getElementById("t_size").value || 0);
  const result = Number(document.getElementById("t_result").value);
  const pips = document.getElementById("t_pips").value;
  const notes = document.getElementById("t_notes").value.trim();

  if(!date || !pair || Number.isNaN(result)) return alert("اكتب التاريخ + الزوج + Result $");

  // if user typed a new strategy name manually (optional future), ensure exists:
  if(strategy) ensureStrategyByName(strategy);

  const trades = loadTrades();
  trades.push({
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    date, pair, type,
    strategy,
    outcome,
    size: size || "",
    result,
    pips: pips ? Number(pips) : "",
    notes
  });
  saveTrades(trades);

  // update strategy counters
  if(strategy && outcome) incStrategyOutcome(strategy, outcome);

  document.getElementById("t_result").value = "";
  document.getElementById("t_notes").value = "";
  render();
};

document.getElementById("t_clear").onclick = () => {
  if(confirm("تأكيد حذف كل الصفقات؟")){
    localStorage.removeItem(TRADES_KEY);
    render();
  }
};

document.getElementById("t_export").onclick = () => {
  const trades = loadTrades().sort(sortByDate);
  const rows = [["date","pair","type","strategy","outcome","size","result","pips","notes"]];
  trades.forEach(t => rows.push([
    t.date,
    (t.pair||"").toUpperCase(),
    t.type,
    t.strategy || "",
    t.outcome || "",
    t.size,
    t.result,
    t.pips,
    (t.notes||"").replaceAll(",", " ")
  ]));
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "forex-trades.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

render();
