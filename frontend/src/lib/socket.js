import { io } from 'socket.io-client';
import { BASE } from './api';

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(BASE, { autoConnect: true, transports: ['websocket', 'polling'] });
  }
  return socket;
}

export function joinRoom(room) {
  getSocket().emit('join', { room });
}

export function leaveRoom(room) {
  getSocket().emit('leave', { room });
}
