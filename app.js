// ===== Keys =====
const LOGS_KEY = "fx_logs_v3";
const BAL_KEY  = "startingBalance";
const THEME_KEY = "fx_theme";

// ===== Helpers =====
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
function sortByDate(a,b){ return new Date(a.date) - new Date(b.date); }

function fmtMoney(n){
  const sign = n >= 0 ? "+" : "";
  return `${sign}$${Number(n).toFixed(2)}`;
}

function applyTheme(){
  const t = localStorage.getItem(THEME_KEY) || "dark";
  document.body.classList.toggle("light", t === "light");
}
applyTheme();

// equity curve from daily logs
function computeCurve(logs){
  const sorted = [...logs].sort(sortByDate);
  let equity = getStartingBalance();
  return sorted.map(x=>{
    equity += Number(x.pl || 0);
    return { date:x.date, pl:Number(x.pl||0), equity };
  });
}

// drawdown series (equity - peak)
function computeDrawdown(curve){
  let peak = -Infinity;
  return curve.map(p=>{
    peak = Math.max(peak, p.equity);
    return { date: p.date, dd: p.equity - peak }; // <= 0
  });
}
function calcMaxDrawdown(ddSeries){
  let m = 0;
  for(const p of ddSeries) m = Math.min(m, p.dd);
  return m;
}
function calcWinRateDays(logs){
  if(!logs.length) return 0;
  const wins = logs.filter(x => Number(x.pl) > 0).length;
  return wins / logs.length;
}

// monthly aggregation from daily logs
function computeMonthly(logs){
  const map = new Map();
  for(const x of logs){
    if(!x.date) continue;
    const ym = x.date.slice(0,7);
    const pl = Number(x.pl||0);
    const prev = map.get(ym) || { sum:0, count:0 };
    map.set(ym, { sum: prev.sum + pl, count: prev.count + 1 });
  }
  return [...map.entries()]
    .map(([ym, v]) => ({ ym, ...v }))
    .sort((a,b)=> a.ym.localeCompare(b.ym));
}

// ===== Charts =====
let equityChart, ddChart;

function renderCharts(curve, ddSeries){
  const labels = curve.map(x=>x.date);
  const values = curve.map(x=>x.equity);
  const start = getStartingBalance();
  const last = values.length ? values[values.length-1] : start;
  const up = last >= start;

  const baseline = labels.map(()=> start);

  // equity chart
  const ctx1 = document.getElementById("equityChart");
  if(equityChart) equityChart.destroy();

  equityChart = new Chart(ctx1, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Balance",
          data: values,
          tension: 0.35,
          pointRadius: 2,
          pointHoverRadius: 6,
          borderWidth: 3,
          fill: true,
          backgroundColor: (context) => {
            const chart = context.chart;
            const {ctx, chartArea} = chart;
            if(!chartArea) return "rgba(34,197,94,0.12)";
            const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            if(up){
              g.addColorStop(0, "rgba(34,197,94,0.25)");
              g.addColorStop(1, "rgba(34,197,94,0.02)");
            } else {
              g.addColorStop(0, "rgba(239,68,68,0.22)");
              g.addColorStop(1, "rgba(239,68,68,0.02)");
            }
            return g;
          },
          borderColor: up ? "rgb(34,197,94)" : "rgb(239,68,68)"
        },
        {
          label: "Starting Balance",
          data: baseline,
          tension: 0,
          pointRadius: 0,
          borderWidth: 2,
          borderDash: [6,6],
          borderColor: "rgba(156,163,175,0.9)"
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: (ctx) => ` $${Number(ctx.raw).toFixed(2)}` }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: { ticks: { callback: (v) => `$${v}` }, grid: { borderDash: [6,6] } }
      }
    }
  });

  // drawdown chart
  const ctx2 = document.getElementById("ddChart");
  if(ddChart) ddChart.destroy();

  ddChart = new Chart(ctx2, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Drawdown",
        data: ddSeries.map(x=>x.dd),
        tension: 0.25,
        pointRadius: 0,
        borderWidth: 2,
        fill: true,
        borderColor: "rgb(239,68,68)",
        backgroundColor: "rgba(239,68,68,0.12)"
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { borderDash: [6,6] } }
      }
    }
  });
}

