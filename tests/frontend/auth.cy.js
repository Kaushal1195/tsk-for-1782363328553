/// <reference types="cypress" />

describe('User Authentication & Authorization E2E', () => {
  beforeEach(() => {
    // Clear local storage or cookies before each test to ensure a clean state
    cy.clearLocalStorage();
    cy.clearCookies();
    // Assuming a clean database state or mocking API for consistent tests
    cy.visit('/'); // Visit the base URL, which should redirect to login if not authenticated
  });

  // Feature: User Authentication & Authorization
  // Scenario: Unauthorized Access Attempt
  it('should redirect to login page when attempting to access protected route without login', () => {
    cy.visit('/expenses'); // Attempt to visit a protected route directly
    cy.url().should('include', '/login'); // Verify redirection to login page
    cy.contains('h2', 'Login').should('be.visible'); // Verify login page content
    cy.contains('My expense data is not displayed.').should('not.exist'); // Ensure no expense data is shown
  });

  it('should allow a user to successfully log in and access expenses', () => {
    // Assuming a test user exists in the system
    cy.get('input[name="email"]').type('testuser@example.com');
    cy.get('input[name="password"]').type('password123');
    cy.get('button[type="submit"]').click();

    cy.url().should('include', '/expenses'); // Verify redirection to expenses page
    cy.contains('h1', 'My Expenses').should('be.visible'); // Verify expense page content
    cy.get('[data-cy="expense-list"]').should('be.visible'); // Check for expense list presence
  });

  it('should display an error message for invalid login credentials', () => {
    cy.get('input[name="email"]').type('nonexistent@example.com');
    cy.get('input[name="password"]').type('wrongpassword');
    cy.get('button[type="submit"]').click();

    cy.contains('.error-message', 'Invalid credentials').should('be.visible'); // Verify error message
    cy.url().should('include', '/login'); // Should remain on the login page
  });

  it('should allow a logged-in user to log out', () => {
    // First, log in
    cy.login('testuser@example.com', 'password123'); // Custom command for login
    cy.url().should('include', '/expenses');

    // Then, log out
    cy.get('[data-cy="logout-button"]').click();
    cy.url().should('include', '/login');
    cy.contains('h2', 'Login').should('be.visible');
    cy.get('[data-cy="expense-list"]').should('not.exist'); // Ensure expense list is no longer visible
  });
});
