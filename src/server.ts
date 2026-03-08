import app from './app';
import env from './config/env';
import reminderService from './services/reminder.service';

const { PORT, NODE_ENV } = env;

app.listen(PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  🚀 WhatsApp Chatbot Server');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  ✅ Server running on:  http://localhost:${PORT}`);
  console.log(`  🌍 Environment:        ${NODE_ENV}`);
  console.log(`  📡 Health check:       http://localhost:${PORT}/health`);
  console.log('═══════════════════════════════════════════════════════');
  console.log('');

  // ─── Start Background Workers ──────────────────────────────────────────
  reminderService.startCronJobs();
});
