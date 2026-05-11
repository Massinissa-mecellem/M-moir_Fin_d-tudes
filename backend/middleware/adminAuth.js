const adminAuth = (req, res, next) => {
  if (req.auth && req.auth.role === 'admin') {
    next();
  } else {
    res.status(403).json({ 
      error: "Accès refusé. Droits d'administrateur requis." 
    });
  }
};

module.exports = adminAuth;
