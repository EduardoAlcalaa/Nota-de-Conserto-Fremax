const db = require('../config/db');

async function listar({ apenasAtivos = false, busca = '' } = {}) {
  const condicoes = [];
  const valores = [];

  if (apenasAtivos) {
    condicoes.push(`f.ativo = 1`);
  }

  if (busca) {
    valores.push(`%${busca}%`);
    condicoes.push(`(f.nome ILIKE $${valores.length} OR f.contato_nome ILIKE $${valores.length} OR f.cnpj ILIKE $${valores.length})`);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

  const sql = `
    SELECT
      f.*,
      COUNT(CASE WHEN n.status NOT IN ('entregue', 'cancelado') THEN 1 END) AS notas_ativas,
      COUNT(n.id) AS total_notas
    FROM fornecedores f
    LEFT JOIN notas_conserto n ON n.fornecedor_id = f.id
    ${where}
    GROUP BY f.id
    ORDER BY f.nome ASC
  `;

  const { rows } = await db.query(sql, valores);
  return rows;
}

async function buscarPorId(id) {
  const sql = `
    SELECT
      f.*,
      COUNT(CASE WHEN n.status NOT IN ('entregue', 'cancelado') THEN 1 END) AS notas_ativas,
      COUNT(n.id) AS total_notas
    FROM fornecedores f
    LEFT JOIN notas_conserto n ON n.fornecedor_id = f.id
    WHERE f.id = $1
    GROUP BY f.id
  `;
  const { rows } = await db.query(sql, [id]);
  return rows[0] || null;
}

async function buscarPorNome(nome, excetoId = null) {
  let sql = 'SELECT * FROM fornecedores WHERE LOWER(TRIM(nome)) = LOWER(TRIM($1))';
  const valores = [nome];
  if (excetoId) {
    valores.push(excetoId);
    sql += ' AND id != $2';
  }
  const { rows } = await db.query(sql, valores);
  return rows[0] || null;
}

async function criar({ nome, cnpj, contato_nome, contato_email, contato_telefone, cidade_uf, observacoes }) {
  const sql = `
    INSERT INTO fornecedores (nome, cnpj, contato_nome, contato_email, contato_telefone, cidade_uf, observacoes, ativo)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 1)
    RETURNING *
  `;
  const { rows } = await db.query(sql, [
    nome.trim(),
    cnpj ? cnpj.trim() : null,
    contato_nome ? contato_nome.trim() : null,
    contato_email ? contato_email.trim() : null,
    contato_telefone ? contato_telefone.trim() : null,
    cidade_uf ? cidade_uf.trim() : null,
    observacoes ? observacoes.trim() : null,
  ]);
  return rows[0];
}

async function atualizar(id, dados) {
  const campos = ['nome', 'cnpj', 'contato_nome', 'contato_email', 'contato_telefone', 'cidade_uf', 'observacoes', 'ativo'];
  const sets = [];
  const valores = [id];

  for (const campo of campos) {
    if (dados[campo] !== undefined) {
      valores.push(dados[campo]);
      sets.push(`${campo} = $${valores.length}`);
    }
  }

  if (sets.length === 0) {
    return buscarPorId(id);
  }

  const sql = `
    UPDATE fornecedores
    SET ${sets.join(', ')}
    WHERE id = $1
    RETURNING *
  `;

  const { rows } = await db.query(sql, valores);
  return rows[0] || null;
}

async function excluir(id) {
  // Verifica se existem notas associadas antes de excluir
  const { rows: notas } = await db.query('SELECT COUNT(*) as total FROM notas_conserto WHERE fornecedor_id = $1', [id]);
  const totalNotas = Number(notas[0]?.total || 0);

  if (totalNotas > 0) {
    throw new Error(`Não é possível excluir: existem ${totalNotas} nota(s) vinculada(s) a este fornecedor. Recomendamos desativar o fornecedor.`);
  }

  await db.query('DELETE FROM fornecedores WHERE id = $1', [id]);
  return true;
}

module.exports = {
  listar,
  buscarPorId,
  buscarPorNome,
  criar,
  atualizar,
  excluir,
};
