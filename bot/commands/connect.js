const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { PublicKey } = require("@solana/web3.js");
const { getWallet, saveWallet } = require("../../db");
const {
  isValidSolanaAddress,
  ensurePublicKey,
  ensureAddress,
} = require("../../utils/solana");

module.exports = {
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const discordId = interaction.user.id;
      const existingWallet = await getWallet(discordId);

      if (existingWallet) {
        return interaction.editReply({
          content: `🔗 Already connected: \`${existingWallet.address}\``,
          components: [
            new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setLabel("View on Explorer")
                .setURL(
                  `https://explorer.solana.com/address/${existingWallet.address}`
                )
                .setStyle(ButtonStyle.Link)
            ),
          ],
        });
      }

      const connectUrl = `${process.env.SERVER_URL}/phantom/auto-connect?discord_id=${discordId}`;

      await interaction.editReply({
        content:
          `[Click here to connect your Phantom Wallet](${connectUrl})\n\n` +
          `After connecting, return here to verify your wallet.`,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("verify_wallet")
              .setLabel("I've Connected My Wallet")
              .setStyle(ButtonStyle.Primary)
          ),
        ],
      });
    } catch (error) {
      console.error("Connect Error:", error);
      await interaction.editReply({
        content: "⚠️ Failed to connect wallet: " + error.message,
      });
    }
  },
};
