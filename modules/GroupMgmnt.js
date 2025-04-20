// Import required modules
const express = require('express');
const mongoose = require('mongoose');
const logger = require('morgan'); // logging middleware

const app = express();
app.use(express.json());

// Set up logging
app.use(logger('dev')); // log requests and responses in development mode

const mongoURI = 'mongodb+srv://arnabchakraborty21:uGl51wFgp0Tjv7bp@cluster0.namb0am.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

// Define a logging function
function log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
  }
  
  // Define a debug logging function
  function debug(message) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${new Date().toISOString()}] DEBUG: ${message}`);
    }
  }

// Group Schema
const groupSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, enum: ["private", "open"], required: true },
    maxMembers: { type: Number, min: 2, required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    pendingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    bannedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    leaveTimestamps: [{ userId: mongoose.Schema.Types.ObjectId, timestamp: Date }]
});

const Group = mongoose.model("Group", groupSchema);

// User Schema (For reference)
const userSchema = new mongoose.Schema({
    name: String,
    email: String,
});

const User = mongoose.model("User", userSchema);
//const Leave = mongoose.model('Leave', leaveSchema);

// Create Group
app.post("/groups/create", async (req, res) => {
    const { name, type, maxMembers, ownerId } = req.body;

    try {
        const group = new Group({ name, type, maxMembers, owner: ownerId, members: [ownerId] });
        await group.save();
        log(`Group created: ${group._id}`);
        res.status(201).json({ message: "Group created successfully!", group });
    } catch (error) {
        log(`Error creating group: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

// Join Group
app.post("/groups/:groupId/join/:userId", async (req, res) => {
    const { groupId, userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
        return res.status(400).json({ error: "Invalid group ID format" });
    }
    const group = await Group.findById(groupId);

    if (!group) return res.status(404).json({ error: "Group not found" });

    if (group.members.length >= group.maxMembers) return res.status(403).json({ error: "Group is full" });

    if (group.type === "open") {
        group.members.push(new mongoose.Types.ObjectId(userId));
    } else {
        group.pendingRequests.push(new mongoose.Types.ObjectId(userId));
    }

    await group.save();
    res.json({ message: group.type === "open" ? "Joined group successfully!" : "Request sent to owner for approval" });
});

// Get Pending Requests (Owner View)
app.get("/groups/:groupId/requests", async (req, res) => {
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
        return res.status(400).json({ error: "Invalid Group ID format" });
    }

    const group = await Group.findById(groupId).populate("pendingRequests", "name email");
    if (!group) return res.status(404).json({ error: "Group not found" });

    res.json({ pendingRequests: group.pendingRequests });
});

// Leave Group
app.post("/groups/:groupId/leave/:userId", async (req, res) => {
    const { groupId, userId } = req.params;
    const group = await Group.findById(groupId);

    if (!group) return res.status(404).json({ error: "Group not found" });

    group.members = group.members.filter(member => member.toString() !== userId);
    await group.save();

    res.json({ message: "Left group successfully!" });
});

// Endpoint for owner to leave the group
app.post("/leaveGroup", async (req, res) => {
  const { groupId, userId, newOwnerId } = req.body;

  const group = await Group.findById(groupId);
  if (!group) return res.status(404).json({ error: "Group not found" });

  if (!group.owner.equals(userId)) {
    return res.status(403).json({ error: "Owner must transfer ownership before leaving" });
  }

  if (!newOwnerId || !group.members.includes(newOwnerId)) {
    return res.status(400).json({ error: "New owner must be specified and a member" });
  }

  group.owner = newOwnerId;
  group.members = group.members.filter(member => !member.equals(userId));
  await group.save();
  res.json({ message: "Owner transferred and left successfully" });
});

// Approve Requests (Private Groups)
app.post("/groups/:groupId/approve/:userId", async (req, res) => {
    const { groupId, userId } = req.params;
    const group = await Group.findById(groupId);

    if (!group || group.type !== "private") return res.status(404).json({ error: "Invalid operation" });

    if (!group.pendingRequests.includes(userId)) return res.status(403).json({ error: "No pending request" });

    group.members.push(userId);
    group.pendingRequests = group.pendingRequests.filter(req => req.toString() !== userId);
    await group.save();

    res.json({ message: "User added to private group!" });
});

