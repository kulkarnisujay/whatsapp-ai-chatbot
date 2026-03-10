import Database from 'better-sqlite3';

// Connect to the SQLite database
const db = new Database('./data/chatbot.db');

console.log('🔗 Connected to DB');

try {
  // We want to delete ALL leads, so you can test as a brand new user
  // This is safe because you're just testing locally
  const info = db.prepare('DELETE FROM leads').run();
  
  // Also delete all their messages to be completely fresh
  db.prepare('DELETE FROM conversation_messages').run();

  console.log(`✅ Success! Deleted ${info.changes} leads.`);
  console.log(`🚨 Your database is now completely empty. Text the bot again from your phone, and it will treat you as a brand new 1st-time user!`);

} catch (err) {
  console.error('❌ Failed to reset leads:', err);
} finally {
  db.close();
}
