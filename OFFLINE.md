# Automatic offline behavior

The app uses the backend while the browser reports connectivity and switches to local data when disconnected. On reconnection it returns to backend reads and uploads saved changes automatically. There are no mode, download, or sync controls in the header.

The header displays only a centered **OFFLINE MODE** label while disconnected: solid red background, white text, no transparency. The app title and hamburger retain their positions. The label is hidden online.

## Profile settings

**Profile → Offline storage** offers three independent account preferences (off by default for new accounts):

- **Guide:** complete route descriptions, grades, areas, local search and filters.
- **Community:** comments, feed, Hall of Fame and current-year standings. Offline information is the last saved snapshot; other years and unvisited drill-downs may be unavailable.
- **Map:** climbing locations and local road/trail/POI/trailhead/gate tiles around saved climbing locations. Satellite/topographic imagery and 3D terrain still require connectivity. Map metadata is stored separately, so enabling Map does not implicitly enable the guide cache.

Enabling a setting starts its download while connected. Choices persist across logins/devices in the per-user settings table as `guide_data_sync`, `community_data_sync` and `map_data_sync`. Downloads remain device-local. Offline preference changes upload automatically on reconnection. Profile shows download progress and the last saved date. Disabling a setting removes its local data; personal logs and pending changes are preserved. Existing checked choices are preserved on the first upgrade to account preferences.

Guide includes routes, areas and subareas, not Community or Map. Offline checks apply to content previously loaded online too: public views are cleared on connectivity changes, and the map shows an unavailable message if Map is disabled. Log Book and To-Do remain available independently of the switches.

Personal Log Book, To-Do and annual-send data is always cached, with no preference, caching indicator, or manual sync UI. Every personal write is committed to IndexedDB before reporting success, then uploaded automatically when authenticated and connected. Changes made while an earlier version is uploading are retained as dependent operations, preserving the earlier retry payload. Unsynced records are projected over backend results until confirmed. Basic name/grade hints are retained for logged routes even when Guide is disabled, allowing existing logs to be edited offline.

Service workers keep the app shell available for offline reloads. The remembered account opens automatically offline, including in a new tab without session tokens. Explicit sign-out removes that remembered session reference, while retaining personal data and pending work. Uploads require a valid login for the account that owns them. Tokens and passwords are not copied into IndexedDB.

Browser storage is device-local and can be cleared or evicted. Persistent storage is requested after feature downloads but cannot be guaranteed. Shared route database edits and account/profile mutations require connectivity. Offline comments require Community enabled.

## Deployment

Deploy the matching backend implementation and run its migration before releasing this frontend's automatic logging:

```sh
python manage.py migrate
```

Migration `0006_offline_receipt` adds retry receipts. Migration `0007_offline_preferences` adds the three Boolean preferences to the existing per-user settings model; neither changes route records or Django's `auth_user` table. Authenticated `GET /api/offline-status/` must report `protocol: 1`. Automatic uploads wait if this capability is missing, keeping changes on the device. Do not delete receipts while clients may retry old operations. Server validation and conflicts retain queued work; unresolved errors require investigation before that operation can sync.

Serve frontend assets over HTTPS or localhost, including `offline.js`, `offline-core.js`, and `sw.js` with JavaScript MIME types. Keep `sw.js` at a stable URL and bump its shell version for each frontend release. Close old tabs and reopen to activate a waiting worker. The first shell install needs the pinned MapLibre CDN files to be reachable. Offline fonts fall back to device fonts. Supported browsers need service workers, IndexedDB, Cache Storage, Web Locks for coordinated uploads, `crypto.randomUUID`, and AbortSignal timeouts.

## Verification

```sh
node --test tests/offline-core.test.cjs tests/offline-map.test.cjs
node --test tests/offline-browser.test.cjs
```

The browser integration test uses a local fake API and real IndexedDB, service worker and Cache Storage. It covers automatic online/offline switching and reconnect sync, offline reload/new-tab startup, Profile preferences, removal of optional caches while retaining logs, and the red centered header label. It stubs MapLibre; actual device map rendering, storage pressure and deployed PostgreSQL integration still need separate verification. Playwright/Chromium is required, or set `PLAYWRIGHT_CHANNEL=msedge` when Edge is installed.

The matching backend's `tests/test_offline_writes.py` exercises the real write mixin against isolated in-memory SQLite without loading production settings or connecting to the production database.
