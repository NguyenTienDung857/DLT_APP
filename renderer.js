const api = window.nexusApi;

const LEVELS = ['Fatal', 'Error', 'Warn', 'Info', 'Debug', 'Verbose', 'Trace', 'Control', 'Unknown'];
const MIN_ROW_HEIGHT = 34;
const ROW_LINE_HEIGHT = 18;
const ROW_VERTICAL_PADDING = 16;
const MAX_RENDER_ROWS = 120;
const MIN_LOG_SCROLL_THUMB_HEIGHT = 30;
const VIRTUAL_SCROLL_END_PADDING = MIN_ROW_HEIGHT * 2;
const ESTIMATED_MONO_CHAR_WIDTH = 7.8;
const DAY_MS = 24 * 60 * 60 * 1000;
const SYNTHETIC_RANGE_STEP_MS = 1000;
const DEFAULT_LOG_COLUMNS = [66, 108, 76, 640];
const MIN_LOG_COLUMNS = [42, 72, 52, 180];
const STAR_ANIMATION_FRAME_MS = 80;
const BG_STAR_COUNT = 90;
const FALLING_STAR_COUNT = 10;
const SEARCH_HOLD_START_DELAY_MS = 160;
const SEARCH_HOLD_REPEAT_MS = 38;
const PRIMARY_SEARCH_ID = 'primary';
const PARSE_RENDER_INTERVAL_MS = 120;

const state = {
  handoffBusy: false,
  handoffGeneration: 0,
  messages: [],
  filtered: [],
  files: [],
  stats: createEmptyStats(),
  rangeBounds: createEmptyRangeBounds(),
  rangeAxis: createEmptyRangeAxis(),
  selectedId: null,
  firstTimeMs: null,
  lastTimeMs: null,
  currentPage: 1,
  pageSize: 'all',
  levelFilter: null,
  parseDone: false,
  searchMatches: [],
  activeSearchMatch: -1,
  extraSearchTerms: [],
  searchTermSeq: 0,
  searchHoldDelayTimer: null,
  searchHoldRepeatTimer: null,
  suppressSearchNavClick: false,
  filterRange: {
    unit: 'id',
    min: null,
    max: null,
    from: null,
    to: null,
    dirty: false
  },
  showFullLogTime: false,
  logColumnWidths: loadLogColumnWidths(),
  renderQueued: false,
  virtualRenderQueued: false,
  parseRenderQueued: false,
  parseRenderTimer: null,
  lastParseRenderAt: 0,
  virtualMetrics: null,
  lastVirtualStart: -1,
  lastVirtualEnd: -1,
  lastVirtualCount: -1,
  dropDepth: 0,
  lastDropSignature: '',
  lastDropAt: 0,
  dataVersion: 0,
  filteredVersion: 0,
  lastTimelineKey: '',
  lastMinimapKey: '',
  idToIndex: new Map(),
  searchCacheVersion: -1,
  cachedSearchQueries: [],
  cachedSearchRegexes: [],
  cachedPagedIndices: null,
  cachedPagedKey: '',
  searchDebounceTimers: new Map()
};

const el = {
  handoffScope: document.getElementById('handoff-scope'),
  handoffCount: document.getElementById('handoff-count'),
  handoffStatus: document.getElementById('handoff-status'),
  btnCopyLog: document.getElementById('btn-copy-log'),
  btnHandoffSettings: document.getElementById('btn-handoff-settings'),
  handoffSettings: document.getElementById('handoff-settings'),
  handoffUrl: document.getElementById('handoff-url'),
  btnHandoffUrlSave: document.getElementById('btn-handoff-url-save'),
  btnHandoff: document.getElementById('btn-handoff'),
  app: document.getElementById('app'),
  dropZone: document.getElementById('drop-zone'),
  starsCanvas: document.getElementById('stars-canvas'),
  brandVersion: document.getElementById('brand-version'),
  workspace: document.getElementById('workspace'),
  btnOpen: document.getElementById('btn-open'),
  btnOpenEmpty: document.getElementById('btn-open-empty'),
  btnHelp: document.getElementById('btn-help'),
  helpMenu: document.getElementById('help-menu'),
  btnGuide: document.getElementById('btn-guide'),
  btnLogFocus: document.getElementById('btn-log-focus'),
  btnTheme: document.getElementById('btn-theme'),
  btnClear: document.getElementById('btn-clear'),
  searchPanel: document.getElementById('search-panel'),
  fileList: document.getElementById('file-list'),
  parseStatus: document.getElementById('parse-status'),
  parseProgress: document.getElementById('parse-progress'),
  statTotal: document.getElementById('stat-total'),
  statFiltered: document.getElementById('stat-filtered'),
  statErrors: document.getElementById('stat-errors'),
  statWarns: document.getElementById('stat-warns'),
  statEcu: document.getElementById('stat-ecu'),
  statSpan: document.getElementById('stat-span'),
  searchInput: document.getElementById('search-input'),
  btnAddSearch: document.getElementById('btn-add-search'),
  searchFullToggle: document.getElementById('search-full-toggle'),
  searchMatchBar: document.getElementById('search-match-bar'),
  searchMatchCount: document.getElementById('search-match-count'),
  btnSearchPrevMatch: document.getElementById('btn-search-prev-match'),
  btnSearchNextMatch: document.getElementById('btn-search-next-match'),
  extraSearchList: document.getElementById('extra-search-list'),
  searchField: document.getElementById('search-field'),
  caseSensitive: document.getElementById('case-sensitive'),
  regexSearch: document.getElementById('regex-search'),
  pageSize: document.getElementById('page-size'),
  btnPrev: document.getElementById('btn-prev'),
  btnNext: document.getElementById('btn-next'),
  pageInfo: document.getElementById('page-info'),
  timeFrom: document.getElementById('time-from'),
  timeTo: document.getElementById('time-to'),
  filterRangePanel: document.getElementById('filter-time-range-panel'),
  filterRangeTitle: document.getElementById('filter-range-title'),
  btnFilterRangeUnit: document.getElementById('btn-filter-range-unit'),
  filterRangeStart: document.getElementById('filter-range-start'),
  filterRangeEnd: document.getElementById('filter-range-end'),
  filterRangeSelection: document.getElementById('filter-range-selection'),
  filterRangeFromLabel: document.getElementById('filter-range-from-label'),
  filterRangeToLabel: document.getElementById('filter-range-to-label'),
  filterRangeLimits: document.getElementById('filter-range-limits'),
  btnFilterRangeClear: document.getElementById('btn-filter-range-clear'),
  btnResetFilter: document.getElementById('btn-reset-filter'),
  btnExportCsv: document.getElementById('btn-export-csv'),
  logHeader: document.querySelector('.log-header'),
  showFullTime: document.getElementById('show-full-time'),
  focusSearchStrip: document.getElementById('focus-search-strip'),
  btnFocusSearch: document.getElementById('btn-focus-search'),
  focusSearchInput: document.getElementById('focus-search-input'),
  btnFocusSearchClose: document.getElementById('btn-focus-search-close'),
  virtualScroll: document.getElementById('virtual-scroll'),
  virtualSpacer: document.getElementById('virtual-spacer'),
  rowsLayer: document.getElementById('rows-layer'),
  logScrollbar: document.getElementById('log-scrollbar'),
  logScrollbarThumb: document.getElementById('log-scrollbar-thumb'),
  minimap: document.getElementById('minimap'),
  detailEmpty: document.getElementById('detail-empty'),
  detailPanel: document.getElementById('detail-panel'),
  btnCheckUpdate: document.getElementById('btn-check-update'),
  updateBar: document.getElementById('update-bar'),
  updateBarMsg: document.getElementById('update-bar-msg'),
  updateBarIcon: document.getElementById('update-bar-icon'),
  btnUpdateDismiss: document.getElementById('btn-update-dismiss'),
  updateModalOverlay: document.getElementById('update-modal-overlay'),
  updateModal: document.getElementById('update-modal'),
  updateModalVersion: document.getElementById('update-modal-version'),
  updatePhaseAsk: document.querySelector('.update-phase-ask'),
  updatePhaseDownloading: document.querySelector('.update-phase-downloading'),
  updatePhaseDone: document.querySelector('.update-phase-done'),
  updatePhaseError: document.querySelector('.update-phase-error'),
  updateDlFill: document.getElementById('update-dl-fill'),
  updateDlPct: document.getElementById('update-dl-pct'),
  updateDlSize: document.getElementById('update-dl-size'),
  updateDlSpeed: document.getElementById('update-dl-speed'),
  updateDonVersion: document.getElementById('update-done-version'),
  updateErrorMsg: document.getElementById('update-error-msg'),
  btnUpdateYes: document.getElementById('btn-update-yes'),
  btnUpdateNo: document.getElementById('btn-update-no'),
  btnUpdateInstall: document.getElementById('btn-update-install'),
  btnUpdateLater: document.getElementById('btn-update-later'),
  btnUpdateErrorClose: document.getElementById('btn-update-error-close')
};

function init() {
  wireHandoffEvents();
  wireEvents();
  initLogColumnResize();
  applyLogColumnTemplate();
  api.onParseEvent(handleParseEvent);
  if (api.onUpdateStatus) {
    api.onUpdateStatus(handleUpdateStatus);
  }
  resetWorkspace();
  initStarsCanvas();
  loadAppVersion();
}

