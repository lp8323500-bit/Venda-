const {
    Client,
    GatewayIntentBits,
    REST,
    Routes,
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js");

const mysql = require("mysql2/promise");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10
});

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const command = new SlashCommandBuilder()
    .setName("venda")
    .setDescription("Registra uma venda da facção")
    .addStringOption(option =>
        option.setName("item")
            .setDescription("Item vendido")
            .setRequired(true)
    )
    .addIntegerOption(option =>
        option.setName("quantidade")
            .setDescription("Quantidade vendida")
            .setRequired(true)
            .setMinValue(1)
    )
    .addNumberOption(option =>
        option.setName("valor")
            .setDescription("Valor total da venda")
            .setRequired(true)
            .setMinValue(0)
    )
    .addStringOption(option =>
        option.setName("cliente")
            .setDescription("ID ou nome do cliente")
            .setRequired(true)
    );

async function registrarComando() {
    const rest = new REST({ version: "10" }).setToken(TOKEN);

    await rest.put(
        Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
        { body: [command.toJSON()] }
    );

    console.log("Comando /venda registrado!");
}

client.once("ready", async () => {
    console.log(`Bot online como ${client.user.tag}`);

    try {
        await registrarComando();
    } catch (error) {
        console.error("Erro ao registrar comando:", error);
    }
});

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "venda") return;

    try {
        const item = interaction.options.getString("item");
        const quantidade = interaction.options.getInteger("quantidade");
        const valor = interaction.options.getNumber("valor");
        const cliente = interaction.options.getString("cliente");

        await db.execute(
            `INSERT INTO vendas
            (discord_user_id, discord_user_name, item, quantidade, valor, cliente)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                interaction.user.id,
                interaction.user.username,
                item,
                quantidade,
                valor,
                cliente
            ]
        );

        const embed = new EmbedBuilder()
            .setTitle("🛒 VENDA REGISTRADA")
            .setDescription("Uma nova venda da facção foi registrada.")
            .addFields(
                {
                    name: "👤 Vendedor",
                    value: `${interaction.user}\nID: \`${interaction.user.id}\``,
                    inline: false
                },
                { name: "📦 Item", value: item, inline: true },
                { name: "🔢 Quantidade", value: `${quantidade}`, inline: true },
                { name: "💰 Valor", value: `R$ ${valor.toFixed(2)}`, inline: true },
                { name: "👤 Cliente", value: cliente, inline: false }
            )
            .setTimestamp();

        const canalVendas = process.env.CANAL_VENDAS;

        if (canalVendas) {
            const canal = await client.channels.fetch(canalVendas);
            if (canal) await canal.send({ embeds: [embed] });
        }

        await interaction.reply({
            content: "✅ Venda registrada com sucesso!",
            ephemeral: true
        });
    } catch (error) {
        console.error("Erro ao registrar venda:", error);

        if (!interaction.replied) {
            await interaction.reply({
                content: "❌ Ocorreu um erro ao registrar a venda.",
                ephemeral: true
            });
        }
    }
});

client.login(TOKEN);
