const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User, OtpLog } = require('../../models');
const { sendMail } = require('../../utils/mail');

exports.showLogin = (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/admin/dashboard');
  }
  res.render('admin/auth/login', {
    layout: 'admin/layouts/auth',
    title: "Login",
    error: null,
  });
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ where: { email, role: 'admin', status: 'active' } });

    if (!user) {
      return res.status(401).render('admin/auth/login', {
        layout: 'admin/layouts/auth',
        error: 'Invalid credentials. Please Try again',
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).render('admin/auth/login', {
        layout: 'admin/layouts/auth',
        error: 'Invalid credentials',
      });
    }

    // Save to session
    req.session.userId = user.id;
    req.session.userRole = user.role;
    res.redirect('/admin/dashboard');
  } catch (err) {
    console.error(err);
    res.status(500).render('admin/auth/login', {
      layout: 'admin/layouts/auth',
      error: 'Internal server error',
    });
  }
};

exports.showForgetPassword = (req, res) => {
  res.render('admin/auth/forgot-password', {
    layout: 'admin/layouts/auth',
    title: "Forgot Password",
    error: null,
  });
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.render('admin/auth/forgot-password', {
        layout: 'admin/layouts/auth',
        error: 'Email not found',
      });
    }

    await OtpLog.create({ email, otp, expires_at });
    await sendMail(email, 'OTP Code', `<p>Your OTP is: <b>${otp}</b></p>`);

    res.redirect(`/admin/auth/otp?email=${email}`);
  } catch (err) {
    console.error(err);
    res.render('admin/auth/forgot-password', {
      layout: 'admin/layouts/auth',
      error: 'Failed to send OTP',
    });
  }
};

exports.showOtp = (req, res) => {
  res.render('admin/auth/otp', {
    layout: 'admin/layouts/auth',
    email: req.query.email,
    error: null,
  });
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
    return res.render('admin/auth/otp', {
      layout: 'admin/layouts/auth',
      error: 'Invalid or expired OTP',
      email,
    });
  }

  record.verified = true;
  await record.save();

  res.redirect(`/admin/auth/reset-password?email=${email}`);
};

exports.showReset = async (req, res) => {
  res.render('admin/auth/reset-password', {
    layout: 'admin/layouts/auth',
    email: req.query.email,
    error: null,
  });
};

exports.resetPassword = async (req, res) => {
  const { email, password, confirm } = req.body;

  if (!password || password !== confirm) {
    return res.render('admin/auth/reset-password', {
      layout: 'admin/layouts/auth',
      error: 'Passwords do not match',
      email,
    });
  }

  const hashed = await bcrypt.hash(password, 10);
  await User.update({ password: hashed }, { where: { email } });

  res.redirect('/admin/auth/login');
};

exports.logout = (req, res) => {
  req.session.destroy(() => res.redirect('/admin/auth/login'));
};
