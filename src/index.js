import { Client, GatewayIntentBits } from "discord.js";
import fetch from "node-fetch";
import "dotenv/config";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const prefix = process.env.PREFIX || "!";
const LAVALINK_HOST = process.env.LAVALINK_HOST;
const LAVALINK_PORT = process.env.LAVALINK_PORT;
const LAVALINK_SECURE = process.env.LAVALINK_SECURE === "true";
const LAVALINK_PASSWORD = process.env.LAVALINK_PASSWORD;

const protocol = LAVALINK_SECURE ? "https" : "http";

client.once("ready", () => {
  console.log(`🎧 Marcinho online como ${client.user.tag}!`);
});

client.on("messageCreate", async (message) => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === "play") {
    const query = args.join(" ");
    if (!query) return message.reply("❌ Forneça o nome da música!");

    try {
      message.channel.send(`🎵 Procurando: **${query}**...`);

      const url = `${protocol}://${LAVALINK_HOST}:${LAVALINK_PORT}/loadtracks?identifier=ytsearch:${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        headers: {
          Authorization: LAVALINK_PASSWORD,
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (!data.tracks || data.tracks.length === 0)
        return message.reply("😕 Nenhum resultado encontrado.");

      const track = data.tracks[0];
      const title = track.info.title;
      const author = track.info.author;
      const urlTrack = track.info.uri;

      await message.reply(`✅ Tocando agora: **${title}** por **${author}**\n${urlTrack}`);
    } catch (error) {
      console.error(error);
      message.reply("😔 Deu ruim pra tocar essa, tenta outra!");
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
