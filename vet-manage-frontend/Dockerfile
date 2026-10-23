FROM node:24-alpine as build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5174
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5174"]
