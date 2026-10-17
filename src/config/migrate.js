require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('./db');

async function migrate() {
  if (db.isSqlite || !db.pool) {
    console.log('Ambiente configurado com SQLite local (db/notas_conserto.sqlite).');
    console.log('As tabelas já são inicializadas e mantidas automaticamente pelo sistema!');
    return;
  }

  const schemaPath = path.join(__dirname, '..', '..', 'db', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log('Executando schema.sql no banco PostgreSQL', process.env.PGDATABASE, '...');
  try {
    await db.pool.query(sql);
    console.log('Migração PostgreSQL concluída com sucesso!');
  } catch (err) {
    console.error('Erro ao migrar PostgreSQL:', err.message);
    process.exitCode = 1;
  } finally {
    if (db.pool) await db.pool.end();
  }
}

migrate();
