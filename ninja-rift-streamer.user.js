// ==UserScript==
// @name         Ninja Rift Auto Streamer (Clans & Arena)
// @namespace    http://tampermonkey.net/
// @version      3.0
// @description  Automatically streams live clan and arena rankings to localhost tracker
// @author       Catologist
// @match        https://playninjarift.com/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Ninja Rift Auto Streamer v3.0] Initialized and monitoring rankings...');

    function sendToLocal(endpoint, payload) {
        if (typeof GM_xmlhttpRequest !== 'undefined') {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `http://localhost:3000${endpoint}`,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify(payload),
                onload: () => console.log(`[Streamer] Successfully sent ${endpoint} payload`)
            });
        } else {
            fetch(`http://localhost:3000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(() => console.log(`[Streamer] Sent ${endpoint} payload`)).catch(() => {});
        }
    }

    // 1. Clan Rankings Sync (Runs every 15s)
    async function syncClans() {
        try {
            const res = await window.fetch('/api/clan_ranking_website.php');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    sendToLocal('/api/ingest', data);
                }
            }
        } catch (err) {
            console.error('[Streamer Clan Error]', err);
        }
    }

    // 2. Arena Rankings Sync across all 5 Villages (Runs every 30s)
    async function syncVillages() {
        for (let vid = 1; vid <= 5; vid++) {
            try {
                const res = await window.fetch(`/api/detail_village_website.php?village_id=${vid}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.members) {
                        sendToLocal('/api/ingest-arena', { village_id: vid, ...data });
                    }
                }
            } catch (err) {
                console.error(`[Streamer Village ${vid} Error]`, err);
            }
        }
    }

    // Initial triggers shortly after page load
    setTimeout(syncClans, 3000);
    setTimeout(syncVillages, 5000);

    // Continuous interval pollers
    setInterval(syncClans, 15000);
    setInterval(syncVillages, 30000);
})();
