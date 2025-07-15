// server.js
const express = require('express');
const http = require('http');
const path = require('path');
const socketio = require('socket.io');
const session = require('express-session');
const bcrypt = require('bcrypt');
const multer = require('multer');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { QuickDB } = require('quick.db');

const app = express();
const server = http.createServer(app);
const io = socketio(server);
const db = new QuickDB();

// Session setup
const sessionMiddleware = session({
  secret: 'supersecretkey',
  resave: false,
  saveUninitialized: false,
});
app.use(sessionMiddleware);
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// Multer for avatar uploads
const avatarsDir = path.join(__dirname, 'public', 'avatars');
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: avatarsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({ storage });

// Express setup
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Helpers
function authRequired(req, res, next) {
  if (req.session.user) return next();
  res.redirect('/login');
}

function generateDiscriminator() {
  return ('0000' + Math.floor(Math.random() * 10000)).slice(-4);
}

// Update user status helper
async function updateUserStatus(username, status) {
  let users = (await db.get('users')) || [];
  const idx = users.findIndex(u => u.username === username);
  if (idx !== -1) {
    users[idx].status = status;
    if (status === 'offline') users[idx].lastSeen = Date.now();
    await db.set('users', users);
  }
}

// --- ROUTES ---

// Signup
app.get('/signup', (req, res) => res.render('signup', { error: null }));
app.post('/signup', async (req, res) => {
  const { username, password } = req.body;
  let users = (await db.get('users')) || [];
  if (users.find(u => u.username === username)) {
    return res.render('signup', { error: 'Username taken' });
  }
  const hash = await bcrypt.hash(password, 10);
  const roles = username === 'FakaSys' ? ['Developer', 'Owner'] : ['User'];
  const discriminator = generateDiscriminator();
  users.push({ username, password: hash, discriminator, roles, bio: '', avatarUrl: null, status: 'online', lastSeen: Date.now() });
  await db.set('users', users);
  req.session.user = { username, discriminator, roles };
  res.redirect('/');
});

// Login
app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  let users = (await db.get('users')) || [];
  const user = users.find(u => u.username === username);
  if (!user) return res.render('login', { error: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.render('login', { error: 'Invalid credentials' });
  req.session.user = { username, discriminator: user.discriminator, roles: user.roles, avatarUrl: user.avatarUrl };
  await updateUserStatus(username, 'online');
  res.redirect('/');
});

// Logout
app.get('/logout', async (req, res) => {
  if (req.session.user) await updateUserStatus(req.session.user.username, 'offline');
  req.session.destroy(() => res.redirect('/login'));
});

// Home (chat)
app.get('/', authRequired, async (req, res) => {
  const messages = (await db.get('messages')) || [];
  const users = (await db.get('users')) || [];
  const currentUser = users.find(u => u.username === req.session.user.username);
  res.render('index', {
    messages,
    displayName: currentUser.username === 'FakaSys' ? 'FakaSys 👑' : currentUser.username,
    discriminator: currentUser.discriminator,
    roles: currentUser.roles,
    avatarUrl: currentUser.avatarUrl
  });
});

// Avatar upload
app.post('/upload-avatar', authRequired, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const avatarUrl = `/avatars/${req.file.filename}`;
  let users = (await db.get('users')) || [];
  const idx = users.findIndex(u => u.username === req.session.user.username);
  if (idx !== -1) {
    users[idx].avatarUrl = avatarUrl;
    await db.set('users', users);
    req.session.user.avatarUrl = avatarUrl;
  }
  res.json({ success: true, avatarUrl });
});

