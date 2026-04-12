const express = require('express');
const axios = require('axios');
const app = express();

// Your Roblox Cloud API key
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY || 'YOUR_ROBLOX_CLOUD_API_KEY';

// MUST match the secret in your CloudRankingService
const PROXY_SECRET = 'shakensizzlerankingservicesss2222025';

app.use(express.json());

// Helper function to try different endpoint formats
async function tryRankUser(groupId, userId, roleId, apiKey) {
    const formats = [
        // Format 1: Standard v2 format
        {
            url: `https://apis.roblox.com/cloud/v2/groups/${groupId}/users/${userId}`,
            body: { role: { id: `groups/${groupId}/roles/${roleId}` } }
        },
        // Format 2: With users/ prefix
        {
            url: `https://apis.roblox.com/cloud/v2/groups/${groupId}/users/users/${userId}`,
            body: { role: { id: `groups/${groupId}/roles/${roleId}` } }
        },
        // Format 3: Full resource path for user
        {
            url: `https://apis.roblox.com/cloud/v2/groups/groups/${groupId}/users/users/${userId}`,
            body: { role: { id: `groups/${groupId}/roles/${roleId}` } }
        }
    ];

    let lastError = null;

    for (const format of formats) {
        try {
            console.log(`Trying format: ${format.url}`);
            const response = await axios.patch(format.url, format.body, {
                headers: {
                    'x-api-key': apiKey,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`Success with format: ${format.url}`);
            return { success: true, data: response.data };
        } catch (error) {
            lastError = error;
            console.log(`Failed with format ${format.url}: ${error.response?.status} - ${JSON.stringify(error.response?.data)}`);
        }
    }

    return { success: false, error: lastError };
}

app.post('/api/rank', async (req, res) => {
    // Verify secret
    const authHeader = req.headers['authorization'];
    if (authHeader !== PROXY_SECRET) {
        console.log('Unauthorized request - secret mismatch');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { userId, roleId, groupId } = req.body;

    console.log('=== Ranking Request ===');
    console.log('Group ID:', groupId);
    console.log('User ID:', userId);
    console.log('Role ID:', roleId);
    console.log('=======================');

    const result = await tryRankUser(groupId, userId, roleId, ROBLOX_API_KEY);

    if (result.success) {
        console.log('Ranking successful!');
        res.status(200).json({ success: true, data: result.data });
    } else {
        const error = result.error;
        console.error('All formats failed. Last error:', error.response?.data || error.message);
        
        // Return detailed error info
        res.status(error.response?.status || 500).json({ 
            error: error.response?.data || 'Internal server error',
            details: {
                status: error.response?.status,
                data: error.response?.data,
                message: error.message
            }
        });
    }
});

// Debug endpoint - get user's current role in group
app.get('/api/debug/:groupId/:userId', async (req, res) => {
    const { groupId, userId } = req.params;
    
    console.log('=== Debug Request ===');
    console.log('Group ID:', groupId);
    console.log('User ID:', userId);
    
    const formats = [
        `https://apis.roblox.com/cloud/v2/groups/${groupId}/users/${userId}`,
        `https://apis.roblox.com/cloud/v2/groups/${groupId}/users/users/${userId}`,
        `https://apis.roblox.com/cloud/v2/groups/groups/${groupId}/users/users/${userId}`
    ];
    
    const results = [];
    
    for (const url of formats) {
        try {
            console.log(`Trying GET: ${url}`);
            const response = await axios.get(url, {
                headers: { 'x-api-key': ROBLOX_API_KEY }
            });
            console.log(`Success with: ${url}`);
            results.push({ url, success: true, data: response.data });
        } catch (error) {
            results.push({ 
                url, 
                success: false, 
                status: error.response?.status,
                error: error.response?.data || error.message 
            });
        }
    }
    
    res.json({ 
        groupId, 
        userId,
        results,
        apiKeyConfigured: !!ROBLOX_API_KEY && ROBLOX_API_KEY !== 'YOUR_ROBLOX_CLOUD_API_KEY'
    });
});

// List all roles in a group
app.get('/api/roles/:groupId', async (req, res) => {
    const { groupId } = req.params;
    
    console.log('=== Roles Request ===');
    console.log('Group ID:', groupId);
    
    try {
        const response = await axios.get(
            `https://apis.roblox.com/cloud/v2/groups/${groupId}/roles`,
            {
                headers: { 'x-api-key': ROBLOX_API_KEY }
            }
        );
        
        res.json({ success: true, roles: response.data });
    } catch (error) {
        res.status(500).json({ 
            error: error.response?.data || error.message,
            status: error.response?.status
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
    console.log(`API Key configured: ${ROBLOX_API_KEY !== 'YOUR_ROBLOX_CLOUD_API_KEY' ? 'Yes' : 'No - PLEASE SET YOUR API KEY!'}`);
});
