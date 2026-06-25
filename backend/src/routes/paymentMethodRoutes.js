const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { checkEntityOwnership } = require('../middleware/ownershipMiddleware');
const paymentMethodController = require('../controllers/paymentMethodController');

const router = express.Router();

router.use(authenticateToken); // All payment method routes require authentication

// Get all payment methods available to the user (system-defined, user-specific, org-specific)
router.get('/', paymentMethodController.getAllPaymentMethods);

// Create a new custom payment method (user-specific or org-specific if Admin)
router.post('/', paymentMethodController.createPaymentMethod);

// Update an existing custom payment method
router.put('/:id', checkEntityOwnership('payment_methods', 'payment_method_id'), paymentMethodController.updatePaymentMethod);

// Delete a custom payment method
router.delete('/:id', checkEntityOwnership('payment_methods', 'payment_method_id'), paymentMethodController.deletePaymentMethod);

module.exports = router;
