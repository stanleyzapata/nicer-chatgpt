const { chromium } = require('playwright');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  for (const width of [736, 360]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    await page.goto(`file://${path.resolve(__dirname, 'dom-fixture.html')}`);
    const result = await page.evaluate(async () => {
      const TS = globalThis.ChatGPTTimestamps;
      const adapter = TS.adapter.create(document, location);
      const userMessage = document.querySelector('[data-message-id="u1"]');
      const editButton = userMessage.querySelector('.edit-form button');
      const marker = '[Sent: Sep 10, 2026, 3:42:18 PM AST; timezone: America/Santo_Domingo]';
      adapter.messageContent(userMessage).append(`\n\n${marker}`);
      const presenterForMarker = TS.presenter.create(document);
      presenterForMarker.hideSourceMarker(userMessage, marker);
      await adapter.replaceDraftText('Updated draft');
      const presenter = TS.presenter.create(document);
      presenter.render(document.querySelector('[data-message-id="a1"]'), {
        role: 'assistant', label: 'Received', display: 'Sep 10, 2026, 3:42:25 PM AST',
        iso: '2026-09-10T15:42:25-04:00', startedDisplay: '3:42:19 PM', finishedDisplay: '3:42:25 PM',
        durationMs: 6000, originalZone: 'America/Santo_Domingo', startedZone: 'America/Santo_Domingo',
        finishedZone: 'Europe/Madrid', source: 'Captured locally'
      });
      return {
        draft: adapter.getDraftText(),
        messageCount: adapter.getMessages().length,
        editFieldDetected: adapter.submissionField(editButton) === userMessage.querySelector('textarea'),
        rawUserText: adapter.messageText(userMessage, { includeMarker: true }),
        cleanUserText: adapter.messageText(userMessage),
        stamp: document.querySelector('.cgpt-ts-stamp').textContent,
        fontSize: getComputedStyle(document.querySelector('.cgpt-ts-stamp')).fontSize
      };
    });
    if (result.draft !== 'Updated draft') throw new Error(`Composer replacement failed at ${width}`);
    if (result.messageCount !== 2) throw new Error(`Message discovery failed at ${width}`);
    if (!result.editFieldDetected) throw new Error(`Edit composer detection failed at ${width}`);
    if (!result.rawUserText.includes('[Sent:')) throw new Error(`Hidden marker unavailable for export at ${width}`);
    if (result.cleanUserText.includes('[Sent:')) throw new Error(`Hidden marker leaked into display text at ${width}`);
    if (!result.stamp.includes('Received') || !result.stamp.endsWith('· 6.0s')) throw new Error(`Inline response duration missing at ${width}: ${result.stamp}`);
    if (parseFloat(result.fontSize) > 11) throw new Error(`Timestamp typography too large at ${width}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) throw new Error(`Horizontal overflow at ${width}`);
    await page.getByRole('button', { name: /Received/ }).click();
    if (!(await page.locator('.cgpt-ts-details').isVisible())) throw new Error(`Details did not open at ${width}`);
    const detailText = await page.locator('.cgpt-ts-details').innerText();
    if (!detailText.includes('Started timezone\nAmerica/Santo_Domingo') || !detailText.includes('Finished timezone\nEurope/Madrid')) {
      throw new Error(`Assistant event timezones missing from details at ${width}: ${detailText}`);
    }
    await page.locator('body').click({ position: { x: 2, y: 2 } });
    if (await page.locator('.cgpt-ts-details').isVisible()) throw new Error(`Details did not close outside at ${width}`);
    await page.getByRole('button', { name: /Received/ }).click();
    await page.getByRole('button', { name: 'Close timestamp details' }).click();
    await page.close();
  }
  await browser.close();
  console.log('Browser fixture passed at 736px and 360px.');
})().catch((error) => { console.error(error); process.exit(1); });
