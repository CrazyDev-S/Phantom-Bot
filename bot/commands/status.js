const { Connection, PublicKey } = require("@solana/web3.js");
const { MessageFlags } = require("discord.js");
const { getWallet } = require("../../db");

module.exports = {
  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      const discordId = interaction.user.id;
      const walletAddress = await getWallet(discordId);

      if (!walletAddress) {
        return interaction.editReply({
          content: "❌ Connect your wallet first with `/connect`",
        });
      }

      const publicKey = new PublicKey(walletAddress);
      const connection = new Connection(process.env.SOLANA_RPC);

      // Fetch last 3 transactions
      const signatures = await connection.getConfirmedSignaturesForAddress2(
        publicKey,
        { limit: 3 }
      );

      const statusMessage =
        signatures.length > 0
          ? signatures
              .map(
                (sig, i) =>
                  `${i + 1}. [\`${sig.signature.slice(
                    0,
                    8
                  )}...\`](https://explorer.solana.com/tx/${sig.signature})`
              )
              .join("\n")
          : "No recent transactions found";

      await interaction.editReply({
        content: `⏳ **Transaction History**:
${statusMessage}`,
      });
    } catch (error) {
      console.error("Status Error:", error);
      await interaction.editReply({
        content: "⚠️ Failed to fetch transaction history",
      });
    }
  },
};