function wireEvents() {
  el.btnOpen.addEventListener('click', openFromDialog);
  el.btnOpenEmpty.addEventListener('click', openFromDialog);
  if (el.btnClear) el.btnClear.addEventListener('click', resetWorkspace);
  if (el.btnTheme) el.btnTheme.addEventListener('click', toggleTheme);
  el.btnLogFocus.addEventListener('click', toggleLogFocus);

  if (el.btnHelp && el.helpMenu) {
    el.btnHelp.addEventListener('click', (e) => {
      e.stopPropagation();
      el.helpMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', () => el.helpMenu.classList.add('hidden'));
    el.helpMenu.addEventListener('click', (e) => e.stopPropagation());
  }

  if (el.btnGuide) el.btnGuide.addEventListener('click', () => { el.helpMenu.classList.add('hidden'); downloadUserGuide(); });

  if (el.btnCheckUpdate) {
    el.btnCheckUpdate.addEventListener('click', () => {
      el.helpMenu.classList.add('hidden');
      if (api.checkUpdate) {
        el.btnCheckUpdate.classList.add('checking');
        api.checkUpdate();
        setTimeout(() => el.btnCheckUpdate.classList.remove('checking'), 8000);
      }
    });
  }
  if (el.btnUpdateDismiss) {
    el.btnUpdateDismiss.addEventListener('click', () => el.updateBar.classList.add('hidden'));
  }
  if (el.btnUpdateYes) {
    el.btnUpdateYes.addEventListener('click', () => {
      showUpdatePhase('downloading');
      if (api.downloadUpdate) api.downloadUpdate();
    });
  }
  if (el.btnUpdateNo) {
    el.btnUpdateNo.addEventListener('click', () => el.updateModalOverlay.classList.add('hidden'));
  }
  if (el.btnUpdateInstall) {
    el.btnUpdateInstall.addEventListener('click', () => {
      if (api.installUpdate) api.installUpdate();
    });
  }
  if (el.btnUpdateErrorClose) {
    el.btnUpdateErrorClose.addEventListener('click', () => el.updateModalOverlay.classList.add('hidden'));
  }

  window.addEventListener('dragenter', handleFileDragEnter);
  window.addEventListener('dragover', handleFileDragOver);
  window.addEventListener('dragleave', handleFileDragLeave);
  window.addEventListener('drop', handleFileDropEnd);
  if (api.onDroppedFiles) {
    api.onDroppedFiles(handleDroppedPaths);
  }

  el.dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.stopPropagation();
    el.dropZone.classList.add('dragover');
  });
  el.dropZone.addEventListener('dragleave', () => {
    if (!state.dropDepth) el.dropZone.classList.remove('dragover');
  });
  el.dropZone.addEventListener('drop', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    el.dropZone.classList.remove('dragover');
    const paths = droppedPathsFromEvent(event);
    await handleDroppedPaths(paths);
  });

  wireSearchInput(el.searchInput, PRIMARY_SEARCH_ID);

  for (const item of [el.timeFrom, el.timeTo].filter(Boolean)) {
    item.addEventListener('input', () => {
      state.currentPage = 1;
      state.levelFilter = null;
      applyFilters();
    });
    item.addEventListener('change', () => {
      state.currentPage = 1;
      applyFilters();
    });
  }
  el.searchFullToggle.addEventListener('change', () => {
    state.currentPage = 1;
    applyFilters();
    jumpToFirstSearchMatch(PRIMARY_SEARCH_ID);
  });
  if (el.btnAddSearch) el.btnAddSearch.addEventListener('click', () => addSearchTerm(true));
  wireSearchNavButton(el.btnSearchPrevMatch, PRIMARY_SEARCH_ID, -1);
  wireSearchNavButton(el.btnSearchNextMatch, PRIMARY_SEARCH_ID, 1);

  if (el.pageSize) {
    el.pageSize.addEventListener('change', () => {
      state.pageSize = 'all';
      state.currentPage = 1;
      renderAll();
    });
  }
  if (el.btnPrev) {
    el.btnPrev.addEventListener('click', () => {
      state.currentPage = Math.max(1, state.currentPage - 1);
      renderAll();
    });
  }
  if (el.btnNext) {
    el.btnNext.addEventListener('click', () => {
      state.currentPage = Math.min(getTotalPages(), state.currentPage + 1);
      renderAll();
    });
  }

  if (el.btnResetFilter) el.btnResetFilter.addEventListener('click', resetFilters);
  el.btnExportCsv.addEventListener('click', () => exportFiltered('csv'));
  el.virtualScroll.addEventListener('scroll', handleVirtualScroll);
  el.rowsLayer.addEventListener('click', handleRowClick);
  el.minimap.addEventListener('click', handleMinimapClick);
  el.btnFocusSearch.addEventListener('click', openFocusSearch);
  el.btnFocusSearchClose.addEventListener('click', closeFocusSearch);
  el.logScrollbar.addEventListener('pointerdown', handleLogScrollbarPointerDown);
  el.focusSearchInput.addEventListener('input', () => {
    el.searchInput.value = el.focusSearchInput.value;
    invalidateSearchCache();
    const previous = state.searchDebounceTimers.get(PRIMARY_SEARCH_ID);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => {
      state.searchDebounceTimers.delete(PRIMARY_SEARCH_ID);
      state.currentPage = 1;
      state.levelFilter = null;
      applyFilters();
      jumpToFirstSearchMatch(PRIMARY_SEARCH_ID);
    }, SEARCH_DEBOUNCE_MS);
    state.searchDebounceTimers.set(PRIMARY_SEARCH_ID, timer);
  });
  el.showFullTime.addEventListener('change', () => {
    state.showFullLogTime = el.showFullTime.checked;
    scheduleVirtualRows();
  });
  el.filterRangeStart.addEventListener('input', (event) => handleFilterRangeInput(event, 'from'));
  el.filterRangeEnd.addEventListener('input', (event) => handleFilterRangeInput(event, 'to'));
  el.btnFilterRangeClear.addEventListener('click', () => resetFilterRange(true));
  el.btnFilterRangeUnit.addEventListener('click', toggleFilterRangeUnit);

  window.addEventListener('resize', () => scheduleRender());
  window.addEventListener('blur', stopSearchNavHold);
  document.addEventListener('keydown', handleKeyboard);
}

function loadTextSetting(key) {
  try {
    return localStorage.getItem(key) || '';
  } catch (_error) {
    return '';
  }
}

function saveTextSetting(key, value) {
  localStorage.setItem(key, String(value || ''));
}

function wireHandoffEvents() {
  el.handoffScope.addEventListener('change', updateHandoffUi);
  el.btnHandoff.addEventListener('click', () => copyAndOpenChatgpt(true));
  el.btnCopyLog.addEventListener('click', () => copyAndOpenChatgpt(false));
  el.handoffUrl.value = loadTextSetting('bltn-handoff-url');
  el.btnHandoffSettings.addEventListener('click', () => {
    const hidden = el.handoffSettings.classList.toggle('hidden');
    el.btnHandoffSettings.setAttribute('aria-expanded', String(!hidden));
    if (!hidden) el.handoffUrl.focus();
  });
  el.btnHandoffUrlSave.addEventListener('click', () => {
    const value = el.handoffUrl.value.trim();
    try {
      if (value && !['https:', 'http:'].includes(new URL(value).protocol)) {
        throw new Error('Use an http:// or https:// link.');
      }
      saveTextSetting('bltn-handoff-url', value);
      el.handoffStatus.textContent = 'Link saved.';
      el.handoffSettings.classList.add('hidden');
      el.btnHandoffSettings.setAttribute('aria-expanded', 'false');
    } catch (error) {
      el.handoffStatus.textContent = `Invalid link: ${error.message}`;
    }
  });
}

function getHandoffIndices() {
  const scope = el.handoffScope.value;
  if (scope === 'all') return null;
  if (scope === 'selection') {
    const index = state.idToIndex.get(state.selectedId);
    return Number.isInteger(index) ? [index] : [];
  }
  if (scope !== 'viewport') return state.filtered;
  const indices = getCurrentPageIndices();
  const metrics = buildVirtualMetrics(indices);
  const top = el.virtualScroll.scrollTop;
  const bottom = top + el.virtualScroll.clientHeight;
  const visible = [];
  for (let index = findRowByOffset(metrics.offsets, top); index < indices.length; index += 1) {
    if (metrics.offsets[index] >= bottom) break;
    if (metrics.offsets[index + 1] > top) visible.push(indices[index]);
  }
  return visible;
}

function updateHandoffUi() {
  const indices = getHandoffIndices();
  const count = indices === null ? state.messages.length : indices.length;
  el.handoffCount.textContent = `${formatNumber(count)} rows selected`;
  el.btnHandoff.disabled = state.handoffBusy || !state.parseDone || !count;
  el.handoffScope.disabled = state.handoffBusy;
  el.btnCopyLog.disabled = el.btnHandoff.disabled;
  el.btnHandoff.textContent = state.handoffBusy ? 'Preparing logs…' : 'Copy & open ChatGPT';
  if (!state.handoffBusy && (!state.parseDone || !count)) {
    el.handoffStatus.textContent = !state.messages.length ? 'Load logs to get started.'
      : !state.parseDone ? 'Wait for log loading to finish.'
        : el.handoffScope.value === 'selection' ? 'Select a log row first.' : 'No rows in this scope.';
  }
}

async function copyAndOpenChatgpt(openBrowser = true) {
  if (state.handoffBusy || !state.parseDone) return;
  const indices = getHandoffIndices();
  const source = state.messages;
  const selected = indices === null ? null : indices.slice();
  const count = selected === null ? source.length : selected.length;
  if (!count) return;
  const generation = state.handoffGeneration;
  const url = loadTextSetting('bltn-handoff-url') || 'https://chatgpt.com/';
  state.handoffBusy = true;
  el.handoffStatus.textContent = 'Preparing full log payloads…';
  updateHandoffUi();
  try {
    const messages = [];
    for (let start = 0; start < count; start += 1000) {
      for (let index = start; index < Math.min(count, start + 1000); index += 1) {
        const message = source[selected === null ? index : selected[index]];
        messages.push({ time: message.time, timeMs: message.timeMs, payload: message.payload });
      }
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (generation !== state.handoffGeneration) return;
    }
    const result = await api.prepareChatgpt({ messages, openBrowser, url });
    if (generation !== state.handoffGeneration) return;
    const status = result.clipboardCopied ? `Copied ${formatNumber(count)} rows. Press Ctrl+V in your chat.` : '';
    el.handoffStatus.textContent = [status, ...result.warnings].filter(Boolean).join('\n');

  } catch (error) {
    if (generation === state.handoffGeneration) el.handoffStatus.textContent = `Could not prepare logs: ${error.message}`;
  } finally {
    state.handoffBusy = false;
    updateHandoffUi();
  }
}

async function openFromDialog() {
  const paths = await api.openLogDialog();
  if (paths.length) {
    await openFiles(paths);
  }
}

function isFileDragEvent(event) {
  return Array.from(event?.dataTransfer?.types || []).includes('Files');
}

function handleFileDragEnter(event) {
  if (!isFileDragEvent(event)) return;
  event.preventDefault();
  state.dropDepth += 1;
  el.dropZone.classList.add('dragover');
}

function handleFileDragOver(event) {
  if (!isFileDragEvent(event)) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  el.dropZone.classList.add('dragover');
}

function handleFileDragLeave(event) {
  if (!isFileDragEvent(event)) return;
  state.dropDepth = Math.max(0, state.dropDepth - 1);
  if (!state.dropDepth) el.dropZone.classList.remove('dragover');
}

async function handleFileDropEnd(event) {
  if (!isFileDragEvent(event)) return;
  event.preventDefault();
  state.dropDepth = 0;
  el.dropZone.classList.remove('dragover');
  const paths = droppedPathsFromEvent(event);
  await handleDroppedPaths(paths);
}

function droppedPathsFromEvent(event) {
  const files = Array.from(event?.dataTransfer?.files || []);
  const itemFiles = Array.from(event?.dataTransfer?.items || [])
    .filter((item) => item.kind === 'file' && typeof item.getAsFile === 'function')
    .map((item) => item.getAsFile())
    .filter(Boolean);
  const allFiles = files.length ? files : itemFiles;

  let paths = [];
  if (api.pathsFromDroppedFiles && event?.dataTransfer?.files) {
    paths = api.pathsFromDroppedFiles(event.dataTransfer.files);
  }
  if (!paths.length && api.pathFromDroppedFile) {
    paths = allFiles.map((file) => api.pathFromDroppedFile(file)).filter(Boolean);
  }
  return paths;
}

async function handleDroppedPaths(paths) {
  const safePaths = Array.from(new Set((paths || []).filter(Boolean)));
  if (!safePaths.length) {
    el.parseStatus.textContent = 'Drop detected, but file paths were empty. Use Open DLT if this was not a local file.';
    return;
  }
  const signature = safePaths.join('\n');
  const now = Date.now();
  if (signature === state.lastDropSignature && now - state.lastDropAt < 1000) {
    return;
  }
  state.lastDropSignature = signature;
  state.lastDropAt = now;
  await openFiles(safePaths);
}

async function openFiles(paths) {
  clearData();
  resetFilters();
  el.dropZone.classList.add('hidden');
  el.workspace.classList.remove('hidden');
  el.parseStatus.textContent = 'Starting parser worker...';
  el.fileList.innerHTML = paths.map((filePath) => `<div class="file-item">${escapeHtml(shortPath(filePath))}</div>`).join('');
  const result = await api.parseLogs(paths);
  if (!result.ok) {
    el.parseStatus.textContent = result.error || 'Could not start the parser.';
  }
}

function toggleLogFocus() {
  el.workspace.classList.toggle('log-focus');
  syncLayoutButtons();
  scheduleRender();
}

function syncLayoutButtons() {
  el.btnLogFocus.classList.toggle('active', el.workspace.classList.contains('log-focus'));
}

function openFocusSearch() {
  el.focusSearchInput.classList.remove('hidden');
  el.btnFocusSearchClose.classList.remove('hidden');
  el.focusSearchInput.value = el.searchInput.value;
  requestAnimationFrame(() => el.focusSearchInput.focus());
}

function closeFocusSearch() {
  el.focusSearchInput.value = '';
  el.searchInput.value = '';
  el.focusSearchInput.classList.add('hidden');
  el.btnFocusSearchClose.classList.add('hidden');
  state.currentPage = 1;
  state.levelFilter = null;
  applyFilters();
}

function focusPrimarySearch() {
  if (el.workspace.classList.contains('log-focus')) {
    openFocusSearch();
    return;
  }
  el.searchInput.focus();
  el.searchInput.select();
}

function handleVirtualScroll() {
  scheduleVirtualRows();
  updateLogScrollbar();
  updateHandoffUi();
}

