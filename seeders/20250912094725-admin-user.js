'use strict';

const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const adminEmail = process.env.ADMIN_EMAIL;

    // Check if admin already exists
    const [admin] = await queryInterface.sequelize.query(
      `SELECT id FROM users WHERE email = :email LIMIT 1;`,
      {
        replacements: { email: adminEmail },
        type: Sequelize.QueryTypes.SELECT
      }
    );

    if (!admin) {
      const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

      await queryInterface.bulkInsert('users', [
        {
          name: process.env.ADMIN_NAME || 'Admin',
          email: adminEmail,
          username: 'admin',
          password: hashedPassword,
          role: 'admin',
          email_verified: true,
          created_at: new Date(),
          updated_at: new Date()
        }
      ]);

      console.log('✅ Admin inserted via seeder!');
    } else {
      console.log('ℹ️ Admin already exists, skipping insert.');
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('users', { email: process.env.ADMIN_EMAIL }, {});
  }
};
