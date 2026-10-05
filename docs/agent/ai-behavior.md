# ChatGPT handoff guardrails

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


## Implementation

All API AI, model selection and RAG logic has been removed. Do not restore it.
Renderer selects rows and yields while copying row data. The formatting worker
builds text; the main process writes clipboard, optionally opens the
saved HTTP/HTTPS link. Renderer must never supply an arbitrary URL or export path.
Keep clipboard/browser failures separate. Preserve parser, ENC, CSV and updater behavior.
