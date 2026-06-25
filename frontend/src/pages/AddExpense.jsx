import React, { useState, useEffect } from 'react';
import { useExpenses } from '../context/ExpenseContext';
import { useNavigate, useParams } from 'react-router-dom';

const AddExpense = () => {
  const { addExpense, updateExpense, expenses, categories } = useExpenses();
  const navigate = useNavigate();
  const { id } = useParams(); // For editing existing expense

  const isEditing = !!id;

  const [formData, setFormData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    description: '',
    merchant: '',
    category: '',
    paymentMethod: 'Credit Card',
    tags: '',
    receipt: null, // Stores File object or base64 string
  });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (isEditing) {
      const expenseToEdit = expenses.find(exp => exp.id === id);
      if (expenseToEdit) {
        setFormData({
          amount: expenseToEdit.amount,
          date: expenseToEdit.date,
          description: expenseToEdit.description,
          merchant: expenseToEdit.merchant,
          category: expenseToEdit.category,
          paymentMethod: expenseToEdit.paymentMethod,
          tags: expenseToEdit.tags.join(', '),
          receipt: expenseToEdit.receipt, // Assuming receipt is stored as base64 or URL
        });
      } else {
        navigate('/expenses'); // Redirect if expense not found
      }
    }
  }, [id, isEditing, expenses, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Auto-fill category based on merchant
    if (name === 'merchant') {
      const matchedCategory = categories.find(cat => cat.defaultMerchant?.toLowerCase() === value.toLowerCase());
      if (matchedCategory) {
        setFormData((prev) => ({ ...prev, category: matchedCategory.name }));
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Basic validation for file type and size
      const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!allowedTypes.includes(file.type)) {
        setErrors((prev) => ({ ...prev, receipt: 'Only JPG, PNG, and PDF files are allowed.' }));
        setFormData((prev) => ({ ...prev, receipt: null }));
        return;
      }
      if (file.size > maxSize) {
        setErrors((prev) => ({ ...prev, receipt: 'File size cannot exceed 5MB.' }));
        setFormData((prev) => ({ ...prev, receipt: null }));
        return;
      }

      // For simplicity, store as a data URL (base64) in frontend context
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData((prev) => ({ ...prev, receipt: reader.result }));
        setErrors((prev) => ({ ...prev, receipt: null })); // Clear error on successful read
      };
      reader.readAsDataURL(file);
    } else {
      setFormData((prev) => ({ ...prev, receipt: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.amount || isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Amount must be a positive number.';
    }
    if (!formData.date) {
      newErrors.date = 'Date is required.';
    } else if (new Date(formData.date) > new Date()) {
      newErrors.date = 'Date cannot be in the future.';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required.';
    }
    if (!formData.category) {
      newErrors.category = 'Category is required.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSuccessMessage(''); // Clear previous success messages

    if (!validateForm()) {
      return;
    }

    const expenseData = {
      ...formData,
      amount: parseFloat(formData.amount),
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
    };

    if (isEditing) {
      updateExpense(id, expenseData);
      setSuccessMessage('Expense updated successfully!');
    } else {
      addExpense(expenseData);
      setSuccessMessage('Expense added successfully!');
      setFormData({
        amount: '',
        date: new Date().toISOString().split('T')[0],
        description: '',
        merchant: '',
        category: '',
        paymentMethod: 'Credit Card',
        tags: '',
        receipt: null,
      });
    }

    setTimeout(() => {
      setSuccessMessage('');
      if (!isEditing) navigate('/expenses'); // Redirect after adding
    }, 2000);
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">
        {isEditing ? 'Edit Expense' : 'Add New Expense'}
      </h1>

      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">Success!</strong>
          <span className="block sm:inline"> {successMessage}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-lg shadow-md max-w-2xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
            <input
              type="number"
              id="amount"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              step="0.01"
              className={`mt-1 block w-full p-3 border ${errors.amount ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500`}
              placeholder="e.g., 25.50"
            />
            {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount}</p>}
          </div>

          <div>
            <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className={`mt-1 block w-full p-3 border ${errors.date ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500`}
            />
            {errors.date && <p className="text-red-500 text-xs mt-1">{errors.date}</p>}
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <input
            type="text"
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            className={`mt-1 block w-full p-3 border ${errors.description ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500`}
            placeholder="e.g., Groceries for the week"
          />
          {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label htmlFor="merchant" className="block text-sm font-medium text-gray-700 mb-1">Merchant</label>
            <input
              type="text"
              id="merchant"
              name="merchant"
              value={formData.merchant}
              onChange={handleChange}
              className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g., Starbucks, Amazon"
            />
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              id="category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              className={`mt-1 block w-full p-3 border ${errors.category ? 'border-red-500' : 'border-gray-300'} rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white`}
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
            {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              id="paymentMethod"
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={handleChange}
              className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              <option value="Credit Card">Credit Card</option>
              <option value="Debit Card">Debit Card</option>
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="PayPal">PayPal</option>
            </select>
          </div>

          <div>
            <label htmlFor="tags" className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              id="tags"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              className="mt-1 block w-full p-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g., travel, business, personal"
            />
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="receipt" className="block text-sm font-medium text-gray-700 mb-1">Attach Receipt (Image/PDF)</label>
          <input
            type="file"
            id="receipt"
            name="receipt"
            accept="image/jpeg,image/png,application/pdf"
            onChange={handleFileChange}
            className="mt-1 block w-full text-sm text-gray-500
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-md file:border-0
                       file:text-sm file:font-semibold
                       file:bg-indigo-50 file:text-indigo-700
                       hover:file:bg-indigo-100"
          />
          {errors.receipt && <p className="text-red-500 text-xs mt-1">{errors.receipt}</p>}
          {formData.receipt && (
            <div className="mt-2 text-sm text-gray-600">
              Receipt attached. {formData.receipt.startsWith('data:image') ? 'Image' : 'PDF'}
              {/* In a real app, you'd show a preview or a link to download */}
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, receipt: null }))}
                className="ml-2 text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="inline-flex justify-center py-3 px-6 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {isEditing ? 'Update Expense' : 'Add Expense'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddExpense;
