import request from 'supertest';
import app from '../app';

describe('Authentication API Tests', () => {
  const testUser = {
    name: 'Test Passenger',
    email: `test+${Date.now()}@tegabus.com`,
    password: 'Test1234!',
  };

  let authToken: string;

  describe('User Registration', () => {
    test('user can register', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.role).toBe('PASSENGER');
    });

    test('duplicate email is rejected', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    test('invalid email is rejected', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'not-an-email',
          password: 'Test1234!',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('short password is rejected', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: `short+${Date.now()}@tegabus.com`,
          password: '123',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('User Login', () => {
    test('user can login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();

      authToken = response.body.data.token;
    });

    test('wrong password is rejected', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('non-existing user is rejected', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nobody@tegabus.com',
          password: 'Test1234!',
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('User Profile (/me)', () => {
    test('authenticated user can access /me', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    test('request without token is rejected', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    test('invalid token is rejected', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalidtoken123');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});

