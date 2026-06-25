/// <reference types="cypress" />

describe('Expense Viewing & Management E2E', () => {
  let foodCategoryId;
  let transportCategoryId;
  let expenseToEditId;
  let expenseToDeleteId;

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.login('testuser@example.com', 'password123');
    cy.visit('/expenses');

    // Seed categories and expenses via API for consistent tests
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

    // Create expenses for filtering, editing, and deleting
    cy.request({
      method: 'POST',
      url: '/api/expenses',
      headers: { Authorization: `Bearer ${Cypress.env('authToken')}` },
      body: { amount: 50.00, date: '2023-05-01', description: 'Groceries for the week', merchant: 'SuperMart', categoryId: foodCategoryId, paymentMethod: 'Card' },
    });
    cy.request({
      method: 'POST',
      url: '/api/expenses',
      headers: { Authorization: `Bearer ${Cypress.env('authToken')}` },
      body: { amount: 15.00, date: '2023-05-02', description: 'Bus fare to work', merchant: 'City Transit', categoryId: transportCategoryId, paymentMethod: 'Cash' },
    });
    cy.request({
      method: 'POST',
      url: '/api/expenses',
      headers: { Authorization: `Bearer ${Cypress.env('authToken')}` },
      body: { amount: 25.00, date: '2023-05-03', description: 'Lunch at cafe', merchant: 'Cafe X', categoryId: foodCategoryId, paymentMethod: 'Card' },
    }).then((res) => {
      expenseToEditId = res.body.id;
    });
    cy.request({
      method: 'POST',
      url: '/api/expenses',
      headers: { Authorization: `Bearer ${Cypress.env('authToken')}` },
      body: { amount: 10.00, date: '2023-05-04', description: 'Expense to be deleted', merchant: 'Delete Me', categoryId: transportCategoryId, paymentMethod: 'Cash' },
    }).then((res) => {
      expenseToDeleteId = res.body.id;
    });

    cy.reload(); // Reload the page to ensure all seeded expenses are displayed
  });

  // Feature: Expense Viewing & Management
  // Scenario: Filtering Expenses by Category
  it('should allow filtering expenses by category', () => {
    cy.get('[data-cy="filter-category-select"]').select('Food');
    cy.get('[data-cy="apply-filter-button"]').click();

    cy.get('[data-cy="expense-list-item"]').should('have.length.at.least', 2); // Groceries, Lunch
    cy.get('[data-cy="expense-list-item"]').each(($el) => {
      cy.wrap($el).should('contain', 'Food');
      cy.wrap($el).should('not.contain', 'Transport');
    });

    // Clear filter and check all expenses
    cy.get('[data-cy="filter-category-select"]').select(''); // Select 'All' or empty option
    cy.get('[data-cy="apply-filter-button"]').click();
    cy.get('[data-cy="expense-list-item"]').should('have.length.at.least', 4); // All seeded expenses
  });

  it('should allow searching for expenses by description', () => {
    cy.get('[data-cy="search-input"]').type('Groceries');
    cy.get('[data-cy="apply-search-button"]').click();

    cy.get('[data-cy="expense-list-item"]').should('have.length', 1);
    cy.get('[data-cy="expense-list-item"]').first().should('contain', 'Groceries for the week');

    // Clear search
    cy.get('[data-cy="search-input"]').clear();
    cy.get('[data-cy="apply-search-button"]').click();
    cy.get('[data-cy="expense-list-item"]').should('have.length.at.least', 4);
  });

  // Scenario: Editing an Existing Expense
  it('should allow editing an existing expense', () => {
    cy.get(`[data-cy="expense-list-item-${expenseToEditId}"]`)
      .find('[data-cy="edit-expense-button"]')
      .click();

    cy.url().should('include', `/expenses/edit/${expenseToEditId}`);
    cy.get('[data-cy="amount-input"]').clear().type('30.50');
    cy.get('[data-cy="description-input"]').clear().type('Updated lunch at new cafe');
    cy.get('[data-cy="merchant-input"]').clear().type('New Cafe');
    cy.get('[data-cy="category-select"]').select('Transport'); // Change category
    cy.get('[data-cy="save-expense-button"]').click();

    cy.url().should('include', '/expenses');
    cy.contains('.success-message', 'Expense updated successfully').should('be.visible');

    cy.get(`[data-cy="expense-list-item-${expenseToEditId}"]`)
      .should('contain', 'Updated lunch at new cafe')
      .and('contain', '30.50')
      .and('contain', 'Transport');
  });

  it('should allow deleting an existing expense', () => {
    cy.get(`[data-cy="expense-list-item-${expenseToDeleteId}"]`)
      .find('[data-cy="delete-expense-button"]')
      .click();

    cy.get('[data-cy="confirmation-modal"]').should('be.visible');
    cy.get('[data-cy="confirm-delete-button"]').click();

    cy.contains('.success-message', 'Expense deleted successfully').should('be.visible');
    cy.get(`[data-cy="expense-list-item-${expenseToDeleteId}"]`).should('not.exist');
    cy.get('[data-cy="expense-list-item"]').should('have.length.at.least', 3); // One less than before
  });
});
