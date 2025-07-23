const { PublicKey } = require("@solana/web3.js");

function ensurePublicKey(input) {
  if (input instanceof PublicKey) return input;
  if (typeof input === "string") return new PublicKey(input);
  if (Buffer.isBuffer(input)) return new PublicKey(input);
  throw new Error("Invalid public key input");
}

function ensureAddress(input) {
  return ensurePublicKey(input).toString();
}

function isValidSolanaAddress(address) {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  ensurePublicKey,
  ensureAddress,
  isValidSolanaAddress,
};
