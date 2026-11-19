/**
 * Starts a headless Chrome or Edge already installed on the machine, for the
 * scripts that test in a real browser.
 *
 * Set the BROWSER_PATH environment variable to use a specific browser executable.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const puppeteer = require('puppeteer-core');

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
 *
 * @returns {Promise<{browser: object, stop: function}>} The puppeteer browser, and a function that closes it.
 */
async function startBrowser() {
  const browserPath = findBrowser();
  if (!browserPath) {
    throw new Error('No Chrome or Edge found. Set BROWSER_PATH to a browser executable.');
  }

  const port = await getFreePort();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wick-editor-tests-'));

  const child = spawn(browserPath, [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-sandbox',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1280,800',
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

  const browser = await puppeteer.connect({ browserURL, defaultViewport: { width: 1280, height: 800 } });

  const stop = async () => {
    await browser.close().catch(() => {});
    child.kill();
    // The browser may take a moment to let go of its files.
    await new Promise(resolve => setTimeout(resolve, 1000));
    fs.rmSync(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  };

  return { browser, stop };
}

module.exports = { startBrowser };
