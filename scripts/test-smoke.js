/**
 * Opens the editor in a headless browser and checks that it starts and that
 * drawing and saving a project work, without errors.
 *
 * Usage:
 *   npm run test:smoke                      Tests the production build (run `npm run build` first).
 *   npm run test:smoke -- --dev             Tests the development server.
 *   npm run test:smoke -- --screenshot=FILE Also saves an image of the editor.
 */

const fs = require('fs');
const path = require('path');
const { startBrowser } = require('./browser');

const root = path.join(__dirname, '..');
const useDevServer = process.argv.includes('--dev');
const screenshotArg = process.argv.find(arg => arg.startsWith('--screenshot='));
const screenshotPath = screenshotArg && screenshotArg.slice('--screenshot='.length);

// Messages that do not mean the editor is broken.
const IGNORED_ERRORS = [
  // No network access to third parties is needed for the editor to work.
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
  /net::ERR_INTERNET_DISCONNECTED/,
  /net::ERR_NAME_NOT_RESOLVED/,
];

async function startServer() {
  const vite = await import('vite');

  if (useDevServer) {
    const server = await vite.createServer({ root, server: { port: 0, host: '127.0.0.1', open: false }, logLevel: 'error' });
    await server.listen();
    return { url: server.resolvedUrls.local[0], close: () => server.close() };
  }

  if (!fs.existsSync(path.join(root, 'build', 'index.html'))) {
    throw new Error('There is no build to test. Run `npm run build` first.');
  }
  const server = await vite.preview({ root, preview: { port: 0, host: '127.0.0.1', open: false }, logLevel: 'error' });
  return { url: server.resolvedUrls.local[0], close: () => server.close() };
}

