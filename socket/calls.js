'use strict';

module.exports = (io, socket, { models, state }) => {
  const { Call, CallParticipant } = models;

  // === Join Call Room ===
  socket.on('joinCall', ({ callId, userId }) => {
    if (!callId || !userId) return;

    socket.join(`call_${callId}`);

    if (!state.activeCallRooms.has(callId)) {
      state.activeCallRooms.set(callId, new Set());
    }
    state.activeCallRooms.get(callId).add(socket.id);
    state.socketToCalls.set(socket.id, callId);

    io.to(`call_${callId}`).emit('userJoinedCall', { userId });
  });

  // === Leave Call ===
  socket.on('leaveCall', ({ callId, userId }) => {
    if (!callId || !userId) return;

    socket.leave(`call_${callId}`);
    if (state.activeCallRooms.has(callId)) {
      state.activeCallRooms.get(callId).delete(socket.id);
      if (state.activeCallRooms.get(callId).size === 0) {
        state.activeCallRooms.delete(callId);
      }
    }
    state.socketToCalls.delete(socket.id);

    io.to(`call_${callId}`).emit('userLeftCall', { userId });
  });

  // === Call Signals (WebRTC) ===
  socket.on('callSignal', ({ callId, signal, from, to }) => {
    io.to(`user_${to}`).emit('callSignal', { callId, signal, from });
  });

  // === End Call ===
  socket.on('endCall', async ({ callId, endedBy }) => {
    if (!callId) return;

    io.to(`call_${callId}`).emit('callEnded', { callId, endedBy });

    // Cleanup memory
    if (state.activeCallRooms.has(callId)) {
      state.activeCallRooms.delete(callId);
    }

    for (const [sid, cid] of state.socketToCalls.entries()) {
      if (cid === callId) state.socketToCalls.delete(sid);
    }

    await Call.update(
      { status: 'ended', ended_by: endedBy, ended_at: new Date() },
      { where: { id: callId } }
    );

  });
};
