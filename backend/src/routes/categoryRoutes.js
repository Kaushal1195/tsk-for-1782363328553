const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { checkEntityOwnership } = require('../middleware/ownershipMiddleware');
const categoryController = require('../controllers/categoryController');

const router = express.Router();

router.use(authenticateToken); // All category routes require authentication

// Get all categories available to the user (system-defined, user-specific, org-specific)
router.get('/', categoryController.getAllCategories);

// Create a new custom category (user-specific or org-specific if Admin)
router.post('/', categoryController.createCategory);

// Update an existing custom category
router.put('/:id', checkEntityOwnership('categories', 'category_id'), categoryController.updateCategory);

// Delete a custom category
router.delete('/:id', checkEntityOwnership('categories', 'category_id'), categoryController.deleteCategory);

module.exports = router;
