/**
 * ╔══════════════════════════════════════════╗
 * ║     desv.online — CAPTCHA API Server     ║
 * ║  Rate Limit · Bot Detection · IP Track  ║
 * ║  Puzzle Slider · Invisible · Code CAPTCHA║
 * ╚══════════════════════════════════════════╝
 */

require("dotenv").config();

const express = require("express");
const { createCanvas } = require("@napi-rs/canvas");
const { v4: uuidv4 } = require("uuid");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");

const app = express();

app.set("trust proxy", 1);

const PORT = process.env.PORT || 8080;

// ═══════════════════════════════════════════
//  IN-MEMORY STORES
// ═══════════════════════════════════════════
const tokenStore = new Map();    // token → { code, type, createdAt, ip, solved }
const ipStore = new Map();       // ip → { requests, blocked, firstSeen, lastSeen, failCount }
const analyticsStore = {
  requests: 0,
  solved: 0,
  blocked: 0,
  threats: 0,
};

// Cleanup expired tokens every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tokenStore.entries()) {
    if (now - data.createdAt > 5 * 60 * 1000) {
      tokenStore.delete(token);
    }
  }
}, 2 * 60 * 1000);

// ═══════════════════════════════════════════
//  MIDDLEWARE
// ═══════════════════════════════════════════
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: false }));

// CORS — allow all origins from any domain
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

// Global rate limiter — 100 req/min per IP
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    analyticsStore.blocked++;
    trackIP(getIP(req), "blocked");
    res.status(429).json({ success: false, error: 429, message: "rate_limit_exceeded", retry_after: 60 });
  },
});

// Strict limiter for generate endpoint — 20 req/min
const generateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  handler: (req, res) => {
    analyticsStore.blocked++;
    trackIP(getIP(req), "blocked");
    res.status(429).json({ success: false, error: 429, message: "rate_limit_exceeded", retry_after: 60 });
  },
});

app.use(globalLimiter);

// ═══════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════
function getIP(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function trackIP(ip, event = "request") {
  const now = Date.now();
  const existing = ipStore.get(ip) || {
    requests: 0, blocked: 0, firstSeen: now, lastSeen: now, failCount: 0, isBlocked: false,
  };
  existing.lastSeen = now;
  if (event === "request") existing.requests++;
  if (event === "blocked") existing.blocked++;
  if (event === "fail") existing.failCount++;
  // Auto-block IPs with 10+ failures
  if (existing.failCount >= 10) {
    existing.isBlocked = true;
    analyticsStore.threats++;
  }
  ipStore.set(ip, existing);
  return existing;
}

function isIPBlocked(ip) {
  const data = ipStore.get(ip);
  return data?.isBlocked === true;
}

/** Bot detection — checks headers & User-Agent */
function detectBot(req) {
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  const botPatterns = [
    /bot/i, /crawl/i, /spider/i, /slurp/i, /scrape/i,
    /curl/i, /wget/i, /python-requests/i, /axios/i, /go-http/i,
    /java\//i, /libwww/i, /httpclient/i, /okhttp/i,
  ];
  const hasAccept = !!req.headers["accept"];
  const hasLang = !!req.headers["accept-language"];
  const isBot = botPatterns.some((p) => p.test(ua));
  const suspiciousHeaders = !hasAccept || !hasLang;
  return { isBot, suspiciousHeaders, score: (isBot ? 60 : 0) + (suspiciousHeaders ? 40 : 0) };
}

/** Generate random 6-char alphanumeric code */
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ═══════════════════════════════════════════
//  CANVAS — DISTORTED CODE IMAGE
// ═══════════════════════════════════════════
function generateCodeImage(code, theme = "dark") {
  const width = 240;
  const height = 80;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // Background
  const isDark = theme !== "light";
  if (isDark) {
    ctx.fillStyle = "#0d0d10";
    ctx.fillRect(0, 0, width, height);
    // Grid noise
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < width; x += 15) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 15) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
  } else {
    ctx.fillStyle = "#f5f5f7";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < width; x += 15) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 15) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
  }

  // Random noise dots
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = isDark
      ? `rgba(255,255,255,${Math.random() * 0.12})`
      : `rgba(0,0,0,${Math.random() * 0.08})`;
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Interference lines
  const lineColors = isDark
    ? ["rgba(110,168,255,0.2)", "rgba(168,216,168,0.15)", "rgba(255,200,80,0.12)"]
    : ["rgba(100,120,255,0.18)", "rgba(50,180,100,0.14)", "rgba(200,100,0,0.12)"];

  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = lineColors[i % lineColors.length];
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.bezierCurveTo(
      Math.random() * width, Math.random() * height,
      Math.random() * width, Math.random() * height,
      Math.random() * width, Math.random() * height
    );
    ctx.stroke();
  }

  // Draw each character with distortion
  const colors = isDark
    ? ["#7aabff", "#a8d8a8", "#ffcf80", "#ff9cda", "#80e8ff", "#c8b8ff"]
    : ["#2255cc", "#1a7a3c", "#cc7700", "#cc2299", "#0077aa", "#7744cc"];

  const startX = 18;
  const charSpacing = 34;

  for (let i = 0; i < code.length; i++) {
    const char = code[i];
    const x = startX + i * charSpacing;
    const y = 50 + (Math.random() - 0.5) * 14;
    const angle = (Math.random() - 0.5) * 0.45;
    const size = 28 + Math.random() * 8;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Shadow / glow
    ctx.shadowColor = colors[i % colors.length];
    ctx.shadowBlur = 6;

    ctx.font = `bold ${size}px 'Arial'`;
    ctx.fillStyle = colors[i % colors.length];

    // Slight wave distortion via scale
    ctx.scale(1, 0.88 + Math.random() * 0.24);
    ctx.fillText(char, 0, 0);
    ctx.restore();
  }

  // Border
  ctx.strokeStyle = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);

  return canvas.toDataURL("image/png");
}

