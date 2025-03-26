const jwt = require("jsonwebtoken")
const JWT_SECRET = process.env.JWT_TOKEN || 'default_secret'; // Ensure secret is set

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization

  if (authHeader) {
    const token = authHeader.split(" ")[1]

    // Verify the token using the JWT_SECRET
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        console.error("Token Verification Error:", err) // Debugging
        return res.status(401).json({ message: "Invalid token" })
      }
      req.userId = decoded.userId
      console.log("hi from verify token")
      next()
    })
  } else {
    return res.status(401).json({ message: "Authorization token required" })
  }
}

module.exports = verifyToken
