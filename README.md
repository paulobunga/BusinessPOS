# BusinessPOS

A point of sale system for businesses.

## Kitchen display (Phase 1 local + Phase 2 LAN tablets)

The Kitchen page lives at the `/kitchen` route (sidebar → Kitchen). Every new
sale appears there as `new` and advances `new → preparing → completed → served`
via on-card buttons (`Start Preparing → Mark Completed → Mark Served`).
`/sales` rows show a matching kitchen-status badge that updates live without a
refresh. The overdue highlight threshold is set in Settings → Kitchen display
(`kds_alert_minutes`, default 10, range 1–120 minutes). See
`docs/kitchen-display.md` for use, acceptance status, and LAN operations.

### LAN tablets (Phase 2)

The POS PC also serves a tablet-friendly board over the LAN:

1. On the POS PC, open **Settings → Kitchen display**. The **LAN URL list**
   shows one URL per LAN IPv4 (e.g. `http://<LAN-IP>:3000/kitchen`). Click
   **Copy** next to the URL for your network and open it in the tablet browser.
2. On the tablet, enter the **Kitchen PIN** shown in the same Settings section
   (masked field; **Regenerate** rotates it — tablets must re-enter it after a
   change). Wrong PINs stay on the PIN screen with `Wrong PIN. Try again.`
3. Allow inbound traffic once, as admin on the POS PC (private profile; replace
   the port if you changed it from 3000):

   `New-NetFirewallRule -DisplayName BusinessPOS-KDS -Direction Inbound -LocalPort 3000 -Protocol TCP -Profile Private`

4. Give the POS PC a **DHCP reservation** (or static IP) on the router so the
   tablet URL stays stable.
5. Kiosk advice: **Fully Kiosk Browser** (Android) or **Guided Access** (iPad),
   locked to the KDS URL.
6. On the POS PC, **disable sleep** while plugged in and **launch the app at
   startup** so tablets can always reconnect (they resync automatically via
   `orders:sync`).

### Ticket printing

Printing summary: a KOT auto-prints on every sale (including captain
orders) when `print_kot_auto` is on; a customer receipt auto-prints when
`print_receipt_auto` is on. Setup: install the printer in Windows →
Settings → Printing → pick the device → Print test page. Manual reprints:
the sale-complete toast, the sales history row, and the kitchen card. See
`docs/kitchen-display.md` (`## Ticket printing`) for data flow, settings,
and troubleshooting.