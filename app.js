const KEY = "fx_logs_v1";
const SETTINGS = { initial: 46000 };

function load() {
  return JSON.parse(localStorage.getItem(KEY) || "[]");
}
function save(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
}

function sortByDate(a,b){ return new Date(a.date) - new Date(b.date); }

function computeEquity(logs){
  const sorted = [...logs].sort(sortByDate);
  let equity = SETTINGS.initial;
  return sorted.map(x=>{
    equity += Number(x.pl||0);
    return { date:x.date, pl:Number(x.pl||0), equity };
  });
}

function maxDrawdown(curve){
  let peak = -Infinity, dd = 0;
  for(const p of curve){
    peak = Math.max(peak, p.equity);
    dd = Math.min(dd, p.equity - peak);
  }
  return dd; // negative number
}

function winRate(logs){
  if(!logs.length) return 0;
  const wins = logs.filter(x=>Number(x.pl)>0).length;
  return wins / logs.length;
}

let chart;

function render(){
  const logs = load();
  const curve = computeEquity(logs);
  const lastEquity = curve.length ? curve[curve.length-1].equity : SETTINGS.initial;
  const net = lastEquity - SETTINGS.initial;

  document.getElementById("equity").textContent = `$${lastEquity.toFixed(2)}`;
  document.getElementById("net").textContent = `${net>=0?"+":""}$${net.toFixed(2)}`;
  document.getElementById("net").className = "value " + (net>=0?"good":"bad");

  const wr = winRate(logs);
  document.getElementById("winrate").textContent = `${(wr*100).toFixed(1)}%`;

  const dd = maxDrawdown(curve);
  document.getElementById("dd").textContent = `$${dd.toFixed(2)}`;
  document.getElementById("dd").className = "value " + (dd<0?"bad":"good");

  // table
  const tbody = document.getElementById("table");
  tbody.innerHTML = "";
  const desc = [...curve].sort((a,b)=> new Date(b.date)-new Date(a.date));
  desc.forEach(row=>{
    const tr = document.createElement("tr");
    const plClass = row.pl>=0 ? "good":"bad";
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
      const next = load().filter(x=>x.date!==date);
      save(next);
      render();
    }
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
  if(curve.length>=5){
    const ddPct = Math.abs(dd) / SETTINGS.initial;
    if(ddPct > 0.1) tips.push("الـ Drawdown عالي: قلّل المخاطرة أو حجم اللوت مؤقتًا.");
    if(wr < 0.4) tips.push("Win Rate منخفض: راجع شروط الدخول أو قلّل عدد الصفقات.");
    if(net < 0) tips.push("صافي الربح سلبي: جرّب التركيز على صفقات أقل وجودة أعلى.");
  } else {
    tips.push("أضف بيانات عدة أيام ليظهر تحليل أدق.");
  }
  const ul = document.getElementById("tips");
  ul.innerHTML = tips.map(t=>`<li>${t}</li>`).join("");
}

document.getElementById("addDay").onclick = () => {
  const date = document.getElementById("date").value;
  const pl = Number(document.getElementById("pl").value);
  if(!date || Number.isNaN(pl)) return alert("اكتب التاريخ والربح/الخسارة");
  const logs = load();
  const filtered = logs.filter(x=>x.date!==date);
  filtered.push({ date, pl });
  save(filtered);
  document.getElementById("pl").value = "";
  render();
};

document.getElementById("reset").onclick = () => {
  if(confirm("تأكيد حذف كل البيانات؟")){ localStorage.removeItem(KEY); render(); }
};

render();
