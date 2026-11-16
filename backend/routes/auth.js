import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import nodemailer from 'nodemailer';
import {
  validateRegister,
  validateLogin,
  validateEmail,
  validatePasswordReset
} from '../middleware/validation.js';

const router = express.Router();

const BCRYPT_ROUNDS = 12;
// Tokens are emailed in plain form but only their SHA-256 digest is stored,
// so a database leak does not expose usable reset/verification links.
const hashToken = (value) => crypto.createHash('sha256').update(value).digest('hex');
const isValidToken = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const serverError = (res, error) => {
  console.error(error);
  return res.status(500).json({ success: false, error: 'Internal server error' });
};

// Create transporter for sending emails
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn('Email credentials not configured');
    return null;
  }
  
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    connectionTimeout: 2000,
    greetingTimeout: 2000,
    socketTimeout: 3000,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Register new user
router.post('/register', validateRegister, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username, email, and password are required' 
      });
    }

    // Validate password strength (min 8 characters)
    if (password.length < 8) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 8 characters long' 
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        error: 'User with this email already exists' 
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create new user
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      // Public registration can never choose a privileged role.
      role: 'guest',
      isVerified: false,
      verificationToken: hashToken(verificationToken)
    });

    // Send verification email
    const transporter = createTransporter();
    if (transporter) {
      try {
        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Verify Your Email - Dharul Uloom Kashiful Hudha',
          html: `
            <h2>Welcome to Dharul Uloom Kashiful Hudha Arabic College!</h2>
            <p>Thank you for registering. Please verify your email by clicking the link below:</p>
            <a href="${verificationUrl}">${verificationUrl}</a>
            <p>This link will expire in 24 hours.</p>
          `
        });
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully. Please check your email for verification.',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified
        },
        token
      }
    });
  } catch (error) {
    serverError(res, error);
  }
});

// Login user
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email and password are required' 
      });
    }

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid email or password' 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified
        },
        token
      }
    });
  } catch (error) {
    serverError(res, error);
  }
});

// Verify email
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!isValidToken(token)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid or expired verification token' 
      });
    }

    const user = await User.findOne({ verificationToken: hashToken(token) });
    if (!user) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid or expired verification token' 
      });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    serverError(res, error);
  }
});

// Forgot password
router.post('/forgot-password', validateEmail, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email is required' 
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if email exists
      return res.json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = Date.now() + 3600000; // 1 hour

    user.resetPasswordToken = hashToken(resetToken);
    user.resetPasswordExpiry = resetTokenExpiry;
    await user.save();

    // Send reset email
    const transporter = createTransporter();
    if (transporter) {
      try {
        const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email,
          subject: 'Password Reset - Dharul Uloom Kashiful Hudha',
          html: `
            <h2>Password Reset Request</h2>
            <p>You requested to reset your password. Click the link below to reset it:</p>
            <a href="${resetUrl}">${resetUrl}</a>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this, please ignore this email.</p>
          `
        });
      } catch (emailError) {
        console.error('Email sending failed:', emailError);
      }
    }

    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });
  } catch (error) {
    serverError(res, error);
  }
});

// Reset password
router.post('/reset-password', validatePasswordReset, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!isValidToken(token) || typeof password !== 'string') {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid or expired reset token' 
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ 
        success: false, 
        error: 'Password must be at least 8 characters long' 
      });
    }

    const user = await User.findOne({
      resetPasswordToken: hashToken(token),
      resetPasswordExpiry: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid or expired reset token' 
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    const hashedPassword = await bcrypt.hash(password, salt);

    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiry = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    serverError(res, error);
  }
});

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

export default router;
