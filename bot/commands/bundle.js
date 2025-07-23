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
  Keypair,
  sendAndConfirmTransaction,
} = require("@solana/web3.js");
const { getWallet, getWalletDetails, storeTransaction } = require("../../db");
const { decrypt } = require("../../utils/crypto"); // You'll need to implement this

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

      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();
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

      // Store transaction data in customId for later retrieval
      const transactionData = JSON.stringify({
        sender: sender.toString(),
        recipient: recipient.toString(),
        amount: solAmount,
        fee: fee.value / LAMPORTS_PER_SOL,
        blockhash,
        lastValidBlockHeight,
        lamports,
      });

      const confirmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(
            `confirmBundle_${Buffer.from(transactionData).toString("base64")}`
          )
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

      // Check if this is a cancellation
      if (interaction.customId === "cancelBundle") {
        return await interaction.editReply({
          content: "❌ Transaction cancelled",
          components: [],
          embeds: [],
        });
      }

      // Extract transaction data from customId
      const base64Data = interaction.customId.replace("confirmBundle_", "");
      const transactionData = JSON.parse(
        Buffer.from(base64Data, "base64").toString()
      );

      const {
        sender,
        recipient,
        amount,
        fee,
        blockhash,
        lastValidBlockHeight,
        lamports,
      } = transactionData;

      const connection = new Connection(SOLANA_RPC);

      // Reconstruct transaction
      const senderKey = new PublicKey(sender);
      const recipientKey = new PublicKey(recipient);

      const transferIx = SystemProgram.transfer({
        fromPubkey: senderKey,
        toPubkey: recipientKey,
        lamports,
      });

      const message = new TransactionMessage({
        payerKey: senderKey,
        recentBlockhash: blockhash,
        instructions: [transferIx],
      }).compileToV0Message();

      const transaction = new VersionedTransaction(message);

      // Get user's encrypted private key from database
      const walletDetails = await getWalletDetails(interaction.user.id);
      if (!walletDetails || !walletDetails.encryptedPrivateKey) {
        throw new Error("Wallet details not found");
      }

      // Decrypt private key (you need to implement this)
      const privateKey = decrypt(
        walletDetails.encryptedPrivateKey,
        process.env.ENCRYPTION_KEY
      );

      // Create keypair from decrypted private key
      const keypair = Keypair.fromSecretKey(Uint8Array.from(privateKey));

      // Sign the transaction
      transaction.sign([keypair]);

      // Send transaction to Solana network
      const signature = await connection.sendTransaction(transaction);

      // Confirm transaction
      const confirmation = await connection.confirmTransaction(
        {
          signature,
          blockhash,
          lastValidBlockHeight,
        },
        "confirmed"
      );

      // Store transaction in database
      await storeTransaction({
        discordId: interaction.user.id,
        signature,
        amount: parseFloat(amount),
        fee: parseFloat(fee),
        senderAddress: sender,
        recipientAddress: recipient,
        status: confirmation.value.err ? "failed" : "confirmed",
      });

      // Create success embed
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
          {
            name: "Signature",
            value: `[View on Explorer](https://explorer.solana.com/tx/${signature})`,
            inline: false,
          }
        )
        .setFooter({
          text: `Status: ${confirmation.value.err ? "Failed" : "Confirmed"}`,
        });

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
