const { Keypair } = require("@solana/web3.js");
const { encrypt } = require("../../utils/crypto");

module.exports = {
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const discordId = interaction.user.id;
      const existingWallet = await getWallet(discordId);

      if (existingWallet) {
        return interaction.editReply({
          content: `🔗 Already connected: \`${existingWallet}\``,
        });
      }

      // Generate new keypair
      const keypair = Keypair.generate();
      const publicKey = keypair.publicKey.toString();

      // Convert private key to hex string
      const privateKeyHex = Buffer.from(keypair.secretKey).toString("hex");

      // Encrypt the private key
      const encryptedPrivateKey = encrypt(
        privateKeyHex,
        process.env.ENCRYPTION_KEY
      );

      // Save to database
      await saveWallet(discordId, publicKey, encryptedPrivateKey);

      await interaction.editReply({
        content:
          `✅ Wallet connected successfully!\n\n` +
          `**Public Key:** \`${publicKey}\``,
        components: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel("View on Explorer")
              .setURL(`https://explorer.solana.com/address/${publicKey}`)
              .setStyle(ButtonStyle.Link)
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
