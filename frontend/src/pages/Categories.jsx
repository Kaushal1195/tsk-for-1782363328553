import React, { useState } from 'react';
import { useExpenses } from '../context/ExpenseContext';

const Categories = () => {
  const { categories, addCategory, updateCategory, deleteCategory } = useExpenses();
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleAddCategory = (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    if (!newCategoryName.trim()) {
      setError('Category name cannot be empty.');
      return;
    }
    const added = addCategory(newCategoryName.trim());
    if (added) {
      setSuccessMessage(`Category "${newCategoryName.trim()}" added successfully!`);
      setNewCategoryName('');
    } else {
      setError('Category with this name already exists.');
    }
    setTimeout(() => setSuccessMessage(''), 3000);
    setTimeout(() => setError(''), 3000);
  };

  const handleEditClick = (category) => {
    setEditingCategoryId(category.id);
    setEditingCategoryName(category.name);
    setError('');
    setSuccessMessage('');
  };

  const handleUpdateCategory = (e) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    if (!editingCategoryName.trim()) {
      setError('Category name cannot be empty.');
      return;
    }
    const updated = updateCategory(editingCategoryId, editingCategoryName.trim());
    if (updated) {
      setSuccessMessage(`Category updated to "${editingCategoryName.trim()}" successfully!`);
      setEditingCategoryId(null);
      setEditingCategoryName('');
    } else {
      setError('Category with this name already exists.');
    }
    setTimeout(() => setSuccessMessage(''), 3000);
    setTimeout(() => setError(''), 3000);
  };

  const handleDeleteCategory = (id, name) => {
    if (window.confirm(`Are you sure you want to delete the category "${name}"? This cannot be undone if there are linked expenses.`)) {
      const deleted = deleteCategory(id);
      if (deleted) {
        setSuccessMessage(`Category "${name}" deleted successfully!`);
      } else {
        setError(`Failed to delete category "${name}". It might have linked expenses.`);
      }
      setTimeout(() => setSuccessMessage(''), 3000);
      setTimeout(() => setError(''), 3000);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Manage Categories</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Error!</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      )}
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Success!</strong>
          <span className="block sm:inline"> {successMessage}</span>
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Add New Category</h2>
        <form onSubmit={handleAddCategory} className="flex gap-4">
          <input
            type="text"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="e.g., Home Improvement"
            className="flex-1 p-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button
            type="submit"
            className="px-6 py-3 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Add Category
          </button>
        </form>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Existing Categories</h2>
        {categories.length === 0 ? (
          <p className="text-gray-500">No categories defined yet. Add one above!</p>
        ) : (
          <ul className="divide-y divide-gray-200">
            {categories.map((category) => (
              <li key={category.id} className="py-4 flex items-center justify-between">
                {editingCategoryId === category.id ? (
                  <form onSubmit={handleUpdateCategory} className="flex-1 flex gap-2 items-center">
                    <input
                      type="text"
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      className="flex-1 p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700 text-sm"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCategoryId(null)}
                      className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md shadow-sm hover:bg-gray-400 text-sm"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <span className="text-lg text-gray-800">{category.name}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditClick(category)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md shadow-sm hover:bg-blue-600 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category.id, category.name)}
                        className="px-4 py-2 bg-red-500 text-white rounded-md shadow-sm hover:bg-red-600 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Categories;
