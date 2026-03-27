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
let simulationMode = false; 
let currentCapital = 0;
let initialCapital = 0;
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
        currentCapital = realBalance;

        // If it's the first run after start, set initial capital
        if (initialCapital === 0 && botRunning) {
          initialCapital = realBalance;
          addLog(`💰 Banca Inicial Detectada: $${initialCapital.toFixed(2)}`);
        }
      } catch (e) {
        console.error("Error fetching real balance", e);
      }
    }

    addLog(`🔍 Analisando Ativo: ${asset} | Preço: $${realPrice.toFixed(2)}`);
    
    if (hasApiKeys) {
      const amountToRisk = realBalance * 0.01;
      addLog(`🛡️ MONITORANDO: Buscando entrada em ${asset} | Risco: $${amountToRisk.toFixed(2)} (1%)`);
      
      // Calculate profit since start
      const totalProfit = realBalance - initialCapital;
      
      // Check for $20 profit alert
      if (totalProfit >= lastAlertProfit + 20) {
        lastAlertProfit = Math.floor(totalProfit / 20) * 20;
        addLog(`🎯 ALERTA: Lucro na conta real atingiu +$${totalProfit.toFixed(2)}!`);
      }

      if (realBalance >= targetGoal) {
        addLog(`🚀 META DE $1000 ALCANÇADA NA CONTA REAL!`);
        botRunning = false;
      }
    } else {
      addLog(`⚠️ ERRO: Chaves de API não configuradas. Operação real impossível.`);
      botRunning = false;
    }

  } catch (error) {
    addLog(`Erro no loop de operação: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (botRunning) {
    setTimeout(tradingLoop, 3000); // 3 seconds interval
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
    profit: initialCapital === 0 ? 0 : currentCapital - initialCapital,
    realPrice,
    realBalance,
    hasApiKeys
  });
});

app.post("/api/start", (req, res) => {
  if (!botRunning) {
    botRunning = true;
    initialCapital = 0; // Will be set on first loop iteration from real balance
    lastAlertProfit = 0;
    addLog("Bot Iniciado na Conta Real. Meta: $1000. Risco: 1% por operação.");
    tradingLoop();
  }
  res.json({ success: true });
});

app.post("/api/stop", (req, res) => {
  botRunning = false;
  initialCapital = 0;
  currentCapital = 0;
  lastAlertProfit = 0;
  addLog("Bot Parado. Contagem de lucro reiniciada.");
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
