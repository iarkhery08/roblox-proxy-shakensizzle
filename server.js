const express = require('express');
const axios = require('axios');
const app = express();

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY || 'YOUR_ROBLOX_CLOUD_API_KEY';
const PROXY_SECRET = 'shakensizzlerankingservicesss2222025';

app.use(express.json());

// Helper: Get membership ID for a user
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

        // Extract membership ID from path: "groups/10472096/memberships/abc123xyz456"
        const fullPath = memberships[0].path || '';
        const parts = fullPath.split('/');
        const membershipId = parts[parts.length - 1];   // Last part is the ID

        if (!membershipId || membershipId.length < 5) {
            return { success: false, error: 'Failed to extract membership ID from path' };
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

// Main ranking function
async function rankUser(groupId, userId, roleId, apiKey) {
    if (!groupId || !userId || !roleId) {
        return { success: false, error: 'Missing groupId, userId or roleId' };
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

        console.log(`Updating membership ${membershipId} to role ${roleId}`);

        const response = await axios.patch(url, body, {
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json'
            }
        });

        console.log('Ranking update successful!');
        return { success: true, data: response.data };

    } catch (error) {
        const errData = error.response?.data || {};
        const status = error.response?.status;

        console.error(`PATCH failed - Status: ${status}`, errData);

        let friendlyError = 'Failed to update rank';
        
        if (status === 403) friendlyError = 'Permission denied (API key or group permissions issue)';
        else if (status === 400 || errData.errors?.[0]?.message?.includes('invalid')) {
            friendlyError = 'Invalid request - Check: user in group? role exists? trying to set same rank?';
        }
        else if (errData.errors?.[0]?.message) {
            friendlyError = errData.errors[0].message;
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

    const { userId, roleId, groupId } = req.body;

    console.log('=== Ranking Request ===');
    console.log('Group ID:', groupId);
    console.log('User ID:', userId);
    console.log('Role ID:', roleId);
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

// Debug endpoint (very useful)
app.get('/api/debug/:groupId/:userId', async (req, res) => {
    const { groupId, userId } = req.params;
    const result = await getMembershipId(groupId, userId, ROBLOX_API_KEY);

    res.json({
        groupId,
        userId,
        ...result,
        note: 'Use this to verify if the user is in the group and see the membership ID'
    });
});

// List roles (helpful to confirm roleId exists)
app.get('/api/roles/:groupId', async (req, res) => {
    const { groupId } = req.params;
    try {
        const response = await axios.get(
            `https://apis.roblox.com/cloud/v2/groups/${groupId}/roles?maxPageSize=100`,
            { headers: { 'x-api-key': ROBLOX_API_KEY } }
        );
        res.json({ success: true, roles: response.data });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: error.response?.data || error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Proxy server running on port ${PORT}`);
    console.log(`API Key configured: ${ROBLOX_API_KEY !== 'YOUR_ROBLOX_CLOUD_API_KEY' ? 'Yes' : 'No - SET YOUR API KEY!'}`);
});
