/// <reference types="cypress" />

describe('Expense Categorization Management E2E', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.login('testuser@example.com', 'password123'); // Custom command to log in
    cy.visit('/categories'); // Navigate to the categories management page
  });

  // Feature: Expense Categorization Management
  // Scenario: Creating a Custom Category
  it('should allow a user to create a new custom category', () => {
    const newCategoryName = 'Home Improvement';
    cy.get('[data-cy="add-category-button"]').click();
    cy.get('[data-cy="category-name-input"]').type(newCategoryName);
    cy.get('[data-cy="save-category-button"]').click();

    cy.contains('.success-message', 'Category created successfully').should('be.visible');
    cy.get('[data-cy="category-list-item"]').should('contain', newCategoryName);

    // Verify it's available in the expense creation form
    cy.visit('/expenses/add');
    cy.get('[data-cy="category-select"]').should('contain', newCategoryName);
  });

  // Edge Case: Duplicate Entries - User attempts to create a custom category with a name that already exists.
  it('should prevent creating a category with a duplicate name', () => {
    const existingCategoryName = 'Food'; // Assuming 'Food' category exists from backend setup or previous tests
    cy.get('[data-cy="add-category-button"]').click();
    cy.get('[data-cy="category-name-input"]').type(existingCategoryName);
    cy.get('[data-cy="save-category-button"]').click();

    cy.contains('.error-message', 'Category with this name already exists').should('be.visible');
    cy.url().should('include', '/categories/add'); // Should stay on the add category form
  });

  it('should allow editing an existing custom category', () => {
    const categoryToEdit = 'Groceries';
    const updatedCategoryName = 'Supermarket Shopping';

    // First, create the category to ensure it exists
    cy.request({
      method: 'POST',
      url: '/api/categories',
      headers: { Authorization: `Bearer ${Cypress.env('authToken')}` },
      body: { name: categoryToEdit },
      failOnStatusCode: false,
    });
    cy.reload(); // Reload to ensure the category is in the list

    cy.get('[data-cy="category-list-item"]')
      .contains(categoryToEdit)
      .parents('[data-cy="category-list-item"]')
      .find('[data-cy="edit-category-button"]')
      .click();

    cy.get('[data-cy="category-name-input"]').clear().type(updatedCategoryName);
    cy.get('[data-cy="save-category-button"]').click();

    cy.contains('.success-message', 'Category updated successfully').should('be.visible');
    cy.get('[data-cy="category-list-item"]').should('not.contain', categoryToEdit);
    cy.get('[data-cy="category-list-item"]').should('contain', updatedCategoryName);
  });

  it('should allow deleting an existing custom category without associated expenses', () => {
    const categoryToDelete = 'Books';
    // First, create the category
    cy.request({
      method: 'POST',
      url: '/api/categories',
      headers: { Authorization: `Bearer ${Cypress.env('authToken')}` },
      body: { name: categoryToDelete },
    });
    cy.reload();

    cy.get('[data-cy="category-list-item"]')
      .contains(categoryToDelete)
      .parents('[data-cy="category-list-item"]')
      .find('[data-cy="delete-category-button"]')
      .click();

    cy.get('[data-cy="confirmation-modal"]').should('be.visible');
    cy.get('[data-cy="confirm-delete-button"]').click();

    cy.contains('.success-message', 'Category deleted successfully').should('be.visible');
    cy.get('[data-cy="category-list-item"]').should('not.contain', categoryToDelete);
  });

  // Edge Case: User deletes a category that has existing expenses assigned to it
  it('should warn and prevent deleting a category with associated expenses', () => {
    const categoryWithExpenses = 'Utilities';
    let categoryId;

    // Create category and an expense linked to it via API
    cy.request({
      method: 'POST',
      url: '/api/categories',
      headers: { Authorization: `Bearer ${Cypress.env('authToken')}` },
      body: { name: categoryWithExpenses },
      failOnStatusCode: false,
    }).then((res) => {
      categoryId = res.body.id;
      cy.request({
        method: 'POST',
        url: '/api/expenses',
        headers: { Authorization: `Bearer ${Cypress.env('authToken')}` },
        body: {
          amount: 75.00,
          date: '2023-04-15',
          description: 'Electricity bill',
          merchant: 'PowerCo',
          categoryId: categoryId,
          paymentMethod: 'Bank Transfer',
        },
      });
    });
    cy.reload(); // Reload to ensure the category is in the list

    cy.get('[data-cy="category-list-item"]')
      .contains(categoryWithExpenses)
      .parents('[data-cy="category-list-item"]')
      .find('[data-cy="delete-category-button"]')
      .click();

    cy.get('[data-cy="confirmation-modal"]').should('be.visible');
    cy.get('[data-cy="confirm-delete-button"]').click();

    cy.contains('.error-message', 'Cannot delete category with associated expenses').should('be.visible');
    cy.get('[data-cy="category-list-item"]').should('contain', categoryWithExpenses); // Category should still be there
  });
});
