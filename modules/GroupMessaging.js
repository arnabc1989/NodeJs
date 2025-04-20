// Import required modules
const express = require("express");
const mongoose = require("mongoose");
const crypto = require("crypto");
const logger = require('morgan'); // logging middleware

const app = express();
app.use(express.json());
const messageQueue = []; // In-memory queue

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

const groupSchema = new mongoose.Schema({
    name: { type: String, required: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  });

const Group = mongoose.model("Group", groupSchema);
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
    log(`Message saved: ${message._id}`);
    // Add to simulated queue for delayed delivery
    messageQueue.push(message);

    res.status(201).json({ message: "Message sent securely!",timestamp: new Date().toISOString() });
});

// Process messages (Simulated worker)
setInterval(() => {
    if (messageQueue.length > 0) {
      const processedMessage = messageQueue.shift();
      console.log(`Processed Message:`, processedMessage);
    }
  }, 1000); // Simulates periodic processing

// Retrieve Messages and Decrypt
app.get("/messages/:groupId", async (req, res) => {
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
        return res.status(400).json({ error: "Invalid group ID format" });
    }

    const messages = await Message.find({ groupId });
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
