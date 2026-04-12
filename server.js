const express = require('express');
const axios = require('axios');
const app = express();

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY || 'YOUR_ROBLOX_CLOUD_API_KEY';
const PROXY_SECRET = process.env.PROXY_SECRET || 'YOUR-SECRET-KEY';

app.use(express.json());

app.post('/api/rank', async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (authHeader !== PROXY_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const { userId, roleId, groupId } = req.body;

    try {
        const response = await axios.patch(
            `https://apis.roblox.com/cloud/v2/groups/${groupId}/users/${userId}`,
            { 
                role: { id: `groups/${groupId}/roles/${roleId}` } 
            },
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

app.get('/api/debug/:groupId/:userId', async (req, res) => {
    const { groupId, userId } = req.params;
    
    console.log('Testing with:');
    console.log('Group ID:', groupId);
    console.log('User ID:', userId);
    console.log('API Key:', ROBLOX_API_KEY ? 'Set' : 'NOT SET');
    
    try {
        const response = await axios.get(
            `https://apis.roblox.com/cloud/v2/groups/${groupId}/users/${userId}`,
            {
                headers: { 'x-api-key': ROBLOX_API_KEY }
            }
        );
        
        console.log('Success:', response.data);
        res.json({ success: true, data: response.data });
    } catch (error) {
        console.log('Error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: error.response?.data || error.message,
            status: error.response?.status
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});
