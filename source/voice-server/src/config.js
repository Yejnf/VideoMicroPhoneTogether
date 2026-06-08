const path = require('node:path');
const dns = require('node:dns').promises;

try {
  require('dotenv').config({ path: process.env.ENV_FILE || path.join(process.cwd(), '.env') });
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error;
}

function numberFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || String(fallback), 10);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);
  return value;
}

function booleanFromEnv(name, fallback = false) {
  const rawValue = process.env[name];
  if (rawValue == null || rawValue === '') return fallback;
  const value = rawValue.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(value)) return true;
  if (['0', 'false', 'no', 'off'].includes(value)) return false;
  throw new Error(`${name} must be true or false`);
}

const roomSecret = process.env.ROOM_SECRET || '';
const allowOpenRooms = booleanFromEnv('ALLOW_OPEN_ROOMS', false);
const placeholderSecrets = new Set([
  '',
  'change-me',
  'replace-with-a-long-random-secret',
  'generate-a-long-random-secret-here',
]);
if (!allowOpenRooms && placeholderSecrets.has(roomSecret)) {
  throw new Error('ROOM_SECRET must be set to a strong random value, or set ALLOW_OPEN_ROOMS=true to intentionally allow public voice rooms');
}

const config = {
  port: numberFromEnv('PORT', 3000),
  publicIp: process.env.PUBLIC_IP || '',
  domain: process.env.DOMAIN || '',
  rtcMinPort: numberFromEnv('RTC_MIN_PORT', 40000),
  rtcMaxPort: numberFromEnv('RTC_MAX_PORT', 40100),
  roomSecret,
  allowOpenRooms,
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

if (config.rtcMinPort > config.rtcMaxPort) {
  throw new Error('RTC_MIN_PORT must be less than or equal to RTC_MAX_PORT');
}

config.resolvePublicIp = async () => {
  if (config.publicIp) return config.publicIp;
  if (!config.domain) throw new Error('PUBLIC_IP or DOMAIN is required for mediasoup announcedIp');
  config.publicIp = (await dns.lookup(config.domain, { family: 4 })).address;
  return config.publicIp;
};

module.exports = config;
