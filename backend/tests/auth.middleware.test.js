import { describe, test, expect, beforeAll } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { verifyToken, isAdmin, isStudentOrParent } from '../middleware/auth.js';

const mockRes = () => {
  const res = {};
  res.statusCode = 200;
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.body = body;
    return res;
  };
  return res;
};

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
});

describe('verifyToken', () => {
  test('rejects requests without a token', () => {
    const req = { header: () => undefined };
    const res = mockRes();
    let nextCalled = false;
    verifyToken(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(401);
    expect(nextCalled).toBe(false);
  });

  test('rejects an invalid token', () => {
    const req = { header: () => 'Bearer not-a-real-token' };
    const res = mockRes();
    let nextCalled = false;
    verifyToken(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(400);
    expect(nextCalled).toBe(false);
  });

  test('accepts a valid token and populates req.user', () => {
    const token = jwt.sign({ id: '1', role: 'admin' }, process.env.JWT_SECRET);
    const req = { header: (h) => (h === 'Authorization' ? `Bearer ${token}` : undefined) };
    const res = mockRes();
    let nextCalled = false;
    verifyToken(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
    expect(req.user.role).toBe('admin');
  });
});

describe('role guards', () => {
  test('isAdmin blocks non-admin users', () => {
    const req = { user: { role: 'student' } };
    const res = mockRes();
    let nextCalled = false;
    isAdmin(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(403);
    expect(nextCalled).toBe(false);
  });

  test('isAdmin allows admin users', () => {
    const req = { user: { role: 'admin' } };
    const res = mockRes();
    let nextCalled = false;
    isAdmin(req, res, () => { nextCalled = true; });
    expect(nextCalled).toBe(true);
  });

  test('isStudentOrParent allows students and parents', () => {
    for (const role of ['student', 'parent']) {
      const req = { user: { role } };
      const res = mockRes();
      let nextCalled = false;
      isStudentOrParent(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    }
  });

  test('isStudentOrParent blocks other roles', () => {
    const req = { user: { role: 'admin' } };
    const res = mockRes();
    let nextCalled = false;
    isStudentOrParent(req, res, () => { nextCalled = true; });
    expect(res.statusCode).toBe(403);
    expect(nextCalled).toBe(false);
  });
});
