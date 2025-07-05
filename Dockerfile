FROM node:18-alpine

WORKDIR /app

# Install system dependencies including sharp dependencies
RUN apk add --no-cache \
    socat \
    vips-dev \
    build-base \
    python3

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Create standalone directory structure
RUN mkdir -p /app/.next/standalone/.next

# Copy static files to standalone directory
RUN cp -r .next/static .next/standalone/.next/
RUN cp -r .next/server .next/standalone/.next/
RUN cp -r public .next/standalone/

# Expose port
EXPOSE 3000

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Start production server using standalone mode
CMD ["node", ".next/standalone/server.js"] 