const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const authService = require('../services/auth');
const mfaService = require('../services/mfa');
const auditService = require('../services/audit');
const { authenticate } = require('../middleware/auth');
const { User, PasswordResetToken } = require('../db/models');

// Register endpoint
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password')
      .isLength({ min: 12 })
      .withMessage('Password must be at least 12 characters'),
    body('display_name').optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await auditService.logFailure(
          req,
          'register_validation_failed',
          JSON.stringify(errors.array())
        );
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, display_name } = req.body;
      const ownerEmail = process.env.SUPER_ADMIN_OWNER_EMAIL || 'willem.hattingh@haloitservices365.co.za';

      if (!authService.validatePassword(password)) {
        await auditService.logFailure(
          req,
          'register_weak_password',
          'Password does not meet complexity requirements'
        );
        return res.status(400).json({
          error:
            'Password must include uppercase, lowercase, numbers, and special characters',
        });
      }

      let roleId = null;
      if (email.toLowerCase() === ownerEmail.toLowerCase()) {
        const superAdminRole = await Role.findOne({ where: { name: 'super_admin' } });
        roleId = superAdminRole ? superAdminRole.id : 1;
      }

      const user = await authService.register(email, password, display_name, roleId);

      await auditService.log(req, 'user_registered', 'users', user.id);

      const token = authService.generateToken(user);
      const refreshToken = authService.generateRefreshToken(user);

      res.status(201).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          role: user.Role?.name,
        },
        token,
        refreshToken,
      });
    } catch (error) {
      await auditService.logFailure(
        req,
        'register_error',
        error.message
      );
      res.status(400).json({ error: error.message });
    }
  }
);

// Login endpoint
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        await auditService.logFailure(
          req,
          'login_validation_failed',
          JSON.stringify(errors.array())
        );
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      const user = await authService.login(email, password);
      const userWithPermissions = await authService.getUserWithPermissions(user.id);

      await auditService.log(req, 'user_login', 'users', user.id);

      const token = authService.generateToken(user);
      const refreshToken = authService.generateRefreshToken(user);

      res.json({
        success: true,
        user: {
          id: userWithPermissions.id,
          email: userWithPermissions.email,
          display_name: userWithPermissions.display_name,
          role: userWithPermissions.role,
          permissions: userWithPermissions.permissions,
          mfa_enabled: userWithPermissions.mfa_enabled,
          mfa_verified: userWithPermissions.mfa_verified,
          status: userWithPermissions.status,
        },
        token,
        refreshToken,
        requiresMFA: userWithPermissions.mfa_enabled && !userWithPermissions.mfa_verified,
      });
    } catch (error) {
      await auditService.logFailure(req, 'login_failed', error.message);
      res.status(401).json({ error: error.message });
    }
  }
);

// Logout endpoint
router.post('/logout', authenticate, async (req, res) => {
  try {
    await auditService.log(req, 'user_logout', 'users', req.user.id);

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Current profile endpoint
router.get('/profile', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        display_name: req.user.display_name,
        role: req.user.role,
        permissions: req.user.permissions,
        mfa_enabled: req.user.mfa_enabled,
        mfa_verified: req.user.mfa_verified,
        status: req.user.status,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Verify MFA endpoint
router.post(
  '/verify-mfa',
  [body('token').isLength({ min: 6, max: 6 }).isNumeric()],
  authenticate,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token } = req.body;
      const user = await User.findByPk(req.user.id);

      if (!user.mfa_enabled || !user.mfa_secret) {
        return res.status(400).json({ error: 'MFA not enabled for this user' });
      }

      const isValid = mfaService.verifyToken(user.mfa_secret, token);
      if (!isValid) {
        // Try backup code
        try {
          await mfaService.verifyBackupCode(req.user.id, token);
        } catch {
          await auditService.logFailure(
            req,
            'mfa_verification_failed',
            'Invalid TOTP token'
          );
          return res.status(401).json({ error: 'Invalid TOTP token or backup code' });
        }
      }

      await auditService.log(req, 'mfa_verified', 'users', user.id);

      const newToken = authService.generateToken(user);

      res.json({
        success: true,
        token: newToken,
        message: 'MFA verification successful',
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Refresh token endpoint
router.post('/refresh', [body('refreshToken').notEmpty()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { refreshToken } = req.body;
    const decoded = authService.verifyToken(refreshToken);

    if (!decoded || decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const user = await User.findByPk(decoded.id, { include: 'Role' });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const newToken = authService.generateToken(user);

    res.json({
      success: true,
      token: newToken,
    });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// Request password recovery
router.post(
  '/forgot-password',
  [body('email').isEmail().normalizeEmail()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email } = req.body;
      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.json({
          success: true,
          message: 'If that account exists, a recovery token has been generated.',
        });
      }

      const token = crypto.randomBytes(24).toString('hex');
      await PasswordResetToken.create({
        user_id: user.id,
        token,
        expires_at: new Date(Date.now() + 1000 * 60 * 30),
      });

      await auditService.log(req, 'password_reset_requested', 'users', user.id);

      const payload = {
        success: true,
        message: 'If that account exists, a recovery token has been generated.',
      };

      if (process.env.NODE_ENV !== 'production') {
        payload.resetToken = token;
      }

      res.json(payload);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Reset password
router.post(
  '/reset-password',
  [
    body('token').notEmpty(),
    body('password').isLength({ min: 12 }).withMessage('Password must be at least 12 characters'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { token, password } = req.body;
      if (!authService.validatePassword(password)) {
        return res.status(400).json({
          error: 'Password must include uppercase, lowercase, numbers, and special characters',
        });
      }

      const resetToken = await PasswordResetToken.findOne({
        where: { token, used: false, expires_at: { [require('sequelize').Op.gt]: new Date() } },
      });

      if (!resetToken) {
        return res.status(400).json({ error: 'Invalid or expired recovery token' });
      }

      const user = await User.findByPk(resetToken.user_id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      user.setPassword(password);
      await user.save();
      resetToken.used = true;
      await resetToken.save();

      await auditService.log(req, 'password_reset_completed', 'users', user.id);

      res.json({ success: true, message: 'Password reset successful' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
