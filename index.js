const { Client, Collection, Events, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, GatewayIntentBits } = require('discord.js');
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

// Original: Get Role ID by Rank
async function getRoleIdByRank(groupId, targetRank, apiKey) {
    try {
        let allRoles = [];
        let pageToken = null;
        const target = Number(targetRank);
        console.log(`Fetching ALL roles for group ${groupId} (with pagination)...`);
        
        do {
            let url = `https://apis.roblox.com/cloud/v2/groups/${groupId}/roles?maxPageSize=100`;
            if (pageToken) {
                url += `&pageToken=${encodeURIComponent(pageToken)}`;
            }
            const response = await axios.get(url, {
                headers: { 'x-api-key': apiKey }
            });
            const data = response.data;
            const roles = data.groupRoles || data.roles || [];
            allRoles = allRoles.concat(roles);
            pageToken = data.nextPageToken || null;
        } while (pageToken);

        console.log(`Total roles fetched: ${allRoles.length}`);

        for (const role of allRoles) {
            if (role.rank === target) {
                const realId = role.id || (role.path ? role.path.split('/').pop() : null);
                console.log(`✅ MATCH FOUND! Rank ${target} → Real Role ID: ${realId}`);
                return { success: true, roleId: realId };
            }
        }
        return { success: false, error: `No role with rank ${target} found.` };
    } catch (error) {
        console.error('Get roles failed:', error.response?.data || error.message);
        return { success: false, error: 'Failed to fetch roles list' };
    }
}

// Get Role ID by Role Name (Case-insensitive)
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

        const foundRole = allRoles.find(role => 
            (role.displayName && role.displayName.toLowerCase() === roleName.toLowerCase()) ||
            (role.name && role.name.toLowerCase() === roleName.toLowerCase())
        );

        if (foundRole) {
            const realId = foundRole.id || (foundRole.path ? foundRole.path.split('/').pop() : null);
            console.log(`✅ Role name match: "${roleName}" → ID: ${realId}`);
            return { success: true, roleId: realId };
        }

        return { success: false, error: `Role "${roleName}" not found in the group.` };
    } catch (error) {
        console.error('Get role by name failed:', error.response?.data || error.message);
        return { success: false, error: 'Failed to fetch roles from Roblox.' };
    }
}

// Get membership ID
async function getMembershipId(groupId, userId, apiKey) {
    try {
        const filter = `user=='users/${userId}'`;
        const url = `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships?maxPageSize=10&filter=${encodeURIComponent(filter)}`;
        const response = await axios.get(url, { headers: { 'x-api-key': apiKey } });
        const memberships = response.data.groupMemberships || [];
        if (memberships.length === 0) {
            return { success: false, error: 'User is not in the group' };
        }
        const membershipId = memberships[0].path.split('/').pop();
        console.log(`Found membership ID: ${membershipId}`);
        return { success: true, membershipId };
    } catch (error) {
        console.error('Get membership failed:', error.response?.data || error.message);
        return { success: false, error: error.response?.data?.message || error.message };
    }
}

//Updated: Main ranking function (now supports role name)
async function rankUser(groupId, userId, roleInput, apiKey, isName = false) {
    if (!groupId || !userId || !roleInput) {
        return { success: false, error: 'Missing parameters' };
    }

    let roleId = roleInput;

    // If role name was provided
    if (isName) {
        console.log(`Role name "${roleInput}" detected - looking up real Role ID...`);
        const roleResult = await getRoleIdByName(groupId, roleInput, apiKey);
        if (!roleResult.success) return roleResult;
        roleId = roleResult.roleId;
    } 
    // Legacy support for rank numbers
    else if (Number(roleInput) < 1000000) {
        console.log(`Rank number ${roleInput} detected - looking up real Role ID...`);
        const roleResult = await getRoleIdByRank(groupId, roleInput, apiKey);
        if (!roleResult.success) return roleResult;
        roleId = roleResult.roleId;
    }

    // Get membership
    const memResult = await getMembershipId(groupId, userId, apiKey);
    if (!memResult.success) return memResult;
    const membershipId = memResult.membershipId;

    // Perform the PATCH
    try {
        const url = `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${membershipId}`;
        const body = { role: `groups/${groupId}/roles/${roleId}` };
        console.log(`Updating to role ID: ${roleId}`);
        const response = await axios.patch(url, body, {
            headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' }
        });
        console.log('Ranking successful!');
        return { success: true };
    } catch (error) {
        const errData = error.response?.data || {};
        const status = error.response?.status;
        console.error(`PATCH failed - Status ${status}:`, errData);
        let msg = 'Failed to update rank';
        if (status === 404) msg = 'Role not found (or invalid role ID)';
        else if (status === 403) msg = 'Permission denied';
        else if (status === 400) msg = 'Invalid request';
        return { success: false, error: msg, details: errData, status };
    }
}

// ====================== ROUTES ======================

// ✅ Updated Route (now accepts roleName)
app.post('/api/rank', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (authHeader !== PROXY_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { userId, roleId, roleName, groupId } = req.body;
    console.log('\n=== NEW RANKING REQUEST ===');
    console.log('Group:', groupId, 'User:', userId, 'Role:', roleName || roleId);

    const result = await rankUser(groupId, userId, roleName || roleId, ROBLOX_API_KEY, !!roleName);
    
    if (result.success) {
        res.json({ success: true, message: 'User ranked successfully' });
    } else {
        res.status(result.status || 500).json({
            success: false,
            error: result.error,
            details: result.details
        });
    }
});

// Debug routes (unchanged)
app.get('/api/roles/:groupId', async (req, res) => {
    const result = await getRoleIdByRank(req.params.groupId, 0, ROBLOX_API_KEY);
    res.json({ success: true, roles: 'Check server console for full list' });
});

app.get('/api/debug/:groupId/:userId', async (req, res) => {
    const result = await getMembershipId(req.params.groupId, req.params.userId, ROBLOX_API_KEY);
    res.json(result);
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
    if (!command) {
        return interaction.reply({ content: "command does not exist - iArkhery" });
    }
    command.execute(interaction, client);
});

client.commands = new Collection();

client.login(DISCORD_TOKEN).then(() => {
    loadCommands(client);
});
