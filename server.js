/**
 * ╔══════════════════════════════════════════╗
 * ║     desv.online — CAPTCHA API Server     ║
 * ║  Rate Limit · Bot Detection · IP Track  ║
 * ║  Puzzle Slider · Invisible · Code CAPTCHA║
 * ╚══════════════════════════════════════════╝
 */

require("dotenv").config();
const express   = require("express");
const { createCanvas } = require("@napi-rs/canvas");
const { v4: uuidv4 }   = require("uuid");
const cors      = require("cors");
const rateLimit = require("express-rate-limit");
const helmet    = require("helmet");

const app  = express();
const PORT = process.env.PORT || 3000;

// ═══════════════════════════════════════════
//  IN-MEMORY STORES
// ═══════════════════════════════════════════
const tokenStore     = new Map();
const ipStore        = new Map();
const analyticsStore = { requests: 0, solved: 0, blocked: 0, threats: 0 };

setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tokenStore.entries()) {
    if (now - data.createdAt > 5 * 60 * 1000) tokenStore.delete(token);
  }
}, 2 * 60 * 1000);

// ═══════════════════════════════════════════
//  MIDDLEWARE
// ═══════════════════════════════════════════
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: "*", methods: ["GET", "POST"], allowedHeaders: ["Content-Type", "Authorization"] }));
app.use(express.json());

const globalLimiter = rateLimit({
  windowMs: 60 * 1000, max: 100, standardHeaders: true, legacyHeaders: false,
  handler: (req, res) => {
    analyticsStore.blocked++;
    trackIP(getIP(req), "blocked");
    res.status(429).json({ success: false, error: 429, message: "rate_limit_exceeded", retry_after: 60 });
  },
});

const generateLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20,
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
  return req.headers["x-forwarded-for"]?.split(",")[0].trim()
    || req.headers["x-real-ip"]
    || req.socket?.remoteAddress
    || "unknown";
}

function trackIP(ip, event = "request") {
  const now = Date.now();
  const d   = ipStore.get(ip) || { requests: 0, blocked: 0, firstSeen: now, lastSeen: now, failCount: 0, isBlocked: false };
  d.lastSeen = now;
  if (event === "request") d.requests++;
  if (event === "blocked") d.blocked++;
  if (event === "fail")    d.failCount++;
  if (d.failCount >= 10)   { d.isBlocked = true; analyticsStore.threats++; }
  ipStore.set(ip, d);
  return d;
}

function isIPBlocked(ip) { return ipStore.get(ip)?.isBlocked === true; }

function detectBot(req) {
  const ua  = (req.headers["user-agent"] || "").toLowerCase();
  const bots = [/bot/i,/crawl/i,/spider/i,/slurp/i,/scrape/i,/curl/i,/wget/i,/python-requests/i,/axios/i,/go-http/i,/java\//i,/libwww/i,/httpclient/i,/okhttp/i];
  const isBot  = bots.some(p => p.test(ua));
  const susp   = !req.headers["accept"] || !req.headers["accept-language"];
  return { isBot, susp, score: (isBot ? 60 : 0) + (susp ? 40 : 0) };
}

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// ═══════════════════════════════════════════
//  CANVAS — CODE IMAGE  ✅ FIXED
// ═══════════════════════════════════════════
function generateCodeImage(code, theme = "dark") {
  const W = 240, H = 80;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");
  const dark   = theme !== "light";

  // Background
  ctx.fillStyle = dark ? "#0d0d10" : "#f5f5f7";
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = dark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  ctx.lineWidth = 0.5;
  for (let x = 0; x < W; x += 15) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 15) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Noise
  for (let i = 0; i < 80; i++) {
    ctx.fillStyle = dark ? `rgba(255,255,255,${Math.random()*0.12})` : `rgba(0,0,0,${Math.random()*0.08})`;
    ctx.beginPath(); ctx.arc(Math.random()*W, Math.random()*H, Math.random()*1.5, 0, Math.PI*2); ctx.fill();
  }

  // Interference lines
  const lc = dark
    ? ["rgba(110,168,255,0.2)","rgba(168,216,168,0.15)","rgba(255,200,80,0.12)"]
    : ["rgba(100,120,255,0.18)","rgba(50,180,100,0.14)","rgba(200,100,0,0.12)"];
  for (let i = 0; i < 6; i++) {
    ctx.strokeStyle = lc[i % lc.length]; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.random()*W, Math.random()*H);
    ctx.bezierCurveTo(Math.random()*W, Math.random()*H, Math.random()*W, Math.random()*H, Math.random()*W, Math.random()*H);
    ctx.stroke();
  }

  // Characters — ✅ scale BEFORE font/fillText
  const colors = dark
    ? ["#7aabff","#a8d8a8","#ffcf80","#ff9cda","#80e8ff","#c8b8ff"]
    : ["#2255cc","#1a7a3c","#cc7700","#cc2299","#0077aa","#7744cc"];

  for (let i = 0; i < code.length; i++) {
    const x   = 18 + i * 34;
    const y   = 50 + (Math.random() - 0.5) * 14;
    const ang = (Math.random() - 0.5) * 0.45;
    const sz  = 28 + Math.random() * 8;
    const col = colors[i % colors.length];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    ctx.scale(1, 0.88 + Math.random() * 0.24); // ✅ before font
    ctx.shadowColor = col;
    ctx.shadowBlur  = 6;
    ctx.font        = `bold ${sz}px Arial`;
    ctx.fillStyle   = col;
    ctx.fillText(code[i], 0, 0);
    ctx.restore();
  }

  // Border
  ctx.strokeStyle = dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.1)";
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, W-1, H-1);

  return canvas.toDataURL("image/png");
}

