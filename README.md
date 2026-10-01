# eLeague Nepal

## Main Wallet and FP Wallet

New referral rewards go to **FP Wallet**. Deposits, admin cash adjustments, and finalized room prizes use **Main Wallet**. Existing Main Wallet money, already-issued referral rewards, and pending withdrawals stay where they are.

| Action | Main Wallet | FP Wallet |
| --- | --- | --- |
| Verified deposit | Credited here | No deposits |
| New referral reward | No new referral credits | Credited after the first verified deposit |
| Pay room entry | Allowed with enough balance | Requires four successful referrals and enough FP for the entire entry |
| Finalized win | Entire configured room prize is credited here, after the room's platform fee | Winning entry does not return separately |
| Cancellation, draw, or void | Main-funded entries return here | FP-funded entries return here |
| Cash-out | Existing withdrawal limits and admin review apply | Direct cash-outs and direct transfers to Main are unavailable |

Players choose one wallet when creating or joining a room. A single entry cannot combine Main and FP. Each participant's funding source is stored on the room and ledger; a request cannot change the source of a refund. An entry payment and room update use one database transaction. Repeated settlements cannot pay twice or pay both a prize and refunds.

Four successful referrals unlock FP entry; this is a lifetime unlock, not four new referrals per match. The selected wallet still needs the full entry fee. At Rs. 5 per referral, four referrals earn Rs. 20. To make that enough for the minimum room, set **Minimum entry = 20** in Admin Settings. The code preserves your current live limits; the source default of Rs. 30 would require Rs. 30 in FP (six Rs. 5 rewards).

The reward remains a promotional cost. This change prevents direct FP withdrawals and refund-based conversion; it does not verify that accounts belong to different people or detect arranged matches. A finalized prize can include promotional value, so FP does not guarantee a profit. Review suspicious referrals/results using your existing admin controls.

### Apply this wallet update

The accompanying `eleague-wallet.zip` contains changed and new source files, with their original paths. Extract them **into the root of your latest project**, merging `src`, `server`, and `tests`. Do not delete the existing project or replace it with this partial archive. Images, logos, icons, the service worker, and deployment environment files are not part of this patch.

1. Keep a copy of your current project, then merge these files into it. If you have edited one of these same source files since the last ZIP, merge those edits as well.
2. Run `npm ci`, `npm test`, and `npm run build`.
3. Commit the updated files to your existing repository and redeploy **both Render backend and Vercel frontend**. Deploy the backend first; new FP screens require the updated API. Old open rooms continue to use Main Wallet.
4. Keep your existing deployment environment variables. No database reset, balance conversion, or manual migration is needed. The backend already uses MongoDB transactions; MongoDB Atlas supports them.

The tests use a disposable local MongoDB replica set, never your configured production database. The first test run downloads MongoDB 7.0.24. Node.js 20.19+ or 22.12+ is suitable for the current dependency set. Run `npm test` locally with development dependencies installed; the deployed application does not use the test database package.

## Branding and Render setup

This update uses the supplied **eLeague Nepal** logo with a real transparent background and updates the website text, accessibility labels, page title, install prompt, app manifest, share messages, and platform-generated messages. The existing notification logic and red PAID styling are unchanged.

Source filenames are preserved. Existing database names, Cloudinary folders, and browser session keys remain compatible, so the rebrand does not create a new database or sign out existing accounts. Keep your existing deployment environment variables and local `.env` file; real credentials and `node_modules` are not included in this archive. Run `npm ci` after extracting.

### Activate the included Render health check

1. Upload the project contents to the root of your existing GitHub repository, including `.github/workflows/render-health-ping.yml`. The workflow must be on your default branch (usually `main`).
2. Open the repository's **Settings → Secrets and variables → Actions → Variables → New repository variable**.
3. Set **RENDER_HEALTH_URL** to your backend's full health address, for example `https://YOUR-SERVICE.onrender.com/api/health`. This is a repository variable, not a Render environment variable.
4. Open **Actions → Render health ping → Run workflow** once and confirm that the run succeeds. If GitHub asks you to enable Actions, enable it for the repository.
5. Redeploy the backend and frontend from this code. Keep `VITE_API_URL` pointed at your current backend, ending in `/api`.

