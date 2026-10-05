const { parentPort, workerData } = require('node:worker_threads');
const { formatLogText } = require('../services/logTextFormatter');

try {
  parentPort.postMessage({ text: formatLogText(workerData) });
} catch (error) {
  parentPort.postMessage({ error: error.message });
}
