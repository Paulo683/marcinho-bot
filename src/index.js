import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
} from '@discordjs/voice';
import ytdl from '@distube/ytdl-core';
import express from 'express';

// === KEEP-ALIVE PRO RAILWAY ===
const app = express();
app.get('/', (_, res) => res.send('🍺 Marcinho tá online no Railway!'));
app.listen(process.env.PORT || 3000, () =>
  console.log('🌐 Keep-alive ativo no Railway!')
);

// === CLIENT DISCORD ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

let queue = new Map();

// === LOGIN EVENT ===
client.once('ready', () => {
  console.log(`🍻 Marcinho online como ${client.user.tag}!`);
});

// === FUNÇÃO PRA TOCAR MÚSICA ===
async function tocarMusica(message, query) {
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) return message.reply('🎧 Entra num canal de voz, jamanta!');

  try {
    const info = await ytdl.getInfo(query);
    const stream = ytdl.downloadFromInfo(info, {
      filter: 'audioonly',
      quality: 'highestaudio',
      highWaterMark: 1 << 25,
    });

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Stop },
    });

    const resource = createAudioResource(stream);
    player.play(resource);
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
      message.channel.send('📭 Fila acabou. Fui pegar outra gelada 🍺');
      connection.destroy();
    });

    const embed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setTitle('🎵 Tocando Agora!')
      .setDescription(`**${info.videoDetails.title}**\nPedido por **${message.author.username}**`)
      .setURL(info.videoDetails.video_url)
      .setThumbnail(info.videoDetails.thumbnails[0]?.url || null);

    await message.reply({ embeds: [embed] });
  } catch (err) {
    console.error(err);
    message.reply('⚠️ Deu ruim pra tocar essa, tenta outra!');
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
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel)
      return message.reply('❌ Nem tô tocando nada, jamanta.');
    voiceChannel.leave?.();
    message.reply('🛑 Parei e fui pegar outra gelada 🍺');
  }

  if (cmd === '!help') {
    message.reply(
      '🍺 **Comandos do Marcinho**\n' +
        '• `!play <nome ou link>` — toca música\n' +
        '• `!stop` — para e sai da call\n'
    );
  }
});

// === LOGIN ===
client.login(process.env.DISCORD_TOKEN);
