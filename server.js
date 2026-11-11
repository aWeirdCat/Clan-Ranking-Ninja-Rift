const express = require('express');
const cors = require('cors');
const path = require('path');
const { db, saveClanBatch, saveArenaBatch } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

let lastClanSync = null;
let lastArenaSync = {};

const VILLAGE_NAMES = {
  1: 'Wind Village',
  2: 'Fire Village',
  3: 'Lightning Village',
  4: 'Earth Village',
  5: 'Water Village'
};

// Prepared Queries for Clan
const getHistoricalClanRep = db.prepare(`
  SELECT reputation, strftime('%s', recorded_at) as recorded_sec
  FROM clan_snapshots
  WHERE clan_id = ? AND recorded_at <= datetime('now', ?)
  ORDER BY recorded_at DESC
  LIMIT 1
`);

const getPreviousClanRep = db.prepare(`
  SELECT reputation, strftime('%s', recorded_at) as recorded_sec
  FROM clan_snapshots
  WHERE clan_id = ? AND recorded_at < ?
  ORDER BY recorded_at DESC
  LIMIT 1
`);

// Prepared Queries for Arena
const getHistoricalArenaTrophies = db.prepare(`
  SELECT trophies, strftime('%s', recorded_at) as recorded_sec
  FROM arena_snapshots
  WHERE player_id = ? AND village_id = ? AND recorded_at <= datetime('now', ?)
  ORDER BY recorded_at DESC
  LIMIT 1
`);

const getPreviousArenaTrophies = db.prepare(`
  SELECT trophies, strftime('%s', recorded_at) as recorded_sec
  FROM arena_snapshots
  WHERE player_id = ? AND village_id = ? AND recorded_at < ?
  ORDER BY recorded_at DESC
  LIMIT 1
`);

