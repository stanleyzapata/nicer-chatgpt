# Nicer ChatGPT

A local Chrome extension that adds visible timestamps to ChatGPT messages and includes the current timestamp in prompts when you send them.

## Install

1. Unzip the package if needed.
2. Open `chrome://extensions` in Chrome.
3. Turn on Developer mode.
4. Select Load unpacked.
5. Choose the `nicer-chatgpt` folder.
6. Open or reload `https://chatgpt.com`.

## What it does

- Appends a dated `[Sent: ...]` line to prompts so ChatGPT receives time context.
- Removes that generated line while you edit a message and adds a fresh one when you resend.
- Captures both the beginning and completion of new assistant responses.
- Shows the completion time and duration beneath assistant messages, such as `Received · Sep 10, 2026, 3:42:25 PM AST · 6.2s`. Click it for the start and finish times, their captured timezones, ISO time, and source.
- Displays stored timestamps after reloads.
- Converts display times using the current browser timezone, original capture timezone, UTC, or another IANA timezone.
- Exports the active conversation as timestamped Markdown or JSON.

## Display timezone

- **Current timezone** shows every message in Chrome's current timezone and follows the device when you travel.
- **Message timezone** shows each message event in the timezone captured when it was sent, started, or received. A reply that crosses a timezone change keeps both zones in its details.
- **UTC** displays every timestamp in Coordinated Universal Time.
- **Custom timezone** displays every timestamp in the IANA timezone you select.

**Add timestamp to prompts** appends the current date and time to every message, giving ChatGPT time context. The display-timezone setting controls the timezone used in that timestamp. It never changes the stored moment or the original capture timezone.

## If timestamp insertion fails

The message is not sent and the draft remains in the composer. Choose Retry to generate and insert a new timestamp, or Send without timestamp to submit the untouched draft.

## Historical conversations

Sent timestamps already embedded by this extension can be redisplayed. Exact assistant completion times can only be restored when the extension captured them locally. If ChatGPT exposes a reliable creation time, the extension may label it Created. It never invents missing historical times.

## Data

Preferences use Chrome settings sync. Conversation IDs and timestamp records use local extension storage and do not sync. Message text is read only when you explicitly export the current conversation and is not retained separately.

Uninstalling the extension clears its local assistant timestamp records. Embedded sent timestamps remain in the ChatGPT conversation.

## Troubleshooting

Open the extension popup while viewing ChatGPT. Working means the current page structure is supported. Needs attention means ChatGPT changed its interface or the current page is unsupported. Your drafts remain under your control.