// ═══════════════════════════════════════════
//  CANVAS — PUZZLE SLIDER IMAGE
// ═══════════════════════════════════════════
function generatePuzzleImages(theme = "dark") {
  const width = 300;
  const height = 120;
  const pieceSize = 50;
  const pieceY = Math.floor(Math.random() * (height - pieceSize - 10)) + 5;
  const answerX = Math.floor(Math.random() * (width - pieceSize - 60)) + 50;

  // ---- Full background canvas ----
  const bgCanvas = createCanvas(width, height);
  const bgCtx = bgCanvas.getContext("2d");
  const isDark = theme !== "light";

  // Gradient background
  const grad = bgCtx.createLinearGradient(0, 0, width, height);
  if (isDark) {
    grad.addColorStop(0, "#0f0f18");
    grad.addColorStop(1, "#0a0a12");
  } else {
    grad.addColorStop(0, "#e8eaf6");
    grad.addColorStop(1, "#f0f2ff");
  }
  bgCtx.fillStyle = grad;
  bgCtx.fillRect(0, 0, width, height);

  // Draw pattern shapes
  for (let i = 0; i < 14; i++) {
    bgCtx.fillStyle = isDark
      ? `rgba(110,168,255,${0.04 + Math.random() * 0.08})`
      : `rgba(80,100,200,${0.04 + Math.random() * 0.06})`;
    bgCtx.beginPath();
    bgCtx.arc(Math.random() * width, Math.random() * height, 10 + Math.random() * 25, 0, Math.PI * 2);
    bgCtx.fill();
  }

  // Draw puzzle hole
  bgCtx.save();
  bgCtx.fillStyle = isDark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.2)";
  bgCtx.strokeStyle = isDark ? "rgba(110,168,255,0.6)" : "rgba(80,100,200,0.5)";
  bgCtx.lineWidth = 2;
  bgCtx.setLineDash([4, 3]);
  bgCtx.fillRect(answerX, pieceY, pieceSize, pieceSize);
  bgCtx.strokeRect(answerX, pieceY, pieceSize, pieceSize);
  bgCtx.restore();

  // Overlay text hint
  bgCtx.fillStyle = isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)";
  bgCtx.font = "bold 11px Arial";
  bgCtx.fillText("Slide to fit →", answerX + pieceSize + 6, pieceY + pieceSize / 2 + 4);

  // Border
  bgCtx.strokeStyle = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.1)";
  bgCtx.lineWidth = 1;
  bgCtx.setLineDash([]);
  bgCtx.strokeRect(0.5, 0.5, width - 1, height - 1);

  // ---- Piece canvas ----
  const pieceCanvas = createCanvas(pieceSize, pieceSize);
  const pCtx = pieceCanvas.getContext("2d");

  // Draw piece with same pattern but clipped
  const pGrad = pCtx.createLinearGradient(0, 0, pieceSize, pieceSize);
  if (isDark) {
    pGrad.addColorStop(0, "#1a1a28");
    pGrad.addColorStop(1, "#141420");
  } else {
    pGrad.addColorStop(0, "#dde2ff");
    pGrad.addColorStop(1, "#eaeeff");
  }
  pCtx.fillStyle = pGrad;
  pCtx.fillRect(0, 0, pieceSize, pieceSize);

  // Pattern on piece
  for (let i = 0; i < 5; i++) {
    pCtx.fillStyle = isDark
      ? `rgba(110,168,255,${0.08 + Math.random() * 0.14})`
      : `rgba(80,100,200,${0.06 + Math.random() * 0.1})`;
    pCtx.beginPath();
    pCtx.arc(Math.random() * pieceSize, Math.random() * pieceSize, 5 + Math.random() * 12, 0, Math.PI * 2);
    pCtx.fill();
  }

  pCtx.strokeStyle = isDark ? "rgba(110,168,255,0.7)" : "rgba(80,100,200,0.6)";
  pCtx.lineWidth = 2;
  pCtx.strokeRect(1, 1, pieceSize - 2, pieceSize - 2);

  return {
    background: bgCanvas.toDataURL("image/png"),
    piece: pieceCanvas.toDataURL("image/png"),
    answerX,
    pieceY,
    tolerance: 8,
  };
}