function handleLogScrollbarPointerDown(event) {
  if (!state.filtered.length) return;
  event.preventDefault();

  const geometry = getLogScrollbarGeometry();
  const thumbHeight = el.logScrollbarThumb.getBoundingClientRect().height || MIN_LOG_SCROLL_THUMB_HEIGHT;
  const scrollable = getLogScrollRange(geometry.trackHeight).scrollable;
  const railScrollable = Math.max(1, geometry.trackHeight - thumbHeight);
  if (!scrollable) return;

  const pointerOffset = event.target === el.logScrollbarThumb
    ? event.clientY - el.logScrollbarThumb.getBoundingClientRect().top
    : thumbHeight / 2;

  const moveTo = (clientY) => {
    const top = clampNumber(clientY - geometry.trackTop - pointerOffset, 0, railScrollable);
    el.virtualScroll.scrollTop = (top / railScrollable) * scrollable;
    scheduleVirtualRows();
    updateLogScrollbar();
  };

  if (event.target !== el.logScrollbarThumb) {
    moveTo(event.clientY);
  }

  const handleMove = (moveEvent) => moveTo(moveEvent.clientY);
  const handleUp = () => {
    window.removeEventListener('pointermove', handleMove);
    window.removeEventListener('pointerup', handleUp);
  };

  window.addEventListener('pointermove', handleMove);
  window.addEventListener('pointerup', handleUp, { once: true });
}

function getLogScrollbarGeometry() {
  const railRect = el.logScrollbar.getBoundingClientRect();
  const scrollRect = el.virtualScroll.getBoundingClientRect();
  const panelRect = el.logScrollbar.closest('.log-panel')?.getBoundingClientRect();
  const trackTop = Math.max(
    railRect.top,
    scrollRect.top,
    panelRect ? panelRect.top : railRect.top
  );
  const trackBottom = Math.min(
    railRect.bottom,
    scrollRect.bottom,
    panelRect ? panelRect.bottom : railRect.bottom
  );
  const trackHeight = Math.max(1, trackBottom - trackTop);
  return {
    railTop: railRect.top,
    trackTop,
    trackHeight,
    trackOffsetTop: Math.max(0, trackTop - railRect.top)
  };
}

function getLogScrollRange(visibleHeight) {
  const pageIndices = getCurrentPageIndices();
  const metrics = buildVirtualMetrics(pageIndices);
  const fallbackHeight = Math.max(1, Number(visibleHeight) || 1);
  const viewportHeight = Math.max(1, el.virtualScroll.clientHeight || fallbackHeight);
  const endPadding = pageIndices.length ? VIRTUAL_SCROLL_END_PADDING : 0;
  const totalHeight = Math.max((metrics.totalHeight || 0) + endPadding, viewportHeight);
  return {
    scrollHeight: totalHeight,
    clientHeight: viewportHeight,
    scrollable: Math.max(0, totalHeight - viewportHeight)
  };
}

function handleParseEvent(event) {
  if (event.type === 'decrypt-start') {
    el.parseProgress.style.width = '0%';
    el.parseStatus.textContent = `Decrypting ${event.fileName}...`;
    return;
  }

  if (event.type === 'decrypt-done') {
    const count = Array.isArray(event.files) ? event.files.length : 0;
    el.parseProgress.style.width = '0%';
    el.parseStatus.textContent = `Decrypted ${event.fileName}. Choose DLT file(s) from ${shortPath(event.outputDir)} (${formatNumber(count)} found).`;
    return;
  }

  if (event.type === 'start') {
    el.parseStatus.textContent = `Parsing ${event.files.length} file(s)...`;
    el.parseProgress.style.width = '0%';
    return;
  }

  if (event.type === 'file-start') {
    state.files[event.fileIndex] = {
      fileName: event.fileName,
      filePath: event.filePath,
      size: event.size,
      messages: 0,
      parseMs: 0
    };
    renderFileList();
    return;
  }

  if (event.type === 'chunk') {
    appendMessages(event.messages || []);
    scheduleParseRender();
    return;
  }

  if (event.type === 'progress') {
    const pct = event.totalBytes ? Math.min(100, Math.round((event.loadedBytes / event.totalBytes) * 100)) : 0;
    el.parseProgress.style.width = `${pct}%`;
    el.parseStatus.textContent = `${event.fileName}: ${pct}% (${formatNumber(event.parsed)} messages)`;
    return;
  }

  if (event.type === 'file-done') {
    state.files[event.fileIndex] = event.summary;
    renderFileList();
    return;
  }

  if (event.type === 'done') {
    state.parseDone = true;
    flushParseRender();
    updateRelativeTimes();
    el.parseProgress.style.width = '100%';
    el.parseStatus.textContent = `Loaded ${formatNumber(event.totalMessages)} messages in ${formatDuration(event.parseMs)}.`;
    applyFilters();
    return;
  }

  if (event.type === 'error') {
    el.parseStatus.textContent = `Parse error: ${event.error}`;
  }
}

function showUpdatePhase(phase) {
  [
    ['ask', el.updatePhaseAsk],
    ['downloading', el.updatePhaseDownloading],
    ['done', el.updatePhaseDone],
    ['error', el.updatePhaseError]
  ].forEach(([key, node]) => node && node.classList.toggle('hidden', key !== phase));
}

function handleUpdateStatus(status) {
  if (!status) return;
  const { state, version, percent, error } = status;

  if (el.btnCheckUpdate) el.btnCheckUpdate.classList.remove('checking');

  if (state === 'checking') {
    if (el.updateBar) {
      el.updateBar.classList.remove('hidden');
      el.updateBar.dataset.state = 'checking';
      if (el.updateBarIcon) el.updateBarIcon.textContent = '↻';
      if (el.updateBarMsg) el.updateBarMsg.textContent = 'Checking for updates...';
    }
    return;
  }

  if (el.updateBar) el.updateBar.classList.add('hidden');

  if (state === 'not-available' || state === 'disabled') {
    el.updateBar.classList.add('hidden');
    if (state === 'disabled') el.parseStatus.textContent = 'Updates are available in the installed version only.';
    return;
  }

  if (state === 'available') {
    if (el.updateModalVersion) {
      el.updateModalVersion.textContent = version ? `New version: v${version}` : 'A new version is available';
    }
    showUpdatePhase('ask');
    if (el.updateModalOverlay) el.updateModalOverlay.classList.remove('hidden');
    return;
  }

  if (state === 'downloading') {
    const pct = Math.round(percent || 0);
    showUpdatePhase('downloading');
    if (el.updateModalOverlay) el.updateModalOverlay.classList.remove('hidden');
    if (el.updateDlFill) el.updateDlFill.style.width = `${pct}%`;
    if (el.updateDlPct) el.updateDlPct.textContent = `${pct}%`;
    if (el.updateDlSize) {
      const xferred = status.transferred || 0;
      const total = status.total || 0;
      el.updateDlSize.textContent = total > 0
        ? `${formatBytes(xferred)} / ${formatBytes(total)}`
        : formatBytes(xferred);
    }
    if (el.updateDlSpeed && status.bytesPerSecond > 0) {
      el.updateDlSpeed.textContent = `${formatBytes(status.bytesPerSecond)}/s`;
    }
    return;
  }

  if (state === 'downloaded') {
    if (el.updateDonVersion) {
      el.updateDonVersion.textContent = version ? `v${version} is ready` : 'Ready to install';
    }
    showUpdatePhase('done');
    if (el.updateModalOverlay) el.updateModalOverlay.classList.remove('hidden');
    return;
  }

  if (state === 'error') {
    const isModalOpen = el.updateModalOverlay && !el.updateModalOverlay.classList.contains('hidden');
    if (isModalOpen) {
      if (el.updateErrorMsg) el.updateErrorMsg.textContent = error || 'Unknown error';
      showUpdatePhase('error');
    } else {
      if (el.updateBar) {
        el.updateBar.classList.remove('hidden');
        el.updateBar.dataset.state = 'error';
        if (el.updateBarIcon) el.updateBarIcon.textContent = '!';
        if (el.updateBarMsg) el.updateBarMsg.textContent = `Update error: ${error || 'unknown'}`;
      }
    }
  }
}

function createEmptyStats() {
  return {
    errors: 0,
    warns: 0,
    ecus: new Set(),
    minId: Infinity,
    maxId: -Infinity
  };
}

function createEmptyRangeBounds() {
  return {
    idMin: Infinity,
    idMax: -Infinity,
    timeMin: Infinity,
    timeMax: -Infinity
  };
}

function createEmptyRangeAxis() {
  return {
    previousClockMs: null,
    dayOffset: 0
  };
}

function appendMessages(messages) {
  if (!Array.isArray(messages) || !messages.length) return;
  const startIndex = state.messages.length;
  const previousFirstTimeMs = state.firstTimeMs;

  for (const message of messages) {
    if (Number.isFinite(message.timeMs)) {
      state.firstTimeMs = state.firstTimeMs === null ? message.timeMs : Math.min(state.firstTimeMs, message.timeMs);
      state.lastTimeMs = state.lastTimeMs === null ? message.timeMs : Math.max(state.lastTimeMs, message.timeMs);
    }
    updateStatsForMessage(message);
    const messageIndex = state.messages.length;
    state.messages.push(message);
    if (Number.isFinite(message.id)) {
      state.idToIndex.set(message.id, messageIndex);
    }
  }

  updateAppendedRangeTimes(startIndex);
  if (previousFirstTimeMs !== state.firstTimeMs && startIndex > 0) {
    updateRelativeOffsets();
  }

  if (!hasActiveFilters()) {
    for (let index = state.filtered.length; index < state.messages.length; index += 1) {
      state.filtered.push(index);
    }
    bumpFilteredVersion();
  } else {
    appendIncrementalFiltered(startIndex);
    bumpFilteredVersion();
    updateSearchMatches();
    state.currentPage = Math.min(state.currentPage, getTotalPages());
  }
}

function appendIncrementalFiltered(startIndex) {
  const matcher = buildTextMatcher();
  const activeRange = getActiveFilterRange();
  const levelFilter = state.levelFilter;
  for (let index = startIndex; index < state.messages.length; index += 1) {
    const message = state.messages[index];
    if (levelFilter && levelFilter.size && !levelFilter.has(message.level)) continue;
    if (activeRange && !messageWithinFilterRange(message, activeRange)) continue;
    if (matcher && !matcher(message)) continue;
    state.filtered.push(index);
  }
}

function updateStatsForMessage(message) {
  if (message.level === 'Error' || message.level === 'Fatal') state.stats.errors += 1;
  else if (message.level === 'Warn') state.stats.warns += 1;
  if (message.ecu) state.stats.ecus.add(message.ecu);

  const id = Number(message.id);
  if (Number.isFinite(id)) {
    state.stats.minId = Math.min(state.stats.minId, id);
    state.stats.maxId = Math.max(state.stats.maxId, id);
    state.rangeBounds.idMin = Math.min(state.rangeBounds.idMin, id);
    state.rangeBounds.idMax = Math.max(state.rangeBounds.idMax, id);
  }
}

function updateAppendedRangeTimes(startIndex) {
  for (let index = startIndex; index < state.messages.length; index += 1) {
    const message = state.messages[index];
    message.relTimeMs = Number.isFinite(message.timeMs) && Number.isFinite(state.firstTimeMs)
      ? message.timeMs - state.firstTimeMs
      : message.id;
    message.rangeTimeMs = getIncrementalRangeTimeMs(message, index);
    updateRangeBoundsForMessage(message);
  }
}

function getIncrementalRangeTimeMs(message, index) {
  const clockMs = parseClockTimeOfDayMs(message.time);
  if (Number.isFinite(clockMs)) {
    let value = clockMs + state.rangeAxis.dayOffset;
    while (state.rangeAxis.previousClockMs !== null && value < state.rangeAxis.previousClockMs) {
      state.rangeAxis.dayOffset += DAY_MS;
      value = clockMs + state.rangeAxis.dayOffset;
    }
    state.rangeAxis.previousClockMs = value;
    return value;
  }
  return index * SYNTHETIC_RANGE_STEP_MS;
}

function updateRangeBoundsForMessage(message) {
  const value = getMessageRangeTimeMs(message);
  if (!Number.isFinite(value)) return;
  state.rangeBounds.timeMin = Math.min(state.rangeBounds.timeMin, value);
  state.rangeBounds.timeMax = Math.max(state.rangeBounds.timeMax, value);
}

