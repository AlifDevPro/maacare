# Docker production deployment

Production image: **`alifahmaddev/maacare`**

The image ships a pre-built Next.js **standalone** server. On the server you only **pull and run** — no `npm install` or `npm run build`.

## Quick start (server)

```bash
# 1. Create runtime env
cp .env.docker.example .env
# edit .env with your secrets

# 2. Pull and run
docker pull alifahmaddev/maacare:latest
docker run -d \
  --name maacare \
  --restart unless-stopped \
  --env-file .env \
  -p 3000:3000 \
  alifahmaddev/maacare:latest
```

Or with Compose:

```bash
docker compose pull
docker compose up -d
```

App: `http://localhost:3000`  
Health: `GET /api/app/version`

## Build & push (your machine / CI)

`NEXT_PUBLIC_*` variables are **embedded at image build time** (browser code). Build the image with the same public values your production app will use.

```bash
# From repo root — reads .env.production or .env for NEXT_PUBLIC_* build args
chmod +x scripts/docker-build-push.sh
./scripts/docker-build-push.sh latest --push

# Tagged release
./scripts/docker-build-push.sh v1.0.0 --push
```

Manual build:

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... \
  --build-arg NEXT_PUBLIC_SITE_URL=https://your-domain.com \
  -t alifahmaddev/maacare:latest .

docker push alifahmaddev/maacare:latest
```

## Required runtime env

| Variable | When |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Build + run (must match build) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Build + run (must match build) |
| `SUPABASE_SERVICE_ROLE_KEY` | Run only (secret) |
| `NEXT_PUBLIC_SITE_URL` | Build + run (canonical site URL) |

See `.env.docker.example` for the full list (AI keys, Firebase, cron, etc.).

## Push cron (optional)

If you use Firebase push, schedule an external cron to hit:

```bash
curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  "https://your-domain.com/api/cron/push-dispatch"
```

Set `CRON_SECRET` in `.env`.

## Notes

- Uses Node 20 on Debian bookworm-slim with `tini` for signal handling.
- Runs as non-root user `nextjs` (uid 1001).
- `FIREBASE_SERVICE_ACCOUNT_JSON_B64` is recommended in Docker instead of mounting a JSON file.
- Report OCR (`tesseract.js`) is included; first OCR request may be slower while WASM loads.
