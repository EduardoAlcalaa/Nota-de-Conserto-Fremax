const express = require('express');
const cors = require('cors');
const path = require('path');

const fornecedorRoutes = require('./routes/fornecedorRoutes');
const notaConsertoRoutes = require('./routes/notaConsertoRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/fornecedores', fornecedorRoutes);
app.use('/api/notas', notaConsertoRoutes);

app.get('/api/saude', (req, res) => res.json({ status: 'ok' }));

app.use((req, res) => res.status(404).json({ erro: 'Rota não encontrada' }));

module.exports = app;
