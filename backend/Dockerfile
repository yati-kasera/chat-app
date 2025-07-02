# Use Node.js LTS as the base image for building
FROM node:18 AS builder

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the NestJS app
RUN npm run build

# --- Production image ---
FROM node:18 AS runner
WORKDIR /app

# Copy only production dependencies
COPY package*.json ./
RUN npm install --production

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# If you need any static assets, copy them as well (optional)
# COPY --from=builder /app/public ./public

EXPOSE 3001

# Start the app in production mode
CMD ["npm", "run", "start"] 