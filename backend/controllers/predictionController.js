const predictions = require('../services/predictionService');
const { currentMonth } = require('../utils/dateUtils');

const monthOf = (req) => req.query.month || currentMonth();

module.exports = {
  monthEnd: (req, res) => res.json({ success: true, data: predictions.monthEnd(req.user.id, monthOf(req)) }),
  nextMonth: (req, res) => res.json({ success: true, data: predictions.nextMonth(req.user.id) }),
  categories: (req, res) => res.json({ success: true, data: predictions.categoryForecast(req.user.id, monthOf(req)) }),
  insights: (req, res) => res.json({ success: true, data: predictions.insights(req.user.id, monthOf(req)) }),
};
