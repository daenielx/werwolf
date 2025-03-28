import { Server, Socket } from 'socket.io';
import { GamePhase, GameRoom, Player, Role } from '../types';

export class GameManager {
  private io: Server;
  private rooms: Record<string, GameRoom> = {};
  private playerRooms: Record<string, string> = {};

  constructor(io: Server) {
    this.io = io;
  }

  // Generate a unique room code
  private generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Create a new game room
  public createRoom(socket: Socket, username: string): string {
    const roomCode = this.generateRoomCode();
    
    // Create new player
    const player: Player = {
      id: socket.id,
      username,
      role: null,
      isAlive: true,
      isReady: false
    };

    // Create new room
    this.rooms[roomCode] = {
      roomCode,
      host: socket.id,
      players: { [socket.id]: player },
      phase: GamePhase.LOBBY,
      dayCount: 0,
      votes: {},
      werewolfVotes: {},
      doctorSave: null,
      seerChecks: {},
      eliminatedTonight: null,
      messages: [],
      roleHistory: [],
      gameWinner: null
    };

    // Map player to room
    this.playerRooms[socket.id] = roomCode;

    // Join socket room
    socket.join(roomCode);

    return roomCode;
  }

  // Join an existing room
  public joinLobby(socket: Socket, username: string, roomCode: string): void {
    console.log(`GameManager: Attempting to join room ${roomCode} with username ${username}`);
    
    // Check if room exists
    if (!this.rooms[roomCode]) {
      console.log(`GameManager: Room ${roomCode} does not exist`);
      socket.emit('error', { message: 'Room does not exist' });
      return;
    }

    // Check if game has already started
    if (this.rooms[roomCode].phase !== GamePhase.LOBBY) {
      console.log(`GameManager: Room ${roomCode} game has already started`);
      socket.emit('error', { message: 'Game has already started' });
      return;
    }

    // Create new player
    const player: Player = {
      id: socket.id,
      username,
      role: null,
      isAlive: true,
      isReady: false
    };

    // Add player to room
    this.rooms[roomCode].players[socket.id] = player;
    this.playerRooms[socket.id] = roomCode;

    // Join socket room
    socket.join(roomCode);
    
    console.log(`GameManager: Player ${username} (${socket.id}) successfully joined room ${roomCode}`);
    console.log(`GameManager: Room ${roomCode} now has ${Object.keys(this.rooms[roomCode].players).length} players`);

    // Send a specific response for this player that they joined the room
    socket.emit('room_joined', { 
      roomCode,
      isHost: socket.id === this.rooms[roomCode].host
    });

    // Notify room of new player
    this.io.to(roomCode).emit('lobby_update', {
      players: Object.values(this.rooms[roomCode].players),
      host: this.rooms[roomCode].host
    });
  }

  // Start the game
  public startGame(roomCode: string): void {
    const room = this.rooms[roomCode];
    if (!room) return;

    const players = Object.values(room.players);
    
    // Check if enough players (minimum 4)
    if (players.length < 4) {
      this.io.to(roomCode).emit('error', { message: 'Need at least 4 players to start' });
      return;
    }

    // Assign roles
    this.assignRoles(roomCode);

    // Update game phase
    room.phase = GamePhase.NIGHT;
    room.dayCount = 1;

    // Notify players of their roles
    this.notifyRoles(roomCode);

    // Start night phase
    this.startNightPhase(roomCode);
  }

  // Assign roles to players
  private assignRoles(roomCode: string): void {
    const room = this.rooms[roomCode];
    const players = Object.values(room.players);
    const playerIds = Object.keys(room.players);
    
    // Shuffle player IDs
    const shuffledIds = [...playerIds];
    for (let i = shuffledIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledIds[i], shuffledIds[j]] = [shuffledIds[j], shuffledIds[i]];
    }
    
    // Calculate number of each role
    const playerCount = players.length;
    let werewolfCount = Math.floor(playerCount / 4);
    if (werewolfCount < 1) werewolfCount = 1;
    
    const specialRoles = {
      [Role.SEER]: 1,
      [Role.DOCTOR]: playerCount >= 6 ? 1 : 0
    };
    
    // Assign roles
    let currentIndex = 0;
    
