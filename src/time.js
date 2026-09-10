(function initTime(root) {
  const TS = root.ChatGPTTimestamps;
  const formatterCache = new Map();

  function browserZone() {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch (_) {
      return 'UTC';
    }
  }

  function isValidZone(zone) {
    if (!zone || typeof zone !== 'string') return false;
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(0);
      return true;
    } catch (_) {
      return false;
    }
  }

  function resolveZone(settings = {}, originalZone, detectedZone = browserZone()) {
    const fallback = isValidZone(detectedZone) ? detectedZone : 'UTC';
    if (settings.displayZoneMode === 'utc') return 'UTC';
    if (settings.displayZoneMode === 'original') return isValidZone(originalZone) ? originalZone : fallback;
    if (settings.displayZoneMode === 'custom') return isValidZone(settings.customZone) ? settings.customZone : fallback;
    return fallback;
  }

  function getFormatter(locale, options) {
    const key = `${locale}|${JSON.stringify(options)}`;
    if (!formatterCache.has(key)) formatterCache.set(key, new Intl.DateTimeFormat(locale, options));
    return formatterCache.get(key);
  }

  function parts(epochMs, zone) {
    const result = {};
    const values = getFormatter('en-CA', {
      timeZone: zone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date(epochMs));
    for (const part of values) if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }

  function offsetMinutes(epochMs, zone) {
    if (zone === 'UTC') return 0;
    const value = parts(epochMs, zone);
    const representedAsUtc = Date.UTC(Number(value.year), Number(value.month) - 1, Number(value.day), Number(value.hour), Number(value.minute), Number(value.second));
    return Math.round((representedAsUtc - Math.floor(epochMs / 1000) * 1000) / 60000);
  }

  function toIso(epochMs, zone) {
    const value = parts(epochMs, zone);
    const base = `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}:${value.second}`;
    const offset = offsetMinutes(epochMs, zone);
    if (offset === 0) return `${base}Z`;
    const sign = offset < 0 ? '-' : '+';
    const absolute = Math.abs(offset);
    return `${base}${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
  }

  function normalizeSpaces(value) {
    return value.replace(/\u202f|\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function format(epochMs, options = {}) {
    const zone = isValidZone(options.zone) ? options.zone : browserZone();
    const mode = options.format || 'auto';
    if (mode === 'iso') return toIso(epochMs, zone);
    if (mode === '24') {
      const value = parts(epochMs, zone);
      const namedParts = getFormatter('en-US', { timeZone: zone, month: 'short', timeZoneName: 'short' }).formatToParts(new Date(epochMs));
      const month = namedParts.find((part) => part.type === 'month').value;
      const zoneName = namedParts.find((part) => part.type === 'timeZoneName').value;
      return `${Number(value.day)} ${month} ${value.year}, ${value.hour}:${value.minute}:${value.second} ${zoneName}`;
    }
    const locale = mode === '12' ? 'en-US' : (options.locale || (root.navigator && root.navigator.language) || 'en-US');
    const hour12 = mode === '12' ? true : undefined;
    const formatOptions = {
      timeZone: zone,
      year: 'numeric', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', second: '2-digit',
      timeZoneName: 'short'
    };
    if (hour12 !== undefined) formatOptions.hour12 = hour12;
    return normalizeSpaces(getFormatter(locale, formatOptions).format(new Date(epochMs)));
  }

  function supportedZones() {
    if (typeof Intl.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone');
    return ['UTC', 'America/Santo_Domingo', 'America/New_York', 'Europe/London', 'Europe/Madrid', 'Asia/Tokyo'];
  }

  TS.time = { browserZone, isValidZone, resolveZone, format, toIso, offsetMinutes, supportedZones };
})(globalThis);
