# desv.online CAPTCHA API

CAPTCHA protection API built with Node.js + Express.

## Quick Deploy to Railway

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Set environment variable: `API_KEY=desv_live_YOUR_SECRET_KEY`
4. Done! Railway auto-deploys on every push.

---

## Project Structure

```
desv-captcha/
├── server.js          ← Express API server
├── package.json       ← Dependencies
├── railway.toml       ← Railway config
├── .env.example       ← Environment variables template
└── public/
    ├── index.html     ← Landing page
    ├── captcha.html   ← CAPTCHA demo widget
    ├── docs.html      ← API documentation
    └── widget.js      ← Embeddable CAPTCHA widget
```

---

## API Endpoints

### Health Check
```
GET /api/health
```

### Generate CAPTCHA Challenge
```
POST /api/captcha/generate
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "type": "code",     // code | puzzle | button | grid
  "lang": "en",       // en | ar | fr | de
  "theme": "dark",    // dark | light | auto
  "size": "medium"    // small | medium | large
}
```

### Verify CAPTCHA
```
POST /api/captcha/verify
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "challenge_token": "chk_xxxxx",
  "solution": true        // boolean for puzzle/button, string for code
}
```

### Check Token Status
```
GET /api/captcha/status/:token
Authorization: Bearer YOUR_API_KEY
```

### Analytics (mock)
```
GET /api/analytics
Authorization: Bearer YOUR_API_KEY
```

---

## Widget Embed

```html
<script src="https://YOUR-RAILWAY-URL/widget.js"></script>
<div id="captcha-box"></div>
<script>
  Captcha.render("#captcha-box", {
    type: "puzzle",       // code | puzzle | button
    lang: "en",
    size: "medium",
    onVerify: function(result) {
      console.log("Verified!", result.token);
    }
  });
</script>
```

---

## Environment Variables

| Variable  | Description                  | Default                       |
|-----------|------------------------------|-------------------------------|
| `PORT`    | Server port                  | `3000`                        |
| `NODE_ENV`| Environment                  | `development`                 |
| `API_KEY` | Live API key for production  | `desv_live_demo_key_12345`    |

> Test key `desv_test_demo_key_99999` always works — no real validation, safe for dev.

---

## Error Codes

| Code | Meaning                        |
|------|--------------------------------|
| 400  | Bad request / missing field    |
| 401  | Invalid or missing API key     |
| 403  | Insufficient permissions       |
| 404  | Token not found                |
| 409  | Token already used             |
| 410  | Token expired                  |
| 422  | Wrong CAPTCHA solution         |
| 429  | Rate limit exceeded            |
