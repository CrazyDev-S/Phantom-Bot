require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  InteractionType,
  ButtonStyle,
} = require("discord.js");
const commands = require("./commands/index");
const path = require("path");

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
});

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

// Register commands
(async () => {
  try {
    console.log("Registering slash commands...");
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );
    console.log("Slash commands registered!");
  } catch (err) {
    console.error("Command registration error:", err);
  }
})();

client.once("ready", () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

// Enhanced interaction handler
client.on("interactionCreate", async (interaction) => {
  try {
    // Handle modal submissions FIRST
    if (interaction.type === InteractionType.ModalSubmit) {
      if (interaction.customId === "bundleModal") {
        console.log(interaction);
        require("./commands/bundle").handleModal(interaction);
      }
      return;
    }

    // Then handle slash commands
    if (interaction.isCommand()) {
      const command = require(`./commands/${interaction.commandName}.js`);
      await command.execute(interaction);
      return;
    }
  } catch (error) {
    console.error("Interaction error:", error);
    if (!interaction.replied) {
      await interaction
        .reply({
          content: "An error occurred",
          ephemeral: true,
        })
        .catch(console.error);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
