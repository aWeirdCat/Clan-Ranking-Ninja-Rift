// ==UserScript==
// @name         Ninja Rift Turbo Streamer (Clans & Arena)
// @namespace    http://tampermonkey.net/
// @version      3.5
// @description  Turbo streams live clan (5s) and arena (10s) rankings to localhost tracker
// @author       Catologist
// @match        https://playninjarift.com/*
// @grant        GM_xmlhttpRequest
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    console.log('[Ninja Rift Turbo Streamer v3.5] Active! Clan sync: 5s | Arena sync: 10s');

    function sendToLocal(endpoint, payload) {
        if (typeof GM_xmlhttpRequest !== 'undefined') {
            GM_xmlhttpRequest({
                method: 'POST',
                url: `http://localhost:3000${endpoint}`,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify(payload),
                onload: () => console.log(`[Turbo Streamer] Sent ${endpoint}`)
            });
        } else {
            fetch(`http://localhost:3000${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(() => console.log(`[Turbo Streamer] Sent ${endpoint}`)).catch(() => {});
        }
    }

    // 1. Clan Rankings Turbo Sync (Every 5 seconds)
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

    // 2. Arena Rankings Sync across all 5 Villages (Every 10 seconds)
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

    // Initial triggers shortly after load
    setTimeout(syncClans, 2000);
    setTimeout(syncVillages, 4000);

    // Turbo intervals: Clan every 5s, Arena every 10s
    setInterval(syncClans, 5000);
    setInterval(syncVillages, 10000);
})();
