const TRADES_KEY = "trades";
const EVAL_KEY = "evaluations";
const SETTINGS_KEY = "settings"; // إذا عندك إعدادات رأس المال.. إذا لا، نستخدم 46000

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
  catch { return fallback; }
}

function calcNet(trades) {
  return trades.reduce((s, t) => s + (Number(t.result) || 0), 0);
}
function winRate(trades) {
  const withRes = trades.filter(t => typeof t.result === "number");
  if (!withRes.length) return 0;
  const wins = withRes.filter(t => t.result > 0).length;
  return wins / withRes.length;
}
function bestWorst(trades) {
  const arr = trades.map(t => Number(t.result) || 0);
  if (!arr.length) return { best: 0, worst: 0 };
  return { best: Math.max(...arr), worst: Math.min(...arr) };
}

// Trader A إذا: score>=7 وضمن الخطة وسبب واضح ومخاطرة منضبطة
function classify(trade, evalMap) {
  const id = trade.id || trade.tradeId;
  const e = evalMap[id];
  if (!e) return "B";
  const ok = e.score >= 7 && e.followedPlan && e.hadClearSetup && e.riskOk;
  return ok ? "A" : "B";
}

function renderStats(elId, trades, initialCapital) {
  const net = calcNet(trades);
  const equity = initialCapital + net;
  const wr = winRate(trades);
  const { best, worst } = bestWorst(trades);

  const box = document.getElementById(elId);
  box.innerHTML = `
    <div class="pill">Trades: <b>${trades.length}</b></div>
    <div class="pill">Net P/L: <b>${net.toFixed(2)}</b></div>
    <div class="pill">Equity: <b>${equity.toFixed(2)}</b></div>
    <div class="pill">Win Rate: <b>${(wr*100).toFixed(1)}%</b></div>
    <div class="pill">Best: <b>${best.toFixed(2)}</b></div>
    <div class="pill">Worst: <b>${worst.toFixed(2)}</b></div>
  `;
  return { net, equity, wr, best, worst, count: trades.length };
}

function init() {
  const trades = loadJSON(TRADES_KEY, []);
  const evaluations = loadJSON(EVAL_KEY, []);
  const settings = loadJSON(SETTINGS_KEY, { initialCapital: 46000 });

  const evalMap = {};
  evaluations.forEach(e => (evalMap[e.tradeId] = e));

  const aTrades = [];
  const bTrades = [];

  trades.forEach(t => {
    (classify(t, evalMap) === "A" ? aTrades : bTrades).push(t);
  });

  const a = renderStats("aStats", aTrades, settings.initialCapital || 46000);
  const b = renderStats("bStats", bTrades, settings.initialCapital || 46000);

  const diff = document.getElementById("diffStats");
  diff.innerHTML = `
    <div class="pill">Net Δ: <b>${(a.net - b.net).toFixed(2)}</b></div>
    <div class="pill">WinRate Δ: <b>${((a.wr - b.wr)*100).toFixed(1)}%</b></div>
    <div class="pill">Trades Δ: <b>${(a.count - b.count)}</b></div>
  `;
}

init();
