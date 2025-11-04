'use strict';

module.exports = (req, res, next) => {
  if (req.session) {
    if (req.session.userRole == "admin" && req.session.userId) {
      return res.redirect('/admin/dashboard');
    } else if (req.session.userRole == "user" && req.session.userId) {
      return res.redirect('/messenger');
    }
  }
  next();
};
