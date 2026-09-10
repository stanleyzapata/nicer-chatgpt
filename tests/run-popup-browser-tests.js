const { chromium } = require('playwright');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 380, height: 760 } });
  await page.addInitScript(() => {
    globalThis.__statusState = 'working';
    globalThis.__copiedDiagnostics = '';
    Object.defineProperty(navigator, 'clipboard', { value: { async writeText(value) { globalThis.__copiedDiagnostics = value; } } });
    const syncData = {};
    const localData = {};
    const area = (data) => ({
      async get(key) { return typeof key === 'string' ? { [key]: data[key] } : { ...data }; },
      async set(value) { Object.assign(data, value); },
      async remove(key) { delete data[key]; }
    });
    globalThis.chrome = {
      runtime: { getManifest() { return { version: '1.0.0' }; } },
      storage: { sync: area(syncData), local: area(localData), onChanged: { addListener() {} } },
      tabs: {
        async query() { return [{ id: 1, url: 'https://chatgpt.com/c/fixture' }]; },
        async sendMessage(_, message) {
          if (message.type === 'cgpt-ts-status') return globalThis.__statusState === 'working'
            ? { state: 'working', detail: 'Working with this conversation.', diagnostics: { missing: [] } }
            : { state: 'attention', detail: 'ChatGPT interface changed; timestamping paused.', diagnostics: { missing: ['composer'] } };
          return { title: 'Fixture chat', conversationId: 'fixture', exportedAt: Date.now(), messages: [] };
        }
      }
    };
  });
  await page.goto(`file://${path.resolve(__dirname, '..', 'popup', 'popup.html')}`);
  await page.getByText('Working with this conversation.').waitFor();
  if (!(await page.getByText('Version 1.0.0', { exact: true }).isVisible())) throw new Error('Installed extension version is not visible');
  if (!(await page.getByText('Display timezone', { exact: true }).isVisible())) throw new Error('Display timezone label is missing');
  const timezoneOptions = await page.locator('#displayZoneMode option').allTextContents();
  for (const option of ['Current timezone', 'Message timezone', 'UTC', 'Custom timezone…']) {
    if (!timezoneOptions.includes(option)) throw new Error(`Timezone option is unclear or missing: ${option}`);
  }
  if ((await page.locator('#zoneDetail').textContent()) !== 'Shows every message in your current timezone and updates when your device timezone changes.') throw new Error('Current-timezone explanation is unclear');
  if (!(await page.getByText('Add timestamp to prompts', { exact: true }).isVisible())) throw new Error('Prompt timestamp setting is not explicit');
  if (!(await page.locator('#enabled').isChecked())) throw new Error('Show timestamps default is off');
  if (!(await page.locator('#includeInPrompts').isChecked())) throw new Error('Prompt timestamp default is off');
  if (await page.locator('#customZoneRow').isVisible()) throw new Error('Custom timezone field is visible before it is requested');
  await page.locator('#displayZoneMode').selectOption('original');
  if ((await page.locator('#zoneDetail').textContent()) !== 'Shows each message in the timezone that was used when it was sent or received.') throw new Error('Message-timezone explanation is unclear');
  await page.locator('#displayZoneMode').selectOption('custom');
  if (!(await page.locator('#customZoneRow').isVisible())) throw new Error('Custom timezone field did not appear when requested');
  await page.locator('#displayZoneMode').selectOption('utc');
  await page.locator('#format').selectOption('iso');
  await page.waitForTimeout(50);
  if (!(await page.locator('#preview').textContent()).endsWith('Z')) throw new Error('Preview did not update to UTC ISO');
  await page.evaluate(() => { globalThis.__statusState = 'attention'; });
  await page.locator('#enabled').uncheck();
  await page.locator('#copyDiagnostics').click();
  const diagnostics = JSON.parse(await page.evaluate(() => globalThis.__copiedDiagnostics));
  if (diagnostics.route !== 'conversation') throw new Error('Diagnostics did not reduce the URL to a route type');
  if (JSON.stringify(diagnostics).includes('fixture')) throw new Error('Diagnostics leaked a conversation identifier');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 1) throw new Error(`Popup overflowed by ${overflow}px`);
  await page.screenshot({ path: 'work/extension-popup.png', fullPage: true });
  await browser.close();
  console.log('Popup fixture passed with settings persistence and no overflow.');
})().catch((error) => { console.error(error); process.exit(1); });
