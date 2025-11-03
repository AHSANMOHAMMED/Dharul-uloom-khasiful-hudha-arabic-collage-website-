FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

# Install app dependencies (use package-lock if present)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy source
COPY --chown=nodejs:nodejs . .

# Switch to non-root user
USER nodejs

ENV NODE_ENV=production
EXPOSE 5000

CMD ["node", "server.js"]
