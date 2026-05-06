/* eslint-disable @typescript-eslint/no-require-imports */
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'dev.db');
const db = new Database(dbPath);

function cleanup() {
  const now = new Date();
  const waitingThreshold = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours
  const activeThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(); // 24 hours

  console.log(`Starting cleanup at ${now.toISOString()}`);

  // Query for stale WAITING matches
  const staleWaiting = db.prepare("SELECT id, createdAt FROM Match WHERE status = 'WAITING' AND createdAt < ?").all(waitingThreshold);
  
  // Query for stale ACTIVE matches
  const staleActive = db.prepare("SELECT id, createdAt FROM Match WHERE status = 'ACTIVE' AND createdAt < ?").all(activeThreshold);

  console.log(`Found ${staleWaiting.length} stale WAITING matches.`);
  console.log(`Found ${staleActive.length} stale ACTIVE matches.`);

  const allStale = [...staleWaiting, ...staleActive];

  for (const match of allStale) {
    console.log(`Cancelling match ${match.id} (created at ${match.createdAt})...`);
    
    try {
      // In a real fix, we'd refund credits here.
      // For now, just update status to confirm the sweep works.
      db.prepare("UPDATE Match SET status = 'CANCELLED' WHERE id = ?").run(match.id);
      console.log(`Match ${match.id} marked as CANCELLED.`);
    } catch (e) {
      console.error(`Failed to cancel match ${match.id}:`, e.message);
    }
  }

  db.close();
}

cleanup();
