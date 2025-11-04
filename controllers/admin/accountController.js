const { User } = require('../../models');
const bcrypt = require('bcrypt');

exports.showAccount = async (req, res) => {
  try {
    res.render('admin/dashboard/account', {
      layout: 'admin/layouts/index',
      title: "Account",
      error: null,
    });
  } catch (error) {
    console.error('Error in show Account', error);
  }
};

exports.updateProfile = async (req, res) => {
  const { fullName, email } = req.body;
  try {
    
    if (!fullName) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const user = await User.findOne({
      where: {
        email,
        role: 'admin',
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'User Not Found' });
    }

    await user.update({ name: fullName });
    return res.json({ success: true, message: 'Profile updated.' });
  } catch (error) {
    console.error('Error in update profile', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.changePassword = async (req, res) => {
  const { old_password, password, confirm } = req.body;
  const userId = res.locals.user.id;

  try {
    if (!old_password || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    if (password !== confirm) {
      return res.status(400).json({ error: 'Passwords do not match.', password: true });
    }

    const user = await User.findByPk(userId);

    if (!user) {
      return res.status(400).json({ error: 'User Not Found' });
    }

    const isPasswordValid = await bcrypt.compare(old_password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: 'Invalid Old Password' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await user.update({ password: hashedPassword, updated_at: new Date() });

    return res.json({ success: true, message: 'Password updated.' });
  } catch (error) {
    console.error('Error in change password', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};
