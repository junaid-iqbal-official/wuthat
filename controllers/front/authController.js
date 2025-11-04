const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User, UserSettings, OtpLog, CountryCode } = require('../../models');
const { sendMail } = require('../../utils/mail');

exports.showLogin = (req, res) => {
  res.render('front/auth/login', { layout: 'front/layouts/auth', title: 'Login', error: null });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await User.findOne({ where: { email, role: 'user'} });
    if (!user) {
      return res.status(401).render('front/auth/login', {
        layout: 'front/layouts/auth',
        error: 'Invalid credentials'
      });
    }

    // Check if account is deactivated
    if (user.status === 'deactive') {
      return res.status(403).render('front/auth/login', {
        layout: 'front/layouts/auth',
        error: 'Your account is currently inactive. Please contact our support team..'
      });
    }

    // Check if account is deleted
    const deleted = await UserSettings.findOne({
      where: {
        user_id:user.id, 
        delete_requested:{
          [Op.eq] : 'approved'
        }
      }
    });
    
    if(deleted){
      return res.status(401).render('front/auth/login', {
        layout: 'front/layouts/auth',
        error: 'Your Account has been deleted.'
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).render('front/auth/login', {
        layout: 'front/layouts/auth',
        error: 'Invalid credentials'
      });
    }

    req.session.userId = user.id;
    req.session.userRole = user.role;

    res.redirect('/messenger');

  } catch (err) {
    res.status(500).render('front/auth/login', {
      layout: 'front/layouts/auth',
      error: 'Internal server error'
    });
  }
};

exports.showRegister = async (req, res) => {
  try {
    // Fetch all country codes for the dropdown
    const countryCodes = await CountryCode.findAll({
      order: [['country', 'ASC']]
    });

    res.render('front/auth/register', {
      layout: 'front/layouts/auth',
      title: 'Register',
      old: null,
      error: null,
      countryCodes: countryCodes
    });
  } catch (err) {
    res.render('front/auth/register', {
      layout: 'front/layouts/auth',
      title: 'Register',
      old: null,
      error: 'Failed to load registration form',
      countryCodes: []
    });
  }
};

exports.register = async (req, res) => {
  const { username, name, email, phone, countryCode, password, confirm_password } = req.body;

  try {
    // Fetch country codes for re-rendering in case of error
    const countryCodes = await CountryCode.findAll({
      order: [['country', 'ASC']]
    });

    // Validation helper function
    const renderError = (errorMessage) => {
      return res.render('front/auth/register', {
        layout: 'front/layouts/auth',
        error: errorMessage,
        old: { username, name, email, phone, countryCode },
        countryCodes: countryCodes
      });
    };

    if (!username || !name || !email || !phone || !countryCode || !password) {
      return renderError('All fields are required');
    }

    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return renderError('Username must be 3-20 characters long and contain only letters, numbers, and underscores');
    }

    const nameRegex = /^[a-zA-Z\s]{2,50}$/;
    if (!nameRegex.test(name.trim())) {
      return renderError('Name must be 2-50 characters long and contain only letters and spaces');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return renderError('Please enter a valid email address');
    }

    const normalizedEmail = email.toLowerCase().trim();

    const phoneRegex = /^\d{7,15}$/;
    if (!phoneRegex.test(phone)) {
      return renderError('Phone number must be 7-15 digits');
    }

    if (password.length < 8) {
      return renderError('Password must be at least 8 characters long');
    }

    if(password !== confirm_password){
      return renderError('Password and confirm password must be same');
    }

    const validCountryCode = await CountryCode.findOne({ where: { code: countryCode } });
    if (!validCountryCode) {
      return renderError('Invalid country code selected');
    }

    const existingEmail = await User.findOne({
      where: { email: normalizedEmail, role: 'user' }
    });
    if (existingEmail) {
      return renderError('Email already registered');
    }

    const existingUsername = await User.findOne({
      where: {
        username: username.toLowerCase(),
        role: 'user'
      }
    });
    if (existingUsername) {
      return renderError('Username already taken');
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Create user with additional fields
    const user = await User.create({
      username: username.toLowerCase(),
      name: name.trim(),
      email: normalizedEmail,
      country_code: countryCode,
      phone: phone,
      password: hashed
    });

    await UserSettings.create({ user_id: user.id });

    res.redirect('/login');

  } catch (err) {
    console.error('Registration error:', err);

    // Fetch country codes for re-rendering
    let countryCodes = [];
    try {
      countryCodes = await CountryCode.findAll({ order: [['country', 'ASC']] });
    } catch (fetchErr) {
      console.error('Error fetching country codes:', fetchErr);
    }

    res.render('front/auth/register', {
      layout: 'front/layouts/auth',
      error: 'Something went wrong. Please try again.',
      old: { username, name, email, phone, countryCode },
      countryCodes: countryCodes
    });
  }
};

exports.showForgetPassword = (req, res) => {
  res.render('front/auth/forgot-password', { layout: 'front/layouts/auth', title: 'Forgot Password', error: null });
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.render('front/auth/forgot-password', {
        layout: 'front/layouts/auth',
        error: 'Email not found',
      });
    }

    await OtpLog.create({ email, otp, expires_at });
    await sendMail(email, 'OTP Code', `<p>Your OTP is: <b>${otp}</b></p>`);

    res.redirect(`/otp?email=${email}`);
  } catch (err) {
    console.error(err);
    res.render('front/auth/forgot-password', {
      layout: 'front/layouts/auth',
      error: 'Failed to send OTP',
    });
  }
};

exports.showOtp = (req, res) => {
  res.render('front/auth/otp', { layout: 'front/layouts/auth', title: "One Time Password", error: null, email: req.query.email });
};

exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  const record = await OtpLog.findOne({
    where: {
      email,
      otp,
      verified: false,
      expires_at: { [Op.gt]: new Date() },
    },
    order: [['created_at', 'DESC']],
  });

  if (!record) {
    return res.render('front/auth/otp', {
      layout: 'front/layouts/auth',
      error: 'Invalid or expired OTP',
      email,
    });
  }

  record.verified = true;
  await record.save();

  res.redirect(`/reset-password?email=${email}`);
};

exports.showReset = (req, res) => {
  res.render('front/auth/reset-password', {
    layout: 'front/layouts/auth',
    error: null,
    email: req.query.email,
  });
};

exports.resetPassword = async (req, res) => {
  const { email, password, confirm } = req.body;

  if (!password || password !== confirm) {
    return res.render('front/auth/reset-password', {
      layout: 'front/layouts/auth',
      error: 'Passwords do not match',
      email,
    });
  }

  const hashed = await bcrypt.hash(password, 10);
  await User.update({ password: hashed }, { where: { email } });

  res.redirect('/login');
};

exports.logout = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout Error:', err);
      return res.redirect('/messenger');
    }
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
};
