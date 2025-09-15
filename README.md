# CeX Stock Monitor

Server-side Next.js app that checks CeX product pages and notifies when items appear in stock.

## Setup

1. Install prerequisites:
   - Git, Node.js 18+ (or 20+), npm
2. Clone or open this folder and install deps:
   ```bash
   npm install
   ```
3. Copy environment variables:
   ```bash
   cp .env.example .env.local
   ```
   Add your webhook URL if you want notifications.
4. Configure product IDs in `settings.json`.

## Run

```bash
npm run dev
```

Open http://localhost:3000 to view the status table. Use `/api/check` to trigger checks and notifications.

## Configuration

- `settings.json` fields:
  - `productIds`: array of product IDs or full product URLs
  - `baseUrl`: CeX base URL (default `https://uk.webuy.com`)
  - `userAgent`: request header to reduce bot blocking
  - `webhookUrlEnv`: env var key for webhook URL (default `NOTIFY_WEBHOOK_URL`)

## Notes

- Availability detection uses simple HTML heuristics; adjust as needed for your IDs.
- For reliability, prefer providing full product URLs in `productIds`.
