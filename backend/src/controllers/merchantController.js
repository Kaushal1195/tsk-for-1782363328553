const { query } = require('../db');

// Helper to determine merchant scope based on user's role and organization
const getMerchantScope = (user) => {
  const { user_id, organization_id, role_name } = user;
  if (organization_id && role_name === 'Admin') {
    return { organization_id, user_id: null }; // Admin can create org-wide
  }
  return { organization_id: null, user_id }; // Individual or Employee creates user-specific
};

// Helper to fetch merchants available to a user
const getAvailableMerchants = async (user) => {
  const { user_id, organization_id } = user;
  const params = [];
  let queryText = `
    SELECT m.merchant_id, m.name, m.description, m.is_system_defined, m.organization_id, m.user_id,
           mcd.category_id AS default_category_id, c.name AS default_category_name
    FROM merchants m
    LEFT JOIN merchant_category_defaults mcd ON m.merchant_id = mcd.merchant_id
      AND (mcd.user_id = $1 OR mcd.organization_id = $2)
    LEFT JOIN categories c ON mcd.category_id = c.category_id
    WHERE m.is_system_defined = TRUE
  `;
  params.push(user_id, organization_id); // These will be $1 and $2 for the LEFT JOIN condition

  if (user_id) {
    queryText += ` OR m.user_id = $3`;
    params.push(user_id);
  }
  if (organization_id) {
    queryText += ` OR m.organization_id = $${params.length + 1}`;
    params.push(organization_id);
  }

  const { rows } = await query(queryText, params);
  return rows;
};

exports.getAllMerchants = async (req, res) => {
  try {
    const merchants = await getAvailableMerchants(req.user);
    res.status(200).json(merchants);
  } catch (error) {
    console.error('Error fetching merchants:', error);
    res.status(500).json({ message: 'Server error fetching merchants.', error: error.message });
  }
};

exports.createMerchant = async (req, res) => {
  const { name, description } = req.body;
  const { user_id, organization_id } = req.user;

  if (!name) {
    return res.status(400).json({ message: 'Merchant name is required.' });
  }

  try {
    const { organization_id: scopeOrgId, user_id: scopeUserId } = getMerchantScope(req.user);

    // Check for uniqueness within the determined scope
    const existingMerchant = await query(
      `SELECT merchant_id FROM merchants WHERE name = $1 AND is_system_defined = FALSE AND
       ((${scopeOrgId ? 'organization_id = $2' : 'organization_id IS NULL'}) AND (${scopeUserId ? 'user_id = $3' : 'user_id IS NULL'}))`,
      [name, scopeOrgId, scopeUserId].filter(Boolean)
    );

    if (existingMerchant.rows.length > 0) {
      return res.status(409).json({ message: 'A merchant with this name already exists in your scope.' });
    }

    const newMerchant = await query(
      'INSERT INTO merchants (name, description, is_system_defined, organization_id, user_id) VALUES ($1, $2, FALSE, $3, $4) RETURNING *',
      [name, description, scopeOrgId, scopeUserId]
    );

    res.status(201).json(newMerchant.rows[0]);
  } catch (error) {
    console.error('Error creating merchant:', error);
    res.status(500).json({ message: 'Server error creating merchant.', error: error.message });
  }
};

exports.updateMerchant = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Merchant name is required.' });
  }

  try {
    // Ownership check is handled by middleware `checkEntityOwnership`

    const updatedMerchant = await query(
      'UPDATE merchants SET name = $1, description = $2 WHERE merchant_id = $3 RETURNING *',
      [name, description, id]
    );

    res.status(200).json(updatedMerchant.rows[0]);
  } catch (error) {
    console.error('Error updating merchant:', error);
    res.status(500).json({ message: 'Server error updating merchant.', error: error.message });
  }
};

exports.deleteMerchant = async (req, res) => {
  const { id } = req.params;

  try {
    // Ownership check is handled by middleware `checkEntityOwnership`

    // Note: expenses.merchant_id is ON DELETE SET NULL, so no conflict here.
    // merchant_category_defaults.merchant_id is ON DELETE CASCADE.

    await query('DELETE FROM merchants WHERE merchant_id = $1', [id]);
    res.status(204).send(); // No Content
  } catch (error) {
    console.error('Error deleting merchant:', error);
    res.status(500).json({ message: 'Server error deleting merchant.', error: error.message });
  }
};

