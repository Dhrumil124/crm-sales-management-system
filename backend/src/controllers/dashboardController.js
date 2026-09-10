const { dashboardStore } = require("../services/storage");

const getDashboardSummary = async (req, res) => {
  try {
    const organizationId = req.user?.organizationId;
    if (!organizationId) {
      return res.status(401).json({ message: "Organization context is required" });
    }
    const summary = await dashboardStore.getSummary(organizationId);
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch dashboard summary", error: error.message });
  }
};

module.exports = {
  getDashboardSummary
};
