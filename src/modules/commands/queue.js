export const queue = {
  name: 'queue',
  async run({ client, message }) {
    const player = client.manager.players.get(message.guild.id);
    if (!player || (!player.queue.current && player.queue.size === 0)) {
      return message.reply('📭 A fila tá vazia.');
    }

    const current = player.queue.current
      ? `🎵 **Tocando agora:** ${player.queue.current.title}`
      : '—';

    const upcoming = player.queue.length
      ? player.queue.slice(0, 10).map((t, i) => `${i + 1}. ${t.title}`).join('\n')
      : '—';

    message.reply(`**Fila do Marcinho**\n${current}\n\n**Próximas:**\n${upcoming}`);
  }
};
