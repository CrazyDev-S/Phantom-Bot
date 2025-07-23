const crypto = require("crypto");
const algorithm = "aes-256-cbc";
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(algorithm, ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

function decrypt(text) {
  const [ivPart, encryptedText] = text.split(":");
  if (!ivPart || !encryptedText) throw new Error("Invalid encrypted text");

  const iv = Buffer.from(ivPart, "hex");
  const encrypted = Buffer.from(encryptedText, "hex");
  const decipher = crypto.createDecipheriv(algorithm, ENCRYPTION_KEY, iv);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted;
}

module.exports = { encrypt, decrypt };
