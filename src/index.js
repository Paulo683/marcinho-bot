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

const nodes = [
  {
    name: process.env.LAVALINK_NODES_NAME || 'main',
    url: `${process.env.LAVALINK_HOST}:${process.env.LAVALINK_PORT}`,
    auth: process.env.LAVALINK_PASSWORD
  }
];

client.shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes);

client.shoukaku.on('ready', (name) =>
  console.log(`✅ Lavalink node ${name} conectado com sucesso!`)
);
client.shoukaku.on('error', (name, error) =>
  console.error(`❌ Erro no node ${name}:`, error)
);

client.once('ready', () => {
  console.log(`🍻 Marcinho online como ${client.user.tag}!`);
});

async function tocarMusica(message, query) {
  const voice = message.member?.voice?.channel;
  if (!voice) return message.reply('🎧 Entra em um canal de voz primeiro!');

  const node = [...client.shoukaku.nodes.values()][0];
  if (!node) return message.reply('⚠️ Nenhum node Lavalink disponível.');

  const result = await node.rest.resolve(query);
  const tracks = result?.tracks || [];

  if (!tracks.length) {
    return message.reply('❌ Não encontrei nada com esse nome.');
  }

  const track = tracks[0];
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

  await player.playTrack({ track: track.track });

  const embed = new EmbedBuilder()
    .setColor(0xffcc00)
    .setTitle('🎵 Tocando Agora!')
    .setDescription(`**${track.info.title}**\nPedido por **${message.author.username}**`)
    .setURL(track.info.uri)
    .setThumbnail(track.info.artworkUrl || null);

  message.reply({ embeds: [embed] });
}

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
});

client.login(process.env.DISCORD_TOKEN);
