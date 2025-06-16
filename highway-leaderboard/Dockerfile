# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install

# Copy the script
COPY index.js ./index.js

# Copy .env file if needed (uncomment if you want to build with secrets)
# COPY .env ./.env

# Install cron
RUN apk add --no-cache dumb-init curl tini && apk add --no-cache --virtual .build-deps curl && apk add --no-cache busybox-suid && rm -rf /var/cache/apk/*

# Add crontab file
COPY crontab /etc/crontabs/root

# Set entrypoint to run cron in foreground
CMD ["crond", "-f", "-d", "8"]
