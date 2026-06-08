const crypto = require('node:crypto');

const mediaCodecs = [{
  kind: 'audio',
  mimeType: 'audio/opus',
  clockRate: 48000,
  channels: 2,
  parameters: { useinbandfec: 1, usedtx: 1 },
}];

class VoiceService {
  constructor(config, mediasoupModule = null) {
    this.config = config;
    this.mediasoup = mediasoupModule;
    this.rooms = new Map();
    this.worker = null;
  }

  async start() {
    this.mediasoup ||= require('mediasoup');
    this.worker = await this.mediasoup.createWorker({
      rtcMinPort: this.config.rtcMinPort,
      rtcMaxPort: this.config.rtcMaxPort,
      logLevel: process.env.MEDIASOUP_LOG_LEVEL || 'warn',
    });
    this.worker.on('died', () => {
      console.error('mediasoup worker died; exiting so the container can restart');
      setTimeout(() => process.exit(1), 2000);
    });
  }

  async getOrCreateRoom(roomId) {
    let room = this.rooms.get(roomId);
    if (room) return room;
    const router = await this.worker.createRouter({ mediaCodecs });
    room = { id: roomId, router, peers: new Map() };
    this.rooms.set(roomId, room);
    return room;
  }

  async join(socket, { roomId, userName, roomPassword }) {
    if (this.config.roomSecret && !this.safeEqual(roomPassword, this.config.roomSecret)) {
      throw new Error('Invalid voice room secret');
    }
    if (typeof roomId !== 'string' || !roomId.trim() || roomId.length > 256) throw new Error('Invalid roomId');
    if (socket.data.voicePeer) this.leave(socket);
    const room = await this.getOrCreateRoom(roomId.trim());
    const peer = {
      id: socket.id,
      userName: String(userName || 'Guest').trim().slice(0, 64) || 'Guest',
      muted: false,
      room,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
    };
    room.peers.set(peer.id, peer);
    socket.data.voicePeer = peer;
    return {
      peerId: peer.id,
      peers: [...room.peers.values()].map(this.peerSummary),
      existingProducers: [...room.peers.values()].flatMap((other) =>
        [...other.producers.values()].map((producer) => this.producerSummary(other, producer))),
    };
  }

  peerSummary(peer) {
    return { peerId: peer.id, userName: peer.userName, muted: peer.muted };
  }

  producerSummary(peer, producer) {
    return { producerId: producer.id, peerId: peer.id, userName: peer.userName, muted: peer.muted };
  }

  requirePeer(socket, roomId) {
    const peer = socket.data.voicePeer;
    if (!peer || peer.room.id !== roomId) throw new Error('Join the voice room first');
    return peer;
  }

  async createTransport(peer, direction) {
    if (!['send', 'recv'].includes(direction)) throw new Error('Invalid transport direction');
    const transport = await peer.room.router.createWebRtcTransport({
      listenIps: [{ ip: '0.0.0.0', announcedIp: this.config.publicIp }],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      appData: { direction },
    });
    peer.transports.set(transport.id, transport);
    transport.on('dtlsstatechange', (state) => state === 'closed' && transport.close());
    transport.on('close', () => peer.transports.delete(transport.id));
    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      sctpParameters: transport.sctpParameters,
    };
  }

  getTransport(peer, transportId, direction) {
    const transport = peer.transports.get(transportId);
    if (!transport || transport.appData.direction !== direction) throw new Error(`Unknown ${direction} transport`);
    return transport;
  }

  async produce(peer, transportId, rtpParameters, appData = {}) {
    const transport = this.getTransport(peer, transportId, 'send');
    const producer = await transport.produce({ kind: 'audio', rtpParameters, appData });
    peer.producers.set(producer.id, producer);
    producer.on('transportclose', () => peer.producers.delete(producer.id));
    return producer;
  }

  async consume(peer, transportId, producerId, rtpCapabilities) {
    const transport = this.getTransport(peer, transportId, 'recv');
    const owner = [...peer.room.peers.values()].find((candidate) => candidate.producers.has(producerId));
    if (!owner || owner.id === peer.id) throw new Error('Unknown remote producer');
    if (!peer.room.router.canConsume({ producerId, rtpCapabilities })) throw new Error('Cannot consume producer');
    const consumer = await transport.consume({ producerId, rtpCapabilities, paused: true });
    peer.consumers.set(consumer.id, consumer);
    consumer.on('transportclose', () => peer.consumers.delete(consumer.id));
    consumer.on('producerclose', () => peer.consumers.delete(consumer.id));
    return consumer;
  }

  closeProducer(peer, producerId) {
    const producer = peer.producers.get(producerId);
    if (!producer) return false;
    producer.close();
    peer.producers.delete(producerId);
    return true;
  }

  leave(socket) {
    const peer = socket.data.voicePeer;
    if (!peer) return null;
    for (const consumer of peer.consumers.values()) consumer.close();
    for (const producer of peer.producers.values()) producer.close();
    for (const transport of peer.transports.values()) transport.close();
    peer.room.peers.delete(peer.id);
    if (peer.room.peers.size === 0) {
      peer.room.router.close();
      this.rooms.delete(peer.room.id);
    }
    socket.data.voicePeer = null;
    return peer;
  }

  safeEqual(value, expected) {
    const left = Buffer.from(String(value || ''));
    const right = Buffer.from(String(expected));
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  }
}

module.exports = { VoiceService };
