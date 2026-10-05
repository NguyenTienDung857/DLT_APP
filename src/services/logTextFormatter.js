/** Format a log clock without changing the source timezone. */
function formatLogClock(message) {
  if (/^(?:line|message)\s+\d+$/i.test(String(message.time ?? ''))) return '-';
  const match = String(message.time ?? '').match(/\b(\d{2}):([0-5]\d):([0-5]\d)(?:\.\d+)?\b/);
  if (match && Number(match[1]) < 24) return `${match[1]}:${match[2]}:${match[3]}`;
  if (!Number.isFinite(message.timeMs) || message.timeMs < 0) return '-';
  const seconds = Math.floor(message.timeMs / 1000);
  return [Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60]
    .map((value) => String(value).padStart(2, '0')).join(':');
}

/** Escape delimiters reversibly so each record occupies one text line. */
function escapeLogCell(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/\t/g, '\\t')
    .replace(/\r/g, '\\r').replace(/\n/g, '\\n');
}

/** Export full payloads in source order with only Time and Payload. */
function formatLogText(messages) {
  if (!Array.isArray(messages) || !messages.length) throw new Error('No log rows selected.');
  return ['Time\tPayload', ...messages.map((message) =>
    `${formatLogClock(message)}\t${escapeLogCell(message.payload)}`
  )].join('\r\n');
}

module.exports = { formatLogClock, escapeLogCell, formatLogText };
