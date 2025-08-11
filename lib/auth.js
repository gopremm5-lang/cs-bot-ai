function requireLogin(req, res, next) {
  if (req.session && req.session.isLoggedIn) return next();
  res.redirect('/login');
}

function requireRole(role) {
  return function(req, res, next) {
    if (req.session && req.session.role === role) return next();
    res.status(403).send('Forbidden');
  };
}

const requireOwner = requireRole('owner');
const requireAdmin = requireRole('admin');

module.exports = { requireLogin, requireRole, requireOwner, requireAdmin };
