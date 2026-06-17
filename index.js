const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ====================== HELPER FUNCTIONS ======================

async function getCSRFToken() {
    try {
        await axios.post('https://auth.roblox.com/v2/login');
        return null; // This will trigger the error with the token in headers
    } catch (err) {
        return err.response?.headers?.['x-csrf-token'];
    }
}

// Main ranking function
async function rankUser(userId, roleName, groupId) {
    try {
        // 1. Fetch all roles in the group
        const rolesRes = await axios.get(`https://groups.roblox.com/v1/groups/${groupId}/roles`);
        const roles = rolesRes.data.roles;

        // 2. Find the role by exact name
        const targetRole = roles.find(role => role.name === roleName);

        if (!targetRole) {
            return {
                success: false,
                error: `Rank "${roleName}" does not exist in the group. Please use the exact rank name.`
            };
        }

        const roleId = targetRole.id;

        // 3. Get CSRF Token
        const csrfToken = await getCSRFToken();

        // 4. Change rank
        await axios.patch(
            `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`,
            { roleId: roleId },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Cookie': `.ROBLOSECURITY=${process.env.ROBLOX_COOKIE}`,
                    'X-CSRF-TOKEN': csrfToken
                }
            }
        );

        return {
            success: true,
            message: `Successfully ranked user to ${roleName}`
        };

    } catch (error) {
        console.error("Ranking Error Details:", error.response?.data || error.message);

        let errorMsg = error.response?.data?.errors?.[0]?.message || error.message || "Unknown error";

        // User-friendly messages
        if (errorMsg.toLowerCase().includes("invalid role") || 
            errorMsg.toLowerCase().includes("roleid") ||
            errorMsg.toLowerCase().includes("not found")) {
            errorMsg = `Rank "${roleName}" does not exist or you don't have permission to assign it.`;
        } else if (errorMsg.includes("Unauthorized")) {
            errorMsg = "Cookie is invalid or expired. Please update ROBLOX_COOKIE.";
        }

        return {
            success: false,
            error: errorMsg
        };
    }
}

// ====================== ROUTES ======================

app.post('/api/rank', async (req, res) => {
    try {
        const { userId, roleName, groupId } = req.body;

        if (!userId || !roleName || !groupId) {
            return res.status(400).json({
                success: false,
                error: "Missing required fields: userId, roleName, groupId"
            });
        }

        // Authorization check
        if (req.headers.authorization !== 'shakensizzlerankingservicesss2222025') {
            return res.status(401).json({ success: false, error: "Unauthorized" });
        }

        const result = await rankUser(userId, roleName, groupId);
        res.json(result);

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            error: "Internal server error"
        });
    }
});

app.get('/', (req, res) => {
    res.send('Roblox Ranking Proxy is running ✅');
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Ranking proxy running on port ${PORT}`);
});
