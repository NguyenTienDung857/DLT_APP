# BLTN-Analysis Log User Guide (English)

This desktop viewer opens Built-in Cam ECU logs and prepares selected log text for use in ChatGPT.

## 1. Open Logs

1. Click `Open DLT / ENC` (top bar), or drag-and-drop files onto the landing screen.
2. You can open multiple files at once. They are parsed in a worker and shown as one combined timeline.

Supported inputs are intended to include: `.dlt`, `.enc`, `.log`, `.bin`.

Tips:
- Large logs keep the UI responsive because parsing is done in the background.
- `.enc` files are decrypted next to the source file, then the app opens that extracted folder so you can choose the `.dlt` files to parse.
- After parsing finishes, use the left `Search / Filter` panel to narrow down the view.

## 2. Main Layout

The app has three main areas:

- Left rail: Search / filter controls, stats, and the `Message Detail` panel.
- Center: Timeline and log table.
- Right: ChatGPT log scope, clipboard copy and optional TXT export.

### Log focus

Click `Log focus` in the top bar to split the workspace into:

- Log table on the left
- ChatGPT sharing panel on the right

Use this layout to give more space to the log table while preparing a chat.

## 3. Timeline, Minimap, and Scrolling

### Minute Timeline (top)

The `Minute Timeline` shows a density/level overview by time. Click on the timeline to jump to that area in the log list.

### Minimap (right of log list)

The vertical minimap shows the full file as a thin overview with colored marks for errors and warnings.

Click on the minimap to jump quickly to the corresponding section in the logs.

### Fast scroll rail (beside the log list)

There is a thin draggable scroll rail next to the log list. Drag it to move quickly through the virtualized list.

## 4. Log Table

The log table uses virtual scrolling for performance with large files.

Columns:

- `#`: message order
- `Time`: time label (default is `HH:mm:ss`)
- `Delta`: time gap from the previous message
- `Payload`: log payload text

Behavior:

- Enable the checkbox beside `Time` to show the full timestamp.
- Payload text wraps; row height expands based on content.
- Drag header separators to resize columns.
- Click a row to select it for Current line export and Message Detail.

Keyboard navigation:

- `F`: focus the Search input (when you are not typing in another input)
- `ArrowUp` / `ArrowDown`: move selection up/down within the filtered results

## 5. Message Detail (Left Rail)

When you click a row, `Message Detail` shows:

- File
- Timestamp
- Full payload text

Notes:
- The `Counter` line is not shown (the UI was simplified).
- Payload is shown as text; very large payloads are still readable because the box is scrollable.

## 6. Search / Filter (Left Rail)

### 6.1 Text Search

Use the `Search payload or time... (F)` input to quickly search within the current log view.

In `Log focus`, there is also a small `Search` button above the log table for quick search access.

### 6.2 Keyword Navigation

Click `+` beside the main search input to add another keyword search box. Each search box has its own match counter and up/down buttons.

`Full` is enabled by default. All active searches highlight matches while keeping the current log view visible. Turn `Full` off to show rows that match any active keyword search.

Use the up/down buttons beside each counter to move between matches for that search box. Extra search boxes have `x` to remove them.

### 6.3 ID Range Filter

Use the `ID Range` panel (two-handle slider) to restrict the visible logs by message ID. Each ID label also includes the matching time, so there is no separate Time Range mode.

Time labels include a day marker such as `D1` or `D2` so multi-day logs stay clear.

- Use `Full Log` to reset the filter back to the entire log.

This filter affects:

- What you see in the log table
- What is exported by `Export CSV`
- What the ChatGPT `Filtered logs` scope copies

### 6.4 Export CSV

Click `Export CSV` to export the currently filtered rows to a CSV file.

The export uses the current filter state (search + range).

## ChatGPT log sharing

Choose All loaded logs, Current line, Filtered logs or Lines on screen.
Copy copies Time (HH:mm:ss) and full Payload only. Copy & open ChatGPT also
opens the default browser. ID, date, fractional seconds and Delta are excluded.
No TXT files are created. Use Ctrl+V to paste the copied text into your chat.
The small settings button opens a hidden URL field. Save an HTTP/HTTPS link
to use it for Copy & open; clear it to restore https://chatgpt.com/.
Current line exports exactly one row; viewport exports partially visible rows
without offscreen overscan. Filtered logs respects the Full search option.
Large log formatting runs in a worker without sampling. Loading must finish first.
Minute Timeline has been removed; the log table and minimap remain.
Unpacked builds without app-update.yml do not attempt automatic updates.


## 10. Download Guide

Click `Download Guide` in the top bar to save this user guide (`USER_GUIDE_EN.md`) to a location you choose.

## 11. Build and Distribute the App

Run:

```powershell
.\build.bat
```

The script installs dependencies if needed, runs validation, and builds a Windows installer into the `dist` folder.

Generated files:

- `BLTN-Analysis-Log-Setup-<version>.exe`: installer to share with users
- `latest.yml`: update metadata
- `*.blockmap`: update download metadata

The current build creates an unsigned installer for internal distribution. For broader distribution, use a code-signing certificate and re-enable signing to reduce Windows SmartScreen warnings.

## 12. Auto Update Workflow

The app uses `electron-updater` with an `electron-builder` GitHub provider.

Current `package.json` publish config:

```json
"publish": [
  {
    "provider": "github",
    "owner": "NguyenTienDung857",
    "repo": "DLT_APP"
  }
]
```

For every new release:

1. Increase `version` in `package.json`.
2. Run `build.bat`.
3. Open GitHub repo `NguyenTienDung857/DLT_APP`.
4. Create a new Release with a matching tag, for example `v1.0.1`.
5. Upload the generated installer `.exe`, `latest.yml`, and `*.blockmap` files from `dist` as Release assets.
6. Publish the Release.
7. Installed apps check GitHub Releases on launch, download the new version, and ask the user to restart/install.

Important:

- The repository should be public if installed apps need to update without a GitHub token on the user machine.
- The first installer you give users must already contain the correct GitHub `owner/repo` config.

If GitHub CLI is installed and authenticated, you can publish assets with:

```powershell
gh release create v1.0.1 dist\*.exe dist\*.blockmap dist\latest.yml --title "v1.0.1" --notes "Update release"
```

## 13. Troubleshooting