exports.setMerchantDefaultCategory = async (req, res) => {
  const { merchantId } = req.params;
  const { category_id } = req.body;
  const { user_id, organization_id, role_name } = req.user;

  if (!category_id) {
    return res.status(400).json({ message: 'Category ID is required.' });
  }

  try {
    // Verify merchant and category exist and are accessible to the user
    const merchantResult = await query(
      `SELECT merchant_id, user_id, organization_id, is_system_defined FROM merchants WHERE merchant_id = $1`,
      [merchantId]
    );
    if (merchantResult.rows.length === 0) {
      return res.status(404).json({ message: 'Merchant not found.' });
    }
    const merchant = merchantResult.rows[0];

    const categoryResult = await query(
      `SELECT category_id, user_id, organization_id, is_system_defined FROM categories WHERE category_id = $1`,
      [category_id]
    );
    if (categoryResult.rows.length === 0) {
      return res.status(404).json({ message: 'Category not found.' });
    }
    const category = categoryResult.rows[0];

    // Determine scope for the default: user-specific or organization-specific
    let defaultOrgId = null;
    let defaultUserId = null;

    if (organization_id && role_name === 'Admin') {
      // Admin can set org-wide default if merchant is org-wide or system-defined
      if (merchant.organization_id === organization_id || merchant.is_system_defined) {
        defaultOrgId = organization_id;
      } else {
        return res.status(403).json({ message: 'Admins can only set organization-wide defaults for organization-owned or system-defined merchants.' });
      }
    } else {
      // Individual user or Employee can set user-specific default
      // Merchant must be user-owned, org-owned (if employee), or system-defined
      if (merchant.user_id === user_id || (merchant.organization_id === organization_id && organization_id) || merchant.is_system_defined) {
        defaultUserId = user_id;
      } else {
        return res.status(403).json({ message: 'You can only set personal defaults for your own merchants, organization merchants, or system-defined merchants.' });
      }
    }

    // Ensure the category is accessible in the chosen scope
    if (defaultOrgId && !(category.organization_id === defaultOrgId || category.is_system_defined)) {
      return res.status(403).json({ message: 'Selected category is not accessible in the organization scope.' });
    }
    if (defaultUserId && !(category.user_id === defaultUserId || category.organization_id === organization_id || category.is_system_defined)) {
      return res.status(403).json({ message: 'Selected category is not accessible in your personal scope.' });
    }


    const result = await query(
      `INSERT INTO merchant_category_defaults (merchant_id, category_id, user_id, organization_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (merchant_id, user_id, organization_id)
       DO UPDATE SET category_id = $2, updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [merchantId, category_id, defaultUserId, defaultOrgId]
    );

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error setting merchant default category:', error);
    res.status(500).json({ message: 'Server error setting merchant default category.', error: error.message });
  }
};

exports.getMerchantDefaultCategory = async (req, res) => {
  const { merchantId } = req.params;
  const { user_id, organization_id } = req.user;

  try {
    const result = await query(
      `SELECT mcd.merchant_category_default_id, mcd.merchant_id, mcd.category_id, c.name AS category_name
       FROM merchant_category_defaults mcd
       JOIN categories c ON mcd.category_id = c.category_id
       WHERE mcd.merchant_id = $1
         AND (mcd.user_id = $2 OR mcd.organization_id = $3)`,
      [merchantId, user_id, organization_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Default category not found for this merchant in your scope.' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching merchant default category:', error);
    res.status(500).json({ message: 'Server error fetching merchant default category.', error: error.message });
  }
};

exports.deleteMerchantDefaultCategory = async (req, res) => {
  const { merchantId } = req.params;
  const { user_id, organization_id } = req.user;

  try {
    const result = await query(
      `DELETE FROM merchant_category_defaults
       WHERE merchant_id = $1
         AND (user_id = $2 OR organization_id = $3)
       RETURNING merchant_category_default_id`,
      [merchantId, user_id, organization_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Default category not found for this merchant in your scope to delete.' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting merchant default category:', error);
    res.status(500).json({ message: 'Server error deleting merchant default category.', error: error.message });
  }
};