    // Assign werewolves
    for (let i = 0; i < werewolfCount; i++) {
      room.players[shuffledIds[currentIndex]].role = Role.WEREWOLF;
      currentIndex++;
    }
    
    // Assign special roles
    for (const [role, count] of Object.entries(specialRoles)) {
      for (let i = 0; i < count; i++) {
        if (currentIndex < shuffledIds.length) {
          room.players[shuffledIds[currentIndex]].role = role as Role;
          currentIndex++;
        }
      }
    }
    
    // Assign remaining players as villagers
    while (currentIndex < shuffledIds.length) {
      room.players[shuffledIds[currentIndex]].role = Role.VILLAGER;
      currentIndex++;
    }
  }

  // Notify players of their roles
  private notifyRoles(roomCode: string): void {
    const room = this.rooms[roomCode];
    
    // Send role info to each player
    for (const [playerId, player] of Object.entries(room.players)) {
      this.io.to(playerId).emit('role_assigned', {
        role: player.role,
        players: Object.values(room.players).map(p => ({
          id: p.id,
          username: p.username,
          isAlive: p.isAlive,
          // Only reveal werewolf roles to other werewolves
          role: player.role === Role.WEREWOLF && p.role === Role.WEREWOLF ? Role.WEREWOLF : null
        }))
      });
    }
  }

  // Start night phase
  private startNightPhase(roomCode: string): void {
    const room = this.rooms[roomCode];
    
    // Reset votes and actions
    room.votes = {};
    room.werewolfVotes = {};
    room.doctorSave = null;
    room.eliminatedTonight = null;
    
    // Update game phase
    room.phase = GamePhase.NIGHT;
    
    // Notify players of night phase
    this.io.to(roomCode).emit('phase_change', {
      phase: GamePhase.NIGHT,
      dayCount: room.dayCount,
      timeLeft: 30 // 30 seconds for night phase
    });
    
    // Schedule day phase after night actions (30 seconds)
    setTimeout(() => {
      this.resolveNightPhase(roomCode);
    }, 30000);
  }

  // Resolve night phase
  private resolveNightPhase(roomCode: string): void {
    const room = this.rooms[roomCode];
    if (!room || room.phase !== GamePhase.NIGHT) return;
    
    // Calculate werewolf victim
    this.resolveWerewolfVotes(roomCode);
    
    // Check if doctor saved the victim
    if (room.eliminatedTonight && room.doctorSave === room.eliminatedTonight) {
      room.eliminatedTonight = null;
    }
    
    // If there was a victim, mark them as dead
    if (room.eliminatedTonight) {
      const victim = room.players[room.eliminatedTonight];
      if (victim) {
        victim.isAlive = false;
        
        // Add to role history
        room.roleHistory.push({
          id: victim.id,
          username: victim.username,
          role: victim.role!,
          dayEliminated: room.dayCount
        });
      }
    }
    
    // Start day phase
    this.startDayPhase(roomCode);
    
    // Check if game is over
    this.checkGameOver(roomCode);
  }

  // Resolve werewolf votes
  private resolveWerewolfVotes(roomCode: string): void {
    const room = this.rooms[roomCode];
    
    // Count votes
    const voteCounts: Record<string, number> = {};
    for (const targetId of Object.values(room.werewolfVotes)) {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    }
    
    // Find the player with the most votes
    let maxVotes = 0;
    let victim: string | null = null;
    
    for (const [targetId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        victim = targetId;
      }
    }
    
    room.eliminatedTonight = victim;
  }

  // Start day phase
  private startDayPhase(roomCode: string): void {
    const room = this.rooms[roomCode];
    
    // Update game phase
    room.phase = GamePhase.DAY;
    
    // Reset votes
    room.votes = {};
    
    // Notify players of day phase and night results
    this.io.to(roomCode).emit('phase_change', {
      phase: GamePhase.DAY,
      dayCount: room.dayCount,
      eliminatedPlayer: room.eliminatedTonight ? {
        id: room.eliminatedTonight,
        username: room.players[room.eliminatedTonight]?.username
      } : null,
      timeLeft: 120 // 2 minutes for day phase
    });
    
    // Schedule results phase after day discussion (2 minutes)
    setTimeout(() => {
      this.resolveDayPhase(roomCode);
    }, 120000);
  }

  // Resolve day phase
  private resolveDayPhase(roomCode: string): void {
    const room = this.rooms[roomCode];
    if (!room || room.phase !== GamePhase.DAY) return;
    
    // Count votes
    const voteCounts: Record<string, number> = {};
    for (const targetId of Object.values(room.votes)) {
      voteCounts[targetId] = (voteCounts[targetId] || 0) + 1;
    }
    
    // Find the player with the most votes
    let maxVotes = 0;
    let eliminatedPlayerId: string | null = null;
    
    for (const [targetId, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        eliminatedPlayerId = targetId;
      }
    }
    
    // Execute the player with the most votes
    if (eliminatedPlayerId && room.players[eliminatedPlayerId]) {
      const eliminatedPlayer = room.players[eliminatedPlayerId];
      eliminatedPlayer.isAlive = false;
      
      // Add to role history
      room.roleHistory.push({
        id: eliminatedPlayer.id,
        username: eliminatedPlayer.username,
        role: eliminatedPlayer.role!,
        dayEliminated: room.dayCount
      });
      
      // Notify players of result
      this.io.to(roomCode).emit('day_result', {
        eliminatedPlayer: {
          id: eliminatedPlayer.id,
          username: eliminatedPlayer.username,
          role: eliminatedPlayer.role
        }
      });
    }
    
    // Check if game is over
    if (this.checkGameOver(roomCode)) {
      return;
    }
    
    // Increment day count
    room.dayCount++;
    
    // Start next night phase after a short delay
    setTimeout(() => {
      this.startNightPhase(roomCode);
    }, 5000);
  }

  // Handle day vote
  public handleDayVote(playerId: string, roomCode: string, targetId: string): void {
    const room = this.rooms[roomCode];
    if (!room || room.phase !== GamePhase.DAY) return;
    
    const player = room.players[playerId];
    
    // Check if player is alive
    if (!player || !player.isAlive) return;
    
    // Record the vote
    room.votes[playerId] = targetId;
    
    // Notify room of vote
    this.io.to(roomCode).emit('vote_update', {
      voteCount: Object.values(room.votes).length,
      totalAlive: Object.values(room.players).filter(p => p.isAlive).length
    });
  }

  // Handle werewolf vote
  public handleWerewolfVote(playerId: string, roomCode: string, targetId: string): void {
    const room = this.rooms[roomCode];
    if (!room || room.phase !== GamePhase.NIGHT) return;
    
    const player = room.players[playerId];
    
    // Check if player is a werewolf and alive
    if (!player || !player.isAlive || player.role !== Role.WEREWOLF) return;
    
    // Record the vote
    room.werewolfVotes[playerId] = targetId;
    
    // Notify other werewolves of vote
    Object.values(room.players)
      .filter(p => p.role === Role.WEREWOLF && p.isAlive)
      .forEach(werewolf => {
        this.io.to(werewolf.id).emit('werewolf_vote_update', {
          voter: player.username,
          target: room.players[targetId]?.username,
          voteCount: Object.keys(room.werewolfVotes).length,
          totalWerewolves: Object.values(room.players).filter(p => p.role === Role.WEREWOLF && p.isAlive).length
        });
      });
  }

  // Handle seer check
  public handleSeerCheck(playerId: string, roomCode: string, targetId: string): void {
    const room = this.rooms[roomCode];
    if (!room || room.phase !== GamePhase.NIGHT) return;
    
    const player = room.players[playerId];
    const target = room.players[targetId];
    
    // Check if player is a seer and alive and target is valid
    if (!player || !player.isAlive || player.role !== Role.SEER || !target) return;
    
    // Record the check
    room.seerChecks[targetId] = target.role!;
    
    // Notify seer of result
    this.io.to(playerId).emit('seer_result', {
      targetUsername: target.username,
      isWerewolf: target.role === Role.WEREWOLF
    });
  }

  // Handle doctor save
  public handleDoctorSave(playerId: string, roomCode: string, targetId: string): void {
    const room = this.rooms[roomCode];
    if (!room || room.phase !== GamePhase.NIGHT) return;
    
    const player = room.players[playerId];
    
    // Check if player is a doctor and alive
    if (!player || !player.isAlive || player.role !== Role.DOCTOR) return;
    
    // Record the save
    room.doctorSave = targetId;
    
    // Notify doctor of action
    this.io.to(playerId).emit('doctor_result', {
      targetUsername: room.players[targetId]?.username
    });
  }

  // Handle chat message
  public handleChatMessage(playerId: string, roomCode: string, message: string, isWerewolfChat: boolean): void {
    const room = this.rooms[roomCode];
    if (!room) return;
    
    const player = room.players[playerId];
    if (!player || !player.isAlive) return;
    
    // If werewolf chat, only werewolves can send/receive
    if (isWerewolfChat) {
      if (player.role !== Role.WEREWOLF || room.phase !== GamePhase.NIGHT) return;
      
      // Add message to room history
      room.messages.push({
        sender: player.username,
        content: message,
        isWerewolfChat: true
      });
      
      // Send only to werewolves
      const werewolfIds = Object.values(room.players)
        .filter(p => p.role === Role.WEREWOLF && p.isAlive)
        .map(p => p.id);
      
      werewolfIds.forEach(id => {
        this.io.to(id).emit('receive_message', {
          sender: player.username,
          content: message,
          isWerewolfChat: true
        });
      });
    } else {
      // Regular chat - only during day phase
      if (room.phase !== GamePhase.DAY) return;
      
      // Add message to room history
      room.messages.push({
        sender: player.username,
        content: message,
        isWerewolfChat: false
      });
      
      // Send to all players
      this.io.to(roomCode).emit('receive_message', {
        sender: player.username,
        content: message,
        isWerewolfChat: false
      });
    }
  }

  // Check if game is over
  private checkGameOver(roomCode: string): boolean {
    const room = this.rooms[roomCode];
    if (!room) return false;
    
    const players = Object.values(room.players);
    const aliveWerewolves = players.filter(p => p.isAlive && p.role === Role.WEREWOLF).length;
    const aliveVillagers = players.filter(p => p.isAlive && p.role !== Role.WEREWOLF).length;
    
    // Game over conditions
    if (aliveWerewolves === 0) {
      // Villagers win
      room.gameWinner = 'VILLAGERS';
      this.endGame(roomCode);
      return true;
    } else if (aliveWerewolves >= aliveVillagers) {
      // Werewolves win
      room.gameWinner = 'WEREWOLVES';
      this.endGame(roomCode);
      return true;
    }
    
    return false;
  }

  // End the game
  private endGame(roomCode: string): void {
    const room = this.rooms[roomCode];
    
    // Update game phase
    room.phase = GamePhase.GAME_OVER;
    
    // Notify players of game result
    this.io.to(roomCode).emit('game_over', {
      winner: room.gameWinner,
      roleReveal: Object.values(room.players).map(p => ({
        id: p.id,
        username: p.username,
        role: p.role
      })),
      roleHistory: room.roleHistory
    });
  }

  // Handle player disconnect
  public handleDisconnect(playerId: string): void {
    // Check if player was in a room
    const roomCode = this.playerRooms[playerId];
    if (!roomCode || !this.rooms[roomCode]) return;
    
    const room = this.rooms[roomCode];
    const player = room.players[playerId];
    
    // Remove player from room
    delete room.players[playerId];
    delete this.playerRooms[playerId];
    
    // If room is empty, delete it
    if (Object.keys(room.players).length === 0) {
      delete this.rooms[roomCode];
      return;
    }
    
    // If host left, assign new host
    if (room.host === playerId) {
      room.host = Object.keys(room.players)[0];
    }
    
    // If game is in progress, mark player as dead
    if (room.phase !== GamePhase.LOBBY && player) {
      // Add to role history if they had a role
      if (player.role) {
        room.roleHistory.push({
          id: player.id,
          username: player.username,
          role: player.role,
          dayEliminated: room.dayCount
        });
      }
      
      // Check if game is over
      this.checkGameOver(roomCode);
    }
    
    // Update remaining players
    this.io.to(roomCode).emit('player_left', {
      playerId,
      username: player?.username,
      newHost: room.host
    });
  }
} 