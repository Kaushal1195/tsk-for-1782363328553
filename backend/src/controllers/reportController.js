const { query } = require('../db');

exports.getExpenseSummary = async (req, res) => {
  const { user_id, organization_id } = req.user;
  const { startDate, endDate, groupBy = 'category' } = req.query; // groupBy: 'category', 'month'

  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'startDate and endDate are required for reports.' });
  }

  let selectClause;
  let groupByClause;
  let orderByClause;

  switch (groupBy) {
    case 'category':
      selectClause = `c.name AS group_name, c.category_id AS group_id, SUM(e.amount) AS total_amount`;
      groupByClause = `c.name, c.category_id`;
      orderByClause = `total_amount DESC`;
      break;
    case 'month':
      selectClause = `TO_CHAR(e.expense_date, 'YYYY-MM') AS group_name, SUM(e.amount) AS total_amount`;
      groupByClause = `TO_CHAR(e.expense_date, 'YYYY-MM')`;
      orderByClause = `group_name ASC`;
      break;
    default:
      return res.status(400).json({ message: 'Invalid groupBy parameter. Must be "category" or "month".' });
  }

  const queryParams = [user_id, startDate, endDate];
  let paramIndex = 4;

  let queryText = `
    SELECT
      ${selectClause}
    FROM expenses e
    JOIN categories c ON e.category_id = c.category_id
    WHERE e.user_id = $1
      AND e.expense_date >= $2
      AND e.expense_date <= $3
    GROUP BY ${groupByClause}
    ORDER BY ${orderByClause};
  `;

  try {
    const { rows } = await query(queryText, queryParams);

    if (rows.length === 0) {
      return res.status(200).json({ message: 'No expenses found for the selected period and filters.', summary: [] });
    }

    res.status(200).json({ summary: rows });
  } catch (error) {
    console.error('Error generating expense summary:', error);
    res.status(500).json({ message: 'Server error generating expense summary.', error: error.message });
  }
};

exports.exportExpenses = async (req, res) => {
  const { user_id, organization_id } = req.user;
  const { startDate, endDate, format = 'json' } = req.query; // format: 'json', 'csv' (for now, only JSON)

  if (!startDate || !endDate) {
    return res.status(400).json({ message: 'startDate and endDate are required for export.' });
  }

  let queryText = `
    SELECT
      e.expense_id, e.amount, e.currency, e.expense_date, e.description, e.created_at, e.updated_at,
      u.username AS user_name,
      c.name AS category_name,
      pm.name AS payment_method_name,
      m.name AS merchant_name,
      r.file_url AS receipt_url,
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
      AND e.expense_date >= $2
      AND e.expense_date <= $3
    GROUP BY e.expense_id, u.username, c.name, pm.name, m.name, r.file_url
    ORDER BY e.expense_date DESC;
  `;

  try {
    const { rows } = await query(queryText, [user_id, startDate, endDate]);

    if (format === 'csv') {
      // Basic CSV generation (can be improved with a dedicated CSV library)
      if (rows.length === 0) {
        return res.status(200).send('No expenses found for the selected period.');
      }
      const header = Object.keys(rows[0]).join(',');
      const csvRows = rows.map(row =>
        Object.values(row).map(value => {
          if (Array.isArray(value)) return `"${value.join(';')}"`; // Handle array values for tags
          if (typeof value === 'string' && value.includes(',')) return `"${value}"`; // Quote strings with commas
          return value;
        }).join(',')
      );
      res.header('Content-Type', 'text/csv');
      res.attachment('expenses.csv');
      return res.send(header + '\n' + csvRows.join('\n'));
    }

    // Default to JSON
    res.status(200).json({ expenses: rows });
  } catch (error) {
    console.error('Error exporting expenses:', error);
    res.status(500).json({ message: 'Server error exporting expenses.', error: error.message });
  }
};
