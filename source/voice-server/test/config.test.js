const test = require('node:test');
const assert = require('node:assert/strict');

const configPath = require.resolve('../src/config');

function loadConfig(env) {
  const originalEnv = { ...process.env };
  delete require.cache[configPath];
  process.env = { ...originalEnv, ...env };
  try {
    return require('../src/config');
  } finally {
    process.env = originalEnv;
    delete require.cache[configPath];
  }
}

test('config rejects placeholder room secrets by default', () => {
  assert.throws(
    () => loadConfig({ ROOM_SECRET: 'generate-a-long-random-secret-here', ALLOW_OPEN_ROOMS: '' }),
    /ROOM_SECRET must be set/,
  );
});

test('config allows public rooms only when explicitly enabled', () => {
  const config = loadConfig({ ROOM_SECRET: '', ALLOW_OPEN_ROOMS: 'true' });
  assert.equal(config.allowOpenRooms, true);
  assert.equal(config.roomSecret, '');
});

test('config accepts a non-placeholder room secret', () => {
  const config = loadConfig({ ROOM_SECRET: 'a-real-random-secret-for-tests', ALLOW_OPEN_ROOMS: 'false' });
  assert.equal(config.allowOpenRooms, false);
  assert.equal(config.roomSecret, 'a-real-random-secret-for-tests');
});

test('config rejects invalid RTC port ranges', () => {
  assert.throws(
    () => loadConfig({ ROOM_SECRET: 'a-real-random-secret-for-tests', RTC_MIN_PORT: '5000', RTC_MAX_PORT: '4000' }),
    /RTC_MIN_PORT must be less than or equal to RTC_MAX_PORT/,
  );
});
