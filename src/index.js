import 'dotenv/config';
import {
  Client,
  GatewayIntentBits,
  EmbedBuilder
} from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  getVoiceConnection
} from '@discordjs/voice';
import * as play from 'play-dl';

// Inicializa o cliente
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
});

const queues = new Map(); // guildId -> { connection, player, songs[], nowPlaying }

client.once('ready', () => {
  console.log(`🍺 Marcinho online como ${client.user.tag}!`);
});

// Autoriza o play-dl com o YouTube
(async () => {
  try {
    await play.authorization();
    console.log('✅ Autorização YouTube feita com sucesso!');
  } catch (e) {
    console.error('⚠️ Erro ao autorizar o YouTube:', e);
  }
})();

// Função pra tocar a próxima da fila
async function playNext(guildId, channel) {
  const q = queues.get(guildId);
  if (!q) return;

  const song = q.songs.shift();
  if (!song) {
    q.player.stop();
    const conn = getVoiceConnection(guildId);
    if (conn) conn.destroy();
    queues.delete(guildId);
    channel.send('📭 Fila acabou. Fui pegar outra gelada 🍺');
    return;
  }

  try {
    const stream = await play.stream(song.url, { quality: 2 });
    const resource = createAudioResource(stream.stream, { inputType: stream.type });
    q.player.play(resource);
    q.nowPlaying = song;

    const embed = new EmbedBuilder()
      .setColor(0xff6600)
      .setTitle('🎶 Tocando Agora!')
      .setDescription(`**${song.title}**\nPedido por **${song.user}**`)
      .setURL(song.url)
      .setThumbnail(song.thumbnail || null);

    channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Erro tocando stream:', err);
    playNext(guildId, channel);
  }
}

// Comandos
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim();

  // !play <termo ou link>
  if (content.startsWith('!play')) {
    const args = content.split(' ').slice(1);
    const query = args.join(' ');
    if (!query) return message.reply('⚠️ Fala o nome ou link, jamanta azul.');

    const voice = message.member?.voice?.channel;
    if (!voice) return message.reply('🎧 Entra num canal de voz primeiro!');

    let q = queues.get(message.guild.id);
    if (!q) {
      const connection = joinVoiceChannel({
        channelId: voice.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator
      });
      const player = createAudioPlayer();
      connection.subscribe(player);
      player.on(AudioPlayerStatus.Idle, () => playNext(message.guild.id, message.channel));
      q = { connection, player, songs: [], nowPlaying: null };
      queues.set(message.guild.id, q);
    }

    try {
      let info;
      if (play.yt_validate(query) === 'video') {
        info = await play.video_basic_info(query);
      } else {
        const results = await play.search(query, { limit: 1 });
        if (!results.length) return message.reply('❌ Não achei essa música.');
        info = results[0];
      }

      const title = info.title || info.video_details?.title || 'Música';
      const url = info.url || info.video_details?.url;
      const thumbnail = info.thumbnails?.[0]?.url || info.video_details?.thumbnails?.[0]?.url;

      q.songs.push({ title, url, thumbnail, user: message.author.username });

      const embed = new EmbedBuilder()
        .setColor(0xffcc00)
        .setTitle('🎵 Adicionado à Fila!')
        .setDescription(`**${title}**\nPedido por **${message.author.username}**`)
        .setThumbnail(thumbnail || null);

      await message.reply({ embeds: [embed] });

      if (q.player.state.status !== AudioPlayerStatus.Playing && !q.nowPlaying) {
        playNext(message.guild.id, message.channel);
      }
    } catch (e) {
      console.error('Erro em !play:', e);
      message.reply('😵‍💫 Deu ruim pra achar/tocar isso aí.');
    }
  }

  // !skip
  if (content === '!skip') {
    const q = queues.get(message.guild.id);
    if (!q) return message.reply('❌ Não tem nada pra pular.');
    message.reply('⏭️ Pulando!');
    playNext(message.guild.id, message.channel);
  }

  // !stop
  if (content === '!stop') {
    const q = queues.get(message.guild.id);
    if (!q) return message.reply('❌ Nem tava tocando nada.');
    q.songs.length = 0;
    q.player.stop();
    const conn = getVoiceConnection(message.guild.id);
    if (conn) conn.destroy();
    queues.delete(message.guild.id);
    message.reply('🛑 Parei e vazei da call.');
  }

  // !lista
  if (content === '!lista') {
    const q = queues.get(message.guild.id);
    if (!q || (!q.nowPlaying && q.songs.length === 0)) {
      return message.reply('📭 A fila tá vazia.');
    }
    let out = '🎧 **Fila do Marcinho:**\n';
    if (q.nowPlaying) out += `**Tocando:** ${q.nowPlaying.title}\n`;
    if (q.songs.length) {
      out += q.songs.map((s, i) => `**${i + 1}.** ${s.title} — pedido por *${s.user}*`).join('\n');
    }
    message.reply(out);
  }

  // !help
  if (content === '!help') {
    message.reply(
      '🍺 **Comandos do Marcinho**\n' +
      '• `!play <nome ou link>`\n' +
      '• `!skip`\n' +
      '• `!stop`\n' +
      '• `!lista`\n'
    );
  }
});

client.login(process.env.DISCORD_TOKEN);
