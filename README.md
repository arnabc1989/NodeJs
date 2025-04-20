This backend application provides a secure group messaging system, supporting: 
✅ Private & Open groups 
✅ User authentication (JWT-based)
✅ Message encryption using AES-128 
✅ Join request handling for private groups
✅ Real-time messaging simulation

**Tech Stack**
Node.js (Runtime)

Express.js (API framework)

MongoDB + Mongoose (Database)

JWT (Authentication)

Bcrypt (Password hashing)

Crypto (AES-128 encryption)

System Design
📌 Architecture Overview
1️⃣ User Authentication
Secure registration & login using bcrypt for password hashing

JWT-based authentication for secure API access

2️⃣ Group Management
Open groups: Users can freely join and leave.

Private groups: Require owner approval for new members.

Owners can ban users and enforce cooldown rules.

Role enforcement: Owners must transfer their role before leaving.

3️⃣ Secure Messaging
AES-128 encryption for storing messages securely.

Message retrieval with decryption on client requests.

Basic queuing mechanism for simulating real-time messaging.
Database Schema (MongoDB)

2️⃣ Install Dependencies
bash
npm install
3️⃣ Set Up Environment Variables
Create a .env file:

MONGO_URI=mongodb://localhost:27017/group_messaging
JWT_SECRET=mysecurejwtkey
ENCRYPTION_KEY=1234567890123456
4️⃣ Run the Server
bash
node server.js


**Setup and Run Instructions**

Clone the repository: git clone [https://github.com/your-repo/secure-messaging-app.git](https://github.com/your-repo/secure-messaging-app.git`)
Install dependencies: npm install
Set environment variables:
MONGO_URI: MongoDB connection string (e.g., mongodb+srv://username:password@cluster0.namb0am.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0)
JWT_SECRET_KEY: Secret key for JSON Web Tokens (e.g., your-secret-key)
ENCRYPTION_KEY: AES-128 encryption key (e.g., 1234567890123456)
Start the server: node index.js
API Documentation

**Authentication Endpoints**
POST /register
Request Body: { email: string, password: string }
Response: { message: string }
POST /login
Request Body: { email: string, password: string }
Response: { token: string }
Group Management Endpoints
POST /groups/create
Request Body: { name: string, type: string, maxMembers: number, ownerId: string }
Response: { message: string, group: object }
GET /groups/:groupId/requests
Response: { pendingRequests: array }
POST /groups/:groupId/join/:userId
Response: { message: string }
POST /groups/:groupId/leave/:userId
Response: { message: string }
POST /groups/:groupId/approve/:userId
Response: { message: string }
POST /groups/:groupId/reject/:userId
Response: { message: string }
POST /groups/:groupId/ban/:userId
Response: { message: string }
Messaging Endpoints
POST /messages/send
Request Body: { senderId: string, groupId: string, text: string }
Response: { message: string }
GET /messages/:groupId
Response: { messages: array }

API Endpoints

🔹 Authentication
Method	Endpoint	Description
POST	/register	User registration
POST	/login	User login (JWT generation)

🔹 Group Management
Method	Endpoint	Description
POST	/groups/create	Create a group (private/open)
POST	/groups/:groupId/request/:userId	Request to join a private group
POST	/groups/:groupId/approve/:userId	Approve join request
POST	/groups/:groupId/ban/:userId	Ban a user from a group
POST	/groups/:groupId/leave/:userId	Leave a group
POST	/groups/:groupId/transfer-owner/:ownerId/:newOwnerId	Transfer owner role

🔹 Secure Messaging
Method	Endpoint	Description
POST	/messages/send	Send an encrypted message
GET	/messages/:groupId	Retrieve & decrypt messages


