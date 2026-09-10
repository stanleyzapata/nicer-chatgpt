(function initMessages(root) {
  const TS = root.ChatGPTTimestamps;

  function createLifecycle() {
    const records = new Map();
    return {
      started(id, epochMs, zone) {
        const current = records.get(id) || {};
        if (!Number.isFinite(current.startedAt)) Object.assign(current, { startedAt: epochMs, startedZone: zone });
        records.set(id, current);
        return current;
      },
      finished(id, epochMs, zone, kind = 'received') {
        const current = records.get(id) || {};
        Object.assign(current, { finishedAt: epochMs, finishedZone: zone, terminalKind: kind });
        records.set(id, current);
        return current;
      },
      get: (id) => records.get(id) || null,
      clear: () => records.clear()
    };
  }

  function duration(record) {
    return record && Number.isFinite(record.startedAt) && Number.isFinite(record.finishedAt) ? Math.max(0, record.finishedAt - record.startedAt) : null;
  }

  function formatDuration(durationMs) {
    if (!Number.isFinite(durationMs)) return null;
    const safeMs = Math.max(0, durationMs);
    if (safeMs < 60000) {
      const seconds = safeMs / 1000;
      return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`;
    }
    const totalSeconds = Math.round(safeMs / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    if (totalMinutes < 60) return `${totalMinutes}m ${totalSeconds % 60}s`;
    return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
  }

  TS.messages = { createLifecycle, duration, formatDuration };
})(globalThis);
