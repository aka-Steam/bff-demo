const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json());

// Mock data
const orders = [
  { id: 1, userId: 1, productIds: [1, 2], total: 5990, status: 'completed', date: '2024-01-15' },
  { id: 2, userId: 1, productIds: [3], total: 2990, status: 'pending', date: '2024-01-20' },
  { id: 3, userId: 2, productIds: [1, 3, 4], total: 8990, status: 'completed', date: '2024-01-18' },
  { id: 4, userId: 2, productIds: [2], total: 1990, status: 'shipped', date: '2024-01-22' },
  { id: 5, userId: 3, productIds: [4], total: 3990, status: 'completed', date: '2024-01-19' }
];

// GET /orders?userId=:id
app.get('/orders', (req, res) => {
  const userId = parseInt(req.query.userId);
  if (userId) {
    const userOrders = orders.filter(o => o.userId === userId);
    return res.json(userOrders);
  }
  res.json(orders);
});

// GET /orders/:id
app.get('/orders/:id', (req, res) => {
  const order = orders.find(o => o.id === parseInt(req.params.id));
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'order-service' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Order Service running on port ${PORT}`);
});

