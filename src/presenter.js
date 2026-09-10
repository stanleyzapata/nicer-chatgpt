(function initPresenter(root) {
  const TS = root.ChatGPTTimestamps;

  function makeRow(doc, label, value) {
    const row = doc.createElement('div');
    row.className = 'cgpt-ts-detail-row';
    const name = doc.createElement('span');
    name.textContent = label;
    const content = doc.createElement('span');
    content.textContent = value || 'Unavailable';
    row.append(name, content);
    return row;
  }

  function create(doc = document) {
    let failure;
    let openPopover;

    doc.addEventListener('pointerdown', (event) => {
      if (openPopover && !openPopover.wrapper.contains(event.target)) openPopover.close();
    });

    function hideSourceMarker(message, markerText) {
      if (!markerText) return;
      const candidates = [...message.querySelectorAll('*')].reverse();
      const node = candidates.find((item) => item.children.length === 0 && item.textContent.trim() === markerText);
      if (node) {
        node.classList.add('cgpt-ts-marker-source');
        return;
      }
      const walker = doc.createTreeWalker(message, 4);
      let textNode;
      while ((textNode = walker.nextNode())) {
        if (textNode.parentElement?.closest('.cgpt-ts-ui')) continue;
        const index = textNode.nodeValue.lastIndexOf(markerText);
        if (index < 0 || textNode.nodeValue.slice(index + markerText.length).trim()) continue;
        const hidden = doc.createElement('span');
        hidden.className = 'cgpt-ts-marker-source';
        hidden.textContent = markerText;
        const before = textNode.nodeValue.slice(0, index).replace(/\s+$/, '');
        textNode.parentNode.insertBefore(doc.createTextNode(before), textNode);
        textNode.parentNode.insertBefore(hidden, textNode);
        textNode.remove();
        return;
      }
    }

    function render(message, data) {
      const existing = message.querySelector(':scope > .cgpt-ts-ui');
      const signature = JSON.stringify([data.label, data.display, data.iso, data.startedDisplay, data.finishedDisplay, data.durationMs, data.originalZone, data.startedZone, data.finishedZone, data.source]);
      if (existing && existing.dataset.signature === signature) return existing;
      if (existing) existing.remove();
      hideSourceMarker(message, data.marker);
      const wrapper = doc.createElement('div');
      wrapper.className = `cgpt-ts-ui cgpt-ts-${data.role === 'user' ? 'user' : 'assistant'}`;
      wrapper.dataset.signature = signature;
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'cgpt-ts-stamp';
      const compactDuration = TS.messages.formatDuration(data.durationMs);
      button.textContent = `${data.label} · ${data.display}${compactDuration ? ` · ${compactDuration}` : ''}`;
      button.setAttribute('aria-expanded', 'false');
      const details = doc.createElement('div');
      details.className = 'cgpt-ts-details';
      details.hidden = true;
      details.setAttribute('role', 'dialog');
      details.setAttribute('aria-label', 'Timestamp details');
      const head = doc.createElement('div');
      head.className = 'cgpt-ts-details-head';
      const title = doc.createElement('strong'); title.textContent = 'Timestamp details';
      const close = doc.createElement('button'); close.type = 'button'; close.className = 'cgpt-ts-close'; close.textContent = '×'; close.setAttribute('aria-label', 'Close timestamp details');
      head.append(title, close);
      details.append(head, makeRow(doc, 'Displayed', data.display), makeRow(doc, 'ISO 8601', data.iso));
      if (data.role === 'user') details.append(makeRow(doc, 'Message timezone', data.originalZone));
      details.append(makeRow(doc, 'Source', data.source));
      if (data.startedDisplay) details.append(makeRow(doc, 'Started', data.startedDisplay));
      if (data.finishedDisplay) details.append(makeRow(doc, 'Finished', data.finishedDisplay));
      if (data.startedZone) details.append(makeRow(doc, 'Started timezone', data.startedZone));
      if (data.finishedZone) details.append(makeRow(doc, 'Finished timezone', data.finishedZone));
      if (Number.isFinite(data.durationMs)) details.append(makeRow(doc, 'Duration', `${(data.durationMs / 1000).toFixed(1)} seconds`));
      const copy = doc.createElement('button'); copy.type = 'button'; copy.className = 'cgpt-ts-copy'; copy.textContent = 'Copy timestamp';
      copy.addEventListener('click', async () => { await navigator.clipboard.writeText(data.iso || data.display); copy.textContent = 'Copied'; setTimeout(() => { copy.textContent = 'Copy timestamp'; }, 1200); });
      details.append(copy);
      const closeDetails = () => { details.hidden = true; button.setAttribute('aria-expanded', 'false'); if (openPopover?.wrapper === wrapper) openPopover = null; button.focus(); };
      button.addEventListener('click', () => {
        const opening = details.hidden;
        if (opening && openPopover && openPopover.wrapper !== wrapper) openPopover.close();
        details.hidden = !opening;
        button.setAttribute('aria-expanded', String(opening));
        if (opening) { openPopover = { wrapper, close: closeDetails }; close.focus(); }
        else openPopover = null;
      });
      close.addEventListener('click', closeDetails);
      details.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeDetails(); });
      wrapper.append(button, details);
      message.append(wrapper);
      return wrapper;
    }

    function clearFailure() { if (failure) failure.remove(); failure = null; }
    function remove(message) { message.querySelector(':scope > .cgpt-ts-ui')?.remove(); }
    function showFailure(actions) {
      clearFailure();
      const composer = actions.field || doc.querySelector('#prompt-textarea,[data-testid="composer"] [contenteditable="true"],form [contenteditable="true"],textarea[data-id="root"]');
      if (!composer) return;
      const form = composer.closest('form') || composer.parentElement;
      failure = doc.createElement('div'); failure.className = 'cgpt-ts-failure'; failure.setAttribute('role', 'alert');
      const copy = doc.createElement('div');
      const title = doc.createElement('strong'); title.textContent = "Timestamp wasn't added";
      const detail = doc.createElement('span'); detail.textContent = 'Your message is safe and has not been sent.';
      copy.append(title, detail);
      const controls = doc.createElement('div'); controls.className = 'cgpt-ts-failure-actions';
      const bypass = doc.createElement('button'); bypass.type = 'button'; bypass.textContent = 'Send without timestamp'; bypass.addEventListener('click', actions.sendWithoutTimestamp);
      const retry = doc.createElement('button'); retry.type = 'button'; retry.className = 'cgpt-ts-primary'; retry.textContent = 'Retry'; retry.addEventListener('click', actions.retry);
      controls.append(bypass, retry); failure.append(copy, controls); form.before(failure); retry.focus();
    }

    return { render, remove, hideSourceMarker, showFailure, clearFailure };
  }

  TS.presenter = { create };
})(globalThis);
