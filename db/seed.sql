-- Dados de exemplo para testar o sistema completo

INSERT INTO fornecedores (nome, cnpj, contato_nome, contato_email, contato_telefone, cidade_uf, observacoes) VALUES
  ('Metalúrgica Sul Ltda', '12.345.678/0001-90', 'João Pereira', 'joao@metalsul.com.br', '(11) 98765-4321', 'São Paulo - SP', 'Especializada em usinagem pesada e caldeiraria'),
  ('Hidráulica Center', '23.456.789/0001-01', 'Marcos Lima', 'marcos@hidraulicacenter.com.br', '(19) 97654-3210', 'Campinas - SP', 'Bombas, pistões e comandos hidráulicos'),
  ('Retífica Norte Motores', '34.567.890/0001-12', 'Carla Souza', 'carla@retificanorte.com.br', '(11) 96543-2109', 'Guarulhos - SP', 'Rebobinamento e retífica de motores elétricos WEG e Siemens'),
  ('Válvulas & Conexões Brasil', '45.678.901/0001-23', 'Renato Dias', 'contato@valvulasbrasil.com.br', '(21) 99876-5432', 'Rio de Janeiro - RJ', 'Manutenção e calibração de válvulas industriais')
ON CONFLICT (nome) DO NOTHING;

-- 1. Nota recém criada, aguardando RC (dentro do prazo)
INSERT INTO notas_conserto (
  numero_nf, fornecedor_id, descricao, responsavel_emissao, data_orcamento, valor_orcamento, status
)
VALUES (
  'NF-1001', 1, 'Conserto e substituição de engrenagens do motor redutor linha 2', 'Elton', CURRENT_DATE - INTERVAL '10 days', 3500.00, 'orcamento_enviado'
)
ON CONFLICT (numero_nf) DO NOTHING;

-- 2. Nota com RC criada, aguardando Pedido de Compras
INSERT INTO notas_conserto (
  numero_nf, fornecedor_id, descricao, responsavel_emissao, data_orcamento, valor_orcamento,
  data_rc, numero_rc, responsavel_rc, status
)
VALUES (
  'NF-1002', 2, 'Reparo geral de vazamento e retífica do pistão hidráulico da prensa', 'Elton', CURRENT_DATE - INTERVAL '35 days', 6200.00,
  CURRENT_DATE - INTERVAL '5 days', 'RC-5521', 'Eduardo', 'rc_criada'
)
ON CONFLICT (numero_nf) DO NOTHING;

-- 3. Nota com Pedido de Compras criado, aguardando envio/início do conserto
INSERT INTO notas_conserto (
  numero_nf, fornecedor_id, descricao, responsavel_emissao, data_orcamento, valor_orcamento,
  data_rc, numero_rc, responsavel_rc,
  data_pc, numero_pc, responsavel_pc, status
)
VALUES (
  'NF-1004', 3, 'Rebobinamento completo do estator motor 50CV compressor', 'Elton', CURRENT_DATE - INTERVAL '60 days', 8900.00,
  CURRENT_DATE - INTERVAL '25 days', 'RC-5490', 'Ketlyn',
  CURRENT_DATE - INTERVAL '4 days', 'PC-9040', 'Compras', 'pc_criado'
)
ON CONFLICT (numero_nf) DO NOTHING;

-- 4. Nota em conserto no fornecedor (alerta de atenção - 4 meses de NF)
INSERT INTO notas_conserto (
  numero_nf, fornecedor_id, descricao, responsavel_emissao, data_orcamento, valor_orcamento,
  data_rc, numero_rc, responsavel_rc,
  data_pc, numero_pc, responsavel_pc,
  data_em_conserto, previsao_entrega, status
)
VALUES (
  'NF-1003', 3, 'Retífica e balanceamento dinâmico de eixo do moinho', 'Elton', CURRENT_DATE - INTERVAL '125 days', 12400.00,
  CURRENT_DATE - INTERVAL '100 days', 'RC-5480', 'Ketlyn',
  CURRENT_DATE - INTERVAL '80 days', 'PC-9012', 'Compras',
  CURRENT_DATE - INTERVAL '75 days', CURRENT_DATE + INTERVAL '10 days', 'em_conserto'
)
ON CONFLICT (numero_nf) DO NOTHING;

-- 5. Nota em conserto antiga (urgente/multa - mais de 5 meses)
INSERT INTO notas_conserto (
  numero_nf, fornecedor_id, descricao, responsavel_emissao, data_orcamento, valor_orcamento,
  data_rc, numero_rc, responsavel_rc,
  data_pc, numero_pc, responsavel_pc,
  data_em_conserto, previsao_entrega, status
)
VALUES (
  'NF-0998', 1, 'Manutenção preventiva e corretiva de painel elétrico inversor', 'Elton', CURRENT_DATE - INTERVAL '160 days', 4500.00,
  CURRENT_DATE - INTERVAL '140 days', 'RC-5470', 'Eduardo',
  CURRENT_DATE - INTERVAL '120 days', 'PC-9005', 'Compras',
  CURRENT_DATE - INTERVAL '115 days', CURRENT_DATE - INTERVAL '20 days', 'em_conserto'
)
ON CONFLICT (numero_nf) DO NOTHING;

-- 6. Nota concluída e entregue
INSERT INTO notas_conserto (
  numero_nf, fornecedor_id, descricao, responsavel_emissao, data_orcamento, valor_orcamento,
  data_rc, numero_rc, responsavel_rc,
  data_pc, numero_pc, responsavel_pc,
  data_em_conserto, data_entrega, responsavel_entrega, nf_retorno, status
)
VALUES (
  'NF-0985', 4, 'Calibração e teste hidrostático de válvula de segurança de caldeira', 'Elton', CURRENT_DATE - INTERVAL '90 days', 2100.00,
  CURRENT_DATE - INTERVAL '75 days', 'RC-5410', 'Eduardo',
  CURRENT_DATE - INTERVAL '60 days', 'PC-8980', 'Compras',
  CURRENT_DATE - INTERVAL '50 days', CURRENT_DATE - INTERVAL '10 days', 'Almoxarifado / Elton', 'NF-7734', 'entregue'
)
ON CONFLICT (numero_nf) DO NOTHING;
