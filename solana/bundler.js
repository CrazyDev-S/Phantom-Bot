const { Connection, Transaction, PublicKey } = require("@solana/web3.js");
const connection = new Connection(process.env.SOLANA_RPC);

async function createBundle(transactions) {
  console.log("📦 Creating transaction bundle...");
  const blockhash = (await connection.getRecentBlockhash()).blockhash;

  const bundle = new Transaction({ recentBlockhash: blockhash });
  transactions.forEach((tx) => bundle.add(tx));

  return bundle;
}

async function sendBundle(signedBundle) {
  console.log("🚀 Sending bundle...");
  const txId = await connection.sendRawTransaction(signedBundle.serialize());
  return txId;
}

module.exports = { createBundle, sendBundle };
