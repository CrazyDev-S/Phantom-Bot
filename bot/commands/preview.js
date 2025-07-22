const { Connection, PublicKey, LAMPORTS_PER_SOL } = require("@solana/web3.js");
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

      // Validate public key
      const publicKey = new PublicKey(walletAddress);
      const connection = new Connection(process.env.SOLANA_RPC);

      // Fetch real data
      const balance = await connection.getBalance(publicKey);
      const accountInfo = await connection.getAccountInfo(publicKey);

      await interaction.editReply({
        content: `🖼 **Wallet Preview**:
• Address: \`${publicKey.toString()}\`
• Balance: ◎${(balance / LAMPORTS_PER_SOL).toFixed(4)}
• Executable: ${accountInfo?.executable ? "✅" : "❌"}
• Owner Program: \`${accountInfo?.owner.toString()}\``,
      });
    } catch (error) {
      console.error("Preview Error:", error);
      await interaction.editReply({
        content: "⚠️ Failed to fetch wallet data",
      });
    }
  },
};
