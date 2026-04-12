import { Router, type IRouter } from "express";
const router: IRouter = Router();
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY ?? "";
const PROXY_SECRET = process.env.PROXY_SECRET ?? "";
// POST /api/roblox/rank
router.post("/rank", async (req, res): Promise<void> => {
  const authHeader = req.headers["authorization"];
  if (!PROXY_SECRET || authHeader !== PROXY_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { userId, roleId, groupId } = req.body;
  if (!userId || !roleId || !groupId) {
    res.status(400).json({ error: "Missing userId, roleId, or groupId" });
    return;
  }
  try {
    const membershipId = `groups/${groupId}/memberships/${userId}`;
    const roleName = `groups/${groupId}/roles/${roleId}`;
    const response = await fetch(
      `https://apis.roblox.com/cloud/v2/${membershipId}`,
      {
        method: "PATCH",
        headers: {
          "x-api-key": ROBLOX_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: roleName }),  //  v2 format: role as resource name string
      },
    );
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      res.status(response.status).json({ error: data ?? "Roblox API error" });
      return;
    }
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Internal server error" });
  }
});
// GET /api/roblox/debug/:groupId/:userId
router.get("/debug/:groupId/:userId", async (req, res): Promise<void> => {
  const { groupId, userId } = req.params;
  try {
    //  Correct v2 endpoint: memberships with a filter, not /users/:userId
    const response = await fetch(
      `https://apis.roblox.com/cloud/v2/groups/${groupId}/memberships?filter=user%20%3D%3D%20'users%2F${userId}'`,
      {
        headers: { "x-api-key": ROBLOX_API_KEY },
      },
    );
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      res.status(500).json({ error: data ?? "Roblox API error", status: response.status });
      return;
    }
    const data = await response.json();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});
export default router;