function updateRelativeOffsets() {
  for (const message of state.messages) {
    message.relTimeMs = Number.isFinite(message.timeMs) && Number.isFinite(state.firstTimeMs)
      ? message.timeMs - state.firstTimeMs
      : message.id;
  }
}

function updateRelativeTimes() {
  const rangeAxis = buildRangeTimeAxisValues();
  state.rangeBounds = createEmptyRangeBounds();
  state.rangeAxis = createEmptyRangeAxis();
  for (let index = 0; index < state.messages.length; index += 1) {
    const message = state.messages[index];
    message.rangeTimeMs = rangeAxis[index] ?? index * SYNTHETIC_RANGE_STEP_MS;
    message.relTimeMs = Number.isFinite(message.timeMs) && Number.isFinite(state.firstTimeMs)
      ? message.timeMs - state.firstTimeMs
      : message.id;
    const id = Number(message.id);
    if (Number.isFinite(id)) {
      state.rangeBounds.idMin = Math.min(state.rangeBounds.idMin, id);
      state.rangeBounds.idMax = Math.max(state.rangeBounds.idMax, id);
    }
    updateRangeBoundsForMessage(message);
  }
}

function buildRangeTimeAxisValues() {
  const clockAxis = buildClockTimeAxisValues();
  if (hasUsableAxisSpan(clockAxis)) return fillAxisGaps(clockAxis);

  return state.messages.map((_, index) => index * SYNTHETIC_RANGE_STEP_MS);
}

function buildClockTimeAxisValues() {
  let dayOffset = 0;
  let previous = null;
  return state.messages.map((message) => {
    const clockMs = parseClockTimeOfDayMs(message.time);
    if (!Number.isFinite(clockMs)) return NaN;

    let value = clockMs + dayOffset;
    while (previous !== null && value < previous) {
      dayOffset += DAY_MS;
      value = clockMs + dayOffset;
    }
    previous = value;
    return value;
  });
}

function hasUsableAxisSpan(values) {
  let count = 0;
  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    count += 1;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return count >= 2 && max > min;
}

function fillAxisGaps(values) {
  const result = values.slice();
  const finiteIndexes = [];
  for (let index = 0; index < result.length; index += 1) {
    if (Number.isFinite(result[index])) finiteIndexes.push(index);
  }
  if (!finiteIndexes.length) {
    return state.messages.map((_, index) => index * SYNTHETIC_RANGE_STEP_MS);
  }

  const firstIndex = finiteIndexes[0];
  for (let index = firstIndex - 1; index >= 0; index -= 1) {
    result[index] = result[index + 1] - SYNTHETIC_RANGE_STEP_MS;
  }

  for (let finiteIndex = 0; finiteIndex < finiteIndexes.length - 1; finiteIndex += 1) {
    const startIndex = finiteIndexes[finiteIndex];
    const endIndex = finiteIndexes[finiteIndex + 1];
    const startValue = result[startIndex];
    const endValue = result[endIndex];
    const gap = endIndex - startIndex;
    for (let index = startIndex + 1; index < endIndex; index += 1) {
      result[index] = startValue + ((endValue - startValue) * (index - startIndex)) / gap;
    }
  }

  const lastIndex = finiteIndexes[finiteIndexes.length - 1];
  for (let index = lastIndex + 1; index < result.length; index += 1) {
    result[index] = result[index - 1] + SYNTHETIC_RANGE_STEP_MS;
  }

  return result;
}

function applyFilters(render = true) {
  invalidateSearchCache();
  const matcher = buildTextMatcher();
  const activeRange = getActiveFilterRange();
  const levelFilter = state.levelFilter;

  state.filtered = [];
  for (let index = 0; index < state.messages.length; index += 1) {
    const message = state.messages[index];
    if (levelFilter && levelFilter.size && !levelFilter.has(message.level)) continue;
    if (activeRange && !messageWithinFilterRange(message, activeRange)) continue;
    if (matcher && !matcher(message)) continue;
    state.filtered.push(index);
  }

  bumpFilteredVersion();
  updateSearchMatches();
  state.currentPage = Math.min(state.currentPage, getTotalPages());
  if (render) renderAll();
}

function bumpFilteredVersion() {
  state.filteredVersion += 1;
  state.dataVersion += 1;
  state.cachedPagedIndices = null;
}

function buildTextMatcher() {
  if (el.searchFullToggle.checked) {
    return null;
  }
  const matchers = getActiveSearchMatchers();
  if (!matchers.length) return null;
  return (message) => matchers.some((matcher) => matcher(message));
}

function createSearchMatcher(value) {
  const query = String(value || '').trim();
  if (!query) {
    return null;
  }

  const needle = normalizeSearchText(query);
  const compactNeedle = compactSearchText(query);

  return (message) => {
    return buildSearchTargets(message).some((value) => {
      const haystack = normalizeSearchText(value);
      if (needle && haystack.includes(needle)) return true;
      return Boolean(compactNeedle && compactSearchText(value).includes(compactNeedle));
    });
  };
}

function buildSearchTargets(message) {
  return [
    message.id,
    message.messageId,
    message.time,
    formatLogTime(message),
    formatDelta(message.deltaMs),
    message.length,
    message.payload,
    message.payloadAscii
  ].map((value) => String(value ?? '')).filter(Boolean);
}

function getActiveSearchMatchers() {
  return getSearchTerms()
    .map((term) => createSearchMatcher(getSearchTermValue(term)))
    .filter(Boolean);
}

function hasActiveSearchQueries() {
  return getSearchTerms().some((term) => Boolean(getSearchTermValue(term)));
}

function getActiveSearchQueries() {
  ensureSearchCache();
  return state.cachedSearchQueries;
}

function getActiveSearchRegexes() {
  ensureSearchCache();
  return state.cachedSearchRegexes;
}

function ensureSearchCache() {
  if (state.cachedSearchQueries) return;
  const queries = Array.from(new Set(getSearchTerms()
    .map((term) => getSearchTermValue(term))
    .filter(Boolean)));
  state.cachedSearchQueries = queries;
  state.cachedSearchRegexes = queries.map((query) => new RegExp(escapeRegExp(query), 'gi'));
}

function invalidateSearchCache() {
  state.cachedSearchQueries = null;
  state.cachedSearchRegexes = null;
}

function getSearchTerms() {
  const primary = getPrimarySearchTerm();
  return [
    primary,
    ...state.extraSearchTerms
  ].filter(Boolean);
}

function getPrimarySearchTerm() {
  if (!el.searchInput) return null;
  return {
    id: PRIMARY_SEARCH_ID,
    input: el.searchInput,
    matchBar: el.searchMatchBar,
    countEl: el.searchMatchCount,
    prevBtn: el.btnSearchPrevMatch,
    nextBtn: el.btnSearchNextMatch,
    matches: state.searchMatches,
    activeMatch: state.activeSearchMatch
  };
}

function getSearchTermById(searchId) {
  if (searchId === PRIMARY_SEARCH_ID) return getPrimarySearchTerm();
  return state.extraSearchTerms.find((term) => term.id === searchId) || null;
}

function getSearchTermValue(term) {
  return String(term?.input?.value || '').trim();
}

function getSearchTermMatches(term) {
  return term?.id === PRIMARY_SEARCH_ID ? state.searchMatches : (term?.matches || []);
}

function getSearchTermActiveMatch(term) {
  return term?.id === PRIMARY_SEARCH_ID ? state.activeSearchMatch : Number(term?.activeMatch ?? -1);
}

function setSearchTermMatches(term, matches, activeMatch) {
  if (!term) return;
  if (term.id === PRIMARY_SEARCH_ID) {
    state.searchMatches = matches;
    state.activeSearchMatch = activeMatch;
    return;
  }
  term.matches = matches;
  term.activeMatch = activeMatch;
}

function setSearchTermActiveMatch(term, activeMatch) {
  if (!term) return;
  if (term.id === PRIMARY_SEARCH_ID) {
    state.activeSearchMatch = activeMatch;
    return;
  }
  term.activeMatch = activeMatch;
}

const SEARCH_DEBOUNCE_MS = 140;

function wireSearchInput(input, searchId) {
  if (!input) return;
  const runFilter = () => {
    state.currentPage = 1;
    state.levelFilter = null;
    applyFilters();
    jumpToFirstSearchMatch(searchId);
  };
  const debouncedRun = () => {
    invalidateSearchCache();
    const previous = state.searchDebounceTimers.get(searchId);
    if (previous) clearTimeout(previous);
    const timer = setTimeout(() => {
      state.searchDebounceTimers.delete(searchId);
      runFilter();
    }, SEARCH_DEBOUNCE_MS);
    state.searchDebounceTimers.set(searchId, timer);
  };
  input.addEventListener('input', debouncedRun);
  input.addEventListener('change', () => {
    invalidateSearchCache();
    const previous = state.searchDebounceTimers.get(searchId);
    if (previous) {
      clearTimeout(previous);
      state.searchDebounceTimers.delete(searchId);
    }
    runFilter();
  });
}

function addSearchTerm(focus = true) {
  if (!el.extraSearchList) return null;
  const searchId = `extra-${++state.searchTermSeq}`;
  const item = document.createElement('div');
  item.className = 'extra-search-item';
  item.dataset.searchId = searchId;
  item.innerHTML = `
    <div class="search-group keyword-search-row extra-keyword-search-row">
      <input class="input search extra-search-input" placeholder="Search another keyword...">
      <button class="btn small remove-search-btn" type="button" title="Remove this keyword search">x</button>
    </div>
    <div class="search-match-bar">
      <span class="search-match-count">No keyword</span>
      <div class="search-match-actions">
        <button class="btn small search-nav-btn search-prev-match" type="button" title="Previous keyword match">&uarr;</button>
        <button class="btn small search-nav-btn search-next-match" type="button" title="Next keyword match">&darr;</button>
      </div>
    </div>
  `;
  el.extraSearchList.appendChild(item);

  const term = {
    id: searchId,
    wrapper: item,
    input: item.querySelector('.extra-search-input'),
    matchBar: item.querySelector('.search-match-bar'),
    countEl: item.querySelector('.search-match-count'),
    prevBtn: item.querySelector('.search-prev-match'),
    nextBtn: item.querySelector('.search-next-match'),
    removeBtn: item.querySelector('.remove-search-btn'),
    matches: [],
    activeMatch: -1
  };
  state.extraSearchTerms.push(term);
  wireSearchInput(term.input, searchId);
  wireSearchNavButton(term.prevBtn, searchId, -1);
  wireSearchNavButton(term.nextBtn, searchId, 1);
  term.removeBtn.addEventListener('click', () => removeSearchTerm(searchId));
  renderSearchNavigator(searchId);
  if (focus) requestAnimationFrame(() => term.input.focus());
  return term;
}

function removeSearchTerm(searchId) {
  const index = state.extraSearchTerms.findIndex((term) => term.id === searchId);
  if (index < 0) return;
  stopSearchNavHold();
  const [term] = state.extraSearchTerms.splice(index, 1);
  if (term.wrapper) term.wrapper.remove();
  state.currentPage = 1;
  state.levelFilter = null;
  applyFilters();
}

function clearExtraSearchTerms() {
  stopSearchNavHold();
  for (const term of state.extraSearchTerms) {
    if (term.wrapper) term.wrapper.remove();
  }
  state.extraSearchTerms = [];
  state.searchTermSeq = 0;
}

function updateSearchMatches() {
  for (const term of getSearchTerms()) {
    updateSearchTermMatches(term);
  }
}

function updateSearchTermMatches(term) {
  const matcher = createSearchMatcher(getSearchTermValue(term));
  if (!matcher) {
    setSearchTermMatches(term, [], -1);
    return;
  }

  const matches = getSearchTermMatches(term);
  const activeMatch = getSearchTermActiveMatch(term);
  const previousMessageIndex = matches[activeMatch];
  const selectedMessageIndex = state.selectedId !== null && state.idToIndex.has(state.selectedId)
    ? state.idToIndex.get(state.selectedId)
    : -1;
  const nextMatches = [];
  for (const messageIndex of state.filtered) {
    const message = state.messages[messageIndex];
    if (message && matcher(message)) nextMatches.push(messageIndex);
  }

  const selectedPosition = nextMatches.indexOf(selectedMessageIndex);
  if (selectedPosition >= 0) {
    setSearchTermMatches(term, nextMatches, selectedPosition);
    return;
  }

  const previousPosition = nextMatches.indexOf(previousMessageIndex);
  setSearchTermMatches(term, nextMatches, previousPosition >= 0
    ? previousPosition
    : (nextMatches.length ? 0 : -1));
}

