const express = require('express');
const cors = require('cors');
const axios = require('axios');
const redis = require('redis');
const app = express();
const PORT = 4002;

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
        console.log(`[Web BFF] Cache HIT: ${key}`);
        return JSON.parse(cached);
      }
    }
    
    console.log(`[Web BFF] Cache MISS: ${key}`);
    const data = await fetchFn();
    
    if (redisClient.isOpen) {
      await redisClient.setEx(key, CACHE_TTL, JSON.stringify(data));
    }
    
    return data;
  } catch (error) {
    console.error(`[Web BFF] Cache error for ${key}:`, error);
    return fetchFn();
  }
}

// GET /api/dashboard/:userId - Полные данные для веб (с обогащением)
app.get('/api/dashboard/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const cacheKey = `web:dashboard:${userId}`;
    
    const dashboardData = await getCachedOrFetch(cacheKey, async () => {
      // Параллельные запросы
      const [user, orders, popularProducts] = await Promise.all([
        axios.get(`${USER_SERVICE}/users/${userId}`),
        axios.get(`${ORDER_SERVICE}/orders?userId=${userId}`),
        axios.get(`${PRODUCT_SERVICE}/products/popular`)
      ]);
      
      // Обогащение: получаем детали товаров для заказов
      const enrichedOrders = await Promise.all(
        orders.data.map(async (order) => {
          try {
            const products = await Promise.all(
              order.productIds.map(id => 
                axios.get(`${PRODUCT_SERVICE}/products/${id}`)
                  .catch(err => ({ data: { id, name: 'Unknown', price: 0 } }))
              )
            );
            return {
              ...order,
              products: products.map(p => ({
                id: p.data.id,
                name: p.data.name,
                price: p.data.price
              }))
            };
          } catch (error) {
            return {
              ...order,
              products: []
            };
          }
        })
      );
      
      // Для веб: полные данные с обогащением
      return {
        user: user.data,
        orders: enrichedOrders,
        popularProducts: popularProducts.data,
        statistics: {
          totalOrders: orders.data.length,
          totalSpent: orders.data.reduce((sum, o) => sum + o.total, 0),
          averageOrderValue: orders.data.length > 0 
            ? Math.round(orders.data.reduce((sum, o) => sum + o.total, 0) / orders.data.length) 
            : 0,
          statusBreakdown: orders.data.reduce((acc, o) => {
            acc[o.status] = (acc[o.status] || 0) + 1;
            return acc;
          }, {})
        }
      };
    });
    
    res.json(dashboardData);
  } catch (error) {
    console.error('[Web BFF] Dashboard error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json({ error: error.response.data.error || 'Service error' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/user/:id - Полный профиль для веб
app.get('/api/user/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const cacheKey = `web:user:${userId}`;
    
    const userData = await getCachedOrFetch(cacheKey, async () => {
      const [user, orders] = await Promise.all([
        axios.get(`${USER_SERVICE}/users/${userId}`),
        axios.get(`${ORDER_SERVICE}/orders?userId=${userId}`)
      ]);
      
      return {
        ...user.data,
        orderHistory: orders.data,
        stats: {
          totalOrders: orders.data.length,
          totalSpent: orders.data.reduce((sum, o) => sum + o.total, 0)
        }
      };
    });
    
    res.json(userData);
  } catch (error) {
    console.error('[Web BFF] User error:', error.message);
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
    service: 'web-bff',
    redis: redisClient.isOpen ? 'connected' : 'disconnected'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Web BFF running on port ${PORT}`);
});

