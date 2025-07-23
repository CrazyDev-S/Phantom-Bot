const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Wallet functions
async function saveWallet(discordId, publicKey, encryptedPrivateKey) {
  const { error } = await supabase.from("users").upsert(
    {
      discord_id: discordId,
      public_key: publicKey,
      encrypted_private_key: encryptedPrivateKey,
      created_at: new Date().toISOString(),
    },
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

async function getWalletDetails(discordId) {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("discord_id", discordId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data;
  } catch (err) {
    console.error("DB Error:", err);
    return null;
  }
}

// Pending transaction functions
async function createPendingTransaction(data) {
  const id = require("crypto").randomBytes(8).toString("hex");

  const { error } = await supabase.from("pending_transactions").insert({
    id,
    discord_id: data.discordId,
    sender: data.sender,
    recipient: data.recipient,
    amount: data.amount,
    fee: data.fee,
    blockhash: data.blockhash,
    last_valid_block_height: data.lastValidBlockHeight,
    lamports: data.lamports,
  });

  if (error) throw error;
  return id;
}

async function getPendingTransaction(id) {
  try {
    const { data, error } = await supabase
      .from("pending_transactions")
      .select("*")
      .eq("id", id)
      .gt("created_at", new Date(Date.now() - 15 * 60000).toISOString())
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data || null;
  } catch (err) {
    console.error("DB Error:", err);
    return null;
  }
}

async function deletePendingTransaction(id) {
  const { error } = await supabase
    .from("pending_transactions")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Transaction history
async function storeTransaction(data) {
  const { error } = await supabase.from("transactions").insert({
    discord_id: data.discordId,
    signature: data.signature,
    amount: data.amount,
    fee: data.fee,
    sender_address: data.senderAddress,
    recipient_address: data.recipientAddress,
    status: data.status,
  });

  if (error) throw error;
}

module.exports = {
  saveWallet,
  getWallet,
  getWalletDetails,
  createPendingTransaction,
  getPendingTransaction,
  deletePendingTransaction,
  storeTransaction,
};
