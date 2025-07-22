const express = require("express");
const bs58 = require("bs58");
const nacl = require("tweetnacl");
const { saveWallet } = require("../db");
const { secretKey } = require("../phantomKeyPair");
const app = express();
const cors = require("cors");

// Add this at the top after express initialization
app.use(cors());

app.get("/phantom/callback", async (req, res) => {
  const { discord_id, data, nonce, phantom_encryption_public_key } = req.query;

  if (!discord_id || !data || !nonce || !phantom_encryption_public_key) {
    return res.status(400).send("Missing parameters");
  }

  try {
    // Decode base58 parameters
    const phantomPublicKey = bs58.decode(phantom_encryption_public_key);
    const nonceDecoded = bs58.decode(nonce);
    const dataDecoded = bs58.decode(data);

    // Generate shared secret using dapp secret key and Phantom public key
    const sharedSecret = nacl.box.before(phantomPublicKey, secretKey);

    // Decrypt data
    const decryptedData = nacl.box.open.after(
      dataDecoded,
      nonceDecoded,
      sharedSecret
    );

    if (!decryptedData) {
      throw new Error("Failed to decrypt data");
    }

    const decodedString = new TextDecoder().decode(decryptedData);
    const parsed = JSON.parse(decodedString);

    // Extract user's public key from decrypted payload
    const userPublicKey = parsed.public_key;

    if (!userPublicKey) {
      throw new Error("No public_key found in decrypted data");
    }

    // Save to your DB (discord_id ↔ public_key)
    await saveWallet(discord_id, userPublicKey);

    res.send("✅ Wallet connected successfully! You can return to Discord.");
  } catch (error) {
    console.error("Error decrypting Phantom response:", error);
    res.status(500).send("Failed to decrypt Phantom response");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Phantom callback server running on port ${PORT}`);
});

// Add this after your existing routes
app.get("/phantom/auto-connect", (req, res) => {
  const discordId = req.query.discord_id;

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://unpkg.com/@solana/web3.js@1.70.1/lib/index.iife.js"></script>
      <script>
        async function autoConnect() {
          try {
            if (window.solana && window.solana.isPhantom) {
              // Auto-connect
              const response = await window.solana.connect();
              const publicKey = response.publicKey.toString();
              
              // Send to server
              await fetch('/phantom/handle-connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  discord_id: '${discordId}',
                  public_key: publicKey
                })
              });
              
              // Close window after 1 second
              setTimeout(() => window.close(), 1000);
            } else {
              alert('Phantom not detected');
              window.close();
            }
          } catch (error) {
            console.error(error);
            window.close();
          }
        }
        
        // Run immediately on load
        window.onload = autoConnect;
      </script>
    </head>
    <body>
      <p>Connecting wallet...</p>
    </body>
    </html>
    `);
});

app.post("/phantom/handle-connect", express.json(), async (req, res) => {
  const { discord_id, public_key } = req.body;

  try {
    await saveWallet(discord_id, public_key);
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send();
  }
});
