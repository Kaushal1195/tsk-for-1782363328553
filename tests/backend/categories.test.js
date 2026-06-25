import request from 'supertest';
import app from '../../src/app';
import db from '../../src/models';

describe('Expense Categorization Management API', () => {
  let authToken;
  let userId;
  let defaultCategory;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'categoryuser@example.com',
        password: 'password123',
        name: 'Category User',
      });
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'categoryuser@example.com',
        password: 'password123',
      });
    authToken = loginRes.body.token;
    userId = loginRes.body.user.id;

    // Create a default category for testing expenses
    const createDefaultCategoryRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Food' });
    defaultCategory = createDefaultCategoryRes.body;
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  // Feature: Expense Categorization Management
  // Scenario: Creating a Custom Category
  test('should allow a user to create a custom category', async () => {
    const newCategoryName = 'Home Improvement';
    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: newCategoryName });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toEqual(newCategoryName);
    expect(res.body.userId).toEqual(userId);

    // Verify it's in the list
    const getRes = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${authToken}`);
    expect(getRes.statusCode).toEqual(200);
    expect(getRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: newCategoryName }),
        expect.objectContaining({ name: defaultCategory.name }),
      ])
    );
  });

  // Edge Case: Duplicate Entries - User attempts to create a custom category with a name that already exists.
  test('should prevent creating a custom category with a duplicate name for the same user', async () => {
    const duplicateCategoryName = 'Travel';
    await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: duplicateCategoryName });

    const res = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: duplicateCategoryName });

    expect(res.statusCode).toEqual(409); // Conflict
    expect(res.body.message).toEqual('Category with this name already exists for this user.');
  });

  test('should allow editing an existing custom category', async () => {
    const categoryToEdit = 'Groceries';
    const updatedCategoryName = 'Supermarket';

    const createRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: categoryToEdit });
    expect(createRes.statusCode).toEqual(201);
    const categoryId = createRes.body.id;

    const updateRes = await request(app)
      .put(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: updatedCategoryName });

    expect(updateRes.statusCode).toEqual(200);
    expect(updateRes.body.name).toEqual(updatedCategoryName);

    const getRes = await request(app)
      .get(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(getRes.statusCode).toEqual(200);
    expect(getRes.body.name).toEqual(updatedCategoryName);
  });

  test('should allow deleting an existing custom category', async () => {
    const categoryToDelete = 'Entertainment';
    const createRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: categoryToDelete });
    expect(createRes.statusCode).toEqual(201);
    const categoryId = createRes.body.id;

    const deleteRes = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(deleteRes.statusCode).toEqual(204); // No Content

    const getRes = await request(app)
      .get(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${authToken}`);
    expect(getRes.statusCode).toEqual(404); // Not Found
  });

  // Edge Case: User deletes a category that has existing expenses assigned to it
  test('should prevent deleting a category if it has associated expenses', async () => {
    const categoryWithExpenses = 'Utilities';
    const createCategoryRes = await request(app)
      .post('/api/categories')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: categoryWithExpenses });
    expect(createCategoryRes.statusCode).toEqual(201);
    const categoryId = createCategoryRes.body.id;

    // Create an expense using this category
    await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        amount: 100.00,
        date: '2023-02-01',
        description: 'Electricity bill',
        merchant: 'Power Co.',
        categoryId: categoryId,
        paymentMethod: 'Bank Transfer',
      });

    const deleteRes = await request(app)
      .delete(`/api/categories/${categoryId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(deleteRes.statusCode).toEqual(409); // Conflict or 400 Bad Request
    expect(deleteRes.body.message).toEqual('Cannot delete category with associated expenses.');
  });
});
