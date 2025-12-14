const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Mock data
const users = [
  { id: 1, name: 'Иван Иванов', email: 'ivan@example.com', phone: '+7 900 123-45-67', avatar: 'https://i.pravatar.cc/150?img=1' },
  { id: 2, name: 'Мария Петрова', email: 'maria@example.com', phone: '+7 900 234-56-78', avatar: 'https://i.pravatar.cc/150?img=2' },
  { id: 3, name: 'Алексей Сидоров', email: 'alex@example.com', phone: '+7 900 345-67-89', avatar: 'https://i.pravatar.cc/150?img=3' }
];

// GET /users/:id
app.get('/users/:id', (req, res) => {
  const user = users.find(u => u.id === parseInt(req.params.id));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

// GET /users
app.get('/users', (req, res) => {
  res.json(users);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'user-service' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`User Service running on port ${PORT}`);
});

