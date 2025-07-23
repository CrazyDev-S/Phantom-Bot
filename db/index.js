const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function saveWallet(discordId, publicKey) {
  const { error } = await supabase
    .from("users")
    .upsert(
      { discord_id: discordId, public_key: publicKey },
      { onConflict: "discord_id" }
    );

  if (error) throw error;
}

async function getWallet(discordId) {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("public_key")
      .eq("discord_id", discordId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data?.public_key || null;
  } catch (err) {
    console.error("DB Error:", err);
    return null;
  }
}

// Add these functions to your db.js file
async function getWalletDetails(discordId) {
  // Implementation to get wallet details including encrypted private key
  // Example:
  return db.query("SELECT * FROM wallets WHERE discord_id = $1", [discordId]);
}

async function storeTransaction(transaction) {
  // Implementation to store transaction in database
  // Example:
  //   /*
  return db.query(
    `INSERT INTO transactions (
        discord_id, 
        signature, 
        amount, 
        fee, 
        sender_address, 
        recipient_address, 
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      transaction.discordId,
      transaction.signature,
      transaction.amount,
      transaction.fee,
      transaction.senderAddress,
      transaction.recipientAddress,
      transaction.status,
    ]
  );
  // */
}

module.exports = {
  getWallet,
  getWalletDetails,
  storeTransaction,
  saveWallet,
};
