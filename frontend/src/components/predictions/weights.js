// Plain-language description of the forecasting method (mirrors backend/services/predictionService.js).
export const WEIGHTS_TEXT =
  'Month-end = α × (spending so far ÷ typical share spent by this day) + (1 − α) × weighted average of earlier months, where α is the fraction of the month elapsed. ' +
  'Weights for the latest completed months: 3 months 0.5 / 0.3 / 0.2, 2 months 0.6 / 0.4, 1 month 1.0. Fewer than 3 earlier months is labelled preliminary.';
