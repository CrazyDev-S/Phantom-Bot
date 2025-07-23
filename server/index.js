const express = require("express");
const bs58 = require("bs58");
const nacl = require("tweetnacl");
const { saveWallet } = require("../db");
const { secretKey } = require("../phantomKeyPair");
const app = express();
const cors = require("cors");
// Add this near the top
const { PublicKey } = require("@solana/web3.js");

// Add this at the top after express initialization
app.use(cors());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Phantom callback server running on port ${PORT}`);
});

// Updated auto-connect handler
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
              const response = await window.solana.connect();
              const publicKey = response.publicKey.toString();
              
              await fetch('/phantom/handle-connect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  discord_id: '${discordId}',
                  public_key: response.publicKey.toBytes(), // Send as bytes
                  address: publicKey // Send as string
                })
              });
              
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
        
        window.onload = autoConnect;
      </script>
    </head>
    <body>
      <p>Connecting wallet...</p>
    </body>
    </html>
  `);
});

// Updated connection handler
app.post("/phantom/handle-connect", express.json(), async (req, res) => {
  const { discord_id, public_key, address } = req.body;

  try {
    // Validate the address matches the public key
    const pubkey = new PublicKey(public_key);
    if (pubkey.toString() !== address) {
      throw new Error("Public key and address mismatch");
    }

    await saveWallet(discord_id, pubkey, address);
    res.status(200).send();
  } catch (error) {
    console.error(error);
    res.status(500).send();
  }
});
