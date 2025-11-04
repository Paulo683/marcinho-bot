import { Client, GatewayIntentBits, EmbedBuilder } from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  AudioPlayerStatus,
} from "@discordjs/voice";
import play from "play-dl";
import dotenv from "dotenv";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const queue = new Map();

// ✅ Evento de inicialização
client.once("ready", () => {
  console.log(`🍻 Marcinho online como ${client.user.tag}!`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const serverQueue = queue.get(message.guild.id);

  // ---------- !play ----------
  if (message.content.startsWith("!play")) {
    const args = message.content.split(" ");
    let query = args.slice(1).join(" ");

    if (!query)
      return message.reply("⚠️ So esqueceu o nome ou link né jamanta azul");

    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel)
      return message.reply("🎧 Larga de ser imbecil, e entra em uma call antes!!");

    let url, videoInfo;

    try {
      // Se for link direto
      if (play.yt_validate(query) === "video") {
        url = query;
        videoInfo = await play.video_info(url);
      } else {
        // Pesquisa no YouTube
        const search = await play.search(query, { limit: 1 });
        if (!search || !search.length)
          return message.reply("❌ Não achei essa música, corno triste.");
        videoInfo = await play.video_info(search[0].url);
        url = search[0].url;
      }

      const title = videoInfo.video_details.title;
      const thumbnail = videoInfo.video_details.thumbnails[0].url;
      const durationSec = parseInt(videoInfo.video_details.durationInSec);
      const minutes = Math.floor(durationSec / 60);
      const seconds = durationSec % 60;
      const duration = `${minutes}:${seconds.toString().padStart(2, "0")}`;

      let serverQueue = queue.get(message.guild.id);

      // Cria a fila e player se não existir
      if (!serverQueue) {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: message.guild.id,
          adapterCreator: message.guild.voiceAdapterCreator,
        });

        const player = createAudioPlayer();
        const newQueue = {
          voiceChannel,
          connection,
          songs: [],
          player,
          nowPlaying: null,
        };

        queue.set(message.guild.id, newQueue);
        serverQueue = newQueue;

        connection.subscribe(player);
        player.on(AudioPlayerStatus.Idle, () => playNext(message.guild.id));
      }

      serverQueue.songs.push({
        url,
        title,
        thumbnail,
        duration,
        user: message.author.username,
      });

      const embed = new EmbedBuilder()
        .setColor(0xffcc00)
        .setTitle("🎶 Adicionado à Fila!")
        .setDescription(
          `**${title}**\n⏱️ Duração: **${duration}**\nPedido por **${message.author.username}**`
        )
        .setThumbnail(thumbnail)
        .setFooter({ text: "Marcinho Cachaçeiro 🍺" });

      message.reply({ embeds: [embed] });

      // Se for a primeira música, toca já
      if (serverQueue.songs.length === 1 && !serverQueue.nowPlaying) {
        playNext(message.guild.id);
      }
    } catch (err) {
      console.error("Erro ao pesquisar ou adicionar:", err);
      return message.reply("😵‍💫 O Marcinho ficou tonto e não achou nada, véi!");
    }
  }

  // ---------- !skip ----------
  if (message.content === "!skip") {
    if (!serverQueue) return message.reply("❌ Tem porra nenhuma pra pular, mongo");
    message.reply("⏭️ Apressadinho, ok, vou pular!");
    playNext(message.guild.id);
  }

  // ---------- !stop ----------
  if (message.content === "!stop") {
    if (!serverQueue) return message.reply("❌ Nem tava tocando nada krai");
    serverQueue.songs = [];
    serverQueue.player.stop();
    const connection = getVoiceConnection(message.guild.id);
    if (connection) connection.destroy();
    queue.delete(message.guild.id);
    message.reply("🛑 Fui pegar outra gelada, abraço!! 🍺");
  }

  // ---------- !lista ----------
  if (message.content === "!lista") {
    if (!serverQueue || serverQueue.songs.length === 0) {
      return message.reply("📭 A fila do Marcinho tá mais vazia que geladeira de solteiro!");
    }

    let listaMsg = "🎧 **Fila do Marcinho Cachaçeiro:**\n\n";
    serverQueue.songs.forEach((song, index) => {
      listaMsg += `**${index + 1}.** ${song.title} (${song.duration}) — pedido por *${song.user}*\n`;
    });

    message.reply(listaMsg);
  }

  // ---------- !help ----------
  if (message.content === "!help") {
    const embed = new EmbedBuilder()
      .setColor(0x00cc99)
      .setTitle("🍺 Marcinho Cachaçeiro — Manual do Corninho")
      .setDescription(
        "🎵 `!play <link ou nome>` — toca uma música do YouTube\n" +
          "⏭️ `!skip` — pula pra próxima\n" +
          "📜 `!lista` — mostra as músicas na fila\n" +
          "🛑 `!stop` — para tudo e vaza da call\n\n" +
          "Chama tua cremosa e vem pro boteco do Marcinho 🍻"
      )
      .setFooter({ text: "Versão 1.7 — Stream play-dl corrigido 🎧" });

    message.reply({ embeds: [embed] });
  }
});

// ---------- Função para tocar a próxima ----------
async function playNext(guildId) {
  const serverQueue = queue.get(guildId);
  if (!serverQueue) return;

  const song = serverQueue.songs.shift();
  if (!song) {
    const connection = getVoiceConnection(guildId);
    if (connection) connection.destroy();
    queue.delete(guildId);
    return;
  }

  try {
    const ytInfo = await play.video_info(song.url);
    const stream = await play.stream_from_info(ytInfo);

    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
      inlineVolume: true,
    });

    serverQueue.player.play(resource);
    serverQueue.connection.subscribe(serverQueue.player);
    serverQueue.nowPlaying = song;

    const embed = new EmbedBuilder()
      .setColor(0xff6600)
      .setTitle("🎶 Tocando Agora!")
      .setDescription(
        `**${song.title}**\n⏱️ Duração: **${song.duration}**\nPedido por **${song.user}**`
      )
      .setThumbnail(song.thumbnail)
      .setURL(song.url)
      .setFooter({ text: "Marcinho no comando 🎧" });

    const textChannel = serverQueue.voiceChannel.guild.channels.cache.find(
      (ch) => ch.isTextBased() && ch.permissionsFor(client.user).has("SendMessages")
    );

    if (textChannel) textChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error("⚠️ Erro ao tocar:", err);
    const textChannel = serverQueue.voiceChannel.guild.channels.cache.find(
      (ch) => ch.isTextBased() && ch.permissionsFor(client.user).has("SendMessages")
    );
    if (textChannel) textChannel.send("❌ Deu ruim no stream, véi. Vou tentar a próxima...");
    playNext(guildId);
  }
}

client.login(process.env.DISCORD_TOKEN);
