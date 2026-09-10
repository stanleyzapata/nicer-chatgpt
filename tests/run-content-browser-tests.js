const { chromium } = require('playwright');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 736, height: 800 } });
  page.on('pageerror', (error) => console.error('PAGE ERROR:', error.message));
  page.on('console', (message) => { if (message.type() === 'error') console.error('PAGE CONSOLE:', message.text()); });
  await page.goto(`file://${path.resolve(__dirname, 'content-fixture.html')}`);
  await page.waitForTimeout(500);
  const boot = await page.evaluate(() => ({
    hasNamespace: Boolean(globalThis.ChatGPTTimestamps),
    rawText: globalThis.ChatGPTTimestamps?.adapter?.create(document, location).messageText(document.querySelector('[data-message-id="u-existing"]'), { includeMarker: true }),
    parsed: globalThis.ChatGPTTimestamps?.marker?.parse(globalThis.ChatGPTTimestamps?.adapter?.create(document, location).messageText(document.querySelector('[data-message-id="u-existing"]'), { includeMarker: true })),
    stampCount: document.querySelectorAll('.cgpt-ts-ui').length
  }));
  if (!boot.parsed) throw new Error(`Fixture marker was not parseable: ${JSON.stringify(boot)}`);
  await page.locator('.cgpt-ts-user').waitFor();
  await page.waitForFunction(() => document.querySelector('#edit-form textarea').value === 'Revised message');
  if (await page.getByText('[Sent:', { exact: false }).first().isVisible()) throw new Error('Embedded marker remained visible');

  const replacement = await page.evaluate(async () => {
    const adapter = globalThis.ChatGPTTimestamps.adapter.create(document, location);
    const field = adapter.getComposer();
    const expected = 'New message\n\n[Sent: diagnostic; timezone: UTC]';
    await adapter.replaceDraftText(expected, field);
    const observed = adapter.getDraftText(field);
    await adapter.replaceDraftText('New message', field);
    return { expected, observed };
  });
  if (replacement.expected.trim() !== replacement.observed.trim()) throw new Error(`Composer replacement mismatch: ${JSON.stringify(replacement)}`);

  await page.locator('#main-form button').click();
  await page.waitForTimeout(1500);
  const mainResult = await page.locator('#main-form button').evaluate((button) => {
    const adapter = globalThis.ChatGPTTimestamps.adapter.create(document, location);
    return {
      count: button.dataset.nativeSends,
      text: button.dataset.sentText,
      draft: document.querySelector('#prompt-textarea').innerText,
      failure: document.querySelector('.cgpt-ts-failure')?.textContent,
      recognized: adapter.isSendControl(button),
      hasField: Boolean(adapter.submissionField(button))
    };
  });
  if (mainResult.count !== '1' || !mainResult.text?.includes('[Sent:')) throw new Error(`Main composer submission failed: ${JSON.stringify(mainResult)}`);

  await page.locator('#edit-form button').click();
  await page.waitForTimeout(1500);
  const result = await page.evaluate(() => ({
    editText: document.querySelector('#edit-form button').dataset.sentText,
    editCount: document.querySelector('#edit-form button').dataset.nativeSends,
    mainText: document.querySelector('#prompt-textarea').innerText
  }));
  if (result.editCount !== '1' || !result.editText.startsWith('Revised message\n\n[Sent:')) throw new Error('Edited message did not receive one fresh timestamp');
  if (!result.mainText.startsWith('New message\n\n[Sent:')) throw new Error('Main composer was unexpectedly changed during edit submission');

  await page.evaluate(() => {
    const stop = document.createElement('button');
    stop.dataset.testid = 'stop-button';
    stop.textContent = 'Stop';
    document.body.append(stop);
    const article = document.createElement('article');
    article.dataset.messageId = 'a-new';
    const role = document.createElement('div');
    role.dataset.messageAuthorRole = 'assistant';
    const content = document.createElement('div');
    content.className = 'markdown';
    content.textContent = 'Streaming';
    role.append(content); article.append(role); document.querySelector('main').append(article);
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    document.querySelector('[data-message-id="a-new"] .markdown').textContent = 'Streaming complete';
    document.querySelector('[data-testid="stop-button"]').remove();
  });
  await page.locator('[data-message-id="a-new"] .cgpt-ts-assistant').waitFor({ timeout: 5000 });
  const received = await page.locator('[data-message-id="a-new"] .cgpt-ts-stamp').textContent();
  if (!received.startsWith('Received · ')) throw new Error('Assistant completion timestamp was not captured');
  await page.locator('[data-message-id="a-new"] .cgpt-ts-stamp').click();
  const details = await page.locator('[data-message-id="a-new"] .cgpt-ts-details').textContent();
  if (!details.includes('Started') || !details.includes('Finished') || !details.includes('Duration')) throw new Error('Assistant start, finish, and duration details were incomplete');
  await page.evaluate(async () => {
    await globalThis.__setTimestampSettings({ includeInPrompts: false });
    const adapter = globalThis.ChatGPTTimestamps.adapter.create(document, location);
    await adapter.replaceDraftText('Untimed message', adapter.getComposer());
  });
  await page.locator('#main-form button').click();
  await page.waitForFunction(() => document.querySelector('#main-form button').dataset.nativeSends === '2');
  const untimed = await page.locator('#main-form button').getAttribute('data-sent-text');
  if (untimed !== 'Untimed message') throw new Error('Include-in-prompts toggle did not send the untouched draft');
  await page.evaluate(() => globalThis.__setTimestampSettings({ includeInPrompts: true }));
  await page.evaluate(() => globalThis.__setTimestampSettings({ enabled: false }));
  await page.waitForFunction(() => document.querySelectorAll('.cgpt-ts-ui').length === 0);
  if (await page.locator('.cgpt-ts-marker-source').isVisible()) throw new Error('Prompt marker became visible when UI timestamps were disabled');
  await page.evaluate(() => globalThis.__setTimestampSettings({ enabled: true }));
  await page.locator('[data-message-id="a-new"] .cgpt-ts-assistant').waitFor();
  await browser.close();
  console.log('Full content-script fixture passed for sends, edits, assistant timing, and display settings.');
})().catch((error) => { console.error(error); process.exit(1); });
