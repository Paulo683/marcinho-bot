export const ping = {
  name: 'ping',
  async run({ message }) {
    const m = await message.reply('🏓 Pong?');
    await m.edit(`🏓 **Pong!** Latência: \`${m.createdTimestamp - message.createdTimestamp}ms\``);
  }
};
