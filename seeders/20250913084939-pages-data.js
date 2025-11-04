'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const pagesData = [
      {
        id: 1,
        title: 'Privacy Policy',
        slug: 'privacy-policy',
        content: `
          <h2>Privacy Policy</h2>
          <p>At <strong>App Name</strong>, your privacy is very important to us. This Privacy Policy explains how we collect, use, and protect your information when you use our services.</p>
          
          <h3>Information We Collect</h3>
          <ul>
            <li>Personal details such as name, email address, and phone number.</li>
            <li>Usage data such as login times, interactions, and preferences.</li>
            <li>Device and network information to improve security and performance.</li>
          </ul>
          
          <h3>How We Use Your Information</h3>
          <p>We use your information to:</p>
          <ul>
            <li>Provide and maintain the <strong>App Name</strong> services.</li>
            <li>Improve user experience and enhance features.</li>
            <li>Communicate important updates, notifications, or promotional offers.</li>
            <li>Ensure safety and prevent fraudulent activities.</li>
          </ul>
          
          <h3>Data Security</h3>
          <p>We implement strict technical and organizational measures to protect your information. However, please note that no transmission over the internet is 100% secure.</p>
          
          <h3>Contact Us</h3>
          <p>If you have any questions regarding this Privacy Policy, you may contact us at <a href="mailto:support@appname.com">support@appname.com</a>.</p>
        `,
        meta_title: 'Privacy Policy - App Name',
        meta_description: 'Read the Privacy Policy of App Name to understand how we handle your personal information.',
        status: 1,
        created_by: 1,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null
      },
      {
        id: 2,
        title: 'Terms & Conditions',
        slug: 'terms-and-conditions',
        content: `
          <h2>Terms & Conditions</h2>
          <p>Welcome to <strong>App Name</strong>. By using our application and services, you agree to comply with and be bound by the following terms and conditions.</p>
          
          <h3>Use of Service</h3>
          <ul>
            <li>You must be at least 18 years old to use <strong>App Name</strong>.</li>
            <li>You agree not to use the service for unlawful purposes.</li>
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
          </ul>
          
          <h3>Prohibited Activities</h3>
          <ul>
            <li>Spamming, fraud, or abusive behavior.</li>
            <li>Sharing harmful, illegal, or offensive content.</li>
            <li>Attempting to hack, disrupt, or misuse the platform.</li>
          </ul>
          
          <h3>Limitation of Liability</h3>
          <p><strong>App Name</strong> is not responsible for any damages, data loss, or issues arising from misuse of the platform.</p>
          
          <h3>Changes to Terms</h3>
          <p>We reserve the right to update or modify these Terms & Conditions at any time without prior notice. Continued use of the service means you accept the changes.</p>
          
          <h3>Contact Us</h3>
          <p>If you have any questions about these Terms & Conditions, please reach out at <a href="mailto:support@appname.com">support@appname.com</a>.</p>
        `,
        meta_title: 'Terms & Conditions - App Name',
        meta_description: 'Read the Terms & Conditions of App Name before using our services.',
        status: 1,
        created_by: 1,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null
      }
    ];

    await queryInterface.bulkInsert('pages', pagesData, {});
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('pages', null, {});
  }
};