function renderSearchNavigator(searchId = null) {
  const terms = searchId ? [getSearchTermById(searchId)].filter(Boolean) : getSearchTerms();
  for (const term of terms) {
    renderSearchTermNavigator(term);
  }
}

function renderSearchTermNavigator(term) {
  if (!term?.countEl) return;
  const query = getSearchTermValue(term);
  const matches = getSearchTermMatches(term);
  const count = matches.length;
  const hasQuery = Boolean(query);
  const hasMatches = hasQuery && count > 0;
  const activeMatch = getSearchTermActiveMatch(term);
  const position = hasMatches ? clampNumber(activeMatch, 0, count - 1) + 1 : 0;

  if (term.matchBar) term.matchBar.classList.toggle('has-matches', hasMatches);
  term.countEl.textContent = !hasQuery
    ? 'No keyword'
    : `${formatNumber(count)} keyword match${count === 1 ? '' : 'es'}${hasMatches ? ` (${formatNumber(position)}/${formatNumber(count)})` : ''}`;
  if (term.prevBtn) term.prevBtn.disabled = !hasMatches;
  if (term.nextBtn) term.nextBtn.disabled = !hasMatches;
}

function jumpToFirstSearchMatch(searchId = PRIMARY_SEARCH_ID) {
  const term = getSearchTermById(searchId);
  if (!term || !getSearchTermValue(term) || !getSearchTermMatches(term).length) {
    renderSearchNavigator(searchId);
    return;
  }
  jumpToSearchMatch(searchId, 0);
}

function moveSearchMatch(searchId, delta) {
  const term = getSearchTermById(searchId);
  const matches = getSearchTermMatches(term);
  if (!term || !matches.length) return;
  const activeMatch = getSearchTermActiveMatch(term);
  const current = activeMatch >= 0 ? activeMatch : (delta < 0 ? 0 : -1);
  jumpToSearchMatch(searchId, current + delta);
}

function wireSearchNavButton(button, searchId, delta) {
  if (!button) return;
  button.addEventListener('click', (event) => {
    if (state.suppressSearchNavClick) {
      state.suppressSearchNavClick = false;
      event.preventDefault();
      return;
    }
    moveSearchMatch(searchId, delta);
  });
  button.addEventListener('pointerdown', (event) => {
    if (button.disabled || (event.button !== undefined && event.button !== 0)) return;
    event.preventDefault();
    if (typeof button.setPointerCapture === 'function' && event.pointerId !== undefined) {
      try {
        button.setPointerCapture(event.pointerId);
      } catch (_error) {
        // Pointer capture is a convenience; navigation still works without it.
      }
    }
    startSearchNavHold(searchId, delta);
  });
  button.addEventListener('pointerup', stopSearchNavHold);
  button.addEventListener('pointercancel', stopSearchNavHold);
  button.addEventListener('lostpointercapture', stopSearchNavHold);
  button.addEventListener('blur', stopSearchNavHold);
}

function startSearchNavHold(searchId, delta) {
  stopSearchNavHold();
  state.suppressSearchNavClick = true;
  moveSearchMatch(searchId, delta);
  state.searchHoldDelayTimer = setTimeout(() => {
    state.searchHoldDelayTimer = null;
    state.searchHoldRepeatTimer = setInterval(() => moveSearchMatch(searchId, delta), SEARCH_HOLD_REPEAT_MS);
  }, SEARCH_HOLD_START_DELAY_MS);
}

function stopSearchNavHold() {
  if (state.searchHoldDelayTimer) {
    clearTimeout(state.searchHoldDelayTimer);
    state.searchHoldDelayTimer = null;
  }
  if (state.searchHoldRepeatTimer) {
    clearInterval(state.searchHoldRepeatTimer);
    state.searchHoldRepeatTimer = null;
  }
  if (state.suppressSearchNavClick) {
    setTimeout(() => {
      state.suppressSearchNavClick = false;
    }, 80);
  }
}

function jumpToSearchMatch(searchId, position) {
  const term = getSearchTermById(searchId);
  const matches = getSearchTermMatches(term);
  const count = matches.length;
  if (!count) {
    renderSearchNavigator(searchId);
    return;
  }
  const index = ((Math.round(position) % count) + count) % count;
  setSearchTermActiveMatch(term, index);
  const message = state.messages[matches[index]];
  if (message) {
    selectMessage(message.id, 'center');
  }
  renderSearchNavigator(searchId);
}

function compactSearchText(value) {
  return normalizeSearchText(value).replace(/[^a-z0-9]+/g, '');
}

function getActiveFilterRange() {
  if (!state.filterRange.dirty) return null;
  const from = Number(state.filterRange.from);
  const to = Number(state.filterRange.to);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return {
    unit: 'id',
    from: Math.min(from, to),
    to: Math.max(from, to)
  };
}

function messageWithinFilterRange(message, range) {
  if (range.unit === 'id') {
    return Number(message.id) >= range.from && Number(message.id) <= range.to;
  }
  const value = getMessageRangeTimeMs(message);
  if (!Number.isFinite(value)) return true;
  return value >= range.from && value <= range.to;
}

function hasActiveFilters() {
  return Boolean(
    hasActiveSearchQueries() ||
    state.filterRange.dirty ||
    (state.levelFilter && state.levelFilter.size)
  );
}

function resetFilters() {
  el.searchInput.value = '';
  if (el.focusSearchInput) el.focusSearchInput.value = '';
  clearExtraSearchTerms();
  el.searchFullToggle.checked = true;
  resetFilterRange(false);
  if (el.caseSensitive) el.caseSensitive.checked = false;
  if (el.regexSearch) el.regexSearch.checked = false;
  if (el.searchField) el.searchField.value = 'payload-time';
  state.levelFilter = null;
  state.searchMatches = [];
  state.activeSearchMatch = -1;
  state.searchTermSeq = 0;
  state.currentPage = 1;
  applyFilters();
}

function scheduleRender() {
  if (state.renderQueued) return;
  state.renderQueued = true;
  requestAnimationFrame(() => {
    state.renderQueued = false;
    renderAll();
  });
}

function scheduleParseRender() {
  if (state.parseDone) {
    scheduleRender();
    return;
  }
  if (state.parseRenderQueued || state.parseRenderTimer) return;

  const elapsed = Date.now() - state.lastParseRenderAt;
  if (elapsed >= PARSE_RENDER_INTERVAL_MS) {
    state.parseRenderQueued = true;
    requestAnimationFrame(() => {
      state.parseRenderQueued = false;
      if (state.parseDone) return;
      state.lastParseRenderAt = Date.now();
      renderParsingView();
    });
    return;
  }

  state.parseRenderTimer = setTimeout(() => {
    state.parseRenderTimer = null;
    scheduleParseRender();
  }, PARSE_RENDER_INTERVAL_MS - elapsed);
}

function flushParseRender() {
  if (state.parseRenderTimer) {
    clearTimeout(state.parseRenderTimer);
    state.parseRenderTimer = null;
  }
  state.parseRenderQueued = false;
}

function renderParsingView() {
  applyLogColumnTemplate();
  renderStats();
  renderPagination();
  renderSearchNavigator();
  renderVirtualRows();
}

function renderAll() {
  applyLogColumnTemplate();
  renderStats();
  renderPagination();
  renderSearchNavigator();
  renderVirtualRows();
  renderMinimap();
  renderDetail(getSelectedMessage());
  syncFilterRangeControls();
  updateHandoffUi();
}

function renderStats() {
  const bounds = getRangeBounds('time');
  const spanMs = bounds ? bounds.max - bounds.min : 0;

  el.statTotal.textContent = formatNumber(state.messages.length);
  el.statFiltered.textContent = formatNumber(state.filtered.length);
  el.statErrors.textContent = formatNumber(state.stats.errors);
  el.statWarns.textContent = formatNumber(state.stats.warns);
  el.statEcu.textContent = formatNumber(state.stats.ecus.size);
  el.statSpan.textContent = spanMs ? formatDuration(spanMs) : '-';
}

function renderPagination() {
  const totalPages = getTotalPages();
  state.currentPage = Math.min(Math.max(1, state.currentPage), totalPages);
  if (!el.pageInfo) return;
  el.pageInfo.textContent = `Page ${state.currentPage}/${totalPages}`;
  if (el.btnPrev) el.btnPrev.disabled = state.currentPage <= 1;
  if (el.btnNext) el.btnNext.disabled = state.currentPage >= totalPages;
}

function renderVirtualRows() {
  const pageIndices = getCurrentPageIndices();
  const count = pageIndices.length;
  const viewportHeight = el.virtualScroll.clientHeight || 1;
  const scrollTop = el.virtualScroll.scrollTop;
  const metrics = buildVirtualMetrics(pageIndices);
  const start = Math.max(0, findRowByOffset(metrics.offsets, scrollTop) - 8);
  const visibleBottom = scrollTop + viewportHeight + 420;
  let end = start;
  while (end < count && metrics.offsets[end] < visibleBottom && end - start < MAX_RENDER_ROWS) {
    end += 1;
  }
  end = Math.min(count, Math.max(end, start + 1));

  el.virtualSpacer.style.height = `${metrics.totalHeight + (count ? VIRTUAL_SCROLL_END_PADDING : 0)}px`;
  el.rowsLayer.style.transform = `translateY(${metrics.offsets[start] || 0}px)`;

  const rows = [];
  for (let localIndex = start; localIndex < end; localIndex += 1) {
    const message = state.messages[pageIndices[localIndex]];
    rows.push(renderRow(message, localIndex, metrics.heights[localIndex]));
  }
  el.rowsLayer.innerHTML = rows.join('');
  state.lastVirtualStart = start;
  state.lastVirtualEnd = end;
  state.lastVirtualCount = count;
  updateLogScrollbar();
  updateHandoffUi();
}

function buildVirtualMetrics(pageIndices) {
  const payloadWidth = getPayloadColumnWidth();
  const cache = state.virtualMetrics;
  const canExtendCache = cache &&
    cache.indices === pageIndices &&
    cache.payloadWidth === payloadWidth &&
    cache.count <= pageIndices.length;

  if (canExtendCache && cache.count === pageIndices.length) {
    return cache;
  }

  const heights = canExtendCache ? cache.heights : new Array(pageIndices.length);
  const offsets = canExtendCache ? cache.offsets : new Array(pageIndices.length + 1);
  const startIndex = canExtendCache ? cache.count : 0;
  heights.length = pageIndices.length;
  offsets.length = pageIndices.length + 1;
  if (!canExtendCache) offsets[0] = 0;

  for (let index = startIndex; index < pageIndices.length; index += 1) {
    const message = state.messages[pageIndices[index]];
    const height = estimateRowHeight(message, payloadWidth);
    heights[index] = height;
    offsets[index + 1] = offsets[index] + height;
  }

  state.virtualMetrics = {
    indices: pageIndices,
    payloadWidth,
    count: pageIndices.length,
    heights,
    offsets,
    totalHeight: offsets[pageIndices.length] || 0
  };
  return state.virtualMetrics;
}

function estimateRowHeight(message, payloadWidth) {
  const payload = String(message?.payload || '');
  if (!payload) return MIN_ROW_HEIGHT;
  const charsPerLine = Math.max(24, Math.floor((payloadWidth - 24) / ESTIMATED_MONO_CHAR_WIDTH));
  let lines = 0;
  let lineLength = 0;
  for (let index = 0; index < payload.length; index += 1) {
    const code = payload.charCodeAt(index);
    if (code === 10 || code === 13) {
      lines += Math.max(1, Math.ceil(lineLength / charsPerLine));
      lineLength = 0;
      if (code === 13 && payload.charCodeAt(index + 1) === 10) index += 1;
    } else {
      lineLength += 1;
    }
  }
  lines += Math.max(1, Math.ceil(lineLength / charsPerLine));
  return Math.max(MIN_ROW_HEIGHT, Math.ceil(lines * ROW_LINE_HEIGHT + ROW_VERTICAL_PADDING));
}

