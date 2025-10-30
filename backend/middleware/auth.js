import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({ success: false, error: 'Invalid token.' });
  }
};

export const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Access denied. Admin only.' });
  }
  next();
};

export const isStudentOrParent = (req, res, next) => {
  if (!['student', 'parent'].includes(req.user.role)) {
    return res.status(403).json({ success: false, error: 'Access denied.' });
  }
  next();
};
