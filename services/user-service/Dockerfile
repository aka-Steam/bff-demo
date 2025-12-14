FROM node:18-alpine
RUN apk add --no-cache wget
WORKDIR /app
COPY package.json ./
RUN npm install
COPY server.js ./
EXPOSE 3001
CMD ["npm", "start"]

