const { chromium } = require('playwright');
const { saveClanBatch } = require('./db');

let isRunning = false;
let browserInstance = null;
let pageInstance = null;
let lastSuccessfulFetch = null;
let consecutiveErrors = 0;

async function getOrCreatePage() {
  if (browserInstance && pageInstance && !pageInstance.isClosed()) {
    return pageInstance;
  }

  if (browserInstance) {
    try { await browserInstance.close(); } catch (_) {}
  }

  console.log('[Collector] Launching headless browser...');
  browserInstance = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browserInstance.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 800 }
  });

  pageInstance = await context.newPage();
  console.log('[Collector] Navigating to Ninja Rift Clan Rankings page...');
  await pageInstance.goto('https://playninjarift.com/ClanRanking', {
    waitUntil: 'networkidle',
    timeout: 45000
  });

  // Short delay to allow Cloudflare Turnstile token resolution
  await pageInstance.waitForTimeout(3000);
  return pageInstance;
}

async function scrapeRankings() {
  if (isRunning) return;
  isRunning = true;

  try {
    const page = await getOrCreatePage();

    const data = await page.evaluate(async () => {
      try {
        const res = await window.fetch('/api/clan_ranking_website.php');
        if (!res.ok) {
          return { error: `HTTP ${res.status}: ${res.statusText}` };
        }
        return await res.json();
      } catch (err) {
        return { error: err.message };
      }
    });

    if (data && Array.isArray(data) && data.length > 0) {
      saveClanBatch(data);
      lastSuccessfulFetch = new Date();
      consecutiveErrors = 0;
      console.log(`[Collector] [${lastSuccessfulFetch.toLocaleTimeString()}] Recorded snapshot for ${data.length} clans. Top clan: ${data[0].clan_name} (${Number(data[0].clan_reputation).toLocaleString()} Rep)`);
    } else {
      console.warn('[Collector] Non-array or empty response:', data);
      consecutiveErrors++;
      if (consecutiveErrors >= 3) {
        console.warn('[Collector] Reinitializing browser due to consecutive empty/denied responses...');
        if (browserInstance) {
          await browserInstance.close().catch(() => {});
          browserInstance = null;
          pageInstance = null;
        }
      }
    }
  } catch (err) {
    console.error('[Collector Error]:', err.message);
    consecutiveErrors++;
    if (browserInstance) {
      await browserInstance.close().catch(() => {});
      browserInstance = null;
      pageInstance = null;
    }
  } finally {
    isRunning = false;
  }
}

function startCollector(intervalMs = 30000) {
  console.log(`[Collector] Starting automated collector (Interval: ${intervalMs / 1000}s)...`);
  scrapeRankings();
  const timer = setInterval(scrapeRankings, intervalMs);
  return timer;
}

module.exports = {
  startCollector,
  getLastSuccessfulFetch: () => lastSuccessfulFetch
};

