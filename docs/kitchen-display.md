# Kitchen display — Phase 1 (in-Electron)

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

## Acceptance checklist

Statuses are honest for this environment: unit/integration coverage passes,
but no Electron window was launched here, so live UI behaviour is
**implemented but manually unverified** — confirm on a Windows build.

| # | Criterion | Status |
|---|-----------|--------|
| 1 | Sale created in Sell appears as `new` in `/kitchen` in realtime (<~1s, with sound when enabled) | Implemented — `to verify on Windows` |
| 2 | Advance flow `new → preparing → completed → served`; invalid/backward transitions rejected | Implemented (unit-tested guard + service validation) — live click-through `to verify on Windows` |
| 3 | `/sales` kitchen badge updates without refresh on advance | Implemented — `to verify on Windows` |
| 4 | LAN / remote tablet display | **Phase 2 scope — not implemented** |
| 5 | Restart persistence: active orders survive app restart | Implemented (SQLite-backed, covered by migration/service tests) — relaunch `to verify on Windows` |
| 6 | LAN reconnect handling | **Phase 2 scope — not implemented** |
| 7 | Token auth + payload validation for remote clients | **Phase 2 scope — not implemented** |
| 8 | Multi-tablet fan-out | **Phase 2 scope — not implemented** |

Automated verification run for this task (2026-09-19, Windows, pwsh):

- `npx vitest run`: **25 files (24 passed, 1 failed), 169 tests (165 passed, 4 failed)**.
  All 4 failures are pre-existing in `electron/db/__tests__/chat-repo.test.ts`
  (`SqliteError: no such column: cs.archived` — `listSessions` vs test
  scaffold). Unrelated to kitchen; left untouched per brief. All kitchen
  suites (`shared/kitchen`, `kitchen-status` migration, `kitchenService`) pass.
- `npx tsc --noEmit`: **exit 0, no errors.**

## Phase 2 preview — LAN tablets (not built yet)

Plan: serve the same `kitchenService` over the LAN so cheap tablets can act as
remote kitchen displays, without forking order logic.

- Transport: lightweight **Express + Socket.IO** server bound to
  **`0.0.0.0:3000`**, reusing `listActiveKitchenOrders` / `setKitchenStatus`.
- Events: `orders:sync` (full snapshot on connect), `order:new`,
  `order:updated`, and client → server `order:setStatus`.
- Auth: token issued from app Settings, sent by each tablet on connect and
  validated server-side; malformed payloads rejected before touching the DB.
- Reconnect: tablets resync via `orders:sync` after drop; last-writer-wins per
  order id with the same linear-transition guard.
- Ops notes (to finalize in Phase 2):
  - Windows firewall:
    `New-NetFirewallRule -DisplayName BusinessPOS-KDS -Direction Inbound -LocalPort 3000 -Protocol TCP -Profile Private`
  - DHCP reservation for the POS host so the tablet URL is stable.
  - Tablets in kiosk mode, no-sleep while plugged in, autostart browser to the
    KDS URL.
