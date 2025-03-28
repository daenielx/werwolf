export enum Role {
  VILLAGER = 'VILLAGER',
  WEREWOLF = 'WEREWOLF',
  SEER = 'SEER',
  DOCTOR = 'DOCTOR'
}

export enum GamePhase {
  LOBBY = 'LOBBY',
  NIGHT = 'NIGHT',
  DAY = 'DAY',
  RESULTS = 'RESULTS',
  GAME_OVER = 'GAME_OVER'
}

export interface Player {
  id: string;
  username: string;
  role: Role | null;
  isAlive: boolean;
  isReady: boolean;
}

export interface GameRoom {
  roomCode: string;
  host: string;
  players: Record<string, Player>;
  phase: GamePhase;
  dayCount: number;
  votes: Record<string, string>;
  werewolfVotes: Record<string, string>;
  doctorSave: string | null;
  seerChecks: Record<string, Role>;
  eliminatedTonight: string | null;
  messages: Array<{
    sender: string;
    content: string;
    isWerewolfChat: boolean;
  }>;
  roleHistory: Array<{
    id: string;
    username: string;
    role: Role;
    dayEliminated: number;
  }>;
  gameWinner: 'VILLAGERS' | 'WEREWOLVES' | null;
} 