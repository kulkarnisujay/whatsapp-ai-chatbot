import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface EnvironmentConfig {
  PORT: number;
  NODE_ENV: string;
  WHATSAPP_TOKEN: string;
  VERIFY_TOKEN: string;
  CALENDLY_URL: string;
}

function getEnvVariable(key: string, required: boolean = true): string {
  const value = process.env[key];
  if (required && (!value || value.trim() === '')) {
    throw new Error(
      `❌ Missing required environment variable: ${key}. ` +
      `Please check your .env file and ensure ${key} is set.`
    );
  }
  return value || '';
}

const env: EnvironmentConfig = {
  PORT: parseInt(getEnvVariable('PORT', false) || '3000', 10),
  NODE_ENV: getEnvVariable('NODE_ENV', false) || 'development',
  WHATSAPP_TOKEN: getEnvVariable('WHATSAPP_TOKEN'),
  VERIFY_TOKEN: getEnvVariable('VERIFY_TOKEN'),
  CALENDLY_URL: getEnvVariable('CALENDLY_URL', false) || '',
};

// Validate PORT is a valid number
if (isNaN(env.PORT) || env.PORT < 0 || env.PORT > 65535) {
  throw new Error(
    `❌ Invalid PORT value: "${process.env['PORT']}". PORT must be a number between 0 and 65535.`
  );
}

// Log loaded config in development (redact sensitive values)
if (env.NODE_ENV === 'development') {
  console.log('📋 Environment Configuration Loaded:');
  console.log(`   PORT:           ${env.PORT}`);
  console.log(`   NODE_ENV:       ${env.NODE_ENV}`);
  console.log(`   WHATSAPP_TOKEN: ${'*'.repeat(Math.min(env.WHATSAPP_TOKEN.length, 8))}...`);
  console.log(`   VERIFY_TOKEN:   ${'*'.repeat(Math.min(env.VERIFY_TOKEN.length, 8))}...`);
}

export default env;