function getPayloadColumnWidth() {
  if (el.virtualScroll && el.virtualScroll.clientWidth > 0) {
    const widths = state.logColumnWidths.map((w, i) => Math.max(MIN_LOG_COLUMNS[i], Number(w) || DEFAULT_LOG_COLUMNS[i]));
    const fixed = widths[0] + widths[1] + widths[2];
    return Math.max(MIN_LOG_COLUMNS[3], el.virtualScroll.clientWidth - fixed);
  }
  return Math.max(MIN_LOG_COLUMNS[3], Number(state.logColumnWidths[3]) || DEFAULT_LOG_COLUMNS[3]);
}

function findRowByOffset(offsets, value) {
  let low = 0;
  let high = Math.max(0, offsets.length - 2);
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (offsets[mid + 1] <= value) {
      low = mid + 1;
    } else if (offsets[mid] > value) {
      high = mid - 1;
    } else {
      return mid;
    }
  }
  return Math.max(0, Math.min(offsets.length - 2, low));
}

function scheduleVirtualRows() {
  if (state.virtualRenderQueued) return;
  state.virtualRenderQueued = true;
  requestAnimationFrame(() => {
    state.virtualRenderQueued = false;
    renderVirtualRows();
  });
}

function renderRow(message, localIndex, rowHeight) {
  const selected = state.selectedId === message.id;
  return `
    <div class="log-row log-grid ${selected ? 'selected' : ''}" data-id="${message.id}" data-local-index="${localIndex}" style="height:${rowHeight}px">
      <div>${highlightSearch(message.id)}</div>
      <div title="${escapeHtml(message.time)}">${highlightSearch(formatLogTime(message))}</div>
      <div>${highlightSearch(formatDelta(message.deltaMs))}</div>
      <div class="payload-cell" title="${escapeHtml(message.payload || '')}">${highlightSearch(message.payload || '')}</div>
    </div>
  `;
}

function updateLogScrollbar() {
  if (!el.logScrollbar || !el.logScrollbarThumb) return;
  const geometry = getLogScrollbarGeometry();
  const railHeight = geometry.trackHeight;
  const { scrollHeight, clientHeight, scrollable } = getLogScrollRange(railHeight);

  if (!scrollable || !state.filtered.length) {
    el.logScrollbar.classList.add('disabled');
    el.logScrollbarThumb.style.height = `${Math.max(MIN_LOG_SCROLL_THUMB_HEIGHT, railHeight)}px`;
    el.logScrollbarThumb.style.transform = `translateY(${geometry.trackOffsetTop}px)`;
    return;
  }

  el.logScrollbar.classList.remove('disabled');
  const thumbHeight = clampNumber((clientHeight / scrollHeight) * railHeight, MIN_LOG_SCROLL_THUMB_HEIGHT, railHeight);
  const safeScrollTop = clampNumber(el.virtualScroll.scrollTop, 0, scrollable);
  const top = geometry.trackOffsetTop + (safeScrollTop / scrollable) * Math.max(0, railHeight - thumbHeight);
  el.logScrollbarThumb.style.height = `${thumbHeight}px`;
  el.logScrollbarThumb.style.transform = `translateY(${top}px)`;
}

function formatLogTime(message) {
  const full = String(message?.time || (Number.isFinite(message?.timeMs) ? formatTimeLabel(message.timeMs) : ''));
  if (state.showFullLogTime) return full || '-';
  const match = full.match(/\b\d{2}:\d{2}:\d{2}(?:\.\d+)?\b/);
  if (match) return match[0];
  if (Number.isFinite(message?.timeMs)) return formatHourMinuteSecond(message.timeMs);
  return full || '-';
}

function initLogColumnResize() {
  if (!el.logHeader) return;
  const cells = Array.from(el.logHeader.children);
  cells.forEach((cell, index) => {
    cell.classList.add('log-header-cell');
    if (index >= cells.length - 1) return;
    const handle = document.createElement('span');
    handle.className = 'log-col-resizer';
    handle.title = 'Drag to resize column';
    handle.addEventListener('pointerdown', (event) => startLogColumnResize(event, index));
    cell.appendChild(handle);
  });
}

function startLogColumnResize(event, columnIndex) {
  event.preventDefault();
  event.stopPropagation();
  const startX = event.clientX;
  const startWidth = state.logColumnWidths[columnIndex] || DEFAULT_LOG_COLUMNS[columnIndex];
  document.body.classList.add('resizing-log-column');

  const handleMove = (moveEvent) => {
    const delta = moveEvent.clientX - startX;
    state.logColumnWidths[columnIndex] = clampNumber(startWidth + delta, MIN_LOG_COLUMNS[columnIndex], 1200);
    saveLogColumnWidths();
    applyLogColumnTemplate();
    state.virtualMetrics = null;
    scheduleVirtualRows();
  };
  const handleUp = () => {
    document.body.classList.remove('resizing-log-column');
    window.removeEventListener('pointermove', handleMove);
    window.removeEventListener('pointerup', handleUp);
  };

  window.addEventListener('pointermove', handleMove);
  window.addEventListener('pointerup', handleUp, { once: true });
}

function applyLogColumnTemplate() {
  const widths = state.logColumnWidths.map((width, index) => Math.max(MIN_LOG_COLUMNS[index], Number(width) || DEFAULT_LOG_COLUMNS[index]));
  const template = `${widths[0]}px ${widths[1]}px ${widths[2]}px minmax(0, 1fr)`;
  document.documentElement.style.setProperty('--log-grid-columns', template);
}

function loadLogColumnWidths() {
  try {
    const parsed = JSON.parse(localStorage.getItem('bltn-log-column-widths') || '[]');
    if (Array.isArray(parsed)) {
      const migrated = parsed.length >= 6
        ? [parsed[1], parsed[2], parsed[3], parsed[4]]
        : parsed.slice(0, DEFAULT_LOG_COLUMNS.length);
      if (migrated.length === DEFAULT_LOG_COLUMNS.length) {
        return migrated.map((value, index) => clampNumber(value, MIN_LOG_COLUMNS[index], 1200));
      }
    }
  } catch (_error) {
    // Ignore invalid saved UI state.
  }
  return DEFAULT_LOG_COLUMNS.slice();
}

function saveLogColumnWidths() {
  try {
    localStorage.setItem('bltn-log-column-widths', JSON.stringify(state.logColumnWidths));
  } catch (_error) {
    // Local storage can be unavailable in restricted contexts.
  }
}

function handleRowClick(event) {
  const row = event.target.closest('.log-row');
  if (!row) return;
  const id = Number(row.dataset.id);
  selectMessage(id, false);
}

function selectMessage(id, ensureVisible) {
  if (!Number.isFinite(id)) return;
  state.selectedId = id;
  const messageIndex = state.idToIndex.has(id) ? state.idToIndex.get(id) : -1;
  syncActiveSearchMatchesToMessage(messageIndex);
  if (ensureVisible) {
    scrollToMessage(id, ensureVisible === 'center' ? 'center' : 'nearest');
  }
  renderVirtualRows();
  renderDetail(getSelectedMessage());
  renderSearchNavigator();
  updateHandoffUi();
}

function syncActiveSearchMatchesToMessage(messageIndex) {
  if (!Number.isFinite(messageIndex) || messageIndex < 0) return;
  for (const term of getSearchTerms()) {
    const matchPosition = getSearchTermMatches(term).indexOf(messageIndex);
    if (matchPosition >= 0) setSearchTermActiveMatch(term, matchPosition);
  }
}

function scrollToMessage(id, align = 'nearest') {
  const pageIndices = getCurrentPageIndices();
  const messageIndex = state.idToIndex.has(id) ? state.idToIndex.get(id) : -1;
  const localIndex = pageIndices.indexOf(messageIndex);
  if (localIndex >= 0) {
    const metrics = buildVirtualMetrics(pageIndices);
    const viewportHeight = el.virtualScroll.clientHeight || 0;
    const currentScroll = el.virtualScroll.scrollTop;
    const rowTop = metrics.offsets[localIndex] || 0;
    const rowBottom = metrics.offsets[localIndex + 1] || rowTop + MIN_ROW_HEIGHT;
    const visibleTop = currentScroll + MIN_ROW_HEIGHT;
    const visibleBottom = currentScroll + viewportHeight - MIN_ROW_HEIGHT;
    const maxScroll = Math.max(0, metrics.totalHeight + VIRTUAL_SCROLL_END_PADDING - viewportHeight);
    if (align === 'center') {
      const rowHeight = Math.max(MIN_ROW_HEIGHT, rowBottom - rowTop);
      const centeredScroll = rowTop + (rowHeight / 2) - (viewportHeight / 2);
      el.virtualScroll.scrollTop = clampNumber(centeredScroll, 0, maxScroll);
      return;
    }
    if (rowTop < visibleTop) {
      el.virtualScroll.scrollTop = clampNumber(rowTop - MIN_ROW_HEIGHT, 0, maxScroll);
    } else if (rowBottom > visibleBottom) {
      el.virtualScroll.scrollTop = clampNumber(rowBottom - viewportHeight + MIN_ROW_HEIGHT, 0, maxScroll);
    }
    return;
  }

  const filteredPosition = state.filtered.indexOf(messageIndex);
  if (filteredPosition >= 0 && state.pageSize !== 'all') {
    state.currentPage = Math.floor(filteredPosition / Number(state.pageSize)) + 1;
    renderPagination();
    const metrics = buildVirtualMetrics(getCurrentPageIndices());
    const localPageIndex = filteredPosition % Number(state.pageSize);
    const rowTop = metrics.offsets[localPageIndex] || 0;
    const rowBottom = metrics.offsets[localPageIndex + 1] || rowTop + MIN_ROW_HEIGHT;
    const viewportHeight = el.virtualScroll.clientHeight || 0;
    const maxScroll = Math.max(0, metrics.totalHeight + VIRTUAL_SCROLL_END_PADDING - viewportHeight);
    if (align === 'center') {
      const rowHeight = Math.max(MIN_ROW_HEIGHT, rowBottom - rowTop);
      el.virtualScroll.scrollTop = clampNumber(rowTop + (rowHeight / 2) - (viewportHeight / 2), 0, maxScroll);
    } else {
      el.virtualScroll.scrollTop = clampNumber(rowTop, 0, maxScroll);
    }
  }
}

function renderMinimap(force = false) {
  const canvas = el.minimap;
  const width = Math.max(1, canvas.clientWidth || 18);
  const height = Math.max(1, canvas.clientHeight || 1);
  const cacheKey = `${state.dataVersion}|${width}x${height}`;
  if (!force && state.lastMinimapKey === cacheKey) return;
  state.lastMinimapKey = cacheKey;

  const ctx = setupCanvas(canvas);
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  ctx.fillRect(0, 0, width, height);

  if (!state.messages.length) return;

  // Aggregate by pixel row so errors remain visible in dense log files.
  const rows = new Uint8Array(height);
  const total = Math.max(1, state.messages.length - 1);
  const messages = state.messages;
  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    let level = 0;
    if (message.level === 'Fatal' || message.level === 'Error') level = 2;
    else if (message.level === 'Warn') level = 1;
    else continue;
    const y = Math.min(height - 1, Math.floor((message.id / total) * height));
    if (level > rows[y]) rows[y] = level;
  }

  const COLORS = ['', '#f7c948', '#ff5c6c'];
  let runStart = -1;
  let runLevel = 0;
  for (let y = 0; y <= height; y += 1) {
    const value = y < height ? rows[y] : 0;
    if (value !== runLevel) {
      if (runLevel && runStart >= 0) {
        ctx.fillStyle = COLORS[runLevel];
        ctx.fillRect(0, runStart, width, Math.max(2, y - runStart));
      }
      runLevel = value;
      runStart = value ? y : -1;
    }
  }
}

function renderDetail(message) {
  if (!message) {
    el.detailEmpty.classList.remove('hidden');
    el.detailPanel.classList.add('hidden');
    return;
  }

  el.detailEmpty.classList.add('hidden');
  el.detailPanel.classList.remove('hidden');
  el.detailPanel.innerHTML = `
    ${kv('File', message.fileName)}
    ${kv('Timestamp', message.time)}
  `;
}

