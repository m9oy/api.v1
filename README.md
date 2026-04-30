# desv.online — CAPTCHA Server

Advanced CAPTCHA system with Canvas-generated images, bot detection, IP tracking, and rate limiting.

## Features
- **Code CAPTCHA** — 6-char random code rendered on Canvas with noise & distortion
- **Puzzle Slider** — Drag-to-fit puzzle generated with Canvas
- **Invisible CAPTCHA** — Background bot-score check
- **Rate Limiting** — 100 req/min global, 20 req/min on generate endpoints
- **Bot Detection** — User-Agent analysis + header fingerprinting
- **IP Tracking** — Auto-block IPs with 10+ failures
- **Token Expiry** — All tokens expire in 5 minutes
- **Analytics** — Live request/solve/block stats

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy .env
cp .env.example .env

# 3. Edit .env
PORT=3000
ADMIN_KEY=your_secret_key

# 4. Start
npm start
# or development mode:
npm run dev
```

> **Note:** The `canvas` package requires native build tools.
> - Linux: `sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev`
> - macOS: `brew install pkg-config cairo pango libpng jpeg giflib librsvg`

---

## API Endpoints

### Base URL
```
http://localhost:3000
```

---

### 1. Code CAPTCHA

**Generate**
```
GET /v1/captcha/generate?theme=dark
```
Response:
```json
{
  "success": true,
  "token": "uuid-here",
  "image": "data:image/png;base64,...",
  "expires_in": 300,
  "type": "code"
}
```

**Verify**
```
POST /v1/captcha/verify
Content-Type: application/json

{ "token": "...", "code": "A3F9X2" }
```

---

### 2. Puzzle Slider

**Generate**
```
GET /v1/captcha/puzzle?theme=dark
```

**Verify**
```
POST /v1/captcha/puzzle/verify
Content-Type: application/json

{ "token": "...", "x": 142 }
```
`x` = pixel position the user slid to (mapped from the slider to image coordinates).

---

### 3. Invisible CAPTCHA

**Generate**
```
GET /v1/captcha/invisible
```

**Verify**
```
POST /v1/captcha/invisible/verify
Content-Type: application/json

{ "token": "...", "challenge": "...", "fingerprint": "optional-ua" }
```

---

### 4. Analytics
```
GET /v1/analytics
```

### 5. IP Status
```
GET /v1/ip/status
```

### 6. Unblock IP (Admin)
```
POST /v1/ip/unblock
x-admin-key: your_secret_key

{ "ip": "1.2.3.4" }
```

---

## Widget (Frontend)

Place `widget.js` on a CDN or serve it from your server.

```html
<script src="https://api.desv.online/widget.js"></script>

<div id="captcha-box"></div>

<script>
  Captcha.render("#captcha-box", {
    type: "code",        // "code" | "puzzle" | "invisible"
    theme: "dark",       // "dark" | "light" | "auto"
    size: "medium",      // "small" | "medium" | "large"
    lang: "ar",          // "en" | "ar" | "fr"
    onSuccess: (data) => {
      console.log("Verified! Token:", data.token);
    },
    onError: (err) => {
      console.error("Failed:", err);
    }
  });
</script>
```

---

## Security Layers

| Layer | Description |
|-------|-------------|
| Rate Limit | 100 req/min global, 20 req/min generate |
| Bot Detection | UA pattern matching + header analysis |
| IP Tracking | Tracks failures, auto-blocks at 10 fails |
| Token Expiry | Tokens expire in 5 minutes |
| Anti-Spam | One-time use tokens (solved = invalid) |
| Admin Block | Manual IP unblock via admin key |

---

## Error Codes

| Code | Message | Meaning |
|------|---------|---------|
| 400 | missing_fields | Required fields not sent |
| 401 | invalid_token | Token doesn't exist |
| 401 | token_expired | Token older than 5 min |
| 401 | token_already_used | Token was already solved |
| 401 | wrong_code | Wrong CAPTCHA answer |
| 403 | ip_blocked | IP auto-blocked |
| 403 | bot_detected | Bot score too high |
| 429 | rate_limit_exceeded | Too many requests |
