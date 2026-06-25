import request from 'supertest';
import app from '../../src/app';
import db from '../../src/models';
import path from 'path';
import fs from 'fs';

describe('Expense Entry & Management API', () => {
  let authToken;
  let userId;
  let foodCategoryId;
  let transportCategoryId;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'expenseuser@example.com',
        password: 'password123',
        name: 'Expense User',
      });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'expenseuser@example.com',
        password: 'password123',
      });
    authToken = loginRes.body.token;
    userId = loginRes.body.user.id;

    // Create categories for testing
    const foodCatRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Food' });
    foodCategoryId = foodCatRes.body.id;

    const transportCatRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Transport' });
    transportCategoryId = transportCatRes.body.id;
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  // Feature: Expense Entry
  // Scenario: Successful Manual Expense Entry
  test('should allow a user to successfully create an expense', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 25.50,
        date: '2023-01-01',
        description: 'Coffee and pastry',
        merchant: 'Starbucks',
        categoryId: foodCategoryId,
        paymentMethod: 'Credit Card',
        tags: ['breakfast', 'work'],
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.amount).toEqual(25.50);
    expect(res.body.description).toEqual('Coffee and pastry');
    expect(res.body.merchant).toEqual('Starbucks');
    expect(res.body.categoryId).toEqual(foodCategoryId);
    expect(res.body.paymentMethod).toEqual('Credit Card');
    expect(res.body.tags).toEqual(['breakfast', 'work']);
    expect(res.body.userId).toEqual(userId);
  });

  // Edge Case: Invalid Data Input - Entering non-numeric values for expense amount.
  test('should return 400 for invalid amount (non-numeric)', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 'twenty',
        date: '2023-01-02',
        description: 'Invalid amount test',
        merchant: 'Test Store',
        categoryId: foodCategoryId,
        paymentMethod: 'Cash',
      });
    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toContain('Amount must be a number');
  });

  // Edge Case: Invalid Data Input - Entering a future date for an expense.
  test('should return 400 for future date', async () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 1); // Tomorrow
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 10.00,
        date: futureDate.toISOString().split('T')[0],
        description: 'Future date test',
        merchant: 'Test Store',
        categoryId: foodCategoryId,
        paymentMethod: 'Cash',
      });
    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toContain('Date cannot be in the future');
  });

  // Edge Case: Invalid Data Input - Attempting to save an expense without a required field (e.g., amount, category).
  test('should return 400 for missing required fields (e.g., amount)', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        date: '2023-01-03',
        description: 'Missing amount test',
        merchant: 'Test Store',
        categoryId: foodCategoryId,
        paymentMethod: 'Cash',
      });
    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toContain('Amount is required');
  });

  test('should return 400 for missing required fields (e.g., categoryId)', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 10.00,
        date: '2023-01-03',
        description: 'Missing category test',
        merchant: 'Test Store',
        paymentMethod: 'Cash',
      });
    expect(res.statusCode).toEqual(400);
    expect(res.body.message).toContain('Category ID is required');
  });

  // Scenario: Attaching a Receipt
  test('should allow attaching a receipt (image) to an expense', async () => {
    const expenseRes = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 15.00,
        date: '2023-01-05',
        description: 'Grocery shopping',
        merchant: 'Local Market',
        categoryId: foodCategoryId,
        paymentMethod: 'Debit Card',
      });
    expect(expenseRes.statusCode).toEqual(201);
    const expenseId = expenseRes.body.id;

    const filePath = path.join(__dirname, '../fixtures/test_receipt.png'); // Assuming a test_receipt.png in a fixtures folder
    // Create a dummy file if it doesn't exist for testing purposes
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, 'dummy image data');
    }

    const uploadRes = await request(app)
      .post(`/api/expenses/${expenseId}/receipt`)
      .set('Authorization', `Bearer ${authToken}`)
      .attach('receipt', filePath);

    expect(uploadRes.statusCode).toEqual(200);
    expect(uploadRes.body).toHaveProperty('receiptUrl');
    expect(uploadRes.body.receiptUrl).toMatch(/\/uploads\/receipts\/.*\.png$/);

    // Verify the receipt URL is linked to the expense
    const getExpenseRes = await request(app)
      .get(`/api/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(getExpenseRes.statusCode).toEqual(200);
    expect(getExpenseRes.body.receiptUrl).toEqual(uploadRes.body.receiptUrl);
  });

  // Edge Case: Data Integrity Issues - Receipt upload fails due to invalid file type/size.
  test('should return 400 for invalid receipt file type', async () => {
    const expenseRes = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 15.00,
        date: '2023-01-05',
        description: 'Grocery shopping',
        merchant: 'Local Market',
        categoryId: foodCategoryId,
        paymentMethod: 'Debit Card',
      });
    expect(expenseRes.statusCode).toEqual(201);
    const expenseId = expenseRes.body.id;

    const filePath = path.join(__dirname, '../fixtures/test_document.txt'); // Assuming a test_document.txt
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, 'dummy text data');
    }

    const uploadRes = await request(app)
      .post(`/api/expenses/${expenseId}/receipt`)
      .set('Authorization', `Bearer ${authToken}`)
      .attach('receipt', filePath);

    expect(uploadRes.statusCode).toEqual(400);
    expect(uploadRes.body.message).toContain('Only image and PDF files are allowed');
  });

  // Feature: Expense Viewing & Management
  // Scenario: Filtering Expenses by Category
  test('should allow filtering expenses by category', async () => {
    // Create multiple expenses
    await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 30.00,
        date: '2023-02-01',
        description: 'Dinner with friends',
        merchant: 'Pizzeria',
        categoryId: foodCategoryId,
        paymentMethod: 'Cash',
      });
    await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 10.00,
        date: '2023-02-02',
        description: 'Bus fare',
        merchant: 'City Transit',
        categoryId: transportCategoryId,
        paymentMethod: 'Card',
      });
    await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 5.00,
        date: '2023-02-03',
        description: 'Snack',
        merchant: 'Convenience Store',
        categoryId: foodCategoryId,
        paymentMethod: 'Cash',
      });

    const res = await request(app)
      .get(`/api/expenses?categoryId=${foodCategoryId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2); // At least the two food expenses created here + previous food expenses
    res.body.forEach((expense) => {
      expect(expense.categoryId).toEqual(foodCategoryId);
    });
  });

  test('should allow searching expenses by description', async () => {
    await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 12.50,
        date: '2023-03-01',
        description: 'Movie tickets for a fun night',
        merchant: 'Cinema',
        categoryId: transportCategoryId, // Using transport category for simplicity
        paymentMethod: 'Credit Card',
      });

    const res = await request(app)
      .get('/api/expenses?search=movie')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0].description).toContain('Movie tickets');
  });

  // Scenario: Editing an Existing Expense
  test('should allow editing an existing expense', async () => {
    const createRes = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 40.00,
        date: '2023-03-10',
        description: 'Old description',
        merchant: 'Old Merchant',
        categoryId: foodCategoryId,
        paymentMethod: 'Cash',
      });
    expect(createRes.statusCode).toEqual(201);
    const expenseId = createRes.body.id;

    const updateRes = await request(app)
      .put(`/api/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 45.00,
        description: 'New description for updated expense',
        merchant: 'New Merchant',
        categoryId: transportCategoryId, // Change category
        tags: ['updated', 'test'],
      });

    expect(updateRes.statusCode).toEqual(200);
    expect(updateRes.body.id).toEqual(expenseId);
    expect(updateRes.body.amount).toEqual(45.00);
    expect(updateRes.body.description).toEqual('New description for updated expense');
    expect(updateRes.body.merchant).toEqual('New Merchant');
    expect(updateRes.body.categoryId).toEqual(transportCategoryId);
    expect(updateRes.body.tags).toEqual(['updated', 'test']);

    // Verify audit trail (assuming it's part of the response or a separate endpoint)
    // For this example, we'll just check the updated data. A real audit trail would need a separate test.
  });

  test('should allow deleting an existing expense', async () => {
    const createRes = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 20.00,
        date: '2023-03-15',
        description: 'Expense to delete',
        merchant: 'Delete Store',
        categoryId: foodCategoryId,
        paymentMethod: 'Cash',
      });
    expect(createRes.statusCode).toEqual(201);
    const expenseId = createRes.body.id;

    const deleteRes = await request(app)
      .delete(`/api/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(deleteRes.statusCode).toEqual(204); // No Content

    const getRes = await request(app)
      .get(`/api/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(getRes.statusCode).toEqual(404); // Not Found
  });
});
