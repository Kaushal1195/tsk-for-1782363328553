import request from 'supertest';
import app from '../../src/app';
import db from '../../src/models';

describe('Reporting & Analytics API', () => {
  let authToken;
  let userId;
  let foodCategoryId;
  let transportCategoryId;
  let utilitiesCategoryId;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'reportuser@example.com',
        password: 'password123',
        name: 'Report User',
      });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'reportuser@example.com',
        password: 'password123',
      });
    authToken = loginRes.body.token;
    userId = loginRes.body.user.id;

    // Create categories
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

    const utilitiesCatRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Utilities' });
    utilitiesCategoryId = utilitiesCatRes.body.id;

    // Seed expenses for reporting
    await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 50.00, date: '2023-04-01', description: 'Groceries', merchant: 'SuperMart', categoryId: foodCategoryId, paymentMethod: 'Card' });
    await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 20.00, date: '2023-04-05', description: 'Bus ticket', merchant: 'Transit', categoryId: transportCategoryId, paymentMethod: 'Cash' });
    await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 30.00, date: '2023-04-10', description: 'Lunch', merchant: 'Cafe', categoryId: foodCategoryId, paymentMethod: 'Card' });
    await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 75.00, date: '2023-04-15', description: 'Electricity bill', merchant: 'PowerCo', categoryId: utilitiesCategoryId, paymentMethod: 'Bank Transfer' });
    await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 15.00, date: '2023-05-01', description: 'Coffee', merchant: 'Starbucks', categoryId: foodCategoryId, paymentMethod: 'Card' });
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  // Feature: Reporting & Analytics
  // Scenario: Generating a Monthly Spending Report
  test('should generate a monthly spending report by category for a given month', async () => {
    const res = await request(app)
      .get('/api/reports/monthly-spending?month=4&year=2023')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('totalSpending');
    expect(res.body).toHaveProperty('spendingByCategory');
    expect(res.body.totalSpending).toEqual(50 + 20 + 30 + 75); // Sum of April expenses

    expect(res.body.spendingByCategory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'Food', total: 80.00 }), // 50 + 30
        expect.objectContaining({ category: 'Transport', total: 20.00 }),
        expect.objectContaining({ category: 'Utilities', total: 75.00 }),
      ])
    );
  });

  test('should generate a monthly spending report with no data for a month with no expenses', async () => {
    const res = await request(app)
      .get('/api/reports/monthly-spending?month=6&year=2023') // Assuming no expenses in June 2023
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.totalSpending).toEqual(0);
    expect(res.body.spendingByCategory).toEqual([]);
  });

  test('should generate a report for a custom date range', async () => {
    const res = await request(app)
      .get('/api/reports/spending-by-category?startDate=2023-04-01&endDate=2023-04-10')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('totalSpending');
    expect(res.body).toHaveProperty('spendingByCategory');
    expect(res.body.totalSpending).toEqual(50 + 20 + 30); // Expenses from April 1st to April 10th

    expect(res.body.spendingByCategory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'Food', total: 80.00 }), // 50 + 30
        expect.objectContaining({ category: 'Transport', total: 20.00 }),
      ])
    );
    expect(res.body.spendingByCategory).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: 'Utilities', total: 75.00 }), // Excluded by date range
      ])
    );
  });

  // Edge Case: Reporting Anomalies - Generating a report for a date range with no expenses recorded
  test('should return empty data for a report with no expenses in the specified range', async () => {
    const res = await request(app)
      .get('/api/reports/monthly-spending?month=1&year=2022') // A month far in the past with no data
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body.totalSpending).toEqual(0);
    expect(res.body.spendingByCategory).toEqual([]);
  });

  test('should export expense data as CSV', async () => {
    const res = await request(app)
      .get('/api/reports/export-csv?startDate=2023-04-01&endDate=2023-04-30')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.statusCode).toEqual(200);
    expect(res.headers['content-type']).toEqual('text/csv; charset=utf-8');
    expect(res.headers['content-disposition']).toContain('attachment; filename="expenses_');
    expect(res.text).toContain('Amount,Date,Description,Merchant,Category,Payment Method,Tags');
    expect(res.text).toContain('50.00,2023-04-01,Groceries,SuperMart,Food,Card,');
    expect(res.text).toContain('75.00,2023-04-15,Electricity bill,PowerCo,Utilities,Bank Transfer,');
  });
});
