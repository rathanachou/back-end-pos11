const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.header("Authorization");

    // ❌ No header
    if (!authHeader) {
      return res.status(401).json({
        message: "Access denied. Unauthorized",
      });
    }

    // ❌ Format check
    const parts = authHeader.split(" ");
    if (parts.length !== 2) {
      return res.status(401).json({
        message: "Invalid token format",
      });
    }

    const token = parts[1];
    console.log("Incoming Token", token);

    // ❌ Verify token
    const decoded = jwt.verify(token, "sala-express");

    // ✅ Save user info
    req.user = decoded;

    // ✅ Continue
    return next();
  } catch (error) {
    console.log("ERROR: ", error);

    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

module.exports = authMiddleware;