function kv(label, value) {
  return `<div class="detail-kv"><span>${escapeHtml(label)}</span><span>${escapeHtml(String(value ?? ''))}</span></div>`;
}

function renderFileList() {
  el.fileList.innerHTML = state.files.filter(Boolean).map((file) => `
    <div class="file-item">
      <strong>${escapeHtml(file.fileName)}</strong><br>
      ${formatBytes(file.size || 0)} | ${formatNumber(file.messages || 0)} msg | ${file.parser || 'pending'} | ${file.parseMs ? formatDuration(file.parseMs) : ''}
    </div>
  `).join('');
}

async function downloadUserGuide() {
  const guide = await api.getUserGuide();
  if (!guide.ok) {
    el.parseStatus.textContent = guide.error || 'USER_GUIDE_EN.md was not found.';
    return;
  }
  const result = await api.saveExport({
    title: 'Download User Guide',
    defaultPath: guide.fileName || 'USER_GUIDE_EN.md',
    filters: [{ name: 'Markdown', extensions: ['md'] }],
    content: guide.content || ''
  });
  if (result.ok) {
    el.parseStatus.textContent = `Saved guide: ${result.filePath}`;
  }
}

function syncFilterRangeControls() {
  syncRangeControls('filter');
}

function handleFilterRangeInput(_event, edge) {
  state.filterRange.dirty = true;
  let from = Number(el.filterRangeStart.value);
  let to = Number(el.filterRangeEnd.value);
  if (edge === 'from' && from > to) to = from;
  if (edge === 'to' && to < from) from = to;
  setFilterRange(from, to, true);
  state.currentPage = 1;
  applyFilters();
}

function resetFilterRange(render = true) {
  resetRangeToFull('filter');
  if (render) {
    state.currentPage = 1;
    applyFilters();
  }
}

function setFilterRange(from, to, dirty) {
  setRangeValues('filter', from, to, dirty);
}

function toggleFilterRangeUnit() {
  state.filterRange.unit = 'id';
  syncFilterRangeControls();
  state.currentPage = 1;
  applyFilters();
}

function syncRangeControls(kind) {
  const range = getRangeState(kind);
  const controls = getRangeControls(kind);
  if (!range || !controls.start || !controls.end) return;

  range.unit = kind === 'filter' ? 'id' : (range.unit || 'time');
  const bounds = getRangeBounds(range.unit);
  syncRangeModeUi(kind);
  if (!bounds) {
    controls.start.disabled = true;
    controls.end.disabled = true;
    controls.start.value = '0';
    controls.end.value = '0';
    controls.fromLabel.textContent = '-';
    controls.toLabel.textContent = '-';
    controls.selection.style.left = '0%';
    controls.selection.style.width = '0%';
    controls.limits.textContent = 'No logs loaded';
    if (kind === 'filter') {
      el.timeFrom.value = '';
      el.timeTo.value = '';
    }
    return;
  }

  const boundsChanged = range.min !== bounds.min || range.max !== bounds.max;
  range.min = bounds.min;
  range.max = bounds.max;
  if (boundsChanged || !range.dirty || !Number.isFinite(range.from) || !Number.isFinite(range.to)) {
    range.from = bounds.min;
    range.to = bounds.max;
  }

  const step = getRangeStep(range.unit, bounds.max - bounds.min);
  for (const input of [controls.start, controls.end]) {
    input.min = String(bounds.min);
    input.max = String(bounds.max);
    input.step = String(step);
    input.disabled = false;
  }
  normalizeRangeValues(range);
  applyRangeValues(kind);
}

function resetRangeToFull(kind) {
  const range = getRangeState(kind);
  if (!range) return false;
  range.dirty = false;
  range.unit = kind === 'filter' ? 'id' : 'time';
  const bounds = getRangeBounds(range.unit);
  if (!bounds) {
    range.from = null;
    range.to = null;
    applyRangeValues(kind);
    return false;
  }
  setRangeValues(kind, bounds.min, bounds.max, false);
  return true;
}

function setRangeValues(kind, from, to, dirty) {
  const range = getRangeState(kind);
  if (!range || !Number.isFinite(from) || !Number.isFinite(to)) return;
  range.unit = kind === 'filter' ? 'id' : (range.unit || 'time');
  const bounds = getRangeBounds(range.unit) || {
    min: Math.min(from, to),
    max: Math.max(from, to)
  };
  range.min = bounds.min;
  range.max = bounds.max;
  range.from = clampNumber(Math.min(from, to), bounds.min, bounds.max);
  range.to = clampNumber(Math.max(from, to), bounds.min, bounds.max);
  range.dirty = Boolean(dirty);
  normalizeRangeValues(range);
  applyRangeValues(kind);
}

function applyRangeValues(kind) {
  const range = getRangeState(kind);
  const controls = getRangeControls(kind);
  if (!range || !controls.start || !controls.end) return;

  syncRangeModeUi(kind);
  const from = Number.isFinite(range.from) ? range.from : 0;
  const to = Number.isFinite(range.to) ? range.to : from;
  controls.start.value = String(from);
  controls.end.value = String(to);
  controls.fromLabel.textContent = Number.isFinite(range.from) ? formatRangeValue(range.unit, from) : '-';
  controls.toLabel.textContent = Number.isFinite(range.to) ? formatRangeValue(range.unit, to) : '-';

  if (kind === 'filter') {
    el.timeFrom.value = '';
    el.timeTo.value = '';
  }

  if (Number.isFinite(range.min) && Number.isFinite(range.max)) {
    const span = Math.max(1, range.max - range.min);
    const left = ((Math.min(from, to) - range.min) / span) * 100;
    const width = ((Math.max(from, to) - Math.min(from, to)) / span) * 100;
    controls.selection.style.left = `${clampNumber(left, 0, 100)}%`;
    controls.selection.style.width = `${clampNumber(width, 0, 100)}%`;
    controls.limits.textContent = kind === 'filter'
      ? (range.dirty ? `${formatRangeShortValue(range.unit, from)} -> ${formatRangeShortValue(range.unit, to)}` : 'Full log')
      : `${formatRangeShortValue(range.unit, range.min)} -> ${formatRangeShortValue(range.unit, range.max)}`;
  }
}

function normalizeRangeValues(range) {
  if (!range || !Number.isFinite(range.min) || !Number.isFinite(range.max)) return;
  range.from = clampNumber(range.from, range.min, range.max);
  range.to = clampNumber(range.to, range.min, range.max);
  if (range.from > range.to) {
    const tmp = range.from;
    range.from = range.to;
    range.to = tmp;
  }
}

function getRangeState(kind) {
  return state.filterRange;
}

function getRangeControls(kind) {
  if (kind === 'filter') {
    return {
      title: el.filterRangeTitle,
      button: el.btnFilterRangeUnit,
      start: el.filterRangeStart,
      end: el.filterRangeEnd,
      selection: el.filterRangeSelection,
      fromLabel: el.filterRangeFromLabel,
      toLabel: el.filterRangeToLabel,
      limits: el.filterRangeLimits
    };
  }
}

function getRangeBounds(unit) {
  if (!state.messages.length) return null;
  if (unit === 'id') {
    const min = state.rangeBounds.idMin;
    const max = state.rangeBounds.idMax;
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    return { min, max };
  }
  const min = state.rangeBounds.timeMin;
  let max = state.rangeBounds.timeMax;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (max <= min) max = min + SYNTHETIC_RANGE_STEP_MS;
  return { min, max };
}

function syncRangeModeUi(kind) {
  const range = getRangeState(kind);
  const controls = getRangeControls(kind);
  if (!range || !controls.title || !controls.button) return;
  if (kind === 'filter') {
    range.unit = 'id';
    controls.title.textContent = 'ID Range';
    controls.button.textContent = '';
    controls.button.disabled = true;
    controls.button.classList.add('hidden');
    controls.button.classList.remove('active');
    return;
  }
}

function formatRangeValue(unit, value) {
  if (!Number.isFinite(value)) return '-';
  return unit === 'id' ? formatRangeIdLabel(value, true) : formatRangeClockLabel(value, true);
}

function formatRangeShortValue(unit, value) {
  if (!Number.isFinite(value)) return '-';
  return unit === 'id' ? formatRangeIdLabel(value, false) : formatRangeClockLabel(value, false);
}

function getRangeStep(unit, span) {
  if (unit === 'id') return 1;
  return getTimeRangeStep(span);
}

function getTimeRangeStep(spanMs) {
  if (spanMs > 24 * 60 * 60 * 1000) return 60 * 1000;
  if (spanMs > 60 * 60 * 1000) return 1000;
  if (spanMs > 60 * 1000) return 100;
  return 1;
}

function normalizeSearchText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

async function exportFiltered(kind) {
  const messages = state.filtered.map((index) => state.messages[index]);
  const content = kind === 'csv' ? toCsv(messages) : JSON.stringify(messages, null, 2);
  const result = await api.saveExport({
    title: `Export ${kind.toUpperCase()}`,
    defaultPath: `dlt-filtered.${kind}`,
    filters: [{ name: kind.toUpperCase(), extensions: [kind] }],
    content
  });
  if (result.ok) {
    el.parseStatus.textContent = `Exported ${formatNumber(messages.length)} rows to ${result.filePath}`;
  }
}

