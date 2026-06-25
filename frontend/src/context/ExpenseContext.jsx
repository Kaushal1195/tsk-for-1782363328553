import React, { createContext, useState, useContext, useEffect } from 'react';

const ExpenseContext = createContext();

const initialCategories = [
  { id: 'cat-1', name: 'Food', defaultMerchant: 'Starbucks' },
  { id: 'cat-2', name: 'Transport', defaultMerchant: null },
  { id: 'cat-3', name: 'Utilities', defaultMerchant: null },
  { id: 'cat-4', name: 'Office Supplies', defaultMerchant: null },
  { id: 'cat-5', name: 'Entertainment', defaultMerchant: null },
];

const initialExpenses = [
  {
    id: 'exp-1',
    amount: 15.50,
    date: '2024-03-10',
    description: 'Lunch with client',
    merchant: 'Cafe Bistro',
    category: 'Food',
    paymentMethod: 'Credit Card',
    tags: ['business', 'client'],
    receipt: null,
  },
  {
    id: 'exp-2',
    amount: 5.20,
    date: '2024-03-11',
    description: 'Morning coffee',
    merchant: 'Starbucks',
    category: 'Food',
    paymentMethod: 'Cash',
    tags: [],
    receipt: null,
  },
  {
    id: 'exp-3',
    amount: 60.00,
    date: '2024-03-12',
    description: 'Internet bill',
    merchant: 'ISP Connect',
    category: 'Utilities',
    paymentMethod: 'Bank Transfer',
    tags: ['monthly'],
    receipt: null,
  },
  {
    id: 'exp-4',
    amount: 25.00,
    date: '2024-03-12',
    description: 'Taxi ride to airport',
    merchant: 'City Cabs',
    category: 'Transport',
    paymentMethod: 'Credit Card',
    tags: ['travel'],
    receipt: null,
  },
  {
    id: 'exp-5',
    amount: 120.00,
    date: '2024-02-28',
    description: 'New monitor for office',
    merchant: 'Tech Gadgets',
    category: 'Office Supplies',
    paymentMethod: 'Credit Card',
    tags: ['equipment'],
    receipt: null,
  },
];

export const ExpenseProvider = ({ children }) => {
  const [expenses, setExpenses] = useState(() => {
    const storedExpenses = localStorage.getItem('expenses');
    return storedExpenses ? JSON.parse(storedExpenses) : initialExpenses;
  });
  const [categories, setCategories] = useState(() => {
    const storedCategories = localStorage.getItem('categories');
    return storedCategories ? JSON.parse(storedCategories) : initialCategories;
  });

  useEffect(() => {
    localStorage.setItem('expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('categories', JSON.stringify(categories));
  }, [categories]);

  const addExpense = (expense) => {
    setExpenses((prevExpenses) => [...prevExpenses, { ...expense, id: `exp-${Date.now()}` }]);
  };

  const updateExpense = (id, updatedExpense) => {
    setExpenses((prevExpenses) =>
      prevExpenses.map((exp) => (exp.id === id ? { ...exp, ...updatedExpense } : exp))
    );
  };

  const deleteExpense = (id) => {
    setExpenses((prevExpenses) => prevExpenses.filter((exp) => exp.id !== id));
  };

  const addCategory = (categoryName) => {
    if (categories.some(cat => cat.name.toLowerCase() === categoryName.toLowerCase())) {
      return false; // Category already exists
    }
    setCategories((prevCategories) => [
      ...prevCategories,
      { id: `cat-${Date.now()}`, name: categoryName, defaultMerchant: null },
    ]);
    return true;
  };

  const updateCategory = (id, newName) => {
    if (categories.some(cat => cat.id !== id && cat.name.toLowerCase() === newName.toLowerCase())) {
      return false; // Category name already exists for another category
    }
    setCategories((prevCategories) =>
      prevCategories.map((cat) => (cat.id === id ? { ...cat, name: newName } : cat))
    );
    return true;
  };

  const deleteCategory = (id) => {
    const categoryToDelete = categories.find(cat => cat.id === id);
    if (!categoryToDelete) return;

    // Check if any expenses are linked to this category
    const expensesLinked = expenses.filter(exp => exp.category === categoryToDelete.name);
    if (expensesLinked.length > 0) {
      // In a real app, you'd prompt the user to re-categorize or confirm deletion
      alert(`Cannot delete category "${categoryToDelete.name}" because ${expensesLinked.length} expenses are linked to it. Please re-categorize them first.`);
      return false;
    }

    setCategories((prevCategories) => prevCategories.filter((cat) => cat.id !== id));
    return true;
  };

  const getCategoryByName = (name) => categories.find(cat => cat.name === name);

  return (
    <ExpenseContext.Provider
      value={{
        expenses,
        categories,
        addExpense,
        updateExpense,
        deleteExpense,
        addCategory,
        updateCategory,
        deleteCategory,
        getCategoryByName,
      }}
    >
      {children}
    </ExpenseContext.Provider>
  );
};

export const useExpenses = () => {
  return useContext(ExpenseContext);
};
