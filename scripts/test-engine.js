/**
 * Runs the Wick Engine tests (engine/tests/index.html) in a headless browser
 * and reports the results in the terminal.
 *
 * Usage: npm run test:engine
 *
 * Uses a Chrome or Edge already installed on the machine (see scripts/browser.js).
 */

const fs = require('fs');
const http = require('http');
const path = require('path');
const { startBrowser } = require('./browser');

const engineDir = path.join(__dirname, '..', 'engine');

// The whole suite must finish within this time.
const TIMEOUT = 10 * 60 * 1000;

// Tests that are known to fail. They are reported, but do not make the run fail.
const KNOWN_FAILURES = require('./engine-known-failures.json');

// The page reports the results by logging a line starting with this text. Nothing
// is evaluated in the page while the tests run, because that would create global
// variables, which the tests check for.
const RESULTS_PREFIX = '__ENGINE_TEST_RESULTS__';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.ttf': 'font/ttf',
  '.wick': 'application/zip',
  '.zip': 'application/zip',
};

/** Serves the engine folder, so tests can load their files over http. */
function startServer() {
  const server = http.createServer((request, response) => {
    const urlPath = decodeURIComponent(request.url.split('?')[0]);
    const filePath = path.join(engineDir, urlPath);

    if (!filePath.startsWith(engineDir)) {
      response.writeHead(403).end();
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404).end();
        return;
      }
      const type = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': type });
      response.end(data);
    });
  });

  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/** Runs in the page before anything else: reports mocha results to this script. */
function reportMochaResults(resultsPrefix) {
  let mocha;
  Object.defineProperty(window, 'mocha', {
    configurable: true,
    get: () => mocha,
    set: (value) => {
      mocha = value;
      const run = mocha.run;
      mocha.run = function () {
        const runner = run.apply(this, arguments);
        const failures = [];
        let passes = 0;
        let pending = 0;

        runner.on('pass', () => { passes++; });
        runner.on('pending', () => { pending++; });
        runner.on('fail', (test, error) => {
          failures.push({ title: test.fullTitle(), message: String((error && error.message) || error) });
        });
        runner.on('end', () => {
          console.log(resultsPrefix + JSON.stringify({ passes, pending, failures }));
        });
        return runner;
      };
    },
  });
}

async function main() {
  const server = await startServer();
  const { browser, stop } = await startBrowser();

  let results;
  try {
    const page = await browser.newPage();
    const finished = new Promise((resolve, reject) => {
      page.on('console', message => {
        if (message.text().startsWith(RESULTS_PREFIX)) {
          resolve(JSON.parse(message.text().slice(RESULTS_PREFIX.length)));
        }
      });
      setTimeout(() => reject(new Error('The engine tests did not finish in time.')), TIMEOUT).unref();
    });
    await page.evaluateOnNewDocument(reportMochaResults, RESULTS_PREFIX);
    await page.goto(`http://127.0.0.1:${server.address().port}/tests/index.html`);
    results = await finished;
  } finally {
    await stop();
    server.close();
  }

  const failedTitles = new Set(results.failures.map(failure => failure.title));
  const newFailures = results.failures.filter(failure => !KNOWN_FAILURES.includes(failure.title));
  const nowPassing = KNOWN_FAILURES.filter(title => !failedTitles.has(title));

  for (const failure of results.failures) {
    const label = KNOWN_FAILURES.includes(failure.title) ? 'KNOWN FAILURE' : 'FAIL';
    console.log(`${label} ${failure.title}\n     ${failure.message}`);
  }
  for (const title of nowPassing) {
    console.log(`PASSED, but listed in scripts/engine-known-failures.json: ${title}`);
  }

  const knownCount = results.failures.length - newFailures.length;
  console.log(
    `\nEngine tests: ${results.passes} passed, ${newFailures.length} failed, ` +
    `${knownCount} known failures, ${results.pending} skipped.`
  );
  process.exit(newFailures.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
