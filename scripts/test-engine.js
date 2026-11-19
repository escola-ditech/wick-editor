/**
 * Runs the Wick Engine tests (engine/tests/index.html) in a headless browser
 * and reports the results in the terminal.
 *
 * Usage: npm run test:engine
 *
 * Uses a Chrome or Edge already installed on the machine. Set the BROWSER_PATH
 * environment variable to use a specific browser executable.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer-core');

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

function findBrowser() {
  const candidates = [
    process.env.BROWSER_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  return candidates.find(candidate => candidate && fs.existsSync(candidate));
}

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

function getFreePort() {
  return new Promise(resolve => {
    const server = http.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function getJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    }).on('error', reject);
  });
}

/**
 * Starts the browser and connects to it. The browser is started here, and not by
 * puppeteer, because Edge on Windows hands over to another process when it starts,
 * which puppeteer sees as the browser having closed.
 */
async function startBrowser(browserPath) {
  const port = await getFreePort();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wick-engine-tests-'));

  const child = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-sandbox',
    '--autoplay-policy=no-user-gesture-required',
    '--user-data-dir=' + profileDir,
    '--remote-debugging-port=' + port,
    'about:blank',
  ], { stdio: 'ignore' });

  const browserURL = 'http://127.0.0.1:' + port;
  for (let attempt = 0; ; attempt++) {
    try {
      await getJSON(browserURL + '/json/version');
      break;
    } catch (error) {
      if (attempt === 60) throw new Error('The browser did not start.');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const browser = await puppeteer.connect({ browserURL });

  const stop = async () => {
    await browser.close().catch(() => {});
    child.kill();
    // The browser may take a moment to let go of its files.
    await new Promise(resolve => setTimeout(resolve, 1000));
    fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  };

  return { browser, stop };
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
  const browserPath = findBrowser();
  if (!browserPath) {
    console.error('No Chrome or Edge found. Set BROWSER_PATH to a browser executable.');
    process.exit(1);
  }

  const server = await startServer();
  const { browser, stop } = await startBrowser(browserPath);

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
