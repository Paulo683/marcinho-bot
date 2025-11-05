import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
} from '@discordjs/voice';
import ytdl from '@distube/ytdl-core';
import ytsr from 'ytsr';
import express from 'express';

// === KEEP-ALIVE (RAILWAY) ===
const app = express();
app.get('/', (_, res) => res.send('🍻 Marcinho tá vivo e bebendo no Railway!'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Keep-alive ativo no Railway!'));

// === CLIENT DISCORD ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once('ready', () => {
  console.log(`🍺 Marcinho online como ${client.user.tag}!`);
});

// === FUNÇÃO PRA TOCAR ===
async function tocarMusica(message, query) {
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) return message.reply('🎧 Entra num canal de voz, jamanta!');

  try {
    // Pesquisa se o usuário mandou um nome e não um link
    if (!ytdl.validateURL(query)) {
      const results = await ytsr(query, { limit: 1 });
      if (!results.items.length) return message.reply('😕 Não achei nada com esse nome.');
      query = results.items[0].url;
    }

    console.log(`🎶 Buscando: ${query}`);

    const info = await ytdl.getInfo(query);
    const stream = ytdl(query, {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25,
      requestOptions: {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
    });

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Stop },
    });

    const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
    player.play(resource);
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Playing, () => {
      console.log('▶️ Tocando música!');
      const embed = new EmbedBuilder()
        .setColor(0xffcc00)
        .setTitle('🎵 Tocando Agora!')
        .setDescription(`**${info.videoDetails.title}**\nPedido por **${message.author.username}**`)
        .setURL(info.videoDetails.video_url)
        .setThumbnail(info.videoDetails.thumbnails[0]?.url || null);
      message.reply({ embeds: [embed] });
    });

    player.on(AudioPlayerStatus.Idle, () => {
      message.channel.send('📭 Fila acabou. Fui pegar outra gelada 🍺');
      connection.destroy();
    });

    player.on('error', (err) => {
      console.error('Erro no player:', err);
      message.reply('⚠️ Deu ruim pra tocar essa, tenta outra!');
      connection.destroy();
    });
  } catch (err) {
    console.error('Erro geral:', err);
    message.reply('😵‍💫 Deu ruim pra tocar isso aí.');
  }
}

// === COMANDOS ===
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const [cmd, ...args] = message.content.split(' ');
  const query = args.join(' ');

  if (cmd === '!play') {
    if (!query) return message.reply('⚠️ Fala o nome ou link, jamanta azul.');
    await tocarMusica(message, query);
  }

  if (cmd === '!stop') {
    message.reply('🛑 Parei e vazei da call.');
    const voiceChannel = message.member?.voice?.channel;
    if (voiceChannel) voiceChannel.leave?.();
  }

  if (cmd === '!help') {
    message.reply(
      '🍺 **Comandos do Marcinho**\n' +
        '• `!play <link ou nome>` — toca música\n' +
        '• `!stop` — para e sai da call'
    );
  }
});

// === LOGIN ===
client.login(process.env.DISCORD_TOKEN);
