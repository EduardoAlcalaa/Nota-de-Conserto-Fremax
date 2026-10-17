const notaModel = require('../models/notaConsertoModel');
const prazoService = require('../services/prazoService');

const TRANSICOES_VALIDAS = {
  orcamento_enviado: ['rc_criada', 'cancelado'],
  rc_criada: ['pc_criado', 'orcamento_enviado', 'cancelado'],
  pc_criado: ['em_conserto', 'rc_criada', 'cancelado'],
  em_conserto: ['entregue', 'pc_criado', 'cancelado'],
  entregue: ['em_conserto'],
  cancelado: ['orcamento_enviado'],
};

async function listar(req, res) {
  try {
    const { fornecedor_id, status, busca, urgencia, situacao } = req.query;
    const notas = await notaModel.listar({ fornecedor_id, status, busca });
    let enriquecidas = notas.map(prazoService.enriquecerNota);

    if (urgencia) {
      enriquecidas = enriquecidas.filter((n) => n.nivelUrgencia === urgencia);
    }

    if (situacao === 'atrasado') {
      enriquecidas = enriquecidas.filter((n) => n.atrasado);
    } else if (situacao === 'no_prazo') {
      enriquecidas = enriquecidas.filter((n) => !n.atrasado && n.status !== 'entregue' && n.status !== 'cancelado');
    }

    res.json(enriquecidas);
  } catch (err) {
    console.error('Erro ao listar notas:', err);
    res.status(500).json({ erro: 'Erro ao listar notas de conserto' });
  }
}

async function buscarPorId(req, res) {
  try {
    const nota = await notaModel.buscarPorId(req.params.id);
    if (!nota) return res.status(404).json({ erro: 'Nota não encontrada' });

    const enriquecida = prazoService.enriquecerNota(nota);
    const hist = await notaModel.historico(req.params.id);

    res.json({ ...enriquecida, historico: hist });
  } catch (err) {
    console.error('Erro ao buscar nota:', err);
    res.status(500).json({ erro: 'Erro ao buscar nota' });
  }
}

async function criar(req, res) {
  try {
    const { numero_nf, fornecedor_id, descricao, responsavel_emissao, data_orcamento, valor_orcamento } = req.body;

    if (!numero_nf || !numero_nf.trim()) {
      return res.status(400).json({ erro: 'O número da NF é obrigatório' });
    }

    if (!fornecedor_id) {
      return res.status(400).json({ erro: 'Selecione um fornecedor para a nota' });
    }

    const existente = await notaModel.buscarPorNumeroNF(numero_nf);
    if (existente) {
      return res.status(409).json({ erro: 'Já existe uma nota cadastrada com esse número de NF' });
    }

    const nova = await notaModel.criar({
      numero_nf,
      fornecedor_id,
      descricao,
      responsavel_emissao,
      data_orcamento,
      valor_orcamento,
    });

    res.status(201).json(prazoService.enriquecerNota(nova));
  } catch (err) {
    console.error('Erro ao criar nota:', err);
    res.status(500).json({ erro: 'Erro ao criar nota de conserto' });
  }
}

async function atualizarDados(req, res) {
  try {
    const id = req.params.id;
    const notaAtual = await notaModel.buscarPorId(id);
    if (!notaAtual) return res.status(404).json({ erro: 'Nota não encontrada' });

    if (req.body.numero_nf) {
      const duplicada = await notaModel.buscarPorNumeroNF(req.body.numero_nf, id);
      if (duplicada) {
        return res.status(409).json({ erro: 'Já existe outra nota com esse número de NF' });
      }
    }

    const atualizada = await notaModel.atualizarDados(id, req.body);
    res.json(prazoService.enriquecerNota(atualizada));
  } catch (err) {
    console.error('Erro ao atualizar dados da nota:', err);
    res.status(500).json({ erro: 'Erro ao atualizar informações da nota' });
  }
}

async function atualizarStatus(req, res) {
  try {
    const id = req.params.id;
    const nota = await notaModel.buscarPorId(id);
    if (!nota) return res.status(404).json({ erro: 'Nota não encontrada' });

    const { novoStatus } = req.body;
    if (!novoStatus) return res.status(400).json({ erro: 'Campo "novoStatus" é obrigatório' });

    const permitidos = TRANSICOES_VALIDAS[nota.status] || [];
    if (!permitidos.includes(novoStatus)) {
      return res.status(422).json({
        erro: `Transição não permitida: de "${nota.status}" só é possível avançar para: ${permitidos.join(', ') || 'nenhum status'}`,
      });
    }

    const atualizada = await notaModel.atualizarStatus(id, req.body);
    res.json(prazoService.enriquecerNota(atualizada));
  } catch (err) {
    console.error('Erro ao atualizar status da nota:', err);
    res.status(500).json({ erro: 'Erro ao atualizar status da nota' });
  }
}

async function excluir(req, res) {
  try {
    const id = req.params.id;
    const nota = await notaModel.buscarPorId(id);
    if (!nota) return res.status(404).json({ erro: 'Nota não encontrada' });

    await notaModel.excluir(id);
    res.json({ mensagem: 'Nota de conserto excluída com sucesso' });
  } catch (err) {
    console.error('Erro ao excluir nota:', err);
    res.status(500).json({ erro: 'Erro ao excluir nota de conserto' });
  }
}

async function historico(req, res) {
  try {
    const registros = await notaModel.historico(req.params.id);
    res.json(registros);
  } catch (err) {
    console.error('Erro ao buscar histórico:', err);
    res.status(500).json({ erro: 'Erro ao buscar histórico' });
  }
}

async function resumoDashboard(req, res) {
  try {
    const todasNotas = (await notaModel.listar({})).map(prazoService.enriquecerNota);

    const porStatus = {
      orcamento_enviado: 0,
      rc_criada: 0,
      pc_criado: 0,
      em_conserto: 0,
      entregue: 0,
      cancelado: 0,
    };

    const porUrgencia = { normal: 0, atencao: 0, urgente: 0, multa: 0 };
    let totalAtivas = 0;
    let totalAtrasadasEtapa = 0;
    let valorTotalEmAberto = 0;

    todasNotas.forEach((n) => {
      porStatus[n.status] = (porStatus[n.status] || 0) + 1;

      if (n.status !== 'entregue' && n.status !== 'cancelado') {
        totalAtivas += 1;
        porUrgencia[n.nivelUrgencia] = (porUrgencia[n.nivelUrgencia] || 0) + 1;

        if (n.atrasado) {
          totalAtrasadasEtapa += 1;
        }

        if (n.valor_orcamento) {
          valorTotalEmAberto += Number(n.valor_orcamento);
        }
      }
    });

    res.json({
      total: todasNotas.length,
      totalAtivas,
      totalEntregues: porStatus.entregue,
      totalAtrasadasEtapa,
      valorTotalEmAberto,
      porStatus,
      porUrgencia,
    });
  } catch (err) {
    console.error('Erro ao gerar resumo do dashboard:', err);
    res.status(500).json({ erro: 'Erro ao gerar resumo do dashboard' });
  }
}

module.exports = {
  listar,
  buscarPorId,
  criar,
  atualizarDados,
  atualizarStatus,
  excluir,
  historico,
  resumoDashboard,
};
