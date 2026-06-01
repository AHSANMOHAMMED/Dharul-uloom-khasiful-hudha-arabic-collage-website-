import { describe, test, expect } from '@jest/globals';
import request from 'supertest';
import app from '../server.js';

describe('API root', () => {
  test('GET / returns the API metadata', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.endpoints).toHaveProperty('library');
    expect(res.body.endpoints).toHaveProperty('curriculum');
  });

  test('unknown API route returns JSON, not an HTML error page', async () => {
    const res = await request(app).get('/api/auth/me');
    // No token provided -> handled by verifyToken with a 401 JSON response.
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('success', false);
  });
});
