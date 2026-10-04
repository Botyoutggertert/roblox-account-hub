# Roblox Account Hub (RAH)
> *"Your Roblox account, understood."*

## Roblox OAuth configuration

Create an OAuth 2.0 application in the Roblox Creator Dashboard and register the redirect URI exactly. The application supports two flows:
- **Website (Vercel)**: Roblox confidential-client Authorization Code flow using a server-only `client_secret` during token exchange.
- **Desktop (Electron)**: Public client Authorization Code flow with PKCE (`code_challenge` and `code_verifier`). No client secret is ever stored or used in the desktop app.

It never sends OAuth credentials to the renderer or displays tokens.

### Website on Vercel

1. Deploy with a stable production domain. Preview deployment URLs should not be used as the canonical OAuth callback.
2. Register this exact callback in Roblox Creator Dashboard:
   `https://YOUR_DOMAIN/api/oauth/roblox/callback`
3. Configure these server-side Vercel environment variables for Production (and Development when using `vercel dev`):
   - `ROBLOX_OAUTH_CLIENT_ID`: the real Roblox OAuth client ID.
   - `ROBLOX_OAUTH_CLIENT_SECRET`: the server-only confidential client secret from Roblox Creator Dashboard.
   - `ROBLOX_OAUTH_REDIRECT_URI`: the exact HTTPS callback above.
   - `ROBLOX_OAUTH_SESSION_SECRET`: at least 32 random bytes used to protect short-lived HttpOnly cookies.
4. Build with `npm run build`; Vercel serves `dist` and runs the handlers under `api/`.

Do not configure OAuth with `VITE_ROBLOX_OAUTH_*`. Vite variables are embedded in browser JavaScript. The website's OAuth configuration, client secret, state, nonce, and tokens remain server-side or in encrypted Secure HttpOnly cookies. The website uses Roblox's confidential-client flow to exchange authorization codes securely from the Vercel backend without device binding errors.

### Electron

Set `ROBLOX_OAUTH_CLIENT_ID` and `ROBLOX_OAUTH_REDIRECT_URI` in the Electron process environment, or copy `.env.example` to the ignored local `.env` for development. The desktop redirect must be an HTTP loopback URI with a fixed port, such as `http://127.0.0.1:53682/oauth/callback`, and that complete URI must be registered in Roblox Creator Dashboard. The Electron app uses the public client Authorization Code flow with PKCE (no client secret is ever used in the desktop application).

The web HTTPS callback and Electron loopback callback normally require separate environment configurations (and, if Roblox does not permit both redirects on one OAuth application, separate OAuth applications). Never commit a real client ID with secrets or any access/refresh token. The repository's existing `.env` is not overwritten automatically.

A production-grade, secure, and beautiful desktop companion application for Roblox users and creators. Built with **React 18**, **TypeScript**, **Tailwind CSS**, **Electron**, and **Three.js**.

---

## 🌟 Key Capabilities

### 1. 🛡️ 100% Offline 2-Step Verification (TOTP Authenticator)
- **RFC 6238 Compliant:** Generates standard 6-digit one-time verification passcodes using pure client-side HMAC-SHA1.
- **True Offline Security Isolation:** Secrets are validated and processed strictly in local browser/Electron storage (`localStorage` & Web Crypto API).
- **Zero Secret Transmission:** Secrets and passcodes are never transmitted over network sockets or sent to third-party telemetry servers.
- **Sleek UX:** Visual 30-second countdown ring, auto-copy to clipboard on tap, one-click duplicate/invalid detection, and account favorites.

### 2. 🎮 Interactive 3D Avatar Studio & Showcase
- **Three.js WebGL Engine:** Interactive 3D avatar viewport with ambient lighting, orbital rotation controls, directional specular highlights, and grid floor.
- **Official Roblox Camera Renders:** Seamless switching between Full-Body 720p, Bust 420p, and Headshot renders.
- **Rig Inspector:** Detailed avatar specifications, body scale ratios (height/depth), and equipped catalog accessories with direct catalog links.

### 3. 📊 Roblox Rewind & Data Analytics Engine
- **Transparent Spending Ledger:** Tracks both verified real-money transactions (USD currency receipts) and in-game Robux expenditures.
- **Defensible USD Conversion Engine:** Converts Robux using a transparent $0.0125/R$ standard (~$1.25 per 100 R$), explicitly separating verified USD from estimated amounts.
- **Attribution & Game Mapping:** Automatic high-confidence attribution of in-game purchases, passes, and developer products to verified Roblox experiences (e.g., *Blox Fruits*, *Adopt Me!*, *Pet Simulator 99*, *Tower of Hell*, *Deepwoken*).
- **Behavioral Identity Classifier:** Transparent rule-based identity profiler (e.g., *Hardcore Gamer*, *Avatar Enthusiast*, *Developer & Creator*, *Collector*, *Community Explorer*) with confidence scores and exact rule explanations.
- **Annual & Monthly Breakdowns:** Spending distribution across Jan–Dec with peak-month highlight and category share (Developer Products, Game Passes, Avatar Items, Bundles, Assets).

### 4. 🗃️ Transaction Ledger & Smart Import
- **Multi-Format Ingestion:** Drag-and-drop or paste transaction history in JSON or CSV format.
- **Deduplication Engine:** Prevents duplicate rows using deterministic timestamp/item/amount fingerprinting.
- **Instant Export:** Export your local ledger anytime as sanitized `.json` or `.csv`.
- **High-DPI Shareable Rewind Card:** Export and copy sleek Instagram/Discord-ready Rewind Summary cards directly to your clipboard.

