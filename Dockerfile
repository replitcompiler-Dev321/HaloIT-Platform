FROM node:18-alpine

# App root
WORKDIR /app

# Copy backend package manifest and install production dependencies
COPY halo-system/backend/package*.json ./
RUN npm install --production

# Copy the backend source files
COPY halo-system/backend ./

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
