const { PublicKey } = require("@solana/web3.js");
const { MessageFlags } = require("discord.js");
const { getWallet, saveWallet } = require("../../db");
const { publicKey: dappPublicKey } = require("../../phantomKeyPair");

module.exports = {
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const discordId = interaction.user.id;
      const existingWallet = await getWallet(discordId);

      // Check if already connected
      if (existingWallet) {
        return interaction.editReply({
          content: `🔗 Already connected: \`${existingWallet}\``,
        });
      }

      // Generate connect URL (mobile/desktop logic from earlier)
      const connectUrl = `${process.env.SERVER_URL}/phantom/connect?discord_id=${discordId}`;

      await interaction.editReply({
        content: `[Click here to connect your Phantom Wallet](${connectUrl})`,
      });
    } catch (error) {
      console.error("Connect Error:", error);
      await interaction.editReply({
        content: "⚠️ Failed to initiate wallet connection",
      });
    }
  },
};
