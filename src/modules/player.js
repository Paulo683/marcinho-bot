export function getOrCreatePlayer(client, message) {
  const { channel } = message.member.voice ?? {};
  if (!channel) {
    throw new Error('join-vc-first');
  }

  // cria/recupera player por guild
  let player = client.manager.players.get(message.guild.id);
  if (!player) {
    player = client.manager.create({
      guild: message.guild.id,
      voiceChannel: channel.id,
      textChannel: message.channel.id,
      selfDeafen: true
    });
  }

  // entra no canal caso não conectado
  if (player.state !== 'CONNECTED') player.connect();
  return player;
}