async function main() {
  const server = await startServer();
  const { browser, stop } = await startBrowser();

  const errors = [];
  const failures = [];
  const check = (description, passed) => {
    console.log((passed ? 'ok   ' : 'FAIL ') + description);
    if (!passed) failures.push(description);
  };

  try {
    const page = await browser.newPage();
    page.on('pageerror', error => errors.push('Uncaught error: ' + error.message));
    page.on('console', message => {
      if (message.type() === 'error') {
        errors.push('Console error: ' + message.text() + ' ' + (message.location().url || ''));
      }
    });
    page.on('requestfailed', request => {
      errors.push('Request failed: ' + request.url() + ' ' + ((request.failure() || {}).errorText || ''));
    });
    page.on('response', response => {
      if (response.status() >= 400) errors.push('HTTP ' + response.status() + ': ' + response.url());
    });

    await page.goto(server.url, { waitUntil: 'load', timeout: 120000 });

    // The editor is ready once it created a project and rendered the menu bar.
    await page.waitForFunction(
      () => window.editor && window.editor.project && document.querySelector('.menu-bar'),
      { timeout: 120000 }
    ).catch(() => {});

    const state = await page.evaluate(() => ({
      hasEngine: Boolean(window.Wick && window.Wick.Project),
      hasEditor: Boolean(window.editor && window.editor.project),
      menuBar: (document.querySelector('.menu-bar') || {}).innerText || '',
      canvasCount: document.querySelectorAll('canvas').length,
      canvasBorderColor: window.getComputedStyle(document.documentElement)
        .getPropertyValue('--editor-canvas-border').trim(),
      toolIcons: Array.from(document.querySelectorAll('img')).filter(img => img.complete && img.naturalWidth === 0)
        .map(img => img.src),
      fontFamily: window.getComputedStyle(document.querySelector('.menu-bar-project-name') || document.body).fontFamily,
    }));

    check('the engine is loaded', state.hasEngine);
    check('the editor created a project', state.hasEditor);
    check('the menu bar is shown with its buttons', /new/i.test(state.menuBar) && /save/i.test(state.menuBar));
    check('the login button is shown', /login/i.test(state.menuBar));
    check('the canvas is created', state.canvasCount > 0);
    check('colors defined in the stylesheets reach the code', state.canvasBorderColor.toLowerCase() === '#6a6a6a');
    check('all images load', state.toolIcons.length === 0);
    if (state.toolIcons.length) console.log('     broken images: ' + state.toolIcons.slice(0, 5).join(', '));

    if (state.hasEditor) {
      // Draw something and save it as a .wick file.
      const result = await page.evaluate(async () => {
        const editor = window.editor;
        editor.closeActiveModal();

        const project = editor.project;
        const path = new window.Wick.Path({
          json: new window.paper.Path.Rectangle({
            from: [50, 50], to: [150, 150], fillColor: 'red',
          }).exportJSON({ asString: false }),
        });
        project.activeFrame.addPath(path);
        editor.projectDidChange({ actionName: 'Smoke test' });

        const file = await new Promise(resolve => window.Wick.WickFile.toWickFile(project, resolve));
        const reopened = await new Promise(resolve => window.Wick.WickFile.fromWickFile(file, resolve));

        return {
          pathCount: project.activeFrame.paths.length,
          fileSize: file ? file.size : 0,
          reopenedPathCount: reopened ? reopened.activeFrame.paths.length : -1,
          reopenedName: reopened ? reopened.name : null,
          name: project.name,
        };
      }).catch(error => ({ error: error.message }));

      if (result.error) console.log('     ' + result.error);
      check('a shape can be drawn', result.pathCount === 1);
      check('the project can be saved as a .wick file', result.fileSize > 0);
      check('the saved file opens with the same content',
        result.reopenedPathCount === 1 && result.reopenedName === result.name);
    }

    if (state.hasEditor) {
      // Open every window of the editor, so an error in any of them shows up.
      const modals = ['MakeAnimated', 'MakeInteractive', 'ExportOptions', 'SettingsModal',
        'BuiltinLibrary', 'EditorInfo', 'OpenSourceNotices', 'SimpleProjectSettings'];
      const opened = [];
      for (const modal of modals) {
        const isOpen = await page.evaluate(async (name) => {
          window.editor.openModal(name);
          // Some windows download their code when first opened, so this waits for a while.
          let shown = false;
          for (let attempt = 0; attempt < 30 && !shown; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            shown = Boolean(document.querySelector('.ReactModal__Content'));
          }
          window.editor.openModal(null);
          await new Promise(resolve => setTimeout(resolve, 100));
          return shown;
        }, modal);
        if (isOpen) opened.push(modal);
      }
      check('every window of the editor opens', opened.length === modals.length);
      if (opened.length !== modals.length) {
        console.log('     did not open: ' + modals.filter(modal => !opened.includes(modal)).join(', '));
      }

      const codeEditorOpened = await page.evaluate(async () => {
        window.editor.toggleCodeEditor();
        await new Promise(resolve => setTimeout(resolve, 1000));
        const shown = Boolean(document.querySelector('.ace_editor'));
        window.editor.toggleCodeEditor();
        return shown;
      });
      check('the code editor opens', codeEditorOpened);

      // The parts of the interface that react to the keyboard and float over the editor.
      const activeTool = () => page.evaluate(() => window.editor.getActiveTool().name);
      // The mouse is moved to coordinates, because finding an element to click or hover
      // makes the browser wait for a new frame, which a headless browser may take long to draw.
      const centerOf = (selector) => page.evaluate((selector) => {
        const box = document.querySelector(selector).getBoundingClientRect();
        return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      }, selector);
      const fillColor = await centerOf('button#tool-box-fill-color');
      await page.mouse.click(640, 300);
      await page.keyboard.press('b');
      await new Promise(resolve => setTimeout(resolve, 300));
      const toolAfterB = await activeTool();
      await page.keyboard.press('c');
      await new Promise(resolve => setTimeout(resolve, 300));
      check('keyboard shortcuts change the tool', toolAfterB === 'brush' && (await activeTool()) === 'cursor');

      await page.mouse.move(fillColor.x, fillColor.y, { steps: 3 });
      await new Promise(resolve => setTimeout(resolve, 500));
      const tooltip = await page.evaluate(() => (document.querySelector('.wick-tooltip') || {}).innerText);
      check('a tooltip is shown when hovering a button', tooltip === 'Fill Color');

      await page.evaluate(() => window.editor.changeColorPickerType('spectrum'));
      await page.mouse.click(fillColor.x, fillColor.y);
      await new Promise(resolve => setTimeout(resolve, 500));
      const pickerOpened = await page.evaluate(() => Boolean(
        document.querySelector('.popover .wick-color-picker-saturation') && document.querySelector('.menu-bar')));
      await page.mouse.click(640, 300);
      await new Promise(resolve => setTimeout(resolve, 300));
      const pickerClosed = await page.evaluate(() => !document.querySelector('.popover'));
      check('the color picker opens, and closes when clicking outside of it', pickerOpened && pickerClosed);

      const toastShown = await page.evaluate(async () => {
        window.editor.toast('Smoke test', 'info');
        await new Promise(resolve => setTimeout(resolve, 300));
        return Boolean(document.querySelector('.Toastify__toast'));
      });
      check('notifications are shown', toastShown);
    }

    // Give late errors a moment to show up, and the loading screen time to fade out.
    await new Promise(resolve => setTimeout(resolve, 3000));

    const after = await page.evaluate(() => ({
      preloaderGone: !document.getElementById('preloader'),
      openModal: window.editor ? window.editor.state.activeModalName : undefined,
      recoveryOffered: Array.from(document.querySelectorAll('.Toastify__toast')).some(toast => /recover/i.test(toast.innerText)),
    }));
    check('the loading screen is gone', after.preloaderGone);
    check('no window is left open', after.openModal === null);
    check('recovering work is not offered for work done in this visit', !after.recoveryOffered);

    if (screenshotPath) {
      await page.screenshot({ path: screenshotPath });
      console.log('Screenshot saved to ' + screenshotPath);
    }
  } finally {
    await stop();
    await server.close();
  }

  const realErrors = errors.filter(error => !IGNORED_ERRORS.some(pattern => pattern.test(error)));
  for (const error of realErrors) console.log('ERROR ' + error);
  check('no errors in the browser', realErrors.length === 0);

  console.log(`\nSmoke test (${useDevServer ? 'development server' : 'production build'}): ` +
    (failures.length ? failures.length + ' check(s) failed.' : 'all checks passed.'));
  process.exit(failures.length ? 1 : 0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
