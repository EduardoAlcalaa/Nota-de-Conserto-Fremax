-- =========================================================
-- Schema: Controle de Notas de Conserto
-- =========================================================

DO $$ BEGIN
  CREATE TYPE status_nota AS ENUM (
    'orcamento_enviado',  -- Fornecedor enviou orçamento / Aguardando RC
    'rc_criada',          -- RC criada (Eduardo / Ketlyn)
    'pc_criado',          -- Pedido de Compras criado (Compras)
    'em_conserto',        -- Fornecedor está consertando o material
    'entregue',           -- Material entregue de volta na empresa
    'cancelado'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE nivel_urgencia AS ENUM (
    'normal',
    'atencao',   -- 4 meses
    'urgente',   -- 5 meses
    'multa'      -- 6 meses ou mais
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ---------------------------------------------------------
-- Fornecedores
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS fornecedores (
  id               SERIAL PRIMARY KEY,
  nome             VARCHAR(150) NOT NULL UNIQUE,
  cnpj             VARCHAR(20),
  contato_nome     VARCHAR(120),
  contato_email    VARCHAR(150),
  contato_telefone VARCHAR(30),
  cidade_uf        VARCHAR(100),
  observacoes      TEXT,
  ativo            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------
-- Notas de Conserto (entidade principal)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS notas_conserto (
  id                  SERIAL PRIMARY KEY,
  numero_nf           VARCHAR(50) NOT NULL UNIQUE,
  fornecedor_id       INTEGER NOT NULL REFERENCES fornecedores(id),
  descricao           TEXT,
  responsavel_emissao VARCHAR(100) DEFAULT 'Elton',

  status              status_nota NOT NULL DEFAULT 'orcamento_enviado',

  -- Etapa 1: Orçamento / Emissão
  data_orcamento      DATE,              -- Marco inicial dos prazos
  valor_orcamento     NUMERIC(14,2),

  -- Etapa 2: Requisição de Compra (RC)
  data_rc             DATE,              -- RC criada (Eduardo/Ketlyn)
  numero_rc           VARCHAR(50),
  responsavel_rc      VARCHAR(100),

  -- Etapa 3: Pedido de Compras (PC)
  data_pc             DATE,              -- PC criado (Compras)
  numero_pc           VARCHAR(50),
  responsavel_pc      VARCHAR(100) DEFAULT 'Compras',

  -- Etapa 4: Em Conserto
  data_em_conserto    DATE,              -- Início do conserto no fornecedor
  previsao_entrega    DATE,              -- Previsão informada pelo fornecedor

  -- Etapa 5: Entrega
  data_entrega        DATE,              -- Material entregue de volta
  responsavel_entrega VARCHAR(100),      -- Quem recebeu na empresa
  nf_retorno          VARCHAR(50),       -- NF de retorno do conserto

  criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notas_numero_nf ON notas_conserto (numero_nf);
CREATE INDEX IF NOT EXISTS idx_notas_fornecedor ON notas_conserto (fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_notas_status ON notas_conserto (status);

-- ---------------------------------------------------------
-- Histórico de mudança de status (auditoria / trilha do fluxo)
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS historico_status (
  id              SERIAL PRIMARY KEY,
  nota_id         INTEGER NOT NULL REFERENCES notas_conserto(id) ON DELETE CASCADE,
  status_anterior status_nota,
  status_novo     status_nota NOT NULL,
  observacao      TEXT,
  responsavel     VARCHAR(100),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historico_nota ON historico_status (nota_id);

-- ---------------------------------------------------------
-- Trigger: atualiza atualizado_em automaticamente
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION atualizar_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notas_conserto_timestamp ON notas_conserto;
CREATE TRIGGER trg_notas_conserto_timestamp
BEFORE UPDATE ON notas_conserto
FOR EACH ROW EXECUTE FUNCTION atualizar_timestamp();
