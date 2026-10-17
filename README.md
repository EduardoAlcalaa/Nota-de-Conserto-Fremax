# Controle de Notas de Conserto

Aplicação para controle e monitoramento do fluxo de **Notas Fiscais de Conserto** enviadas a fornecedores: da emissão da NF e orçamento até a entrega final na empresa, com controle de prazos por etapa, alertas de urgência/multa contratual e gestão completa de fornecedores.

---

## Fluxo Completo das Etapas

O sistema acompanha rigorosamente o ciclo de vida de cada nota em 5 etapas principais:

```
1. Nota Criada / Aguardando RC   -> Prazo: 30 dias após emissão/orçamento
                │
                ▼
2. RC Criada                    -> Prazo: 15 dias após a criação da RC (Eduardo / Ketlyn)
                │
                ▼
3. Pedido de Compra Criado      -> Prazo: 10 dias após o PC para liberação/envio (Compras)
                │
                ▼
4. Em Conserto                  -> Prazo: 45 dias em conserto no fornecedor
                │
                ▼
5. Entregue na Empresa          -> Conclusão com NF de retorno e recebimento
```

### Níveis de Urgência Global (Risco Contratual)
Contados a partir da data de envio do orçamento / emissão da NF:
- **Normal**: até 3 meses e 29 dias
- **Atenção**: 4 meses
- **Urgente**: 5 meses
- **Multa**: 6 meses ou mais (prazo máximo de retorno estourado)

*Todos os prazos e meses de urgência são configuráveis no arquivo `.env` sem necessidade de alterar o código.*

---

## Novas Funcionalidades e Melhorias Implementadas

1. **Gestão Completa de Fornecedores**:
   - Cadastro, listagem, edição e ativação/desativação de fornecedores.
   - Dados detalhados: Razão Social, CNPJ (com máscara), Contato, Telefone/WhatsApp, E-mail, Cidade/UF e Especialidade.
   - **Atalho Rápido**: botão `+ Novo` diretamente no formulário de Nova Nota, selecionando automaticamente o parceiro recém-criado.
   - **Card de Contato Rápido**: clique no nome do fornecedor em qualquer ticket para ver telefone e e-mail imediatamente.
   - Contador de notas ativas em conserto por fornecedor.

2. **Visualização Detalhada da Nota com Stepper Timeline**:
   - Linha do tempo visual mostrando cada uma das 5 etapas (concluída com check verde, etapa atual em destaque, etapas pendentes).
   - Detalhes de datas, responsáveis e números dos documentos (NF, RC, PC, NF de retorno).
   - Histórico de auditoria completo com data, hora, responsável e observações registradas.

3. **Edição e Exclusão Segura**:
   - Possibilidade de editar informações da nota (número da NF, fornecedor, valor do orçamento, descrição, datas).
   - Exclusão com confirmação.

4. **Dashboard com Métricas (KPIs)**:
   - Total de Notas Ativas em aberto.
   - Total no Prazo vs Atrasadas na Etapa Atual.
   - Alertas por Urgência (Atenção, Urgente, Multa).
   - Valor Total em Aberto (R$) orçado em conserto.
   - Contadores em tempo real nas abas de cada etapa.

5. **Exportação de Relatórios para CSV / Excel**:
   - Botão para exportar a listagem de notas filtradas para planilha CSV com todas as colunas operacionais.

6. **Notificações Toast Modernas**:
   - Feedback visual imediato e elegante para operações de sucesso e erro.

7. **Suporte a Banco de Dados Híbrido (PostgreSQL + SQLite)**:
   - Se o PostgreSQL estiver configurado no `.env`, o sistema conecta ao PostgreSQL.
   - Se não houver PostgreSQL em execução ou configurado, o sistema inicializa automaticamente utilizando o SQLite nativo do Node.js (`db/notas_conserto.sqlite`), sem precisar instalar nada!

---

## Como Executar o Projeto

### Pré-requisitos
- Node.js 18+ (recomendado Node 20 ou 24)

### 1. Instalar Dependências
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente
O arquivo `.env` já vem pré-configurado com valores padrão:
```bash
cp .env.example .env
```

### 3. Iniciar o Servidor
```bash
npm run dev
# ou
npm start
```

Acesse no navegador: **http://localhost:3000**

*(Opcional: caso utilize PostgreSQL, crie o banco `createdb notas_conserto` e execute `npm run migrate`)*

---

## Endpoints da API REST

### Fornecedores (`/api/fornecedores`)
- `GET /api/fornecedores` — Lista fornecedores com contagem de notas ativas
- `GET /api/fornecedores/:id` — Detalhes de um fornecedor
- `POST /api/fornecedores` — Cadastra novo fornecedor
- `PUT /api/fornecedores/:id` — Atualiza dados ou status do fornecedor
- `DELETE /api/fornecedores/:id` — Exclui fornecedor (se não houver notas vinculadas)

### Notas de Conserto (`/api/notas`)
- `GET /api/notas/resumo` — Indicadores e contadores do dashboard (KPIs)
- `GET /api/notas` — Lista notas com filtros (`status`, `fornecedor_id`, `busca`, `urgencia`, `situacao`)
- `GET /api/notas/:id` — Detalhes completos da nota, linha do tempo e histórico
- `GET /api/notas/:id/historico` — Trilha de auditoria da nota
- `POST /api/notas` — Cadastra nova nota de conserto
- `PUT /api/notas/:id` — Atualiza dados cadastrais da nota
- `PUT /api/notas/:id/status` — Avança a etapa da nota e grava no histórico
- `DELETE /api/notas/:id` — Exclui uma nota de conserto
