# Development and verification

Read AGENTS.md, project-map.md and ai-behavior.md before changing the handoff.
Update main/preload/renderer/UI together when changing IPC. Preserve independent
parser, ENC, CSV and updater behavior. Keep formatting off the GUI thread.

Required code checks:

```powershell
rtk proxy npm.cmd run syntax
rtk proxy npm.cmd run check
rtk proxy npm.cmd run check:ui
rtk proxy npm.cmd run pack
```

The check command covers parser, ENC, formatting, 30,000 rows, Unicode, filename
collisions, and independent copy/file/browser failure paths. UI checks run Electron
with isolated temporary data, mock clipboard/browser/Explorer, exercise all scopes,
and save screenshots in out/ui-check. They do not prove actual browser or Explorer behavior.
For manual UI checks run npm.cmd start. Check default-browser opening, Ctrl+V,
Downloads/reveal, dark/light themes, selection, filtering, scrolling and reset.
Verify another Windows account/machine separately before claiming portability.
Build an installer only when requested. Do not publish without authorization.
Use git diff --check and git status --short before finishing. Preserve unrelated changes.
