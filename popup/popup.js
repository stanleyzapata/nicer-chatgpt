(async function startPopup(root) {
  const TS = root.ChatGPTTimestamps;
  const store = TS.storage.fromChrome();
  const elements = Object.fromEntries(['enabled','includeInPrompts','displayZoneMode','customZone','customZoneRow','format','preview','status','zoneDetail','notice','exportMarkdown','exportJson','copyDiagnostics'].map((id) => [id, document.getElementById(id)]));
  let settings = await store.getSettings();
  let activeTab;
  let lastStatus;

  function effectiveZone(original) { return TS.time.resolveZone(settings, original, TS.time.browserZone()); }
  function renderPreview() {
    const zone = effectiveZone(settings.displayZoneMode === 'original' ? TS.time.browserZone() : null);
    elements.preview.textContent = `Received · ${TS.time.format(Date.now(), { format: settings.format, zone })}`;
    elements.zoneDetail.textContent = settings.displayZoneMode === 'current' ? 'Shows every message in your current timezone and updates when your device timezone changes.' : settings.displayZoneMode === 'original' ? 'Shows each message in the timezone that was used when it was sent or received.' : settings.displayZoneMode === 'utc' ? 'Uses Coordinated Universal Time for every timestamp.' : (settings.customZone ? `Uses ${settings.customZone} for every timestamp.` : 'Choose one timezone for every timestamp.');
    elements.customZoneRow.hidden = settings.displayZoneMode !== 'custom';
  }

  function renderSettings() {
    elements.enabled.checked = settings.enabled;
    elements.includeInPrompts.checked = settings.includeInPrompts;
    elements.displayZoneMode.value = settings.displayZoneMode;
    elements.customZone.value = settings.customZone;
    elements.format.value = settings.format;
    renderPreview();
  }

  async function save(patch) { settings = await store.setSettings(patch); renderSettings(); await refreshStatus(); }
  elements.enabled.addEventListener('change', () => save({ enabled: elements.enabled.checked }));
  elements.includeInPrompts.addEventListener('change', () => save({ includeInPrompts: elements.includeInPrompts.checked }));
  elements.displayZoneMode.addEventListener('change', () => save({ displayZoneMode: elements.displayZoneMode.value }));
  elements.customZone.addEventListener('change', () => { if (TS.time.isValidZone(elements.customZone.value)) save({ customZone: elements.customZone.value }); else { elements.notice.textContent = 'Choose a valid timezone.'; elements.customZone.focus(); } });
  elements.format.addEventListener('change', () => save({ format: elements.format.value }));

  for (const zone of TS.time.supportedZones()) { const option = document.createElement('option'); option.value = zone; document.getElementById('timezones').append(option); }

  async function send(message) {
    if (!activeTab?.id) throw new Error('Open a ChatGPT conversation first.');
    return chrome.tabs.sendMessage(activeTab.id, message);
  }

  async function refreshStatus() {
    try {
      const status = await send({ type: 'cgpt-ts-status' });
      lastStatus = status;
      elements.status.className = `status ${status.state}`;
      elements.status.textContent = status.detail;
      elements.exportMarkdown.disabled = status.state === 'attention';
      elements.exportJson.disabled = status.state === 'attention';
      elements.copyDiagnostics.hidden = status.state !== 'attention';
    } catch (_) {
      lastStatus = { state: 'attention', diagnostics: { missing: ['supported-chatgpt-page'] } };
      elements.status.className = 'status attention';
      elements.status.textContent = 'Open a ChatGPT conversation to use timestamps.';
      elements.exportMarkdown.disabled = true;
      elements.exportJson.disabled = true;
      elements.copyDiagnostics.hidden = false;
    }
  }

  elements.copyDiagnostics.addEventListener('click', async () => {
    const route = (() => {
      try {
        const path = new URL(activeTab?.url || '').pathname;
        if (/^\/c\//.test(path)) return 'conversation';
        if (/^\/g\//.test(path)) return 'custom-gpt';
        return path === '/' ? 'home' : 'other-chatgpt-route';
      } catch (_) { return 'unknown'; }
    })();
    const diagnostics = {
      extensionVersion: chrome.runtime.getManifest().version,
      browser: navigator.userAgent,
      route,
      missingCapabilities: lastStatus?.diagnostics?.missing || []
    };
    await navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
    elements.notice.textContent = 'Diagnostics copied. No conversation text was included.';
  });

  async function exportConversation(kind) {
    try {
      elements.notice.textContent = 'Preparing export…';
      const snapshot = await send({ type: 'cgpt-ts-snapshot' });
      const zone = effectiveZone(null);
      const exportSettings = { ...settings, zone };
      if (kind === 'md') TS.exporter.download(TS.exporter.toMarkdown(snapshot, exportSettings), TS.exporter.filename(snapshot.title, 'md'), 'text/markdown');
      else TS.exporter.download(TS.exporter.toJson(snapshot, exportSettings), TS.exporter.filename(snapshot.title, 'json'), 'application/json');
      elements.notice.textContent = 'Export downloaded.';
    } catch (error) { elements.notice.textContent = error.message || 'Export could not be created.'; }
  }
  elements.exportMarkdown.addEventListener('click', () => exportConversation('md'));
  elements.exportJson.addEventListener('click', () => exportConversation('json'));

  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  renderSettings();
  await refreshStatus();
  setInterval(renderPreview, 1000);
})(globalThis);
