const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');

// FIX: Remove hardcoded fallback for JWT_SECRET. It must be set in environment.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('CRITICAL ERROR: JWT_SECRET environment variable is not set.');
  process.exit(1); // Exit if JWT secret is missing
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Helper function to generate JWT
const generateToken = (user) => {
  return jwt.sign(
    {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role_id: user.role_id,
      role_name: user.role_name, // Include role name for easier RBAC checks
      organization_id: user.organization_id // Include if user belongs to an organization
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

exports.register = async (req, res) => {
  const { username, email, password, organization_id } = req.body;

  // FIX: Add basic input validation
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'Username, email, and password are required.' });
  }
  if (username.length < 3 || username.length > 50) {
    return res.status(400).json({ message: 'Username must be between 3 and 50 characters.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: 'Invalid email format.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
  }

  try {
    // 1. Check if user already exists
    const existingUser = await query('SELECT user_id FROM users WHERE email = $1 OR username = $2', [email, username]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'User with that email or username already exists.' });
    }

    // 2. Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // 3. Determine role_id (default to 'Individual User' if not specified or for personal accounts)
    let roleId;
    if (organization_id) {
      // If an organization_id is provided, default to 'Employee' role for new registrations
      const employeeRole = await query("SELECT role_id FROM roles WHERE name = 'Employee'");
      if (employeeRole.rows.length === 0) {
        return res.status(500).json({ message: 'Employee role not found in database. Please configure roles.' });
      }
      roleId = employeeRole.rows[0].role_id;
    } else {
      // Default to 'Individual User' for personal accounts
      const individualRole = await query("SELECT role_id FROM roles WHERE name = 'Individual User'");
      if (individualRole.rows.length === 0) {
        return res.status(500).json({ message: 'Individual User role not found in database. Please configure roles.' });
      }
      roleId = individualRole.rows[0].role_id;
    }

    // 4. Insert new user
    const newUser = await query(
      'INSERT INTO users (username, email, password_hash, organization_id, role_id) VALUES ($1, $2, $3, $4, $5) RETURNING user_id, username, email, organization_id, role_id',
      [username, email, password_hash, organization_id, roleId]
    );

    // 5. Fetch role name for JWT payload
    const roleResult = await query('SELECT name FROM roles WHERE role_id = $1', [newUser.rows[0].role_id]);
    const role_name = roleResult.rows[0].name;

    // 6. Generate token
    const token = generateToken({ ...newUser.rows[0], role_name });

    res.status(201).json({
      message: 'User registered successfully.',
      token,
      user: {
        user_id: newUser.rows[0].user_id,
        username: newUser.rows[0].username,
        email: newUser.rows[0].email,
        role_name: role_name,
        organization_id: newUser.rows[0].organization_id
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration.', error: error.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  // FIX: Add basic input validation
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  try {
    // 1. Find user by email
    const userResult = await query(
      `SELECT u.user_id, u.username, u.email, u.password_hash, u.organization_id, u.role_id, r.name AS role_name
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.email = $1`,
      [email]
    );

    const user = userResult.rows[0];

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // 2. Compare passwords
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // 3. Generate token
    const token = generateToken(user);

    res.status(200).json({
      message: 'Logged in successfully.',
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        role_name: user.role_name,
        organization_id: user.organization_id
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.', error: error.message });
  }
};

exports.getMe = async (req, res) => {
  // req.user is populated by authenticateToken middleware
  // FIX: Ensure req.user exists before proceeding, though authenticateToken should handle this.
  if (!req.user || !req.user.user_id) {
    return res.status(401).json({ message: 'User not authenticated.' });
  }

  try {
    const userResult = await query(
      `SELECT u.user_id, u.username, u.email, u.organization_id, r.name AS role_name
       FROM users u
       JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id = $1`,
      [req.user.user_id]
    );

    const user = userResult.rows[0];

    if (!user) {
      // This case should ideally not happen if req.user.user_id is valid from a token
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      role_name: user.role_name,
      organization_id: user.organization_id
    });

  } catch (error) {
    console.error('Get user details error:', error);
    res.status(500).json({ message: 'Server error fetching user details.', error: error.message });
  }
};
