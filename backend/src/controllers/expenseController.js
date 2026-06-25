const { query, withTransaction } = require('../db');
const { v4: uuidv4 } = require('uuid');

// Helper to find or create a merchant, category, or payment method
// This function assumes the entity is not system-defined and will be created under the user's scope
const findOrCreateEntity = async (client, tableName, name, user, isOrgScoped = false) => {
  const { user_id, organization_id, role_name } = user;
  let scopeOrgId = null;
  let scopeUserId = null;

  if (isOrgScoped && organization_id && role_name === 'Admin') {
    scopeOrgId = organization_id;
  } else {
    scopeUserId = user_id;
  }

  const existingEntity = await client.query(
    `SELECT ${tableName}_id FROM ${tableName} WHERE name = $1 AND is_system_defined = FALSE AND
     ((${scopeOrgId ? 'organization_id = $2' : 'organization_id IS NULL'}) AND (${scopeUserId ? 'user_id = $3' : 'user_id IS NULL'}))`,
    [name, scopeOrgId, scopeUserId].filter(Boolean)
  );

  if (existingEntity.rows.length > 0) {
    return existingEntity.rows[0][`${tableName}_id`];
  }

  const newEntity = await client.query(
    `INSERT INTO ${tableName} (name, is_system_defined, organization_id, user_id) VALUES ($1, FALSE, $2, $3) RETURNING ${tableName}_id`,
    [name, scopeOrgId, scopeUserId]
  );
  return newEntity.rows[0][`${tableName}_id`];
};

// Helper to get an entity ID, prioritizing user/org specific, then system-defined
const getEntityId = async (client, tableName, name, user) => {
  const { user_id, organization_id } = user;
  let params = [name];
  let queryText = `
    SELECT ${tableName}_id FROM ${tableName}
    WHERE name = $1 AND (
      is_system_defined = TRUE
  `;

  if (user_id) {
    queryText += ` OR user_id = $${params.length + 1}`;
    params.push(user_id);
  }
  if (organization_id) {
    queryText += ` OR organization_id = $${params.length + 1}`;
    params.push(organization_id);
  }
  queryText += `) LIMIT 1`; // Limit to 1 to get the most specific match first (though order isn't guaranteed without ORDER BY)

  const result = await client.query(queryText, params);
  return result.rows.length > 0 ? result.rows[0][`${tableName}_id`] : null;
};


