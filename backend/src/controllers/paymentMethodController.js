const { query } = require('../db');

// Helper to determine payment method scope based on user's role and organization
const getPaymentMethodScope = (user) => {
  const { user_id, organization_id, role_name } = user;
  if (organization_id && role_name === 'Admin') {
    return { organization_id, user_id: null }; // Admin can create org-wide
  }
  return { organization_id: null, user_id }; // Individual or Employee creates user-specific
};

// Helper to fetch payment methods available to a user
const getAvailablePaymentMethods = async (user) => {
  const { user_id, organization_id } = user;
  const params = [];
  let queryText = `
    SELECT payment_method_id, name, description, is_system_defined, organization_id, user_id
    FROM payment_methods
    WHERE is_system_defined = TRUE
  `;

  if (user_id) {
    queryText += ` OR user_id = $1`;
    params.push(user_id);
  }
  if (organization_id) {
    queryText += ` OR organization_id = $${params.length + 1}`;
    params.push(organization_id);
  }

  const { rows } = await query(queryText, params);
  return rows;
};

exports.getAllPaymentMethods = async (req, res) => {
  try {
    const paymentMethods = await getAvailablePaymentMethods(req.user);
    res.status(200).json(paymentMethods);
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ message: 'Server error fetching payment methods.', error: error.message });
  }
};

exports.createPaymentMethod = async (req, res) => {
  const { name, description } = req.body;
  const { user_id, organization_id } = req.user;

  if (!name) {
    return res.status(400).json({ message: 'Payment method name is required.' });
  }

  try {
    const { organization_id: scopeOrgId, user_id: scopeUserId } = getPaymentMethodScope(req.user);

    // Check for uniqueness within the determined scope
    const existingPaymentMethod = await query(
      `SELECT payment_method_id FROM payment_methods WHERE name = $1 AND is_system_defined = FALSE AND
       ((${scopeOrgId ? 'organization_id = $2' : 'organization_id IS NULL'}) AND (${scopeUserId ? 'user_id = $3' : 'user_id IS NULL'}))`,
      [name, scopeOrgId, scopeUserId].filter(Boolean)
    );

    if (existingPaymentMethod.rows.length > 0) {
      return res.status(409).json({ message: 'A payment method with this name already exists in your scope.' });
    }

    const newPaymentMethod = await query(
      'INSERT INTO payment_methods (name, description, is_system_defined, organization_id, user_id) VALUES ($1, $2, FALSE, $3, $4) RETURNING *',
      [name, description, scopeOrgId, scopeUserId]
    );

    res.status(201).json(newPaymentMethod.rows[0]);
  } catch (error) {
    console.error('Error creating payment method:', error);
    res.status(500).json({ message: 'Server error creating payment method.', error: error.message });
  }
};

exports.updatePaymentMethod = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Payment method name is required.' });
  }

  try {
    // Ownership check is handled by middleware `checkEntityOwnership`

    const updatedPaymentMethod = await query(
      'UPDATE payment_methods SET name = $1, description = $2 WHERE payment_method_id = $3 RETURNING *',
      [name, description, id]
    );

    res.status(200).json(updatedPaymentMethod.rows[0]);
  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({ message: 'Server error updating payment method.', error: error.message });
  }
};

exports.deletePaymentMethod = async (req, res) => {
  const { id } = req.params;

  try {
    // Ownership check is handled by middleware `checkEntityOwnership`

    // Check if payment method is used by any expenses (ON DELETE RESTRICT)
    const expenseCount = await query('SELECT COUNT(*) FROM expenses WHERE payment_method_id = $1', [id]);
    if (parseInt(expenseCount.rows[0].count) > 0) {
      return res.status(409).json({ message: 'Cannot delete payment method: it is currently assigned to one or more expenses.' });
    }

    await query('DELETE FROM payment_methods WHERE payment_method_id = $1', [id]);
    res.status(204).send(); // No Content
  } catch (error) {
    console.error('Error deleting payment method:', error);
    res.status(500).json({ message: 'Server error deleting payment method.', error: error.message });
  }
};
