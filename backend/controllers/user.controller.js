import bcrypt from "bcryptjs";
import { v2 as cloudinary } from "cloudinary"; // Importing Cloudinary for image upload

// Models
import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";

export const getUserProfile = async (req, res) => {
  const { username } = req.params;

  try {
    const user = await User.findOne({ username }).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });

    res.status(200).json({ user });
  } catch (error) {
    console.error("Error fetching user profile:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

export const followUnfollowUser = async (req, res) => {
  try {
    const { id } = req.params;
    const userToModify = await User.findById(id);
    const currentUser = await User.findById(req.user._id);

    if (id === req.user._id.toString()) {
      return res
        .status(400)
        .json({ error: "You cannot follow/unfollow yourself." });
    }
    if (!userToModify || !currentUser) {
      return res.status(404).json({ error: "User not found" });
    }
    // Check if the user is already followed
    const isFollowing = currentUser.following.includes(id);

    if (isFollowing) {
      // Unfollow the user
      await User.findByIdAndUpdate(id, { $pull: { followers: req.user._id } }); // Remove the current user from the followers of the user being unfollowed
      await User.findByIdAndUpdate(req.user._id, { $pull: { following: id } }); // Remove the user being unfollowed from the current user's following list
      // TODO: return the id of the user as a response
      res.status(200).json({ message: "Unfollowed successfully" });
    } else {
      // Follow the user
      await User.findByIdAndUpdate(id, { $push: { followers: req.user._id } }); // Add the current user to the followers of the user being followed
      await User.findByIdAndUpdate(req.user._id, { $push: { following: id } }); // Add the user being followed to the current user's following list
      // Send a notification to the followed user
      const newNotification = new Notification({
        from: req.user._id,
        to: userToModify._id,
        type: "follow",
      });
      await newNotification.save();

      // TODO: Send the id of the user as a response
      res.status(200).json({ message: "Followed successfully" });
    }
  } catch (error) {
    console.error("Error following/unfollowing user:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

export const getSuggestedUsers = async (req, res) => {
  try {
    const userId = req.user._id; // Get the current user's ID from the request

    const usersFollowedByMe = await User.findById(userId).select("following"); // Get the list of users followed by the current user

    const users = await User.aggregate([
      {
        $match: {
          _id: { $ne: userId }, // Exclude the current user from the suggestions
        },
      },
      { $sample: { size: 10 } }, // Randomly select 10 users
    ]);

    // Exclude users that are already followed by the current user
    const filteredUsers = users.filter(
      (user) => !usersFollowedByMe.following.includes(user._id.toString())
    );

    const suggestedUsers = filteredUsers.slice(0, 4); // Limit to 4 suggested users
    suggestedUsers.forEach((user) => (user.password = null)); // Remove password field from suggested users

    res.status(200).json(suggestedUsers);
  } catch (error) {
    console.error("Error fetching suggested users:", error.message);
    return res.status(500).json({ error: error.message });
  }
};

export const updateUser = async (req, res) => {
  const { fullName, email, username, bio, link, currendPassword, newPassword } =
    req.body;
  let { profileImg, coverImg } = req.body;

  const userId = req.user._id; // Get the current user's ID from the request

  try {
    let user = await User.findById(userId); // Find the user by ID
    if (!user) return res.status(404).json({ error: "User not found" });

    if (
      (!newPassword && currendPassword) ||
      (!currendPassword && newPassword)
    ) {
      return res
        .status(400)
        .json({ error: "Please provide both current and new password" });
    }

    if (currendPassword && newPassword) {
      const isPasswordMatch = await bcrypt.compare(
        currendPassword,
        user.password
      ); // Check if the current password matches the stored password
      if (!isPasswordMatch) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }
      if (newPassword.length < 6) {
        return res
          .status(400)
          .json({ error: "Password must be at least 6 characters" });
      }

      const salt = await bcrypt.genSalt(10); // Generate a salt for hashing
      const hashedPassword = await bcrypt.hash(newPassword, salt); // Hash the new password
      user.password = hashedPassword; // Update the user's password
    }

    if (profileImg) {
      // Check if the user already has a profile image
      if (user.profileImg) {
        await cloudinary.uploader.destroy(
          user.profileImg.split("/").pop().split(".")[0]
        ); // Delete the old profile image from Cloudinary
      }
      const uploadedResponse = await cloudinary.uploader.upload(profileImg); // Upload the new profile image to Cloudinary
      profileImg = uploadedResponse.secure_url; // Get the secure URL of the uploaded image
    }

    if (coverImg) {
      // Check if the user already has a cover image
      if (user.coverImg) {
        await cloudinary.uploader.destroy(
          user.coverImg.split("/").pop().split(".")[0]
        ); // Delete the old cover image from Cloudinary
      }
      const uploadedResponse = await cloudinary.uploader.upload(coverImg); // Upload the new cover image to Cloudinary
      coverImg = uploadedResponse.secure_url; // Get the secure URL of the uploaded image
    }

    user.fullName = fullName || user.fullName; // Update the user's full name
    user.email = email || user.email; // Update the user's email
    user.username = username || user.username; // Update the user's username
    user.bio = bio || user.bio; // Update the user's bio
    user.link = link || user.link; // Update the user's link
    user.profileImg = profileImg || user.profileImg; // Update the user's profile image
    user.coverImg = coverImg || user.coverImg; // Update the user's cover image

    user = await user.save(); // Save the updated user information

    user.password = null; // Remove the password field from the user object

    return res.status(200).json(user); // Return the updated user information
  } catch (error) {
    console.error("Error updating user:", error.message);
    return res.status(500).json({ error: error.message });
  }
};