function toCsv(messages) {
  const columns = ['id', 'time', 'deltaMs', 'level', 'type', 'ecu', 'apid', 'ctid', 'messageId', 'payload', 'length', 'fileName'];
  const rows = [columns.join(',')];
  for (const message of messages) {
    rows.push(columns.map((column) => csvCell(message[column])).join(','));
  }
  return rows.join('\n');
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function handleMinimapClick(event) {
  const rect = el.minimap.getBoundingClientRect();
  const ratio = (event.clientY - rect.top) / rect.height;
  const targetIndex = Math.min(state.filtered.length - 1, Math.max(0, Math.floor(ratio * state.filtered.length)));
  const message = state.messages[state.filtered[targetIndex]];
  if (message) selectMessage(message.id, true);
}

function handleKeyboard(event) {
  const tag = document.activeElement?.tagName;
  const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  const isCommandKey = event.ctrlKey || event.metaKey;
  const key = String(event.key || '').toLowerCase();
  if (isCommandKey && !event.altKey) {
    if (key === 'o') {
      event.preventDefault();
      void openFromDialog();
      return;
    }
    if (key === 'f') {
      event.preventDefault();
      focusPrimarySearch();
      return;
    }
    if (!isTyping && key === 'l') {
      event.preventDefault();
      toggleLogFocus();
      return;
    }
  }
  if (!isTyping && key === 'f') {
    event.preventDefault();
    focusPrimarySearch();
    return;
  }
  if (isTyping) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveSelection(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveSelection(-1);
  }
}

function moveSelection(delta) {
  const currentMessageIndex = state.selectedId !== null && state.idToIndex.has(state.selectedId)
    ? state.idToIndex.get(state.selectedId)
    : -1;
  const filteredPos = state.filtered.indexOf(currentMessageIndex);
  const nextPos = Math.min(state.filtered.length - 1, Math.max(0, filteredPos + delta));
  const message = state.messages[state.filtered[nextPos]];
  if (message) selectMessage(message.id, true);
}

function getCurrentPageIndices() {
  if (state.pageSize === 'all') {
    return state.filtered;
  }
  const size = Number(state.pageSize);
  const key = `${state.filteredVersion}|${state.currentPage}|${size}`;
  if (state.cachedPagedIndices && state.cachedPagedKey === key) {
    return state.cachedPagedIndices;
  }
  const start = (state.currentPage - 1) * size;
  state.cachedPagedIndices = state.filtered.slice(start, start + size);
  state.cachedPagedKey = key;
  return state.cachedPagedIndices;
}

function getTotalPages() {
  if (state.pageSize === 'all') return 1;
  return Math.max(1, Math.ceil(state.filtered.length / Number(state.pageSize)));
}

function getSelectedMessage() {
  if (state.selectedId === null) return null;
  const index = state.idToIndex.get(state.selectedId);
  if (index !== undefined) return state.messages[index] || null;
  return null;
}

function resetWorkspace() {
  clearData();
  resetFilters();
  el.workspace.classList.add('hidden');
  el.workspace.classList.remove('hide-left', 'hide-right', 'log-focus');
  syncLayoutButtons();
  el.dropZone.classList.remove('hidden');
  el.parseStatus.textContent = 'Idle';
  el.parseProgress.style.width = '0%';
}

function clearData() {
  state.handoffGeneration += 1;
  el.handoffStatus.textContent = 'Load logs to get started.';
  flushParseRender();
  state.messages = [];
  state.filtered = [];
  state.files = [];
  state.idToIndex.clear();
  bumpFilteredVersion();
  invalidateSearchCache();
  state.stats = createEmptyStats();
  state.rangeBounds = createEmptyRangeBounds();
  state.rangeAxis = createEmptyRangeAxis();
  state.selectedId = null;
  state.firstTimeMs = null;
  state.lastTimeMs = null;
  state.currentPage = 1;
  state.levelFilter = null;
  state.parseDone = false;
  clearExtraSearchTerms();
  state.searchMatches = [];
  state.activeSearchMatch = -1;
  state.searchTermSeq = 0;
  state.lastParseRenderAt = 0;
  state.filterRange = {
    unit: 'id',
    min: null,
    max: null,
    from: null,
    to: null,
    dirty: false
  };
  el.fileList.innerHTML = '';
  el.virtualScroll.scrollTop = 0;
  state.virtualMetrics = null;
  renderAll();
}

function toggleTheme() {
  const light = el.app.classList.toggle('theme-light');
  if (el.btnTheme) el.btnTheme.textContent = light ? 'Dark' : 'Light';
  scheduleRender();
}

function setupCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, canvas.clientWidth);
  const height = Math.max(1, canvas.clientHeight);
  if (canvas.width !== Math.floor(width * ratio) || canvas.height !== Math.floor(height * ratio)) {
    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

function highlightSearch(value) {
  const text = value == null ? '' : String(value);
  if (!text) return '';
  const queries = getActiveSearchQueries();
  if (!queries.length) return escapeHtml(text);

  const regexes = getActiveSearchRegexes();
  const ranges = [];
  let hasCompactOnlyMatch = false;
  let compactText = null;
  for (let qi = 0; qi < queries.length; qi += 1) {
    const exactRegex = regexes[qi];
    exactRegex.lastIndex = 0;
    let hasExactMatch = false;
    let match;
    while ((match = exactRegex.exec(text)) !== null) {
      hasExactMatch = true;
      ranges.push([match.index, match.index + match[0].length]);
      if (match[0].length === 0) exactRegex.lastIndex += 1;
    }
    if (!hasExactMatch) {
      const compactNeedle = compactSearchText(queries[qi]);
      if (compactNeedle) {
        if (compactText === null) compactText = compactSearchText(text);
        if (compactText.includes(compactNeedle)) {
          hasCompactOnlyMatch = true;
        }
      }
    }
  }

  if (hasCompactOnlyMatch) {
    return `<mark>${escapeHtml(text)}</mark>`;
  }

  if (!ranges.length) return escapeHtml(text);
  return renderHighlightedRanges(text, ranges);
}

function renderHighlightedRanges(text, ranges) {
  const merged = ranges
    .filter(([start, end]) => end > start)
    .sort((a, b) => a[0] - b[0])
    .reduce((result, range) => {
      const previous = result[result.length - 1];
      if (previous && range[0] <= previous[1]) {
        previous[1] = Math.max(previous[1], range[1]);
      } else {
        result.push(range.slice());
      }
      return result;
    }, []);

  let html = '';
  let cursor = 0;
  for (const [start, end] of merged) {
    html += escapeHtml(text.slice(cursor, start));
    html += `<mark>${escapeHtml(text.slice(start, end))}</mark>`;
    cursor = end;
  }
  html += escapeHtml(text.slice(cursor));
  return html;
}

const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};
const HTML_ESCAPE_REGEX = /[&<>"']/g;

function escapeHtml(value) {
  const text = value == null ? '' : String(value);
  if (!text) return '';
  return text.replace(HTML_ESCAPE_REGEX, (ch) => HTML_ESCAPE_MAP[ch]);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString();
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value > 1024 * 1024 * 1024) return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
  if (value > 1024 * 1024) return `${(value / 1024 / 1024).toFixed(2)} MB`;
  if (value > 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function formatDuration(ms) {
  const value = Math.abs(Number(ms || 0));
  if (value >= 60000) return `${(value / 60000).toFixed(1)} min`;
  if (value >= 1000) return `${(value / 1000).toFixed(2)} s`;
  return `${value.toFixed(0)} ms`;
}

function formatDelta(ms) {
  if (!Number.isFinite(ms)) return '-';
  return `${formatTrimmedNumber(ms, 3)}ms`;
}

function formatTrimmedNumber(value, decimals) {
  const fixed = Number(value).toFixed(decimals);
  return fixed.replace(/\.?0+$/, '');
}

function formatTimeLabel(ms) {
  if (!Number.isFinite(ms)) return '-';
  const date = new Date(ms);
  return date.toISOString().replace('T', ' ').replace('Z', '');
}

function formatMinuteTick(ms) {
  if (!Number.isFinite(ms)) return '-';
  const date = new Date(ms);
  return date.toISOString().slice(11, 16);
}

function formatHourMinuteSecond(ms) {
  if (!Number.isFinite(ms)) return '-';
  return new Date(ms).toISOString().slice(11, 19);
}

function formatRangeIdLabel(value, includeSeconds) {
  const id = Math.round(value);
  const message = state.messages.find((item) => Number(item.id) === id);
  const time = message ? formatRangeClockLabel(getMessageRangeTimeMs(message), includeSeconds) : '';
  return time ? `#${id} ${time}` : `#${id}`;
}

function formatRangeClockLabel(ms, includeSeconds = true) {
  if (!Number.isFinite(ms)) return '-';
  const value = ((Math.floor(ms) % DAY_MS) + DAY_MS) % DAY_MS;
  const day = Math.floor(Math.max(0, Math.floor(ms)) / DAY_MS) + 1;
  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = includeSeconds
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  return `D${day} ${clock}`;
}

function parseClockTimeOfDayMs(value) {
  const raw = String(value || '');
  const match = raw.match(/\b(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?\b/);
  if (!match) return NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (hours > 23 || minutes > 59 || seconds > 59) return NaN;
  const fraction = String(match[4] || '').padEnd(3, '0').slice(0, 3);
  const millis = Number(fraction || 0);
  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
}

function getMessageRangeTimeMs(message) {
  if (Number.isFinite(message?.rangeTimeMs)) return message.rangeTimeMs;
  if (Number.isFinite(message?.timeMs)) return message.timeMs;
  return NaN;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, Number(value)));
}

function shortPath(filePath) {
  return String(filePath || '').split(/[\\/]/).slice(-2).join('\\');
}

function formatBytes(bytes) {
  if (!bytes || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadAppVersion() {
  if (!el.brandVersion || !api.getAppVersion) return;
  try {
    const version = await api.getAppVersion();
    if (version) el.brandVersion.textContent = `v${version}`;
  } catch (_e) {
    // keep static fallback from HTML
  }
}

function initStarsCanvas() {
  const canvas = el.starsCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0;
  let bgStars = [];
  let fallingStars = [];
  const shootingStars = [];
  let rafId = null;
  let lastTime = 0;
  let lastDrawTime = 0;
  let shootingTimer = 0;
  let nextShootingIn = randomShootingInterval();

  function randomShootingInterval() { return 2500 + Math.random() * 4500; }

  function randomColor() {
    const r = Math.random();
    if (r < 0.60) return 'rgba(255,255,255,';
    if (r < 0.75) return 'rgba(180,230,255,';
    if (r < 0.88) return 'rgba(57,217,138,';
    return 'rgba(0,184,169,';
  }

  function buildBgStars(n) {
    return Array.from({ length: n }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.4 + 0.3,
      base: Math.random() * 0.6 + 0.2,
      phase: Math.random() * Math.PI * 2,
      freq: Math.random() * 0.02 + 0.005,
      color: randomColor()
    }));
  }

  function newFallingStar() {
    return {
      x: Math.random() * W,
      y: -20 - Math.random() * 80,
      vx: (Math.random() - 0.5) * 0.4,
      vy: Math.random() * 1.2 + 0.5,
      r: Math.random() * 1.5 + 0.8,
      tail: Math.random() * 35 + 15,
      opacity: Math.random() * 0.5 + 0.4,
      color: randomColor()
    };
  }

  function buildFallingStars(n) {
    return Array.from({ length: n }, () => {
      const s = newFallingStar(); s.y = Math.random() * H; return s;
    });
  }

  function spawnShootingStar() {
    const angle = (10 + Math.random() * 25) * (Math.PI / 180);
    const speed = 12 + Math.random() * 14;
    return {
      x: Math.random() * W * 0.7,
      y: Math.random() * H * 0.5,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      length: 160 + Math.random() * 200,
      opacity: 1,
      w: 1.5 + Math.random() * 2
    };
  }

  function drawBgStars(dt) {
    for (const s of bgStars) {
      s.phase += s.freq * dt * 0.06;
      const a = s.base * (0.5 + 0.5 * Math.sin(s.phase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.color + a + ')';
      ctx.fill();
    }
  }

  function drawFallingStars(dt) {
    for (let i = 0; i < fallingStars.length; i++) {
      const s = fallingStars[i];
      s.x += s.vx * dt * 0.06;
      s.y += s.vy * dt * 0.06;
      if (s.y > H + 30) { fallingStars[i] = newFallingStar(); continue; }
      const grad = ctx.createLinearGradient(s.x, s.y - s.tail, s.x, s.y);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(1, s.color + s.opacity + ')');
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - s.tail);
      ctx.lineTo(s.x, s.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = s.r;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.color + Math.min(1, s.opacity + 0.2) + ')';
      ctx.fill();
    }
  }

  function drawShootingStars(dt) {
    for (let i = shootingStars.length - 1; i >= 0; i--) {
      const s = shootingStars[i];
      s.x += s.vx * dt * 0.06;
      s.y += s.vy * dt * 0.06;
      s.opacity -= 0.008 * dt * 0.06;
      if (s.opacity <= 0 || s.x > W + 200 || s.y > H + 200) {
        shootingStars.splice(i, 1); continue;
      }
      const mag = Math.hypot(s.vx, s.vy);
      const tx = s.x - (s.vx / mag) * s.length;
      const ty = s.y - (s.vy / mag) * s.length;
      const grad = ctx.createLinearGradient(tx, ty, s.x, s.y);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(1, `rgba(255,255,255,${s.opacity})`);
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(s.x, s.y);
      ctx.strokeStyle = grad;
      ctx.lineWidth = s.w;
      ctx.stroke();
    }
  }

  function frame(timestamp) {
    rafId = requestAnimationFrame(frame);
    if (timestamp - lastDrawTime < STAR_ANIMATION_FRAME_MS) return;
    lastDrawTime = timestamp;
    const dt = Math.min(timestamp - lastTime, 50);
    lastTime = timestamp;
    ctx.clearRect(0, 0, W, H);
    drawBgStars(dt);
    drawFallingStars(dt);
    shootingTimer += dt;
    if (shootingTimer >= nextShootingIn) {
      shootingTimer = 0;
      nextShootingIn = randomShootingInterval();
      shootingStars.push(spawnShootingStar());
    }
    drawShootingStars(dt);
    ctx.globalAlpha = 1;
  }

  function resize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    W = canvas.width = parent.offsetWidth;
    H = canvas.height = parent.offsetHeight;
    bgStars = buildBgStars(BG_STAR_COUNT);
    fallingStars = buildFallingStars(FALLING_STAR_COUNT);
  }

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement);
  rafId = requestAnimationFrame((ts) => { lastTime = ts; frame(ts); });

  const mo = new MutationObserver(() => {
    const hidden = el.dropZone.classList.contains('hidden');
    if (hidden && rafId) { cancelAnimationFrame(rafId); rafId = null; }
    else if (!hidden && !rafId) { rafId = requestAnimationFrame((ts) => { lastTime = ts; frame(ts); }); }
  });
  mo.observe(el.dropZone, { attributes: true, attributeFilter: ['class'] });
}

init();
