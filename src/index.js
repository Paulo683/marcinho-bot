import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } from '@discordjs/voice';
import fetch from 'node-fetch';
import express from 'express';

// === KEEP-ALIVE RAILWAY ===
const app = express();
app.get('/', (_, res) => res.send('🍻 Marcinho tá vivo no Railway!'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Servidor ativo no Railway!'));

// === CONFIG CLIENT ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// === VARIÁVEIS DO LAVALINK ===
const LAVALINK_HOST = process.env.LAVALINK_HOST || 'lavalink';
const LAVALINK_PORT = process.env.LAVALINK_PORT || '2333';
const LAVALINK_PASSWORD = process.env.LAVALINK_PASSWORD || 'youshallnotpass';
const PREFIX = process.env.PREFIX || '!';

// === PLAYER GLOBAL ===
const player = createAudioPlayer({
  behaviors: {
    noSubscriber: NoSubscriberBehavior.Play
  }
});

// === EVENTO READY ===
client.once('ready', () => {
  console.log(`🍺 Marcinho online como ${client.user.tag}!`);
});

// === FUNÇÃO PARA BUSCAR MÚSICA NO LAVALINK ===
async function searchTrack(query) {
  const url = `http://${LAVALINK_HOST}:${LAVALINK_PORT}/loadtracks?identifier=ytsearch:${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: LAVALINK_PASSWORD
    }
  });

  if (!res.ok) throw new Error(`Erro ao conectar com Lavalink: ${res.status}`);
  const data = await res.json();

  if (!data.tracks || !data.tracks.length) return null;
  return data.tracks[0];
}

// === FUNÇÃO TOCAR MÚSICA ===
async function tocarMusica(message, query) {
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel)
    return message.reply('🎧 Entra num canal de voz primeiro, jamanta azul!');

  try {
    const track = await searchTrack(query);
    if (!track) return message.reply('😔 Não achei nada com esse nome.');

    const conn = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator
    });

    const audioUrl = `http://${LAVALINK_HOST}:${LAVALINK_PORT}/decodetrack?track=${track.encoded}`;
    const resource = createAudioResource(audioUrl);
    player.play(resource);
    conn.subscribe(player);

    const embed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setTitle('🎶 Tocando Agora!')
      .setDescription(`**${track.info.title}**\nPedido por **${message.author.username}**`)
      .setURL(track.info.uri)
      .setThumbnail(track.info.artworkUrl || null);

    message.reply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    message.reply('😵‍💫 Deu ruim pra tocar essa, tenta outra!');
  }
}

// === EVENTO PLAYER ===
player.on(AudioPlayerStatus.Idle, () => {
  console.log('🎵 Música terminou.');
});

// === COMANDOS ===
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const [cmd, ...args] = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const query = args.join(' ');

  if (cmd === 'play') {
    if (!query) return message.reply('⚠️ Fala o nome da música ou o link, jamanta azul!');
    await tocarMusica(message, query);
  }

  if (cmd === 'stop') {
    player.stop(true);
    message.reply('🛑 Parei de tocar e fui pegar outra gelada 🍺');
  }

  if (cmd === 'help') {
    message.reply(
      '🍺 **Comandos do Marcinho**\n' +
      '• `!play <nome ou link>` — toca a música\n' +
      '• `!stop` — para a música e sai\n'
    );
  }
});

// === LOGIN ===
client.login(process.env.DISCORD_TOKEN);
