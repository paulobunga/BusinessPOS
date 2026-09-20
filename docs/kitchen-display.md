# Kitchen display — Phase 1 (in-Electron) + Phase 2 (LAN tablets)

Phase 1 is a local, in-Electron kitchen display. No network, no tablets yet:
the POS and the kitchen screen run in the same Electron app and talk over IPC.

## Where it lives

- Route: `/kitchen` (`src/pages/Kitchen/KitchenPage.tsx`, registered in `src/App.tsx`).
- Sidebar: Sidebar → **Kitchen** (`src/components/Sidebar.tsx`, POS module).
- Backend: `kitchenService` (`electron/kds/kitchenService.ts`) owns all reads and
  status transitions; `kitchen:list` / `kitchen:setStatus` IPC plus a
  `kitchen:event` broadcast keep every open window in sync
  (`electron/ipc/kitchenHandlers.ts`, `electron/ipc/salesHandlers.ts`).

## Local use

1. Open `/kitchen`. Three columns show active orders oldest-first:
   **New / Preparing / Completed**. Served orders leave the board.
2. **Enable sound** gate: click `Enable sound` once (browser autoplay policy
   requires the gesture). New orders then play a short WebAudio beep. Sound is
   best-effort — the board works without it.
3. Advance an order with its card button:
   `Start Preparing → Mark Completed → Mark Served`. Only the single linear
   step is offered; anything else is rejected (`shared/kitchen.ts`
   `isValidKitchenTransition`). Failed advances show an inline error.
4. Each card shows order id, customer (or Walk-in), elapsed `mm:ss` ticking
   every second, items with quantities, and a status pill. Cards older than the
   alert threshold get an overdue highlight.
5. Badges in `/sales`: `SalesHistoryPage` shows a `KitchenBadge` pill next to
   each sale's payment badge; it updates live via the same `kitchen:event`
   subscription, no refresh needed.
6. Threshold setting: Settings → **Kitchen display** → `kds_alert_minutes`
   (whole minutes, 1–120, default **10**). Stored via `settings:update`; the
   kitchen hook re-reads it on load.

## Data model (summary)

- `sales.kitchen_status` (`new | preparing | completed | served`, default
  `new`, CHECK-constrained, migration `029_kitchen_status`). Separate column —
  payment `sales.status` (`completed / unpaid / voided`) is untouched.
- Every sale created by `salesRepo` (including captain orders) inserts with
  `kitchen_status='new'`, so all new sales land on the board.
- Persistence is SQLite: restart the app and active orders reload from disk.

## Acceptance checklist (LAN scope, criteria 1–8)

Statuses are honest for this environment: automated socket/auth/validation
coverage passes here, but no Electron window, LAN, or physical tablet exists in
this environment, so anything needing a live window, network, or second device
is marked `to verify on Windows/LAN` and was NOT live-verified here.

| # | Criterion | Implementation | Verification status |
|---|-----------|----------------|---------------------|
| 1 | New sale on POS appears on tablet board in ~1s with sound | Implemented — `broadcastKitchenEvent` fans out to POS windows + `emitToKitchenSocket('order:new')`; tablet `order:new` handler prepends, flashes, and beeps (`electron/ipc/kitchenHandlers.ts`, `electron/kds/kdsServer.ts`, `electron/kds/public/kitchen.js`) | `to verify on Windows/LAN` (timing + beep need a live POS + tablet) |
| 2 | Tablet advance `new → preparing → completed → served`; POS badge follows live | Implemented — tablet emits `order:setStatus`, server persists via `setKitchenStatus` and emits `order:updated` to namespace + POS broadcast; POS `KitchenBadge` updates via `kitchen:event` | `to verify on Windows/LAN` (tap-through + badge need live windows) |
| 3 | Reconnect resync: dropped tablet gets a full snapshot on reconnect | Implemented — Socket.IO auto-reconnect (default); server re-emits `kds:config` + `orders:sync` on every (re)connect; tablet `orders:sync` handler does a full re-render | `to verify on Windows/LAN` (drop/reconnect needs a live network) |
| 4 | Restart persistence: active orders survive app restart | Implemented — SQLite-backed (`sales.kitchen_status`, migration `029_kitchen_status`); server re-reads via `listActiveKitchenOrders()` on next boot | `to verify on Windows/LAN` (relaunch needs the packaged app) |
| 5 | Tablet PIN entry gate (masked, regenerate, copy URL) | Implemented — Settings → Kitchen display shows masked PIN + Regenerate, LAN URL list with Copy, server status + Restart (`src/pages/Settings/SettingsPage.tsx`, `electron/ipc/systemHandlers.ts`) | `to verify on Windows/LAN` (copy/enter flow needs live POS + tablet) |
| 6 | Wrong token rejected | Implemented — `/kitchen` namespace middleware compares `handshake.auth.token` to `ensureKdsToken()`, rejects with `unauthorized` | **Automated** — `electron/kds/kdsServer.test.ts` `wrong token yields connect_error` passes |
| 7 | Bad payload rejected without crash (`{status:'foo'}`, unknown id) | Implemented — `order:setStatus` validates object shape, integer `orderId`, whitelisted status via `isKitchenStatus`; service errors go back as `order:error`, never thrown | **Automated** — `kdsServer.test.ts` `{status:'foo'} yields order:error…` and `{orderId:99999} yields order:error` pass |
| 8 | Two tablets fan out (both see the same update) | Implemented — status changes emit `order:updated` to the whole `/kitchen` namespace + POS broadcast; `orders:sync` array on connect | `to verify on Windows/LAN` (needs two live tablet clients) |

