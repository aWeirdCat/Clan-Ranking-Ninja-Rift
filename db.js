const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'tracker.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS clans (
    clan_id INTEGER PRIMARY KEY,
    clan_name TEXT NOT NULL,
    leader_name TEXT,
    clan_logo TEXT,
    clan_members INTEGER,
    clan_max_members INTEGER,
    clan_tokens INTEGER,
    clan_golds INTEGER
  );

  CREATE TABLE IF NOT EXISTS clan_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clan_id INTEGER NOT NULL,
    reputation INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(clan_id) REFERENCES clans(clan_id)
  );

  CREATE TABLE IF NOT EXISTS arena_players (
    player_id TEXT PRIMARY KEY,
    character_name TEXT NOT NULL,
    village_id INTEGER NOT NULL,
    character_level INTEGER
  );

  CREATE TABLE IF NOT EXISTS arena_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL,
    character_name TEXT NOT NULL,
    village_id INTEGER NOT NULL,
    trophies INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    character_level INTEGER,
    recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_snapshots_clan_time ON clan_snapshots(clan_id, recorded_at DESC);
  CREATE INDEX IF NOT EXISTS idx_snapshots_arena_time ON arena_snapshots(village_id, recorded_at DESC);
`);

const insertOrUpdateClan = db.prepare(`
  INSERT INTO clans (clan_id, clan_name, leader_name, clan_logo, clan_members, clan_max_members, clan_tokens, clan_golds)
  VALUES (@clan_id, @clan_name, @leader_name, @clan_logo, @clan_members, @clan_max_members, @clan_tokens, @clan_golds)
  ON CONFLICT(clan_id) DO UPDATE SET
    clan_name = excluded.clan_name,
    leader_name = excluded.leader_name,
    clan_logo = excluded.clan_logo,
    clan_members = excluded.clan_members,
    clan_max_members = excluded.clan_max_members,
    clan_tokens = excluded.clan_tokens,
    clan_golds = excluded.clan_golds
`);

const insertClanSnapshot = db.prepare(`
  INSERT INTO clan_snapshots (clan_id, reputation, rank, recorded_at)
  VALUES (@clan_id, @reputation, @rank, datetime('now'))
`);

function saveClanBatch(clansList) {
  const saveTx = db.transaction((clans) => {
    clans.forEach((clan, idx) => {
      insertOrUpdateClan.run({
        clan_id: Number(clan.clan_id),
        clan_name: clan.clan_name || 'Unknown',
        leader_name: clan.character_name || '',
        clan_logo: clan.clan_logo || '',
        clan_members: Number(clan.clan_members || 0),
        clan_max_members: Number(clan.clan_max_members || 0),
        clan_tokens: Number(clan.clan_tokens || 0),
        clan_golds: Number(clan.clan_golds || 0)
      });

      insertClanSnapshot.run({
        clan_id: Number(clan.clan_id),
        reputation: Number(clan.clan_reputation || 0),
        rank: idx + 1
      });
    });
  });

  saveTx(clansList);
}

const insertArenaSnapshot = db.prepare(`
  INSERT INTO arena_snapshots (player_id, character_name, village_id, trophies, rank, character_level, recorded_at)
  VALUES (@player_id, @character_name, @village_id, @trophies, @rank, @character_level, datetime('now'))
`);

function saveArenaBatch(villageId, membersList) {
  const saveTx = db.transaction((members) => {
    members.forEach((m, idx) => {
      insertArenaSnapshot.run({
        player_id: String(m.char_id || m.character_name),
        character_name: m.character_name || 'Unknown',
        village_id: Number(villageId),
        trophies: Number(m.trophies || 0),
        rank: idx + 1,
        character_level: Number(m.character_level || 1)
      });
    });
  });

  saveTx(membersList);
}

module.exports = {
  db,
  saveClanBatch,
  saveArenaBatch
};
