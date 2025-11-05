FROM node:20-alpine

WORKDIR /app

# Copia apenas os arquivos necessários para instalar dependências
COPY package*.json ./
RUN npm install --production

# Copia o resto do código
COPY . .

# Expõe a porta (Railway ignora, mas é boa prática)
EXPOSE 3000

# Define o comando de inicialização
CMD ["node", "index.js"]
