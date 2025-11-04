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
  console.log(`🍻 Marcinho online como ${client.user.tag}!`);
});

/** util: toca a próxima da fila */
async function playNext(guildId, channelToNotify = null) {
  const q = queues.get(guildId);
  if (!q) return;

  const song = q.songs.shift();
  if (!song) {
    // acabou a fila → sair
    q.player.stop();
    const conn = getVoiceConnection(guildId);
    if (conn) conn.destroy();
    queues.delete(guildId);
    if (channelToNotify) channelToNotify.send('📭 Fila acabou. Fui pegar outra gelada 🍺');
    return;
  }

  try {
    // stream de áudio com play-dl
    const stream = await play.stream(song.url, { quality: 2 }); // 2=high
    const resource = createAudioResource(stream.stream, { inputType: stream.type });

    q.player.play(resource);
    q.nowPlaying = song;

    // notifica
    if (channelToNotify) {
      const embed = new EmbedBuilder()
        .setColor(0xff6600)
        .setTitle('🎶 Tocando Agora!')
        .setDescription(`**${song.title}**\nPedido por **${song.user}**`)
        .setURL(song.url)
        .setThumbnail(song.thumbnail || null);

      channelToNotify.send({ embeds: [embed] });
    }
  } catch (err) {
    console.error('Erro tocando stream:', err);
    // tenta próxima
    playNext(guildId, channelToNotify);
  }
}

/** comandos */
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // !play <termo ou link>
  if (message.content.startsWith('!play')) {
    const args = message.content.split(' ').slice(1);
    const query = args.join(' ');
    if (!query) return message.reply('⚠️ Fala o nome ou link, jamanta azul.');

    const voice = message.member?.voice?.channel;
    if (!voice) return message.reply('🎧 Entra em um canal de voz primeiro!');

    // cria fila se não existir
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
      player.on('error', e => console.error('Player error:', e.message));

      q = { connection, player, songs: [], nowPlaying: null };
      queues.set(message.guild.id, q);
    }

    try {
      let url = query;
      let info;

      if (!play.yt_validate(url)) {
        // pesquisa por termo
        const results = await play.search(query, { limit: 1 });
        if (!results.length) return message.reply('❌ Não achei essa música.');
        url = results[0].url;
        info = results[0];
      } else {
        info = await play.video_basic_info(url);
      }

      const title = info?.title ?? info?.video_details?.title ?? 'Música';
      const thumbnail = info?.thumbnails?.[0]?.url || info?.video_details?.thumbnails?.[0]?.url;

      // coloca na fila
      q.songs.push({
        url,
        title,
        thumbnail,
        user: message.author.username
      });

      const embed = new EmbedBuilder()
        .setColor(0xffcc00)
        .setTitle('🎵 Adicionado à Fila!')
        .setDescription(`**${title}**\nPedido por **${message.author.username}**`)
        .setThumbnail(thumbnail || null);

      await message.reply({ embeds: [embed] });

      // se nada tocando, começa agora
      if (q.player.state.status !== AudioPlayerStatus.Playing && !q.nowPlaying) {
        playNext(message.guild.id, message.channel);
      }
    } catch (e) {
      console.error('Erro em !play:', e);
      message.reply('😵‍💫 Deu ruim pra achar/tocar isso aí.');
    }
  }

  // !skip
  if (message.content === '!skip') {
    const q = queues.get(message.guild.id);
    if (!q) return message.reply('❌ Não tem nada pra pular.');
    message.reply('⏭️ Pulando!');
    playNext(message.guild.id, message.channel);
  }

  // !stop
  if (message.content === '!stop') {
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
  if (message.content === '!lista') {
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
  if (message.content === '!help') {
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
