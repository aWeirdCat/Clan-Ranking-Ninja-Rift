const { db, saveClanBatch } = require('./db');

const clans = [
  { clan_id: 1, clan_name: 'Mythic Ninjas', character_name: 'ShadowLord', clan_logo: 'clan_logo_1', clan_reputation: 2540100 },
  { clan_id: 2, clan_name: 'Akatsuki Reborn', character_name: 'Pain99', clan_logo: 'clan_logo_2', clan_reputation: 2539800 },
  { clan_id: 3, clan_name: 'Konoha Elite', character_name: 'HokageX', clan_logo: 'clan_logo_3', clan_reputation: 2410500 },
  { clan_id: 4, clan_name: 'Storm Walkers', character_name: 'Raikage', clan_logo: 'clan_logo_4', clan_reputation: 2380500 },
  { clan_id: 5, clan_name: 'Sand Syndicate', character_name: 'GaaraSama', clan_logo: 'clan_logo_5', clan_reputation: 2190000 }
];

db.prepare('DELETE FROM clan_snapshots').run();

const insertHist = db.prepare("INSERT INTO clan_snapshots (clan_id, reputation, rank, recorded_at) VALUES (?, ?, ?, datetime('now', '-2 minute'))");

clans.forEach((c, idx) => {
  // Simulate rep gained over past 2 mins: 8-15 rep/sec
  const pastRep = c.clan_reputation - (idx === 1 ? 1800 : 900);
  insertHist.run(c.clan_id, pastRep, idx + 1);
});

saveClanBatch(clans);
console.log('Successfully seeded database with live velocity and gaps!');
process.exit(0);