Automated verification run for this task (2026-09-19, Windows, pwsh):

- `npm test` (full): **27 files (25 passed, 2 failed), 186 tests (181 passed, 5 failed)**.
  Failures are pre-existing and unrelated to kitchen — left untouched per brief:
  `electron/db/__tests__/chat-repo.test.ts` (4 failed — `SqliteError: no such column: cs.archived` in `listSessions` vs test scaffold) and
  `electron/db/__tests__/debts-v2.test.ts` (1 failed — `createCaptainOrder … reports as barter`, `expected 15000, received 0`).
  KDS scope is fully green: `electron/kds/kdsServer.test.ts` +
  `electron/kds/kdsConfig.test.ts` + `electron/kds/kitchenService.test.ts` =
  **3 files, 22 tests, all passed**.
- `npx tsc --noEmit`: **exit 0, no errors.**
- `npx tsc --noEmit -p tsconfig.node.json`: **exit 0, no errors.**

## Phase 2 — LAN tablets (built)

The same `kitchenService` from Phase 1 is served over the LAN so cheap tablets
act as remote kitchen displays, without forking order logic.

### Server lifecycle

- `startKdsServer(port?)` (`electron/kds/kdsServer.ts`) binds Express +
  Socket.IO to **`0.0.0.0`** on the configured port (default 3000 from
  `kdsConfig.getKdsPort()`). Started from `app.whenReady`, stopped on
  `before-quit`; same-port restart is a no-op; `stopKdsServer()` is idempotent.
- Static tablet UI: `GET /kitchen` serves `kitchen.html`; `/kitchen/*` serves
  the css/js; `/` redirects to `/kitchen`; everything else is `404` (no admin
  or POS routes on the network server). Public dir resolves to
  `dist-electron/kds/public` (packaged) then `electron/kds/public` (dev);
  missing dir → `/kitchen` returns `503 Kitchen display not installed`.
- POS stays live: `broadcastKitchenEvent` fans out to POS windows first, then
  `emitToKitchenSocket` (never throws; no-op when stopped).

### Events (Socket.IO `/kitchen` namespace)

| Direction | Event | Payload |
|-----------|-------|---------|
| server → tablet | `orders:sync` | Array of active orders (full snapshot on every connect/reconnect) |
| server → tablet | `order:new` | Single new `KitchenOrder` (POS create) |
| server → tablet | `order:updated` | Single updated `KitchenOrder` (any status change; dropped from board when `served`) |
| tablet → server | `order:setStatus` | `{ orderId: number, status: KitchenStatus }` |
| server → tablet | `order:error` | `{ message: string }` (validation/service failure, no crash) |
| server → tablet (additive) | `kds:config` | `{ alertMinutes: number }` on connect (overdue threshold; does not alter the four spec events above) |

### Auth

