import "libsodium-wrappers";
import "opusscript";
import "./keepalive.js";
import play from "play-dl";

// Garante que o YouTube funcione no Railway
await play.setToken({
  youtube: { cookie: process.env.YT_COOKIE || "" }
});
import { Client, GatewayIntentBits } from "discord.js";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
} from "@discordjs/voice";
import play from "play-dl";
import dotenv from "dotenv";


dotenv.config();

// Configura o cliente do Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const queue = new Map();

// Autenticação automática no YouTube (sem prompt)
(async () => {
  try {
    await play.authorization();
    console.log("✅ Autorização YouTube feita com sucesso (modo automático)");
  } catch (err) {
    console.log("⚠️ Ignorando erro de autorização:", err.message);
  }
})();

// Evento quando o bot estiver online
client.once("ready", () => {
  console.log(`🎵 Marcinho online como ${client.user.tag}!`);
});

// Evento de mensagem
client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!play") || message.author.bot) return;

  const query = message.content.replace("!play", "").trim();
  if (!query) return message.reply("🎶 Escreve o nome ou link da música, pô!");

  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel)
    return message.reply("🚫 Entra num canal de voz primeiro, doido!");

  const serverQueue = queue.get(message.guild.id);

  try {
    // Busca a música
    const yt = await play.search(query, { limit: 1 });
    if (!yt.length)
      return message.reply("❌ Deu ruim pra achar essa música aí, tenta outra!");

    const song = {
      title: yt[0].title,
      url: yt[0].url,
      requestedBy: message.author.username,
    };

    if (!serverQueue) {
      const queueObject = {
        voiceChannel,
        connection: null,
        player: null,
        songs: [],
        playing: false,
      };

      queue.set(message.guild.id, queueObject);
      queueObject.songs.push(song);

      try {
        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: message.guild.id,
          adapterCreator: message.guild.voiceAdapterCreator,
        });
        queueObject.connection = connection;
        playSong(message, queueObject);
      } catch (err) {
        console.error("Erro ao entrar no canal de voz:", err);
        queue.delete(message.guild.id);
        return message.reply("⚠️ Deu ruim pra entrar no canal de voz!");
      }
    } else {
      serverQueue.songs.push(song);
      message.reply(`🎵 Adicionado à fila: **${song.title}**`);
    }
  } catch (err) {
    console.error("Erro ao processar comando:", err);
    message.reply("❌ Deu ruim pra tocar essa música aí, tenta outra!");
  }
});

async function playSong(message, queueObject) {
  if (!queueObject.songs.length) {
    queueObject.connection.destroy();
    queue.delete(message.guild.id);
    return message.channel.send("🍺 Fila acabou. Fui pegar outra gelada!");
  }

  const song = queueObject.songs[0];
  try {
    const stream = await play.stream(song.url);
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
    });

    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Play },
    });

    queueObject.player = player;
    queueObject.playing = true;
    player.play(resource);
    queueObject.connection.subscribe(player);

    message.channel.send(
      `🎶 Tocando agora: **${song.title}** (pedido por ${song.requestedBy})`
    );

    player.on(AudioPlayerStatus.Idle, () => {
      queueObject.songs.shift();
      playSong(message, queueObject);
    });

    player.on("error", (error) => {
      console.error("Erro ao tocar:", error);
      message.channel.send("⚠️ Deu ruim durante a reprodução!");
      queueObject.songs.shift();
      playSong(message, queueObject);
    });
  } catch (err) {
    console.error("Erro tocando stream:", err);
    message.channel.send("⚠️ Não consegui tocar essa música, tenta outra!");
    queueObject.songs.shift();
    playSong(message, queueObject);
  }
}

// Login
client.login(process.env.DISCORD_TOKEN);
