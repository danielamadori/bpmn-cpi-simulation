FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run bundle:src

EXPOSE 8080
CMD ["npm", "run", "start:example"]
