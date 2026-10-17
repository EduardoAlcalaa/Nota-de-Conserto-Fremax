const fornecedorModel = require('../models/fornecedorModel');

async function listar(req, res) {
  try {
    const apenasAtivos = req.query.ativos === 'true';
    const busca = req.query.busca || '';
    const fornecedores = await fornecedorModel.listar({ apenasAtivos, busca });
    res.json(fornecedores);
  } catch (err) {
    console.error('Erro ao listar fornecedores:', err);
    res.status(500).json({ erro: 'Erro ao listar fornecedores' });
  }
}

async function buscarPorId(req, res) {
  try {
    const fornecedor = await fornecedorModel.buscarPorId(req.params.id);
    if (!fornecedor) {
      return res.status(404).json({ erro: 'Fornecedor não encontrado' });
    }
    res.json(fornecedor);
  } catch (err) {
    console.error('Erro ao buscar fornecedor:', err);
    res.status(500).json({ erro: 'Erro ao buscar fornecedor' });
  }
}

async function criar(req, res) {
  try {
    const { nome, cnpj, contato_nome, contato_email, contato_telefone, cidade_uf, observacoes } = req.body;

    if (!nome || !nome.trim()) {
      return res.status(400).json({ erro: 'O nome do fornecedor é obrigatório' });
    }

    const existente = await fornecedorModel.buscarPorNome(nome);
    if (existente) {
      return res.status(409).json({ erro: 'Já existe um fornecedor cadastrado com este nome' });
    }

    const novo = await fornecedorModel.criar({
      nome,
      cnpj,
      contato_nome,
      contato_email,
      contato_telefone,
      cidade_uf,
      observacoes,
    });

    res.status(201).json(novo);
  } catch (err) {
    console.error('Erro ao criar fornecedor:', err);
    if (err.code === '23505' || err.message?.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ erro: 'Já existe um fornecedor cadastrado com esse nome' });
    }
    res.status(500).json({ erro: 'Erro ao criar fornecedor' });
  }
}

async function atualizar(req, res) {
  try {
    const id = req.params.id;
    const existente = await fornecedorModel.buscarPorId(id);
    if (!existente) {
      return res.status(404).json({ erro: 'Fornecedor não encontrado' });
    }

    if (req.body.nome) {
      const duplicado = await fornecedorModel.buscarPorNome(req.body.nome, id);
      if (duplicado) {
        return res.status(409).json({ erro: 'Já existe outro fornecedor cadastrado com este nome' });
      }
    }

    const atualizado = await fornecedorModel.atualizar(id, req.body);
    res.json(atualizado);
  } catch (err) {
    console.error('Erro ao atualizar fornecedor:', err);
    res.status(500).json({ erro: 'Erro ao atualizar fornecedor' });
  }
}

async function excluir(req, res) {
  try {
    const id = req.params.id;
    const existente = await fornecedorModel.buscarPorId(id);
    if (!existente) {
      return res.status(404).json({ erro: 'Fornecedor não encontrado' });
    }

    await fornecedorModel.excluir(id);
    res.json({ mensagem: 'Fornecedor excluído com sucesso' });
  } catch (err) {
    console.error('Erro ao excluir fornecedor:', err);
    res.status(400).json({ erro: err.message || 'Erro ao excluir fornecedor' });
  }
}

module.exports = {
  listar,
  buscarPorId,
  criar,
  atualizar,
  excluir,
};