- Token/PIN lives in `settings` (`kds_token`), created lazily by
  `ensureKdsToken()` (random 6-digit, never overwritten once set, never
  hard-coded). Sent as Socket.IO handshake `auth: { token }` and validated in
  namespace middleware; mismatch → `connect_error: unauthorized`.
- Tablet shows a PIN overlay until auth succeeds; changing/regenerating the PIN
  in Settings disconnects tablets until they re-enter it.

### Validation rules (`order:setStatus`)

1. Payload must be an object; `orderId` must be an integer; `status` must pass
   `isKitchenStatus` (`shared/kitchen.ts`) — else `order:error: Invalid request`.
2. `setKitchenStatus` enforces existence + the single linear transition
   (`new → preparing → completed → served`) — service throw → `order:error`
   with the message, no broadcast, no crash. Handler never throws out of the
   socket callback.

### Port-in-use behavior

- `EADDRINUSE` on bind → status `{ running: false, port, urls: [], error: 'Port
  <port> is already in use. Change it in Settings → Kitchen display.' }`,
  server torn down cleanly, app keeps running. Settings → Server port → Save &
  Restart rebinds (`system:restartKds`).

### Troubleshooting

- **Wrong PIN:** tablet stays on the PIN overlay with `Wrong PIN. Try again.`
  Re-enter the PIN from POS Settings → Kitchen display.
- **Reconnect:** Socket.IO reconnects automatically; the board shows
  `Reconnecting…` on `disconnect`/`reconnect_attempt` and re-renders from the
  next `orders:sync`. If stuck, tap the tablet reload / re-enter the PIN.
- **Port clash:** Settings shows the red `Port … is already in use` line;
  pick a free port (1–65535) → Save & Restart, and update the firewall rule +
  tablet URL to the new port.
- **No LAN IPs:** the URL list is built from `os.networkInterfaces()` IPv4
  non-internal addresses (`getLanIPv4Addresses`). Empty list means the POS PC
  has no LAN IPv4 — check Wi-Fi/Ethernet, VPN isolation, or guest-network AP
  isolation; tablets must be on the same LAN.

## Settings reference (POS)

Settings → **Kitchen display**: `kds_alert_minutes` (1–120, default 10),
Server port (1–65535, default 3000, Save & Restart), Kitchen PIN (masked,
Regenerate), LAN URL list (`http://<ip>:<port>/kitchen` + Copy per URL),
server status line (Running on port P / error), Restart server button.

## Ticket printing

Paper tickets print alongside the on-screen board (KOT for the kitchen,
receipt for the customer).

### Data flow

`sales:create` → `maybeAutoPrint` → print queue → hidden window →
silent print. Sale creation enqueues KOT/receipt jobs per the auto-print
flags; a hidden BrowserWindow renders the ticket and prints silently
without a dialog.

### Settings keys

Settings → **Printing**:

| Key | Default | Meaning |
|-----|---------|---------|
| `print_enabled` | on | Master switch; when off, all jobs are skipped |
| `print_kot_auto` | on | Auto-print KOT on every sale |
| `print_receipt_auto` | off | Auto-print customer receipt on every sale |
| `print_device_name` | system default | Target printer; empty means the Windows default |
| `receipt_footer` | empty | Extra footer line on receipts |

### Troubleshooting

- **Nothing prints:** is `print_enabled` on? Is the printer installed in
  Windows? Is the right device selected in Settings → Printing? What did
  the **Print test page** show — if the test page fails, fix the Windows
  printer/driver first.
- **Wrong printer:** silent print uses the Windows default printer when no
  device is picked (`print_device_name` empty). Pick the device explicitly
  in Settings → Printing to pin it.

No new dependencies were added for printing (Electron + existing app code
only).

### Manual acceptance (to verify on Windows with a real printer)

- Create a sale → KOT prints automatically — `to verify on Windows with a real printer` (not live-verified here).
- Sale toast → Print receipt → receipt prints — `to verify on Windows with a real printer` (not live-verified here).
- Settings → Printing → Print test page — `to verify on Windows with a real printer` (not live-verified here).
- Disable `print_enabled` → jobs are skipped — `to verify on Windows with a real printer` (not live-verified here).

## Dependencies

- Prod: `express` (^4), `socket.io` (^4).
- Dev (tests only): `socket.io-client`, `@types/express`.