// ═══════════════════════════════════════════
//  CANVAS — PUZZLE IMAGE  ✅ FIXED
// ═══════════════════════════════════════════
function generatePuzzleImages(theme = "dark") {
  const W = 300, H = 120, PS = 50;
  const pieceY  = Math.floor(Math.random() * (H - PS - 10)) + 5;
  const answerX = Math.floor(Math.random() * (W - PS - 60)) + 50;
  const dark    = theme !== "light";

  const bgCanvas = createCanvas(W, H);
  const bgCtx    = bgCanvas.getContext("2d");
  const grad     = bgCtx.createLinearGradient(0,0,W,H);
  dark ? (grad.addColorStop(0,"#0f0f18"), grad.addColorStop(1,"#0a0a12"))
       : (grad.addColorStop(0,"#e8eaf6"), grad.addColorStop(1,"#f0f2ff"));
  bgCtx.fillStyle = grad; bgCtx.fillRect(0,0,W,H);

  for (let i = 0; i < 14; i++) {
    bgCtx.fillStyle = dark ? `rgba(110,168,255,${0.04+Math.random()*0.08})` : `rgba(80,100,200,${0.04+Math.random()*0.06})`;
    bgCtx.beginPath(); bgCtx.arc(Math.random()*W, Math.random()*H, 10+Math.random()*25, 0, Math.PI*2); bgCtx.fill();
  }

  bgCtx.save();
  bgCtx.fillStyle   = dark ? "rgba(0,0,0,0.55)"         : "rgba(0,0,0,0.2)";
  bgCtx.strokeStyle = dark ? "rgba(110,168,255,0.6)"     : "rgba(80,100,200,0.5)";
  bgCtx.lineWidth = 2; bgCtx.setLineDash([4,3]);
  bgCtx.fillRect(answerX, pieceY, PS, PS);
  bgCtx.strokeRect(answerX, pieceY, PS, PS);
  bgCtx.restore();

  bgCtx.fillStyle = dark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)";
  bgCtx.font = "bold 11px Arial";
  bgCtx.fillText("Slide to fit →", answerX + PS + 6, pieceY + PS/2 + 4);

  bgCtx.strokeStyle = dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.1)";
  bgCtx.lineWidth = 1; bgCtx.setLineDash([]);
  bgCtx.strokeRect(0.5, 0.5, W-1, H-1);

  const pieceCanvas = createCanvas(PS, PS);
  const pCtx        = pieceCanvas.getContext("2d");
  const pGrad       = pCtx.createLinearGradient(0,0,PS,PS);
  dark ? (pGrad.addColorStop(0,"#1a1a28"), pGrad.addColorStop(1,"#141420"))
       : (pGrad.addColorStop(0,"#dde2ff"), pGrad.addColorStop(1,"#eaeeff"));
  pCtx.fillStyle = pGrad; pCtx.fillRect(0,0,PS,PS);
  for (let i = 0; i < 5; i++) {
    pCtx.fillStyle = dark ? `rgba(110,168,255,${0.08+Math.random()*0.14})` : `rgba(80,100,200,${0.06+Math.random()*0.1})`;
    pCtx.beginPath(); pCtx.arc(Math.random()*PS, Math.random()*PS, 5+Math.random()*12, 0, Math.PI*2); pCtx.fill();
  }
  pCtx.strokeStyle = dark ? "rgba(110,168,255,0.7)" : "rgba(80,100,200,0.6)";
  pCtx.lineWidth = 2; pCtx.strokeRect(1,1,PS-2,PS-2);

  return { background: bgCanvas.toDataURL("image/png"), piece: pieceCanvas.toDataURL("image/png"), answerX, pieceY, tolerance: 8 };
}

