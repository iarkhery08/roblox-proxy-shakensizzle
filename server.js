const express = require('express');
const axios = require('axios');
const app = express();

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY || 'YOUR_ROBLOX_CLOUD_API_KEY';
const PROXY_SECRET = 'shakensizzlerankingservicesss2222025';

app.use(express.json());

// ====================== HELPER FUNCTIONS ======================

// Get the REAL Cloud Role ID by rank number (this fixes the 404 error)
async function getRoleIdByRank(groupId, targetRank, apiKey) {
    try {
        const url = `https://apis.roblox.com/cloud/v2/groups/${groupId}/roles?maxPageSize=100`;
        const response = await axios.get(url, {
            headers: { 'x-api-key': apiKey }
        });

        const roles = response.data.groupRoles || [];
        
        for (const role of roles) {
            if (role.rank === Number(targetRank)) {
                console.log(`Found role: ${role.displayName} (Rank ${role.rank}) → Real Role ID: ${role.id}`);
                return { success: true, roleId: role.id };
            }
        }

        return { success: false, error: `No role found with rank ${targetRank}` };
    } catch (error) {
        const errData = error.response?.data || {};
        console.error('Get roles failed:', errData);
        return {
            success: false,
            error: errData.message || 'Failed to fetch roles list'
        };
    }
}

// Get membership ID for a user
async function getMembershipId(groupId, userId, apiKey) {
    try {
        const filter = `user=='users/${userId}'`;
        const url = `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships?maxPageSize=10&filter=${encodeURIComponent(filter)}`;

        console.log(`Fetching membership for user ${userId} in group ${groupId}`);

        const response = await axios.get(url, {
            headers: { 'x-api-key': apiKey }
        });

        const memberships = response.data.groupMemberships || [];

        if (memberships.length === 0) {
            return { success: false, error: 'User is not in the group (or no membership found)' };
        }

        const fullPath = memberships[0].path || '';
        const parts = fullPath.split('/');
        const membershipId = parts[parts.length - 1];

        if (!membershipId || membershipId.length < 5) {
            return { success: false, error: 'Failed to extract membership ID' };
        }

        console.log(`Found membership ID: ${membershipId}`);
        return { success: true, membershipId };
    } catch (error) {
        const errData = error.response?.data || {};
        console.error('Get membership failed:', errData);
        return {
            success: false,
            error: errData.errors?.[0]?.message || error.message || 'Unknown error fetching membership'
        };
    }
}

// Main ranking function (now supports both real roleId OR old rank number)
async function rankUser(groupId, userId, roleInput, apiKey) {
    if (!groupId || !userId || !roleInput) {
        return { success: false, error: 'Missing groupId, userId or role' };
    }

    let roleId = roleInput;

    // If roleInput looks like a small rank number (e.g. 226), convert it to real Role ID
    if (Number(roleInput) < 1000000) {   // Most real role IDs are much larger
        console.log(`Rank number ${roleInput} detected - looking up real Role ID...`);
        const roleResult = await getRoleIdByRank(groupId, roleInput, apiKey);
        if (!roleResult.success) {
            return roleResult;
        }
        roleId = roleResult.roleId;
    }

    // Step 1: Get membership ID
    const memResult = await getMembershipId(groupId, userId, apiKey);
    if (!memResult.success) {
        return memResult;
    }

    const membershipId = memResult.membershipId;

    // Step 2: Update the membership
    try {
        const url = `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships/${membershipId}`;
        const body = {
            role: `groups/${groupId}/roles/${roleId}`
        };

        console.log(`Updating membership ${membershipId} to role ID ${roleId} (full path: ${body.role})`);

        const response = await axios.patch(url, body, {
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ Ranking update successful!');
        return { success: true, data: response.data };
    } catch (error) {
        const errData = error.response?.data || {};
        const status = error.response?.status;
        console.error(`PATCH failed - Status: ${status}`, errData);

        let friendlyError = 'Failed to update rank';

        if (status === 404 && errData.message?.includes('role')) {
            friendlyError = 'Role not found - Check that the role exists and your bot has permission to set it.';
        } else if (status === 403) {
            friendlyError = 'Permission denied (API key scopes or group role permissions issue)';
        } else if (status === 400) {
            friendlyError = 'Invalid request (user not in group? same rank? invalid role?)';
        } else if (errData.message) {
            friendlyError = errData.message;
        }

        return {
            success: false,
            error: friendlyError,
            details: errData,
            status: status
        };
    }
}

// ====================== ROUTES ======================

app.post('/api/rank', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (authHeader !== PROXY_SECRET) {
        return res.status(401).json({ error: 'Unauthorized - wrong secret' });
    }

    const { userId, roleId, groupId } = req.body;   // roleId here can now be rank number like 226

    console.log('=== Ranking Request ===');
    console.log('Group ID:', groupId);
    console.log('User ID:', userId);
    console.log('Requested Role/Rank:', roleId);
    console.log('=======================');

    const result = await rankUser(groupId, userId, roleId, ROBLOX_API_KEY);

    if (result.success) {
        res.status(200).json({ success: true, message: 'User ranked successfully' });
    } else {
        console.error('Ranking failed:', result.error);
        res.status(result.status || 500).json({
            success: false,
            error: result.error,
            details: result.details || null
        });
    }
});

// Keep your old debug and roles endpoints (they are still useful)
app.get('/api/debug/:groupId/:userId', async (req, res) => {
    const { groupId, userId } = req.params;
    const result = await getMembershipId(groupId, userId, ROBLOX_API_KEY);
    res.json({ groupId, userId, ...result });
});

app.get('/api/roles/:groupId', async (req, res) => {
    const { groupId } = req.params;
    try {
        const response = await axios.get(
            `https://apis.roblox.com/cloud/v2/groups/${groupId}/roles?maxPageSize=100`,
            { headers: { 'x-api-key': ROBLOX_API_KEY } }
        );
        res.json({ success: true, roles: response.data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.response?.data || error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
    console.log(`API Key configured: ${ROBLOX_API_KEY !== 'YOUR_ROBLOX_CLOUD_API_KEY' ? 'Yes' : 'No - SET YOUR API KEY!'}`);
});
