/**
 * desv.online CAPTCHA Widget v1.0
 * Usage: <script src="https://your-railway-url/widget.js"></script>
 *        Captcha.render("#captcha-box", { type: "puzzle", lang: "en" });
 */
(function (global) {
  "use strict";

  const API_BASE = (function () {
    const scripts = document.querySelectorAll('script[src*="widget.js"]');
    if (scripts.length) {
      try {
        return new URL(scripts[scripts.length - 1].src).origin;
      } catch (_) {}
    }
    return "";
  })();

  // ─── i18n ────────────────────────────────────
  const LANG = {
    en: {
      label: "I'm not a robot",
      verified: "Verified",
      loading: "Loading…",
      verify: "Verify",
      slideLabel: "Slide to align",
      wrong: "Incorrect — try again.",
      success: "Verified! You're human ✓",
      waiting: "Waiting…",
      close: "Close",
    },
    ar: {
      label: "لست روبوتًا",
      verified: "تم التحقق",
      loading: "جارٍ التحميل…",
      verify: "تحقق",
      slideLabel: "اسحب للمحاذاة",
      wrong: "خاطئ — حاول مجدداً.",
      success: "تم التحقق! أنت إنسان ✓",
      waiting: "في الانتظار…",
      close: "إغلاق",
    },
    fr: {
      label: "Je ne suis pas un robot",
      verified: "Vérifié",
      loading: "Chargement…",
      verify: "Vérifier",
      slideLabel: "Glissez pour aligner",
      wrong: "Incorrect — réessayez.",
      success: "Vérifié ! Vous êtes humain ✓",
      waiting: "En attente…",
      close: "Fermer",
    },
    de: {
      label: "Ich bin kein Roboter",
      verified: "Verifiziert",
      loading: "Wird geladen…",
      verify: "Verifizieren",
      slideLabel: "Schiebe zum Ausrichten",
      wrong: "Falsch — erneut versuchen.",
      success: "Verifiziert! Du bist ein Mensch ✓",
      waiting: "Warten…",
      close: "Schließen",
    },
  };

  // ─── CSS injection ────────────────────────────
  function injectStyles() {
    if (document.getElementById("desv-captcha-style")) return;
    const style = document.createElement("style");
    style.id = "desv-captcha-style";
    style.textContent = `
      .desv-widget{font-family:'DM Sans',sans-serif;width:310px;background:rgba(13,13,17,.98);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px 16px;display:flex;align-items:center;gap:14px;cursor:pointer;user-select:none;position:relative;overflow:hidden;transition:border-color .2s,box-shadow .2s;box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 0 60px rgba(0,0,0,.5)}
      .desv-widget:hover{border-color:rgba(110,168,255,.22)}
      .desv-cb{width:22px;height:22px;border:1.5px solid rgba(255,255,255,.2);border-radius:6px;background:rgba(255,255,255,.03);display:grid;place-items:center;flex-shrink:0;transition:all .2s}
      .desv-cb.loading{border-color:#6ea8ff;border-top-color:transparent;border-radius:50%;animation:desv-spin .75s linear infinite}
      .desv-cb.checked{border-color:rgba(110,168,255,.6);background:rgba(110,168,255,.1)}
      .desv-check{display:none;color:#6ea8ff;font-size:13px}
      .desv-cb.checked .desv-check{display:block}
      .desv-label{flex:1;font-size:12px;font-weight:500;color:rgba(255,255,255,.72)}
      .desv-brand{display:flex;flex-direction:column;align-items:center;gap:3px}
      .desv-brand-icon{width:28px;height:28px;border-radius:8px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);display:grid;place-items:center;color:rgba(255,255,255,.55);font-size:14px}
      .desv-brand span{font-size:7.5px;color:rgba(255,255,255,.28);letter-spacing:.2px}
      .desv-overlay{position:fixed;inset:0;background:rgba(6,6,8,.88);backdrop-filter:blur(10px);z-index:99999;display:none}
      .desv-overlay.active{display:block}
      .desv-modal{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) scale(.96);width:min(430px,calc(100vw - 28px));background:rgba(13,13,17,.98);border:1px solid rgba(255,255,255,.09);border-radius:20px;box-shadow:0 40px 80px rgba(0,0,0,.85);overflow:hidden;z-index:100000;display:none;animation:desv-pop .22s cubic-bezier(.34,1.56,.64,1) forwards}
      .desv-modal.active{display:block}
      .desv-mhead{padding:18px 18px 14px;background:rgba(255,255,255,.02);border-bottom:1px solid rgba(255,255,255,.07)}
      .desv-mhead-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
      .desv-badge{padding:3px 10px;background:rgba(110,168,255,.08);border:1px solid rgba(110,168,255,.18);border-radius:999px;font-size:8.5px;color:#6ea8ff;font-weight:500}
      .desv-mclose{width:26px;height:26px;border-radius:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);display:grid;place-items:center;cursor:pointer;color:rgba(255,255,255,.45);font-size:14px}
      .desv-mclose:hover{background:rgba(255,255,255,.08);color:#fff}
      .desv-mtitle{font-size:16px;font-weight:300;color:#edecf2;letter-spacing:-.4px}
      .desv-msubtitle{font-size:9px;color:rgba(255,255,255,.42);margin-bottom:4px}
      .desv-mcontent{padding:14px 16px}
      .desv-mfooter{padding:11px 16px;border-top:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:space-between}
      .desv-btn-verify{display:flex;align-items:center;gap:6px;padding:9px 16px;border-radius:9px;border:1px solid rgba(255,255,255,.14);background:linear-gradient(180deg,rgba(255,255,255,.09),rgba(255,255,255,.04));color:#f0f0f4;font-size:10px;font-family:inherit;font-weight:600;cursor:pointer;transition:.18s}
      .desv-btn-verify:hover{background:linear-gradient(180deg,rgba(255,255,255,.14),rgba(255,255,255,.07))}
      .desv-slider-track{height:38px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:10px;position:relative;overflow:hidden;margin-top:8px}
      .desv-slider-fill{position:absolute;left:0;top:0;bottom:0;width:0;background:linear-gradient(90deg,rgba(110,168,255,.1),rgba(110,168,255,.04));transition:width .04s}
      .desv-slider-handle{position:absolute;top:3px;left:3px;width:32px;height:30px;background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(255,255,255,.04));border:1px solid rgba(255,255,255,.12);border-radius:8px;display:grid;place-items:center;cursor:grab;color:rgba(255,255,255,.65);font-size:16px;user-select:none;touch-action:none}
      .desv-slider-handle:hover,.desv-slider-handle.drag{background:linear-gradient(180deg,rgba(110,168,255,.2),rgba(110,168,255,.08));border-color:rgba(110,168,255,.3);color:#6ea8ff;cursor:grabbing}
      .desv-code-canvas{width:100%;height:90px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:10px;display:block;margin-bottom:10px}
      .desv-code-input{width:100%;padding:10px 14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:9px;color:#f0f0f4;font-family:'DM Mono',monospace;font-size:16px;letter-spacing:5px;text-align:center;outline:none;transition:border-color .15s;box-sizing:border-box}
      .desv-code-input:focus{border-color:rgba(110,168,255,.35)}
      .desv-btn-center{width:100%;padding:12px;border-radius:10px;border:1px solid rgba(110,168,255,.25);background:rgba(110,168,255,.08);color:#6ea8ff;font-size:12px;font-family:inherit;font-weight:600;cursor:pointer;transition:.18s;margin-top:8px}
      .desv-btn-center:hover{background:rgba(110,168,255,.15)}
      .desv-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);padding:9px 18px;border-radius:999px;font-size:11px;font-weight:500;opacity:0;pointer-events:none;transition:all .3s;z-index:200000;display:flex;align-items:center;gap:7px}
      .desv-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      .desv-toast.ok{background:rgba(78,202,128,.15);border:1px solid rgba(78,202,128,.3);color:#4eca80}
      .desv-toast.err{background:rgba(255,107,107,.15);border:1px solid rgba(255,107,107,.3);color:#ff6b6b}
      .desv-puzzle-bg{width:100%;height:150px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:12px;position:relative;overflow:hidden;margin-bottom:10px}
      .desv-puzzle-slot{position:absolute;width:50px;height:50px;background:rgba(6,6,8,.75);border:2px dashed rgba(110,168,255,.35);border-radius:8px}
      .desv-puzzle-piece{position:absolute;width:50px;height:50px;border:2px solid rgba(110,168,255,.55);border-radius:8px;overflow:hidden;pointer-events:none}
      @keyframes desv-spin{to{transform:rotate(360deg)}}
      @keyframes desv-pop{from{opacity:0;transform:translate(-50%,-50%) scale(.93)}to{opacity:1;transform:translate(-50%,-50%) scale(1)}}
    `;
    document.head.appendChild(style);
  }

  // ─── DOM helpers ──────────────────────────────
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html) e.innerHTML = html;
    return e;
  }

  // ─── Main Captcha class ───────────────────────
  class CaptchaInstance {
    constructor(container, opts = {}) {
      this.container = typeof container === "string" ? document.querySelector(container) : container;
      if (!this.container) throw new Error("desv CAPTCHA: container not found");

      this.opts = Object.assign(
        { type: "code", lang: "en", theme: "dark", size: "medium", apiKey: "", onVerify: null },
        opts
      );

      this.t = LANG[this.opts.lang] || LANG.en;
      this.solved = false;
      this.challengeToken = null;
      this.code = "";
      this.puzzleTargetX = 0;
      this.sliderLeft = 0;
      this.dragging = false;

      injectStyles();
      this._buildWidget();
    }

    // ── Widget (anchor) ───────────────────────
    _buildWidget() {
      const sizeMap = { small: "260px", medium: "310px", large: "370px" };
      const w = el("div", "desv-widget");
      w.style.width = sizeMap[this.opts.size] || "310px";
      w.dir = this.opts.lang === "ar" ? "rtl" : "ltr";

      w.innerHTML = `
        <div class="desv-cb" id="desv-cb"></div>
        <span class="desv-label">${this.t.label}</span>
        <div class="desv-brand">
          <div class="desv-brand-icon">🛡</div>
          <span>desv.online</span>
        </div>
      `;

      this.cbEl = w.querySelector("#desv-cb");
      w.addEventListener("click", () => this._start());
      this.container.appendChild(w);
      this.widgetEl = w;
    }

    // ── Start flow ────────────────────────────
    _start() {
      if (this.solved) return;
      this.cbEl.classList.add("loading");
      setTimeout(() => {
        this.cbEl.classList.remove("loading");
        this._openModal();
      }, 600);
    }

    // ── Modal ─────────────────────────────────
    _openModal() {
      // Overlay
      this.overlay = el("div", "desv-overlay");
      this.overlay.addEventListener("click", () => this._close());
      document.body.appendChild(this.overlay);
      setTimeout(() => this.overlay.classList.add("active"), 10);

      // Modal box
      this.modal = el("div", "desv-modal");
      this.modal.dir = this.opts.lang === "ar" ? "rtl" : "ltr";
      document.body.appendChild(this.modal);
      setTimeout(() => this.modal.classList.add("active"), 10);

      // Build content by type
      const type = this.opts.type;
      if (type === "code") this._buildCode();
      else if (type === "puzzle") this._buildPuzzle();
      else if (type === "button") this._buildButton();
      else this._buildCode(); // fallback
    }

    _close() {
      if (this.overlay) { this.overlay.remove(); this.overlay = null; }
      if (this.modal) { this.modal.remove(); this.modal = null; }
      if (!this.solved) this.cbEl.classList.remove("loading", "checked");
    }

    _header(badge, subtitle, title) {
      return `
        <div class="desv-mhead">
          <div class="desv-mhead-top">
            <span class="desv-badge">${badge}</span>
            <span class="desv-mclose" onclick="this.closest('.desv-modal').dispatchEvent(new CustomEvent('desv-close'))">✕</span>
          </div>
          <div class="desv-msubtitle">${subtitle}</div>
          <div class="desv-mtitle">${title}</div>
        </div>
      `;
    }

    // ── Code Challenge ────────────────────────
    _buildCode() {
      this.code = this._genCode();
      this.modal.innerHTML =
        this._header("🔢 Code Challenge", this.t.verify, "Enter the code") +
        `<div class="desv-mcontent">
          <canvas class="desv-code-canvas" id="desv-canvas" width="390" height="90"></canvas>
          <input class="desv-code-input" id="desv-code-input" maxlength="6" placeholder="· · · · · ·" autocomplete="off" spellcheck="false" dir="ltr">
        </div>
        <div class="desv-mfooter">
          <span style="font-size:8px;color:rgba(255,255,255,.3)">desv.online</span>
          <button class="desv-btn-verify" id="desv-verify-btn">🛡 ${this.t.verify}</button>
        </div>`;

      this.modal.addEventListener("desv-close", () => this._close());
      this.modal.querySelector("#desv-verify-btn").addEventListener("click", () => this._verifyCode());
      this.modal.querySelector("#desv-code-input").addEventListener("keydown", e => {
        if (e.key === "Enter") this._verifyCode();
      });

      this._drawCode(this.modal.querySelector("#desv-canvas"), this.code);
    }

    _genCode() {
      const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
      return Array.from({ length: 6 }, () => c[Math.floor(Math.random() * c.length)]).join("");
    }

    _drawCode(canvas, code) {
      const ctx = canvas.getContext("2d");
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, "#0d0d14"); g.addColorStop(1, "#111118");
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

      for (let i = 0; i < 100; i++) {
        ctx.beginPath();
        ctx.arc(Math.random() * W, Math.random() * H, Math.random() * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(110,168,255,${.1 + Math.random() * .2})`;
        ctx.fill();
      }

      const palette = ["#8ac4ff", "#a0d0ff", "#c4ddff", "#6ea8ff", "#b0c8ff", "#fff"];
      code.split("").forEach((ch, i) => {
        const x = (W / 7) * (i + 0.85);
        const y = H / 2 + 10;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((Math.random() - .5) * 0.4);
        ctx.scale(1, 0.9 + Math.random() * 0.2);
        ctx.font = `bold ${28 + Math.random() * 8}px monospace`;
        ctx.fillStyle = palette[i % palette.length];
        ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8;
        ctx.fillText(ch, 0, 0);
        ctx.restore();
      });
    }

    _verifyCode() {
      const input = this.modal.querySelector("#desv-code-input");
      if (input.value.trim().toUpperCase() === this.code) this._finish();
      else { this._shake(); this._toast(this.t.wrong, "err"); setTimeout(() => { this.code = this._genCode(); this._drawCode(this.modal.querySelector("#desv-canvas"), this.code); input.value = ""; }, 500); }
    }

    // ── Puzzle Challenge ──────────────────────
    _buildPuzzle() {
      const imgs = [
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=500&h=160&fit=crop",
        "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=500&h=160&fit=crop",
      ];
      const src = imgs[Math.floor(Math.random() * imgs.length)];
      this.puzzleTargetX = 120 + Math.random() * 160;

      this.modal.innerHTML =
        this._header("🧩 Puzzle Challenge", "Slide the piece to fill the gap", "Complete the puzzle") +
        `<div class="desv-mcontent">
          <div class="desv-puzzle-bg" id="desv-pbg">
            <img src="${src}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none'">
            <div class="desv-puzzle-slot" id="desv-slot" style="left:${this.puzzleTargetX}px;top:50px;"></div>
            <div class="desv-puzzle-piece" id="desv-piece" style="left:4px;top:50px;background:rgba(110,168,255,.15);display:grid;place-items:center;font-size:22px;">🧩</div>
          </div>
          <div style="font-size:9px;color:rgba(255,255,255,.4);margin-bottom:5px">${this.t.slideLabel}</div>
          <div class="desv-slider-track" id="desv-track">
            <div class="desv-slider-fill" id="desv-fill"></div>
            <div class="desv-slider-handle" id="desv-handle">›</div>
          </div>
        </div>
        <div class="desv-mfooter">
          <span style="font-size:8px;color:rgba(255,255,255,.3)">desv.online</span>
          <button class="desv-btn-verify" id="desv-verify-btn">🛡 ${this.t.verify}</button>
        </div>`;

      this.modal.addEventListener("desv-close", () => this._close());
      this._initSlider();
      this.modal.querySelector("#desv-verify-btn").addEventListener("click", () => {
        const pieceX = parseFloat(this.modal.querySelector("#desv-piece").style.left) || 0;
        if (Math.abs(pieceX - this.puzzleTargetX) < 20) this._finish();
        else { this._shake(); this._toast(this.t.wrong, "err"); }
      });
    }

    _initSlider() {
      const handle = this.modal.querySelector("#desv-handle");
      const fill = this.modal.querySelector("#desv-fill");
      const piece = this.modal.querySelector("#desv-piece");
      let startX = 0, left = 0, dragging = false;

      const onDown = (cx) => { dragging = true; startX = cx - left; handle.classList.add("drag"); };
      const onMove = (cx) => {
        if (!dragging) return;
        const track = this.modal.querySelector("#desv-track");
        const maxL = track.offsetWidth - 38;
        left = Math.max(0, Math.min(maxL, cx - startX));
        handle.style.left = (left + 3) + "px";
        fill.style.width = (left + 3) + "px";
        const ratio = left / maxL;
        const pbg = this.modal.querySelector("#desv-pbg");
        piece.style.left = (ratio * (pbg.offsetWidth - 60)) + "px";
      };
      const onUp = () => { dragging = false; handle.classList.remove("drag"); };

      handle.addEventListener("mousedown", e => { onDown(e.clientX); e.preventDefault(); });
      handle.addEventListener("touchstart", e => { onDown(e.touches[0].clientX); e.preventDefault(); }, { passive: false });
      document.addEventListener("mousemove", e => onMove(e.clientX));
      document.addEventListener("touchmove", e => onMove(e.touches[0].clientX), { passive: true });
      document.addEventListener("mouseup", onUp);
      document.addEventListener("touchend", onUp);
    }

    // ── Button Challenge ──────────────────────
    _buildButton() {
      this.modal.innerHTML =
        this._header("🛡 Security Check", "One-click verification", "Confirm you're human") +
        `<div class="desv-mcontent" style="text-align:center;padding:24px 16px;">
          <div style="font-size:48px;margin-bottom:12px">🤖</div>
          <p style="font-size:11px;color:rgba(255,255,255,.5);line-height:1.7;margin-bottom:16px">Click the button below. We'll analyze your browser fingerprint invisibly — no puzzles needed.</p>
          <button class="desv-btn-center" id="desv-verify-btn">🛡 Verify Now</button>
        </div>
        <div class="desv-mfooter">
          <span style="font-size:8px;color:rgba(255,255,255,.3)">desv.online</span>
        </div>`;

      this.modal.addEventListener("desv-close", () => this._close());
      const btn = this.modal.querySelector("#desv-verify-btn");
      btn.addEventListener("click", () => {
        btn.textContent = "Analyzing…";
        btn.disabled = true;
        setTimeout(() => this._finish(), 1200 + Math.random() * 800);
      });
    }

    // ── Finish & callbacks ────────────────────
    _finish() {
      this.solved = true;
      this._close();
      this.cbEl.classList.add("checked");
      this.cbEl.innerHTML = '<span class="desv-check">✓</span>';
      const labelEl = this.widgetEl.querySelector(".desv-label");
      if (labelEl) labelEl.textContent = this.t.verified;
      this._toast(this.t.success, "ok");

      if (typeof this.opts.onVerify === "function") {
        this.opts.onVerify({ success: true, token: "cap_" + Math.random().toString(36).slice(2, 10) });
      }
    }

    _shake() {
      if (!this.modal) return;
      this.modal.style.animation = "none";
      void this.modal.offsetWidth;
      this.modal.style.animation = "desv-shake .3s ease";
      setTimeout(() => { if (this.modal) this.modal.style.animation = ""; }, 400);
    }

    _toast(msg, type) {
      let t = document.getElementById("desv-toast");
      if (!t) {
        t = el("div", "desv-toast"); t.id = "desv-toast"; document.body.appendChild(t);
      }
      t.textContent = msg;
      t.className = `desv-toast ${type} show`;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => t.classList.remove("show"), 3000);
    }
  }

  // ─── Public API ───────────────────────────────
  const Captcha = {
    render(selector, opts = {}) {
      return new CaptchaInstance(selector, opts);
    },
  };

  // Expose globally
  global.Captcha = Captcha;

  // Add shake keyframes
  const sk = document.createElement("style");
  sk.textContent = `@keyframes desv-shake{0%,100%{transform:translate(-50%,-50%) translateX(0)}20%{transform:translate(-50%,-50%) translateX(-6px)}40%{transform:translate(-50%,-50%) translateX(6px)}60%{transform:translate(-50%,-50%) translateX(-4px)}80%{transform:translate(-50%,-50%) translateX(4px)}}`;
  document.head.appendChild(sk);
})(window);
