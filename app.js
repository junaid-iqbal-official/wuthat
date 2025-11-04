'use strict';
const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const sass = require('sass');
const fs = require('fs');

dotenv.config();

const app = express();
let installWizard = null;

module.exports = (async () => {

  // Load models (may be empty if no DB)
  const { sequelize, User, Setting } = require('./models');

  // Default settings to use when no database
  let settings = [];
  let systemSettings = {
    session_timeout_minutes: 30,
    app_name: process.env.APP_NAME || 'My App',
    default_mode: 'light',
    is_maintenance_mode: 'false',
    maintenance_msg: 'We will be back soon!'
  };

  // Try to connect and load settings if database is available
  if (sequelize) {
    try {
      await sequelize.authenticate();
      await sequelize.sync();
      console.log('✅ Database connected successfully');

      if (Setting) {
        settings = await Setting.findAll();
        systemSettings = settings.reduce((acc, item) => {
          acc[item.key] = item.value;
          return acc;
        }, systemSettings);
        console.log('✅ Settings loaded from database');
      }
    } catch (error) {
      console.warn('⚠️ Database connection failed:', error.message);
      console.warn('⚠️ Running with default settings - you can configure database via /install');
    }
  } else {
    console.warn('⚠️ No database configuration - please visit /install to set up');
  }

  // Compile SCSS to CSS
  try {
    const scssPath = path.join(__dirname, 'public/assets/front/scss/style.scss');
    if (fs.existsSync(scssPath)) {
      const result = sass.compile(scssPath);
      fs.writeFileSync(path.join(__dirname, 'public/assets/front/css/style.css'), result.css);
      console.log('✅ SCSS compiled successfully');
    }
  } catch (error) {
    console.warn('⚠️ Could not compile SCSS:', error.message);
  }

  // Session Timeout
  const timeoutMinutes = parseInt(systemSettings.session_timeout_minutes) || 30;
  const timeoutMs = timeoutMinutes * 60 * 1000;

  // ----------------- Session Setup -----------------
  let sessionConfig = {
    secret: process.env.SESSION_SECRET || '@123456',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      maxAge: timeoutMs,
      httpOnly: true,
    }
  };

  if (sequelize) {
    try {
      const SequelizeStore = require('connect-session-sequelize')(session.Store);
      const sessionStore = new SequelizeStore({
        db: sequelize,
        tableName: 'sessions',
        checkExpirationInterval: 15 * 60 * 1000,
        expiration: timeoutMs,
      });
      await sessionStore.sync();
      sessionConfig.store = sessionStore;
      console.log('✅ Using database session store');
    } catch (error) {
      console.warn('⚠️ Could not initialize database session store, using memory store');
    }
  } else {
    console.warn('⚠️ Using memory session store (sessions will not persist)');
  }

  app.use(session(sessionConfig));

  // ----------------- View & Assets -----------------
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'views'));
  app.use(expressLayouts);
  app.set('layout', 'layouts/main');

  app.use(express.static(path.join(__dirname, 'public')));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.locals.routeIs = (name) => app.locals.currentRouteName === name;

  app.use((req, res, next) => {
    const oldSnapshot = Object.assign({}, req.session._old || {});
    const errorsSnapshot = Object.assign({}, req.session._errors || {});
    res.locals.session = req.session;
    res.locals.errors = errorsSnapshot;
    res.locals.old = (key, fallback = '') => {
      if (!key) return fallback;
      const parts = key.split('.');
      let cur = oldSnapshot;
      for (const p of parts) {
        if (cur && Object.prototype.hasOwnProperty.call(cur, p)) {
          cur = cur[p];
        } else {
          return fallback;
        }
      }
      return cur ?? fallback;
    };
    req.session._old = {};
    req.session._errors = {};
    next();
  });

  // ----------------- Install Wizard Setup -----------------
  // ALWAYS initialize the install wizard (it handles database setup)
  try {
    const { InstallWizard, checkUserModelCompatibility } = require('./index.js');

    installWizard = new InstallWizard({ mountPath: '/install' });

    // Only check user model compatibility if we have database and User model
    if (User && sequelize) {
      try {
        const userModelCompatibility = await checkUserModelCompatibility(User);

        if (userModelCompatibility.compatible) {
          installWizard.setExistingUserModel(User);
          console.log('✅ Will sync with existing User model during installation');
        } else {
          console.log('⚠️ User model compatibility issues:', userModelCompatibility.reason);
        }
      } catch (error) {
        console.warn('⚠️ Could not check user model compatibility:', error.message);
      }
    }

    installWizard.mount(app);
    app.locals.installWizard = installWizard;
    console.log('✅ Installation wizard mounted at /install');
  } catch (error) {
    console.error('❌ Could not initialize install wizard:', error.message);
    console.error(error.stack);
  }

  // ----------------- Check Installation Status -----------------
  app.use(async (req, res, next) => {
    // Always allow these paths
    if (
      req.path.startsWith('/install') ||
      req.path.startsWith('/public') ||
      req.path.startsWith('/assets') ||
      req.path === '/favicon.ico'
    ) {
      return next();
    }

    // Check if installation is complete
    if (installWizard) {
      try {
        const isInstalled = await installWizard.isInstalled();
        if (!isInstalled) {
          console.log('⚠️ Installation not complete, redirecting to /install');
          return res.redirect('/install');
        }
      } catch (error) {
        // If we can't check installation status, redirect to install
        console.warn('⚠️ Could not check installation status:', error.message);
        return res.redirect('/install');
      }
    } else {
      // No install wizard, but no database either - redirect to install
      if (!sequelize) {
        console.warn('⚠️ No database connection, redirecting to /install');
        return res.redirect('/install');
      }
    }

    next();
  });

  // ... rest of your middleware and routes ...


  // ----------------- Global Variables -----------------
  const ASSETS_PATH = process.env.ASSETS_PATH || '';

  function formatDateLabel(date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const messageDate = new Date(date);

    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const yesterdayDate = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
    const msgDate = new Date(messageDate.getFullYear(), messageDate.getMonth(), messageDate.getDate());

    if (msgDate.getTime() === todayDate.getTime()) {
      return 'Today';
    } else if (msgDate.getTime() === yesterdayDate.getTime()) {
      return 'Yesterday';
    } else {
      const daysDiff = Math.floor((todayDate - msgDate) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 6 && daysDiff > 1) {
        return messageDate.toLocaleDateString('en-US', { weekday: 'long' });
      } else {
        return messageDate.toLocaleDateString('en-US', {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        });
      }
    }
  }

  // ----------------- Middleware: res.locals -----------------
  app.use(async (req, res, next) => {
    res.locals.assetPath = ASSETS_PATH;
    res.locals.title = systemSettings.app_name || 'My App';

    if (req.session && req.session.userId) {
      try {
        const user = await User.findByPk(req.session.userId, {
          attributes: ['id', 'name', 'avatar', 'email', 'role', 'bio'],
          raw: true
        });
        res.locals.user = user;
        res.locals.currentUserId = user.id;
      } catch (err) {
        console.error('Error loading user:', err);
        res.locals.user = null;
      }
    } else {
      res.locals.user = null;
    }

    res.locals.formatDateLabel = formatDateLabel;
    next();
  });

  // ----------------- Middleware: Layout Resolver -----------------
  app.use((req, res, next) => {
    if (req.path.startsWith('/login') || req.path.startsWith('/register')) {
      res.locals.layout = 'layouts/auth';
    } else if (req.path.startsWith('/admin')) {
      res.locals.layout = 'layouts/admin';
    } else {
      res.locals.layout = 'layouts/main';
    }
    next();
  });

  // ----------------- Middleware: Logo & System Settings ---------------
  app.use((req, res, next) => {
    const isSetting = settings
      .filter(item =>
        ['favicon_logo', 'app_logo', 'dark_logo', 'big_logo', 'white_logo'].includes(item.key)
      )
      .reduce((acc, item) => {
        acc[item.key] = item.value;
        return acc;
      }, {});

    res.locals.logoSettings = isSetting || null;
    res.locals.systemSetting = systemSettings;
    res.locals.default_mode = systemSettings.default_mode;
    res.locals.app_name = systemSettings.app_name || process.env.APP_NAME;
    next();
  });

  // ----------------- Middleware: Check Maintenance mode -----------------
  app.use(async (req, res, next) => {
    // Allow static assets and admin auth routes to bypass maintenance
    const bypassPaths = [
      /^\/public/,         // Static files
      /^\/assets/,         // Assets if served from this path
      /^\/admin/,    // Admin login and auth
      /^\/favicon.ico$/,   // Favicon
    ];

    const shouldBypass = bypassPaths.some((pattern) => pattern.test(req.path));

    try {
      const setting = await Setting.findOne({ where: { key: 'is_maintenance_mode' } });
      const isMaintenance = setting && setting.value === 'true';

      if (isMaintenance && !shouldBypass) {
        return res.status(503).render('front/maintenance', {
          layout: false,
          systemSetting: {
            maintenance_msg: systemSettings.maintenance_msg || 'We’ll be back soon!',
          },
        });
      }
    } catch (err) {
      console.error('Error checking maintenance mode:', err);
    }

    next();
  });

  // Routes
  app.use('/', require('./routes/front/auth'));
  app.use('/', require('./routes/front/messenger'));
  app.use('/', require('./routes/front/chat-action'));
  app.use('/user', require('./routes/front/user'));
  app.use('/call', require('./routes/front/call'));
  app.use('/notification', require('./routes/front/notification'));
  app.use('/friend', require('./routes/front/friend'));
  app.use('/admin', require('./routes/admin/dashboard'));
  app.use('/admin/auth', require('./routes/admin/auth'));
  app.use('/admin/account', require('./routes/admin/account'));
  app.use('/admin/user', require('./routes/admin/user'));
  app.use('/admin/setting', require('./routes/admin/setting'));
  app.use('/admin/faq', require('./routes/admin/faq'));
  app.use('/admin/page', require('./routes/admin/page'));
  app.use('/admin/wallpaper', require('./routes/admin/wallpaper'));
  app.use('/admin/sticker', require('./routes/admin/sticker'));
  app.use('/admin/contact', require('./routes/admin/contact'));
  app.use('/admin/deleted-accounts', require('./routes/admin/deleted-accounts'));
  app.use('/admin/account-report', require('./routes/admin/report'));
  app.use('/admin/report', require('./routes/admin/report-setting'));

  app.get("/404", (req, res) => {
    res.status(404).render("front/error", { layout: false });
  });

  app.use((req, res) => {
    res.status(404).render('front/error', {
      layout: false
    });
  });

  return app;
})();