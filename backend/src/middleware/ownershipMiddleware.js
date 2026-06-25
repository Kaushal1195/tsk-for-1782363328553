const { query } = require('../db');

// Generic ownership check for entities like categories, payment_methods, merchants, tags
const checkEntityOwnership = (entityTable, idColumn) => {
  // FIX: IMPORTANT SECURITY NOTE:
  // entityTable and idColumn are directly interpolated into the SQL query.
  // This is generally a SQL Injection risk if these values can be controlled by user input.
  // In middleware, these are typically hardcoded strings provided by the developer
  // when the middleware is applied (e.g., checkEntityOwnership('categories', 'category_id')).
  // Ensure these parameters are NEVER derived from user input without strict whitelisting
  // or validation against a predefined list of allowed tables/columns.
  // For this fix, we assume they are safe developer-provided strings.

  return async (req, res, next) => {
    const entityId = req.params.id;
    const userId = req.user.user_id;
    const organizationId = req.user.organization_id;
    const roleName = req.user.role_name;

    if (!userId) { // Basic check, though authenticateToken should ensure this
      return res.status(401).json({ message: 'Authentication required.' });
    }
    if (!entityId) {
      return res.status(400).json({ message: `Missing ${idColumn} in request parameters.` });
    }

    try {
      // FIX: Use parameterized query for entityId to prevent injection.
      // The table and column names are assumed to be safe (developer-defined).
      const result = await query(
        `SELECT is_system_defined, user_id, organization_id FROM ${entityTable} WHERE ${idColumn} = $1`,
        [entityId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ message: `${entityTable.slice(0, -1)} not found.` });
      }

      const entity = result.rows[0];

      if (entity.is_system_defined) {
        // Allow admins to modify system-defined entities if needed, otherwise block for all.
        // For now, block for everyone as per original intent.
        return res.status(403).json({ message: `Cannot modify or delete system-defined ${entityTable.slice(0, -1)}.` });
      }

      // FIX: Complete the ownership logic
      // Check if the user is the owner or belongs to the same organization
      let isOwner = false;

      if (entity.user_id && entity.user_id === userId) {
        isOwner = true;
      }

      if (entity.organization_id && organizationId && entity.organization_id === organizationId) {
        // If the entity belongs to an organization, and the user is part of that organization,
        // they might have access. Further role checks might be needed here.
        // For simplicity, if organization_id matches, assume access for now.
        isOwner = true; // Or more granular check: isOwner = (roleName === 'Admin' || roleName === 'Employee');
      }

      // If not owner and not an admin (or other privileged role)
      if (!isOwner && roleName !== 'Admin') { // Assuming 'Admin' can override ownership
        return res.status(403).json({ message: 'Access denied. You do not own this resource or have insufficient permissions.' });
      }

      // If all checks pass, proceed
      next();

    } catch (error) {
      console.error(`Error in checkEntityOwnership for ${entityTable}:`, error);
      res.status(500).json({ message: 'Server error during ownership check.', error: error.message });
    }
  };
};

module.exports = {
  checkEntityOwnership
};
