const PHANTOM_DEEPLINK = "https://phantom.app/ul/v1/connect";

module.exports = {
  async execute(interaction) {
    await interaction.reply({
      content: `🔗 Click to connect your Phantom Wallet: [Connect Wallet](${PHANTOM_DEEPLINK})`,
      ephemeral: true,
    });
  },
};
