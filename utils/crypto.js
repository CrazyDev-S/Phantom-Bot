const crypto = require("crypto");

const algorithm = "aes-256-cbc";
const IV_LENGTH = 16;

function encrypt(text, encryptionKey) {
  if (!encryptionKey) throw new Error("Encryption key is required");

  const key = Buffer.from(encryptionKey, "hex");
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(text, encryptionKey) {
  if (!encryptionKey) throw new Error("Encryption key is required");

  const key = Buffer.from(encryptionKey, "hex");
  const [ivHex, encryptedText] = text.split(":");
  if (!ivHex || !encryptedText) throw new Error("Invalid encrypted text");

  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedText, "hex");
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString("hex");
}

module.exports = { encrypt, decrypt };