// ═══════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════
app.get("/", (req, res) => res.json({
  name: "desv.online CAPTCHA API", version: "1.1.0", status: "operational",
  endpoints: ["GET /v1/captcha/generate","POST /v1/captcha/verify","GET /v1/captcha/puzzle","POST /v1/captcha/puzzle/verify","GET /v1/captcha/invisible","POST /v1/captcha/invisible/verify","GET /v1/analytics","GET /v1/ip/status","POST /v1/ip/unblock"],
}));

// [1] Generate code
app.get("/v1/captcha/generate", generateLimiter, (req, res) => {
  const ip = getIP(req); analyticsStore.requests++; trackIP(ip,"request");
  if (isIPBlocked(ip)) { analyticsStore.blocked++; return res.status(403).json({ success:false, error:403, message:"ip_blocked" }); }
  const bot = detectBot(req);
  if (bot.score >= 60) { analyticsStore.threats++; trackIP(ip,"fail"); return res.status(403).json({ success:false, error:403, message:"bot_detected", score:bot.score }); }
  const theme = req.query.theme || "dark";
  const code  = generateCode();
  const token = uuidv4();
  tokenStore.set(token, { code, type:"code", createdAt:Date.now(), expiresAt:Date.now()+5*60*1000, ip, solved:false });
  return res.json({ success:true, token, image:generateCodeImage(code,theme), expires_in:300, type:"code" });
});

// [2] Verify code
app.post("/v1/captcha/verify", (req, res) => {
  const ip = getIP(req); analyticsStore.requests++; trackIP(ip,"request");
  const { token, code } = req.body;
  if (!token || !code) return res.status(400).json({ success:false, error:400, message:"missing_fields" });
  const d = tokenStore.get(token);
  if (!d)                        return res.status(401).json({ success:false, error:401, message:"invalid_token" });
  if (d.type !== "code")         return res.status(400).json({ success:false, error:400, message:"wrong_captcha_type" });
  if (Date.now() > d.expiresAt)  { tokenStore.delete(token); return res.status(401).json({ success:false, error:401, message:"token_expired" }); }
  if (d.solved)                  return res.status(401).json({ success:false, error:401, message:"token_already_used" });
  if (d.code.toUpperCase() !== code.toString().toUpperCase().trim()) { trackIP(ip,"fail"); return res.status(401).json({ success:false, error:401, message:"wrong_code" }); }
  d.solved = true; tokenStore.set(token,d); analyticsStore.solved++;
  return res.json({ success:true, message:"captcha_verified", token, verified_at:Date.now() });
});

// [3] Generate puzzle
app.get("/v1/captcha/puzzle", generateLimiter, (req, res) => {
  const ip = getIP(req); analyticsStore.requests++; trackIP(ip,"request");
  if (isIPBlocked(ip)) { analyticsStore.blocked++; return res.status(403).json({ success:false, error:403, message:"ip_blocked" }); }
  const bot = detectBot(req);
  if (bot.score >= 60) { analyticsStore.threats++; return res.status(403).json({ success:false, error:403, message:"bot_detected" }); }
  const theme  = req.query.theme || "dark";
  const token  = uuidv4();
  const puzzle = generatePuzzleImages(theme);
  tokenStore.set(token, { type:"puzzle", answerX:puzzle.answerX, pieceY:puzzle.pieceY, tolerance:puzzle.tolerance, createdAt:Date.now(), expiresAt:Date.now()+5*60*1000, ip, solved:false, attempts:0 });
  return res.json({ success:true, token, background:puzzle.background, piece:puzzle.piece, piece_y:puzzle.pieceY, expires_in:300, type:"puzzle" });
});

// [4] Verify puzzle ✅ FIXED mapping
app.post("/v1/captcha/puzzle/verify", (req, res) => {
  const ip = getIP(req); analyticsStore.requests++; trackIP(ip,"request");
  const { token, x } = req.body;
  if (!token || x === undefined || x === null) return res.status(400).json({ success:false, error:400, message:"missing_fields" });
  const d = tokenStore.get(token);
  if (!d || d.type !== "puzzle") { trackIP(ip,"fail"); return res.status(401).json({ success:false, error:401, message:"invalid_token" }); }
  if (Date.now() > d.expiresAt)  { tokenStore.delete(token); return res.status(401).json({ success:false, error:401, message:"token_expired" }); }
  if (d.solved)                  return res.status(401).json({ success:false, error:401, message:"token_already_used" });
  d.attempts = (d.attempts||0) + 1;
  if (d.attempts > 5) { tokenStore.delete(token); trackIP(ip,"fail"); return res.status(403).json({ success:false, error:403, message:"too_many_attempts" }); }
  if (Math.abs(Number(x) - d.answerX) > d.tolerance) { tokenStore.set(token,d); return res.status(401).json({ success:false, error:401, message:"wrong_position", attempts_left:5-d.attempts }); }
  d.solved = true; tokenStore.set(token,d); analyticsStore.solved++;
  return res.json({ success:true, message:"puzzle_verified", token, verified_at:Date.now() });
});

