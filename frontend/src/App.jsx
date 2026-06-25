import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import AddExpense from './pages/AddExpense';
import Categories from './pages/Categories';
import Reports from './pages/Reports';

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/add-expense" element={<AddExpense />} />
        <Route path="/edit-expense/:id" element={<AddExpense />} /> {/* Route for editing */}
        <Route path="/categories" element={<Categories />} />
        <Route path="/reports" element={<Reports />} />
        {/* Add a catch-all route for 404 if desired */}
        <Route path="*" element={<h1 className="text-4xl text-center mt-20">404 - Page Not Found</h1>} />
      </Routes>
    </Layout>
  );
}

export default App;
