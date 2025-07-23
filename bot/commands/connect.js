const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { PublicKey, Keypair } = require("@solana/web3.js");
const { MessageFlags } = require("discord.js");
const { getWallet, saveWallet } = require("../../db");
const { encrypt } = require("../../utils/crypto");
const { publicKey: dappPublicKey } = require("../../phantomKeyPair");
const crypto = require("crypto");

module.exports = {
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const discordId = interaction.user.id;
      const existingWallet = await getWallet(discordId);

      // Check if already connected
      if (existingWallet) {
        return interaction.editReply({
          content: `🔗 Already connected: \`${existingWallet}\``,
        });
      }

      // Generate a new keypair for the user
      const keypair = Keypair.generate();
      const publicKey = keypair.publicKey.toString();
      const privateKey = keypair.secretKey.toString("hex");

      // Encrypt the private key before storing
      const encryptedPrivateKey = encrypt(
        privateKey,
        process.env.ENCRYPTION_KEY
      );

      // Save both public key and encrypted private key
      await saveWallet(discordId, publicKey, encryptedPrivateKey);

      // Alternative Phantom connection handler
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
