let ioInstance = null;

function initIO(io) {
  ioInstance = io;
  io.on('connection', (socket) => {
    socket.on('join', ({ room }) => {
      if (room) socket.join(room);
    });
    socket.on('leave', ({ room }) => {
      if (room) socket.leave(room);
    });
  });
}

function getIO() {
  if (!ioInstance) throw new Error('Socket.IO not initialized');
  return ioInstance;
}

// Emits to the emergency room, the assigned provider's room, the requesting user's room, and the admin monitor room.
function emitEmergencyEvent(event, emergency) {
  const io = getIO();
  const payload = { event, emergency, at: new Date().toISOString() };
  io.to(`emergency:${emergency.id}`).emit(event, payload);
  if (emergency.assignedProviderId) io.to(`provider:${emergency.assignedProviderId}`).emit(event, payload);
  if (emergency.userId) io.to(`user:${emergency.userId}`).emit(event, payload);
  io.to('admin:emergencies').emit(event, payload);
}

module.exports = { initIO, getIO, emitEmergencyEvent };
