import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from "cors";
import Binance from "binance-api-node";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());

// Binance Client Initialization
const BinanceFactory = (Binance as any).default || Binance;
const client = BinanceFactory({
  apiKey: process.env.BINANCE_API_KEY,
  apiSecret: process.env.BINANCE_API_SECRET,
});

// Simulation State
let botRunning = false;
let simulationMode = false; // Disabled as requested
let currentCapital = 60;
let initialCapital = 60;
let targetGoal = 1000;
let lastAlertProfit = 0;
let logs: string[] = [];
let realPrice = 0;
let realBalance = 0;
let hasApiKeys = !!(process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET);

const addLog = (message: string) => {
  const timestamp = new Date().toLocaleTimeString();
  logs.unshift(`[${timestamp}] ${message}`);
  if (logs.length > 50) logs.pop();
  console.log(`[${timestamp}] ${message}`);
};

// Trading Logic Loop (Hybrid: Real Price + Simulated Balance)
const tradingLoop = async () => {
  if (!botRunning) return;

  try {
    const asset = 'BTCUSDT';
    
    // Fetch Real Price from Binance
    const prices = await client.prices();
    const btcPriceObj = (prices as any)[asset] ? { price: (prices as any)[asset] } : (prices as any[]).find(p => p.symbol === asset);
    realPrice = btcPriceObj ? parseFloat(btcPriceObj.price || btcPriceObj) : realPrice;

    // Fetch Real Balance if keys are available
    if (hasApiKeys) {
      try {
        const accountInfo = await client.accountInfo();
        const usdtBalance = accountInfo.balances.find(b => b.asset === 'USDT');
        realBalance = usdtBalance ? parseFloat(usdtBalance.free) : 0;
      } catch (e) {
        console.error("Error fetching real balance", e);
      }
    }

    addLog(`🔍 Analisando Ativo: ${asset} | Preço Real: $${realPrice.toFixed(2)}`);
    
    if (simulationMode) {
      addLog(`⚡ Tentativa de Entrada: Compra em ${asset} (Risco 1% Simulado)`);
      // Risk Management (Simulated)
      const amountToRisk = currentCapital * 0.01;
      const takeProfitAmount = amountToRisk * 2;
      
      const winProbability = 0.45; 
      const isWin = Math.random() < winProbability;

      if (isWin) {
        currentCapital += takeProfitAmount;
        addLog(`✅ Trade GANHO em ${asset}: +$${takeProfitAmount.toFixed(2)}. Saldo Simulado: $${currentCapital.toFixed(2)}`);
      } else {
        currentCapital -= amountToRisk;
        addLog(`❌ Trade PERDIDO em ${asset}: -$${amountToRisk.toFixed(2)}. Saldo Simulado: $${currentCapital.toFixed(2)}`);
      }
    } else {
      if (hasApiKeys) {
        const amountToRisk = realBalance * 0.01;
        addLog(`🛡️ MODO REAL: Monitorando entrada em ${asset} com risco de $${amountToRisk.toFixed(2)} (1% da banca real)`);
        // In real mode, we just monitor and log analysis without fake balance updates
        currentCapital = realBalance; 
      } else {
        addLog(`⚠️ AVISO: Simulação desativada, mas chaves de API não configuradas para Modo Real.`);
      }
    }

    // Check for $10 profit alert (reduced from $20 for better visibility)
    const totalProfit = currentCapital - initialCapital;
    if (totalProfit >= lastAlertProfit + 10) {
      lastAlertProfit = Math.floor(totalProfit / 10) * 10;
      addLog(`🎯 ALERT: Lucro atingiu $${totalProfit.toFixed(2)}!`);
    }

    if (currentCapital >= targetGoal) {
      addLog(`🚀 META ALCANÇADA! Capital Final: $${currentCapital.toFixed(2)}`);
      botRunning = false;
    }

    if (currentCapital <= 0) {
      addLog(`💀 Conta Quebrada. Parando o robô.`);
      botRunning = false;
    }

  } catch (error) {
    addLog(`Erro no loop de simulação: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (botRunning) {
    setTimeout(tradingLoop, 3000); // Faster simulation (3 seconds)
  }
};

app.get("/api/status", (req, res) => {
  res.json({
    botRunning,
    simulationMode,
    currentCapital,
    initialCapital,
    targetGoal,
    logs,
    profit: currentCapital - initialCapital,
    realPrice,
    realBalance,
    hasApiKeys
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
