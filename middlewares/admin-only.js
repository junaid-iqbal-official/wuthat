'use strict';

module.exports = (req, res, next) => {
  if (req.session && req.session.userRole == "admin") {
    next();
  } else if (req.session && req.session.userRole == "user") {
    res.redirect("/messenger");
  } else {
    res.redirect("/admin/auth/login");
  }
};