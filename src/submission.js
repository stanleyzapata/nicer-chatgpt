(function initSubmission(root) {
  const TS = root.ChatGPTTimestamps;

  function cleanEditedText(text) {
    const parsed = TS.marker.parse(text);
    return parsed ? TS.marker.strip(text, parsed.marker) : text;
  }

  function createController(options) {
    const adapter = options.adapter;
    const presenter = options.presenter;
    let state = 'idle';
    let bypassNext = false;

    async function submit(context = {}) {
      if (bypassNext) {
        bypassNext = false;
        return true;
      }
      if (state !== 'idle' && state !== 'failed') return false;
      const settings = await options.getSettings();
      if (!settings.includeInPrompts) {
        bypassNext = true;
        adapter.triggerSend(context.field, context.sendControl);
        return true;
      }
      const original = adapter.getDraftText(context.field);
      if (!String(original || '').trim()) return false;
      state = 'stamping';
      const epochMs = options.clock();
      const captureZone = options.detectedZone();
      const zone = TS.time.resolveZone(settings, captureZone, captureZone);
      const generated = TS.marker.create({ epochMs, captureZone, markerZone: zone }, { format: settings.format, zone, locale: settings.locale });
      const stamped = TS.marker.append(cleanEditedText(original), generated);
      async function removeAttemptedMarker() {
        const current = adapter.getDraftText(context.field);
        if (current.trim() === stamped.trim()) {
          await adapter.replaceDraftText(original, context.field);
          return;
        }
        const parsed = TS.marker.parse(current);
        if (parsed?.marker === generated) await adapter.replaceDraftText(TS.marker.strip(current, generated), context.field);
      }
      try {
        await adapter.replaceDraftText(stamped, context.field);
        if (adapter.getDraftText(context.field).trim() !== stamped.trim()) throw new Error('verification-failed');
        state = 'verified';
        presenter.clearFailure();
        bypassNext = true;
        state = 'submitting';
        adapter.triggerSend(context.field, context.sendControl);
        if (typeof options.onStamped === 'function') options.onStamped({ epochMs, captureZone, marker: generated });
        state = 'idle';
        return true;
      } catch (_) {
        bypassNext = false;
        state = 'failed';
        await removeAttemptedMarker();
        presenter.showFailure({
          field: context.field,
          retry: async () => { state = 'idle'; return submit(context); },
          sendWithoutTimestamp: async () => {
            state = 'idle';
            await removeAttemptedMarker();
            bypassNext = true;
            presenter.clearFailure();
            adapter.triggerSend(context.field, context.sendControl);
            return true;
          },
          dismiss: () => { state = 'idle'; presenter.clearFailure(); }
        });
        return false;
      }
    }

    function consumeBypass() {
      if (!bypassNext) return false;
      bypassNext = false;
      return true;
    }

    return { submit, consumeBypass, getState: () => state };
  }

  TS.submission = { createController, cleanEditedText };
})(globalThis);
