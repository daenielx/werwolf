import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GameManager } from './game/GameManager';

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? CLIENT_URL : "*"
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? CLIENT_URL : "*",
    methods: ["GET", "POST"]
  }
});

// Initialize game manager
const gameManager = new GameManager(io);

// Socket connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join lobby
  socket.on('join_lobby', (data: { username: string, roomCode: string }) => {
    console.log(`User ${data.username} (${socket.id}) attempting to join room: ${data.roomCode}`);
    gameManager.joinLobby(socket, data.username, data.roomCode);
  });

  // Create room
  socket.on('create_room', (data: { username: string }) => {
    console.log(`User ${data.username} (${socket.id}) creating a new room`);
    const roomCode = gameManager.createRoom(socket, data.username);
    console.log(`Room created: ${roomCode}`);
    socket.emit('room_created', { roomCode });
  });

  // Start game
  socket.on('start_game', (data: { roomCode: string }) => {
    gameManager.startGame(data.roomCode);
  });

  // Day vote
  socket.on('day_vote', (data: { roomCode: string, targetId: string }) => {
    gameManager.handleDayVote(socket.id, data.roomCode, data.targetId);
  });

  // Werewolf vote
  socket.on('werewolf_vote', (data: { roomCode: string, targetId: string }) => {
    gameManager.handleWerewolfVote(socket.id, data.roomCode, data.targetId);
  });

  // Seer action
  socket.on('seer_check', (data: { roomCode: string, targetId: string }) => {
    gameManager.handleSeerCheck(socket.id, data.roomCode, data.targetId);
  });

  // Doctor action
  socket.on('doctor_save', (data: { roomCode: string, targetId: string }) => {
    gameManager.handleDoctorSave(socket.id, data.roomCode, data.targetId);
  });

  // Send chat message
  socket.on('send_message', (data: { roomCode: string, message: string, isWerewolfChat: boolean }) => {
    gameManager.handleChatMessage(socket.id, data.roomCode, data.message, data.isWerewolfChat);
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    gameManager.handleDisconnect(socket.id);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 