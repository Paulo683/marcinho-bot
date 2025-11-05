import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { Shoukaku, Connectors } from 'shoukaku';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Configuração do Lavalink
const Nodes = [
  {
    name: 'MarcinhoLava',
    url: `${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}`,
    auth: process.env.LAVALINK_PASSWORD
  }
];

// Inicializa o Shoukaku
client.shoukaku = new Shoukaku(new Connectors.DiscordJS(client), Nodes);

client.shoukaku.on('ready', (name) => {
  console.log(`✅ Node ${name} conectado com sucesso!`);
});

client.shoukaku.on('error', (name, error) => {
  console.error(`❌ Erro no node ${name}:`, error);
});

client.once('ready', () => {
  console.log(`🍻 Marcinho online como ${client.user.tag}!`);
});

// Função pra tocar música
async function tocarMusica(message, query) {
  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) return message.reply('🎧 Entra num canal de voz primeiro, abestado!');

  const node = [...client.shoukaku.nodes.values()][0];
  const result = await node.rest.resolve(query);

  if (!result || !result.tracks.length) {
    return message.reply('❌ Não encontrei nada com esse nome aí.');
  }

  const track = result.tracks[0];
  const player = await node.joinChannel({
    guildId: message.guild.id,
    channelId: voiceChannel.id,
    shardId: 0,
    deaf: true
  });

  player.on('end', () => {
    message.channel.send('🍺 Acabou a música... partiu mais uma!');
    node.leaveChannel(message.guild.id);
  });

  await player.playTrack({ track: track.track });

  const embed = new EmbedBuilder()
    .setColor(0xffcc00)
    .setTitle('🎵 Tocando Agora!')
    .setDescription(`**${track.info.title}**\nPedido por **${message.author.username}**`)
    .setURL(track.info.uri)
    .setThumbnail(track.info.artworkUrl || null);

  message.reply({ embeds: [embed] });
}

// Sistema de comandos
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const [cmd, ...args] = message.content.split(' ');
  const query = args.join(' ');

  if (cmd === '!play') {
    if (!query) return message.reply('⚠️ Fala o nome ou link da música, jamanta azul.');
    try {
      await tocarMusica(message, query);
    } catch (e) {
      console.error('Erro ao tocar:', e);
      message.reply('😵‍💫 Deu ruim pra tocar isso aí.');
    }
  }

  if (cmd === '!stop') {
    const node = [...client.shoukaku.nodes.values()][0];
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
      '• `!play <nome ou link>` — Toca a música\n' +
      '• `!stop` — Para e sai do canal\n' +
      '• `!help` — Mostra este menu'
    );
  }
});

client.login(process.env.DISCORD_TOKEN);
