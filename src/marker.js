(function initMarker(root) {
  const TS = root.ChatGPTTimestamps;
  const FINAL_MARKER = /(?:^|\n\n)(\[Sent: ([^\]\n]+); timezone: ([A-Za-z0-9_+\-/]+)\])$/;

  function create(record, settings) {
    const rendered = TS.time.format(record.epochMs, { format: settings.format, zone: settings.zone, locale: settings.locale });
    return `[Sent: ${rendered}; timezone: ${record.markerZone || record.captureZone}]`;
  }

  function parse(text) {
    if (typeof text !== 'string') return null;
    const match = text.match(FINAL_MARKER);
    if (!match || !TS.time.isValidZone(match[3])) return null;
    return { marker: match[1], display: match[2], zone: match[3] };
  }

  function append(text, generatedMarker) {
    const clean = String(text || '').replace(/\s+$/, '');
    return clean ? `${clean}\n\n${generatedMarker}` : generatedMarker;
  }

  function strip(text, expectedMarker) {
    if (typeof text !== 'string' || typeof expectedMarker !== 'string') return text;
    const suffix = `\n\n${expectedMarker}`;
    if (text.endsWith(suffix)) return text.slice(0, -suffix.length).replace(/\s+$/, '');
    if (text === expectedMarker) return '';
    return text;
  }

  TS.marker = { create, parse, append, strip };
})(globalThis);
