import React from 'react';
import { useExpenses } from '../context/ExpenseContext';

const Dashboard = () => {
  const { expenses, categories } = useExpenses();

  // Simple calculations for dashboard overview
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const expensesByCategory = categories.map(cat => ({
    name: cat.name,
    total: expenses
      .filter(exp => exp.category === cat.name)
      .reduce((sum, exp) => sum + exp.amount, 0)
  })).sort((a, b) => b.total - a.total);

  const recentExpenses = expenses
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Total Expenses</h2>
          <p className="text-4xl font-bold text-indigo-600">${totalExpenses.toFixed(2)}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Total Categories</h2>
          <p className="text-4xl font-bold text-green-600">{categories.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Expenses This Month</h2>
          {/* Placeholder for actual month calculation */}
          <p className="text-4xl font-bold text-purple-600">${
            expenses.filter(exp => new Date(exp.date).getMonth() === new Date().getMonth() && new Date(exp.date).getFullYear() === new Date().getFullYear())
            .reduce((sum, exp) => sum + exp.amount, 0).toFixed(2)
          }</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Spending by Category</h2>
          <ul>
            {expensesByCategory.map((cat, index) => (
              <li key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                <span className="text-gray-600">{cat.name}</span>
                <span className="font-medium text-gray-800">${cat.total.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold text-gray-700 mb-4">Recent Expenses</h2>
          <ul>
            {recentExpenses.length > 0 ? (
              recentExpenses.map((exp) => (
                <li key={exp.id} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
                  <div>
                    <p className="font-medium text-gray-800">{exp.description}</p>
                    <p className="text-sm text-gray-500">{exp.date} - {exp.category}</p>
                  </div>
                  <span className="font-semibold text-red-600">-${exp.amount.toFixed(2)}</span>
                </li>
              ))
            ) : (
              <p className="text-gray-500">No recent expenses.</p>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
