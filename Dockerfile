FROM node:20-slim

WORKDIR /usr/src/app


COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

# Must be owned by the 'node' user since the container runs as USER node.
ENV DB_PATH=/usr/src/app/data/activity.db
RUN mkdir -p /usr/src/app/data && chown -R node:node /usr/src/app/data

USER node

EXPOSE 3000

CMD ["node", "./src/server.js"]