The workflow sends a lightweight health request every ten minutes. It runs outside the backend, so it can wake a sleeping service. No job starts until `RENDER_HEALTH_URL` is configured. To stop it, disable the workflow or remove that variable.

### What players see during a cold start

- The website starts waking the API as soon as it opens.
- Requests share one health check sequence, waiting up to two minutes for startup.
- A short connection message appears during the wait. The lobby shows a retry option if loading fails instead of displaying a misleading empty room list.
- Read requests can retry once after a temporary connection failure. Submitted payments, room creation, approvals, and other write requests are never automatically resent.
- Temporary wake-up failures preserve saved login tokens; rejected or expired sessions still require signing in.

This reduces sleep-related delays; it cannot guarantee an always-running free service. Render documents a 15-minute idle timeout, about a minute to wake, and 750 free instance hours shared across a workspace each month. Scheduled GitHub jobs can be delayed or dropped, and public repositories have schedules disabled after 60 days without activity. GitHub Actions usage limits also depend on the repository/account. A continuously running backend requires an appropriate paid service plan.

References: [Render free service behavior](https://render.com/docs/free), [GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

### Local checks

```bash
npm ci
npm test
npm run build
```

The connection tests simulate cold starts, concurrent requests, timeouts, canceled requests, and retries. FP wallet tests exercise real local MongoDB transactions, referral credits, both payment sources, withdrawal isolation, refunds, legacy accounts, and concurrent settlement/payment requests. Neither suite accesses production services.

---

**eLeague Nepal** is a Nepal-focused competitive gaming platform where players can create or join paid match rooms, use Main and FP wallets across multiple games, submit match results, handle disputes, withdraw winnings, and earn referral rewards.

The platform currently supports:

- **eFootball**
- **Free Fire**
- **PUBG Mobile**
- **FC Mobile**

The architecture is game-config driven, so more games can be added later without rebuilding the wallet, referral, admin, result, or settlement systems.

> eLeague Nepal is an independent platform. It is not affiliated with or endorsed by Konami, Garena, Krafton, EA, or the publishers/owners of the supported games and trademarks.

---

## 1. Main Features

### Player accounts

Players can:

- register with name, email, password, and an optional referral code;
- log in with a separate player session;
- manage their profile;
- connect game identities only for the games they actually play;
- use the same eLeague account and wallet across every supported game.

Game identities can contain:

- in-game username;
- player ID / UID where required.

The platform automatically saves a player's game identity when they create or join a room.

### Multi-game lobby

The lobby supports:

- All Games view;
- individual game filters;
- mode filters;
- match-format filters;
- game badges on every room card;
- game-aware Create Room links.

### Supported game configuration

#### eFootball

- Dream Team
- Authentic
- 1v1 / 2v2 / 3v3 / 4v4
- eFootball room ID
- room password

#### Free Fire

- Clash Squad
- Custom Room
- 1v1 / 2v2 / 4v4
- Free Fire UID
- custom room ID
- room password

#### PUBG Mobile

- TDM
- Custom Room
- Classic
- 1v1 / 2v2 / 4v4
- PUBG Player ID
- room ID
- room password

#### FC Mobile

- Head to Head
- VS Attack
- 1v1
- FC Mobile username
- optional user ID
- optional match/invite code and password

Game definitions are centralized in:

```text
src/config/games.js
server/config/games.js
```

---

## 2. Match Room Flow

### Creating a room

A logged-in player:

1. chooses a supported game;
2. selects the game-specific mode;
3. selects the match format;
4. enters an entry fee;
5. enters their in-game username / ID;
6. enters game room or invite credentials when required;
7. creates the room.

The host entry fee is deducted immediately from the eLeague wallet.

### Joining a room

The challenger:

1. opens an available room from the lobby;
2. receives a temporary five-minute reservation without being charged;
3. reviews the game, mode, format, prize and entry fee;
4. enters or confirms their game identity;
5. can leave freely before payment, immediately reopening the room;
6. accepts the match conditions;
7. pays the entry fee from their eLeague wallet.

Only a successful wallet payment converts the pending reservation into the confirmed challenger and changes the room to `READY`. Expired reservations automatically stop blocking the room.

After successful payment, private room credentials are available to both sides.

### Room statuses

```text
OPEN
READY
RESULT_PENDING
DISPUTED
COMPLETED
CANCELLED
```

### Cancelling a room

A host may cancel an `OPEN` room before a challenger joins. The host entry fee is automatically refunded.

---

## 3. Result and Settlement System

When a match finishes, either participant can submit:

- winner / draw / void;
- score;
- result screenshot.

The other participant can:

- confirm the result; or
- dispute it by submitting their own claimed result, score, reason, and evidence screenshot.

### Confirmed win

The platform credits the calculated prize to the winner's eLeague wallet.

### Draw or void

Both entry fees are refunded.

### Dispute

The room is frozen until an administrator reviews both players' claims and evidence. The admin Rooms view can expand any submitted result to show the claim, score, submitter, response status, and Cloudinary evidence. The Disputes view shows the original result beside the opponent's counter-claim and evidence.

The administrator chooses:

- host win;
- challenger win;
- draw;
- void/refund.

Wallet settlement occurs immediately after the final resolution.

---

## 4. eLeague Wallet

Every player has a Main Wallet and an FP Wallet, shared across all supported games. Main holds cash deposits and prizes; FP holds new referral rewards for entry fees, with the rules described above.

The wallet supports:

- verified deposits;
- match entry deductions;
- match prizes;
- match refunds;
- referral rewards in FP Wallet;
- admin credits;
- admin deductions;
- withdrawal holds and releases.

Wallet operations use transaction records and idempotency keys to reduce accidental duplicate settlements.

---

## 5. Deposits

Deposits are currently verified manually.

Supported methods:

- eSewa
- Khalti

Player flow:

1. pay outside eLeague;
2. enter the deposit amount;
3. enter transaction ID;
4. upload payment screenshot;
5. submit request;
6. wait for admin verification.

After verification, the amount is credited to the player's wallet.

Minimum and maximum deposit limits are configurable by admin.

---

## 6. Withdrawals

Players can request withdrawal through:

- eSewa
- Khalti

The requested amount is moved from available balance to reserved balance immediately.

Admin can:

- mark the withdrawal paid after sending the money externally; or
- reject it and restore the reserved amount.

The player interface informs users that withdrawals can take up to approximately two hours to process.

Minimum and maximum withdrawal amounts are configurable.

---

## 7. Referral System

Each player receives a unique referral code.

Example:

```text
EL7K4P2X
```

Referral links use the root-safe format:

```text
https://your-domain.com/?ref=EL7K4P2X
```

The app redirects the user internally to registration.

### Reward flow

1. Player A shares their referral code/link.
2. Player B registers using the code.
3. Referral remains `PENDING`.
4. Player B completes their first admin-verified deposit.
5. Player A automatically receives the configured referral reward in FP Wallet.
6. Referral becomes `REWARDED`.

Default reward:

```text
Rs. 5
```

The reward amount and referral-program status are configurable in Admin Settings.

Important rules:

- rejected deposits do not qualify;
- admin wallet credits do not qualify;
- one referred account can reward only once; this is not a verified unique-person check;
- a referral code can be used by multiple new players;
- blocked referrers do not receive new rewards while blocked.

Player referral pages show only totals and reward statistics. They do not expose the identities of referred accounts. Admins can view detailed referral records.

---

## 8. Notifications

The top navigation includes an activity bell for player events such as:

- deposit status;
- withdrawal status;
- match entry fee payments, winnings, and refunds;
- admin wallet credits/deductions;
- account block/unblock;
- dispute results;
- referral rewards.

---

## 9. Admin Console

Admin login is separate from player login.

```text
/admin/login
```

Player and admin tokens use separate local-storage keys so sessions cannot leak into one another.

Admin sections include:

- Deposit Requests
- Withdrawal Requests
- Players
- Disputes
- Rooms
- Announcements
- Settings

### Player management

Admins can:

- search by name;
- search by email;
- search game usernames;
- search player IDs / UIDs;
- see connected game accounts;
- view available and reserved wallet balances;
- add wallet balance;
- deduct wallet balance;
- block/unblock accounts;
- view verified deposit totals;
- view paid withdrawal totals;
- view referral statistics;
- view detailed referred accounts.

### Room management

The Rooms table shows:

- eLeague room code;
- game;
- game mode;
- match format;
- host;
- challenger;
- entry fee;
- prize;
- status.

Rooms can also be filtered by game in the admin interface.


### Popup announcements

Admins can create and manage player-facing popup announcements:

- upload announcement images to Cloudinary;
- optionally make the entire image link to an external URL or internal eLeague page;
- target everyone, logged-in players, or new signups;
- schedule a start and expiry time;
- control display order;
- enable, disable, edit, preview, or delete announcements.

Players see eligible announcements as a responsive popup. Closing an announcement dismisses it for the rest of the current browser session so it does not reappear on every page change.

### Admin settings

Admins can configure:

- minimum entry fee;
- maximum entry fee;
- platform commission percentage;
- minimum deposit;
- maximum deposit;
- minimum withdrawal;
- maximum withdrawal;
- referral system enabled/disabled;
- referral reward amount;
- WhatsApp support number;
- eSewa account details;
- Khalti account details;
- eSewa QR image;
- Khalti QR image.

---

## 10. PWA / Installable App

eLeague Nepal is configured as a Progressive Web App.

Included:

- web manifest;
- service worker;
- 192x192 app icon;
- 512x512 app icon;
- Apple touch icon;
- favicon;
- install prompt;
- iOS Add to Home Screen guidance.

The current service-worker cache version is updated for the multi-game release.

---

## 11. Technology Stack

### Frontend

- React
- Vite
- React Router
- Axios
- Lucide React
- React Icons
- custom CSS

### Backend

- Node.js
- Express.js
- REST API
- JWT authentication
- bcryptjs
- Mongoose

### Database

- MongoDB Atlas

### Image storage

- Cloudinary

Cloudinary is used for production image uploads such as:

- deposit screenshots;
- withdrawal payout screenshots;
- payment QR images;
- result screenshots;
- dispute evidence.

### Deployment

Recommended/current architecture:

- Frontend: Vercel
- Backend: Render
- Database: MongoDB Atlas
- Media: Cloudinary

---

## 12. Project Structure

```text
eliga-platform/
├── public/
│   ├── apple-touch-icon.png
│   ├── eliga-logo.png
│   ├── favicon-64.png
│   ├── manifest.webmanifest
│   ├── pwa-192.png
│   ├── pwa-512.png
│   └── sw.js
│
├── server/
│   ├── config/
│   │   ├── db.js
│   │   └── games.js
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── utils/
│   └── server.js
│
├── src/
│   ├── api/
│   ├── components/
│   ├── config/
│   │   └── games.js
│   ├── context/
│   ├── pages/
│   ├── utils/
│   ├── App.jsx
│   ├── main.jsx
│   └── styles.css
│
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── package-lock.json
├── vercel.json
└── vite.config.js
```

---

## 13. Environment Variables

Create a `.env` file in the project root.

```env
NODE_ENV=development
PORT=5000

MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@CLUSTER/eliga
MONGODB_DNS_SERVERS=8.8.8.8,1.1.1.1

JWT_SECRET=replace-with-a-long-random-secret
CLIENT_URL=http://localhost:5173

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
CLOUDINARY_FOLDER=eliga

ADMIN_NAME=eLeague Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-strong-password
```

Frontend production environment:

```env
VITE_API_URL=https://your-render-backend.onrender.com/api
```

Never commit real secrets or production `.env` files to GitHub.

---

## 14. Local Development

Install dependencies:

```bash
npm install
```

Run frontend and backend together:

```bash
npm run dev
```

Or separately:

```bash
npm run dev:frontend
npm run dev:backend
```

Frontend normally runs on a Vite port such as:

```text
http://localhost:5173
```

Backend normally runs on:

```text
http://localhost:5000
```

---

## 15. Production Build

```bash
npm run build
```

Vite outputs the frontend to:

```text
dist/
```

Preview locally:

```bash
npm run preview
```

---

## 16. Vercel Deployment

Use the directory containing:

```text
package.json
vercel.json
vite.config.js
index.html
src/
public/
```

Recommended settings:

```text
Framework: Vite
Build command: npm run build
Output directory: dist
```

Set:

```env
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com/api
```

The included `vercel.json` provides SPA routing so routes such as these can load directly:

```text
/admin/login
/lobby
/register
/wallet
/profile
```

---

## 17. Render Backend Deployment

Recommended:

```text
Build command: npm install
Start command: npm start
```

Do not manually set `PORT` on Render. Render supplies it automatically.

Production variables should include:

```env
NODE_ENV=production
MONGODB_URI=...
MONGODB_DNS_SERVERS=8.8.8.8,1.1.1.1
JWT_SECRET=...
CLIENT_URL=https://your-vercel-domain.com
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
CLOUDINARY_FOLDER=eliga
ADMIN_NAME=...
ADMIN_EMAIL=...
ADMIN_PASSWORD=...
```

Health check:

```text
/api/health
```

---

## 18. Existing eFootball Data Compatibility

The multi-game update keeps compatibility fields for older eFootball-only accounts and rooms.

Existing users with `efootballUsername` are exposed as an eFootball Game Account until they next save/update their profile.

Existing rooms without a stored `game` value are treated as:

```text
EFOOTBALL
```

Legacy room fields are still recognized:

```text
efootballRoomId
efootballPassword
```

New rooms use generic fields:

```text
game
roomAccessId
roomAccessPassword
hostGamePlayerId
challengerGamePlayerId
```

This allows the platform to move to multiple games without intentionally invalidating existing eFootball records.

---

## 19. Adding Another Game

Add the new game to both configuration files:

```text
src/config/games.js
server/config/games.js
```

Define:

- game key;
- name;
- modes;
- formats;
- username label;
- player-ID requirements;
- room/invite ID requirements;
- password requirements.

The existing lobby, wallet, result, settlement, admin and referral systems can then reuse the same platform infrastructure.

---

## 20. Security Notes

- Passwords are hashed with bcrypt.
- Authentication uses signed JWTs.
- Admin and player sessions are separated.
- Protected server routes validate authenticated users.
- Blocked players cannot continue normal platform activity.
- Wallet operations are handled on the backend, not trusted to the frontend.
- Entry-fee and settlement operations use server-side wallet functions.
- Production image uploads use Cloudinary.
- Production secrets must remain outside source control.

For a real-money production launch, payment flows, competition rules, publisher requirements, applicable local law, abuse prevention, age restrictions, fraud detection, and financial controls should be reviewed before opening the service publicly.

---

## 21. Current Release

**Version 4.4.0 — Final stability, wallet-safety and match UX audit**

- Corrected every password/wallet visibility toggle so an open-eye icon means the value is visible and a closed-eye icon means it is hidden.
- Simplified the player Match Details view by removing the large Game and Wallet Flow side cards. Match participants now see a compact entry-fee status such as **Entry fee paid**, **Entry fee not paid**, or **Entry fee refunded**.
- Kept the host self-join protection and unpaid-challenger reservation flow, while preventing players without enough wallet balance from reserving an open room.
- Limited each player to one active unpaid room reservation at a time so a single account cannot hold several rooms without paying.
- Kept confirmed challenger assignment strictly after successful wallet payment; leaving before payment never deducts balance.
- Added player-only authorization to room mutation routes and wallet routes so admin accounts cannot accidentally execute player actions.
- Strengthened wallet credit/debit/withdrawal-hold operations with MongoDB transactions plus idempotency keys to reduce duplicate money movement during retries or concurrent requests.
- Reduced public room data exposure: public lobby/join APIs now return only the host ID and the room information required for joining, not the host's full account/game-profile object.
- Recorded a result resolution timestamp when an opponent confirms a submitted result.
- Re-audited client/server game configuration parity for eFootball, Free Fire, PUBG Mobile and FC Mobile.
- Bumped the PWA static cache and service-worker registration to v4.4 so the final frontend update does not reuse stale cached assets.

The room, result/dispute, admin Players, popup announcement, referral, deposit and withdrawal features from previous releases remain included.

### Previous release notes

**Version 4.2.3 — Admin Players redesign**

- Admin → Players now uses a compact searchable table instead of rendering every player's full controls at once.
- Player rows show eLeague-relevant summary data: identity, email, connected games, wallet, verified deposits, paid withdrawals, referrals, status, and join date.
- Clicking a player opens a dedicated detail drawer with wallet/payment totals, connected game identities, referral details, wallet adjustment controls, and block/unblock actions.
- Player listing now supports server-side pagination with 25 / 50 / 100 rows per page.
- Existing referral privacy remains unchanged: detailed referred-player information is available to admins only.



```text
Version: 4.2.0
Release: Multi-game platform conversion
```

Major changes in this version:

- eLeague converted from eFootball-only to multi-game;
- added eFootball, Free Fire, PUBG Mobile and FC Mobile;
- one shared wallet across all games;
- game-aware lobby and room cards;
- dynamic Create Room forms;
- dynamic Join Room forms;
- Game Accounts in player profile;
- simplified registration;
- admin game information and room filtering;
- backward compatibility for existing eFootball records;
- multi-game home page and metadata;
- updated PWA cache/version;
- referral player identity privacy preserved.
- official game-logo references added across Home, Create Room, Game Accounts, room cards, Join Room, match details and admin room views;
- lobby game shortcut chips simplified to text-only labels: All, eFootball, FreeFire, PUBG and FC Mobile.

## Third-party game marks

eLeague uses the eFootball, Free Fire, PUBG Mobile and EA SPORTS FC Mobile names/logos only to identify the games supported by the platform. These marks belong to their respective owners. eLeague is not presented as an official Konami, Garena, KRAFTON/Level Infinite or Electronic Arts product or partner unless a separate agreement says otherwise.

The UI references game-logo media hosted by Wikimedia Commons. Keep the applicable attribution/license information for redistributed assets in mind if you later download and bundle those files directly into the project.


---

## Release 4.3.0 — Final room and stability audit

This release completes the current room-flow and stability backlog:

- temporary unpaid challenger reservations with five-minute expiry;
- explicit **Leave room** before payment with no wallet deduction;
- confirmed challenger assignment only after successful payment;
- self-join protection in both frontend and backend;
- atomic room cancellation claim to reduce duplicate-refund risk;
- atomic result confirmation and admin dispute resolution guards;
- result/dispute screenshot validation and admin evidence visibility;
- withdrawal-hold rollback when request creation fails;
- mobile Matches access in the lobby;
- admin Players table/detail redesign;
- Cloudinary-backed clickable popup announcements;
- multi-game checks for eFootball, Free Fire, PUBG Mobile and FC Mobile.

The database additions are backward compatible. Existing rooms continue to work; reservation fields default to empty.
