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
const SOLANA_RPC =
  process.env.SOLANA_RPC || "https://api.mainnet-beta.solana.com";

module.exports = {
  async execute(interaction) {
    try {
      // Check if interaction is already handled
      if (interaction.replied || interaction.deferred) {
        return;
      }

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
        .setMaxLength(44)
        .setPlaceholder("Enter a valid Solana address");

      const amountInput = new TextInputBuilder()
        .setCustomId("solAmount")
        .setLabel(`Amount (SOL) - Min ${MIN_SOL_AMOUNT}, Max ${MAX_SOL_AMOUNT}`)
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setPlaceholder(`0.001 - ${MAX_SOL_AMOUNT} SOL`);

      modal.addComponents(
        new ActionRowBuilder().addComponents(recipientInput),
        new ActionRowBuilder().addComponents(amountInput)
      );

      await interaction.showModal(modal);
    } catch (error) {
      console.error("Modal Initialization Error:", error);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: "🔧 Failed to initialize transaction form",
          ephemeral: true,
        });
      } else {
        await interaction.followUp({
          content: "🔧 Failed to initialize transaction form",
          ephemeral: true,
        });
      }
    }
  },

  async handleModal(interaction) {
    try {
      // Defer the reply first to prevent timeout
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: true });
      }

      // Parse and validate inputs
      const recipientAddress = interaction.fields
        .getTextInputValue("recipientAddress")
        .trim();
      const solAmount = parseFloat(
        interaction.fields.getTextInputValue("solAmount").replace(/,/g, "")
      );

      // Validate amount
      if (isNaN(solAmount)) {
        throw new Error("INVALID_AMOUNT");
      }
      if (solAmount < MIN_SOL_AMOUNT) {
        throw new Error("AMOUNT_TOO_SMALL");
      }
      if (solAmount > MAX_SOL_AMOUNT) {
        throw new Error("AMOUNT_TOO_LARGE");
      }

      // Validate addresses
      const recipient = new PublicKey(recipientAddress);
      const senderWallet = await getWallet(interaction.user.id);
      const sender = new PublicKey(senderWallet);

      if (recipient.equals(sender)) {
        throw new Error("SELF_TRANSFER");
      }

      // Prepare transaction
      const connection = new Connection(SOLANA_RPC);
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

      // Get fee for the message
      const fee = await connection.getFeeForMessage(messageV0);
      if (fee.value === null) {
        throw new Error("FEE_CALCULATION_FAILED");
      }

      // Create confirmation embed
      const confirmEmbed = new EmbedBuilder()
        .setTitle("⚠️ Confirm Transaction")
        .setColor(0xf5a623)
        .addFields(
          {
            name: "From",
            value: `\`${sender.toString()}\``,
            inline: true,
          },
          {
            name: "To",
            value: `\`${recipient.toString()}\``,
            inline: true,
          },
          {
            name: "Amount",
            value: `◎${solAmount.toFixed(4)} SOL`,
            inline: true,
          },
          {
            name: "Network Fee",
            value: `◎${(fee.value / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
            inline: true,
          },
          {
            name: "Total",
            value: `◎${(solAmount + fee.value / LAMPORTS_PER_SOL).toFixed(
              4
            )} SOL`,
            inline: true,
          }
        )
        .setFooter({
          text: "Transaction will be signed with your connected wallet",
        });

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`confirmBundle_${Date.now()}`)
          .setLabel("Confirm & Sign")
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
        INVALID_ADDRESS: "❌ Invalid Solana address format",
        INVALID_AMOUNT: "❌ Please enter a valid SOL amount",
        AMOUNT_TOO_SMALL: `❌ Minimum transfer is ◎${MIN_SOL_AMOUNT} SOL`,
        AMOUNT_TOO_LARGE: `❌ Maximum transfer is ◎${MAX_SOL_AMOUNT} SOL`,
        SELF_TRANSFER: "❌ You cannot send SOL to yourself",
        FEE_CALCULATION_FAILED:
          "⚠️ Failed to calculate network fees. Please try again later",
        DEFAULT: "⚠️ An error occurred while setting up your transaction",
      };

      const errorMessage = errorMap[error.message] || errorMap.DEFAULT;

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({
          content: errorMessage,
          embeds: [],
          components: [],
        });
      } else {
        await interaction.reply({
          content: errorMessage,
          ephemeral: true,
        });
      }
    }
  },

  async handleConfirmation(interaction) {
    try {
      // Immediately defer the update
      await interaction.deferUpdate();

      // Extract data from the embed
      const originalEmbed = interaction.message.embeds[0];
      const fields = originalEmbed.data.fields;

      const sender = fields
        .find((f) => f.name === "From")
        .value.replace(/`/g, "");
      const recipient = fields
        .find((f) => f.name === "To")
        .value.replace(/`/g, "");
      const amount = parseFloat(
        fields.find((f) => f.name === "Amount").value.replace(/◎/g, "")
      );
      const fee = parseFloat(
        fields.find((f) => f.name === "Network Fee").value.replace(/◎/g, "")
      );

      const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
      const connection = new Connection(SOLANA_RPC);

      // Reconstruct transaction
      const senderKey = new PublicKey(sender);
      const recipientKey = new PublicKey(recipient);

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

      // In a real implementation, you would:
      // 1. Get the user's wallet (from your database)
      // 2. Sign the transaction with their private key
      // 3. Send the signed transaction to the network

      // For now, we'll simulate a successful transaction
      const successEmbed = new EmbedBuilder()
        .setTitle("✅ Transaction Successful")
        .setColor(0x2ecc71)
        .addFields(
          { name: "From", value: `\`${sender}\``, inline: true },
          { name: "To", value: `\`${recipient}\``, inline: true },
          { name: "Amount", value: `◎${amount.toFixed(4)} SOL`, inline: true },
          {
            name: "Network Fee",
            value: `◎${fee.toFixed(4)} SOL`,
            inline: true,
          },
          { name: "Status", value: "Confirmed", inline: true }
        )
        .setFooter({ text: "Transaction simulated for development purposes" });

      await interaction.editReply({
        embeds: [successEmbed],
        components: [],
      });
    } catch (error) {
      console.error("Transaction Execution Error:", error);

      const errorEmbed = new EmbedBuilder()
        .setTitle("❌ Transaction Failed")
        .setColor(0xe74c3c)
        .setDescription(`Error: ${error.message}`)
        .setFooter({ text: "Please try again or contact support" });

      await interaction.editReply({
        embeds: [errorEmbed],
        components: [],
      });
    }
  },
};
