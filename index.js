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

// Get Role ID by Rank
async function getRoleIdByRank(groupId, targetRank, apiKey) {
    try {
        let allRoles = [];
        let pageToken = null;
        const target = Number(targetRank);

        do {
            let url = `https://apis.roblox.com/cloud/v2/groups/${groupId}/roles?maxPageSize=100`;
            if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;

            const response = await axios.get(url, { headers: { 'x-api-key': apiKey } });
            const roles = response.data.groupRoles || response.data.roles || [];
            allRoles = allRoles.concat(roles);
            pageToken = response.data.nextPageToken || null;
        } while (pageToken);

        for (const role of allRoles) {
            if (role.rank === target) {
                const realId = role.id || (role.path ? role.path.split('/').pop() : null);
                return { success: true, roleId: realId };
            }
        }
        return { success: false, error: `No role with rank ${target} found.` };
    } catch (error) {
        console.error('Get roles failed:', error.response?.data || error.message);
        return { success: false, error: 'Failed to fetch roles list' };
    }
}

// Get Role ID by Name
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
            return { success: true, roleId: realId };
        }

        return { success: false, error: `Role "${roleName}" not found.` };
    } catch (error) {
        console.error('Get role by name failed:', error.response?.data || error.message);
        return { success: false, error: 'Failed to fetch roles' };
    }
}

// Get Membership ID
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
        return { success: true, membershipId };
    } catch (error) {
        console.error('Get membership failed:', error.response?.data || error.message);
        return { success: false, error: 'Failed to get membership' };
    }
}

// Main Ranking Function (supports normal rank, promote, demote)
async function rankUser(groupId, userId, roleInput, apiKey, action = null) {
    if (!groupId || !userId) {
        return { success: false, error: 'Missing parameters' };
    }

    let roleId;
    let newRoleName = roleInput;

    if (action === "promote" || action === "demote" || action === "preview_promote" || action === "preview_demote") {
        const memResult = await getMembershipId(groupId, userId, apiKey);
        if (!memResult.success) return memResult;

        // Fetch all roles
        let allRoles = [];
        let pageToken = null;
        do {
            let url = `https://apis.roblox.com/cloud/v2/groups/${groupId}/roles?maxPageSize=100`;
            if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
            const res = await axios.get(url, { headers: { 'x-api-key': apiKey } });
            allRoles = allRoles.concat(res.data.groupRoles || res.data.roles || []);
            pageToken = res.data.nextPageToken;
        } while (pageToken);

        // Find current role
        const currentMembership = await axios.get(`https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships?maxPageSize=10&filter=user=='users/${userId}'`, {
            headers: { 'x-api-key': apiKey }
        });
        const currentRolePath = currentMembership.data.groupMemberships[0]?.role;
        const currentRoleId = currentRolePath ? currentRolePath.split('/').pop() : null;
        const currentRole = allRoles.find(r => r.id === currentRoleId);
        const currentRank = currentRole ? currentRole.rank : 0;

        let targetRank = currentRank;
        if (action.includes("promote")) targetRank = Math.min(255, currentRank + 1);
        if (action.includes("demote")) targetRank = Math.max(0, currentRank - 1);

        const roleResult = await getRoleIdByRank(groupId, targetRank, apiKey);
        if (!roleResult.success) return roleResult;
        roleId = roleResult.roleId;

        // Find the actual role name
        const targetRole = allRoles.find(r => r.rank === targetRank);
        newRoleName = targetRole ? (targetRole.displayName || targetRole.name) : `Rank ${targetRank}`;
    } 
    else if (roleInput) {
        // Normal rank command
        if (isNaN(roleInput)) {
            const roleResult = await getRoleIdByName(groupId, roleInput, apiKey);
            if (!roleResult.success) return roleResult;
            roleId = roleResult.roleId;
        } else if (Number(roleInput) < 1000000) {
            const roleResult = await getRoleIdByRank(groupId, roleInput, apiKey);
            if (!roleResult.success) return roleResult;
            roleId = roleResult.roleId;
        } else {
            roleId = roleInput;
        }
    }

    // Perform the actual rank change
    const memResult = await getMembershipId(groupId, userId, apiKey);
    if (!memResult.success) return memResult;

    try {
        const url = `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${memResult.membershipId}`;
        const body = { role: `groups/${groupId}/roles/${roleId}` };

        await axios.patch(url, body, {
            headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' }
        });

        return { 
            success: true, 
            newRoleName: newRoleName 
        };
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
    console.log('Group:', groupId, 'User:', userId, 'Action:', action || 'set', 'Role:', roleName || roleId);

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

// Debug routes
app.get('/api/roles/:groupId', async (req, res) => {
    const result = await getRoleIdByRank(req.params.groupId, 0, ROBLOX_API_KEY);
    res.json({ success: true, message: 'Check console for roles' });
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
        return interaction.reply({ content: "command does not exist" });
    }
    command.execute(interaction, client);
});

client.commands = new Collection();

client.login(DISCORD_TOKEN).then(() => {
    loadCommands(client);
});
