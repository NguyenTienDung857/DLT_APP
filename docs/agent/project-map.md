# Project map

- `electron-main.js`: app lifecycle, parse workers, IPC, clipboard/TXT/browser, updater.
- `preload.js`: context-isolated IPC bridge.
- `renderer.js`: log/filter/viewport state and ChatGPT panel interaction.
- `index.html`, `style.css`: layout, themes and controls.
- `src/parser/dltParser.js`, `src/workers/parseWorker.js`: background DLT/text parsing.
- `src/services/logTextFormatter.js`: full ID/time/payload serialization.
- `src/services/chatgptHandoff.js`: text worker, file creation and external handoff.
- `src/workers/logTextWorker.js`: background formatting.
- `src/services/encDecryptor.js`, `exporter.js`: ENC and general export support.
- `scripts/smoke-check.js`, `check-handoff.js`, `check-electron-ui.js`: regression checks.
- `dist/` and `out/`: generated artifacts, not source.
