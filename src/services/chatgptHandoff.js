const path = require('node:path');
const { Worker } = require('node:worker_threads');

/** Format logs in a worker so large exports do not block Electron's main loop. */
function prepareLogText(messages) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, '../workers/logTextWorker.js'), { workerData: messages });
    let settled = false;
    worker.once('message', (result) => {
      settled = true;
      if (result.error) reject(new Error(result.error));
      else resolve(result.text);
    });
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (!settled) reject(new Error(`Log export worker stopped (${code}).`));
    });
  });
}

/** Validate a web destination; blank uses ChatGPT. */
function normalizeChatUrl(value) {
  const url = new URL(String(value || '').trim() || 'https://chatgpt.com/');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Use an http:// or https:// web link without credentials.');
  }
  return url.href;
}

/** Copy first; browser failures never undo a successful copy. */
async function handoffLogText(text, options, services) {
  const result = { clipboardCopied: false,
    browserOpened: false, warnings: [] };
  try {
    services.clipboard.writeText(text);
    result.clipboardCopied = true;
  } catch (error) {
    result.warnings.push(`Could not copy logs: ${error.message}`);
    return result;
  }
  if (!options.openBrowser) return result;
  try {
    await services.shell.openExternal(normalizeChatUrl(options.url));
    result.browserOpened = true;
  } catch (error) {
    result.warnings.push(`Open https://chatgpt.com/ manually: ${error.message}`);
  }
  return result;
}

module.exports = { prepareLogText, normalizeChatUrl, handoffLogText };