// ═══════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════

// Health check
app.get("/", (req, res) => {
  res.json({
    name: "desv.online CAPTCHA API",
    version: "1.0.0",
    status: "operational",
    endpoints: [
      "GET  /v1/captcha/generate",
      "POST /v1/captcha/verify",
      "GET  /v1/captcha/puzzle",
      "POST /v1/captcha/puzzle/verify",
      "GET  /v1/captcha/invisible",
      "POST /v1/captcha/invisible/verify",
      "GET  /v1/analytics",
      "GET  /v1/ip/status",
    ],
  });
});

// ─────────────────────────────────────────
//  [1] CODE CAPTCHA — Generate
// ─────────────────────────────────────────
app.get("/v1/captcha/generate", generateLimiter, (req, res) => {
  const ip = getIP(req);
  analyticsStore.requests++;
  trackIP(ip, "request");

  if (isIPBlocked(ip)) {
    analyticsStore.blocked++;
    return res.status(403).json({ success: false, error: 403, message: "ip_blocked" });
  }

  const botCheck = detectBot(req);
  if (botCheck.score >= 60) {
    analyticsStore.threats++;
    trackIP(ip, "fail");
    return res.status(403).json({ success: false, error: 403, message: "bot_detected", score: botCheck.score });
  }

  const theme = req.query.theme || "dark";
  const code = generateCode();
  const token = uuidv4();
  const imageData = generateCodeImage(code, theme);

  tokenStore.set(token, {
    code,
    type: "code",
    createdAt: Date.now(),
    ip,
    solved: false,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  return res.json({
    success: true,
    token,
    image: imageData,
    expires_in: 300,
    type: "code",
  });
});

// ─────────────────────────────────────────
//  [2] CODE CAPTCHA — Verify
// ─────────────────────────────────────────
app.post("/v1/captcha/verify", (req, res) => {
  const ip = getIP(req);
  analyticsStore.requests++;
  trackIP(ip, "request");

  const { token, code } = req.body;

  if (!token || !code) {
    return res.status(400).json({ success: false, error: 400, message: "missing_fields" });
  }

  const data = tokenStore.get(token);

  if (!data) {
    trackIP(ip, "fail");
    return res.status(401).json({ success: false, error: 401, message: "invalid_token" });
  }

  if (data.type !== "code") {
    return res.status(400).json({ success: false, error: 400, message: "wrong_captcha_type" });
  }

  if (Date.now() > data.expiresAt) {
    tokenStore.delete(token);
    trackIP(ip, "fail");
    return res.status(401).json({ success: false, error: 401, message: "token_expired" });
  }

  if (data.solved) {
    return res.status(401).json({ success: false, error: 401, message: "token_already_used" });
  }

  if (data.code.toUpperCase() !== code.toString().toUpperCase().trim()) {
    trackIP(ip, "fail");
    analyticsStore.threats += 0.1;
    return res.status(401).json({ success: false, error: 401, message: "wrong_code" });
  }

  // ✅ Success
  data.solved = true;
  tokenStore.set(token, data);
  analyticsStore.solved++;

  return res.json({
    success: true,
    message: "captcha_verified",
    token,
    verified_at: Date.now(),
  });
});

// ─────────────────────────────────────────
//  [3] PUZZLE SLIDER — Generate
// ─────────────────────────────────────────
app.get("/v1/captcha/puzzle", generateLimiter, (req, res) => {
  const ip = getIP(req);
  analyticsStore.requests++;
  trackIP(ip, "request");

  if (isIPBlocked(ip)) {
    analyticsStore.blocked++;
    return res.status(403).json({ success: false, error: 403, message: "ip_blocked" });
  }

  const botCheck = detectBot(req);
  if (botCheck.score >= 60) {
    analyticsStore.threats++;
    return res.status(403).json({ success: false, error: 403, message: "bot_detected" });
  }

  const theme = req.query.theme || "dark";
  const token = uuidv4();
  const puzzle = generatePuzzleImages(theme);

  tokenStore.set(token, {
    type: "puzzle",
    answerX: puzzle.answerX,
    pieceY: puzzle.pieceY,
    tolerance: puzzle.tolerance,
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000,
    ip,
    solved: false,
    attempts: 0,
  });

  return res.json({
    success: true,
    token,
    background: puzzle.background,
    piece: puzzle.piece,
    piece_y: puzzle.pieceY,
    expires_in: 300,
    type: "puzzle",
  });
});

// ─────────────────────────────────────────
//  [4] PUZZLE SLIDER — Verify
// ─────────────────────────────────────────
app.post("/v1/captcha/puzzle/verify", (req, res) => {
  const ip = getIP(req);
  analyticsStore.requests++;
  trackIP(ip, "request");

  const { token, x } = req.body;

  if (!token || x === undefined || x === null) {
    return res.status(400).json({ success: false, error: 400, message: "missing_fields" });
  }

  const data = tokenStore.get(token);

  if (!data || data.type !== "puzzle") {
    trackIP(ip, "fail");
    return res.status(401).json({ success: false, error: 401, message: "invalid_token" });
  }

  if (Date.now() > data.expiresAt) {
    tokenStore.delete(token);
    return res.status(401).json({ success: false, error: 401, message: "token_expired" });
  }

  if (data.solved) {
    return res.status(401).json({ success: false, error: 401, message: "token_already_used" });
  }

  data.attempts = (data.attempts || 0) + 1;

  // Max 5 attempts
  if (data.attempts > 5) {
    tokenStore.delete(token);
    trackIP(ip, "fail");
    return res.status(403).json({ success: false, error: 403, message: "too_many_attempts" });
  }

  const diff = Math.abs(Number(x) - data.answerX);

  if (diff > data.tolerance) {
    tokenStore.set(token, data);
    return res.status(401).json({
      success: false,
      error: 401,
      message: "wrong_position",
      attempts_left: 5 - data.attempts,
    });
  }

  // ✅ Puzzle solved
  data.solved = true;
  tokenStore.set(token, data);
  analyticsStore.solved++;

  return res.json({
    success: true,
    message: "puzzle_verified",
    token,
    verified_at: Date.now(),
  });
});

// ─────────────────────────────────────────
//  [5] INVISIBLE CAPTCHA — Generate
// ─────────────────────────────────────────
app.get("/v1/captcha/invisible", (req, res) => {
  const ip = getIP(req);
  analyticsStore.requests++;
  trackIP(ip, "request");

  if (isIPBlocked(ip)) {
    analyticsStore.blocked++;
    return res.status(403).json({ success: false, error: 403, message: "ip_blocked" });
  }

  const botCheck = detectBot(req);
  const token = uuidv4();
  const challenge = uuidv4().replace(/-/g, "").substring(0, 16);

  tokenStore.set(token, {
    type: "invisible",
    challenge,
    botScore: botCheck.score,
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000,
    ip,
    solved: false,
  });

  // If clear bot → still return token but flagged
  return res.json({
    success: true,
    token,
    challenge,
    expires_in: 600,
    type: "invisible",
    risk_score: botCheck.score,
  });
});

// ─────────────────────────────────────────
//  [6] INVISIBLE CAPTCHA — Verify
// ─────────────────────────────────────────
app.post("/v1/captcha/invisible/verify", (req, res) => {
  const ip = getIP(req);
  analyticsStore.requests++;
  trackIP(ip, "request");

  const { token, challenge, fingerprint } = req.body;

  if (!token || !challenge) {
    return res.status(400).json({ success: false, error: 400, message: "missing_fields" });
  }

  const data = tokenStore.get(token);

  if (!data || data.type !== "invisible") {
    trackIP(ip, "fail");
    return res.status(401).json({ success: false, error: 401, message: "invalid_token" });
  }

  if (Date.now() > data.expiresAt) {
    tokenStore.delete(token);
    return res.status(401).json({ success: false, error: 401, message: "token_expired" });
  }

  if (data.solved) {
    return res.status(401).json({ success: false, error: 401, message: "token_already_used" });
  }

  if (data.challenge !== challenge) {
    trackIP(ip, "fail");
    return res.status(401).json({ success: false, error: 401, message: "challenge_mismatch" });
  }

  if (data.botScore >= 80) {
    analyticsStore.threats++;
    trackIP(ip, "fail");
    return res.status(403).json({ success: false, error: 403, message: "bot_detected", risk_score: data.botScore });
  }

  // ✅ Invisible verified
  data.solved = true;
  tokenStore.set(token, data);
  analyticsStore.solved++;

  return res.json({
    success: true,
    message: "invisible_verified",
    token,
    risk_score: data.botScore,
    verified_at: Date.now(),
  });
});

// ─────────────────────────────────────────
//  [7] ANALYTICS
// ─────────────────────────────────────────
app.get("/v1/analytics", (req, res) => {
  return res.json({
    success: true,
    data: {
      requests: analyticsStore.requests,
      solved: analyticsStore.solved,
      blocked: analyticsStore.blocked,
      threats: Math.floor(analyticsStore.threats),
      active_tokens: tokenStore.size,
      tracked_ips: ipStore.size,
      solve_rate: analyticsStore.requests > 0
        ? ((analyticsStore.solved / analyticsStore.requests) * 100).toFixed(1) + "%"
        : "0%",
    },
  });
});

// ─────────────────────────────────────────
//  [8] IP STATUS
// ─────────────────────────────────────────
app.get("/v1/ip/status", (req, res) => {
  const ip = getIP(req);
  const data = ipStore.get(ip);

  if (!data) {
    return res.json({ success: true, ip, status: "clean", data: null });
  }

  return res.json({
    success: true,
    ip,
    status: data.isBlocked ? "blocked" : "clean",
    data: {
      requests: data.requests,
      blocked: data.blocked,
      failCount: data.failCount,
      firstSeen: new Date(data.firstSeen).toISOString(),
      lastSeen: new Date(data.lastSeen).toISOString(),
    },
  });
});

// ─────────────────────────────────────────
//  [9] UNBLOCK IP (Admin)
// ─────────────────────────────────────────
app.post("/v1/ip/unblock", (req, res) => {
  const adminKey = req.headers["x-admin-key"];
  if (adminKey !== process.env.ADMIN_KEY) {
    return res.status(403).json({ success: false, error: 403, message: "forbidden" });
  }

  const { ip } = req.body;
  if (!ip) return res.status(400).json({ success: false, error: 400, message: "missing_ip" });

  const data = ipStore.get(ip);
  if (data) {
    data.isBlocked = false;
    data.failCount = 0;
    ipStore.set(ip, data);
  }

  return res.json({ success: true, message: "ip_unblocked", ip });
});

// ─────────────────────────────────────────
//  404 catch
// ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, error: 404, message: "endpoint_not_found" });
});

// ─────────────────────────────────────────
//  START
// ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   desv.online CAPTCHA Server — Running   ║
║   Port: ${PORT}                              ║
╚══════════════════════════════════════════╝

Endpoints:
  GET  /v1/captcha/generate          → Code CAPTCHA (Canvas)
  POST /v1/captcha/verify            → Verify code
  GET  /v1/captcha/puzzle            → Puzzle slider
  POST /v1/captcha/puzzle/verify     → Verify puzzle
  GET  /v1/captcha/invisible         → Invisible CAPTCHA
  POST /v1/captcha/invisible/verify  → Verify invisible
  GET  /v1/analytics                 → Stats
  GET  /v1/ip/status                 → IP check
`);
});

module.exports = app;
