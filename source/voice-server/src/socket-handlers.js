function registerSocketHandlers(io, voiceService) {
  io.on('connection', (socket) => {
    const ackEvent = (event, handler) => socket.on(event, async (payload = {}, ack = () => {}) => {
      try { ack({ ok: true, data: await handler(payload) }); }
      catch (error) {
        console.warn(`${event} failed for ${socket.id}:`, error.message);
        ack({ ok: false, error: error.message });
        socket.emit('error', { message: error.message });
      }
    });

    ackEvent('join-room', async (payload) => {
      const result = await voiceService.join(socket, payload);
      socket.join(socket.data.voicePeer.room.id);
      socket.emit('room-joined', result);
      return result;
    });
    ackEvent('get-rtp-capabilities', async ({ roomId }) => voiceService.requirePeer(socket, roomId).room.router.rtpCapabilities);
    ackEvent('create-webrtc-transport', async ({ roomId, direction }) => voiceService.createTransport(voiceService.requirePeer(socket, roomId), direction));
    ackEvent('connect-transport', async ({ roomId, transportId, dtlsParameters }) => {
      const peer = voiceService.requirePeer(socket, roomId);
      const transport = peer.transports.get(transportId);
      if (!transport) throw new Error('Unknown transport');
      await transport.connect({ dtlsParameters });
      return {};
    });
    ackEvent('produce-audio', async ({ roomId, transportId, rtpParameters, appData }) => {
      const peer = voiceService.requirePeer(socket, roomId);
      const producer = await voiceService.produce(peer, transportId, rtpParameters, appData);
      producer.on('transportclose', () => io.to(roomId).emit('producer-closed', { producerId: producer.id, peerId: peer.id }));
      const message = voiceService.producerSummary(peer, producer);
      socket.to(roomId).emit('new-audio-producer', message);
      return { id: producer.id };
    });
    ackEvent('consume-audio', async ({ roomId, transportId, producerId, rtpCapabilities }) => {
      const peer = voiceService.requirePeer(socket, roomId);
      const consumer = await voiceService.consume(peer, transportId, producerId, rtpCapabilities);
      return { id: consumer.id, producerId, kind: consumer.kind, rtpParameters: consumer.rtpParameters };
    });
    ackEvent('resume-consumer', async ({ roomId, consumerId }) => {
      const peer = voiceService.requirePeer(socket, roomId);
      const consumer = peer.consumers.get(consumerId);
      if (!consumer) throw new Error('Unknown consumer');
      await consumer.resume();
      return {};
    });
    ackEvent('set-muted', async ({ roomId, muted }) => {
      const peer = voiceService.requirePeer(socket, roomId);
      peer.muted = Boolean(muted);
      io.to(roomId).emit('peer-muted', { peerId: peer.id, muted: peer.muted });
      return {};
    });
    ackEvent('close-producer', async ({ roomId, producerId }) => {
      const peer = voiceService.requirePeer(socket, roomId);
      if (voiceService.closeProducer(peer, producerId)) io.to(roomId).emit('producer-closed', { producerId, peerId: peer.id });
      return {};
    });
    ackEvent('leave-room', async ({ roomId }) => {
      const peer = voiceService.requirePeer(socket, roomId);
      const producerIds = [...peer.producers.keys()];
      voiceService.leave(socket);
      socket.leave(roomId);
      for (const producerId of producerIds) socket.to(roomId).emit('producer-closed', { producerId, peerId: peer.id });
      socket.to(roomId).emit('peer-left', { peerId: peer.id });
      return {};
    });
    socket.on('disconnect', () => {
      const peer = socket.data.voicePeer;
      if (!peer) return;
      const roomId = peer.room.id;
      const producerIds = [...peer.producers.keys()];
      voiceService.leave(socket);
      for (const producerId of producerIds) socket.to(roomId).emit('producer-closed', { producerId, peerId: peer.id });
      socket.to(roomId).emit('peer-left', { peerId: peer.id });
    });
  });
}
module.exports = { registerSocketHandlers };
