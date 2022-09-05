FROM node:16

WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

ENV IQDB_BASE_URL="http://iqdb:5588/"
ENV UPLOADS_ORIGINAL_PATH="/data/uploads/original/"

CMD [ "node", "index.js" ]
