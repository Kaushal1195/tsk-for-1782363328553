/// <reference types="cypress" />

describe('Reporting & Analytics E2E', () => {
  let foodCategoryId;
  let transportCategoryId;
  let utilitiesCategoryId;

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.login('testuser@example.com', 'password123');
    cy.visit('/reports');

    // Seed categories and expenses via API for consistent tests
    // Ensure categories exist
    cy.request({
      method: 'POST',
      url: '/api/categories',
      headers: { Authorization: `Bearer ${Cypress.env('authToken')}` },
      body: { name: 'Food' },
      failOnStatusCode: false,
    }).then((res) => {
      foodCategoryId = res.body.id || res.body.existingCategory.id;
    });
    cy.request({
      method: 'POST',
      url: '/api/categories',
      headers: { Authorization: `Bearer ${Cypress.env('authToken')}` },
      body: { name: 'Transport' },
      failOnStatusCode: false,
    }).then((res) => {
      transportCategoryId = res.body.id || res.body.existingCategory.id;
    });
    cy.request({
      method: 'POST',
      url: '/api/categories',
      headers: { Authorization: `Bearer ${Cypress.env('authToken')}` },
      body: { name: 'Utilities' },
      failOnStatusCode: false,
    }).then((res) => {
      utilitiesCategoryId = res.body.id || res.body.existingCategory.id;
    });

    // Seed expenses for reporting (e.g., for May 2023)
    cy.request({
      method: 'POST',
      url: '/api/expenses',
      headers: { Authorization: `Bearer ${Cypress.env('authToken')}` },
      body: { amount: 50.00, date: '2023-05-01', description: 'Groceries', merchant: 'SuperMart', categoryId: foodCategoryId, paymentMethod: 'Card' },
    });
    cy.request({
      method: 'POST',
      url: '/api/expenses',
      headers: { Authorization: `Bearer ${Cypress.env('authToken')}` },
      body: { amount: 20.00, date: '2023-05-05', description: 'Bus ticket', merchant: 'Transit', categoryId: transportCategoryId, paymentMethod: 'Cash' },
    });
    cy.request({
      method: 'POST',
      url: '/api/expenses',
      headers: { Authorization: `Bearer ${Cypress.env('authToken')}` },
      body: { amount: 30.00, date: '2023-05-10', description: 'Lunch', merchant: 'Cafe', categoryId: foodCategoryId, paymentMethod: 'Card' },
    });
    cy.request({
      method: 'POST',
      url: '/api/expenses',
      headers: { Authorization: `Bearer ${Cypress.env('authToken')}` },
      body: { amount: 75.00, date: '2023-05-15', description: 'Electricity bill', merchant: 'PowerCo', categoryId: utilitiesCategoryId, paymentMethod: 'Bank Transfer' },
    });
    // Expense for a different month
    cy.request({
      method: 'POST',
      url: '/api/expenses',
      headers: { Authorization: `Bearer ${Cypress.env('authToken')}` },
      body: { amount: 15.00, date: '2023-06-01', description: 'Coffee', merchant: 'Starbucks', categoryId: foodCategoryId, paymentMethod: 'Card' },
    });

    cy.reload(); // Ensure the page reflects the seeded data
  });

  // Feature: Reporting & Analytics
  // Scenario: Generating a Monthly Spending Report
  it('should generate and display a monthly spending report by category', () => {
    cy.get('[data-cy="report-type-select"]').select('Monthly Spending');
    cy.get('[data-cy="report-month-select"]').select('May'); // Assuming May 2023
    cy.get('[data-cy="report-year-select"]').select('2023');
    cy.get('[data-cy="generate-report-button"]').click();

    cy.get('[data-cy="report-summary"]').should('be.visible');
    cy.get('[data-cy="total-spending"]').should('contain', 'Total Spending: $175.00'); // 50+20+30+75

    cy.get('[data-cy="spending-by-category-list"]').should('be.visible');
    cy.get('[data-cy="category-spending-item"]').should('have.length', 3); // Food, Transport, Utilities
    cy.get('[data-cy="category-spending-item"]').contains('Food').should('contain', '$80.00'); // 50+30
    cy.get('[data-cy="category-spending-item"]').contains('Transport').should('contain', '$20.00');
    cy.get('[data-cy="category-spending-item"]').contains('Utilities').should('contain', '$75.00');

    cy.get('[data-cy="spending-chart"]').should('be.visible'); // Verify chart presence
  });

  // Edge Case: Reporting Anomalies - Generating a report for a date range with no expenses recorded
  it('should gracefully show "No data" for a report with no expenses in the selected period', () => {
    cy.get('[data-cy="report-type-select"]').select('Monthly Spending');
    cy.get('[data-cy="report-month-select"]').select('January'); // Assuming no expenses in January 2023
    cy.get('[data-cy="report-year-select"]').select('2023');
    cy.get('[data-cy="generate-report-button"]').click();

    cy.get('[data-cy="report-summary"]').should('be.visible');
    cy.get('[data-cy="total-spending"]').should('contain', 'Total Spending: $0.00');
    cy.get('[data-cy="spending-by-category-list"]').should('not.exist'); // Or show an empty state message
    cy.get('[data-cy="no-data-message"]').should('be.visible').and('contain', 'No expenses found for this period.');
    cy.get('[data-cy="spending-chart"]').should('not.exist'); // Chart should not be rendered
  });

  it('should allow exporting expense data as CSV', () => {
    cy.get('[data-cy="report-type-select"]').select('Export Data');
    cy.get('[data-cy="start-date-input"]').type('2023-05-01');
    cy.get('[data-cy="end-date-input"]').type('2023-05-31');

    cy.get('[data-cy="export-button"]').click();

    // Verify the download
    cy.verifyDownload('expenses_2023-05-01_to_2023-05-31.csv', { contains: true }); // Assuming cypress-downloadfile plugin
    cy.readFile('cypress/downloads/expenses_2023-05-01_to_2023-05-31.csv').should('contain', 'Amount,Date,Description,Merchant,Category,Payment Method,Tags');
    cy.readFile('cypress/downloads/expenses_2023-05-01_to_2023-05-31.csv').should('contain', '50.00,2023-05-01,Groceries,SuperMart,Food,Card,');
    cy.readFile('cypress/downloads/expenses_2023-05-01_to_2023-05-31.csv').should('contain', '75.00,2023-05-15,Electricity bill,PowerCo,Utilities,Bank Transfer,');
    cy.readFile('cypress/downloads/expenses_2023-05-01_to_2023-05-31.csv').should('not.contain', '2023-06-01'); // Ensure June expense is not included
  });
});
