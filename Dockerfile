FROM node:20

WORKDIR /app

COPY backend/package*.json ./backend/

RUN npm ci --prefix backend

COPY . .

ENV NODE_ENV=production

CMD ["npm", "--prefix", "backend", "start"]
