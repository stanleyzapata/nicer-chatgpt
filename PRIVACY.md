# Privacy

Nicer ChatGPT runs locally in Chrome.

- It makes no external network requests.
- It includes no analytics or telemetry.
- It does not intercept ChatGPT network traffic.
- It reads the active ChatGPT page only to timestamp messages, clean timestamps from edit fields, and create exports you request.
- Chrome sync stores preferences only.
- Chrome local extension storage holds conversation IDs, message IDs, timestamps, timezone evidence, and timestamp source. It does not hold conversation text.
- Markdown and JSON exports are generated in memory after you click an export button and download directly to your computer.

Chrome removes locally stored extension data when you uninstall the extension. The `[Sent: ...]` text included in messages remains part of those ChatGPT conversations.
