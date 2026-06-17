const { Client, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY; // Must have groups:read + groups:write
const PROXY_SECRET = 'shakensizzlerankingservicesss2222025';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

app.use(express.json());

// ====================== HELPER FUNCTIONS ======================

// FIXED: Missing function
async function getRoleIdByName(groupId, roleName, apiKey) {
    try {
        let allRoles = [];
        let pageToken = null;
        do {
            let url = `https://apis.roblox.com/cloud/v2/groups/${groupId}/roles?maxPageSize=100`;
            if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
            
            const response = await axios.get(url, { headers: { 'x-api-key': apiKey } });
            const roles = response.data.groupRoles || response.data.roles || [];
            allRoles = allRoles.concat(roles);
            pageToken = response.data.nextPageToken || null;
        } while (pageToken);

        const role = allRoles.find(r => 
            r.displayName === roleName || r.name === roleName
        );

        if (!role) {
            return { success: false, error: `Rank "${roleName}" not found.` };
        }

        const roleId = role.id || (role.path ? role.path.split('/').pop() : null);
        return { success: true, roleId, roleName: role.displayName || role.name };
    } catch (error) {
        console.error('Get role by name failed:', error.response?.data || error.message);
        return { success: false, error: 'Failed to fetch roles' };
    }
}

async function getMembershipId(groupId, userId, apiKey) {
    try {
        const filter = `user=='users/${userId}'`;
        const url = `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships?maxPageSize=10&filter=${encodeURIComponent(filter)}`;
        
        const response = await axios.get(url, { headers: { 'x-api-key': apiKey } });
        const memberships = response.data.groupMemberships || [];

        if (memberships.length === 0) {
            return { success: false, error: 'User is not in the group' };
        }

        const fullPath = memberships[0].path || '';
        const membershipId = fullPath.split('/').pop();
        const rolePath = memberships[0].role || '';
        const currentRoleId = rolePath.split('/').pop();

        return { success: true, membershipId, currentRoleId };
    } catch (error) {
        console.error('Get membership failed:', error.response?.data || error.message);
        return { success: false, error: 'Failed to get membership' };
    }
}

// Main ranking function
async function rankUser(groupId, userId, roleInput, apiKey, action = null) {
    if (!groupId || !userId) {
        return { success: false, error: 'Missing parameters' };
    }

    let roleId;
    let newRoleName;

    try {
        if (action && (action.includes('promote') || action.includes('demote'))) {
            const memResult = await getMembershipId(groupId, userId, apiKey);
            if (!memResult.success) return memResult;

            // Get all roles
            let allRoles = [];
            let pageToken = null;
            do {
                let url = `https://apis.roblox.com/cloud/v2/groups/${groupId}/roles?maxPageSize=100`;
                if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
                const res = await axios.get(url, { headers: { 'x-api-key': apiKey } });
                allRoles = allRoles.concat(res.data.groupRoles || res.data.roles || []);
                pageToken = res.data.nextPageToken;
            } while (pageToken);

            const currentRole = allRoles.find(r => r.id === memResult.currentRoleId);
            let currentRank = currentRole ? currentRole.rank : 0;

            let targetRank = currentRank;
            if (action.includes("promote")) targetRank = Math.min(255, currentRank + 1);
            if (action.includes("demote")) targetRank = Math.max(1, currentRank - 1); // avoid 0 (Guest)

            const roleResult = allRoles.find(r => r.rank === targetRank);
            if (!roleResult) return { success: false, error: `Could not find target rank ${targetRank}` };

            roleId = roleResult.id || roleResult.path?.split('/').pop();
            newRoleName = roleResult.displayName || roleResult.name;
        } 
        else if (roleInput) {
            // Rank by name or number
            let roleResult;
            if (isNaN(roleInput)) {
                roleResult = await getRoleIdByName(groupId, roleInput, apiKey);
            } else {
                // Rank by number (you already had getRoleIdByRank)
                roleResult = await getRoleIdByRank(groupId, Number(roleInput), apiKey); // define this if needed
            }

            if (!roleResult.success) return roleResult;
            roleId = roleResult.roleId;
            newRoleName = roleResult.roleName || roleInput;
        }

        // Perform the actual rank change
        const memResult = await getMembershipId(groupId, userId, apiKey);
        if (!memResult.success) return memResult;

        const url = `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${memResult.membershipId}`;
        const body = { role: `groups/${groupId}/roles/${roleId}` };

        await axios.patch(url, body, {
            headers: { 
                'x-api-key': apiKey, 
                'Content-Type': 'application/json' 
            }
        });

        return { success: true, newRoleName };

    } catch (error) {
        console.error('Ranking failed:', error.response?.data || error.message);
        return { 
            success: false, 
            error: error.response?.data?.message || 'Failed to update rank' 
        };
    }
}

// ====================== ROUTES ======================
app.post('/api/rank', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (authHeader !== PROXY_SECRET) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { userId, roleName, action, groupId } = req.body;

    const result = await rankUser(groupId, userId, roleName, ROBLOX_API_KEY, action);

    if (result.success) {
        res.json({ success: true, newRoleName: result.newRoleName });
    } else {
        res.status(400).json({ success: false, error: result.error });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Proxy + Bot running on port ${PORT}`);
});

// ====================== DISCORD BOT ======================
client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('ready', () => {
    client.user.setStatus('idle');
    client.user.setActivity('Ranking commands', { type: 'LISTENING' });
});

client.on("interactionCreate", (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return interaction.reply({ content: "Command does not exist", ephemeral: true });
    command.execute(interaction, client);
});

client.commands = new Collection();
client.login(DISCORD_TOKEN).then(() => {
    const { loadCommands } = require('./Handlers/commandHandler');
    loadCommands(client);
});
