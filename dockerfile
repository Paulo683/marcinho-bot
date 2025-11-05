FROM node:20-alpine

WORKDIR /app

# Dependências básicas
RUN apk add --no-cache tini

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["npm", "start"]
