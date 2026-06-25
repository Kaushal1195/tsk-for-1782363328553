import request from 'supertest';
import app from '../../src/app'; // Assuming your Express app is exported from src/app.js
import db from '../../src/models'; // Assuming your database models are here

describe('User Authentication & Authorization API', () => {
  let authToken;
  let userId;

  beforeAll(async () => {
    // Clean up and seed database for consistent tests
    await db.sequelize.sync({ force: true });
    // Register a test user and get a token
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'testuser@example.com',
        password: 'password123',
        name: 'Test User',
      });
    expect(res.statusCode).toEqual(201);
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'testuser@example.com',
        password: 'password123',
      });
    expect(loginRes.statusCode).toEqual(200);
    authToken = loginRes.body.token;
    userId = loginRes.body.user.id;
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  // Feature: User Authentication & Authorization
  // Scenario: Unauthorized Access Attempt
  test('should return 401 Unauthorized when accessing protected route without token', async () => {
    const res = await request(app).get('/api/expenses');
    expect(res.statusCode).toEqual(401);
    expect(res.body.message).toEqual('Authentication required');
  });

  test('should return 401 Unauthorized when accessing protected route with invalid token', async () => {
    const res = await request(app)
      .get('/api/expenses')
      .set('Authorization', 'Bearer invalidtoken123');
    expect(res.statusCode).toEqual(401);
    expect(res.body.message).toEqual('Invalid token');
  });

  // Edge Case: Security & Authorization - A user attempts to view/edit another user's expenses
  test('should prevent a user from accessing another user\'s expenses', async () => {
    // Create a second user
    const res2 = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'anotheruser@example.com',
        password: 'password123',
        name: 'Another User',
      });
    expect(res2.statusCode).toEqual(201);
    const loginRes2 = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'anotheruser@example.com',
        password: 'password123',
      });
    expect(loginRes2.statusCode).toEqual(200);
    const anotherUserToken = loginRes2.body.token;
    const anotherUserId = loginRes2.body.user.id;

    // User 1 creates an expense
    const expenseRes = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 50.00,
        date: '2023-01-15',
        description: 'Lunch with client',
        merchant: 'Restaurant A',
        categoryId: 1, // Assuming category 1 exists or is created in setup
        paymentMethod: 'Credit Card',
      });
    expect(expenseRes.statusCode).toEqual(201);
    const user1ExpenseId = expenseRes.body.id;

    // User 2 tries to get User 1's expense
    const getRes = await request(app)
      .get(`/api/expenses/${user1ExpenseId}`)
      .set('Authorization', `Bearer ${anotherUserToken}`);
    expect(getRes.statusCode).toEqual(403); // Or 404 if the API is designed to hide existence
    expect(getRes.body.message).toEqual('Access denied');

    // User 2 tries to update User 1's expense
    const updateRes = await request(app)
      .put(`/api/expenses/${user1ExpenseId}`)
      .set('Authorization', `Bearer ${anotherUserToken}`)
      .send({
        amount: 60.00,
      });
    expect(updateRes.statusCode).toEqual(403);
    expect(updateRes.body.message).toEqual('Access denied');

    // User 2 tries to delete User 1's expense
    const deleteRes = await request(app)
      .delete(`/api/expenses/${user1ExpenseId}`)
      .set('Authorization', `Bearer ${anotherUserToken}`);
    expect(deleteRes.statusCode).toEqual(403);
    expect(deleteRes.body.message).toEqual('Access denied');
  });
});
