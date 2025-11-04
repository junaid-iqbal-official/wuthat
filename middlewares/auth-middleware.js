'use strict';

module.exports = (req, res, next) => {
  if (req.session && req.session.userRole == "user") {
    next();
  } else {
    res.redirect("/login");
  }
};
