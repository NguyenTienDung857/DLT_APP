const { app, BrowserWindow, clipboard, shell } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dlt-ui-'));
app.setPath('userData', path.join(directory, 'profile'));
app.setPath('downloads', directory);
const captureDir = path.resolve(__dirname, '../out/ui-check');
fs.mkdirSync(captureDir, { recursive: true });
let copiedText = '';
let openedUrl = '';
let revealedFile = '';
clipboard.writeText = (text) => { copiedText = text; };
shell.openExternal = async (url) => { openedUrl = url; };
shell.showItemInFolder = (file) => { revealedFile = file; };
const errors = [];
app.on('web-contents-created', (_event, contents) => {
  contents.on('console-message', (event) => {
    if (event.level === 'error') errors.push(event.message);
  });
});
require('../electron-main');

async function runChecks() {
  await app.whenReady();
  const window = BrowserWindow.getAllWindows()[0];
  window.webContents.setBackgroundThrottling(false);
  if (window.webContents.isLoading()) {
    await new Promise((resolve) => window.webContents.once('did-finish-load', resolve));
  }
  const run = (code) => window.webContents.executeJavaScript(code);
  console.log('UI check: renderer loaded.');
  assert.equal(await run('el.btnHandoff.disabled'), true);
  const log = path.join(directory, 'sample.log');
  fs.writeFileSync(log, Array.from({ length: 30000 }, (_, i) =>
    `2026-10-02 15:30:45.123 ${i % 2 ? 'INFO' : 'ERROR'} ECU APP CTX row-${i} Tiếng Việt`
  ).join('\n'));
  await run(`openFiles(${JSON.stringify([log])})`);
  console.log('UI check: parsing started.');
  const deadline = Date.now() + 30000;
  while (!await run('state.parseDone')) {
    if (Date.now() > deadline) throw new Error(`Parser did not finish: ${await run('el.parseStatus.textContent')} ${errors.join('; ')}`);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(await run('state.messages.length'), 30000);
  assert.equal(await run('el.btnHandoff.disabled'), false);
  await run("el.handoffScope.value = 'selection'; state.selectedId = null; updateHandoffUi();");
  assert.equal(await run('el.btnHandoff.disabled'), true);
  await run("selectMessage(state.messages[12].id, true); copyAndOpenChatgpt()");
  assert.equal(copiedText.split('\r\n').length, 2);
  assert.ok(copiedText.includes('15:30:45\t'));
  assert.ok(copiedText.includes('row-12'));
  assert.equal(openedUrl, 'https://chatgpt.com/');
  openedUrl = '';
  await run('copyAndOpenChatgpt(false)');
  assert.equal(openedUrl, '');
  await run("saveTextSetting('bltn-handoff-url', 'https://example.com/chat'); copyAndOpenChatgpt(true)");
  assert.equal(openedUrl, 'https://example.com/chat');
  await run("saveTextSetting('bltn-handoff-url', '');");
  assert.equal(await run("document.getElementById('timeline')"), null);
  await run("el.searchInput.value = 'row-29999'; el.searchFullToggle.checked = false; applyFilters(); el.handoffScope.value = 'filtered'; copyAndOpenChatgpt()");
  assert.equal(copiedText.split('\r\n').length, 2);
  assert.ok(copiedText.includes('row-29999'));
  await run("el.handoffScope.value = 'all'; copyAndOpenChatgpt()");
  assert.equal(copiedText.split('\r\n').length, 30001);
  await run("resetFilters(); el.handoffScope.value = 'viewport'; el.virtualScroll.scrollTop = 503; renderVirtualRows();");
  const expectedIds = await run(`(() => {
    const viewport = el.virtualScroll.getBoundingClientRect();
    return [...el.rowsLayer.querySelectorAll('.log-row')].filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.bottom > viewport.top && rect.top < viewport.bottom;
    }).map((row) => Number(row.dataset.id));
  })()`);
  await run('copyAndOpenChatgpt()');
  assert.deepEqual(copiedText.split('\r\n').slice(1).map((line) => Number(line.match(/row-(\d+)/)[1])), expectedIds);
  assert.ok(expectedIds.length > 0 && expectedIds.length < await run('el.rowsLayer.children.length'));
  await run("el.handoffScope.value = 'filtered'; updateHandoffUi();");
  await new Promise((resolve) => setTimeout(resolve, 1000));
  fs.writeFileSync(path.join(captureDir, 'dark.png'), (await window.webContents.capturePage()).toPNG());
  await run('toggleTheme(); toggleLogFocus();');
  assert.equal(await run("el.app.classList.contains('theme-light')"), true);
  assert.equal(await run("el.workspace.classList.contains('log-focus')"), true);
  assert.equal(await run("getComputedStyle(document.getElementById('chatgpt-title')).color"), 'rgb(11, 29, 21)');
  await new Promise((resolve) => setTimeout(resolve, 1000));
  fs.writeFileSync(path.join(captureDir, 'light-focus.png'), (await window.webContents.capturePage()).toPNG());
  await run('resetWorkspace();');
  assert.equal(await run('el.btnHandoff.disabled'), true);
  assert.equal(await run("Boolean(document.querySelector('[id^=ai-], .quick-ai-row-btn'))"), false);
  assert.deepEqual(errors, []);
  console.log('Electron UI checks passed: parse 30,000 rows, four scopes, copy-only/custom-link IPC, themes, reset.');
  console.log('External browser, clipboard and Explorer were mocked; screenshots: out/ui-check.');
}

runChecks().then(() => app.exit(0)).catch((error) => {
  console.error(error);
  app.exit(1);
});
app.on('quit', () => {
  fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
});
