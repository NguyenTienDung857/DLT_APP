const assert = require('node:assert/strict');
const { formatLogText } = require('../src/services/logTextFormatter');
const { prepareLogText, normalizeChatUrl, handoffLogText } = require('../src/services/chatgptHandoff');

async function check() {
  const text = formatLogText([{ id: 91, time: '2026-10-02 15:30:45.999', payload: 'Tiếng Việt\tline\nnext' }]);
  assert.equal(text, 'Time\tPayload\r\n15:30:45\tTiếng Việt\\tline\\nnext');
  const large = await prepareLogText(Array.from({ length: 30000 }, (_, id) => ({ time: '23:59:59', payload: `row ${id}` })));
  assert.equal(large.split('\r\n').length, 30001);
  assert.equal(normalizeChatUrl(''), 'https://chatgpt.com/');
  assert.throws(() => normalizeChatUrl('file:///C:/Windows'));
  assert.throws(() => normalizeChatUrl('javascript:alert(1)'));
  const calls = [];
  const services = { clipboard: { writeText: (value) => calls.push(value) },
    shell: { openExternal: async (url) => calls.push(url) } };
  await handoffLogText(text, { openBrowser: false }, services);
  assert.deepEqual(calls, [text]);
  await handoffLogText(text, { openBrowser: true }, services);
  assert.equal(calls.at(-1), 'https://chatgpt.com/');
  await handoffLogText(text, { openBrowser: true, url: 'https://example.com/chat' }, services);
  assert.equal(calls.at(-1), 'https://example.com/chat');
  console.log('Handoff checks passed: no ID, 30,000 rows, copy-only and custom URLs.');
}
check().catch((error) => { console.error(error); process.exitCode = 1; });
