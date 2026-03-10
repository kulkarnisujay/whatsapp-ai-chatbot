import express from 'express';
import { NotificationService } from './src/services/notification.service';

const app = express();
app.use(express.json());

app.post('/test-webhook', (req, res) => {
  console.log('✅ Webhook received successfully!');
  console.log('Payload:', JSON.stringify(req.body, null, 2));
  res.status(200).send('OK');

  // Exit script after successful test
  setTimeout(() => process.exit(0), 1000);
});

app.listen(3005, async () => {
  console.log('🧪 Test webhook server listening on port 3005');

  process.env['NOTIFICATION_WEBHOOK_URL'] = 'http://localhost:3005/test-webhook';
  process.env['NOTIFICATION_PLATFORM'] = 'slack';
  const testService = new NotificationService();

  console.log('🔔 Sending test notification...');
  await testService.notifyNewLead('John Doe', '+1234567890');
});
