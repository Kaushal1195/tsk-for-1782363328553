const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { checkEntityOwnership } = require('../middleware/ownershipMiddleware');
const tagController = require('../controllers/tagController');

const router = express.Router();

router.use(authenticateToken); // All tag routes require authentication

// Get all tags available to the user (user-specific, org-specific)
router.get('/', tagController.getAllTags);

// Create a new custom tag (user-specific or org-specific if Admin)
router.post('/', tagController.createTag);

// Update an existing custom tag
router.put('/:id', checkEntityOwnership('tags', 'tag_id'), tagController.updateTag);

// Delete a custom tag
router.delete('/:id', checkEntityOwnership('tags', 'tag_id'), tagController.deleteTag);

module.exports = router;
