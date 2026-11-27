# 0003 — Personal list in localStorage, legacy-compatible

**Decision.** Zustand `persist` with a custom storage adapter
(`src/store/persistence/debouncedPersistStorage.ts`) over a `MyListRepository`. The only
implementation, `LocalStorageMyListRepository`, reads and writes the legacy key
`almogim2181.v2` and shape `{prio:[{id,note}], az:{[id]:deg}}`. Payloads are validated with Zod;
invalid parts are dropped, never thrown. Writes are debounced by 500 ms and flushed on
`pagehide`.

**Consequences.** Lists saved by the legacy site load unchanged (covered by unit and e2e tests).
A server repository can be added later; `load()` may return a Promise.
