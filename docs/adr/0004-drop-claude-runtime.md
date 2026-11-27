# 0004 — Drop the Claude artifact runtime integration

**Context.** When hosted as a Claude artifact, the legacy site saved the list to the viewer's
account (`window.claude` `db`) and saved files through `downloads`.

**Decision.** Removed. The app is a normal static site; export uses a Blob and `<a download>`.

**Consequences.** Lists saved only in a Claude account do not carry over; lists in the browser's
`localStorage` do. Cross-device sync can return as a `MyListRepository` implementation.