### 5. 🔍 Public Roblox Profiles, Badges, Groups & Inventory
- **User Search & Resolution:** Fast public user search via Roblox Users API.
- **Verified Metadata:** Display user bio, join dates, account status, verified badge indicators, and external profile links.
- **Community Groups & Badges:** Browse earned badges with win-rates and joined developer/community groups.
- **Privacy-Honoring Inventory:** Respects user privacy configurations; explicitly displays privacy notices when an inventory is set to private.

### 6. 💡 Non-Manipulative Smart Recommendations
- Categorized actionable insights for account security, data mapping coverage, spending awareness, and catalog hygiene.
- Strictly adheres to non-manipulative analytics—never pushes microtransactions, loot boxes, or cosmetic promotions.

---

## 🔒 Security & Privacy Guarantees

1. **No Password or Cookie Logging:** The application never requests `.ROBLOSECURITY` cookies or account passwords.
2. **Local Token Isolation:** Authentication states and TOTP seeds remain exclusively on the user's local machine.
3. **Transparent Estimations:** All economic calculations clearly distinguish between *real-money cash receipts* and *converted Robux estimations*.
4. **Offline Resilience:** Every core feature (authenticator, rewind analysis, ledger browsing, export) works completely offline.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18.0.0 or higher recommended)
- npm or yarn

### Installation
```bash
git clone https://github.com/your-username/roblox-account-hub.git
cd roblox-account-hub
npm install
```

### Running in Development
To launch the Vite development server in the browser:
```bash
npm run dev
```

To run as an Electron desktop application:
```bash
npm run electron:dev
```

### Running Tests
To run unit and integration tests with Vitest:
```bash
npm test
```

### Building for Production
To package the web client:
```bash
npm run build
```

To build the standalone Windows installer and portable executable:
```bash
npm run electron:build
```

---

## 🏗️ Project Architecture

```
roblox/
├── electron/
│   ├── main.ts              # Electron lifecycle, custom borderless window, secure IPC
│   ├── preload.ts           # Context bridge exposing safe desktop APIs
│   └── tsconfig.json        # Electron TypeScript configuration
├── src/
│   ├── analytics/           # Deterministic analytics & financial engines
│   │   ├── categoryAnalytics.ts
│   │   ├── coverageAnalytics.ts
│   │   ├── gameAnalytics.ts
│   │   ├── identityAnalytics.ts
│   │   ├── monthlyAnalytics.ts
│   │   ├── recommendationEngine.ts
│   │   ├── spendingAnalytics.ts
│   │   ├── usdEstimationEngine.ts
│   │   └── yearAnalytics.ts
│   ├── components/          # Modular UI components
│   │   ├── authenticator/   # TOTP cards & live progress rings
│   │   ├── avatar/          # Three.js 3D WebGL avatar viewer
│   │   ├── common/          # Status badges & skeleton loaders
│   │   ├── modals/          # Ingestion & Add TOTP dialogs
│   │   ├── navigation/      # Sleek sidebar & global search bar
│   │   └── rewind/          # Shareable high-DPI export card
│   ├── pages/               # 13 Dedicated application views
│   │   ├── ActivityPage.tsx
│   │   ├── AuthenticatorPage.tsx
│   │   ├── AvatarPage.tsx
│   │   ├── BadgesPage.tsx
│   │   ├── ConnectedAccountPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── GamesPage.tsx
│   │   ├── GroupsPage.tsx
│   │   ├── InventoryPage.tsx
│   │   ├── RecommendationsPage.tsx
│   │   ├── RewindPage.tsx
│   │   ├── RobloxProfilePage.tsx
│   │   └── SettingsPage.tsx
│   ├── services/            # Pure TypeScript API, TOTP & storage engines
│   │   ├── demoDataService.ts
│   │   ├── exportService.ts
│   │   ├── gameMappingEngine.ts
│   │   ├── networkClient.ts
│   │   ├── robloxAvatarService.ts
│   │   ├── robloxBadgeService.ts
│   │   ├── robloxGameService.ts
│   │   ├── robloxGroupService.ts
│   │   ├── robloxInventoryService.ts
│   │   ├── robloxProfileService.ts
│   │   ├── shareImageService.ts
│   │   ├── storageService.ts
│   │   ├── totpService.ts
│   │   └── transactionImportService.ts
│   ├── types/               # Strict TypeScript domain interfaces
│   ├── utils/               # Base32, formatters, date utilities
│   ├── App.tsx              # Root application coordinator
│   ├── index.css            # Tailwind theme, typography & scrollbars
│   └── main.tsx             # DOM mounting point
├── tests/                   # Vitest unit & integration test suites
│   ├── analytics.test.ts
│   ├── import.test.ts
│   └── totp.test.ts
├── index.html               # Application entrypoint with Content Security Policy
├── package.json             # Dependencies and build scripts
├── tailwind.config.js       # Custom design system tokens
├── tsconfig.json            # React TypeScript compiler configuration
└── vite.config.ts           # Vite bundler configuration
```

---

## 📜 License & Legal Disclaimer
Roblox Account Hub is an independent community and developer tool. It is not affiliated with, endorsed by, or sponsored by Roblox Corporation. "Roblox" is a registered trademark of Roblox Corporation.
