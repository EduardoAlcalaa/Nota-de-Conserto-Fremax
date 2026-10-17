const db = require('../config/db');

const SELECT_BASE = `
  SELECT
    n.*,
    f.nome AS fornecedor_nome,
    f.cnpj AS fornecedor_cnpj,
    f.contato_nome AS fornecedor_contato_nome,
    f.contato_email AS fornecedor_contato_email,
    f.contato_telefone AS fornecedor_contato_telefone
  FROM notas_conserto n
  JOIN fornecedores f ON f.id = n.fornecedor_id
`;

async function listar({ fornecedor_id, status, busca } = {}) {
  const condicoes = [];
  const valores = [];

  if (fornecedor_id) {
    valores.push(fornecedor_id);
    condicoes.push(`n.fornecedor_id = $${valores.length}`);
  }

  if (status) {
    valores.push(status);
    condicoes.push(`n.status = $${valores.length}`);
  }

  if (busca) {
    valores.push(`%${busca}%`);
    const p = `$${valores.length}`;
    condicoes.push(`(
      n.numero_nf ILIKE ${p}
      OR n.numero_rc ILIKE ${p}
      OR n.numero_pc ILIKE ${p}
      OR n.descricao ILIKE ${p}
      OR f.nome ILIKE ${p}
    )`);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  const sql = `${SELECT_BASE} ${where} ORDER BY n.criado_em DESC`;

  const { rows } = await db.query(sql, valores);
  return rows;
}

async function buscarPorId(id) {
  const { rows } = await db.query(`${SELECT_BASE} WHERE n.id = $1`, [id]);
  return rows[0] || null;
}

async function buscarPorNumeroNF(numero_nf, excetoId = null) {
  let sql = `${SELECT_BASE} WHERE LOWER(TRIM(n.numero_nf)) = LOWER(TRIM($1))`;
  const valores = [numero_nf];
  if (excetoId) {
    valores.push(excetoId);
    sql += ' AND n.id != $2';
  }
  const { rows } = await db.query(sql, valores);
  return rows[0] || null;
}

async function criar({
  numero_nf,
  fornecedor_id,
  descricao,
  responsavel_emissao,
  data_orcamento,
  valor_orcamento,
}) {
  const dataEfetivaOrcamento = data_orcamento || new Date().toISOString().slice(0, 10);

  const { rows } = await db.query(
    `INSERT INTO notas_conserto
       (numero_nf, fornecedor_id, descricao, responsavel_emissao, data_orcamento, valor_orcamento, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'orcamento_enviado')
     RETURNING *`,
    [
      numero_nf.trim(),
      fornecedor_id,
      descricao ? descricao.trim() : null,
      responsavel_emissao ? responsavel_emissao.trim() : 'Elton',
      dataEfetivaOrcamento,
      valor_orcamento ? Number(valor_orcamento) : null,
    ]
  );

  const novaNota = rows[0];

  await registrarHistorico({
    nota_id: novaNota.id,
    status_anterior: null,
    status_novo: 'orcamento_enviado',
    responsavel: responsavel_emissao || 'Elton',
    observacao: 'Nota de conserto cadastrada no sistema',
  });

  return buscarPorId(novaNota.id);
}

async function atualizarDados(id, dados) {
  const notaAtual = await buscarPorId(id);
  if (!notaAtual) return null;

  const camposPermitidos = [
    'numero_nf',
    'fornecedor_id',
    'descricao',
    'responsavel_emissao',
    'valor_orcamento',
    'data_orcamento',
    'numero_rc',
    'data_rc',
    'responsavel_rc',
    'numero_pc',
    'data_pc',
    'responsavel_pc',
    'data_em_conserto',
    'previsao_entrega',
    'data_entrega',
    'responsavel_entrega',
    'nf_retorno',
  ];

  const sets = [];
  const valores = [id];

  for (const campo of camposPermitidos) {
    if (dados[campo] !== undefined) {
      valores.push(dados[campo] === '' ? null : dados[campo]);
      sets.push(`${campo} = $${valores.length}`);
    }
  }

  if (sets.length > 0) {
    await db.query(
      `UPDATE notas_conserto SET ${sets.join(', ')} WHERE id = $1`,
      valores
    );
  }

  return buscarPorId(id);
}

async function atualizarStatus(id, {
  novoStatus,
  data,
  numero_rc,
  responsavel_rc,
  numero_pc,
  responsavel_pc,
  data_em_conserto,
  previsao_entrega,
  data_entrega,
  responsavel_entrega,
  nf_retorno,
  observacao,
  responsavel,
}) {
  const notaAtual = await buscarPorId(id);
  if (!notaAtual) return null;

  const dataEfetiva = data || new Date().toISOString().slice(0, 10);
  const sets = ['status = $2'];
  const valores = [id, novoStatus];

  function addSet(campo, valor) {
    valores.push(valor === '' ? null : valor);
    sets.push(`${campo} = $${valores.length}`);
  }

  // Tratamento por status de destino
  if (novoStatus === 'rc_criada') {
    addSet('data_rc', dataEfetiva);
    if (numero_rc !== undefined) addSet('numero_rc', numero_rc);
    if (responsavel_rc !== undefined) addSet('responsavel_rc', responsavel_rc);
  } else if (novoStatus === 'pc_criado') {
    addSet('data_pc', dataEfetiva);
    if (numero_pc !== undefined) addSet('numero_pc', numero_pc);
    if (responsavel_pc !== undefined) addSet('responsavel_pc', responsavel_pc);
  } else if (novoStatus === 'em_conserto') {
    addSet('data_em_conserto', data_em_conserto || dataEfetiva);
    if (previsao_entrega !== undefined) addSet('previsao_entrega', previsao_entrega);
  } else if (novoStatus === 'entregue') {
    addSet('data_entrega', data_entrega || dataEfetiva);
    if (responsavel_entrega !== undefined) addSet('responsavel_entrega', responsavel_entrega);
    if (nf_retorno !== undefined) addSet('nf_retorno', nf_retorno);
  }

  await db.query(
    `UPDATE notas_conserto SET ${sets.join(', ')} WHERE id = $1`,
    valores
  );

  await registrarHistorico({
    nota_id: id,
    status_anterior: notaAtual.status,
    status_novo: novoStatus,
    responsavel: responsavel || null,
    observacao: observacao || null,
  });

  return buscarPorId(id);
}

async function excluir(id) {
  const nota = await buscarPorId(id);
  if (!nota) return false;
  await db.query('DELETE FROM notas_conserto WHERE id = $1', [id]);
  return true;
}

async function registrarHistorico({ nota_id, status_anterior, status_novo, responsavel, observacao }) {
  await db.query(
    `INSERT INTO historico_status (nota_id, status_anterior, status_novo, responsavel, observacao)
     VALUES ($1, $2, $3, $4, $5)`,
    [nota_id, status_anterior, status_novo, responsavel, observacao]
  );
}

async function historico(nota_id) {
  const { rows } = await db.query(
    `SELECT * FROM historico_status WHERE nota_id = $1 ORDER BY criado_em ASC, id ASC`,
    [nota_id]
  );
  return rows;
}

module.exports = {
  listar,
  buscarPorId,
  buscarPorNumeroNF,
  criar,
  atualizarDados,
  atualizarStatus,
  excluir,
  historico,
};
