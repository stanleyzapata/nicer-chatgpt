(function initAdapter(root) {
  const TS = root.ChatGPTTimestamps;

  function create(doc = document, loc = location) {
    const composerSelectors = ['#prompt-textarea', '[data-testid="composer"] [contenteditable="true"]', 'form [contenteditable="true"]', 'textarea[data-id="root"]'];
    const sendSelectors = ['[data-testid="send-button"]', 'button[aria-label="Send prompt"]', 'button[aria-label="Send message"]', 'form button[type="submit"]'];

    function first(selectors, scope = doc) {
      for (const selector of selectors) {
        const found = scope.querySelector(selector);
        if (found) return found;
      }
      return null;
    }

    function getComposer() { return first(composerSelectors); }
    function getSendButton(field) {
      const form = field?.closest?.('form');
      return form ? first([...sendSelectors, 'button[type="submit"]'], form) : first(sendSelectors);
    }
    function getDraftText(field = getComposer()) { return field ? ('value' in field ? field.value : field.innerText || field.textContent || '') : ''; }

    function setContentEditableText(field, value) {
      const fragment = doc.createDocumentFragment();
      String(value).split('\n').forEach((line, index) => {
        if (index) fragment.append(doc.createElement('br'));
        if (line) fragment.append(doc.createTextNode(line));
      });
      field.replaceChildren(fragment);
    }

    async function replaceDraftText(value, field = getComposer()) {
      if (!field) throw new Error('Composer not found');
      field.focus();
      if ('value' in field) {
        const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(field), 'value')?.set;
        if (setter) setter.call(field, value); else field.value = value;
      } else {
        const selection = doc.getSelection && doc.getSelection();
        if (selection && doc.createRange) {
          const range = doc.createRange();
          range.selectNodeContents(field);
          selection.removeAllRanges();
          selection.addRange(range);
        }
        let inserted = false;
        if (typeof doc.execCommand === 'function') {
          try { inserted = doc.execCommand('insertText', false, value); } catch (_) { inserted = false; }
        }
        if (!inserted || getDraftText(field).trim() !== String(value).trim()) setContentEditableText(field, value);
      }
      field.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    function triggerSend(field, control) {
      const button = control?.closest?.('button') || getSendButton(field);
      if (!button || button.disabled) throw new Error('Send button unavailable');
      button.click();
    }

    function submissionField(target) {
      if (!target?.closest) return null;
      const direct = target.closest('textarea,[contenteditable="true"]');
      if (direct && (direct === getComposer() || direct.closest('[data-message-id]'))) return direct;
      const form = target.closest('form');
      if (!form) return null;
      const field = first(['[contenteditable="true"]', 'textarea'], form);
      return field && (field === getComposer() || field.closest('[data-message-id]')) ? field : null;
    }
    function isSendControl(target) { return Boolean(target && target.closest && target.closest(sendSelectors.join(',')) && submissionField(target)); }
    function isStopControl(target) { return Boolean(target && target.closest && target.closest('[data-testid="stop-button"],button[aria-label*="Stop generating" i],button[aria-label="Stop"]')); }
    function generationActive() { return Boolean(first(['[data-testid="stop-button"]', 'button[aria-label*="Stop generating" i]', 'button[aria-label="Stop"]'])); }

    function getMessages() {
      const roots = [];
      const seen = new Set();
      for (const roleNode of doc.querySelectorAll('[data-message-author-role]')) {
        const message = roleNode.closest('[data-message-id]') || roleNode.closest('article') || roleNode;
        if (!seen.has(message)) { seen.add(message); roots.push(message); }
      }
      return roots;
    }

    function roleNode(message) { return message.matches('[data-message-author-role]') ? message : message.querySelector('[data-message-author-role]'); }
    function messageRole(message) { return roleNode(message)?.getAttribute('data-message-author-role') || 'unknown'; }
    function messageId(message) {
      return message.getAttribute('data-message-id') || message.closest('[data-message-id]')?.getAttribute('data-message-id') || message.getAttribute('data-testid') || null;
    }
    function messageContent(message) {
      const role = roleNode(message);
      return role?.querySelector('.markdown,.whitespace-pre-wrap,[data-message-content]') || role || message;
    }
    function structuredText(node) {
      const blocks = new Set(['ADDRESS','ARTICLE','ASIDE','BLOCKQUOTE','DIV','DL','FIELDSET','FIGCAPTION','FIGURE','FOOTER','H1','H2','H3','H4','H5','H6','HEADER','LI','MAIN','NAV','OL','P','PRE','SECTION','TABLE','TR','UL']);
      function read(current) {
        if (current.nodeType === 3) return current.nodeValue;
        if (current.nodeType !== 1) return '';
        if (current.tagName === 'BR') return '\n';
        const value = [...current.childNodes].map(read).join('');
        return blocks.has(current.tagName) ? `${value}\n\n` : value;
      }
      return read(node).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    }
    function messageText(message, options = {}) {
      const clone = messageContent(message).cloneNode(true);
      clone.querySelectorAll('.cgpt-ts-ui').forEach((node) => node.remove());
      if (!options.includeMarker) clone.querySelectorAll('.cgpt-ts-marker-source').forEach((node) => node.remove());
      return structuredText(clone);
    }

    function conversationId() {
      const match = loc.pathname.match(/\/c\/([a-zA-Z0-9_-]+)/);
      return match ? match[1] : `route:${loc.pathname}`;
    }
    function conversationTitle() { return (doc.title || 'ChatGPT conversation').replace(/\s*[-–|]\s*ChatGPT\s*$/i, '').trim() || 'ChatGPT conversation'; }

    function getEditingFields() {
      return [...doc.querySelectorAll('[data-message-id] textarea,[data-message-id] [contenteditable="true"]')].filter((field) => field !== getComposer());
    }

    function historicalCreatedAt(message) {
      const raw = message.getAttribute('data-message-created-at') || roleNode(message)?.getAttribute('data-message-created-at');
      if (!raw) return null;
      const number = Number(raw);
      return Number.isFinite(number) ? (number < 1e12 ? number * 1000 : number) : null;
    }

    function compatibility() {
      const missing = [];
      if (!getComposer()) missing.push('composer');
      if (!getSendButton()) missing.push('send-control');
      return { supported: missing.length === 0, missing };
    }

    return { doc, loc, getComposer, getSendButton, getDraftText, replaceDraftText, triggerSend, submissionField, isSendControl, isStopControl, generationActive, getMessages, messageRole, messageId, messageContent, messageText, conversationId, conversationTitle, getEditingFields, historicalCreatedAt, compatibility };
  }

  TS.adapter = { create };
})(globalThis);
