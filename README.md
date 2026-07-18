# mineetes

mineetes is a mobile-first World Cup prediction-market prototype for the TxODDS Superteam hackathon. It turns each live match minute into a 60-second YES/NO market with stake lock, frozen pool, event-driven settlement, and proof-ready receipts.

## Track Fit

Built for the Prediction Markets and Settlement track:

- One-minute binary prediction markets
- Instant settlement receipts
- Server-side TxLINE fixture, score snapshot, and score update access
- Score-validation proof proxy for on-chain validation integration
- Mobile-first frontend and Vercel backend

See [SUBMISSION.md](SUBMISSION.md) for the full requirement mapping.

## Backend Setup

TxLINE secrets are server-only. See [BACKEND.md](BACKEND.md) for required environment variables and where to get them.

## Local Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npm run build
```
