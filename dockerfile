# Imagem base
FROM node:20-alpine

# Cria diretório
WORKDIR /app

# Copia arquivos
COPY package*.json ./
RUN npm install

COPY . .

# Porta para o Railway
EXPOSE 3000

# Comando para iniciar
CMD ["npm", "start"]
