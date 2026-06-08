FROM node:20-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.mjs ./
COPY report-system-prompt.txt ./

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.mjs"]
