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
