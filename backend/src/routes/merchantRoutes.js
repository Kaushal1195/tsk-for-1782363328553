const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { checkEntityOwnership } = require('../middleware/ownershipMiddleware');
const merchantController = require('../controllers/merchantController');

const router = express.Router();

router.use(authenticateToken); // All merchant routes require authentication

// Get all merchants available to the user (system-defined, user-specific, org-specific)
router.get('/', merchantController.getAllMerchants);

// Create a new custom merchant (user-specific or org-specific if Admin)
router.post('/', merchantController.createMerchant);

// Update an existing custom merchant
router.put('/:id', checkEntityOwnership('merchants', 'merchant_id'), merchantController.updateMerchant);

// Delete a custom merchant
router.delete('/:id', checkEntityOwnership('merchants', 'merchant_id'), merchantController.deleteMerchant);

// Set a default category for a merchant
router.post('/:merchantId/default-category', merchantController.setMerchantDefaultCategory);

// Get a default category for a merchant
router.get('/:merchantId/default-category', merchantController.getMerchantDefaultCategory);

// Delete a default category for a merchant
router.delete('/:merchantId/default-category', merchantController.deleteMerchantDefaultCategory);

module.exports = router;
