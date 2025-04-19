require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");

const app = express();
app.use(express.json());

const mongoURI = 'mongodb+srv://arnabchakraborty21:uGl51wFgp0Tjv7bp@cluster0.namb0am.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

// AES-128 Encryption/Decryption Helpers
const ENCRYPTION_KEY = Buffer.from("1234567890123456", "utf-8");
const IV_LENGTH = 16; // AES needs a fixed IV length

function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-128-cbc", ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");
    return iv.toString("hex") + encrypted;
}

function decrypt(encryptedText) {
    const iv = Buffer.from(encryptedText.slice(0, 32), "hex");
    const encryptedData = encryptedText.slice(32);
    const decipher = crypto.createDecipheriv("aes-128-cbc", ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedData, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
}

// Message Schema
const messageSchema = new mongoose.Schema({
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
    encryptedText: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    delivered: { type: Boolean, default: false }
});

const Message = mongoose.model("Message", messageSchema);

// Send Encrypted Message
app.post("/messages/send", async (req, res) => {
    const { senderId, groupId, text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(groupId)) {
        return res.status(400).json({ error: "Invalid sender or group ID" });
    }

    const encryptedText = encrypt(text);

    const message = new Message({ senderId, groupId, encryptedText });
    await message.save();

    // Add to simulated queue for delayed delivery
    messageQueue.push(message);

    res.status(201).json({ message: "Message sent securely!",timestamp: new Date().toISOString() });
});

// Retrieve Messages and Decrypt
app.get("/messages/:groupId", async (req, res) => {
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
        return res.status(400).json({ error: "Invalid group ID format" });
    }

    const messages = await Message.find({ groupId }).populate("senderId", "name");
    const decryptedMessages = messages.map(msg => ({
        sender: msg.senderId.name,
        text: decrypt(msg.encryptedText),
        timestamp: msg.timestamp
    }));

    // Simulated delayed message delivery
    const newMessages = messageQueue.filter(msg => msg.groupId.toString() === groupId);
    newMessages.forEach(msg => (msg.delivered = true));

    res.json(decryptedMessages);
    // Remove delivered messages from queue
    messageQueue.splice(0, newMessages.length);
});

// Start Server
app.listen(3000, () => console.log("Server running on port 3000"));
