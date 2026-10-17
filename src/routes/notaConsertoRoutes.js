const express = require('express');
const router = express.Router();
const controller = require('../controllers/notaConsertoController');

router.get('/resumo', controller.resumoDashboard);
router.get('/', controller.listar);
router.get('/:id', controller.buscarPorId);
router.get('/:id/historico', controller.historico);
router.post('/', controller.criar);
router.put('/:id', controller.atualizarDados);
router.put('/:id/status', controller.atualizarStatus);
router.delete('/:id', controller.excluir);

module.exports = router;
