import { Shoukaku, Connectors } from 'shoukaku';

const Nodes = [
  {
    name: 'Railway',
    url: 'vivacious-abundance-production.up.railway.app:2333',
    auth: 'youshallnotpass',
    secure: true
  }
];

export function createLavalink(client) {
  const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), Nodes);

  shoukaku.on('ready', name => console.log(`✅ Lavalink conectado: ${name}`));
  shoukaku.on('error', (name, err) => console.error(`❌ Erro no Lavalink (${name}):`, err));
  shoukaku.on('close', (name, code, reason) =>
    console.warn(`⚠️ Node ${name} desconectado (${code}): ${reason}`)
  );

  return shoukaku;
}
