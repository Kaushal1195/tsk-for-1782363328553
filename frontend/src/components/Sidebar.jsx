import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
  const navItems = [
    { name: 'Dashboard', path: '/' },
    { name: 'Expenses', path: '/expenses' },
    { name: 'Add Expense', path: '/add-expense' },
    { name: 'Categories', path: '/categories' },
    { name: 'Reports', path: '/reports' },
  ];

  return (
    <div className="w-64 bg-gray-800 text-white flex flex-col p-4 shadow-lg">
      <div className="text-2xl font-bold mb-8 text-center text-indigo-400">
        Expense Tracker
      </div>
      <nav className="flex-1">
        <ul>
          {navItems.map((item) => (
            <li key={item.name} className="mb-2">
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center p-3 rounded-lg transition-colors duration-200 ${
                    isActive
                      ? 'bg-indigo-700 text-white shadow-md'
                      : 'hover:bg-gray-700 text-gray-300 hover:text-white'
                  }`
                }
              >
                {/* Placeholder for icons */}
                <span className="mr-3">📊</span>
                <span>{item.name}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto pt-4 border-t border-gray-700 text-sm text-gray-400">
        <p className="text-center">© 2024 Expense Tracker</p>
      </div>
    </div>
  );
};

export default Sidebar;
