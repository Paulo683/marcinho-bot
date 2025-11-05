export const stop = {
  name: 'stop',
  async run({ client, message }) {
    const player = client.manager.players.get(message.guild.id);
    if (!player) return message.reply('❌ Nem tô tocando nada, jamanta.');

    player.destroy();
    message.reply('🛑 Parei e vazei da call.');
  }
};
