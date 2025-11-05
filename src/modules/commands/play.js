import { getOrCreatePlayer } from '../player.js';
import { resolveQuery } from '../resolve.js';

export const play = {
  name: 'play',
  async run({ client, message, args }) {
    const query = args.join(' ').trim();
    if (!query) return message.reply('⚠️ Fala o nome ou link, jamanta azul.');

    let player;
    try {
      player = getOrCreatePlayer(client, message);
    } catch (e) {
      if (e.message === 'join-vc-first') {
        return message.reply('🎧 Entra em um canal de voz primeiro, jamanta azul!');
      }
      return message.reply('😵‍💫 Deu ruim pra conectar no canal.');
    }

    try {
      const res = await resolveQuery(client, query, message.author);
      if (res.loadType === 'PLAYLIST_LOADED') {
        for (const track of res.tracks) track.requester = message.author;
        player.queue.add(res.tracks);
        message.channel.send(`📚 **Playlist adicionada:** \`${res.playlist.name}\` — ${res.tracks.length} músicas`);
      } else {
        const track = res.tracks[0];
        track.requester = message.author;
        player.queue.add(track);
        message.channel.send({ content: `➕ **Adicionado à Fila:** \`${track.title}\`` });
      }

      if (!player.playing && !player.paused) player.play();
    } catch (e) {
      console.error('play error:', e);
      if (String(e.message).includes('no-matches')) {
        return message.reply('❌ Não encontrei nada com esse nome.');
      }
      return message.reply('⚠️ Deu ruim pra tocar essa música aí, tenta outra!');
    }
  }
};
