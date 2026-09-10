(function startExtension(root) {
  const TS = root.ChatGPTTimestamps;
  if (!TS || !root.chrome?.storage) return;

  const store = TS.storage.fromChrome();
  const adapter = TS.adapter.create(document, location);
  const presenter = TS.presenter.create(document);
  const pendingSent = [];
  const known = new Set();
  const finishTimers = new Map();
  const assistantText = new Map();
  let initialized = false;
  let stopRequested = false;
  let currentConversation = adapter.conversationId();
  let processing = false;
  let rerunRequested = false;
  let settings;

  const detectedZone = () => TS.time.browserZone();
  let lastBrowserZone = detectedZone();
  const getSettings = async () => settings || (settings = await store.getSettings());
  const controller = TS.submission.createController({
    adapter, presenter, clock: () => Date.now(), getSettings, detectedZone,
    onStamped: (record) => pendingSent.push(record)
  });

  function stopEvent(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    const field = adapter.submissionField(event.target);
    if (!field) return;
    stopEvent(event);
    controller.submit({ field });
  }, true);

  document.addEventListener('click', (event) => {
    if (adapter.isStopControl(event.target)) stopRequested = true;
    if (!adapter.isSendControl(event.target)) return;
    if (controller.consumeBypass()) return;
    stopEvent(event);
    controller.submit({ field: adapter.submissionField(event.target), sendControl: event.target });
  }, true);

  function displayData(record, role, parsed) {
    const browserZone = detectedZone();
    const originalZone = record?.captureZone || record?.finishedZone || record?.startedZone || parsed?.zone || browserZone;
    const zoneFor = (capturedZone) => TS.time.resolveZone(settings, capturedZone || originalZone, browserZone);
    const zone = zoneFor(originalZone);
    const startedZone = zoneFor(record?.startedZone);
    const finishedZone = zoneFor(record?.finishedZone);
    const epoch = role === 'user' ? record?.sentAt : (record?.finishedAt || record?.createdAt);
    const label = role === 'user' ? 'Sent' : (record?.terminalKind === 'stopped' ? 'Stopped' : record?.terminalKind === 'failed' ? 'Failed' : record?.createdAt && !record?.finishedAt ? 'Created' : 'Received');
    return {
      role, label,
      display: Number.isFinite(epoch) ? TS.time.format(epoch, { format: settings.format, zone }) : parsed?.display,
      iso: Number.isFinite(epoch) ? TS.time.toIso(epoch, zone) : null,
      originalZone,
      source: record?.source === 'historical' ? 'ChatGPT metadata' : record?.source === 'marker' ? 'Embedded prompt marker' : 'Captured locally',
      startedDisplay: Number.isFinite(record?.startedAt) ? TS.time.format(record.startedAt, { format: settings.format, zone: startedZone }) : null,
      finishedDisplay: Number.isFinite(record?.finishedAt) ? TS.time.format(record.finishedAt, { format: settings.format, zone: finishedZone }) : null,
      startedZone: record?.startedZone || null,
      finishedZone: record?.finishedZone || null,
      durationMs: TS.messages.duration(record),
      marker: parsed?.marker
    };
  }

  async function processMessage(message, isInitial = false) {
    const id = adapter.messageId(message);
    const role = adapter.messageRole(message);
    if (!id || !['user', 'assistant'].includes(role)) return;
    const conversationId = adapter.conversationId();
    let record = await store.getMessageRecord(conversationId, id);
    if (role === 'user') {
      const parsed = TS.marker.parse(adapter.messageText(message, { includeMarker: true }));
      if (!record && parsed) {
        const pendingIndex = pendingSent.findIndex((item) => item.marker === parsed.marker);
        if (pendingIndex >= 0) {
          const pending = pendingSent.splice(pendingIndex, 1)[0];
          record = await store.mergeMessageRecord(conversationId, id, { sentAt: pending.epochMs, captureZone: pending.captureZone, source: 'local' });
        } else record = { captureZone: parsed.zone, source: 'marker' };
      }
      if (parsed) {
        presenter.hideSourceMarker(message, parsed.marker);
        if (settings.enabled) presenter.render(message, displayData(record, role, parsed));
        else presenter.remove(message);
      }
      return;
    }

    if (record?.finishedAt || record?.createdAt) {
      if (settings.enabled) presenter.render(message, displayData(record, role));
      else presenter.remove(message);
      return;
    }
    if (isInitial) {
      const createdAt = adapter.historicalCreatedAt(message);
      if (createdAt) {
        record = await store.mergeMessageRecord(conversationId, id, { createdAt, captureZone: detectedZone(), source: 'historical' });
        if (settings.enabled) presenter.render(message, displayData(record, role));
      }
      return;
    }
    const latestText = adapter.messageText(message);
    const contentChanged = assistantText.get(id) !== latestText;
    assistantText.set(id, latestText);
    if (!record?.startedAt) record = await store.mergeMessageRecord(conversationId, id, { startedAt: Date.now(), startedZone: detectedZone(), source: 'local' });
    if (adapter.generationActive()) {
      const timer = finishTimers.get(id); if (timer) clearTimeout(timer);
      finishTimers.delete(id);
      return;
    }
    if (finishTimers.has(id) && !contentChanged) return;
    if (finishTimers.has(id)) clearTimeout(finishTimers.get(id));
    finishTimers.set(id, setTimeout(async () => {
        finishTimers.delete(id);
        if (adapter.generationActive()) return;
        const text = adapter.messageText(message);
        const kind = /error|went wrong|failed to generate/i.test(text) ? 'failed' : (stopRequested ? 'stopped' : 'received');
        stopRequested = false;
        const finished = await store.mergeMessageRecord(conversationId, id, { finishedAt: Date.now(), finishedZone: detectedZone(), terminalKind: kind });
        if (settings.enabled) presenter.render(message, displayData(finished, role));
      }, 900));
  }

  async function processAll(initial = false) {
    settings = await store.getSettings();
    const nextConversation = adapter.conversationId();
    if (nextConversation !== currentConversation) {
      currentConversation = nextConversation;
      known.clear();
      assistantText.clear();
      for (const timer of finishTimers.values()) clearTimeout(timer);
      finishTimers.clear();
      initialized = false;
    }
    for (const message of adapter.getMessages()) {
      const id = adapter.messageId(message);
      const firstSeen = !known.has(id);
      if (id) known.add(id);
      await processMessage(message, initial || (!initialized && firstSeen));
    }
    for (const field of adapter.getEditingFields()) {
      const value = adapter.getDraftText(field);
      const parsed = TS.marker.parse(value);
      if (parsed) await adapter.replaceDraftText(TS.marker.strip(value, parsed.marker), field);
    }
    initialized = true;
  }

  async function requestProcess(initial = false) {
    if (processing) { rerunRequested = true; return; }
    processing = true;
    try {
      do {
        rerunRequested = false;
        await processAll(initial);
        initial = false;
      } while (rerunRequested);
    } finally { processing = false; }
  }

  let processTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(processTimer);
    processTimer = setTimeout(() => requestProcess(false), 80);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  requestProcess(true);

  chrome.storage.onChanged.addListener((_, area) => { if (area === 'sync') { settings = null; requestProcess(false); } });
  setInterval(() => {
    const zone = detectedZone();
    if (zone !== lastBrowserZone) { lastBrowserZone = zone; requestProcess(false); }
  }, 30000);

  async function snapshot() {
    const conversationId = adapter.conversationId();
    const messages = [];
    for (const element of adapter.getMessages()) {
      const id = adapter.messageId(element);
      const role = adapter.messageRole(element);
      const record = await store.getMessageRecord(conversationId, id) || {};
      let text = adapter.messageText(element, { includeMarker: true });
      const parsed = TS.marker.parse(text);
      if (parsed) text = TS.marker.strip(text, parsed.marker);
      messages.push({
        id, role, text, ...record,
        ...(!Number.isFinite(record.sentAt) && parsed ? { sentDisplay: parsed.display, captureZone: parsed.zone, source: record.source || 'marker' } : {})
      });
    }
    return { title: adapter.conversationTitle(), conversationId, exportedAt: Date.now(), messages };
  }

  chrome.runtime.onMessage.addListener((message, _, respond) => {
    if (message?.type === 'cgpt-ts-status') {
      getSettings().then((value) => respond(TS.compatibility.evaluate({ ...adapter.compatibility(), enabled: value.enabled || value.includeInPrompts })));
      return true;
    }
    if (message?.type === 'cgpt-ts-snapshot') { snapshot().then(respond); return true; }
    return false;
  });
})(globalThis);
