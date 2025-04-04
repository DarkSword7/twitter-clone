import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt; // Get the token from cookies
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // Decode the token to get the user ID
    const decoded = jwt.verify(token, process.env.JWT_SECRET); // Verify the token
    if (!decoded) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    // Find the user by ID and exclude the password field
    const user = await User.findById(decoded.userId).select("-password"); // Find the user by ID and exclude the password field
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    req.user = user; // Attach the user to the request object
    next(); // Call the next middleware or route handler
  } catch (error) {
    console.error("Error during token verification:", error.message);
    res.status(401).json({ message: "Unauthorized" });
  }
};