// Profile API
app.get('/api/profile/:username', async (req, res) => {
  let users = (await db.get('users')) || [];
  const user = users.find(u => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { password, ...publicData } = user;
  res.json(publicData);
});

// Profile update (bio, status)
app.post('/api/profile/update', authRequired, async (req, res) => {
  const { bio, status } = req.body;
  let users = (await db.get('users')) || [];
  const idx = users.findIndex(u => u.username === req.session.user.username);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  users[idx].bio = bio || '';
  users[idx].status = status || 'online';
  await db.set('users', users);
  req.session.user.status = users[idx].status;
  res.json({ success: true });
});

// Messages (for simple public chat)
app.post('/message', authRequired, async (req, res) => {
  let messages = (await db.get('messages')) || [];
  messages.push({
    username: req.session.user.username === 'FakaSys' ? 'FakaSys 👑' : req.session.user.username,
    discriminator: req.session.user.discriminator,
    roles: req.session.user.roles,
    text: req.body.text,
    time: new Date().toISOString()
  });
  if (messages.length > 50) messages.shift();
  await db.set('messages', messages);
  res.json({ success: true });
});

// FRIEND REQUESTS MANAGEMENT

// Send friend request
app.post('/friend-request', authRequired, async (req, res) => {
  const fromUser = req.session.user.username;
  const { toUsername } = req.body;
  if (fromUser === toUsername) return res.status(400).json({ error: "Can't friend yourself" });
  let friendReqs = (await db.get('friendRequests')) || {};
  friendReqs[toUsername] = friendReqs[toUsername] || [];
  if (friendReqs[toUsername].includes(fromUser)) return res.status(400).json({ error: 'Request already sent' });
  friendReqs[toUsername].push(fromUser);
  await db.set('friendRequests', friendReqs);
  res.json({ success: true });
});

// Respond to friend request
app.post('/friend-request/respond', authRequired, async (req, res) => {
  const username = req.session.user.username;
  const { fromUsername, accept } = req.body;
  let friendReqs = (await db.get('friendRequests')) || {};
  let friends = (await db.get('friends')) || {};
  if (!friendReqs[username] || !friendReqs[username].includes(fromUsername))
    return res.status(400).json({ error: 'No friend request from user' });

  friendReqs[username] = friendReqs[username].filter(u => u !== fromUsername);

  if (accept) {
    friends[username] = friends[username] || [];
    friends[fromUsername] = friends[fromUsername] || [];
    if (!friends[username].includes(fromUsername)) friends[username].push(fromUsername);
    if (!friends[fromUsername].includes(username)) friends[fromUsername].push(username);
  }
  await db.set('friendRequests', friendReqs);
  await db.set('friends', friends);
  res.json({ success: true });
});

// Get friend requests and friends
app.get('/api/friends', authRequired, async (req, res) => {
  const username = req.session.user.username;
  const friendReqs = (await db.get('friendRequests')) || {};
  const friends = (await db.get('friends')) || {};
  res.json({
    incomingRequests: friendReqs[username] || [],
    friends: friends[username] || []
  });
});

// SOCKET.IO SETUP
const connectedUsers = new Map();

io.on('connection', socket => {
  const session = socket.request.session;
  if (!session.user) return socket.disconnect();

  const currentUsername = session.user.username === 'FakaSys' ? 'FakaSys 👑' : session.user.username;
  connectedUsers.set(socket.id, {
    username: currentUsername,
    discriminator: session.user.discriminator,
    roles: session.user.roles,
    avatarUrl: session.user.avatarUrl || null,
  });

  io.emit('userList', Array.from(connectedUsers.values()));

  socket.on('chatMessage', async text => {
    if (!text.trim()) return;
    let messages = (await db.get('messages')) || [];
    messages.push({
      username: currentUsername,
      discriminator: session.user.discriminator,
      roles: session.user.roles,
      text,
      time: new Date().toISOString()
    });
    if (messages.length > 50) messages.shift();
    await db.set('messages', messages);
    io.emit('message', { username: currentUsername, discriminator: session.user.discriminator, roles: session.user.roles, text, time: new Date().toISOString() });
  });

  // PRIVATE MESSAGING WITH FRIENDS ONLY
  socket.on('privateMessage', async ({ toUsername, text }) => {
    if (!text.trim()) return;
    const friends = (await db.get('friends')) || {};
    const usernameRaw = session.user.username;
    if (!friends[usernameRaw] || !friends[usernameRaw].includes(toUsername)) {
      socket.emit('errorMessage', 'Can only message friends');
      return;
    }
    for (const [id, user] of connectedUsers.entries()) {
      if (user.username === toUsername || user.username === toUsername + ' 👑') {
        io.to(id).emit('privateMessage', {
          fromUsername: currentUsername,
          fromRoles: session.user.roles,
          text,
          time: new Date().toISOString()
        });
        break;
      }
    }
  });

  // WEBRTC SIGNALLING

  socket.on('call-user', data => {
    // data: { toUsername, offer }
    for (const [id, user] of connectedUsers.entries()) {
      if (user.username === data.toUsername || user.username === data.toUsername + ' 👑') {
        io.to(id).emit('incoming-call', { fromUsername: currentUsername, offer: data.offer });
        break;
      }
    }
  });

  socket.on('call-answer', data => {
    // data: { toUsername, answer }
    for (const [id, user] of connectedUsers.entries()) {
      if (user.username === data.toUsername || user.username === data.toUsername + ' 👑') {
        io.to(id).emit('call-accepted', { fromUsername: currentUsername, answer: data.answer });
        break;
      }
    }
  });

  socket.on('call-reject', data => {
    // data: { toUsername }
    for (const [id, user] of connectedUsers.entries()) {
      if (user.username === data.toUsername || user.username === data.toUsername + ' 👑') {
        io.to(id).emit('call-rejected', { fromUsername: currentUsername });
        break;
      }
    }
  });

  socket.on('disconnect', () => {
    connectedUsers.delete(socket.id);
    io.emit('userList', Array.from(connectedUsers.values()));
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server started on http://localhost:${PORT}`));
