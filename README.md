# Catologist's Ninja Rift Tracker

Real-time leaderboards, gain rate velocity engine, rank gap calculations, and live ticker for Ninja Rift clans and arena villages.

---

## Features

- **Live Velocity Engine:** Calculates real-time **RPS** (Rep/sec) and **RPM** (Rep/min).
- **Smooth 1s Live Ticker:** Fluid client-side interpolation ticking numbers up dynamically.
- **Rank Gap Analytics:** Real-time gap to rank above with estimated **Overtaking** or **Slowing down** status tags.
- **Pin System:** Pin favorite clans or rivals to the top of your board with persistent `localStorage`.
- **Arena Villages:** Dedicated leaderboards color-coded for all 5 villages (Wind, Fire, Lightning, Earth, Water).
- **Catologist Design System:** Obsidian theme (`#09090c`), JetBrains Mono and Plus Jakarta Sans typography.

---

## Quick Setup Guide

### 1. Install Dependencies
Open a terminal in the project directory and run:
```bash
npm install
```

### 2. Start the Tracker Server
```bash
node server.js
```
The server will start listening at:
👉 **`http://localhost:3000`**

---

## Setting Up the Live Data Streamer

Because Ninja Rift protects endpoints behind Cloudflare Turnstile, live data is streamed securely from your authenticated browser tab.

### Step 1: Enable Tampermonkey Permissions (One-Time)
1. In Chrome / Brave / Edge, go to:
   ```text
   chrome://extensions
   ```
2. Enable **Developer mode** (toggle in the top-right corner).
3. Click **Details** under **Tampermonkey** and set **Site access** to **"On all sites"**.

### Step 2: Install the Userscript
1. Open Tampermonkey in your browser and click **Create a new script**.
2. Replace all text with the contents of [`ninja-rift-streamer.user.js`](./ninja-rift-streamer.user.js).
3. Save the script (`Ctrl + S`).

### Step 3: Stream Live Data
1. Open and keep `https://playninjarift.com/ClanRanking` open in a browser tab.
2. The script will automatically stream data to `http://localhost:3000` every 15 seconds.
3. Open **`http://localhost:3000`** in another tab to view your live tracker!

---

## Alternative: Console Streamer (No Extension Needed)
If you prefer not to use Tampermonkey, simply open `https://playninjarift.com/ClanRanking`, press **`F12`**, go to the **Console** tab, and paste:

```javascript
(function autoSync() {
  async function push() {
    try {
      const res = await fetch('/api/clan_ranking_website.php');
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        await fetch('http://localhost:3000/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        console.log(`[Synced] ${data.length} clans at ${new Date().toLocaleTimeString()}`);
      }
    } catch (e) { console.error('Sync error:', e); }
  }
  push();
  setInterval(push, 15000);
})();
```

---

## File Structure

```text
├── db.js                     # SQLite database & snapshot batch insertion
├── server.js                 # Express server & real-time analytics API
├── ninja-rift-streamer.user.js# Tampermonkey data bridge userscript
├── public/
│   └── index.html            # Frontend dashboard (Catologist UI)
├── tracker.db                # SQLite database (auto-generated)
└── package.json              # Project dependencies
```

---

## Credits
- Developed by **Catologist**
- Design & Idea Credits to **@samhubmy**
