FROM node:18-alpine

WORKDIR /app

# Install socat for port forwarding
RUN apk add --no-cache socat

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3333

# Environment variables
ENV NODE_ENV=production
ENV PORT=3333
ENV HOSTNAME=0.0.0.0

# Start production server
CMD ["npm", "start"] 

WORKDIR /app

# Install socat for port forwarding
RUN apk add --no-cache socat

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3333

# Environment variables
ENV NODE_ENV=production
ENV PORT=3333
ENV HOSTNAME=0.0.0.0

# Start production server
CMD ["npm", "start"] 