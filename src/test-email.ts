import dotenv from 'dotenv';
import path from 'path';

// Load environment variables explicitly
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import emailService from './services/email.service';

async function testEmail() {
  console.log('🧪 Testing Email Service Config');
  console.log('EMAIL_USER:', process.env.EMAIL_USER);
  console.log('PASS Set:', !!process.env.EMAIL_PASS);

  const testEmailAddress = process.env.EMAIL_USER || '';
  console.log(`\n📨 Attempting to send test brochure to: ${testEmailAddress}`);

  const success = await emailService.sendCompanyBrochure(testEmailAddress, 'Test User');

  if (success) {
    console.log('\n✅ 🚨 TEST SUCCESSFUL! The email actually sent.');
  } else {
    console.log('\n❌ 🚨 TEST FAILED! The email did not send.');
  }
}

testEmail();