// [5] Generate invisible
app.get("/v1/captcha/invisible", (req, res) => {
  const ip = getIP(req); analyticsStore.requests++; trackIP(ip,"request");
  if (isIPBlocked(ip)) { analyticsStore.blocked++; return res.status(403).json({ success:false, error:403, message:"ip_blocked" }); }
  const bot       = detectBot(req);
  const token     = uuidv4();
  const challenge = uuidv4().replace(/-/g,"").substring(0,16);
  tokenStore.set(token, { type:"invisible", challenge, botScore:bot.score, createdAt:Date.now(), expiresAt:Date.now()+10*60*1000, ip, solved:false });
  return res.json({ success:true, token, challenge, expires_in:600, type:"invisible", risk_score:bot.score });
});

// [6] Verify invisible
app.post("/v1/captcha/invisible/verify", (req, res) => {
  const ip = getIP(req); analyticsStore.requests++; trackIP(ip,"request");
  const { token, challenge } = req.body;
  if (!token || !challenge) return res.status(400).json({ success:false, error:400, message:"missing_fields" });
  const d = tokenStore.get(token);
  if (!d || d.type !== "invisible") { trackIP(ip,"fail"); return res.status(401).json({ success:false, error:401, message:"invalid_token" }); }
  if (Date.now() > d.expiresAt)     { tokenStore.delete(token); return res.status(401).json({ success:false, error:401, message:"token_expired" }); }
  if (d.solved)                      return res.status(401).json({ success:false, error:401, message:"token_already_used" });
  if (d.challenge !== challenge)     { trackIP(ip,"fail"); return res.status(401).json({ success:false, error:401, message:"challenge_mismatch" }); }
  if (d.botScore >= 80) { analyticsStore.threats++; trackIP(ip,"fail"); return res.status(403).json({ success:false, error:403, message:"bot_detected", risk_score:d.botScore }); }
  d.solved = true; tokenStore.set(token,d); analyticsStore.solved++;
  return res.json({ success:true, message:"invisible_verified", token, risk_score:d.botScore, verified_at:Date.now() });
});

// [7] Analytics
app.get("/v1/analytics", (req, res) => res.json({
  success: true,
  data: {
    requests: analyticsStore.requests, solved: analyticsStore.solved,
    blocked: analyticsStore.blocked, threats: Math.floor(analyticsStore.threats),
    active_tokens: tokenStore.size, tracked_ips: ipStore.size,
    solve_rate: analyticsStore.requests > 0 ? ((analyticsStore.solved/analyticsStore.requests)*100).toFixed(1)+"%" : "0%",
  },
}));

// [8] IP status
app.get("/v1/ip/status", (req, res) => {
  const ip = getIP(req); const d = ipStore.get(ip);
  if (!d) return res.json({ success:true, ip, status:"clean", data:null });
  return res.json({ success:true, ip, status:d.isBlocked?"blocked":"clean", data:{ requests:d.requests, blocked:d.blocked, failCount:d.failCount, firstSeen:new Date(d.firstSeen).toISOString(), lastSeen:new Date(d.lastSeen).toISOString() } });
});

// [9] Unblock IP (admin)
app.post("/v1/ip/unblock", (req, res) => {
  if (req.headers["x-admin-key"] !== process.env.ADMIN_KEY) return res.status(403).json({ success:false, error:403, message:"forbidden" });
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ success:false, error:400, message:"missing_ip" });
  const d = ipStore.get(ip);
  if (d) { d.isBlocked=false; d.failCount=0; ipStore.set(ip,d); }
  return res.json({ success:true, message:"ip_unblocked", ip });
});

// 404
app.use((req, res) => res.status(404).json({ success:false, error:404, message:"endpoint_not_found" }));

// Start
app.listen(PORT, () => console.log(`
╔══════════════════════════════════════════╗
║   desv.online CAPTCHA Server — Running   ║
║   Port: ${PORT}                              ║
╚══════════════════════════════════════════╝
`));

module.exports = app;
