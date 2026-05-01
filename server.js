require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { v4: uuidv4 } = require("uuid");
const rateLimit = require("express-rate-limit");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

// ═══════════════════════════════════════════
//  Middleware
// ═══════════════════════════════════════════
app.use(
  helmet({
    contentSecurityPolicy: false, // allow inline scripts in demo pages
  })
);
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// ═══════════════════════════════════════════
//  Rate Limiting
// ═══════════════════════════════════════════
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 429,
    message: "Too many requests, please try again later.",
  },
});

const captchaLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: {
    success: false,
    error: 429,
    message: "Too many CAPTCHA requests. Slow down.",
  },
});

app.use("/api", globalLimiter);
app.use("/api/captcha", captchaLimiter);

// ═══════════════════════════════════════════
//  In-Memory Token Store
//  (Replace with Redis in production)
// ═══════════════════════════════════════════
const tokenStore = new Map();

// Clean expired tokens every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tokenStore.entries()) {
    if (now > data.expiresAt) {
      tokenStore.delete(token);
    }
  }
}, 5 * 60 * 1000);

// ═══════════════════════════════════════════
//  API Key Middleware (simple demo version)
//  In production: validate against a database
// ═══════════════════════════════════════════
const VALID_API_KEYS = new Set([
  process.env.API_KEY || "desv_live_demo_key_12345",
  "desv_test_demo_key_99999", // test key always available
]);

function requireApiKey(req, res, next) {
  const auth = req.headers["authorization"];
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: 401,
      message: "Missing Authorization header. Use: Bearer YOUR_API_KEY",
    });
  }

  const key = auth.slice(7).trim();
  if (!VALID_API_KEYS.has(key)) {
    return res.status(401).json({
      success: false,
      error: "invalid_api_key",
      message: "API key is invalid or has been revoked.",
    });
  }

  req.isTestKey = key.startsWith("desv_test_");
  next();
}

// ═══════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════

// Health check
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "operational",
    timestamp: Date.now(),
    version: "1.0.0",
  });
});

// ───────────────────────────────────────────
//  POST /api/captcha/generate
//  Generate a new CAPTCHA token (challenge)
// ───────────────────────────────────────────
app.post("/api/captcha/generate", requireApiKey, (req, res) => {
  const { type = "code", lang = "en", theme = "dark", size = "medium" } = req.body;

  const validTypes = ["code", "puzzle", "button", "grid"];
  const validLangs = ["en", "ar", "fr", "de"];
  const validThemes = ["dark", "light", "auto"];
  const validSizes = ["small", "medium", "large"];

  if (!validTypes.includes(type)) {
    return res.status(400).json({
      success: false,
      error: 400,
      message: `Invalid type. Must be one of: ${validTypes.join(", ")}`,
    });
  }

  // If test key, return simulated response
  if (req.isTestKey) {
    return res.json({
      success: true,
      challenge_token: "test_challenge_" + uuidv4().slice(0, 8),
      type,
      lang: validLangs.includes(lang) ? lang : "en",
      theme: validThemes.includes(theme) ? theme : "dark",
      size: validSizes.includes(size) ? size : "medium",
      expires_in: 300,
      test_mode: true,
    });
  }

  const challengeToken = "chk_" + uuidv4().replace(/-/g, "");
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  tokenStore.set(challengeToken, {
    type,
    lang: validLangs.includes(lang) ? lang : "en",
    theme: validThemes.includes(theme) ? theme : "dark",
    size: validSizes.includes(size) ? size : "medium",
    solved: false,
    expiresAt,
    createdAt: Date.now(),
    ip: req.ip,
  });

  res.json({
    success: true,
    challenge_token: challengeToken,
    type,
    lang: validLangs.includes(lang) ? lang : "en",
    theme: validThemes.includes(theme) ? theme : "dark",
    size: validSizes.includes(size) ? size : "medium",
    expires_in: 300,
    test_mode: false,
  });
});

// ───────────────────────────────────────────
//  POST /api/captcha/verify
//  Verify that a CAPTCHA was solved
// ───────────────────────────────────────────
app.post("/api/captcha/verify", requireApiKey, (req, res) => {
  const { challenge_token, solution } = req.body;

  if (!challenge_token) {
    return res.status(400).json({
      success: false,
      error: 400,
      message: "challenge_token is required.",
    });
  }

  // Test key = always pass
  if (req.isTestKey || challenge_token.startsWith("test_challenge_")) {
    return res.json({
      success: true,
      verified: true,
      token: "cap_" + uuidv4().slice(0, 8),
      test_mode: true,
      message: "CAPTCHA verified successfully (test mode).",
    });
  }

  const record = tokenStore.get(challenge_token);

  if (!record) {
    return res.status(404).json({
      success: false,
      error: 404,
      message: "Challenge token not found or already used.",
    });
  }

  if (Date.now() > record.expiresAt) {
    tokenStore.delete(challenge_token);
    return res.status(410).json({
      success: false,
      error: 410,
      message: "Challenge token has expired. Generate a new one.",
    });
  }

  if (record.solved) {
    return res.status(409).json({
      success: false,
      error: 409,
      message: "Token already used.",
    });
  }

  // For button/puzzle/grid types: client signals solved=true from widget
  // For code type: validate the solution string
  let verified = false;
  if (record.type === "button" || record.type === "puzzle" || record.type === "grid") {
    verified = solution === true || solution === "true" || solution === 1;
  } else if (record.type === "code") {
    // code is stored server-side only in a real impl
    // here we accept any 6-char string as demo
    verified = typeof solution === "string" && solution.length === 6;
  }

  if (!verified) {
    return res.status(422).json({
      success: false,
      error: 422,
      message: "CAPTCHA solution is incorrect.",
    });
  }

  // Mark as solved and issue a result token
  record.solved = true;
  tokenStore.set(challenge_token, record);

  const resultToken = "cap_" + uuidv4().replace(/-/g, "").slice(0, 12);

  res.json({
    success: true,
    verified: true,
    token: resultToken,
    test_mode: false,
    message: "CAPTCHA verified successfully.",
  });
});

// ───────────────────────────────────────────
//  GET /api/captcha/status/:token
//  Check status of a challenge token
// ───────────────────────────────────────────
app.get("/api/captcha/status/:token", requireApiKey, (req, res) => {
  const { token } = req.params;

  if (req.isTestKey) {
    return res.json({
      success: true,
      status: "pending",
      test_mode: true,
    });
  }

  const record = tokenStore.get(token);
  if (!record) {
    return res.status(404).json({
      success: false,
      error: 404,
      message: "Token not found.",
    });
  }

  const expired = Date.now() > record.expiresAt;

  res.json({
    success: true,
    status: expired ? "expired" : record.solved ? "solved" : "pending",
    type: record.type,
    created_at: record.createdAt,
    expires_at: record.expiresAt,
    expired,
  });
});

// ───────────────────────────────────────────
//  GET /api/analytics  (mock data for demo)
// ───────────────────────────────────────────
app.get("/api/analytics", requireApiKey, (req, res) => {
  res.json({
    success: true,
    requests: 18291,
    solved: 17420,
    blocked: 721,
    threats: 150,
    solve_rate: "95.2%",
    updated_at: Date.now(),
  });
});

// ───────────────────────────────────────────
//  404 handler
// ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 404,
    message: "Endpoint not found.",
  });
});

// ═══════════════════════════════════════════
//  Start Server
// ═══════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`✅ desv.online CAPTCHA API running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;
