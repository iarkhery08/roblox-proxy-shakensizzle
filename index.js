✅ Here's the corrected full index.js with better promote/demote handling.
The previous version had a bug in how it fetched the current membership/role.
Full Updated index.js
JavaScriptconst { Client, Collection, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, GatewayIntentBits } = require('discord.js');
require('dotenv').config();
const express = require('express');
const axios = require('axios');

const app = express();
const DISCORD_TOKEN = process.env.DISCORD_TOKEN || 'DISCORD_TOKEN';
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY || 'YOUR_ROBLOX_CLOUD_API_KEY';
const PROXY_SECRET = 'shakensizzlerankingservicesss2222025';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ]
});

const { loadCommands } = require('./Handlers/commandHandler');

app.use(express.json());

// ====================== HELPER FUNCTIONS ======================

async function getRoleIdByRank(groupId, targetRank, apiKey) {
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

        for (const role of allRoles) {
            if (role.rank === Number(targetRank)) {
                const realId = role.id || (role.path ? role.path.split('/').pop() : null);
                return { success: true, roleId: realId, roleName: role.displayName || role.name };
            }
        }
        return { success: false, error: `No role with rank ${targetRank} found.` };
    } catch (error) {
        console.error('Get roles failed:', error.response?.data || error.message);
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

// Main function supporting promote / demote
async function rankUser(groupId, userId, roleInput, apiKey, action = null) {
    if (!groupId || !userId) {
        return { success: false, error: 'Missing parameters' };
    }

    let roleId;
    let newRoleName;

    if (action && (action.includes('promote') || action.includes('demote'))) {
        // Get current membership
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
        const currentRank = currentRole ? currentRole.rank : 0;

        let targetRank = currentRank;
        if (action.includes("promote")) targetRank = Math.min(255, currentRank + 1);
        if (action.includes("demote")) targetRank = Math.max(0, currentRank - 1);

        const roleResult = await getRoleIdByRank(groupId, targetRank, apiKey);
        if (!roleResult.success) return roleResult;

        roleId = roleResult.roleId;
        newRoleName = roleResult.roleName || `Rank ${targetRank}`;
    } 
    else if (roleInput) {
        // Normal rank by name or number
        if (isNaN(roleInput)) {
            const roleResult = await getRoleIdByName(groupId, roleInput, apiKey);
            if (!roleResult.success) return roleResult;
            roleId = roleResult.roleId;
            newRoleName = roleInput;
        } else {
            const roleResult = await getRoleIdByRank(groupId, roleInput, apiKey);
            if (!roleResult.success) return roleResult;
            roleId = roleResult.roleId;
            newRoleName = roleInput;
        }
    }

    // Perform PATCH
    const memResult = await getMembershipId(groupId, userId, apiKey);
    if (!memResult.success) return memResult;

    try {
        const url = `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${memResult.membershipId}`;
        const body = { role: `groups/${groupId}/roles/${roleId}` };

        await axios.patch(url, body, {
            headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' }
        });

        return { success: true, newRoleName };
    } catch (error) {
        console.error('PATCH failed:', error.response?.data || error.message);
        return { success: false, error: error.response?.data?.message || 'Failed to update rank' };
    }
}

// ====================== ROUTES ======================

app.post('/api/rank', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (authHeader !== PROXY_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { userId, roleName, roleId, action, groupId } = req.body;

    console.log('\n=== NEW RANKING REQUEST ===');
    console.log('Group:', groupId, 'User:', userId, 'Action:', action, 'Role:', roleName || roleId);

    const result = await rankUser(groupId, userId, roleName || roleId, ROBLOX_API_KEY, action);

    if (result.success) {
        res.json({ 
            success: true, 
            newRoleName: result.newRoleName 
        });
    } else {
        res.status(400).json({ 
            success: false, 
            error: result.error 
        });
    }
});

// Debug
app.get('/api/roles/:groupId', async (req, res) => {
    const result = await getRoleIdByRank(req.params.groupId, 0, ROBLOX_API_KEY);
    res.json({ success: true, message: 'Check server logs' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// ====================== DISCORD BOT ======================

client.once("ready", () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

client.on('ready', () => {
    client.user.setStatus('idle');
    client.user.setActivity('commands', { type: 'LISTENING' });
});

client.on("interactionCreate", (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return interaction.reply({ content: "Command does not exist" });
    command.execute(interaction, client);
});

client.commands = new Collection();

client.login(DISCORD_TOKEN).then(() => {
    loadCommands(client);
});