// --- INGEST ENDPOINTS ---
app.post('/api/ingest', (req, res) => {
  try {
    const clans = req.body;
    if (Array.isArray(clans) && clans.length > 0) {
      saveClanBatch(clans);
      lastClanSync = new Date();
      return res.json({ success: true, count: clans.length });
    }
    res.status(400).json({ error: 'Expected non-empty array of clans' });
  } catch (err) {
    console.error('[Clan Ingest Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ingest-arena', (req, res) => {
  try {
    const { village_id, members } = req.body;
    if (village_id && Array.isArray(members) && members.length > 0) {
      saveArenaBatch(village_id, members);
      lastArenaSync[village_id] = new Date();
      return res.json({ success: true, count: members.length });
    }
    res.status(400).json({ error: 'Invalid arena payload' });
  } catch (err) {
    console.error('[Arena Ingest Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Season active flag (Set to false when season is actively running with live deltas)
const IS_SEASON_OVER = false;

// --- CLAN LIVE API ---
app.get('/api/live', (req, res) => {
  try {
    const latestClans = db.prepare(`
      WITH Ranked AS (
        SELECT 
          s.clan_id, s.reputation, s.rank, s.recorded_at,
          strftime('%s', s.recorded_at) as recorded_sec,
          ROW_NUMBER() OVER (PARTITION BY s.clan_id ORDER BY s.recorded_at DESC) as rn
        FROM clan_snapshots s
      )
      SELECT 
        r.clan_id, c.clan_name, c.leader_name, c.clan_logo,
        r.reputation, r.rank, r.recorded_at, r.recorded_sec
      FROM Ranked r
      JOIN clans c ON c.clan_id = r.clan_id
      WHERE r.rn = 1
      ORDER BY r.reputation DESC
    `).all();

    if (!latestClans || latestClans.length === 0) {
      return res.json({ status: 'initializing', clans: [] });
    }

    const isSeasonConcluded = IS_SEASON_OVER;

    const clansWithMetrics = latestClans.map((clan, idx) => {
      const clanId = clan.clan_id;
      const currentRep = clan.reputation;
      const currentSec = Number(clan.recorded_sec);

      const rep1mRow = getHistoricalClanRep.get(clanId, '-1 minute');
      const prevRow = getPreviousClanRep.get(clanId, clan.recorded_at);

      let gainPerSec = 0;
      if (!isSeasonConcluded && prevRow && currentSec > Number(prevRow.recorded_sec)) {
        const deltaSec = currentSec - Number(prevRow.recorded_sec);
        const deltaRep = currentRep - prevRow.reputation;
        if (deltaSec > 0 && deltaRep >= 0) {
          gainPerSec = deltaRep / deltaSec;
        }
      }

      const gain1m = (!isSeasonConcluded && rep1mRow) ? Math.max(0, currentRep - rep1mRow.reputation) : 0;
      const clanAbove = latestClans[idx - 1];

      return {
        rank: idx + 1,
        clan_id: clan.clan_id,
        clan_name: clan.clan_name,
        leader_name: clan.leader_name,
        clan_logo: clan.clan_logo,
        reputation: currentRep,
        gains: {
          per_sec: isSeasonConcluded ? 0 : Math.max(0, Math.round(gainPerSec * 100) / 100),
          per_min: isSeasonConcluded ? 0 : gain1m
        },
        gaps: {
          gap_above: clanAbove ? clanAbove.reputation - currentRep : null,
          above_name: clanAbove ? clanAbove.clan_name : null
        }
      };
    });

    res.json({
      status: 'ok',
      season_ended: isSeasonConcluded,
      last_updated: lastClanSync || latestClans[0].recorded_at,
      total_clans: clansWithMetrics.length,
      clans: clansWithMetrics
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ARENA LIVE API ---
app.get('/api/live-arena', (req, res) => {
  try {
    const villageId = Number(req.query.village_id) || 1;

    const latestMembers = db.prepare(`
      WITH Ranked AS (
        SELECT 
          player_id, character_name, village_id, trophies, rank, character_level,
          recorded_at, strftime('%s', recorded_at) as recorded_sec,
          ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY recorded_at DESC) as rn
        FROM arena_snapshots
        WHERE village_id = ?
      )
      SELECT player_id, character_name, village_id, trophies, rank, character_level, recorded_at, recorded_sec
      FROM Ranked
      WHERE rn = 1
      ORDER BY trophies DESC
    `).all(villageId);

    const newestSnapshotTime = latestMembers.length > 0 ? new Date(latestMembers[0].recorded_at + 'Z').getTime() : 0;
    const isSeasonConcluded = (Date.now() - newestSnapshotTime) > (3 * 60 * 1000);

    const membersWithMetrics = latestMembers.map((member, idx) => {
      const pid = member.player_id;
      const currentTrophies = member.trophies;
      const currentSec = Number(member.recorded_sec);

      const trophies1m = getHistoricalArenaTrophies.get(pid, villageId, '-1 minute');
      const prevRow = getPreviousArenaTrophies.get(pid, villageId, member.recorded_at);

      let tps = 0;
      if (!isSeasonConcluded && prevRow && currentSec > Number(prevRow.recorded_sec)) {
        const deltaSec = currentSec - Number(prevRow.recorded_sec);
        const deltaTrophies = currentTrophies - prevRow.trophies;
        if (deltaSec > 0 && deltaTrophies >= 0) {
          tps = deltaTrophies / deltaSec;
        }
      }

      const tpm = (!isSeasonConcluded && trophies1m) ? Math.max(0, currentTrophies - trophies1m.trophies) : 0;
      const playerAbove = latestMembers[idx - 1];

      return {
        rank: idx + 1,
        player_id: member.player_id,
        character_name: member.character_name,
        character_level: member.character_level,
        village_id: villageId,
        trophies: currentTrophies,
        gains: {
          tps: Math.max(0, Math.round(tps * 100) / 100),
          tpm: tpm
        },
        gaps: {
          gap_above: playerAbove ? playerAbove.trophies - currentTrophies : null,
          above_name: playerAbove ? playerAbove.character_name : null
        }
      };
    });

    res.json({
      status: 'ok',
      village_id: villageId,
      village_name: VILLAGE_NAMES[villageId] || 'Village',
      season_ended: isSeasonConcluded,
      last_updated: lastArenaSync[villageId] || null,
      total_players: membersWithMetrics.length,
      players: membersWithMetrics
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to get season timer & status
app.get('/api/season-info', (req, res) => {
  res.json({
    season_name: 'Season 67',
    ends_at: '2026-11-29T06:00:00.000Z'
  });
});

app.listen(PORT, () => {
  console.log(`[Server] Ninja Rift Rankings Hub running at http://localhost:${PORT}`);
});
