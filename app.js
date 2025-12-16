const LOGS_KEY = "fx_logs_v2";
const BAL_KEY  = "startingBalance";

function getStartingBalance(){
  const v = Number(localStorage.getItem(BAL_KEY));
  return v > 0 ? v : 46000;
}

function loadLogs(){
  try { return JSON.parse(localStorage.getItem(LOGS_KEY) || "[]"); }
  catch { return []; }
}

function saveLogs(logs){
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
}

function sortByDate(a,b){
  return new Date(a.date) - new Date(b.date);
}

function computeCurve(logs){
  const sorted = [...logs].sort(sortByDate);
  let equity = getStartingBalance();
  return sorted.map(x=>{
    equity += Number(x.pl || 0);
    return { date:x.date, pl:Number(x.pl||0), equity };
  });
}

function calcWinRate(logs){
  if(!logs.length) return 0;
  const wins = logs.filter(x => Number(x.pl) > 0).length;
  return wins / logs.length;
}

function calcMaxDrawdown(curve){
  let peak = -Infinity;
  let dd = 0; // negative
  for(const p of curve){
    peak = Math.max(peak, p.equity);
    dd = Math.min(dd, p.equity - peak);
  }
  return dd;
}

let chart;

function render(){
  const logs = loadLogs();
  const curve = computeCurve(logs);

  const start = getStartingBalance();
  const lastEquity = curve.length ? curve[curve.length-1].equity : start;
  const net = lastEquity - start;

  // cards
  const equityEl = document.getElementById("equity");
  const netEl    = document.getElementById("net");
  const wrEl     = document.getElementById("winrate");
  const ddEl     = document.getElementById("dd");

  equityEl.textContent = `$${lastEquity.toFixed(2)}`;

  netEl.textContent = `${net>=0?"+":""}$${net.toFixed(2)}`;
  netEl.className = "value " + (net>=0 ? "good" : "bad");

  const wr = calcWinRate(logs);
  wrEl.textContent = `${(wr*100).toFixed(1)}%`;

  const dd = calcMaxDrawdown(curve);
  ddEl.textContent = `$${dd.toFixed(2)}`;
  ddEl.className = "value " + (dd < 0 ? "bad" : "good");

  // table
  const tbody = document.getElementById("table");
  tbody.innerHTML = "";
  const desc = [...curve].sort((a,b)=> new Date(b.date) - new Date(a.date));

  desc.forEach(row=>{
    const tr = document.createElement("tr");
    const plClass = row.pl >= 0 ? "good" : "bad";
    tr.innerHTML = `
      <td>${row.date}</td>
      <td class="${plClass}">${row.pl>=0?"+":""}$${row.pl.toFixed(2)}</td>
      <td>$${row.equity.toFixed(2)}</td>
      <td><button data-date="${row.date}">حذف</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("button").forEach(btn=>{
    btn.onclick = () => {
      const date = btn.getAttribute("data-date");
      const next = loadLogs().filter(x => x.date !== date);
      saveLogs(next);
      render();
    };
  });

  // chart
  const labels = curve.map(x=>x.date);
  const values = curve.map(x=>x.equity);
  const ctx = document.getElementById("chart");

  if(chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ label:"Balance", data: values, tension:0.3 }] },
    options: { responsive:true, plugins:{ legend:{ display:false } } }
  });

  // tips
  const tips = [];
  if(curve.length >= 5){
    const ddPct = Math.abs(dd) / start;
    if(ddPct > 0.1) tips.push("الـ Drawdown عالي: قلّل المخاطرة أو حجم اللوت مؤقتًا.");
    if(wr < 0.4) tips.push("Win Rate منخفض: راجع شروط الدخول أو قلّل عدد الصفقات.");
    if(net < 0) tips.push("صافي الربح سلبي: جرّب التركيز على صفقات أقل وجودة أعلى.");
  } else {
    tips.push("أضف بيانات عدة أيام ليظهر تحليل أدق.");
  }
  document.getElementById("tips").innerHTML = tips.map(t=>`<li>${t}</li>`).join("");
}

// actions
document.getElementById("addDay").onclick = () => {
  const date = document.getElementById("date").value;
  const pl = Number(document.getElementById("pl").value);
  if(!date || Number.isNaN(pl)) return alert("اكتب التاريخ والربح/الخسارة");

  const logs = loadLogs().filter(x => x.date !== date);
  logs.push({ date, pl });
  saveLogs(logs);

  document.getElementById("pl").value = "";
  render();
};

document.getElementById("saveInitial").onclick = () => {
  const v = Number(document.getElementById("initialBalanceInput").value);
  if(!v || v <= 0) return alert("أدخل رقم صحيح");
  localStorage.setItem(BAL_KEY, v);
  render();
  alert("تم حفظ الرصيد الابتدائي ✅");
};

document.getElementById("clearData").onclick = () => {
  if(confirm("تأكيد حذف كل البيانات؟")){
    localStorage.removeItem(LOGS_KEY);
    render();
  }
};

document.getElementById("exportCsv").onclick = () => {
  const logs = loadLogs().sort(sortByDate);
  const curve = computeCurve(logs);
  const rows = [["date","daily_pl","balance"]];
  curve.forEach(r => rows.push([r.date, r.pl, r.equity]));
  const csv = rows.map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type:"text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "forex-journal.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

render();
