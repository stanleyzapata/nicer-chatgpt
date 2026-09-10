(function initStorage(root) {
  const TS = root.ChatGPTTimestamps;
  const SCHEMA_VERSION = 1;
  const DEFAULT_SETTINGS = Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    enabled: true,
    includeInPrompts: true,
    displayZoneMode: 'current',
    customZone: '',
    format: 'auto'
  });

  function validSettings(value) {
    return value && value.schemaVersion === SCHEMA_VERSION &&
      typeof value.enabled === 'boolean' && typeof value.includeInPrompts === 'boolean' &&
      ['current', 'original', 'utc', 'custom'].includes(value.displayZoneMode) &&
      typeof value.customZone === 'string' &&
      ['auto', '12', '24', 'iso'].includes(value.format);
  }

  function validRecord(value) {
    return value && value.schemaVersion === SCHEMA_VERSION && typeof value.messages === 'object' && value.messages !== null;
  }

  function create(areas) {
    const sync = areas.sync;
    const local = areas.local;
    return {
      async getSettings() {
        const result = await sync.get('settings');
        return validSettings(result.settings) ? { ...DEFAULT_SETTINGS, ...result.settings } : { ...DEFAULT_SETTINGS };
      },
      async setSettings(patch) {
        const current = await this.getSettings();
        const next = { ...current, ...patch, schemaVersion: SCHEMA_VERSION };
        if (!validSettings(next)) throw new TypeError('Invalid timestamp settings');
        await sync.set({ settings: next });
        return next;
      },
      async getMessageRecord(conversationId, messageId) {
        if (!conversationId || !messageId) return null;
        const key = `conversation:${conversationId}`;
        const result = await local.get(key);
        if (!validRecord(result[key])) return null;
        return result[key].messages[messageId] || null;
      },
      async getConversation(conversationId) {
        const key = `conversation:${conversationId}`;
        const result = await local.get(key);
        return validRecord(result[key]) ? result[key] : { schemaVersion: SCHEMA_VERSION, messages: {} };
      },
      async mergeMessageRecord(conversationId, messageId, patch) {
        if (!conversationId || !messageId) return null;
        const key = `conversation:${conversationId}`;
        const conversation = await this.getConversation(conversationId);
        conversation.messages[messageId] = { ...(conversation.messages[messageId] || {}), ...patch };
        await local.set({ [key]: conversation });
        return conversation.messages[messageId];
      },
      async removeConversation(conversationId) {
        await local.remove(`conversation:${conversationId}`);
      }
    };
  }

  function fromChrome() {
    return create({ sync: chrome.storage.sync, local: chrome.storage.local });
  }

  TS.storage = { SCHEMA_VERSION, DEFAULT_SETTINGS, create, fromChrome, validSettings, validRecord };
})(globalThis);
