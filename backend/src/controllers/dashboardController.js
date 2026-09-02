const { dashboardStore } = require("../services/storage");

const getDashboardSummary = async (req, res) => {
  try {
    const summary = await dashboardStore.getSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch dashboard summary", error: error.message });
  }
};

module.exports = {
  getDashboardSummary
};
