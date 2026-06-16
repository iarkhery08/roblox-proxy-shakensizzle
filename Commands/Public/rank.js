const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Rank a ROBLOX player in the group')
        .addStringOption(option =>
            option.setName('player')
                .setDescription('ROBLOX username or User ID')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('rank')
                .setDescription('Exact rank name (e.g. "Cashier", "Chef")')
                .setRequired(true)),

    async execute(interaction, client) {
        // Permission Check
        const rankingRole = interaction.guild.roles.cache.find(r => r.name === "Ranking Permissions");
        if (!rankingRole || !interaction.member.roles.cache.has(rankingRole.id)) {
            return interaction.reply({
                content: "You do not have permission to use this command.\nYou need the **Ranking Permissions** role.",
                ephemeral: true
            });
        }

        await interaction.deferReply();

        const playerInput = interaction.options.getString('player').trim();
        const roleNameInput = interaction.options.getString('rank').trim();
        const groupId = process.env.GROUP_ID || 'GROUP_ID';
        const proxyUrl = "http://localhost:3000/api/rank";

        try {
            // Resolve Roblox User
            let userId = playerInput;
            let username = playerInput;

            if (isNaN(playerInput)) {
                // FIXED: Use POST request as required by Roblox
                const resolveRes = await axios.post(`https://users.roblox.com/v1/usernames/users`, {
                    usernames: [playerInput],
                    excludeBannedUsers: false
                });

                if (!resolveRes.data.data || resolveRes.data.data.length === 0) {
                    return interaction.editReply("Could not find that ROBLOX user.");
                }
                userId = resolveRes.data.data[0].id;
                username = resolveRes.data.data[0].name || playerInput;
            } else {
                // If ID was given, get username for display
                const userRes = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
                username = userRes.data.name;
            }

            // Get player avatar (headshot)
            const avatarRes = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`);
            const avatarUrl = avatarRes.data.data[0]?.imageUrl || "https://i.imgur.com/4y3n9jE.png";

            // Show confirmation embed
            const confirmEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('Confirm Ranking')
                .setDescription(`Are you sure you want to rank this player?`)
                .addFields(
                    { name: 'Player', value: `[${username}](https://www.roblox.com/users/${userId})`, inline: true },
                    { name: 'User ID', value: userId.toString(), inline: true },
                    { name: 'Role Name', value: roleNameInput, inline: true }
                )
                .setThumbnail(avatarUrl)
                .setFooter({ text: 'Ranking System By: iArkhery' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_rank')
                    .setLabel('Yes')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('cancel_rank')
                    .setLabel('No')
                    .setStyle(ButtonStyle.Danger)
            );

            const confirmMsg = await interaction.editReply({
                embeds: [confirmEmbed],
                components: [row]
            });

            // Button Collector
            const collector = confirmMsg.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 30000
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: "This confirmation is not for you.", ephemeral: true });
                }

                if (i.customId === 'cancel_rank') {
                    await i.update({ content: "Ranking cancelled.", embeds: [], components: [] });
                    collector.stop();
                    return;
                }

                if (i.customId === 'confirm_rank') {
                    await i.update({ content: "Ranking in progress...", embeds: [], components: [] });

                    // Send request to backend
                    const response = await axios.post(proxyUrl, {
                        userId: String(userId),
                        roleName: roleNameInput,
                        groupId: groupId
                    }, {
                        headers: { 'Authorization': 'shakensizzlerankingservicesss2222025' }
                    });

                    if (response.data.success) {
                        const successEmbed = new EmbedBuilder()
                            .setColor(0xED4245)
                            .setTitle('Ranking Successful')
                            .addFields(
                                { name: 'Player', value: `[${username}](https://www.roblox.com/users/${userId})`, inline: true },
                                { name: 'User ID', value: userId.toString(), inline: true },
                                { name: 'Role', value: roleNameInput, inline: true }
                            )
                            .setThumbnail(avatarUrl)
                            .setTimestamp();

                        await interaction.editReply({ embeds: [successEmbed], components: [] });

                        // === LOG TO CHANNEL ===
                        const logChannel = client.channels.cache.get('989744339951427644');
                        if (logChannel) {
                            const logEmbed = new EmbedBuilder()
                                .setColor(0xED4245)
                                .setTitle('Ranking Log')
                                .addFields(
                                    { name: 'Player', value: `[${username}](https://www.roblox.com/users/${userId})`, inline: true },
                                    { name: 'User ID', value: userId.toString(), inline: true },
                                    { name: 'Role Name', value: roleNameInput, inline: true },
                                    { name: 'Ranked by', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
                                )
                                .setThumbnail(avatarUrl)
                                .setFooter({ text: 'Ranking System By: iArkhery' })
                                .setTimestamp();

                            const viewProfileButton = new ActionRowBuilder().addComponents(
                                new ButtonBuilder()
                                    .setLabel('View Profile')
                                    .setStyle(ButtonStyle.Link)
                                    .setURL(`https://www.roblox.com/users/${userId}/profile`)
                            );

                            await logChannel.send({
                                embeds: [logEmbed],
                                components: [viewProfileButton]
                            });
                        }
                    } else {
                        throw new Error(response.data.error || 'Unknown error');
                    }
                }
            });

            collector.on('end', async collected => {
                if (collected.size === 0) {
                    await confirmMsg.edit({ content: "Confirmation timed out.", embeds: [], components: [] });
                }
            });

        } catch (error) {
            console.error(error);
            const errorMsg = error.response?.data?.errors?.[0]?.message || error.message;
            const errorEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('Ranking Failed')
                .setDescription(errorMsg);
            await interaction.editReply({ embeds: [errorEmbed], components: [] });
        }
    }
};
