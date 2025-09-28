// Add this middleware function
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

const requireRole = (roles) => {
  return async (req, res, next) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId }
    });
    
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Then protect your endpoints:
app.get('/api/schools', authenticateToken, requireRole(['director']), async (req, res) => {
  // existing code
});