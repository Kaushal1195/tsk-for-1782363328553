import React, { useState } from 'react';
import { useExpenses } from '../context/ExpenseContext';

const Reports = () => {
  const { expenses, categories } = useExpenses();
  const [reportType, setReportType] = useState('category'); // 'category', 'monthly'
  const [dateRange, setDateRange] = useState('currentMonth'); // 'currentMonth', 'lastMonth', 'currentYear', 'custom'
  const [customDates, setCustomDates] = useState({ startDate: '', endDate: '' });

  const getFilteredExpenses = () => {
    let filtered = [...expenses];
    const today = new Date();

    switch (dateRange) {
      case 'currentMonth':
        filtered = filtered.filter(exp => {
          const expDate = new Date(exp.date);
          return expDate.getMonth() === today.getMonth() && expDate.getFullYear() === today.getFullYear();
        });
        break;
      case 'lastMonth':
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        filtered = filtered.filter(exp => {
          const expDate = new Date(exp.date);
          return expDate >= lastMonth && expDate < currentMonthStart;
        });
        break;
      case 'currentYear':
        filtered = filtered.filter(exp => new Date(exp.date).getFullYear() === today.getFullYear());
        break;
      case 'custom':
        if (customDates.startDate && customDates.endDate) {
          const start = new Date(customDates.startDate);
          const end = new Date(customDates.endDate);
          filtered = filtered.filter(exp => {
            const expDate = new Date(exp.date);
            return expDate >= start && expDate <= end;
          });
        }
        break;
      default:
        break;
    }
    return filtered;
  };

  const generateCategoryReport = () => {
    const filtered = getFilteredExpenses();
    const reportData = categories.map(cat => ({
      name: cat.name,
      total: filtered
        .filter(exp => exp.category === cat.name)
        .reduce((sum, exp) => sum + exp.amount, 0),
      count: filtered.filter(exp => exp.category === cat.name).length,
    })).filter(item => item.total > 0).sort((a, b) => b.total - a.total);

    const total = reportData.reduce((sum, item) => sum + item.total, 0);

    return { reportData, total };
  };

  const generateMonthlyReport = () => {
    const filtered = getFilteredExpenses();
    const monthlyTotals = {};

    filtered.forEach(exp => {
      const monthYear = new Date(exp.date).toLocaleString('en-US', { month: 'short', year: 'numeric' });
      monthlyTotals[monthYear] = (monthlyTotals[monthYear] || 0) + exp.amount;
    });

    const reportData = Object.entries(monthlyTotals)
      .map(([monthYear, total]) => ({ monthYear, total }))
      .sort((a, b) => new Date(`1 ${a.monthYear}`) - new Date(`1 ${b.monthYear}`)); // Sort chronologically

    const total = reportData.reduce((sum, item) => sum + item.total, 0);

    return { reportData, total };
  };

  const { reportData, total } = reportType === 'category' ? generateCategoryReport() : generateMonthlyReport();

  const handleExport = (format) => {
    const dataToExport = reportType === 'category' ? generateCategoryReport().reportData : generateMonthlyReport().reportData;
    let content = '';
    let filename = '';

    if (format === 'csv') {
      if (reportType === 'category') {
        content = 'Category,Total Amount,Number of Expenses\n' +
                  dataToExport.map(item => `${item.name},${item.total.toFixed(2)},${item.count}`).join('\n');
        filename = 'category_report.csv';
      } else { // monthly
        content = 'Month,Total Amount\n' +
                  dataToExport.map(item => `${item.monthYear},${item.total.toFixed(2)}`).join('\n');
        filename = 'monthly_report.csv';
      }
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (format === 'pdf') {
      alert('PDF export is a complex feature and would require a dedicated library (e.g., jsPDF) or server-side rendering. This is a placeholder.');
      // Example for a simple PDF (requires jsPDF library)
      /*
      import jsPDF from 'jspdf';
      const doc = new jsPDF();
      doc.text("Expense Report", 10, 10);
      let y = 20;
      if (reportType === 'category') {
        doc.text("Category | Total Amount | Count", 10, y);
        y += 10;
        dataToExport.forEach(item => {
          doc.text(`${item.name} | $${item.total.toFixed(2)} | ${item.count}`, 10, y);
          y += 7;
        });
      } else { // monthly
        doc.text("Month | Total Amount", 10, y);
        y += 10;
        dataToExport.forEach(item => {
          doc.text(`${item.monthYear} | $${item.total.toFixed(2)}`, 10, y);
          y += 7;
        });
      }
      doc.save("expense_report.pdf");
      */
    }
  };


  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Expense Reports</h1>

      <div className="bg-white p-6 rounded-lg shadow-md mb-6">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Report Options</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label htmlFor="reportType" className="block text-sm font-medium text-gray-700">Report Type</label>
            <select
              id="reportType"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              <option value="category">Spending by Category</option>
              <option value="monthly">Monthly Spending</option>
            </select>
          </div>

          <div>
            <label htmlFor="dateRange" className="block text-sm font-medium text-gray-700">Date Range</label>
            <select
              id="dateRange"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            >
              <option value="currentMonth">Current Month</option>
              <option value="lastMonth">Last Month</option>
              <option value="currentYear">Current Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {dateRange === 'custom' && (
            <>
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">Start Date</label>
                <input
                  type="date"
                  id="startDate"
                  name="startDate"
                  value={customDates.startDate}
                  onChange={(e) => setCustomDates(prev => ({ ...prev, startDate: e.target.value }))}
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">End Date</label>
                <input
                  type="date"
                  id="endDate"
                  name="endDate"
                  value={customDates.endDate}
                  onChange={(e) => setCustomDates(prev => ({ ...prev, endDate: e.target.value }))}
                  className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </>
          )}
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={() => handleExport('csv')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Export CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Export PDF
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">Report Summary</h2>
        {reportData.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No data available for the selected criteria.</p>
        ) : (
          <>
            <div className="overflow-x-auto mb-6">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {reportType === 'category' ? 'Category' : 'Month'}
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total Amount
                    </th>
                    {reportType === 'category' && (
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        # Expenses
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reportData.map((item, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {reportType === 'category' ? item.name : item.monthYear}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                        -${item.total.toFixed(2)}
                      </td>
                      {reportType === 'category' && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {item.count}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                      Total
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-red-700 uppercase tracking-wider">
                      -${total.toFixed(2)}
                    </th>
                    {reportType === 'category' && <th className="px-6 py-3"></th>}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Placeholder for Charts */}
            <h3 className="text-lg font-semibold text-gray-700 mb-3">Visualizations (Placeholder)</h3>
            <div className="bg-gray-50 p-4 rounded-md text-gray-600 text-center italic">
              Charts (e.g., Pie Chart for Categories, Bar Chart for Monthly Spending) would be rendered here using a charting library like Chart.js or Recharts.
              <div className="h-48 bg-gray-200 flex items-center justify-center mt-4 rounded-md">
                <p>Chart Placeholder</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Reports;
