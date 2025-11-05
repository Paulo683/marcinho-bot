import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } from '@discordjs/voice';
import ytdl from '@distube/ytdl-core';
import express from 'express';

// === SERVIDOR EXPRESS PRA MANTER O RAILWAY ACORDADO ===
const app = express();
app.get('/', (_, res) => res.send('🍻 Marcinho está online e bebendo!'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Keep-alive ativo no Railway!'));

// === CONFIG DO CLIENTE DISCORD ===
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// === EVENTO READY ===
client.once('ready', () => {
  console.log(`🍻 Marcinho online como ${client.user.tag}!`);
});

// === FUNÇÃO PRA TOCAR MÚSICA ===
async function tocarMusica(message, query) {
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) return message.reply('🎧 Entra em um canal de voz primeiro, jamanta azul!');

  try {
    const stream = ytdl(query, {
      filter: 'audioonly',
      highWaterMark: 1 << 25,
      quality: 'highestaudio'
    });

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
      selfDeaf: false
    });

    const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
    const resource = createAudioResource(stream);
    connection.subscribe(player);
    player.play(resource);

    player.on(AudioPlayerStatus.Idle, () => {
      message.channel.send('📭 Fila acabou. Fui pegar outra gelada 🍺');
      connection.destroy();
    });

    const embed = new EmbedBuilder()
      .setColor(0xffcc00)
      .setTitle('🎵 Tocando Agora!')
      .setDescription(`🎶 **${query}**\nPedido por **${message.author.username}**`)
      .setThumbnail('https://i.imgur.com/4M34hi2.png');

    message.reply({ embeds: [embed] });

  } catch (err) {
    console.error(err);
    message.reply('😵‍💫 Deu ruim pra tocar isso aí, tenta outro link.');
  }
}

// === COMANDOS ===
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const [cmd, ...args] = message.content.trim().split(' ');
  const query = args.join(' ');

  if (cmd === '!play') {
    if (!query) return message.reply('⚠️ Fala o nome ou link, jamanta azul.');
    await tocarMusica(message, query);
  }

  if (cmd === '!stop') {
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) return message.reply('❌ Nem tava tocando nada.');
    voiceChannel.leave?.();
    message.reply('🛑 Parei e vazei da call.');
  }

  if (cmd === '!help') {
    message.reply(
      '🍺 **Comandos do Marcinho**\n' +
      '• `!play <link do YouTube>`\n' +
      '• `!stop`\n'
    );
  }
});

client.login(process.env.DISCORD_TOKEN);
