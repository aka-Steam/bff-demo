const express = require('express');
const cors = require('cors');
const axios = require('axios');
const redis = require('redis');
const app = express();
const PORT = 4001;

app.use(cors());
app.use(express.json());

// Redis client
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

// Подключение к Redis с повторными попытками
async function connectRedis() {
  try {
    await redisClient.connect();
    console.log('Connected to Redis');
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
    console.log('Continuing without cache...');
  }
}

connectRedis();

// Service URLs
const USER_SERVICE = process.env.USER_SERVICE_URL || 'http://user-service:3001';
const ORDER_SERVICE = process.env.ORDER_SERVICE_URL || 'http://order-service:3002';
const PRODUCT_SERVICE = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3003';

// Cache TTL (5 минут)
const CACHE_TTL = 300;

// Helper: получить из кеша или выполнить запрос
async function getCachedOrFetch(key, fetchFn) {
  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(key);
      if (cached) {
        console.log(`[Mobile BFF] Cache HIT: ${key}`);
        return JSON.parse(cached);
      }
    }
    
    console.log(`[Mobile BFF] Cache MISS: ${key}`);
    const data = await fetchFn();
    
    if (redisClient.isOpen) {
      await redisClient.setEx(key, CACHE_TTL, JSON.stringify(data));
    }
    
    return data;
  } catch (error) {
    console.error(`[Mobile BFF] Cache error for ${key}:`, error);
    return fetchFn(); // Fallback без кеша
  }
}

// GET /api/dashboard/:userId - Оптимизированный для мобильных (минимальные данные)
app.get('/api/dashboard/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const cacheKey = `mobile:dashboard:${userId}`;
    
    const dashboardData = await getCachedOrFetch(cacheKey, async () => {
      // Параллельные запросы
      const [user, orders] = await Promise.all([
        axios.get(`${USER_SERVICE}/users/${userId}`),
        axios.get(`${ORDER_SERVICE}/orders?userId=${userId}`)
      ]);
      
      // Для мобильного: только основные данные, без лишних деталей
      return {
        user: {
          id: user.data.id,
          name: user.data.name,
          avatar: user.data.avatar
        },
        orders: orders.data.map(order => ({
          id: order.id,
          total: order.total,
          status: order.status,
          date: order.date
        })),
        summary: {
          totalOrders: orders.data.length,
          totalSpent: orders.data.reduce((sum, o) => sum + o.total, 0)
        }
      };
    });
    
    res.json(dashboardData);
  } catch (error) {
    console.error('[Mobile BFF] Dashboard error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json({ error: error.response.data.error || 'Service error' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/user/:id - Упрощенный профиль для мобильного
app.get('/api/user/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const cacheKey = `mobile:user:${userId}`;
    
    const userData = await getCachedOrFetch(cacheKey, async () => {
      const user = await axios.get(`${USER_SERVICE}/users/${userId}`);
      return {
        id: user.data.id,
        name: user.data.name,
        email: user.data.email,
        phone: user.data.phone
      };
    });
    
    res.json(userData);
  } catch (error) {
    console.error('[Mobile BFF] User error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json({ error: error.response.data.error || 'Service error' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'mobile-bff',
    redis: redisClient.isOpen ? 'connected' : 'disconnected'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mobile BFF running on port ${PORT}`);
});

