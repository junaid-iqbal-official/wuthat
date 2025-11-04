'use strict';

// Shared runtime state (works across all handlers)
module.exports = {
  connectedUsers: new Map(),   // userId -> Set(socketIds)
  userHeartbeatMap: new Map(), // userId -> timeout
  activeCallRooms: new Map(),  // callId -> Set(socketIds)
  socketToCalls: new Map(),    // socketId -> callId
  peerConnections: new Map()   // socketId -> peerId
};
