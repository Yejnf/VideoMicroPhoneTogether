const path = require('node:path');
const dns = require('node:dns').promises;
require('dotenv').config({ path: process.env.ENV_FILE || path.join(process.cwd(), '.env') });

function numberFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] || String(fallback), 10);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);
  return value;
}

const config = {
  port: numberFromEnv('PORT', 3000),
  publicIp: process.env.PUBLIC_IP || '',
  domain: process.env.DOMAIN || '',
  rtcMinPort: numberFromEnv('RTC_MIN_PORT', 40000),
  rtcMaxPort: numberFromEnv('RTC_MAX_PORT', 40100),
  roomSecret: process.env.ROOM_SECRET || '',
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

config.resolvePublicIp = async () => {
  if (config.publicIp) return config.publicIp;
  if (!config.domain) throw new Error('PUBLIC_IP or DOMAIN is required for mediasoup announcedIp');
  config.publicIp = (await dns.lookup(config.domain, { family: 4 })).address;
  return config.publicIp;
};

module.exports = config;
