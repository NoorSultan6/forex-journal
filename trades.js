const TRADES_KEY = "fx_trades_v1";
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
  render();
};

function loadTrades(){
  try { return JSON.parse(localStorage.getItem(TRADES_KEY) || "[]"); }
  catch { return []; }
}
function saveTrades(t){ localStorage.setItem(TRADES_KEY, JSON.stringify(t)); }
function sortByDate(a,b){ return new Date(a.date) - new Date(b.date); }
function money(n){ const s=n>=0?"+":""; return `${s}$${Number(n).toFixed(2)}`; }

let curveChart;

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

function render(){
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
      <td>${t.size ?? ""}</td>
      <td class="${cls}">${money(Number(t.result||0))}</td>
      <td>${t.pips ?? ""}</td>
      <td>${t.notes ?? ""}</td>
      <td><button class="btn" data-id="${t.id}">حذف</button></td>
    `;
    tb.appendChild(tr);
  });

  tb.querySelectorAll("button").forEach(btn=>{
    btn.onclick = () => {
      const id = btn.getAttribute("data-id");
      const next = loadTrades().filter(x=> x.id !== id);
      saveTrades(next);
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
  const size = Number(document.getElementById("t_size").value || 0);
  const result = Number(document.getElementById("t_result").value);
  const pips = document.getElementById("t_pips").value;
  const notes = document.getElementById("t_notes").value.trim();

  if(!date || !pair || Number.isNaN(result)) return alert("اكتب التاريخ + الزوج + Result $");

  const trades = loadTrades();
  trades.push({
    id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    date, pair, type,
    size: size || "",
    result,
    pips: pips ? Number(pips) : "",
    notes
  });
  saveTrades(trades);

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
  const rows = [["date","pair","type","size","result","pips","notes"]];
  trades.forEach(t => rows.push([t.date, (t.pair||"").toUpperCase(), t.type, t.size, t.result, t.pips, (t.notes||"").replaceAll(",", " ")]));
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
