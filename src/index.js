import { Client, GatewayIntentBits } from "discord.js";
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, NoSubscriberBehavior } from "@discordjs/voice";
import play from "play-dl";
import dotenv from "dotenv";

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const queue = new Map();

// 🔹 Autorização automática do YouTube (sem prompt)
(async () => {
  try {
    await play.authorization();
    console.log("✅ Autorização YouTube feita com sucesso (modo automático)");
  } catch (err) {
    console.log("⚠️ Ignorando erro de autorização:", err.message);
  }
})();

client.once("ready", () => {
  console.log(`🍺 Marcinho online como ${client.user.tag}!`);
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!play") || message.author.bot) return;

  const args = message.content.split(" ").slice(1);
  const query = args.join(" ");
  if (!query) return message.reply("❌ Me diga o nome ou link da música!");

  const voiceChannel = message.member?.voice?.channel;
  if (!voiceChannel) return message.reply("🎧 Entra num canal de voz primeiro, irmão!");

  const guildQueue = queue.get(message.guild.id);
  if (!guildQueue) {
    const queueObject = {
      voiceChannel,
      textChannel: message.channel,
      connection: null,
      player: createAudioPlayer({
        behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
      }),
      songs: [],
      playing: false,
      notified: false,
    };
    queue.set(message.guild.id, queueObject);
    await execute(message, queueObject, query);
  } else {
    guildQueue.songs.push(query);
    const videoInfo = await play.search(query, { limit: 1 });
    if (videoInfo.length) {
      const song = videoInfo[0];
      const embed = {
        title: "🎵 Adicionado à Fila!",
        description: `**${song.title}**\nPedido por ${message.author.username}`,
        color: 0x00ff00,
        thumbnail: { url: song.thumbnails[0].url },
      };
      message.reply({ embeds: [embed] });
    }
  }
});

async function execute(message, queueObject, query) {
  try {
    const video = await play.search(query, { limit: 1 });
    if (!video.length) return message.reply("❌ Não encontrei nada com esse nome.");

    const song = video[0];
    const embed = {
      title: "🎵 Tocando Agora!",
      description: `**${song.title}**\nPedido por ${message.author.username}`,
      color: 0x00ffff,
      thumbnail: { url: song.thumbnails[0].url },
    };
    message.reply({ embeds: [embed] });

    const connection = joinVoiceChannel({
      channelId: queueObject.voiceChannel.id,
      guildId: queueObject.voiceChannel.guild.id,
      adapterCreator: queueObject.voiceChannel.guild.voiceAdapterCreator,
    });

    queueObject.connection = connection;

    // 🔹 Garante compatibilidade de stream no Railway
    const yt = await play.stream(song.url, { discordPlayerCompatibility: true });
    const resource = createAudioResource(yt.stream, { inputType: yt.type });

    queueObject.player.play(resource);
    queueObject.connection.subscribe(queueObject.player);
    queueObject.playing = true;

    queueObject.player.on(AudioPlayerStatus.Idle, () => {
      queueObject.songs.shift();
      if (queueObject.songs.length > 0) {
        execute(message, queueObject, queueObject.songs[0]);
      } else if (!queueObject.notified) {
        queueObject.notified = true;
        message.channel.send("🍺 Fila acabou. Fui pegar outra gelada!");
        queueObject.connection.destroy();
        queue.delete(message.guild.id);
      }
    });
  } catch (error) {
    console.error("Erro tocando stream:", error);
    message.reply("⚠️ Deu ruim pra tocar essa música aí, tenta outra!");
    queue.delete(message.guild.id);
  }
}

client.login(process.env.DISCORD_TOKEN);
