# Solana Bundler Discord Bot

## Setup

1. Copy `.env.example` to `.env` and fill in your credentials.
2. Run `npm install`.
3. Run the bot: `node bot/index.js` and server: `node server/index.js`.

## Commands

- `/connect` - Connect your Phantom wallet.
- `/bundle` - Bundle Solana transactions (NFT mint or SPL token transfer).
- `/preview` - Preview your transaction bundle.
- `/status` - Check status of your bundles.

## Environment Variables

- `DISCORD_TOKEN` - Discord bot token.
- `CLIENT_ID` - Discord client ID.
- `GUILD_ID` - Discord guild (server) ID.
- `SOLANA_RPC` - Solana RPC URL (e.g., https://api.mainnet-beta.solana.com).
- `SUPABASE_URL` - Your Supabase project URL.
- `SUPABASE_KEY` - Your Supabase service role key.
- `PHANTOM_CALLBACK_URL` - Your server callback URL for Phantom wallet connection.
