const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const mongoURI = 'mongodb+srv://arnabchakraborty21:uGl51wFgp0Tjv7bp@cluster0.namb0am.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

// Group Schema
const groupSchema = new mongoose.Schema({
    name: { type: String, required: true },
    type: { type: String, enum: ["private", "open"], required: true },
    maxMembers: { type: Number, min: 2, required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    pendingRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

const Group = mongoose.model("Group", groupSchema);

// User Schema (For reference)
const userSchema = new mongoose.Schema({
    name: String,
    email: String,
});

const User = mongoose.model("User", userSchema);

// Create Group
app.post("/groups/create", async (req, res) => {
    const { name, type, maxMembers, ownerId } = req.body;

    try {
        const group = new Group({ name, type, maxMembers, owner: ownerId, members: [ownerId] });
        await group.save();
        res.status(201).json({ message: "Group created successfully!", group });
    } catch (error) {
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

// Start Server
app.listen(3000, () => console.log("Server running on port 3000"));