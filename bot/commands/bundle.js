const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");
const {
  PublicKey,
  LAMPORTS_PER_SOL,
  Connection,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} = require("@solana/web3.js");
const { getWallet } = require("../../db");

// Constants
const MAX_SOL_AMOUNT = 10;
const MIN_SOL_AMOUNT = 0.001;

module.exports = {
  async execute(interaction) {
    try {
      const wallet = await getWallet(interaction.user.id);
      if (!wallet) {
        return await interaction.reply({
          content: "❌ Please connect your wallet with `/connect` first",
          ephemeral: true,
        });
      }

      const modal = new ModalBuilder()
        .setCustomId("bundleModal")
        .setTitle("Create Transaction Bundle");

      const recipientInput = new TextInputBuilder()
        .setCustomId("recipientAddress")
        .setLabel("Recipient Solana Address")
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(44);

      const amountInput = new TextInputBuilder()
        .setCustomId("solAmount")
        .setLabel(`Amount (SOL) - Max ${MAX_SOL_AMOUNT} SOL`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(recipientInput),
        new ActionRowBuilder().addComponents(amountInput)
      );

      await interaction.showModal(modal);
    } catch (error) {
      console.error("Modal Initialization Error:", error);
      await interaction.reply({
        content: "🔧 Failed to initialize transaction form",
        ephemeral: true,
      });
    }
  },

  async handleModal(interaction) {
    try {
      await interaction.deferReply({ ephemeral: true });

      // 1. Parse and validate inputs
      const recipientAddress = interaction.fields
        .getTextInputValue("recipientAddress")
        .trim();
      const solAmount = parseFloat(
        interaction.fields.getTextInputValue("solAmount").replace(/,/g, "")
      );

      if (isNaN(solAmount)) throw new Error("INVALID_AMOUNT");
      if (solAmount < MIN_SOL_AMOUNT) throw new Error("AMOUNT_TOO_SMALL");
      if (solAmount > MAX_SOL_AMOUNT) throw new Error("AMOUNT_TOO_LARGE");

      // 2. Validate addresses
      const recipient = new PublicKey(recipientAddress);
      const sender = new PublicKey(await getWallet(interaction.user.id));
      if (recipient.equals(sender)) throw new Error("SELF_TRANSFER");

      // 3. Prepare transaction
      const connection = new Connection(process.env.SOLANA_RPC);
      const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);

      // Modern fee calculation
      const transferIx = SystemProgram.transfer({
        fromPubkey: sender,
        toPubkey: recipient,
        lamports,
      });

      const { blockhash } = await connection.getLatestBlockhash();
      const messageV0 = new TransactionMessage({
        payerKey: sender,
        recentBlockhash: blockhash,
        instructions: [transferIx],
      }).compileToV0Message();

      // Get fee for the message
      const fee = await connection.getFeeForMessage(messageV0);
      if (fee.value === null) throw new Error("FEE_CALCULATION_FAILED");

      // 4. Create confirmation
      const confirmEmbed = new EmbedBuilder()
        .setTitle("⚠️ Confirm Transaction")
        .addFields(
          { name: "From", value: `\`${sender.toString().slice(0, 8)}...\`` },
          { name: "To", value: `\`${recipient.toString().slice(0, 8)}...\`` },
          { name: "Amount", value: `◎${solAmount.toFixed(4)}` },
          {
            name: "Estimated Fee",
            value: `◎${(fee.value / LAMPORTS_PER_SOL).toFixed(4)}`,
          }
        )
        .setColor(0xf5a623);

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirmBundle_${Date.now()}`) // Unique ID to prevent collisions
          .setLabel("Confirm")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("cancelBundle")
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({
        embeds: [confirmEmbed],
        components: [confirmRow],
      });
    } catch (error) {
      console.error("Transaction Setup Error:", error);

      const errorMap = {
        INVALID_ADDRESS: "❌ Invalid Solana address",
        INVALID_AMOUNT: "❌ Enter a valid SOL amount",
        AMOUNT_TOO_SMALL: `❌ Minimum transfer is ◎${MIN_SOL_AMOUNT}`,
        AMOUNT_TOO_LARGE: `❌ Maximum transfer is ◎${MAX_SOL_AMOUNT}`,
        SELF_TRANSFER: "❌ Cannot send to yourself",
        FEE_CALCULATION_FAILED: "⚠️ Failed to calculate network fee",
        DEFAULT: "⚠️ Transaction setup failed",
      };

      await interaction.editReply({
        content: errorMap[error.message] || errorMap["DEFAULT"],
        components: [],
      });
    }
  },

  async handleConfirmation(interaction) {
    try {
      await interaction.deferUpdate();

      // Extract original data from embed
      const embed = interaction.message.embeds[0];
      const [sender, recipient, amountStr, feeStr] = embed.fields.map(
        (f) => f.value
      );

      const amount = parseFloat(amountStr.replace("◎", ""));
      const fee = parseFloat(feeStr.replace("◎", ""));
      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);

      // Reconstruct transaction
      const connection = new Connection(process.env.SOLANA_RPC);
      const senderKey = new PublicKey(sender.match(/`(\w+)\.\.\.`/)[1]);
      const recipientKey = new PublicKey(recipient.match(/`(\w+)\.\.\.`/)[1]);

      const transferIx = SystemProgram.transfer({
        fromPubkey: senderKey,
        toPubkey: recipientKey,
        lamports,
      });

      const { blockhash } = await connection.getLatestBlockhash();
      const message = new TransactionMessage({
        payerKey: senderKey,
        recentBlockhash: blockhash,
        instructions: [transferIx],
      }).compileToV0Message();

      const transaction = new VersionedTransaction(message);

      // Here you would:
      // 1. Get user's wallet (from your DB)
      // 2. Sign the transaction
      // 3. Send it to the network
      // Example:
      // const signedTx = await wallet.signTransaction(transaction);
      // const signature = await connection.sendTransaction(signedTx);

      // For now, we'll simulate success
      await interaction.editReply({
        content: `✅ Simulated success! (Real implementation would sign & send)`,
        embeds: [],
        components: [],
      });
    } catch (error) {
      console.error("Transaction Execution Error:", error);
      await interaction.editReply({
        content: `❌ Failed to execute transaction: ${error.message}`,
        embeds: [],
        components: [],
      });
    }
  },
};
