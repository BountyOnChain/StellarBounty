# StellarBounty Contributor Quickstart

This guide gets you from `git clone` to a running local instance in **under 5 minutes**.

## Prerequisites

Before you start, make sure you have:

- [Node.js](https://nodejs.org/) **v18+** and npm v9+
- [Git](https://git-scm.com/)
- _(Optional)_ [Docker Desktop](https://www.docker.com/products/docker-desktop/) for the multi-service compose stack

## 1. Clone and install

```bash
git clone https://github.com/BountyOnChain/StellarBounty.git
cd StellarBounty
npm install
cp .env.example .env
```

## 2. Start the development servers

Run the frontend and backend in separate terminals:

```bash
# Terminal 1 — Frontend (Next.js, port 3000)
npm run dev:frontend

# Terminal 2 — Backend (NestJS, port 3001)
npm run dev:backend
```

_(If you prefer Docker, run `docker compose up` instead.)_

## 3. Verify everything works

Open your browser and check:

| Service    | URL                                | Expected result                  |
|-----------|------------------------------------|----------------------------------|
| Frontend  | http://localhost:3000              | StellarBounty landing page       |
| Backend   | http://localhost:3001              | `StellarBounty API is running.`  |

The backend `GET /` endpoint is the built-in health check. If you see that message, your setup is correct.

## 4. Walkthrough: create a bounty → submit → approve

### 4.1 Connect your wallet

1.  Open the frontend at http://localhost:3000.
2.  Click **Connect Wallet** in the top-right corner.
3.  Choose your Stellar wallet (Freighter, Albedo, etc.).
4.  The dashboard loads once connected.

> **Note:** For local development, the app connects to the Stellar **testnet** by default. Set `NEXT_PUBLIC_STELLAR_NETWORK=testnet` in `.env` if not already configured.

### 4.2 Create a new bounty

1.  From the dashboard, click **Create Bounty**.
2.  Fill in:
    - Title — a concise task description
    - Description — detailed requirements
    - Reward amount (XLM)
    - Tags (optional)
3.  Click **Create Bounty**. The transaction appears in your wallet.
4.  Sign the transaction in your wallet extension.
5.  After confirmation, the bounty appears on the **Browse Bounties** page.

### 4.3 Submit work to a bounty

1.  Navigate to **Browse Bounties**.
2.  Find an open bounty and click **Submit**.
3.  Paste a link to your completed work (GitHub PR, deployed demo, etc.).
4.  Click **Submit**. The submission is now visible on the bounty detail page.

### 4.4 Approve a submission (admin / bounty creator)

1.  Open the bounty detail page.
2.  Scroll to the **Submissions** section.
3.  Review the submitted work.
4.  Click **Approve** next to the submission you want to accept.
5.  Sign the approval transaction in your wallet.
6.  The reward is released to the submitter's wallet.

## 5. Running tests

Run the tests relevant to your changes:

```bash
# All tests (frontend + backend)
npm test --workspaces --if-present

# Backend only
npm test --workspace=apps/backend -- --runInBand

# Frontend only
npm test --workspace=apps/frontend -- --runInBand
```

## 6. Project structure overview

```text
apps/
  frontend/   Next.js app — wallet UI, bounty pages, dashboard
  backend/    NestJS API — auth, bounty/submission services, health checks
  contracts/  Soroban contracts — escrow-based bounty logic
```

For more details, see [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Next steps

- Check the [open issues](https://github.com/BountyOnChain/StellarBounty/issues) for tasks labeled `good first issue`.
- Read [`CONTRIBUTING.md`](CONTRIBUTING.md) for coding conventions and PR process.
- Join the community discussion in [GitHub Discussions](https://github.com/BountyOnChain/StellarBounty/discussions).

Happy hacking! 🚀
