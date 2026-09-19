# BusinessPOS

A point of sale system for businesses.

## Kitchen display (Phase 1, in-Electron)

The Kitchen page lives at the `/kitchen` route (sidebar → Kitchen). Every new
sale appears there as `new` and advances `new → preparing → completed → served`
via on-card buttons (`Start Preparing → Mark Completed → Mark Served`).
`/sales` rows show a matching kitchen-status badge that updates live without a
refresh. The overdue highlight threshold is set in Settings → Kitchen display
(`kds_alert_minutes`, default 10, range 1–120 minutes). See
`docs/kitchen-display.md` for use, acceptance status, and the Phase 2 preview.

Note: Phase 2 LAN tablet support (remote devices over the network) is pending.