const { query } = require('../db');

// Helper to determine tag scope based on user's role and organization
const getTagScope = (user) => {
  const { user_id, organization_id, role_name } = user;
  if (organization_id && role_name === 'Admin') {
    return { organization_id, user_id: null }; // Admin can create org-wide
  }
  return { organization_id: null, user_id }; // Individual or Employee creates user-specific
};

// Helper to fetch tags available to a user
const getAvailableTags = async (user) => {
  const { user_id, organization_id } = user;
  const params = [];
  let queryText = `
    SELECT tag_id, name, description, organization_id, user_id
    FROM tags
    WHERE 1=1
  `;

  if (user_id) {
    queryText += ` AND (user_id = $1`;
    params.push(user_id);
  }
  if (organization_id) {
    queryText += `${user_id ? ' OR ' : ' AND ('} organization_id = $${params.length + 1}`;
    params.push(organization_id);
  }
  if (user_id || organization_id) {
    queryText += `)`;
  }

  const { rows } = await query(queryText, params);
  return rows;
};

exports.getAllTags = async (req, res) => {
  try {
    const tags = await getAvailableTags(req.user);
    res.status(200).json(tags);
  } catch (error) {
    console.error('Error fetching tags:', error);
    res.status(500).json({ message: 'Server error fetching tags.', error: error.message });
  }
};

exports.createTag = async (req, res) => {
  const { name, description } = req.body;
  const { user_id, organization_id } = req.user;

  if (!name) {
    return res.status(400).json({ message: 'Tag name is required.' });
  }

  try {
    const { organization_id: scopeOrgId, user_id: scopeUserId } = getTagScope(req.user);

    // Check for uniqueness within the determined scope
    const existingTag = await query(
      `SELECT tag_id FROM tags WHERE name = $1 AND
       ((${scopeOrgId ? 'organization_id = $2' : 'organization_id IS NULL'}) AND (${scopeUserId ? 'user_id = $3' : 'user_id IS NULL'}))`,
      [name, scopeOrgId, scopeUserId].filter(Boolean)
    );

    if (existingTag.rows.length > 0) {
      return res.status(409).json({ message: 'A tag with this name already exists in your scope.' });
    }

    const newTag = await query(
      'INSERT INTO tags (name, description, organization_id, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, description, scopeOrgId, scopeUserId]
    );

    res.status(201).json(newTag.rows[0]);
  } catch (error) {
    console.error('Error creating tag:', error);
    res.status(500).json({ message: 'Server error creating tag.', error: error.message });
  }
};

exports.updateTag = async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Tag name is required.' });
  }

  try {
    // Ownership check is handled by middleware `checkEntityOwnership`

    const updatedTag = await query(
      'UPDATE tags SET name = $1, description = $2 WHERE tag_id = $3 RETURNING *',
      [name, description, id]
    );

    res.status(200).json(updatedTag.rows[0]);
  } catch (error) {
    console.error('Error updating tag:', error);
    res.status(500).json({ message: 'Server error updating tag.', error: error.message });
  }
};

exports.deleteTag = async (req, res) => {
  const { id } = req.params;

  try {
    // Ownership check is handled by middleware `checkEntityOwnership`

    // expense_tags.tag_id is ON DELETE CASCADE, so no conflict here.

    await query('DELETE FROM tags WHERE tag_id = $1', [id]);
    res.status(204).send(); // No Content
  } catch (error) {
    console.error('Error deleting tag:', error);
    res.status(500).json({ message: 'Server error deleting tag.', error: error.message });
  }
};
