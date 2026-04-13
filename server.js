const express = require('express');
const axios = require('axios');
const app = express();

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY || 'YOUR_ROBLOX_CLOUD_API_KEY';
const PROXY_SECRET = 'shakensizzlerankingservicesss2222025';

app.use(express.json());

// ====================== HELPER FUNCTIONS ======================

// Improved: Get real Role ID by rank + full debug output
async function getRoleIdByRank(groupId, targetRank, apiKey) {
    try {
        const url = `https://apis.roblox.com/cloud/v2/groups/${groupId}/roles?maxPageSize=100`;
        console.log(`Fetching all roles for group ${groupId}...`);

        const response = await axios.get(url, {
            headers: { 'x-api-key': apiKey }
        });

        const rolesData = response.data;
        console.log('Roles response structure:', Object.keys(rolesData)); // helps see if it's groupRoles or roles

        const roles = rolesData.groupRoles || rolesData.roles || [];
        console.log(`Found ${roles.length} roles in total`);

        if (roles.length === 0) {
            console.log('WARNING: No roles returned at all. Possible permission issue.');
            return { success: false, error: 'No roles returned from API' };
        }

        // Print all available ranks for debugging
        console.log('=== Available Ranks in Group ===');
        roles.forEach(role => {
            console.log(`Rank: ${role.rank} | ID: ${role.id || role.path} | Name: ${role.displayName || role.name}`);
        });
        console.log('=============================');

        const target = Number(targetRank);
        for (const role of roles) {
            if (role.rank === target) {
                const realId = role.id || (role.path ? role.path.split('/').pop() : null);
                console.log(`✅ MATCH FOUND! Rank ${target} → Real Role ID: ${realId} (${role.displayName || role.name})`);
                return { success: true, roleId: realId };
            }
        }

        console.log(`❌ No role with rank ${target} found.`);
        return { success: false, error: `No role found with rank ${target}` };
    } catch (error) {
        const errData = error.response?.data || {};
        console.error('Get roles failed:', errData);
        return {
            success: false,
            error: errData.message || 'Failed to fetch roles list'
        };
    }
}

// Get membership ID
async function getMembershipId(groupId, userId, apiKey) {
    try {
        const filter = `user=='users/${userId}'`;
        const url = `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships?maxPageSize=10&filter=${encodeURIComponent(filter)}`;

        console.log(`Fetching membership for user ${userId} in group ${groupId}`);

        const response = await axios.get(url, { headers: { 'x-api-key': apiKey } });

        const memberships = response.data.groupMemberships || [];
        if (memberships.length === 0) {
            return { success: false, error: 'User is not in the group' };
        }

        const fullPath = memberships[0].path || '';
        const membershipId = fullPath.split('/').pop();

        console.log(`Found membership ID: ${membershipId}`);
        return { success: true, membershipId };
    } catch (error) {
        const errData = error.response?.data || {};
        console.error('Get membership failed:', errData);
        return { success: false, error: errData.message || error.message };
    }
}

// Main ranking function
async function rankUser(groupId, userId, roleInput, apiKey) {
    if (!groupId || !userId || !roleInput) {
        return { success: false, error: 'Missing parameters' };
    }

    let roleId = roleInput;

    // Auto-convert small rank numbers (like 226) to real Role ID
    if (Number(roleInput) < 1000000) {
        console.log(`Rank number ${roleInput} detected - looking up real Role ID...`);
        const roleResult = await getRoleIdByRank(groupId, roleInput, apiKey);
        if (!roleResult.success) {
            return roleResult;
        }
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

app.post('/api/rank', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (authHeader !== PROXY_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { userId, roleId, groupId } = req.body;

    console.log('\n=== NEW RANKING REQUEST ===');
    console.log('Group:', groupId, 'User:', userId, 'Rank/Role:', roleId);

    const result = await rankUser(groupId, userId, roleId, ROBLOX_API_KEY);

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

// Useful debug routes
app.get('/api/roles/:groupId', async (req, res) => {
    const result = await getRoleIdByRank(req.params.groupId, 0, ROBLOX_API_KEY); // dummy rank to trigger full list
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
