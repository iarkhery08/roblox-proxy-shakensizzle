const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('promote')
        .setDescription('Promote a ROBLOX player one rank up')
        .addStringOption(option =>
            option.setName('player')
                .setDescription('ROBLOX username or User ID')
                .setRequired(true)),

    async execute(interaction, client) {
        const rankingRole = interaction.guild.roles.cache.find(r => r.name === "Ranking Permissions");
        if (!rankingRole || !interaction.member.roles.cache.has(rankingRole.id)) {
            return interaction.reply({
                content: "You do not have permission to use this command.\nYou need the **Ranking Permissions** role.",
                ephemeral: true
            });
        }

        await interaction.deferReply();

        const playerInput = interaction.options.getString('player').trim();
        const proxyUrl = process.env.PROXY_URL;
        const groupId = process.env.GROUP_ID || '10472096';

        if (!proxyUrl) {
            return interaction.editReply("An error has occured.");
        }

        try {
            // Resolve User
            let userId = playerInput;
            let username = playerInput;

            if (isNaN(playerInput)) {
                const resolveRes = await axios.post(`https://users.roblox.com/v1/usernames/users`, {
                    usernames: [playerInput],
                    excludeBannedUsers: false
                });
                if (!resolveRes.data.data?.length) return interaction.editReply("❌ Could not find that ROBLOX user.");
                userId = resolveRes.data.data[0].id;
                username = resolveRes.data.data[0].name || playerInput;
            } else {
                const userRes = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
                username = userRes.data.name;
            }

            const avatarRes = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`);
            const avatarUrl = avatarRes.data.data[0]?.imageUrl || "https://i.imgur.com/4y3n9jE.png";

            // Get preview of next rank from backend
            let nextRoleName = "Next Rank";
            try {
                const previewRes = await axios.post(proxyUrl, {
                    userId: String(userId),
                    action: "preview_promote",
                    groupId: groupId
                }, {
                    headers: { 'Authorization': 'shakensizzlerankingservicesss2222025' }
                });
                if (previewRes.data.success && previewRes.data.newRoleName) {
                    nextRoleName = previewRes.data.newRoleName;
                }
            } catch (e) {
                console.log("Preview not available, using default");
            }

            // Confirmation Embed with New Rank Name
            const confirmEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('Confirm Promotion')
                .setDescription(`Are you sure you want to promote this player?`)
                .addFields(
                    { name: 'Player', value: `[${username}](https://www.roblox.com/users/${userId})`, inline: true },
                    { name: 'User ID', value: userId.toString(), inline: true },
                    { name: 'New Rank Name', value: nextRoleName, inline: true }
                )
                .setThumbnail(avatarUrl)
                .setFooter({ text: 'Ranking System By: iArkhery' })
                .setTimestamp();

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('confirm_rank').setLabel('Yes').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('cancel_rank').setLabel('No').setStyle(ButtonStyle.Danger)
            );

            const confirmMsg = await interaction.editReply({ embeds: [confirmEmbed], components: [row] });

            const collector = confirmMsg.createMessageComponentCollector({ 
                componentType: ComponentType.Button, 
                time: 30000 
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    return i.reply({ content: "This confirmation is not for you.", ephemeral: true });
                }

                if (i.customId === 'cancel_rank') {
                    await i.update({ content: "Promotion cancelled.", embeds: [], components: [] });
                    collector.stop();
                    return;
                }

                if (i.customId === 'confirm_rank') {
                    await i.update({ content: "🔄 Promotion in progress...", embeds: [], components: [] });

                    const response = await axios.post(proxyUrl, {
                        userId: String(userId),
                        action: "promote",
                        groupId: groupId
                    }, {
                        headers: { 'Authorization': 'shakensizzlerankingservicesss2222025' }
                    });

                    if (response.data.success) {
                        const newRoleName = response.data.newRoleName || nextRoleName || "One rank higher";

                        const successEmbed = new EmbedBuilder()
                            .setColor(0xED4245)
                            .setTitle('Promotion Successful')
                            .addFields(
                                { name: 'Player', value: `[${username}](https://www.roblox.com/users/${userId})`, inline: true },
                                { name: 'User ID', value: userId.toString(), inline: true },
                                { name: 'New Role', value: newRoleName, inline: true }
                            )
                            .setThumbnail(avatarUrl)
                            .setTimestamp();

                        await interaction.editReply({ embeds: [successEmbed], components: [] });

                        // Log with new rank name
                        const logChannel = client.channels.cache.get('989744339951427644');
                        if (logChannel) {
                            const logEmbed = new EmbedBuilder()
                                .setColor(0xED4245)
                                .setTitle('Ranking Log')
                                .addFields(
                                    { name: 'Player', value: `[${username}](https://www.roblox.com/users/${userId})`, inline: true },
                                    { name: 'User ID', value: userId.toString(), inline: true },
                                    { name: 'New Rank Name', value: newRoleName, inline: true },
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

                            await logChannel.send({ embeds: [logEmbed], components: [viewProfileButton] });
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
            let errorMsg = error.response?.data?.error || error.message || "An error occurred.";
            if (error.code === 'ECONNREFUSED') errorMsg = "Cannot connect to ranking service.";
            const errorEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('Promotion Failed')
                .setDescription(errorMsg);
            await interaction.editReply({ embeds: [errorEmbed], components: [] });
        }
    }
};
