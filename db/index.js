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

module.exports = { saveWallet, getWallet };
