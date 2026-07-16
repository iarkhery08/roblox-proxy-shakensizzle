const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkcurrentrank')
        .setDescription('Check a ROBLOX player\'s current role in the group')
        .addStringOption(option =>
            option.setName('player')
                .setDescription('ROBLOX username or User ID')
                .setRequired(true)),

    async execute(interaction, client) {
        await interaction.deferReply();

        const playerInput = interaction.options.getString('player').trim();
        const groupId = process.env.GROUP_ID || '10472096'; // Change if needed

        try {
            // Resolve Roblox User
            let userId = playerInput;
            let username = playerInput;

            if (isNaN(playerInput)) {
                const resolveRes = await axios.post(`https://users.roblox.com/v1/usernames/users`, {
                    usernames: [playerInput],
                    excludeBannedUsers: false
                });
                if (!resolveRes.data.data?.length) {
                    return interaction.editReply("Could not find that ROBLOX user.");
                }
                userId = resolveRes.data.data[0].id;
                username = resolveRes.data.data[0].name || playerInput;
            } else {
                const userRes = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
                username = userRes.data.name;
            }

            // Get avatar
            const avatarRes = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png`);
            const avatarUrl = avatarRes.data.data[0]?.imageUrl || "https://i.imgur.com/4y3n9jE.png";

            // Get current role in group
            const membershipUrl = `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships?maxPageSize=10&filter=user=='users/${userId}'`;
            const membershipRes = await axios.get(membershipUrl, {
                headers: { 'x-api-key': process.env.ROBLOX_API_KEY }
            });

            const memberships = membershipRes.data.groupMemberships || [];
            if (memberships.length === 0) {
                return interaction.editReply(`**${username}** is not in the group.`);
            }

            const rolePath = memberships[0].role || '';
            const currentRoleId = rolePath.split('/').pop();

            // Get role details
            const rolesRes = await axios.get(`https://apis.roblox.com/cloud/v2/groups/${groupId}/roles?maxPageSize=100`, {
                headers: { 'x-api-key': process.env.ROBLOX_API_KEY }
            });

            const allRoles = rolesRes.data.groupRoles || rolesRes.data.roles || [];
            const currentRole = allRoles.find(r => r.id === currentRoleId);

            const roleName = currentRole ? (currentRole.displayName || currentRole.name) : "Unknown";
            const roleRank = currentRole ? currentRole.rank : "N/A";

            const embed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('Current Rank')
                .addFields(
                    { name: 'Player', value: `[${username}](https://www.roblox.com/users/${userId})`, inline: true },
                    { name: 'User ID', value: userId.toString(), inline: true },
                    { name: 'Rank Name', value: roleName, inline: true }
                )
                .setThumbnail(avatarUrl)
                .setFooter({ text: 'Ranking System By: iArkhery' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            const errorMsg = error.response?.data?.error || error.message || "Failed to fetch current rank.";
            const errorEmbed = new EmbedBuilder()
                .setColor(0xED4245)
                .setTitle('Failed')
                .setDescription(errorMsg);
            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }
};
