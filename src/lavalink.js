// lavalink.js
import { Shoukaku, Connectors } from 'shoukaku';

const LavalinkNodes = [
  {
    name: 'main',
    url: `${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}`,
    authorization: process.env.LAVALINK_PASSWORD, // 🔥 nome correto
    secure: process.env.LAVALINK_SECURE === 'true'
  }
];

export function createLavalink(client) {
  const shoukaku = new Shoukaku(
    new Connectors.DiscordJS(client),
    LavalinkNodes,
    {
      moveOnDisconnect: true,
      resumable: false,
      reconnectTries: Infinity,
      reconnectInterval: 3000
    }
  );

  shoukaku.on('ready', (name) => console.log(`✅ Node Lavalink ${name} conectado!`));
  shoukaku.on('error', (name, error) => console.error(`❌ Erro no node ${name}:`, error));
  shoukaku.on('close', (name, code, reason) =>
    console.warn(`⚠️ Node ${name} desconectado (${code}) — ${reason || 'sem motivo'}`)
  );
  shoukaku.on('disconnect', (name, players, moved) =>
    console.warn(`🔌 Node ${name} caiu (moved=${moved}). Jogadores: ${players.size}`)
  );

  return shoukaku;
}
