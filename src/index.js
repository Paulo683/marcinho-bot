// src/index.js
import 'dotenv/config';
import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { Manager } from 'erela.js';

// ---------- Client ----------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ---------- Lavalink Manager ----------
const manager = new Manager({
  nodes: [
    {
      host: process.env.LAVALINK_HOST,
      port: Number(process.env.LAVALINK_PORT || 2333),
      password: process.env.LAVALINK_PASSWORD,
      secure: String(process.env.LAVALINK_SECURE || 'false').toLowerCase() === 'true',
    },
  ],
  send(id, payload) {
    const guild = client.guilds.cache.get(id);
    if (guild) guild.shard.send(payload);
  },
});

// Logs úteis
manager
  .on('nodeConnect', node => console.log(`✅ Lavalink conectado: ${node.options.host}`))
  .on('nodeError', (node, error) => console.log(`❌ Erro no node ${node.options.host}:`, error?.message || error))
  .on('playerMove', (player, oldChannel, newChannel) => {
    if (!newChannel) player.destroy();
  });

// Player events (opcional, só pra log)
manager
  .on('trackStart', (player, track) => {
    const channel = client.channels.cache.get(player.textChannel);
    if (channel) {
      const embed = new EmbedBuilder()
        .setColor(0xff6600)
        .setTitle('🎶 Tocando Agora!')
        .setDescription(`**${track.title}**\n⏱️ **${msToTime(track.duration)}**\n🔗 [Abrir](${track.uri})`)
        .setFooter({ text: 'Marcinho no comando 🎧' });
      channel.send({ embeds: [embed] });
    }
  })
  .on('queueEnd', player => {
    const channel = client.channels.cache.get(player.textChannel);
    if (channel) channel.send('📭 Fila acabou. Fui pegar outra gelada 🍺');
    player.destroy();
  });

// Discord ready
client.once('ready', () => {
  console.log(`🍻 Marcinho online como ${client.user.tag}!`);
  manager.init(client.user.id);
});

// MUITO IMPORTANTE: repassar eventos "raw" ao manager
client.on('raw', d => manager.updateVoiceState(d));

// ---------- Comandos (simples) ----------
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();
  const serverId = message.guild.id;

  const serverPrefix = '!'; // mantém o seu prefixo

  // !play <nome ou link>
  if (content.startsWith(`${serverPrefix}play`)) {
    const query = content.slice(`${serverPrefix}play`.length).trim();
    if (!query) return message.reply('⚠️ Faltou o nome/link da música, jamanta azul!');

    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) return message.reply('🎧 Entra em um canal de voz primeiro, abestado!');

    // cria ou pega player
    let player = manager.players.get(serverId);
    if (!player) {
      player = manager.create({
        guild: serverId,
        voiceChannel: voiceChannel.id,
        textChannel: message.channel.id,
        volume: 100,
      });
      player.connect();
    } else if (player.voiceChannel !== voiceChannel.id) {
      return message.reply('❌ Já tô tocando em outro canal, doidão.');
    }

    try {
      const res = await manager.search(query, message.author);

      if (res.loadType === 'LOAD_FAILED' || res.loadType === 'NO_MATCHES') {
        return message.reply('❌ Não achei nada não, meu chapa.');
      }

      if (res.loadType === 'PLAYLIST_LOADED') {
        for (const t of res.tracks) player.queue.add(t);
        message.reply(`📚 Playlist **${res.playlist.name}** adicionada com **${res.tracks.length}** faixas.`);
      } else {
        const track = res.tracks[0];
        player.queue.add(track);

        const embed = new EmbedBuilder()
          .setColor(0xffcc00)
          .setTitle('🎶 Adicionado à Fila!')
          .setDescription(`**${track.title}**\n⏱️ **${msToTime(track.duration)}**`)
          .setFooter({ text: 'Marcinho Cachaçeiro 🍺' });

        message.reply({ embeds: [embed] });
      }

      if (!player.playing && !player.paused) player.play();
    } catch (err) {
      console.error('Erro no !play:', err);
      message.reply('😵‍💫 O Marcinho bugou tentando tocar isso aí.');
    }
  }

  // !skip
  if (content === `${serverPrefix}skip`) {
    const player = manager.players.get(serverId);
    if (!player || !player.queue.current) return message.reply('❌ Tem porra nenhuma pra pular, mongo.');
    player.stop();
    message.reply('⏭️ Pulei. Próxima!');
  }

  // !stop
  if (content === `${serverPrefix}stop`) {
    const player = manager.players.get(serverId);
    if (!player) return message.reply('❌ Nem tô tocando nada, krai.');
    player.destroy();
    message.reply('🛑 Parei tudo e saí do canal. Fui pegar outra gelada! 🍺');
  }

  // !lista
  if (content === `${serverPrefix}lista`) {
    const player = manager.players.get(serverId);
    if (!player || (!player.queue.current && !player.queue.length)) {
      return message.reply('📭 A fila do Marcinho tá mais vazia que geladeira de solteiro!');
    }

    const current = player.queue.current
      ? `**Tocando agora:** ${player.queue.current.title} (${msToTime(player.queue.current.duration)})\n`
      : '';

    const next = player.queue.length
      ? player.queue.map((t, i) => `**${i + 1}.** ${t.title} (${msToTime(t.duration)})`).slice(0, 10).join('\n')
      : '—';

    const embed = new EmbedBuilder()
      .setColor(0x00cc99)
      .setTitle('🎧 Fila do Marcinho Cachaçeiro')
      .setDescription(`${current}\n**Próximas:**\n${next}`)
      .setFooter({ text: 'Vamo de música, bebê! 🍻' });

    message.reply({ embeds: [embed] });
  }
});

// utils
function msToTime(ms) {
  const s = Math.floor(ms / 1000);
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

client.login(process.env.DISCORD_TOKEN);
