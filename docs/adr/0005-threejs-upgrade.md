# 0005 — three.js upgraded r128 → r187 with the legacy look

**Context.** The legacy viewer used three r128 from a CDN. Since then three changed colour
management (r152), switched to physical light units (r155) and removed `PCFSoftShadowMap`.

**Decision.** Bundle `three` from npm (lazy-loaded). To keep the legacy look:
`ColorManagement.enabled = false`, `renderer.outputColorSpace = LinearSRGBColorSpace`, light
intensities × π (`LIGHT_SCALE`), `PCFShadowMap`. Scene building (`apartmentModel.ts`) is
separate from the renderer (`createApartmentScene.ts`) so it is unit-tested without WebGL.

**Consequences.** Screenshots match the legacy render. The React wrapper disposes the scene and
forces context loss on unmount; an e2e test opens/closes the view 20× without context warnings.
