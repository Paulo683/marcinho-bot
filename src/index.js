import 'dotenv/config';
import express from 'express';
import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import { Manager } from 'erela.js';
import Spotify from 'erela.js-spotify';

// ====== Keep-alive (Railway) ======
const app = express();
app.get('/', (_, res) => res.send('🍻 Marcinho tá ON (keep-alive)!'));
app.listen(process.env.PORT || 3000, () =>
  console.log('🌐 Keep-alive ativo no Railway!')
);

// ====== Cliente Discord ======
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// ====== Coleção de comandos estilo Jockie ======
client.commands = new Collection();
client.prefix = process.env.PREFIX || '!';

// ====== Registrar comandos (carregamento simples em memória) ======
import { ping } from './modules/commands/ping.js';
import { play } from './modules/commands/play.js';
import { skip } from './modules/commands/skip.js';
import { stop } from './modules/commands/stop.js';
import { queue } from './modules/commands/queue.js';
client.commands.set('ping', ping);
client.commands.set('play', play);
client.commands.set('p', play); // alias
client.commands.set('skip', skip);
client.commands.set('s', skip); // alias
client.commands.set('stop', stop);
client.commands.set('leave', stop); // alias
client.commands.set('queue', queue);
client.commands.set('q', queue); // alias

// ====== Erela.js (Lavalink) ======
const nodes = [
  {
    host: process.env.LAVALINK_HOST,
    port: Number(process.env.LAVALINK_PORT || 2333),
    password: process.env.LAVALINK_PASSWORD,
    secure: String(process.env.LAVALINK_SECURE || 'false') === 'true'
  }
];

client.manager = new Manager({
  nodes,
  send(id, payload) {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  },
  plugins: [
    new Spotify({
      clientID: process.env.SPOTIFY_CLIENT_ID || undefined,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET || undefined
    })
  ]
})
  .on('nodeConnect', node => console.log(`🔌 Lavalink conectado: ${node.options.host}`))
  .on('nodeError', (node, err) =>
    console.error(`💥 Erro no node ${node.options.host}:`, err?.message || err)
  )
  .on('trackStart', (player, track) => {
    const ch = client.channels.cache.get(player.textChannel);
    ch?.send(`🎵 **Tocando:** ${track.title} — pedido por **${track.requester}**`);
  })
  .on('queueEnd', player => {
    const ch = client.channels.cache.get(player.textChannel);
    ch?.send('📭 Fila acabou. Fui pegar outra gelada 🍺');
    player.destroy();
  });

// ====== Eventos do Discord ======
client.on('ready', () => {
  console.log(`🍻 Marcinho online como ${client.user.tag}!`);
  client.manager.init(client.user.id);
});

client.on('raw', d => client.manager.updateVoiceState(d));

client.on('messageCreate', async (message) => {
  try {
    if (!message.guild || message.author.bot) return;

    const prefix = client.prefix;
    if (!message.content.startsWith(prefix)) return;

    const [cmdName, ...args] = message.content.slice(prefix.length).trim().split(/\s+/);
    const cmd = client.commands.get(cmdName.toLowerCase());
    if (!cmd) return;

    await cmd.run({ client, message, args });
  } catch (e) {
    console.error('Erro no messageCreate:', e);
  }
});

client.login(process.env.DISCORD_TOKEN);
