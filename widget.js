/**
 * desv.online CAPTCHA Widget v1.0
 * Usage: <script src="https://api.desv.online/widget.js"></script>
 * Then:  Captcha.render("#captcha-box", { type: "code", theme: "dark" })
 */

(function (global) {
  "use strict";

  const API_BASE = "https://api.desv.online/v1";

  const DEFAULT_OPTS = {
    type: "code",       // "code" | "puzzle" | "invisible"
    theme: "dark",      // "dark" | "light" | "auto"
    size: "medium",     // "small" | "medium" | "large"
    lang: "en",
    onSuccess: null,
    onError: null,
  };

  const LABELS = {
    en: { enter: "Enter the code above", verify: "Verify", refresh: "Refresh", slide: "Slide to fit the puzzle", verified: "✔ Verified!", wrong: "Wrong code, try again", expired: "Expired, refreshed" },
    ar: { enter: "أدخل الكود أعلاه", verify: "تحقق", refresh: "تحديث", slide: "اسحب لملء الشكل", verified: "✔ تم التحقق!", wrong: "كود خاطئ، حاول مرة أخرى", expired: "انتهت الصلاحية، تم التجديد" },
    fr: { enter: "Entrez le code ci-dessus", verify: "Vérifier", refresh: "Actualiser", slide: "Glissez pour compléter le puzzle", verified: "✔ Vérifié!", wrong: "Code incorrect", expired: "Expiré, actualisé" },
  };

  const SIZES = {
    small:  { width: "240px", imgH: "60px" },
    medium: { width: "300px", imgH: "80px" },
    large:  { width: "360px", imgH: "100px" },
  };

  // ── CSS ──
  const STYLES = `
    .desv-captcha { font-family: 'Inter', Arial, sans-serif; box-sizing: border-box; }
    .desv-captcha * { box-sizing: border-box; }

    /* Dark */
    .desv-dark { background: #0d0d10; border: 1px solid rgba(255,255,255,.09); border-radius: 14px; padding: 14px; color: #f0f0f2; }
    .desv-dark input { background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.12); color: #f0f0f2; }
    .desv-dark .desv-btn { background: rgba(110,168,255,.15); border: 1px solid rgba(110,168,255,.3); color: #7aabff; }
    .desv-dark .desv-btn:hover { background: rgba(110,168,255,.25); }
    .desv-dark .desv-refresh { color: rgba(255,255,255,.4); }
    .desv-dark .desv-refresh:hover { color: rgba(255,255,255,.8); }
    .desv-dark .desv-label { color: rgba(255,255,255,.5); }
    .desv-dark .desv-slider-track { background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.1); }
    .desv-dark .desv-slider-fill { background: rgba(110,168,255,.2); }
    .desv-dark .desv-slider-thumb { background: #7aabff; }
    .desv-dark .desv-msg-error { color: #ff7a7a; }
    .desv-dark .desv-msg-ok { color: #4ecb80; }
    .desv-dark .desv-logo { color: rgba(255,255,255,.22); }

    /* Light */
    .desv-light { background: #f9f9fb; border: 1px solid rgba(0,0,0,.1); border-radius: 14px; padding: 14px; color: #111; }
    .desv-light input { background: #fff; border: 1px solid rgba(0,0,0,.15); color: #111; }
    .desv-light .desv-btn { background: #eef3ff; border: 1px solid #b8caff; color: #3366cc; }
    .desv-light .desv-btn:hover { background: #dce8ff; }
    .desv-light .desv-refresh { color: rgba(0,0,0,.35); }
    .desv-light .desv-refresh:hover { color: #000; }
    .desv-light .desv-label { color: rgba(0,0,0,.5); }
    .desv-light .desv-slider-track { background: rgba(0,0,0,.06); border: 1px solid rgba(0,0,0,.1); }
    .desv-light .desv-slider-fill { background: rgba(80,120,255,.15); }
    .desv-light .desv-slider-thumb { background: #4477dd; }
    .desv-light .desv-msg-error { color: #cc3333; }
    .desv-light .desv-msg-ok { color: #1a7a3c; }
    .desv-light .desv-logo { color: rgba(0,0,0,.2); }

    /* Shared */
    .desv-captcha img { width: 100%; border-radius: 8px; display: block; margin-bottom: 10px; }
    .desv-captcha input {
      width: 100%; padding: 8px 11px; border-radius: 9px;
      font-family: 'SF Mono', 'Fira Code', monospace; font-size: 15px;
      letter-spacing: 4px; text-align: center; outline: none;
      margin-bottom: 8px;
    }
    .desv-row { display: flex; gap: 6px; }
    .desv-btn {
      flex: 1; padding: 9px 0; border: 0; border-radius: 9px;
      font-size: 12px; font-family: inherit; cursor: pointer;
      transition: .15s;
    }
    .desv-refresh {
      padding: 9px 12px; border: 0; background: transparent;
      border-radius: 9px; cursor: pointer; font-size: 16px; transition: .15s;
    }
    .desv-label { font-size: 10px; margin-bottom: 7px; }
    .desv-msg { font-size: 10px; text-align: center; min-height: 16px; margin-top: 5px; }
    .desv-logo { font-size: 9px; text-align: right; margin-top: 8px; }

    /* Puzzle slider */
    .desv-puzzle-bg { position: relative; margin-bottom: 10px; user-select: none; }
    .desv-puzzle-bg img { margin: 0; }
    .desv-slider-track { position: relative; height: 38px; border-radius: 9px; overflow: hidden; margin-bottom: 8px; }
    .desv-slider-fill { position: absolute; left: 0; top: 0; height: 100%; width: 38px; border-radius: 9px 0 0 9px; transition: width .05s; }
    .desv-slider-thumb {
      position: absolute; top: 4px; left: 0; width: 30px; height: 30px;
      border-radius: 7px; cursor: grab; display: flex; align-items: center; justify-content: center;
      font-size: 14px; color: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.3);
      transition: left .05s;
    }
    .desv-slider-thumb:active { cursor: grabbing; }

    /* Invisible */
    .desv-invisible-box { display: flex; align-items: center; gap: 10px; }
    .desv-invisible-check { width: 20px; height: 20px; border-radius: 5px; cursor: pointer; display: grid; place-items: center; font-size: 13px; transition: .2s; }
    .desv-dark .desv-invisible-check { background: rgba(255,255,255,.06); border: 1.5px solid rgba(255,255,255,.2); }
    .desv-light .desv-invisible-check { background: #fff; border: 1.5px solid rgba(0,0,0,.25); }
    .desv-invisible-text { font-size: 11px; }
    .desv-invisible-spinner { display: none; font-size: 13px; animation: desv-spin 1s linear infinite; }
    @keyframes desv-spin { to { transform: rotate(360deg); } }
  `;

  function injectStyles() {
    if (document.getElementById("desv-captcha-styles")) return;
    const style = document.createElement("style");
    style.id = "desv-captcha-styles";
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  function getTheme(opts) {
    if (opts.theme === "auto") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return opts.theme;
  }

  // ── CODE CAPTCHA ──
  async function renderCode(container, opts) {
    const theme = getTheme(opts);
    const lang = LABELS[opts.lang] || LABELS.en;
    const size = SIZES[opts.size] || SIZES.medium;

    container.innerHTML = `
      <div class="desv-captcha desv-${theme}" style="width:${size.width}">
        <div class="desv-label">${lang.enter}</div>
        <img id="desv-img" src="" alt="captcha" style="height:${size.imgH}; object-fit:cover;" />
        <input id="desv-input" type="text" maxlength="6" placeholder="● ● ● ● ● ●" autocomplete="off" spellcheck="false" />
        <div class="desv-row">
          <button class="desv-btn" id="desv-verify-btn">${lang.verify}</button>
          <button class="desv-refresh" id="desv-refresh-btn" title="${lang.refresh}">↺</button>
        </div>
        <div class="desv-msg" id="desv-msg"></div>
        <div class="desv-logo">secured by desv.online</div>
      </div>
    `;

    let currentToken = null;

    async function loadCaptcha() {
      const img = container.querySelector("#desv-img");
      const input = container.querySelector("#desv-input");
      const msg = container.querySelector("#desv-msg");
      img.style.opacity = "0.4";
      input.value = "";
      msg.textContent = "";
      msg.className = "desv-msg";

      const res = await fetch(`${API_BASE}/captcha/generate?theme=${theme}`);
      const data = await res.json();
      if (data.success) {
        currentToken = data.token;
        img.src = data.image;
        img.style.opacity = "1";
      }
    }

    container.querySelector("#desv-refresh-btn").addEventListener("click", loadCaptcha);

    container.querySelector("#desv-verify-btn").addEventListener("click", async () => {
      const input = container.querySelector("#desv-input");
      const msg = container.querySelector("#desv-msg");
      const code = input.value.trim();
      if (!code || code.length < 6) { msg.textContent = lang.enter; return; }

      const res = await fetch(`${API_BASE}/captcha/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: currentToken, code }),
      });
      const data = await res.json();

      if (data.success) {
        msg.textContent = lang.verified;
        msg.className = "desv-msg desv-msg-ok";
        if (opts.onSuccess) opts.onSuccess({ token: currentToken, type: "code" });
      } else {
        msg.textContent = data.message === "token_expired" ? lang.expired : lang.wrong;
        msg.className = "desv-msg desv-msg-error";
        if (data.message === "token_expired") loadCaptcha();
        if (opts.onError) opts.onError(data);
      }
    });

    // Enter key support
    container.querySelector("#desv-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") container.querySelector("#desv-verify-btn").click();
    });

    await loadCaptcha();
  }

  // ── PUZZLE CAPTCHA ──
  async function renderPuzzle(container, opts) {
    const theme = getTheme(opts);
    const lang = LABELS[opts.lang] || LABELS.en;
    const size = SIZES[opts.size] || SIZES.medium;

    container.innerHTML = `
      <div class="desv-captcha desv-${theme}" style="width:${size.width}">
        <div class="desv-label">${lang.slide}</div>
        <div class="desv-puzzle-bg" style="position:relative; overflow:hidden;">
          <img id="desv-puzzle-bg" src="" alt="puzzle" style="display:block; width:100%;" />
          <img id="desv-puzzle-piece" src="" alt="piece"
            style="position:absolute; width:50px; height:50px; pointer-events:none; display:none;" />
        </div>
        <div class="desv-slider-track" id="desv-track">
          <div class="desv-slider-fill" id="desv-fill"></div>
          <div class="desv-slider-thumb" id="desv-thumb">⇥</div>
        </div>
        <div class="desv-msg" id="desv-msg"></div>
        <div class="desv-logo">secured by desv.online</div>
      </div>
    `;

    let currentToken = null;
    let puzzleData = null;
    let isDragging = false;
    let startX = 0;
    let thumbLeft = 0;

    const track = container.querySelector("#desv-track");
    const fill = container.querySelector("#desv-fill");
    const thumb = container.querySelector("#desv-thumb");
    const msg = container.querySelector("#desv-msg");

    const pieceImg = container.querySelector("#desv-puzzle-piece");

    async function loadPuzzle() {
      msg.textContent = "";
      msg.className = "desv-msg";
      thumb.style.left = "0px";
      fill.style.width = "38px";
      thumbLeft = 0;
      pieceImg.style.left = "0px";

      const res = await fetch(`${API_BASE}/captcha/puzzle?theme=${theme}`);
      const data = await res.json();
      if (data.success) {
        currentToken = data.token;
        puzzleData = data;
        const bgEl = container.querySelector("#desv-puzzle-bg");
        bgEl.src = data.background;
        pieceImg.src = data.piece;
        pieceImg.style.top = data.piece_y + "px";
        pieceImg.style.left = "0px";
        pieceImg.style.display = "block";
      }
    }

    thumb.addEventListener("mousedown", (e) => { isDragging = true; startX = e.clientX - thumbLeft; e.preventDefault(); });
    thumb.addEventListener("touchstart", (e) => { isDragging = true; startX = e.touches[0].clientX - thumbLeft; e.preventDefault(); }, { passive: false });

    const move = (clientX) => {
      if (!isDragging) return;
      const trackW = track.offsetWidth;
      const maxLeft = trackW - 38;
      thumbLeft = Math.max(0, Math.min(maxLeft, clientX - startX));
      thumb.style.left = thumbLeft + "px";
      fill.style.width = (thumbLeft + 38) + "px";

      // Move piece image in sync with slider (map to image width)
      const bgEl = container.querySelector("#desv-puzzle-bg");
      const imgW = bgEl.offsetWidth || 300;
      const pieceX = Math.round((thumbLeft / maxLeft) * (imgW - 50));
      pieceImg.style.left = pieceX + "px";
    };

    const end = async () => {
      if (!isDragging) return;
      isDragging = false;

      // Map thumb position to image X coordinate
      const trackW = track.offsetWidth;
      const maxLeft = trackW - 38;
      const bgEl = container.querySelector("#desv-puzzle-bg");
      const imgW = bgEl.offsetWidth || 300;
      const submittedX = Math.round((thumbLeft / maxLeft) * (imgW - 50));

      const res = await fetch(`${API_BASE}/captcha/puzzle/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: currentToken, x: submittedX }),
      });
      const data = await res.json();

      if (data.success) {
        msg.textContent = lang.verified;
        msg.className = "desv-msg desv-msg-ok";
        if (opts.onSuccess) opts.onSuccess({ token: currentToken, type: "puzzle" });
      } else {
        msg.textContent = data.message === "too_many_attempts" ? lang.expired : lang.wrong;
        msg.className = "desv-msg desv-msg-error";
        // Reset thumb and piece to start
        thumb.style.left = "0px";
        fill.style.width = "38px";
        pieceImg.style.left = "0px";
        thumbLeft = 0;
        if (data.message === "too_many_attempts") loadPuzzle();
        if (opts.onError) opts.onError(data);
      }
    };

    document.addEventListener("mousemove", (e) => move(e.clientX));
    document.addEventListener("touchmove", (e) => move(e.touches[0].clientX));
    document.addEventListener("mouseup", end);
    document.addEventListener("touchend", end);

    await loadPuzzle();
  }

  // ── INVISIBLE CAPTCHA ──
  async function renderInvisible(container, opts) {
    const theme = getTheme(opts);
    const lang = LABELS[opts.lang] || LABELS.en;

    container.innerHTML = `
      <div class="desv-captcha desv-${theme}">
        <div class="desv-invisible-box">
          <div class="desv-invisible-check" id="desv-check" role="checkbox" tabindex="0">☐</div>
          <div class="desv-invisible-spinner" id="desv-spin">⟳</div>
          <span class="desv-invisible-text desv-label">I'm not a robot</span>
        </div>
        <div class="desv-msg" id="desv-msg"></div>
        <div class="desv-logo">secured by desv.online</div>
      </div>
    `;

    const check = container.querySelector("#desv-check");
    const spin = container.querySelector("#desv-spin");
    const msg = container.querySelector("#desv-msg");
    let currentToken = null;
    let challenge = null;
    let started = false;

    async function startVerify() {
      if (started) return;
      started = true;
      check.style.display = "none";
      spin.style.display = "inline-block";

      const res = await fetch(`${API_BASE}/captcha/invisible`);
      const data = await res.json();

      if (!data.success) {
        msg.textContent = "Error";
        msg.className = "desv-msg desv-msg-error";
        return;
      }

      currentToken = data.token;
      challenge = data.challenge;

      // Simulate brief analysis
      await new Promise((r) => setTimeout(r, 900 + Math.random() * 400));

      const vRes = await fetch(`${API_BASE}/captcha/invisible/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: currentToken, challenge, fingerprint: navigator.userAgent }),
      });
      const vData = await vRes.json();

      spin.style.display = "none";
      check.style.display = "grid";

      if (vData.success) {
        check.textContent = "✔";
        msg.textContent = lang.verified;
        msg.className = "desv-msg desv-msg-ok";
        if (opts.onSuccess) opts.onSuccess({ token: currentToken, type: "invisible" });
      } else {
        check.textContent = "✘";
        msg.textContent = "Verification failed";
        msg.className = "desv-msg desv-msg-error";
        if (opts.onError) opts.onError(vData);
      }
    }

    check.addEventListener("click", startVerify);
    check.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") startVerify(); });
  }

  // ── PUBLIC API ──
  const Captcha = {
    render(selector, userOpts = {}) {
      injectStyles();
      const opts = Object.assign({}, DEFAULT_OPTS, userOpts);
      const container = typeof selector === "string" ? document.querySelector(selector) : selector;
      if (!container) { console.error("[desv captcha] Element not found:", selector); return; }

      const type = opts.type;
      if (type === "puzzle") return renderPuzzle(container, opts);
      if (type === "invisible") return renderInvisible(container, opts);
      return renderCode(container, opts);
    },
  };

  global.Captcha = Captcha;
})(window);
