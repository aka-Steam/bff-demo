const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3003;

app.use(cors());
app.use(express.json());

// Mock data
const products = [
  { id: 1, name: 'Ноутбук', price: 49990, category: 'electronics', inStock: true, description: 'Мощный ноутбук для работы' },
  { id: 2, name: 'Смартфон', price: 29990, category: 'electronics', inStock: true, description: 'Современный смартфон' },
  { id: 3, name: 'Наушники', price: 2990, category: 'electronics', inStock: true, description: 'Беспроводные наушники' },
  { id: 4, name: 'Планшет', price: 19990, category: 'electronics', inStock: false, description: 'Планшет для чтения' },
  { id: 5, name: 'Клавиатура', price: 1990, category: 'accessories', inStock: true, description: 'Механическая клавиатура' }
];

// GET /products
app.get('/products', (req, res) => {
  const { category, inStock } = req.query;
  let filtered = products;
  
  if (category) {
    filtered = filtered.filter(p => p.category === category);
  }
  if (inStock === 'true') {
    filtered = filtered.filter(p => p.inStock);
  }
  
  res.json(filtered);
});

// GET /products/popular - ДОЛЖЕН быть ПЕРЕД /products/:id
app.get('/products/popular', (req, res) => {
  // Возвращаем топ-3 товара
  res.json(products.slice(0, 3));
});

// GET /products/:id
app.get('/products/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'product-service' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Product Service running on port ${PORT}`);
});

