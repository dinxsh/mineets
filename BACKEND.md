# mineetes Backend Setup

The frontend calls same-origin backend routes so TxLINE credentials stay server-side:

- `/api/readiness` reports which backend envs are configured.
- `/api/fixtures` fetches TxLINE fixtures.
- `/api/live?fixtureId=...` fetches TxLINE score snapshots and updates.

## Required Environment Variables

Set these in Vercel Project Settings -> Environment Variables for Production and Preview:

- `TXLINE_NETWORK`: `mainnet` or `devnet`. Use `mainnet` for the World Cup free-tier docs.
- `TXLINE_ORIGIN`: `https://txline.txodds.com` for mainnet or `https://txline-dev.txodds.com` for devnet.
- `TXLINE_JWT`: guest JWT from `POST https://txline.txodds.com/auth/guest/start`.
- `TXLINE_API_TOKEN`: activated API token from `POST https://txline.txodds.com/api/token/activate`.
- `TXLINE_SERVICE_LEVEL`: `1` for delayed free access or `12` for real-time if your subscription supports it.

Optional:

- `TXLINE_FIXTURE_ID`: pin the app to one fixture instead of choosing from `/api/fixtures`.
- `VITE_WORLDCUP_API_KEY`: browser-side fallback only; leave unset for the TxLINE backend path.

## Where To Get Them

Use the TxLINE docs:

- Quickstart: https://txline.txodds.com/documentation/quickstart
- World Cup free tier: https://txline.txodds.com/documentation/worldcup

Flow:

1. Connect/fund the wallet required by TxLINE.
2. Start guest auth to get `TXLINE_JWT`.
3. Subscribe/activate the token for the relevant service level.
4. Store the activated token as `TXLINE_API_TOKEN`.
5. Redeploy Vercel so the serverless API routes receive the envs.