// Reject Join Request
app.post("/groups/:groupId/reject/:userId", async (req, res) => {
    const { groupId, userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ error: "Invalid Group or User ID format" });
    }

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    if (!group.pendingRequests.includes(userId)) {
        return res.status(403).json({ error: "No pending request found" });
    }

    group.pendingRequests = group.pendingRequests.filter(req => req.toString() !== userId);
    await group.save();

    res.json({ message: "User's request was rejected!" });
});

// Ban a User from a Group
app.post("/groups/:groupId/ban/:userId", async (req, res) => {
    const { groupId, userId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    if (!group.bannedUsers.includes(userId)) {
        group.bannedUsers.push(userId);
        group.members = group.members.filter(member => member.toString() !== userId);
        await group.save();
    }

    res.json({ message: "User has been banned from the group!" });
});

// Submit Rejoin Request (Banished User)
app.post("/groups/:groupId/request/:userId", async (req, res) => {
    const { groupId, userId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    if (group.bannedUsers.includes(userId)) {
        return res.status(403).json({ error: "User is banned; owner approval required to rejoin" });
    }

    if (!group.pendingRequests.includes(userId)) {
        group.pendingRequests.push(userId);
        await group.save();
    }

    res.json({ message: "Join request submitted!" });
});

// Enforce 48-Hour Cooldown After Leaving Private Group
app.post("/groups/:groupId/leave/:userId", async (req, res) => {
    const { groupId, userId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    // Store leave timestamp for cooldown enforcement
    if (group.type === "private") {
        //await storeLeave(userId);
        group.leaveTimestamps.push({ userId, timestamp: new Date() });
    }

    group.members = group.members.filter(member => member.toString() !== userId);
    await group.save();

    res.json({ message: "User left the group!" });
});

// Verify Cooldown Before Allowing Rejoin Request
app.post("/groups/:groupId/request-private/:userId", async (req, res) => {
    const { groupId, userId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    if (group.type !== "private") {
        return res.status(400).json({ error: "Cooldown only applies to private groups" });
    }

    // Check if user left within the last 48 hours
    const leaveRecord = group.leaveTimestamps.find(record => record.userId.toString() === userId);
    if (leaveRecord) {
        const timeDiff = (new Date() - leaveRecord.timestamp) / (1000 * 60 * 60); // Convert to hours
        if (timeDiff < 48) {
            return res.status(403).json({ error: `Cooldown period active. Please wait ${(48 - timeDiff).toFixed(1)} more hours.` });
        }
    }

    if (!group.pendingRequests.includes(userId)) {
        group.pendingRequests.push(userId);
        await group.save();
    }

    res.json({ message: "Join request submitted!" });
});

// Transfer Owner Role
app.post("/groups/:groupId/transfer-owner/:ownerId/:newOwnerId", async (req, res) => {
    const { groupId, ownerId, newOwnerId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    if (group.owner.toString() !== ownerId) {
        return res.status(403).json({ error: "Only the current owner can transfer ownership" });
    }

    if (!group.members.includes(newOwnerId)) {
        return res.status(400).json({ error: "New owner must be a group member" });
    }

    group.owner = newOwnerId;
    await group.save();

    res.json({ message: "Ownership transferred successfully!" });
});

// Delete Group (Only Allowed If Owner Is the Sole Member)
app.delete("/groups/:groupId/delete/:ownerId", async (req, res) => {
    const { groupId, ownerId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    if (group.owner.toString() !== ownerId) {
        return res.status(403).json({ error: "Only the owner can delete the group" });
    }

    if (group.members.length > 1) {
        return res.status(403).json({ error: "Cannot delete group with other members present" });
    }

    await Group.findByIdAndDelete(groupId);
    res.json({ message: "Group deleted successfully!" });
});

// Start Server
app.listen(3000, () => console.log("Server running on port 3000"));