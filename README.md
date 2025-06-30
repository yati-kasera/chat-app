# Chat App with Group Chat Feature

A real-time chat application built with NestJS backend and Next.js frontend, featuring both private and group chat functionality.

## Features

### Private Chat
- One-on-one messaging between users
- Real-time message delivery using Socket.IO
- Message history persistence

### Group Chat
- Create groups with multiple members
- Real-time group messaging
- Group management (add/remove members, update group name)
- Join/leave group functionality
- Message history for groups

## Backend API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user
- `GET /users` - Get all users

### Groups
- `POST /groups` - Create a new group
- `GET /groups` - Get user's groups
- `GET /groups/:id` - Get group details
- `POST /groups/:id/members` - Add member to group
- `DELETE /groups/:id/members/:userId` - Remove member from group
- `PUT /groups/:id` - Update group name
- `DELETE /groups/:id` - Delete group

### Chat
- `POST /chat/send` - Send private message
- `POST /chat/group/send` - Send group message
- `GET /chat/messages` - Get private messages between users
- `GET /chat/group/:groupId/messages` - Get group messages

## WebSocket Events

### Client to Server
- `private-message` - Send private message
- `group-message` - Send group message
- `join-group` - Join a group room
- `leave-group` - Leave a group room

### Server to Client
- `private-message` - Receive private message
- `group-message` - Receive group message
- `user-joined-group` - User joined group notification
- `user-left-group` - User left group notification

## Frontend Features

### Main Page
- User registration and login
- List of all users for private chat
- Group creation form with member selection
- List of user's groups with join chat option

### Chat Page
- Supports both private and group chats
- Real-time message updates
- Message history display
- Group member count display
- Sender name display in group chats

## Setup Instructions

1. **Backend Setup**
   ```bash
   cd backend
   npm install
   npm run start:dev
   ```

2. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Database**
   - Ensure MongoDB is running on `localhost:27017`
   - The app will automatically create the required collections

## Usage

1. Register/Login with your account
2. Create groups by selecting members from the user list
3. Join group chats or start private conversations
4. Send messages in real-time
5. Manage groups (add/remove members, update names)

## Technical Stack

- **Backend**: NestJS, Socket.IO, MongoDB, Mongoose
- **Frontend**: Next.js, React, Socket.IO Client, Tailwind CSS
- **Authentication**: JWT
- **Real-time Communication**: Socket.IO 