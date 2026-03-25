import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Simulation State
let botRunning = false;
let currentCapital = 60;
let initialCapital = 60;
let targetGoal = 1000;
let lastAlertProfit = 0;
let logs: string[] = [];
let simulatedPrice = 65000; // Starting price for BTC simulation

const addLog = (message: string) => {
  const timestamp = new Date().toLocaleTimeString();
  logs.unshift(`[${timestamp}] ${message}`);
  if (logs.length > 50) logs.pop();
  console.log(`[${timestamp}] ${message}`);
};

// Trading Logic Loop (Simulated)
const tradingLoop = async () => {
  if (!botRunning) return;

  try {
    const asset = 'BTCUSDT';
    
    // Simulate price movement
    const volatility = 0.001; // 0.1% change
    const change = (Math.random() - 0.5) * 2 * volatility;
    simulatedPrice *= (1 + change);

    addLog(`🔍 Analisando Ativo: ${asset} | Preço Simulado: $${simulatedPrice.toFixed(2)}`);
    addLog(`⚡ Tentativa de Entrada: Compra em ${asset} (Risco 1%)`);

    // Risk Management
    const amountToRisk = currentCapital * 0.01;
    const takeProfitAmount = amountToRisk * 2;
    
    // Probabilistic simulation (2:1 RR with 45% win rate is profitable)
    const winProbability = 0.45; 
    const isWin = Math.random() < winProbability;

    if (isWin) {
      currentCapital += takeProfitAmount;
      addLog(`✅ Trade GANHO em ${asset}: +$${takeProfitAmount.toFixed(2)}. Saldo: $${currentCapital.toFixed(2)}`);
    } else {
      currentCapital -= amountToRisk;
      addLog(`❌ Trade PERDIDO em ${asset}: -$${amountToRisk.toFixed(2)}. Saldo: $${currentCapital.toFixed(2)}`);
    }

    // Check for $20 profit alert
    const totalProfit = currentCapital - initialCapital;
    if (totalProfit >= lastAlertProfit + 20) {
      lastAlertProfit = Math.floor(totalProfit / 20) * 20;
      addLog(`🎯 ALERT: Profit reached $${totalProfit.toFixed(2)}!`);
    }

    if (currentCapital >= targetGoal) {
      addLog(`🚀 GOAL REACHED! Final Capital: $${currentCapital.toFixed(2)}`);
      botRunning = false;
    }

    if (currentCapital <= 0) {
      addLog(`💀 Account Blown. Stopping bot.`);
      botRunning = false;
    }

  } catch (error) {
    addLog(`Error in simulation loop: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (botRunning) {
    setTimeout(tradingLoop, 3000); // Faster simulation (3 seconds)
  }
};

app.get("/api/status", (req, res) => {
  res.json({
    botRunning,
    currentCapital,
    initialCapital,
    targetGoal,
    logs,
    profit: currentCapital - initialCapital
  });
});

app.post("/api/start", (req, res) => {
  if (!botRunning) {
    botRunning = true;
    addLog("Bot Started. Goal: $1000. Risk: 1% per trade. RR: 2:1.");
    tradingLoop();
  }
  res.json({ success: true });
});

app.post("/api/stop", (req, res) => {
  botRunning = false;
  currentCapital = 60; // Reset as requested
  initialCapital = 60;
  lastAlertProfit = 0;
  addLog("Bot Stopped. Capital reset to $60.");
  res.json({ success: true });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