exports.createExpense = async (req, res) => {
  const {
    amount, currency = 'USD', expense_date, description,
    merchant_name, category_name, payment_method_name,
    tags = [], receipt_url, receipt_file_type, receipt_file_size_bytes
  } = req.body;
  const { user_id, organization_id } = req.user;

  if (!amount || !expense_date || !category_name || !payment_method_name) {
    return res.status(400).json({ message: 'Amount, expense date, category, and payment method are required.' });
  }
  if (isNaN(parseFloat(amount)) || parseFloat(amount) < 0) {
    return res.status(400).json({ message: 'Amount must be a non-negative number.' });
  }
  if (new Date(expense_date) > new Date()) {
    return res.status(400).json({ message: 'Expense date cannot be in the future.' });
  }

  try {
    const newExpense = await withTransaction(async (client) => {
      // 1. Get or create merchant_id
      let merchantId = null;
      if (merchant_name) {
        merchantId = await getEntityId(client, 'merchants', merchant_name, req.user);
        if (!merchantId) {
          merchantId = await findOrCreateEntity(client, 'merchants', merchant_name, req.user, req.user.role_name === 'Admin');
        }
      }

      // 2. Get category_id
      let categoryId = await getEntityId(client, 'categories', category_name, req.user);
      if (!categoryId) {
        // If category not found, try to create it as user-specific or org-specific
        categoryId = await findOrCreateEntity(client, 'categories', category_name, req.user, req.user.role_name === 'Admin');
      }
      if (!categoryId) {
        throw new Error(`Category '${category_name}' not found and could not be created.`);
      }

      // 3. Get payment_method_id
      let paymentMethodId = await getEntityId(client, 'payment_methods', payment_method_name, req.user);
      if (!paymentMethodId) {
        // If payment method not found, try to create it as user-specific or org-specific
        paymentMethodId = await findOrCreateEntity(client, 'payment_methods', payment_method_name, req.user, req.user.role_name === 'Admin');
      }
      if (!paymentMethodId) {
        throw new Error(`Payment method '${payment_method_name}' not found and could not be created.`);
      }

      // 4. Insert expense
      const expenseResult = await client.query(
        `INSERT INTO expenses (user_id, organization_id, amount, currency, expense_date, description, merchant_id, category_id, payment_method_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [user_id, organization_id, amount, currency, expense_date, description, merchantId, categoryId, paymentMethodId]
      );
      const expense = expenseResult.rows[0];

      // 5. Handle receipt
      if (receipt_url) {
        await client.query(
          `INSERT INTO receipts (expense_id, user_id, file_url, file_type, file_size_bytes) VALUES ($1, $2, $3, $4, $5)`,
          [expense.expense_id, user_id, receipt_url, receipt_file_type, receipt_file_size_bytes]
        );
      }

      // 6. Handle tags
      const tagIds = [];
      for (const tagName of tags) {
        let tagId = await getEntityId(client, 'tags', tagName, req.user);
        if (!tagId) {
          tagId = await findOrCreateEntity(client, 'tags', tagName, req.user, req.user.role_name === 'Admin');
        }
        if (tagId) {
          tagIds.push(tagId);
          await client.query(
            `INSERT INTO expense_tags (expense_id, tag_id) VALUES ($1, $2) ON CONFLICT (expense_id, tag_id) DO NOTHING`,
            [expense.expense_id, tagId]
          );
        }
      }

      // 7. Record audit
      await client.query(
        `INSERT INTO expense_audits (expense_id, user_id, action, new_data) VALUES ($1, $2, 'CREATE', $3)`,
        [expense.expense_id, user_id, expense]
      );

      return { ...expense, tags: tags, receipt_url: receipt_url };
    });

    res.status(201).json(newExpense);
  } catch (error) {
    console.error('Error creating expense:', error);
    res.status(500).json({ message: 'Server error creating expense.', error: error.message });
  }
};

exports.getExpenses = async (req, res) => {
  const { user_id, organization_id } = req.user;
  const {
    startDate, endDate, category_id, merchant_id, payment_method_id, tag_id,
    description_search, amount_min, amount_max,
    limit = 10, offset = 0, sortBy = 'expense_date', sortOrder = 'DESC'
  } = req.query;

  let queryText = `
    SELECT
      e.expense_id, e.amount, e.currency, e.expense_date, e.description, e.created_at, e.updated_at,
      u.username AS user_name,
      c.name AS category_name, c.category_id,
      pm.name AS payment_method_name, pm.payment_method_id,
      m.name AS merchant_name, m.merchant_id,
      r.file_url AS receipt_url, r.file_type AS receipt_file_type, r.file_size_bytes AS receipt_file_size_bytes,
      ARRAY_AGG(t.name) FILTER (WHERE t.name IS NOT NULL) AS tags
    FROM expenses e
    JOIN users u ON e.user_id = u.user_id
    JOIN categories c ON e.category_id = c.category_id
    JOIN payment_methods pm ON e.payment_method_id = pm.payment_method_id
    LEFT JOIN merchants m ON e.merchant_id = m.merchant_id
    LEFT JOIN receipts r ON e.expense_id = r.expense_id
    LEFT JOIN expense_tags et ON e.expense_id = et.expense_id
    LEFT JOIN tags t ON et.tag_id = t.tag_id
    WHERE e.user_id = $1
  `;

  const countQueryText = `SELECT COUNT(DISTINCT e.expense_id) FROM expenses e WHERE e.user_id = $1`;

  const queryParams = [user_id];
  let paramIndex = 2;

  // Add filters
  if (startDate) {
    queryText += ` AND e.expense_date >= $${paramIndex}`;
    countQueryText += ` AND e.expense_date >= $${paramIndex}`;
    queryParams.push(startDate);
    paramIndex++;
  }
  if (endDate) {
    queryText += ` AND e.expense_date <= $${paramIndex}`;
    countQueryText += ` AND e.expense_date <= $${paramIndex}`;
    queryParams.push(endDate);
    paramIndex++;
  }
  if (category_id) {
    queryText += ` AND e.category_id = $${paramIndex}`;
    countQueryText += ` AND e.category_id = $${paramIndex}`;
    queryParams.push(category_id);
    paramIndex++;
  }
  if (merchant_id) {
    queryText += ` AND e.merchant_id = $${paramIndex}`;
    countQueryText += ` AND e.merchant_id = $${paramIndex}`;
    queryParams.push(merchant_id);
    paramIndex++;
  }
  if (payment_method_id) {
    queryText += ` AND e.payment_method_id = $${paramIndex}`;
    countQueryText += ` AND e.payment_method_id = $${paramIndex}`;
    queryParams.push(payment_method_id);
    paramIndex++;
  }
  if (description_search) {
    queryText += ` AND e.description ILIKE $${paramIndex}`;
    countQueryText += ` AND e.description ILIKE $${paramIndex}`;
    queryParams.push(`%${description_search}%`);
    paramIndex++;
  }
  if (amount_min) {
    queryText += ` AND e.amount >= $${paramIndex}`;
    countQueryText += ` AND e.amount >= $${paramIndex}`;
    queryParams.push(amount_min);
    paramIndex++;
  }
  if (amount_max) {
    queryText += ` AND e.amount <= $${paramIndex}`;
    countQueryText += ` AND e.amount <= $${paramIndex}`;
    queryParams.push(amount_max);
    paramIndex++;
  }
  // Tag filter requires a subquery or JOIN on expense_tags
  if (tag_id) {
    queryText += ` AND e.expense_id IN (SELECT expense_id FROM expense_tags WHERE tag_id = $${paramIndex})`;
    countQueryText += ` AND e.expense_id IN (SELECT expense_id FROM expense_tags WHERE tag_id = $${paramIndex})`;
    queryParams.push(tag_id);
    paramIndex++;
  }

  queryText += ` GROUP BY e.expense_id, u.username, c.name, pm.name, m.name, r.file_url, r.file_type, r.file_size_bytes`;

  // Add sorting
  const validSortColumns = ['expense_date', 'amount', 'category_name', 'merchant_name'];
  const finalSortBy = validSortColumns.includes(sortBy) ? sortBy : 'expense_date';
  const finalSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  queryText += ` ORDER BY ${finalSortBy} ${finalSortOrder}`;

  // Add pagination
  queryText += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  queryParams.push(limit, offset);

  try {
    const { rows: expenses } = await query(queryText, queryParams);
    const totalCountResult = await query(countQueryText, queryParams.slice(0, queryParams.length - 2)); // Remove limit/offset for count

    res.status(200).json({
      total: parseInt(totalCountResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
      expenses
    });
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ message: 'Server error fetching expenses.', error: error.message });
  }
};

exports.getExpenseById = async (req, res) => {
  const { id } = req.params;
  const { user_id, organization_id } = req.user;

  try {
    const { rows } = await query(
      `SELECT
        e.expense_id, e.amount, e.currency, e.expense_date, e.description, e.created_at, e.updated_at,
        u.username AS user_name,
        c.name AS category_name, c.category_id,
        pm.name AS payment_method_name, pm.payment_method_id,
        m.name AS merchant_name, m.merchant_id,
        r.file_url AS receipt_url, r.file_type AS receipt_file_type, r.file_size_bytes AS receipt_file_size_bytes,
        ARRAY_AGG(t.name) FILTER (WHERE t.name IS NOT NULL) AS tags
      FROM expenses e
      JOIN users u ON e.user_id = u.user_id
      JOIN categories c ON e.category_id = c.category_id
      JOIN payment_methods pm ON e.payment_method_id = pm.payment_method_id
      LEFT JOIN merchants m ON e.merchant_id = m.merchant_id
      LEFT JOIN receipts r ON e.expense_id = r.expense_id
      LEFT JOIN expense_tags et ON e.expense_id = et.expense_id
      LEFT JOIN tags t ON et.tag_id = t.tag_id
      WHERE e.expense_id = $1 AND e.user_id = $2
      GROUP BY e.expense_id, u.username, c.name, pm.name, m.name, r.file_url, r.file_type, r.file_size_bytes`,
      [id, user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Expense not found or you do not have access.' });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Error fetching expense by ID:', error);
    res.status(500).json({ message: 'Server error fetching expense.', error: error.message });
  }
};

exports.updateExpense = async (req, res) => {
  const { id } = req.params;
  const { user_id, organization_id } = req.user;
  const {
    amount, currency, expense_date, description,
    merchant_name, category_name, payment_method_name,
    tags = [], receipt_url, receipt_file_type, receipt_file_size_bytes
  } = req.body;

  if (amount && (isNaN(parseFloat(amount)) || parseFloat(amount) < 0)) {
    return res.status(400).json({ message: 'Amount must be a non-negative number.' });
  }
  if (expense_date && new Date(expense_date) > new Date()) {
    return res.status(400).json({ message: 'Expense date cannot be in the future.' });
  }

  try {
    const updatedExpense = await withTransaction(async (client) => {
      // Fetch old expense data for audit trail
      const oldExpenseResult = await client.query('SELECT * FROM expenses WHERE expense_id = $1 AND user_id = $2', [id, user_id]);
      if (oldExpenseResult.rows.length === 0) {
        throw new Error('Expense not found or unauthorized.');
      }
      const oldExpense = oldExpenseResult.rows[0];

      // Prepare fields for update
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (amount !== undefined) { fields.push(`amount = $${paramIndex++}`); values.push(amount); }
      if (currency !== undefined) { fields.push(`currency = $${paramIndex++}`); values.push(currency); }
      if (expense_date !== undefined) { fields.push(`expense_date = $${paramIndex++}`); values.push(expense_date); }
      if (description !== undefined) { fields.push(`description = $${paramIndex++}`); values.push(description); }

      // Handle merchant
      let merchantId = oldExpense.merchant_id;
      if (merchant_name !== undefined) {
        merchantId = await getEntityId(client, 'merchants', merchant_name, req.user);
        if (!merchantId && merchant_name) {
          merchantId = await findOrCreateEntity(client, 'merchants', merchant_name, req.user, req.user.role_name === 'Admin');
        }
        fields.push(`merchant_id = $${paramIndex++}`); values.push(merchantId);
      }

      // Handle category
      let categoryId = oldExpense.category_id;
      if (category_name !== undefined) {
        categoryId = await getEntityId(client, 'categories', category_name, req.user);
        if (!categoryId && category_name) {
          categoryId = await findOrCreateEntity(client, 'categories', category_name, req.user, req.user.role_name === 'Admin');
        }
        if (!categoryId && category_name) {
          throw new Error(`Category '${category_name}' not found and could not be created.`);
        }
        fields.push(`category_id = $${paramIndex++}`); values.push(categoryId);
      }

      // Handle payment method
      let paymentMethodId = oldExpense.payment_method_id;
      if (payment_method_name !== undefined) {
        paymentMethodId = await getEntityId(client, 'payment_methods', payment_method_name, req.user);
        if (!paymentMethodId && payment_method_name) {
          paymentMethodId = await findOrCreateEntity(client, 'payment_methods', payment_method_name, req.user, req.user.role_name === 'Admin');
        }
        if (!paymentMethodId && payment_method_name) {
          throw new Error(`Payment method '${payment_method_name}' not found and could not be created.`);
        }
        fields.push(`payment_method_id = $${paramIndex++}`); values.push(paymentMethodId);
      }

      if (fields.length === 0 && tags.length === 0 && receipt_url === undefined) {
        return oldExpense; // No changes to expense itself or tags/receipt
      }

      const updateQuery = `UPDATE expenses SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE expense_id = $${paramIndex++} AND user_id = $${paramIndex++} RETURNING *`;
      values.push(id, user_id);

      const expenseResult = await client.query(updateQuery, values);
      const expense = expenseResult.rows[0];

      // Handle receipt update (delete old, insert new if provided)
      if (receipt_url !== undefined) {
        await client.query('DELETE FROM receipts WHERE expense_id = $1', [id]);
        if (receipt_url) {
          await client.query(
            `INSERT INTO receipts (expense_id, user_id, file_url, file_type, file_size_bytes) VALUES ($1, $2, $3, $4, $5)`,
            [id, user_id, receipt_url, receipt_file_type, receipt_file_size_bytes]
          );
        }
      }

      // Handle tags update (clear existing, insert new)
      if (tags !== undefined) {
        await client.query('DELETE FROM expense_tags WHERE expense_id = $1', [id]);
        for (const tagName of tags) {
          let tagId = await getEntityId(client, 'tags', tagName, req.user);
          if (!tagId) {
            tagId = await findOrCreateEntity(client, 'tags', tagName, req.user, req.user.role_name === 'Admin');
          }
          if (tagId) {
            await client.query(
              `INSERT INTO expense_tags (expense_id, tag_id) VALUES ($1, $2) ON CONFLICT (expense_id, tag_id) DO NOTHING`,
              [id, tagId]
            );
          }
        }
      }

      // Record audit
      await client.query(
        `INSERT INTO expense_audits (expense_id, user_id, action, old_data, new_data) VALUES ($1, $2, 'UPDATE', $3, $4)`,
        [id, user_id, oldExpense, expense]
      );

      return expense;
    });

    res.status(200).json(updatedExpense);
  } catch (error) {
    console.error('Error updating expense:', error);
    if (error.message.includes('Expense not found or unauthorized.')) {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error updating expense.', error: error.message });
  }
};

exports.deleteExpense = async (req, res) => {
  const { id } = req.params;
  const { user_id } = req.user;

  try {
    await withTransaction(async (client) => {
      // Fetch expense data for audit trail before deletion
      const oldExpenseResult = await client.query('SELECT * FROM expenses WHERE expense_id = $1 AND user_id = $2', [id, user_id]);
      if (oldExpenseResult.rows.length === 0) {
        throw new Error('Expense not found or unauthorized.');
      }
      const oldExpense = oldExpenseResult.rows[0];

      // Delete expense (receipts, expense_tags, expense_audits will cascade)
      const deleteResult = await client.query('DELETE FROM expenses WHERE expense_id = $1 AND user_id = $2 RETURNING expense_id', [id, user_id]);

      if (deleteResult.rows.length === 0) {
        throw new Error('Expense not found or unauthorized.');
      }

      // Record audit (action 'DELETE')
      await client.query(
        `INSERT INTO expense_audits (expense_id, user_id, action, old_data) VALUES ($1, $2, 'DELETE', $3)`,
        [id, user_id, oldExpense]
      );
    });

    res.status(204).send(); // No Content
  } catch (error) {
    console.error('Error deleting expense:', error);
    if (error.message.includes('Expense not found or unauthorized.')) {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error deleting expense.', error: error.message });
  }
};
