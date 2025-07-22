const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  InteractionType,
} = require("discord.js");
const {
  PublicKey,
  LAMPORTS_PER_SOL,
  Connection,
  SystemProgram,
  TransactionMessage,
} = require("@solana/web3.js");
const { getWallet } = require("../../db");

// Constants
const MAX_SOL_AMOUNT = 10;
const MIN_SOL_AMOUNT = 0.001;
const INTERACTION_TIMEOUT = 300_000; // 5 minutes

module.exports = {
  async execute(interaction) {
    try {
      // Immediate acknowledgement
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }

      const wallet = await getWallet(interaction.user.id);
      if (!wallet) {
        return await interaction.editReply({
          content: "❌ Please connect your wallet with `/connect` first",
        });
      }

      const modal = new ModalBuilder()
        .setCustomId(`bundleModal_${Date.now()}`) // Unique ID
        .setTitle("Create Transaction Bundle");

      const recipientInput = new TextInputBuilder()
        .setCustomId("recipientAddress")
        .setLabel("Recipient Solana Address")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const amountInput = new TextInputBuilder()
        .setCustomId("solAmount")
        .setLabel(`Amount (SOL)`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(recipientInput),
        new ActionRowBuilder().addComponents(amountInput)
      );

      await interaction.showModal(modal);
      await interaction.deleteReply(); // Clean up the initial deferral
    } catch (error) {
      console.error("Modal Initialization Error:", error);
      if (!interaction.replied) {
        await interaction
          .reply({
            content: "🔧 Failed to initialize transaction form",
            ephemeral: true,
          })
          .catch(console.error);
      }
    }
  },

  async handleModal(interaction) {
    if (!interaction.isModalSubmit()) return;
    if (!interaction.customId.startsWith("bundleModal_")) return;

    const replyOrEdit = async (content) => {
      if (interaction.replied || interaction.deferred) {
        return interaction.editReply(content);
      }
      return interaction.reply({ ...content, ephemeral: true });
    };

    try {
      // Immediate response to prevent timeout
      await interaction.deferReply({ ephemeral: true });

      const recipientAddress = interaction.fields
        .getTextInputValue("recipientAddress")
        .trim();
      const solAmount = parseFloat(
        interaction.fields.getTextInputValue("solAmount")
      );

      // Input validation
      if (isNaN(solAmount)) throw new Error("INVALID_AMOUNT");
      if (solAmount < MIN_SOL_AMOUNT) throw new Error("AMOUNT_TOO_SMALL");
      if (solAmount > MAX_SOL_AMOUNT) throw new Error("AMOUNT_TOO_LARGE");

      const recipient = new PublicKey(recipientAddress);
      const sender = new PublicKey(await getWallet(interaction.user.id));
      if (recipient.equals(sender)) throw new Error("SELF_TRANSFER");

      // Transaction construction
      const connection = new Connection(process.env.SOLANA_RPC, {
        commitment: "confirmed",
        confirmTransactionInitialTimeout: INTERACTION_TIMEOUT,
      });

      const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
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

      const fee = await connection.getFeeForMessage(messageV0);
      if (fee.value === null) throw new Error("FEE_CALCULATION_FAILED");

      // Confirmation message
      const confirmEmbed = new EmbedBuilder()
        .setTitle("⚠️ Confirm Transaction")
        .addFields(
          { name: "From", value: `\`${sender.toString()}\`` },
          { name: "To", value: `\`${recipient.toString()}\`` },
          { name: "Amount", value: `◎${solAmount.toFixed(4)}` },
          {
            name: "Estimated Fee",
            value: `◎${(fee.value / LAMPORTS_PER_SOL).toFixed(4)}`,
          }
        );

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirmBundle_${Date.now()}`)
          .setLabel("Confirm")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`cancelBundle_${Date.now()}`)
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({
        embeds: [confirmEmbed],
        components: [confirmRow],
      });
    } catch (error) {
      console.error("Transaction Setup Error:", error);

      const errorMessages = {
        INVALID_AMOUNT: "❌ Please enter a valid SOL amount",
        AMOUNT_TOO_SMALL: `❌ Minimum transfer is ◎${MIN_SOL_AMOUNT}`,
        AMOUNT_TOO_LARGE: `❌ Maximum transfer is ◎${MAX_SOL_AMOUNT}`,
        SELF_TRANSFER: "❌ Cannot send to yourself",
        FEE_CALCULATION_FAILED: "⚠️ Failed to calculate network fee",
        DEFAULT: "⚠️ Transaction setup failed",
      };

      await replyOrEdit({
        content: errorMessages[error.message] || errorMessages["DEFAULT"],
      });
    }
  },
};
