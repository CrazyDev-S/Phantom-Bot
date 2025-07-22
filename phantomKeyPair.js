const nacl = require("tweetnacl");
const { PublicKey } = require("@solana/web3.js");

const keyPair = nacl.box.keyPair();

// Create a PublicKey instance and convert to base58
const publicKey = new PublicKey(keyPair.publicKey).toString();
const secretKey = keyPair.secretKey;

module.exports = {
  publicKey,
  secretKey,
  keyPair,
};
