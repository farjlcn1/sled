<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# maplibre-gl worker + Turbopack

If the map ever renders only a flat background color with no roads/labels (worse the more you
zoom in, since more tiles are needed and none arrive), don't assume it's a bad maplibre-gl
version — it's a known Turbopack bundling bug that silently breaks tile fetching while leaving
style/sprite loading intact (maplibre-gl-js PR #7406). Already fixed here via the CSP worker
build (`next.config.ts` alias + `public/maplibre-gl-csp-worker.js` + `setWorkerUrl()` in
`components/vehicle-map.tsx`) — see README.md "Znane posebnosti" for the full explanation.
Don't remove that wiring when touching the map or upgrading maplibre-gl without re-verifying
tiles still load at high zoom.
