require('dotenv').config();
const path = require('path');
const fs = require('fs');

let dbDriver = null;
let isSqlite = false;

// Tenta inicializar PostgreSQL se PGHOST estiver configurado
if (process.env.PGHOST && process.env.USE_SQLITE !== 'true') {
  try {
    const { Pool } = require('pg');
    const pool = new Pool({
      host: process.env.PGHOST,
      port: process.env.PGPORT || 5432,
      database: process.env.PGDATABASE || 'notas_conserto',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      connectionTimeoutMillis: 3000,
    });

    pool.on('error', (err) => {
      console.error('Erro no pool do PostgreSQL:', err.message);
    });

    dbDriver = {
      isSqlite: false,
      pool,
      async query(text, params = []) {
        return pool.query(text, params);
      },
    };
  } catch (err) {
    console.warn('Falha ao inicializar PostgreSQL. Alternando para SQLite embutido...', err.message);
  }
}

// Se não houver PostgreSQL configurado ou se falhar, utiliza SQLite nativo (node:sqlite)
if (!dbDriver) {
  isSqlite = true;
  const { DatabaseSync } = require('node:sqlite');
  const dbPath = path.resolve(__dirname, '../../db/notas_conserto.sqlite');

  // Garante que a pasta db existe
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const sqliteDb = new DatabaseSync(dbPath);

  // Inicializa o schema no SQLite caso as tabelas ainda não existam
  sqliteDb.exec(`
    CREATE TABLE IF NOT EXISTS fornecedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      cnpj TEXT,
      contato_nome TEXT,
      contato_email TEXT,
      contato_telefone TEXT,
      cidade_uf TEXT,
      observacoes TEXT,
      ativo INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notas_conserto (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_nf TEXT NOT NULL UNIQUE,
      fornecedor_id INTEGER NOT NULL REFERENCES fornecedores(id),
      descricao TEXT,
      responsavel_emissao TEXT DEFAULT 'Elton',
      status TEXT NOT NULL DEFAULT 'orcamento_enviado',
      data_orcamento TEXT,
      valor_orcamento REAL,
      data_rc TEXT,
      numero_rc TEXT,
      responsavel_rc TEXT,
      data_pc TEXT,
      numero_pc TEXT,
      responsavel_pc TEXT DEFAULT 'Compras',
      data_em_conserto TEXT,
      previsao_entrega TEXT,
      data_entrega TEXT,
      responsavel_entrega TEXT,
      nf_retorno TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS historico_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nota_id INTEGER NOT NULL REFERENCES notas_conserto(id) ON DELETE CASCADE,
      status_anterior TEXT,
      status_novo TEXT NOT NULL,
      observacao TEXT,
      responsavel TEXT,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Insere dados iniciais de fornecedores se a tabela estiver vazia
  const countFornecedores = sqliteDb.prepare('SELECT COUNT(*) as total FROM fornecedores').get();
  if (countFornecedores.total === 0) {
    sqliteDb.exec(`
      INSERT INTO fornecedores (nome, cnpj, contato_nome, contato_email, contato_telefone, cidade_uf, observacoes) VALUES
        ('Metalúrgica Sul Ltda', '12.345.678/0001-90', 'João Pereira', 'joao@metalsul.com.br', '(11) 98765-4321', 'São Paulo - SP', 'Especializada em usinagem pesada e caldeiraria'),
        ('Hidráulica Center', '23.456.789/0001-01', 'Marcos Lima', 'marcos@hidraulicacenter.com.br', '(19) 97654-3210', 'Campinas - SP', 'Bombas, pistões e comandos hidráulicos'),
        ('Retífica Norte Motores', '34.567.890/0001-12', 'Carla Souza', 'carla@retificanorte.com.br', '(11) 96543-2109', 'Guarulhos - SP', 'Rebobinamento e retífica de motores elétricos WEG e Siemens'),
        ('Válvulas & Conexões Brasil', '45.678.901/0001-23', 'Renato Dias', 'contato@valvulasbrasil.com.br', '(21) 99876-5432', 'Rio de Janeiro - RJ', 'Manutenção e calibração de válvulas industriais');
    `);

    // Insere notas de teste com datas relativas
    const hoje = new Date();
    const dataIso = (diasAtras) => {
      const d = new Date(hoje);
      d.setDate(d.getDate() - diasAtras);
      return d.toISOString().slice(0, 10);
    };

    sqliteDb.exec(`
      INSERT INTO notas_conserto (numero_nf, fornecedor_id, descricao, responsavel_emissao, data_orcamento, valor_orcamento, status)
      VALUES ('NF-1001', 1, 'Conserto e substituição de engrenagens do motor redutor linha 2', 'Elton', '${dataIso(10)}', 3500.00, 'orcamento_enviado');

      INSERT INTO notas_conserto (numero_nf, fornecedor_id, descricao, responsavel_emissao, data_orcamento, valor_orcamento, data_rc, numero_rc, responsavel_rc, status)
      VALUES ('NF-1002', 2, 'Reparo geral de vazamento e retífica do pistão hidráulico da prensa', 'Elton', '${dataIso(35)}', 6200.00, '${dataIso(5)}', 'RC-5521', 'Eduardo', 'rc_criada');

      INSERT INTO notas_conserto (numero_nf, fornecedor_id, descricao, responsavel_emissao, data_orcamento, valor_orcamento, data_rc, numero_rc, responsavel_rc, data_pc, numero_pc, responsavel_pc, status)
      VALUES ('NF-1004', 3, 'Rebobinamento completo do estator motor 50CV compressor', 'Elton', '${dataIso(60)}', 8900.00, '${dataIso(25)}', 'RC-5490', 'Ketlyn', '${dataIso(4)}', 'PC-9040', 'Compras', 'pc_criado');

      INSERT INTO notas_conserto (numero_nf, fornecedor_id, descricao, responsavel_emissao, data_orcamento, valor_orcamento, data_rc, numero_rc, responsavel_rc, data_pc, numero_pc, responsavel_pc, data_em_conserto, status)
      VALUES ('NF-1003', 3, 'Retífica e balanceamento dinâmico de eixo do moinho', 'Elton', '${dataIso(125)}', 12400.00, '${dataIso(100)}', 'RC-5480', 'Ketlyn', '${dataIso(80)}', 'PC-9012', 'Compras', '${dataIso(75)}', 'em_conserto');

      INSERT INTO notas_conserto (numero_nf, fornecedor_id, descricao, responsavel_emissao, data_orcamento, valor_orcamento, data_rc, numero_rc, responsavel_rc, data_pc, numero_pc, responsavel_pc, data_em_conserto, status)
      VALUES ('NF-0998', 1, 'Manutenção preventiva e corretiva de painel elétrico inversor', 'Elton', '${dataIso(160)}', 4500.00, '${dataIso(140)}', 'RC-5470', 'Eduardo', '${dataIso(120)}', 'PC-9005', 'Compras', '${dataIso(115)}', 'em_conserto');
    `);
  }

  dbDriver = {
    isSqlite: true,
    sqliteDb,
    async query(text, params = []) {
      const orderedParams = [];
      let convertedSql = text
        .replace(/\$(\d+)/g, (match, num) => {
          const idx = parseInt(num, 10) - 1;
          let val = params[idx];
          if (typeof val === 'boolean') val = val ? 1 : 0;
          if (val === undefined) val = null;
          orderedParams.push(val);
          return '?';
        })
        .replace(/ILIKE/gi, 'LIKE')
        .replace(/now\(\)/gi, "datetime('now')")
        .replace(/TRUE/gi, '1')
        .replace(/FALSE/gi, '0');

      const isSelect = /^\s*SELECT/i.test(convertedSql);
      const isReturning = /RETURNING/i.test(convertedSql);

      const stmt = sqliteDb.prepare(convertedSql);

      if (isSelect || isReturning) {
        const rows = stmt.all(...orderedParams);
        return { rows, rowCount: rows.length };
      } else {
        const res = stmt.run(...orderedParams);
        return { rows: [], rowCount: res.changes };
      }
    },
  };
}

module.exports = {
  query: (text, params) => dbDriver.query(text, params),
  isSqlite,
  pool: dbDriver.pool || null,
};
