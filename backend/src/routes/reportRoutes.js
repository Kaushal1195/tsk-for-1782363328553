const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const reportController = require('../controllers/reportController');

const router = express.Router();

router.use(authenticateToken); // All report routes require authentication

// Get expense summary by category or month
router.get('/summary', reportController.getExpenseSummary);

// Export expenses data
router.get('/export', reportController.exportExpenses);

module.exports = router;
