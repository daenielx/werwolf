FROM node:16 as build

# Set working directory
WORKDIR /app

# Copy all files
COPY . .

# Install dependencies and build (server and client)
RUN npm install
RUN npm run install:all
RUN npm run build

# Production stage
FROM node:16-slim

WORKDIR /app

# Copy built assets from build stage
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/build ./client/build
COPY --from=build /app/server/package.json ./server/
COPY --from=build /app/package.json .

# Install only production dependencies
RUN npm install --only=production
RUN cd server && npm install --only=production

# Expose the port the app runs on
EXPOSE 3001

# Start the application
CMD ["npm", "start"] 