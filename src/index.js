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

client.once("ready", () => {
  console.log(`🍻 Marcinho online como ${client.user.tag}!`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  const serverQueue = queue.get(message.guild.id);

  // ---------- !play ----------
  if (message.content.startsWith("!play")) {
    const args = message.content.split(" ");
    const query = args.slice(1).join(" ");

    if (!query)
      return message.reply("⚠️ So esqueceu o nome ou link né jamanta azul!");

    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel)
      return message.reply("🎧 Larga de ser imbecil, e entra em uma call antes!!");

    let serverQueue = queue.get(message.guild.id);

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

    try {
      const searchResult = await play.search(query, { limit: 1 });
      if (!searchResult.length)
        return message.reply("❌ Não achei essa música, corno triste!");

      const song = searchResult[0];
      const title = song.title;
      const url = song.url;
      const thumbnail = song.thumbnails[0].url || "";
      const duration = song.durationInSec
        ? `${Math.floor(song.durationInSec / 60)}:${String(
            song.durationInSec % 60
          ).padStart(2, "0")}`
        : "??:??";

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

      if (serverQueue.songs.length === 1 && !serverQueue.nowPlaying) {
        playNext(message.guild.id);
      }
    } catch (error) {
      console.error("Erro ao adicionar música:", error);
      message.reply("❌ Ih rapaz... Marcinho não conseguiu achar essa não!");
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
      .setFooter({ text: "Versão 1.7 — Agora busca decente 🍹" });

    message.reply({ embeds: [embed] });
  }
});

// ---------- Função que toca a próxima música ----------
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
    const stream = await play.stream(song.url);
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
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
    console.error("Erro ao tocar:", err);
    playNext(guildId);
  }
}

client.login(process.env.DISCORD_TOKEN);
