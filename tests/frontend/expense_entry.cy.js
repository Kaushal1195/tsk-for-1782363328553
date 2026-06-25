/// <reference types="cypress" />

describe('Expense Entry E2E', () => {
  let foodCategoryId;

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.clearCookies();
    cy.login('testuser@example.com', 'password123'); // Custom command to log in
    cy.visit('/expenses/add'); // Navigate to the add expense page

    // Seed categories if not already done via API or ensure they exist
    cy.request({
      method: 'POST',
      url: '/api/categories', // Assuming this endpoint creates categories
      headers: {
        Authorization: `Bearer ${Cypress.env('authToken')}`, // Use token from login command
      },
      body: { name: 'Food' },
      failOnStatusCode: false, // Don't fail if category already exists (e.g., 409)
    }).then((response) => {
      if (response.status === 201) {
        foodCategoryId = response.body.id;
      } else if (response.status === 409) {
        // If category exists, fetch its ID
        cy.request({
          method: 'GET',
          url: '/api/categories',
          headers: { Authorization: `Bearer ${Cypress.env('authToken')}` },
        }).then((getCategoriesRes) => {
          foodCategoryId = getCategoriesRes.body.find(cat => cat.name === 'Food').id;
        });
      }
    });
  });

  // Feature: Expense Entry
  // Scenario: Successful Manual Expense Entry
  it('should allow a user to successfully enter a new expense', () => {
    cy.get('[data-cy="amount-input"]').type('45.75');
    cy.get('[data-cy="date-input"]').type('2023-04-20');
    cy.get('[data-cy="description-input"]').type('Dinner with colleagues');
    cy.get('[data-cy="merchant-input"]').type('The Italian Place');
    cy.get('[data-cy="category-select"]').select('Food'); // Select by text, assuming 'Food' is an option
    cy.get('[data-cy="payment-method-select"]').select('Credit Card');
    cy.get('[data-cy="tags-input"]').type('work, team-building');

    cy.get('[data-cy="save-expense-button"]').click();

    cy.url().should('include', '/expenses'); // Should redirect to expense list
    cy.contains('.success-message', 'Expense successfully recorded').should('be.visible');
    cy.get('[data-cy="expense-list-item"]')
      .first() // Assuming new expenses appear at the top
      .should('contain', 'Dinner with colleagues')
      .and('contain', '45.75')
      .and('contain', 'Food');
  });

  // Edge Case: Invalid Data Input - Entering non-numeric values for expense amount.
  it('should show validation error for non-numeric amount', () => {
    cy.get('[data-cy="amount-input"]').type('abc');
    cy.get('[data-cy="date-input"]').type('2023-04-20');
    cy.get('[data-cy="description-input"]').type('Test');
    cy.get('[data-cy="merchant-input"]').type('Test');
    cy.get('[data-cy="category-select"]').select('Food');
    cy.get('[data-cy="save-expense-button"]').click();

    cy.contains('.error-message', 'Amount must be a valid number').should('be.visible');
    cy.url().should('include', '/expenses/add'); // Should stay on the add expense page
  });

  // Edge Case: Invalid Data Input - Entering a future date for an expense.
  it('should show validation error for a future date', () => {
    const futureDate = Cypress.moment().add(1, 'day').format('YYYY-MM-DD');
    cy.get('[data-cy="amount-input"]').type('10.00');
    cy.get('[data-cy="date-input"]').type(futureDate);
    cy.get('[data-cy="description-input"]').type('Future expense');
    cy.get('[data-cy="merchant-input"]').type('Future Store');
    cy.get('[data-cy="category-select"]').select('Food');
    cy.get('[data-cy="save-expense-button"]').click();

    cy.contains('.error-message', 'Date cannot be in the future').should('be.visible');
  });

  // Edge Case: Invalid Data Input - Attempting to save an expense without a required field (e.g., amount, category).
  it('should show validation error for missing required fields', () => {
    // Try to save without amount
    cy.get('[data-cy="date-input"]').type('2023-04-20');
    cy.get('[data-cy="description-input"]').type('Missing amount');
    cy.get('[data-cy="merchant-input"]').type('Test');
    cy.get('[data-cy="category-select"]').select('Food');
    cy.get('[data-cy="save-expense-button"]').click();
    cy.contains('.error-message', 'Amount is required').should('be.visible');

    // Try to save without category
    cy.get('[data-cy="amount-input"]').clear().type('10.00');
    cy.get('[data-cy="category-select"]').select(''); // Select empty/default option
    cy.get('[data-cy="save-expense-button"]').click();
    cy.contains('.error-message', 'Category is required').should('be.visible');
  });

  // Scenario: Attaching a Receipt
  it('should allow attaching an image receipt to a new expense', () => {
    cy.get('[data-cy="amount-input"]').type('12.34');
    cy.get('[data-cy="date-input"]').type('2023-04-21');
    cy.get('[data-cy="description-input"]').type('Coffee receipt');
    cy.get('[data-cy="merchant-input"]').type('Coffee Shop');
    cy.get('[data-cy="category-select"]').select('Food');

    // Attach a dummy file
    cy.fixture('test_receipt.png', 'binary')
      .then(Cypress.Blob.binaryStringToBlob)
      .then((fileBlob) => {
        const formData = new FormData();
        formData.append('receipt', fileBlob, 'test_receipt.png');
        cy.get('[data-cy="receipt-upload-input"]').attachFile({
          fileContent: fileBlob,
          fileName: 'test_receipt.png',
          mimeType: 'image/png',
        });
      });

    cy.get('[data-cy="save-expense-button"]').click();

    cy.url().should('include', '/expenses');
    cy.contains('.success-message', 'Expense successfully recorded').should('be.visible');

    // Verify the receipt is linked (e.g., by checking for a receipt icon or link)
    cy.get('[data-cy="expense-list-item"]')
      .first()
      .should('contain', 'Coffee receipt')
      .find('[data-cy="receipt-icon"]')
      .should('be.visible');

    // Click to view receipt (assuming a modal or new tab opens)
    cy.get('[data-cy="expense-list-item"]')
      .first()
      .find('[data-cy="receipt-icon"]')
      .click();
    cy.get('[data-cy="receipt-viewer-modal"]').should('be.visible');
    cy.get('[data-cy="receipt-viewer-modal"] img').should('have.attr', 'src').and('include', 'test_receipt.png');
    cy.get('[data-cy="receipt-viewer-close-button"]').click();
    cy.get('[data-cy="receipt-viewer-modal"]').should('not.exist');
  });

  // Edge Case: User tries to upload an unsupported file type as a receipt.
  it('should show error for unsupported receipt file type', () => {
    cy.get('[data-cy="amount-input"]').type('5.00');
    cy.get('[data-cy="date-input"]').type('2023-04-22');
    cy.get('[data-cy="description-input"]').type('Invalid receipt test');
    cy.get('[data-cy="merchant-input"]').type('Test');
    cy.get('[data-cy="category-select"]').select('Food');

    cy.fixture('test_document.txt', 'binary') // Assuming a test_document.txt fixture
      .then(Cypress.Blob.binaryStringToBlob)
      .then((fileBlob) => {
        cy.get('[data-cy="receipt-upload-input"]').attachFile({
          fileContent: fileBlob,
          fileName: 'test_document.txt',
          mimeType: 'text/plain',
        });
      });

    cy.get('[data-cy="save-expense-button"]').click();

    cy.contains('.error-message', 'Only image and PDF files are allowed').should('be.visible');
    cy.url().should('include', '/expenses/add');
  });
});
