(function initCompatibility(root) {
  const TS = root.ChatGPTTimestamps;

  function evaluate(input) {
    if (!input.supported) {
      return {
        state: 'attention',
        label: 'Needs attention',
        detail: 'ChatGPT interface changed; timestamping paused.',
        diagnostics: { missing: Array.isArray(input.missing) ? [...input.missing] : [] }
      };
    }
    if (!input.enabled) return { state: 'paused', label: 'Paused', detail: 'Timestamping is turned off.', diagnostics: { missing: [] } };
    return { state: 'working', label: 'Working', detail: 'Working with this conversation.', diagnostics: { missing: [] } };
  }

  TS.compatibility = { evaluate };
})(globalThis);
