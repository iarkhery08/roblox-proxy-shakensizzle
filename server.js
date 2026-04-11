const express = require('express');
const axios = require('axios');
const app = express();

// Your Roblox Cloud API key (keep this secret!)
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY || 'YOUR_ROBLOX_CLOUD_API_KEY';
const PROXY_SECRET = process.env.PROXY_SECRET || 'YOUR-SECRET-KEY';

app.use(express.json());

app.post('/api/rank', async (req, res) => {
    // Verify secret
    const authHeader = req.headers['authorization'];
    if (authHeader !== PROXY_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { userId, roleId, groupId } = req.body;

    try {
        // Make the actual Cloud API request
        const response = await axios.patch(
            `https://apis.roblox.com/cloud/v2/groups/${groupId}/users/${userId}`,
            { role: { id: roleId.toString() } },
            {
                headers: {
                    'x-api-key': ROBLOX_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            error: error.response?.data || 'Internal server error' 
        });
    }
});

app.get('/api/test/:groupId/:userId', async (req, res) => {
    const { groupId, userId } = req.params;
    
    try {
        const response = await axios.get(
            `https://apis.roblox.com/cloud/v2/groups/${groupId}/users/${userId}`,
            {
                headers: { 'x-api-key': ROBLOX_API_KEY }
            }
        );
        res.json({ success: true, data: response.data });
    } catch (error) {
        res.status(error.response?.status || 500).json({ 
            error: error.response?.data || error.message,
            status: error.response?.status
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});
