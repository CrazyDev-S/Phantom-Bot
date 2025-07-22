const { Connection, PublicKey } = require("@solana/web3.js");
const { getWallet } = require("../../db");

module.exports = {
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    try {
      const discordId = interaction.user.id;
      const walletAddress = await getWallet(discordId);

      if (!walletAddress) {
        return interaction.editReply({
          content: "❌ Connect your wallet first with `/connect`",
        });
      }

      const publicKey = new PublicKey(walletAddress);
      const connection = new Connection(
        process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com"
      );

      // Fetch last 3 transactions using modern method
      const signatures = await connection.getSignaturesForAddress(publicKey, {
        limit: 3,
      });

      let statusMessage;
      if (signatures.length === 0) {
        statusMessage = "No recent transactions found";
      } else {
        statusMessage = signatures
          .map(
            (sig, i) =>
              `${i + 1}. [\`${sig.signature.slice(0, 8)}...\`](${
                sig.blockTime
                  ? `https://solscan.io/tx/${sig.signature}`
                  : `https://explorer.solana.com/tx/${sig.signature}`
              }) - ${
                sig.blockTime
                  ? new Date(sig.blockTime * 1000).toLocaleDateString()
                  : "Pending"
              }`
          )
          .join("\n");
      }

      await interaction.editReply({
        content: `⏳ **Transaction History for \`${publicKey
          .toString()
          .slice(0, 8)}...\`**:\n${statusMessage}`,
      });
    } catch (error) {
      console.error("Status Error:", error);
      await interaction.editReply({
        content: `⚠️ Failed to fetch transaction history: ${error.message}`,
      });
    }
  },
};
