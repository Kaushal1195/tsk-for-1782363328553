const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { checkExpenseOwnership } = require('../middleware/ownershipMiddleware');
const expenseController = require('../controllers/expenseController');

const router = express.Router();

router.use(authenticateToken); // All expense routes require authentication

// Create a new expense
router.post('/', expenseController.createExpense);

// Get all expenses with filters and pagination
router.get('/', expenseController.getExpenses);

// Get a single expense by ID
router.get('/:id', checkExpenseOwnership, expenseController.getExpenseById);

// Update an existing expense
router.put('/:id', checkExpenseOwnership, expenseController.updateExpense);

// Delete an expense
router.delete('/:id', checkExpenseOwnership, expenseController.deleteExpense);

module.exports = router;