// ===== Render =====
function render(){
  const logs = loadLogs();
  const curve = computeCurve(logs);
  const ddSeries = computeDrawdown(curve);

  const start = getStartingBalance();
  const lastEquity = curve.length ? curve[curve.length-1].equity : start;
  const net = lastEquity - start;

  document.getElementById("equity").textContent = `$${lastEquity.toFixed(2)}`;
  const netEl = document.getElementById("net");
  netEl.textContent = fmtMoney(net);
  netEl.className = "value " + (net>=0 ? "good" : "bad");

  const wr = calcWinRateDays(logs);
  document.getElementById("winrate").textContent = `${(wr*100).toFixed(1)}%`;

  const maxDD = calcMaxDrawdown(ddSeries);
  const ddEl = document.getElementById("dd");
  ddEl.textContent = `$${maxDD.toFixed(2)}`;
  ddEl.className = "value " + (maxDD < 0 ? "bad" : "good");

  // daily table
  const tbody = document.getElementById("table");
  tbody.innerHTML = "";
  const desc = [...curve].sort((a,b)=> new Date(b.date) - new Date(a.date));
  desc.forEach(row=>{
    const tr = document.createElement("tr");
    const plClass = row.pl >= 0 ? "good" : "bad";
    tr.innerHTML = `
      <td>${row.date}</td>
      <td class="${plClass}">${fmtMoney(row.pl)}</td>
      <td>$${row.equity.toFixed(2)}</td>
      <td><button class="btn" data-date="${row.date}">حذف</button></td>
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

  // charts
  renderCharts(curve, ddSeries);

  // monthly
  const monthly = computeMonthly(logs);
  const mBody = document.getElementById("monthlyTable");
  mBody.innerHTML = "";
  monthly.forEach(m=>{
    const tr = document.createElement("tr");
    const cls = m.sum >= 0 ? "good" : "bad";
    tr.innerHTML = `<td>${m.ym}</td><td class="${cls}">${fmtMoney(m.sum)}</td><td>${m.count}</td>`;
    mBody.appendChild(tr);
  });

  if(monthly.length){
    const best = monthly.reduce((a,b)=> (b.sum>a.sum?b:a), monthly[0]);
    const worst = monthly.reduce((a,b)=> (b.sum<a.sum?b:a), monthly[0]);
    document.getElementById("bestMonth").textContent = `${best.ym} (${fmtMoney(best.sum)})`;
    document.getElementById("worstMonth").textContent = `${worst.ym} (${fmtMoney(worst.sum)})`;
    const last3 = monthly.slice(-3).reduce((s,x)=> s + x.sum, 0);
    document.getElementById("last3").textContent = fmtMoney(last3);
  } else {
    document.getElementById("bestMonth").textContent = "-";
    document.getElementById("worstMonth").textContent = "-";
    document.getElementById("last3").textContent = "-";
  }

  // tips
  const tips = [];
  if(curve.length >= 5){
    const ddPct = Math.abs(maxDD) / start;
    if(ddPct > 0.1) tips.push("الـ Drawdown عالي: قلّل المخاطرة أو حجم اللوت مؤقتًا.");
    if(wr < 0.4) tips.push("Win Rate منخفض (أيام): راجع خطة الدخول أو قلّل عدد الصفقات.");
    if(net < 0) tips.push("صافي الربح سلبي: ركّز على الجودة بدل الكمية، وراقب حجم الخسارة.");
  } else {
    tips.push("أضف بيانات عدة أيام ليظهر تحليل أدق.");
  }
  document.getElementById("tips").innerHTML = tips.map(t=>`<li>${t}</li>`).join("");
}

// ===== Events =====
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
  if(confirm("تأكيد حذف كل بيانات الأيام؟")){
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
  a.download = "forex-daily.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

document.getElementById("toggleTheme").onclick = () => {
  const isLight = document.body.classList.contains("light");
  localStorage.setItem(THEME_KEY, isLight ? "dark" : "light");
  applyTheme();
  render();
};

render();
