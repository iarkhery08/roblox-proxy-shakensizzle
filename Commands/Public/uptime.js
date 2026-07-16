const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('uptime')
        .setDescription("Check the bot's uptime"),

    async execute(interaction, client) {
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor((uptime % 86400) / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);

        const uptimeString = `${days}d ${hours}h ${minutes}m ${seconds}s`;

        const embed = new EmbedBuilder()
            .setColor(0xED4245)
            .setTitle('Bot Uptime')
            .setDescription(`**${uptimeString}**`)
            .setFooter({ text: 'Ranking System By: iArkhery' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    }
};

/* const {SlashCommandBuilder, CommandInteraction, PermissionFlagBits} = require("discord.js")

module.exports = {
	data: new SlashCommandBuilder()
		.setName('test')
		.setDescription('Replies with test!'),
	async execute(interaction) {
		await interaction.reply({ content: 'test', ephemeral: false });
	}, 
};

*/
