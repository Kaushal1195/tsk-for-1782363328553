import React, { useState } from 'react';
import { useExpenses } from '../context/ExpenseContext';
import { Link } from 'react-router-dom';

const Expenses = () => {
  const { expenses, categories, deleteExpense } = useExpenses();
  const [filters, setFilters] = useState({
    dateRange: 'all', // 'all', 'today', 'week', 'month', 'year', 'custom'
    category: 'all',
    paymentMethod: 'all',
    search: '',
  });
  const [customDateRange, setCustomDateRange] = useState({ startDate: '', endDate: '' });

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    if (name === 'dateRange' && value !== 'custom') {
      setCustomDateRange({ startDate: '', endDate: '' });
    }
  };

  const handleCustomDateChange = (e) => {
    const { name, value } = e.target;
    setCustomDateRange((prev) => ({ ...prev, [name]: value }));
  };

  const getFilteredExpenses = () => {
    let filtered = [...expenses];

    // Date range filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filtered = filtered.filter(exp => {
      const expenseDate = new Date(exp.date);
      expenseDate.setHours(0, 0, 0, 0);

      switch (filters.dateRange) {
        case 'today':
          return expenseDate.getTime() === today.getTime();
        case 'week':
          const startOfWeek = new Date(today);
          startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
          return expenseDate >= startOfWeek;
        case 'month':
          return expenseDate.getMonth() === today.getMonth() && expenseDate.getFullYear() === today.getFullYear();
        case 'year':
          return expenseDate.getFullYear() === today.getFullYear();
        case 'custom':
          if (customDateRange.startDate && customDateRange.endDate) {
            const start = new Date(customDateRange.startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(customDateRange.endDate);
            end.setHours(23, 59, 59, 999);
            return expenseDate >= start && expenseDate <= end;
          }
          return true; // If custom range not fully specified, don't filter by date
        case 'all':
        default:
          return true;
      }
    });

    // Category filter
    if (filters.category !== 'all') {
      filtered = filtered.filter((exp) => exp.category === filters.category);
    }

    // Payment method filter
    if (filters.paymentMethod !== 'all') {
      filtered = filtered.filter((exp) => exp.paymentMethod === filters.paymentMethod);
    }

    // Search filter (description or amount)
    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(
        (exp) =>
          exp.description.toLowerCase().includes(searchTerm) ||
          exp.merchant.toLowerCase().includes(searchTerm) ||
          exp.amount.toFixed(2).includes(searchTerm)
      );
    }

    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort by date descending
  };

  const filteredExpenses = getFilteredExpenses();

  const handleDelete = (id, description) => {
    if (window.confirm(`Are you sure you want to delete the expense: "${description}"?`)) {
      deleteExpense(id);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">All Expenses</h1>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Filters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="dateRange" className="block text-sm font-medium text-gray-700">Date Range</label>
            <select
              id="dateRange"
              name="dateRange"
              value={filters.dateRange}
              onChange={handleFilterChange}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {filters.dateRange === 'custom' && (
            <>
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={customDateRange.startDate}
                  onChange={handleCustomDateChange}
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">End Date</label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={customDateRange.endDate}
                  onChange={handleCustomDateChange}
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </>
          )}

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
            <select
              id="category"
              name="category"
              value={filters.category}
              onChange={handleFilterChange}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700">Payment Method</label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              value={filters.paymentMethod}
              onChange={handleFilterChange}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              <option value="all">All Methods</option>
              <option value="Credit Card">Credit Card</option>
              <option value="Debit Card">Debit Card</option>
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="PayPal">PayPal</option>
            </select>
          </div>

          <div className="col-span-full md:col-span-2 lg:col-span-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700">Search (Description/Amount)</label>
            <input
              type="text"
              id="search"
              name="search"
              value={filters.search}
              onChange={handleFilterChange}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Search expenses..."
            />
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        {filteredExpenses.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No expenses found matching your criteria.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Merchant
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {expense.merchant}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-indigo-100 text-indigo-800">
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                      -${expense.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {expense.paymentMethod}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <Link to={`/edit-expense/${expense.id}`} className="text-indigo-600 hover:text-indigo-900 mr-4">
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(expense.id, expense.description)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Expenses;
