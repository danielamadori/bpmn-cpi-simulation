FROM node:20

WORKDIR /app

COPY package.json package-lock.json ./
COPY tasks ./tasks
RUN npm ci

COPY . .

RUN npm run bundle:src

EXPOSE 8080

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

CMD ["/docker-entrypoint.sh"]
