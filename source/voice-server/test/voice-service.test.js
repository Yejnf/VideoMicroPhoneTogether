const test = require('node:test');
const assert = require('node:assert/strict');
const { VoiceService } = require('../src/voice-service');

function fakeRouter() {
  return {
    closed: false,
    close() { this.closed = true; },
  };
}

test('join returns current peers and existing audio producers', async () => {
  const service = new VoiceService({ roomSecret: 'secret' });
  service.worker = { createRouter: async () => fakeRouter() };
  const firstSocket = { id: 'first', data: {} };
  const secondSocket = { id: 'second', data: {} };
  await service.join(firstSocket, { roomId: 'room', userName: 'Alice', roomPassword: 'secret' });
  firstSocket.data.voicePeer.producers.set('producer-one', { id: 'producer-one' });
  const joined = await service.join(secondSocket, { roomId: 'room', userName: 'Bob', roomPassword: 'secret' });
  assert.deepEqual(joined.peers.map((peer) => peer.userName), ['Alice', 'Bob']);
  assert.deepEqual(joined.existingProducers, [{ producerId: 'producer-one', peerId: 'first', userName: 'Alice', muted: false }]);
});

test('join rejects an invalid room secret', async () => {
  const service = new VoiceService({ roomSecret: 'secret' });
  await assert.rejects(service.join({ id: 'peer', data: {} }, { roomId: 'room', roomPassword: 'wrong' }), /Invalid voice room secret/);
});

test('leave closes peer resources and empty room router', async () => {
  const service = new VoiceService({ roomSecret: '' });
  service.worker = { createRouter: async () => fakeRouter() };
  const socket = { id: 'peer', data: {} };
  await service.join(socket, { roomId: 'room', userName: 'Alice' });
  const router = socket.data.voicePeer.room.router;
  const closed = [];
  socket.data.voicePeer.consumers.set('consumer', { close: () => closed.push('consumer') });
  socket.data.voicePeer.producers.set('producer', { close: () => closed.push('producer') });
  socket.data.voicePeer.transports.set('transport', { close: () => closed.push('transport') });
  service.leave(socket);
  assert.deepEqual(closed, ['consumer', 'producer', 'transport']);
  assert.equal(router.closed, true);
  assert.equal(service.rooms.size, 0);
});
