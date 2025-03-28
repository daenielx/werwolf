# Werewolf Game

A web-based multiplayer implementation of the popular social deduction game Werewolf (also known as Mafia) using React, Node.js, and Socket.io.

## Features

- Real-time multiplayer gameplay with Socket.io
- Lobby system for creating and joining game rooms
- Special roles including Werewolf, Villager, Seer, and Doctor
- Day/night cycle with different actions for each role
- Real-time chat with a special werewolf-only chat during night phase
- Beautiful UI with animations
- Responsive design for desktop and mobile

## Roles

- **Villager**: Standard role. Can vote during the day, but has no special abilities.
- **Werewolf**: Can secretly communicate with other werewolves at night to choose a victim.
- **Seer**: Can check one player each night to determine if they are a werewolf.
- **Doctor**: Can protect one player each night from being killed by werewolves.

## How to Play

1. Create a room or join an existing one with a room code
2. Wait for at least 4 players to join
3. The host can start the game
4. Each player is assigned a role secretly
5. The game alternates between night and day phases:
   - During night, werewolves choose a victim, and special roles take their actions
   - During day, all players discuss and vote to eliminate a suspected werewolf
6. The game continues until all werewolves are eliminated (village wins) or werewolves equal/outnumber villagers (werewolves win)

## Technologies Used

- **Frontend**: React, TypeScript, Styled Components, Framer Motion
- **Backend**: Node.js, Express, Socket.io
- **State Management**: React Context API

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Development Setup

1. Clone the repository
```bash
git clone https://github.com/yourusername/werewolf-game.git
cd werewolf-game
```

2. Install dependencies for both client and server
```bash
npm run install:all
```

3. Start the development servers (both client and server)
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000`

## Deployment

The application can be deployed in several ways depending on your preferences:

### Option 1: Heroku Deployment (Server + Client)

1. Create a new Heroku app
```bash
heroku create your-werewolf-game
```

2. Set environment variables
```bash
heroku config:set NODE_ENV=production
heroku config:set CLIENT_URL=https://your-werewolf-client-url.com # If frontend is deployed separately
```

3. Deploy to Heroku
```bash
git push heroku main
```

### Option 2: Separate Deployment (Frontend + Backend)

#### Backend (Server) Deployment - Heroku

1. Create a new Heroku app for the backend
```bash
heroku create your-werewolf-game-server
```

2. Set environment variables
```bash
heroku config:set NODE_ENV=production
heroku config:set CLIENT_URL=https://your-werewolf-client-url.com
```

3. Deploy server to Heroku
```bash
git subtree push --prefix server heroku main
```

#### Frontend (Client) Deployment - Netlify/Vercel

1. Update production environment variables in `.env.production`
```
REACT_APP_API_URL=https://your-werewolf-server-url.herokuapp.com
```

2. Build the client
```bash
cd client && npm run build
```

3. Deploy to Netlify using their CLI or dashboard
```bash
netlify deploy
```

Or for Vercel:
```bash
vercel
```

### Option 3: Docker Deployment

1. Build the Docker image
```bash
docker build -t werewolf-game .
```

2. Run the Docker container
```bash
docker run -p 3001:3001 -e NODE_ENV=production -e CLIENT_URL=https://your-client-url.com werewolf-game
```

## License

MIT License 