import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { createLavalink } from './lavalink.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.once('ready', () => {
  console.log(`🍻 Marcinho online como ${client.user.tag}!`);
  client.shoukaku = createLavalink(client);
});

// Função pra tocar música
async function tocarMusica(message, query) {
  const voice = message.member?.voice?.channel;
  if (!voice) return message.reply('🎧 Entra em um canal de voz primeiro!');

  const node = client.shoukaku.getNode();
  const result = await node.rest.resolve(query);

  if (!result || !result.tracks.length) {
    return message.reply('❌ Não encontrei nada com esse nome.');
  }

  const track = result.tracks[0];
  const player = await node.joinChannel({
    guildId: message.guild.id,
    channelId: voice.id,
    shardId: 0,
    deaf: true
  });

  player.on('end', () => {
    message.channel.send('📭 Fila acabou. Fui pegar outra gelada 🍺');
    node.leaveChannel(message.guild.id);
  });

  await player.playTrack({ track: track.encoded });

  const embed = new EmbedBuilder()
    .setColor(0xffcc00)
    .setTitle('🎵 Tocando Agora!')
    .setDescription(`**${track.info.title}**\nPedido por **${message.author.username}**`)
    .setURL(track.info.uri)
    .setThumbnail(track.info.artworkUrl || null);

  message.reply({ embeds: [embed] });
}

// Comandos
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const [cmd, ...args] = message.content.split(' ');
  const query = args.join(' ');

  if (cmd === '!play') {
    if (!query) return message.reply('⚠️ Fala o nome ou link, jamanta azul.');
    try {
      await tocarMusica(message, query);
    } catch (e) {
      console.error('Erro ao tocar:', e);
      message.reply('😵‍💫 Deu ruim pra tocar isso aí.');
    }
  }

  if (cmd === '!stop') {
    const node = client.shoukaku.getNode();
    const player = node.players.get(message.guild.id);
    if (player) {
      player.stopTrack();
      node.leaveChannel(message.guild.id);
      message.reply('🛑 Parei e vazei da call.');
    } else {
      message.reply('❌ Nem tava tocando nada.');
    }
  }

  if (cmd === '!help') {
    message.reply(
      '🍺 **Comandos do Marcinho**\n' +
      '• `!play <nome ou link>`\n' +
      '• `!stop`\n'
    );
  }
});

client.login(process.env.DISCORD_TOKEN);
