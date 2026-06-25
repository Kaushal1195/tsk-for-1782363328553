const { query, withTransaction } = require('../db');
const { v4: uuidv4 } = require('uuid');

// Helper to determine category scope based on user's role and organization
const getCategoryScope = (user) => {
  const { user_id, organization_id, role_name } = user;
  if (organization_id && role_name === 'Admin') {
    return { organization_id, user_id: null }; // Admin can create org-wide
  }
  return { organization_id: null, user_id }; // Individual or Employee creates user-specific
};

// Helper to fetch categories available to a user
const getAvailableCategories = async (user) => {
  const { user_id, organization_id } = user;
  const params = [];
  let queryText = `
    SELECT category_id, name, description, is_system_defined, organization_id, user_id
    FROM categories
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

exports.getAllCategories = async (req, res) => {
  try {
    const categories = await getAvailableCategories(req.user);
    res.status(200).json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Server error fetching categories.', error: error.message });
  }
};

exports.createCategory = async (req, res) => {
  const { name, description } = req.body;
  const { user_id, organization_id } = req.user;

  if (!name) {
    return res.status(400).json({ message: 'Category name is required.' });
  }

  try {
    const { organization_id: scopeOrgId, user_id: scopeUserId } = getCategoryScope(req.user);

    // Check for uniqueness within the determined scope
    const existingCategory = await query(
      `SELECT category_id FROM categories WHERE name = $1 AND is_system_defined = FALSE AND 
       ((${scopeOrgId ? 'organization_id = $2' : 'organization_id IS NULL'}) AND (${scopeUserId ? 'user_id = $3' : 'user_id IS NULL'}))`,
      [name, scopeOrgId, scopeUserId].filter(Boolean) // Filter out nulls for dynamic query
    );

    if (existingCategory.rows.length > 0) {
      return res.status(409).json({ message: 'A category with this name already exists in your scope.' });
    }

    const newCategory = await query(
      'INSERT INTO categories (name, description, is_system_defined, organization_id, user_id) VALUES ($1, $2, FALSE, $3, $4) RETURNING *',
      [name, description, scopeOrgId, scopeUserId]
    );

    res.status(201).json(newCategory.rows[0]);
  } catch (error) {
    console.error('Error creating category:', error);
    res.status(500).json({ message: 'Server error creating category.', error: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Category name is required.' });
  }

  try {
    // Ownership check is handled by middleware `checkEntityOwnership`

    const updatedCategory = await query(
      'UPDATE categories SET name = $1, description = $2 WHERE category_id = $3 RETURNING *',
      [name, description, id]
    );

    res.status(200).json(updatedCategory.rows[0]);
  } catch (error) {
    console.error('Error updating category:', error);
    res.status(500).json({ message: 'Server error updating category.', error: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  const { id } = req.params;

  try {
    // Ownership check is handled by middleware `checkEntityOwnership`

    // Check if category is used by any expenses (ON DELETE RESTRICT)
    const expenseCount = await query('SELECT COUNT(*) FROM expenses WHERE category_id = $1', [id]);
    if (parseInt(expenseCount.rows[0].count) > 0) {
      return res.status(409).json({ message: 'Cannot delete category: it is currently assigned to one or more expenses.' });
    }

    await query('DELETE FROM categories WHERE category_id = $1', [id]);
    res.status(204).send(); // No Content
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Server error deleting category.', error: error.message });
  }
};
