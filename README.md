# DiscTube — Node.js Real-Time Chat Application

![DiscTube Logo](https://cdn.pfps.gg/pfps/97094-owl-house.jpeg)

DiscTube is a full-featured real-time chat app built with Node.js, Express, Socket.io, and Quick.db.  
It supports user authentication, profiles with avatars, friend requests, private messaging, and WebRTC voice/video calls — similar to Discord.

---

## Features

- User registration & login with secure password hashing  
- Persistent profiles with avatar upload & customizable bio/status  
- Public chat room with real-time messaging  
- Friend system: send/accept friend requests, friends list management  
- Private one-on-one chats with friends  
- Real-time voice and video calls using WebRTC  
- Role badges (e.g., “Developer” role for special users)  
- Responsive UI styled with Tailwind CSS  
- GPG commit signing support for secure development workflow

---

## Tech Stack

- Node.js & Express for backend  
- EJS templating engine for views  
- Socket.io for real-time communication  
- Quick.db (SQLite) for lightweight persistent storage  
- Multer for handling avatar uploads  
- WebRTC for peer-to-peer voice/video calls  
- Tailwind CSS for styling  

---

## Getting Started

### Prerequisites

- Node.js (v14+)  
- npm (comes with Node.js)  

### Installation

1. Clone the repo:

```bash
git clone https://github.com/ManjaroLover153/chat-app.git
cd disctube
```
2. Install dependencies:

```bash
npm install
```
3. (Optional) Configure environment variables if you add any (e.g. PORT, session secret).
4. Start the app:
```bash
node server.js
```
5. Open your browser at ``http://localhost:3000`` (or your configured port)

# Usage
- Register a new user or log in with existing credentials
- Customize your profile with avatar, bio, and status
- Add friends and manage friend requests
- Chat publicly or privately with friends
- Make voice or video calls directly from the app

# Folder Structure
```bash
/public            # Static assets (CSS, avatars, scripts)
/views             # EJS templates
/server.js         # Main server file
.gitignore         # Git ignore rules
README.md          # This file
package.json       # Project metadata and dependencies
```

# Contributing
Feel free to open issues or submit pull requests!
Please make sure to sign your commits with GPG.

# License
MIT License © ManjaroLover153

# Acknowledgments
Inspired by Discord’s design and real-time features, built for learning and fun!
Avatar icon by pfps.gg
