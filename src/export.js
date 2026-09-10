(function initExport(root) {
  const TS = root.ChatGPTTimestamps;

  function messageZone(message, settings) {
    if (settings.displayZoneMode !== 'original') return settings.zone;
    return message.captureZone || message.finishedZone || message.startedZone || settings.zone;
  }

  function eventZone(message, settings, event) {
    if (settings.displayZoneMode !== 'original') return settings.zone;
    if (event === 'started') return message.startedZone || message.captureZone || message.finishedZone || settings.zone;
    if (event === 'finished') return message.finishedZone || message.captureZone || message.startedZone || settings.zone;
    return messageZone(message, settings);
  }

  function displayFields(message, settings) {
    const zone = messageZone(message, settings);
    const render = (value, event) => Number.isFinite(value) ? TS.time.format(value, { format: settings.format, zone: eventZone(message, settings, event) }) : null;
    return {
      sent: render(message.sentAt, 'sent') || message.sentDisplay || null,
      started: render(message.startedAt, 'started'),
      finished: render(message.finishedAt, 'finished'),
      created: render(message.createdAt, 'created'),
      zone,
      startedZone: eventZone(message, settings, 'started'),
      finishedZone: eventZone(message, settings, 'finished')
    };
  }

  function timestampLine(message, settings) {
    const zone = messageZone(message, settings);
    if (message.role === 'user' && (Number.isFinite(message.sentAt) || message.sentDisplay)) return `Sent: ${Number.isFinite(message.sentAt) ? TS.time.format(message.sentAt, { format: settings.format, zone }) : message.sentDisplay}`;
    if (message.role === 'assistant' && Number.isFinite(message.finishedAt)) {
      const lines = [];
      if (Number.isFinite(message.startedAt)) lines.push(`Started: ${TS.time.format(message.startedAt, { format: settings.format, zone: eventZone(message, settings, 'started') })}`);
      lines.push(`Received: ${TS.time.format(message.finishedAt, { format: settings.format, zone: eventZone(message, settings, 'finished') })}`);
      if (Number.isFinite(message.startedAt)) lines.push(`Duration: ${((message.finishedAt - message.startedAt) / 1000).toFixed(1)} seconds`);
      return lines.join('\n');
    }
    if (Number.isFinite(message.createdAt)) return `Created: ${TS.time.format(message.createdAt, { format: settings.format, zone })}`;
    return '';
  }

  function toMarkdown(snapshot, settings) {
    const lines = [`# ${snapshot.title || 'ChatGPT conversation'}`, ''];
    if (Number.isFinite(snapshot.exportedAt)) lines.push(`Exported: ${TS.time.format(snapshot.exportedAt, { format: settings.format, zone: settings.zone })}`, '');
    for (const message of snapshot.messages || []) {
      lines.push(`## ${message.role === 'user' ? 'User' : 'ChatGPT'}`, '', String(message.text || '').trim());
      const stamp = timestampLine(message, settings);
      if (stamp) lines.push('', stamp);
      lines.push('');
    }
    return `${lines.join('\n').trim()}\n`;
  }

  function toJson(snapshot, settings) {
    const result = {
      schemaVersion: 1,
      title: snapshot.title || 'ChatGPT conversation',
      conversationId: snapshot.conversationId || null,
      exportedAt: snapshot.exportedAt,
      display: { format: settings.format, zone: settings.zone },
      messages: (snapshot.messages || []).map((message) => {
        const durationMs = Number.isFinite(message.startedAt) && Number.isFinite(message.finishedAt) ? message.finishedAt - message.startedAt : null;
        return {
          id: message.id || null,
          role: message.role,
          text: message.text || '',
          timestamps: {
            sentAt: message.sentAt ?? null,
            startedAt: message.startedAt ?? null,
            finishedAt: message.finishedAt ?? null,
            createdAt: message.createdAt ?? null,
            durationMs,
            captureZone: message.captureZone || null,
            startedZone: message.startedZone || null,
            finishedZone: message.finishedZone || null,
            terminalKind: message.terminalKind || null,
            source: message.source || null
          },
          display: displayFields(message, settings)
        };
      })
    };
    return `${JSON.stringify(result, null, 2)}\n`;
  }

  function filename(title, extension, epochMs = Date.now()) {
    const slug = String(title || 'chatgpt-conversation').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'chatgpt-conversation';
    return `${slug}-${new Date(epochMs).toISOString().slice(0, 10)}.${extension}`;
  }

  function download(content, name, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  TS.exporter = { toMarkdown, toJson, filename, download };
})(globalThis);
