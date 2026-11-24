import express from "express";
import fs from "fs";
import path from "path";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ALLOWED_MODELS = new Set(["gemini-4-hydrogen", "gemini-3.1-flash-lite"]);

function resolveThinkingLevel(model: string, requestedLevel?: string): ThinkingLevel | undefined {
  if (!requestedLevel) return undefined;
  const upper = requestedLevel.toUpperCase();
  if (model === "gemini-4-hydrogen") {
    if (upper === "LOW") return ThinkingLevel.LOW;
    if (upper === "MEDIUM") return ThinkingLevel.MEDIUM;
    if (upper === "HIGH") return ThinkingLevel.HIGH;
    if (upper === "XHIGH") return ThinkingLevel.XHIGH;
    return undefined;
  }
  if (model === "gemini-3.1-flash-lite") {
    if (upper === "MINIMAL") return ThinkingLevel.MINIMAL;
    if (upper === "LOW") return ThinkingLevel.LOW;
    if (upper === "MEDIUM") return ThinkingLevel.MEDIUM;
    if (upper === "HIGH") return ThinkingLevel.HIGH;
    return undefined;
  }
  return undefined;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "15mb" }));

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      geminiKeyConfigured: !!process.env.GEMINI_API_KEY,
      timestamp: new Date().toISOString(),
    });
  });

  // Context-aware Gemini Chat Endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "GEMINI_API_KEY is not configured in the server environment.",
          details: "Please ensure GEMINI_API_KEY is set in Settings > Secrets.",
        });
      }

      const {
        messages = [],
        systemInstruction = "You are a professional enterprise financial advisor for Pioneer Assurance Company Limited (PACL) and Pioneer General Insurance Limited (PGIL).",
        model = "gemini-4-hydrogen",
        thinkingLevel,
        contextData = null,
      } = req.body;

      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Messages array cannot be empty." });
      }

      // Initialize Gemini Client with mandatory telemetry User-Agent header
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Assemble system instruction with live context if provided
      let fullInstruction = systemInstruction;
      if (contextData) {
        fullInstruction += `\n\n### CURRENT REAL-TIME SYSTEM CONTEXT:\n` +
          `- Active Screen: ${contextData.activeTab || "Dashboard"}\n` +
          `- Entity Filter: ${contextData.legalEntity || "All Entities (PACL & PGIL)"}\n` +
          `- Financial Year: ${contextData.financialYear || "2026"}\n` +
          `- Department: ${contextData.departmentName || "Marketing & Customer Experience"}\n` +
          (contextData.metricsSummary ? `- Key Financial Metrics: ${JSON.stringify(contextData.metricsSummary)}\n` : "") +
          (contextData.relevantEntities ? `- Current Screen Highlights: ${JSON.stringify(contextData.relevantEntities)}\n` : "") +
          `\nAlways refer accurately to the provided financial data, PACL/PGIL dual-entity separation rules, Kenyan Shillings (KES) currency, and enterprise audit standards.`;
      }

      // Format contents for @google/genai
      const contents = messages.map((m: { role: string; text: string }) => ({
        role: m.role === "assistant" || m.role === "model" ? "model" : "user",
        parts: [{ text: m.text }],
      }));

      const primaryModel = ALLOWED_MODELS.has(model) ? model : "gemini-4-hydrogen";
      const modelsToTry = Array.from(
        new Set([primaryModel, "gemini-4-hydrogen", "gemini-3.1-flash-lite"])
      );

      let lastError: any = null;
      let successfulResponse: any = null;
      let usedModel = modelsToTry[0];

      for (const m of modelsToTry) {
        try {
          const resolvedLevel = resolveThinkingLevel(m, m === primaryModel ? thinkingLevel : undefined);
          const config: Record<string, any> = {
            systemInstruction: fullInstruction,
          };
          if (resolvedLevel) {
            config.thinkingConfig = { thinkingLevel: resolvedLevel };
          }

          const response = await ai.models.generateContent({
            model: m,
            contents,
            config,
          });
          successfulResponse = response;
          usedModel = m;
          break;
        } catch (err: any) {
          lastError = err;
          const errMsg = err?.message || String(err);
          console.warn(`Model ${m} encountered an issue: ${errMsg}.`);
          if (
            errMsg.includes("API_KEY_INVALID") ||
            errMsg.includes("PERMISSION_DENIED") ||
            err?.status === 400 ||
            err?.status === 403
          ) {
            break;
          }
        }
      }

      if (successfulResponse) {
        const replyText = successfulResponse.text || "I was unable to generate a detailed response. Please try rephrasing your request.";
        return res.json({
          success: true,
          model: usedModel,
          reply: replyText,
          fallbackUsed: usedModel !== primaryModel,
        });
      }

      const rawMsg = lastError?.message || String(lastError || "Unknown Gemini API error");
      const statusCode =
        typeof lastError?.status === "number" && lastError.status >= 400
          ? lastError.status
          : rawMsg.includes("429") || rawMsg.includes("RESOURCE_EXHAUSTED")
          ? 429
          : rawMsg.includes("403") || rawMsg.includes("PERMISSION_DENIED")
          ? 403
          : rawMsg.includes("404") || rawMsg.includes("NOT_FOUND")
          ? 404
          : rawMsg.includes("400") || rawMsg.includes("API_KEY_INVALID")
          ? 400
          : 502;

      return res.status(statusCode).json({
        error:
          statusCode === 429
            ? "Gemini API quota exceeded or rate-limited. Please retry shortly or select Gemini 3.1 Flash Lite."
            : statusCode === 403 || statusCode === 400
            ? "Gemini API key validation failed. Please verify the API key in Settings > Secrets."
            : `Gemini API request failed: ${rawMsg}`,
        details: rawMsg,
        model: primaryModel,
      });
    } catch (error: any) {
      console.error("Gemini Chat API Error:", error);
      return res.status(500).json({
        error: error?.message || "Failed to communicate with Gemini API.",
        details: String(error),
      });
    }
  });

  // Vite middleware for development vs static build for production
  const isBundledCjs = typeof __filename !== "undefined" && __filename.endsWith(".cjs");
  const isProduction = process.env.NODE_ENV === "production" || isBundledCjs;

  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const cwdDist = path.resolve(process.cwd(), "dist");
    const distPath =
      fs.existsSync(path.join(cwdDist, "index.html"))
        ? cwdDist
        : typeof __dirname !== "undefined" && fs.existsSync(path.join(__dirname, "index.html"))
          ? __dirname
          : cwdDist;

    app.use(express.static(distPath));
    app.get("/api/*", (_req, res) => {
      res.status(404).json({ error: "API endpoint not found." });
    });
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Enterprise ERP Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start Enterprise ERP Server:", err);
  process.exit(1);
});
