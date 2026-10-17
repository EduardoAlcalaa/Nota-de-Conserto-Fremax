const API = '/api';

const STATUS_LABEL = {
  orcamento_enviado: '1. Aguardando RC',
  rc_criada: '2. RC criada',
  pc_criado: '3. Pedido criado',
  em_conserto: '4. Em conserto',
  entregue: '5. Entregue',
  cancelado: 'Cancelado',
};

const TRANSICOES = {
  orcamento_enviado: ['rc_criada', 'cancelado'],
  rc_criada: ['pc_criado', 'orcamento_enviado', 'cancelado'],
  pc_criado: ['em_conserto', 'rc_criada', 'cancelado'],
  em_conserto: ['entregue', 'pc_criado', 'cancelado'],
  entregue: ['em_conserto'],
  cancelado: ['orcamento_enviado'],
};

const URGENCIA_LABEL = {
  normal: 'Normal',
  atencao: 'Atenção (4m)',
  urgente: 'Urgente (5m)',
  multa: 'Multa (6m+)',
};

let fornecedoresCache = [];
let notasCache = [];
let filtroStatusAtual = '';
let notaEmEdicao = null;
let abertoPeloAtalhoNovaNota = false;

// ---------------- Utilidades de Formatação ----------------
function formatarData(iso) {
  if (!iso) return '—';
  const str = String(iso).slice(0, 10);
  const [ano, mes, dia] = str.split('-');
  if (!ano || !mes || !dia) return iso;
  return `${dia}/${mes}/${ano}`;
}

function formatarMoeda(valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  return Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarCnpj(cnpj) {
  if (!cnpj) return '—';
  const limpo = cnpj.replace(/\D/g, '');
  if (limpo.length !== 14) return cnpj;
  return limpo.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatarTelefone(tel) {
  if (!tel) return '—';
  const limpo = tel.replace(/\D/g, '');
  if (limpo.length === 11) {
    return limpo.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }
  if (limpo.length === 10) {
    return limpo.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }
  return tel;
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------- Toast Notifications ----------------
function mostrarToast(mensagem, tipo = 'sucesso') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;

  const icone = tipo === 'sucesso' ? '✅' : tipo === 'erro' ? '❌' : 'ℹ️';
  toast.innerHTML = `<span>${icone}</span> <span>${mensagem}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// ---------------- Requisições API ----------------
async function api(path, options = {}) {
  const resp = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(dados.erro || 'Ocorreu um erro na requisição');
  }
  return dados;
}

// ---------------- Controle de Modais ----------------
function abrirModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('aberto');
}

function fecharModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('aberto');
}

document.querySelectorAll('[data-fechar]').forEach((el) => {
  el.addEventListener('click', () => fecharModal(el.dataset.fechar));
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.aberto').forEach((m) => m.classList.remove('aberto'));
  }
});

document.querySelectorAll('.modal-overlay').forEach((overlay) => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.remove('aberto');
    }
  });
});

// ---------------- Carregamento de Fornecedores ----------------
async function carregarFornecedores() {
  try {
    fornecedoresCache = await api('/fornecedores');

    const selectFiltro = document.getElementById('filtro-fornecedor');
    const selectFormNova = document.getElementById('select-fornecedor-form');
    const selectFormEdit = document.getElementById('edit-fornecedor-id');
    const badgeTotal = document.getElementById('badge-total-fornecedores');

    if (badgeTotal) badgeTotal.textContent = fornecedoresCache.length;

    const valorFiltroAtual = selectFiltro.value;
    selectFiltro.innerHTML = '<option value="">Todos os fornecedores</option>';
    selectFormNova.innerHTML = '<option value="">Selecione um fornecedor...</option>';
    selectFormEdit.innerHTML = '';

    fornecedoresCache.forEach((f) => {
      const optFiltro = document.createElement('option');
      optFiltro.value = f.id;
      optFiltro.textContent = `${f.nome} ${f.notas_ativas > 0 ? `(${f.notas_ativas})` : ''}`;
      selectFiltro.appendChild(optFiltro);

      if (f.ativo) {
        const optNova = document.createElement('option');
        optNova.value = f.id;
        optNova.textContent = f.nome;
        selectFormNova.appendChild(optNova);

        const optEdit = document.createElement('option');
        optEdit.value = f.id;
        optEdit.textContent = f.nome;
        selectFormEdit.appendChild(optEdit);
      }
    });

    selectFiltro.value = valorFiltroAtual;
  } catch (err) {
    mostrarToast(err.message, 'erro');
  }
}

// ---------------- Modal: Gerenciamento de Fornecedores ----------------
document.getElementById('btn-gerenciar-fornecedores').addEventListener('click', () => {
  renderizarTabelaFornecedores();
  abrirModal('modal-fornecedores');
});

function renderizarTabelaFornecedores(filtroTexto = '') {
  const corpo = document.getElementById('corpo-tabela-fornecedores');
  const termo = filtroTexto.toLowerCase();

  const filtrados = fornecedoresCache.filter((f) => {
    return (
      f.nome.toLowerCase().includes(termo) ||
      (f.cnpj && f.cnpj.toLowerCase().includes(termo)) ||
      (f.contato_nome && f.contato_nome.toLowerCase().includes(termo))
    );
  });

  if (!filtrados.length) {
    corpo.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">Nenhum fornecedor encontrado.</td></tr>`;
    return;
  }

  corpo.innerHTML = filtrados.map((f) => `
    <tr>
      <td>
        <strong>${f.nome}</strong>
        ${f.cidade_uf ? `<div style="font-size:11.5px; color:var(--text-muted);">${f.cidade_uf}</div>` : ''}
      </td>
      <td style="font-family: var(--font-mono);">${formatarCnpj(f.cnpj)}</td>
      <td>${f.contato_nome || '—'}</td>
      <td>
        <div>${formatarTelefone(f.contato_telefone)}</div>
        <div style="font-size:11.5px; color:var(--text-muted);">${f.contato_email || '—'}</div>
      </td>
      <td>
        <span class="pill-badge" style="color: ${f.notas_ativas > 0 ? 'var(--atencao)' : 'var(--text-muted)'};">
          ${f.notas_ativas || 0} em conserto
        </span>
      </td>
      <td>
        <div class="acoes-tabela">
          <button class="btn btn-secundario" style="padding: 4px 8px; font-size: 11.5px;" onclick="editarFornecedor(${f.id})">Editar</button>
          <button class="btn btn-secundario" style="padding: 4px 8px; font-size: 11.5px;" onclick="alternarAtivoFornecedor(${f.id}, ${f.ativo ? 0 : 1})">
            ${f.ativo ? 'Desativar' : 'Ativar'}
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

document.getElementById('busca-fornecedor-lista').addEventListener('input', (e) => {
  renderizarTabelaFornecedores(e.target.value);
});

// ---------------- Modal: Criar / Editar Fornecedor ----------------
document.getElementById('btn-cadastrar-novo-fornecedor').addEventListener('click', () => {
  abrirModalFormFornecedor();
});

document.getElementById('btn-atalho-novo-fornecedor').addEventListener('click', () => {
  abertoPeloAtalhoNovaNota = true;
  abrirModalFormFornecedor();
});

function abrirModalFormFornecedor(fornecedor = null) {
  const form = document.getElementById('form-fornecedor');
  form.reset();

  const titulo = document.getElementById('titulo-form-fornecedor');
  if (fornecedor) {
    titulo.textContent = 'Editar Fornecedor';
    document.getElementById('fornecedor-id').value = fornecedor.id;
    document.getElementById('fornecedor-nome').value = fornecedor.nome;
    document.getElementById('fornecedor-cnpj').value = fornecedor.cnpj || '';
    document.getElementById('fornecedor-cidade').value = fornecedor.cidade_uf || '';
    document.getElementById('fornecedor-contato-nome').value = fornecedor.contato_nome || '';
    document.getElementById('fornecedor-contato-telefone').value = fornecedor.contato_telefone || '';
    document.getElementById('fornecedor-contato-email').value = fornecedor.contato_email || '';
    document.getElementById('fornecedor-observacoes').value = fornecedor.observacoes || '';
  } else {
    titulo.textContent = 'Cadastrar Novo Fornecedor';
    document.getElementById('fornecedor-id').value = '';
  }

  abrirModal('modal-form-fornecedor');
}

window.editarFornecedor = function(id) {
  const f = fornecedoresCache.find((item) => item.id === id);
  if (f) abrirModalFormFornecedor(f);
};

window.alternarAtivoFornecedor = async function(id, novoStatus) {
  try {
    await api(`/fornecedores/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ ativo: novoStatus === 1 }),
    });
    mostrarToast(`Fornecedor ${novoStatus === 1 ? 'ativado' : 'desativado'} com sucesso!`);
    await carregarFornecedores();
    renderizarTabelaFornecedores(document.getElementById('busca-fornecedor-lista').value);
  } catch (err) {
    mostrarToast(err.message, 'erro');
  }
};

document.getElementById('form-fornecedor').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const payload = Object.fromEntries(new FormData(form).entries());
  const id = payload.id;
  delete payload.id;

  try {
    let salvo;
    if (id) {
      salvo = await api(`/fornecedores/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      mostrarToast('Fornecedor atualizado com sucesso!');
    } else {
      salvo = await api('/fornecedores', { method: 'POST', body: JSON.stringify(payload) });
      mostrarToast('Novo fornecedor cadastrado com sucesso!');
    }

    fecharModal('modal-form-fornecedor');
    await carregarFornecedores();
    renderizarTabelaFornecedores(document.getElementById('busca-fornecedor-lista').value);

    // Se foi aberto pelo atalho da Nova Nota, já seleciona o novo fornecedor
    if (abertoPeloAtalhoNovaNota && salvo) {
      document.getElementById('select-fornecedor-form').value = salvo.id;
      abertoPeloAtalhoNovaNota = false;
    }
  } catch (err) {
    mostrarToast(err.message, 'erro');
  }
});

// Card Rápido de Contato do Fornecedor ao clicar no nome
window.mostrarContatoFornecedor = function(fornecedorId) {
  const f = fornecedoresCache.find((item) => item.id === fornecedorId);
  if (!f) return;

  document.getElementById('contato-card-nome').textContent = f.nome;
  document.getElementById('contato-card-conteudo').innerHTML = `
    <div class="contato-linha">
      <span class="contato-label">CNPJ</span>
      <span class="contato-valor">${formatarCnpj(f.cnpj)}</span>
    </div>
    <div class="contato-linha">
      <span class="contato-label">Contato / Responsável</span>
      <span class="contato-valor">${f.contato_nome || '—'}</span>
    </div>
    <div class="contato-linha">
      <span class="contato-label">Telefone / WhatsApp</span>
      <span class="contato-valor">${formatarTelefone(f.contato_telefone)}</span>
    </div>
    <div class="contato-linha">
      <span class="contato-label">E-mail</span>
      <span class="contato-valor">${f.contato_email || '—'}</span>
    </div>
    <div class="contato-linha">
      <span class="contato-label">Localização</span>
      <span class="contato-valor">${f.cidade_uf || '—'}</span>
    </div>
    ${f.observacoes ? `
      <div class="contato-linha">
        <span class="contato-label">Observações / Especialidade</span>
        <span class="contato-valor" style="font-size: 12.5px; color: var(--text-muted);">${f.observacoes}</span>
      </div>
    ` : ''}
  `;

  abrirModal('modal-contato-fornecedor');
};

// ---------------- Resumo / Dashboard ----------------
async function carregarResumo() {
  try {
    const resumo = await api('/notas/resumo');
    const barra = document.getElementById('resumo-bar');
    const u = resumo.porUrgencia || {};
    const s = resumo.porStatus || {};

    barra.innerHTML = `
      <div class="resumo-item">
        <span class="resumo-num">${resumo.totalAtivas}</span>
        <span class="resumo-label">Notas em Aberto</span>
      </div>
      <div class="resumo-item ${resumo.totalAtrasadasEtapa > 0 ? 'multa' : 'normal'}">
        <span class="resumo-num">${resumo.totalAtrasadasEtapa}</span>
        <span class="resumo-label">Atrasadas na Etapa</span>
      </div>
      <div class="resumo-item normal">
        <span class="resumo-num">${u.normal || 0}</span>
        <span class="resumo-label">Normal (&lt; 4 meses)</span>
      </div>
      <div class="resumo-item atencao">
        <span class="resumo-num">${u.atencao || 0}</span>
        <span class="resumo-label">Atenção (4 meses)</span>
      </div>
      <div class="resumo-item urgente">
        <span class="resumo-num">${u.urgente || 0}</span>
        <span class="resumo-label">Urgente (5 meses)</span>
      </div>
      <div class="resumo-item multa">
        <span class="resumo-num">${u.multa || 0}</span>
        <span class="resumo-label">Multa (6+ meses)</span>
      </div>
      <div class="resumo-item destaque-valor">
        <span class="resumo-num">${formatarMoeda(resumo.valorTotalEmAberto)}</span>
        <span class="resumo-label">Valor Total Orçado</span>
      </div>
    `;

    // Atualiza contadores nas abas
    document.getElementById('tab-cnt-todas').textContent = resumo.total;
    document.getElementById('tab-cnt-orcamento').textContent = s.orcamento_enviado || 0;
    document.getElementById('tab-cnt-rc').textContent = s.rc_criada || 0;
    document.getElementById('tab-cnt-pc').textContent = s.pc_criado || 0;
    document.getElementById('tab-cnt-conserto').textContent = s.em_conserto || 0;
    document.getElementById('tab-cnt-entregue').textContent = s.entregue || 0;
  } catch (err) {
    console.error('Erro ao carregar resumo:', err);
  }
}

// ---------------- Carregamento e Renderização de Notas ----------------
async function carregarNotas() {
  const busca = document.getElementById('busca-global').value.trim();
  const fornecedor_id = document.getElementById('filtro-fornecedor').value;
  const situacao = document.getElementById('filtro-situacao').value;
  const urgencia = document.getElementById('filtro-urgencia').value;

  const params = new URLSearchParams();
  if (filtroStatusAtual) params.set('status', filtroStatusAtual);
  if (busca) params.set('busca', busca);
  if (fornecedor_id) params.set('fornecedor_id', fornecedor_id);
  if (situacao) params.set('situacao', situacao);
  if (urgencia) params.set('urgencia', urgencia);

  try {
    notasCache = await api(`/notas?${params.toString()}`);
    renderizarLista(notasCache);
  } catch (err) {
    mostrarToast(err.message, 'erro');
  }
}

function renderizarLista(notas) {
  const container = document.getElementById('lista-notas');
  const contador = document.getElementById('contador-resultados');

  contador.textContent = `${notas.length} nota(s) encontrada(s)`;

  if (!notas.length) {
    container.innerHTML = `
      <div class="lista-vazia">
        <strong>Nenhuma nota encontrada com os filtros selecionados.</strong>
        <p>Tente ajustar a busca ou limpar os filtros para ver outras etapas do fluxo.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = notas.map((n) => {
    let prazoHtml = '—';
    if (n.status === 'entregue') {
      prazoHtml = `<span class="prazo-ok">Entregue em ${formatarData(n.data_entrega)}</span>`;
    } else if (n.status === 'cancelado') {
      prazoHtml = `<span style="color:var(--text-faint);">Fluxo cancelado</span>`;
    } else if (n.prazoLimite) {
      if (n.atrasado) {
        prazoHtml = `
          <div class="prazo-atrasado">
            <span>⚠️ Atrasado</span>
          </div>
          <div class="prazo-dias-sub">Limite era ${formatarData(n.prazoLimite)} (${Math.abs(n.diasRestantes)}d atrás)</div>
        `;
      } else {
        prazoHtml = `
          <div class="prazo-ok">
            <span>Até ${formatarData(n.prazoLimite)}</span>
          </div>
          <div class="prazo-dias-sub" style="color:var(--accent);">Restam ${n.diasRestantes} dia(s)</div>
        `;
      }
    }

    return `
      <div class="ticket">
        <div class="ticket-barra ${n.nivelUrgencia}"></div>

        <div>
          <div class="ticket-nf-row">
            <span class="ticket-nf" onclick="abrirModalDetalhes(${n.id})">${n.numero_nf}</span>
            <span class="badge-urgencia ${n.nivelUrgencia}">${URGENCIA_LABEL[n.nivelUrgencia] || n.nivelUrgencia}</span>
          </div>
          <div class="ticket-fornecedor">
            <span>🏢</span>
            <button class="ticket-fornecedor-btn" onclick="mostrarContatoFornecedor(${n.fornecedor_id})">
              ${n.fornecedor_nome}
            </button>
          </div>
          ${n.descricao ? `<div class="ticket-desc" title="${n.descricao}">${n.descricao}</div>` : ''}
        </div>

        <div>
          <div class="ticket-col-label">Etapa Atual</div>
          <span class="badge-etapa">${n.descricaoEtapa || STATUS_LABEL[n.status]}</span>
          ${n.valor_orcamento ? `<div style="font-size:11.5px; color:#5bc0be; margin-top:3px; font-family:var(--font-mono);">${formatarMoeda(n.valor_orcamento)}</div>` : ''}
        </div>

        <div>
          <div class="ticket-col-label">Tempo em Aberto</div>
          <div class="ticket-col-valor">${n.diasEmAberto ?? 0} dias</div>
          <div style="font-size:11px; color:var(--text-faint);">Início: ${formatarData(n.data_orcamento)}</div>
        </div>

        <div>
          <div class="ticket-col-label">Situação da Etapa</div>
          ${prazoHtml}
        </div>

        <div class="ticket-acoes">
          ${n.status !== 'entregue' && n.status !== 'cancelado' ? `
            <button class="btn btn-ticket-avancar" onclick="abrirModalEditarStatus(${n.id})">Avançar Etapa</button>
          ` : ''}
          <button class="btn btn-ticket-detalhes" onclick="abrirModalDetalhes(${n.id})" title="Ver linha do tempo e histórico">👁 Detalhes</button>
          <button class="btn btn-ticket-editar" onclick="abrirModalEditarNota(${n.id})" title="Editar dados da nota">✏️</button>
        </div>
      </div>
    `;
  }).join('');
}

// ---------------- Tabs de Etapas ----------------
document.getElementById('tabs').addEventListener('click', (e) => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  btn.classList.add('active');
  filtroStatusAtual = btn.dataset.status;
  carregarNotas();
});

// ---------------- Filtros e Busca ----------------
document.getElementById('filtro-fornecedor').addEventListener('change', carregarNotas);
document.getElementById('filtro-situacao').addEventListener('change', carregarNotas);
document.getElementById('filtro-urgencia').addEventListener('change', carregarNotas);

let debounceBusca;
document.getElementById('busca-global').addEventListener('input', () => {
  clearTimeout(debounceBusca);
  debounceBusca = setTimeout(carregarNotas, 250);
});

document.getElementById('btn-limpar-filtros').addEventListener('click', () => {
  document.getElementById('busca-global').value = '';
  document.getElementById('filtro-fornecedor').value = '';
  document.getElementById('filtro-situacao').value = '';
  document.getElementById('filtro-urgencia').value = '';
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  document.querySelector('.tab[data-status=""]').classList.add('active');
  filtroStatusAtual = '';
  carregarNotas();
});

// ---------------- Modal: Nova Nota ----------------
document.getElementById('btn-nova-nota').addEventListener('click', () => {
  const form = document.getElementById('form-nova-nota');
  form.reset();
  document.getElementById('nova-nota-data-orcamento').value = hojeIso();
  abrirModal('modal-nova-nota');
});

document.getElementById('form-nova-nota').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const payload = Object.fromEntries(new FormData(form).entries());

  try {
    await api('/notas', { method: 'POST', body: JSON.stringify(payload) });
    form.reset();
    fecharModal('modal-nova-nota');
    mostrarToast('Nota de conserto cadastrada com sucesso!');
    await Promise.all([carregarResumo(), carregarNotas(), carregarFornecedores()]);
  } catch (err) {
    mostrarToast(err.message, 'erro');
  }
});

// ---------------- Modal: Avançar / Atualizar Status ----------------
window.abrirModalEditarStatus = async function(id) {
  try {
    const nota = await api(`/notas/${id}`);
    notaEmEdicao = nota;

    document.getElementById('detalhe-nota-atual').innerHTML = `
      NF <strong>${nota.numero_nf}</strong> · ${nota.fornecedor_nome}<br/>
      Etapa atual: <strong>${STATUS_LABEL[nota.status] || nota.status}</strong> · ${nota.diasEmAberto ?? 0} dias em aberto
    `;

    const form = document.getElementById('form-editar-status');
    form.reset();
    form.nota_id.value = id;

    const selectStatus = document.getElementById('select-novo-status');
    const opcoes = TRANSICOES[nota.status] || [];

    if (!opcoes.length) {
      selectStatus.innerHTML = '<option value="">Fluxo encerrado</option>';
      document.getElementById('campos-extra-status').innerHTML = '';
      return;
    }

    selectStatus.innerHTML = opcoes.map((s) => `<option value="${s}">${STATUS_LABEL[s] || s}</option>`).join('');

    renderizarCamposExtrasStatus(selectStatus.value, nota);
    abrirModal('modal-editar-status');
  } catch (err) {
    mostrarToast(err.message, 'erro');
  }
};

document.getElementById('select-novo-status').addEventListener('change', (e) => {
  renderizarCamposExtrasStatus(e.target.value, notaEmEdicao);
});

function renderizarCamposExtrasStatus(status, nota = {}) {
  const container = document.getElementById('campos-extra-status');
  const respInput = document.getElementById('input-responsavel-status');

  if (status === 'rc_criada') {
    respInput.value = nota.responsavel_rc || 'Eduardo';
    container.innerHTML = `
      <div class="form-row">
        <div class="form-col">
          <label>Número da RC *</label>
          <input type="text" name="numero_rc" value="${nota.numero_rc || ''}" placeholder="Ex: RC-5521" required />
        </div>
        <div class="form-col">
          <label>Data da RC *</label>
          <input type="date" name="data" value="${hojeIso()}" required />
        </div>
      </div>
    `;
  } else if (status === 'pc_criado') {
    respInput.value = nota.responsavel_pc || 'Compras';
    container.innerHTML = `
      <div class="form-row">
        <div class="form-col">
          <label>Número do Pedido (PC) *</label>
          <input type="text" name="numero_pc" value="${nota.numero_pc || ''}" placeholder="Ex: PC-9012" required />
        </div>
        <div class="form-col">
          <label>Data do Pedido *</label>
          <input type="date" name="data" value="${hojeIso()}" required />
        </div>
      </div>
    `;
  } else if (status === 'em_conserto') {
    respInput.value = nota.responsavel_emissao || 'Elton';
    container.innerHTML = `
      <div class="form-row">
        <div class="form-col">
          <label>Data Início Conserto *</label>
          <input type="date" name="data_em_conserto" value="${hojeIso()}" required />
        </div>
        <div class="form-col">
          <label>Previsão de Entrega (Fornecedor)</label>
          <input type="date" name="previsao_entrega" value="${nota.previsao_entrega ? nota.previsao_entrega.slice(0, 10) : ''}" />
        </div>
      </div>
    `;
  } else if (status === 'entregue') {
    respInput.value = 'Almoxarifado / Recebimento';
    container.innerHTML = `
      <div class="form-row">
        <div class="form-col">
          <label>Data da Entrega *</label>
          <input type="date" name="data_entrega" value="${hojeIso()}" required />
        </div>
        <div class="form-col">
          <label>NF de Retorno</label>
          <input type="text" name="nf_retorno" placeholder="Ex: NF-7734" />
        </div>
      </div>
      <label>Recebido por</label>
      <input type="text" name="responsavel_entrega" placeholder="Nome do recebedor" />
    `;
  } else {
    container.innerHTML = '';
  }
}

document.getElementById('form-editar-status').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const payload = Object.fromEntries(new FormData(form).entries());
  const id = payload.nota_id;
  delete payload.nota_id;

  try {
    await api(`/notas/${id}/status`, { method: 'PUT', body: JSON.stringify(payload) });
    fecharModal('modal-editar-status');
    fecharModal('modal-detalhes-nota');
    mostrarToast('Status da nota atualizado com sucesso!');
    await Promise.all([carregarResumo(), carregarNotas(), carregarFornecedores()]);
  } catch (err) {
    mostrarToast(err.message, 'erro');
  }
});

// ---------------- Modal: Detalhes com Linha do Tempo ----------------
window.abrirModalDetalhes = async function(id) {
  try {
    const nota = await api(`/notas/${id}`);
    notaEmEdicao = nota;

    document.getElementById('detalhes-titulo').textContent = nota.numero_nf;

    const badgeEtapa = document.getElementById('detalhes-badge-etapa');
    badgeEtapa.textContent = nota.descricaoEtapa || STATUS_LABEL[nota.status];

    const badgeUrgencia = document.getElementById('detalhes-badge-urgencia');
    badgeUrgencia.className = `badge-urgencia ${nota.nivelUrgencia}`;
    badgeUrgencia.textContent = `Urgência: ${URGENCIA_LABEL[nota.nivelUrgencia] || nota.nivelUrgencia}`;

    document.getElementById('detalhes-fornecedor').textContent = nota.fornecedor_nome;
    document.getElementById('detalhes-valor').textContent = formatarMoeda(nota.valor_orcamento);
    document.getElementById('detalhes-dias').textContent = `${nota.diasEmAberto ?? 0} dias`;

    const prazoEl = document.getElementById('detalhes-prazo-etapa');
    if (nota.status === 'entregue') {
      prazoEl.textContent = `Entregue em ${formatarData(nota.data_entrega)}`;
      prazoEl.style.color = 'var(--accent)';
    } else if (nota.prazoLimite) {
      prazoEl.textContent = `${nota.atrasado ? 'Atrasado desde' : 'Prazo até'} ${formatarData(nota.prazoLimite)}`;
      prazoEl.style.color = nota.atrasado ? 'var(--multa)' : 'var(--text)';
    } else {
      prazoEl.textContent = '—';
      prazoEl.style.color = 'var(--text)';
    }

    document.getElementById('detalhes-descricao').textContent = nota.descricao || 'Nenhuma descrição detalhada informada.';

    // Renderiza o Stepper Timeline das 5 Etapas
    const stepper = document.getElementById('timeline-stepper');
    const timeline = nota.timeline || [];

    stepper.innerHTML = timeline.map((step, idx) => {
      const num = idx + 1;
      let statusClass = '';
      let icone = num;

      if (step.concluido) {
        statusClass = 'concluido';
        icone = '✓';
      }
      if (step.atual) {
        statusClass = 'atual';
      }

      return `
        <div class="step-item ${statusClass}">
          <div class="step-circulo">${icone}</div>
          <div class="step-conteudo">
            <div class="step-titulo-linha">
              <span class="step-titulo">${step.titulo}</span>
              <span class="step-data">${formatarData(step.data)}</span>
            </div>
            <div class="step-subinfo">
              ${step.responsavel ? `Responsável: <strong>${step.responsavel}</strong>` : ''}
              ${step.documento ? ` · Documento: <strong>${step.documento}</strong>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Renderiza Histórico de Auditoria
    const histContainer = document.getElementById('timeline-historico');
    const hist = nota.historico || [];

    if (!hist.length) {
      histContainer.innerHTML = `<div style="padding: 12px; color: var(--text-muted);">Nenhuma alteração registrada ainda.</div>`;
    } else {
      histContainer.innerHTML = hist.map((h) => `
        <div class="historico-item">
          <div class="historico-item-top">
            <strong>${STATUS_LABEL[h.status_novo] || h.status_novo}</strong>
            <span>${formatarData(h.criado_em)} ${h.responsavel ? `· ${h.responsavel}` : ''}</span>
          </div>
          ${h.observacao ? `<div class="historico-obs">"${h.observacao}"</div>` : ''}
        </div>
      `).join('');
    }

    const btnAvancar = document.getElementById('btn-detalhes-avancar');
    if (nota.status === 'entregue' || nota.status === 'cancelado') {
      btnAvancar.style.display = 'none';
    } else {
      btnAvancar.style.display = 'inline-flex';
      btnAvancar.onclick = () => abrirModalEditarStatus(nota.id);
    }

    abrirModal('modal-detalhes-nota');
  } catch (err) {
    mostrarToast(err.message, 'erro');
  }
};

// ---------------- Modal: Editar Dados Gerais da Nota ----------------
window.abrirModalEditarNota = async function(id) {
  try {
    const nota = await api(`/notas/${id}`);
    notaEmEdicao = nota;

    document.getElementById('edit-nota-id').value = nota.id;
    document.getElementById('edit-numero-nf').value = nota.numero_nf;
    document.getElementById('edit-data-orcamento').value = nota.data_orcamento ? nota.data_orcamento.slice(0, 10) : '';
    document.getElementById('edit-fornecedor-id').value = nota.fornecedor_id;
    document.getElementById('edit-descricao').value = nota.descricao || '';
    document.getElementById('edit-valor-orcamento').value = nota.valor_orcamento || '';
    document.getElementById('edit-responsavel-emissao').value = nota.responsavel_emissao || '';
    document.getElementById('edit-numero-rc').value = nota.numero_rc || '';
    document.getElementById('edit-numero-pc').value = nota.numero_pc || '';
    document.getElementById('edit-previsao-entrega').value = nota.previsao_entrega ? nota.previsao_entrega.slice(0, 10) : '';
    document.getElementById('edit-nf-retorno').value = nota.nf_retorno || '';

    abrirModal('modal-editar-nota');
  } catch (err) {
    mostrarToast(err.message, 'erro');
  }
};

document.getElementById('form-editar-nota').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const payload = Object.fromEntries(new FormData(form).entries());
  const id = payload.id;
  delete payload.id;

  try {
    await api(`/notas/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    fecharModal('modal-editar-nota');
    mostrarToast('Dados da nota atualizados com sucesso!');
    await Promise.all([carregarResumo(), carregarNotas(), carregarFornecedores()]);
  } catch (err) {
    mostrarToast(err.message, 'erro');
  }
});

document.getElementById('btn-excluir-nota').addEventListener('click', async () => {
  if (!notaEmEdicao) return;
  if (!confirm(`Tem certeza que deseja excluir a nota ${notaEmEdicao.numero_nf}? Esta ação não pode ser desfeita.`)) {
    return;
  }

  try {
    await api(`/notas/${notaEmEdicao.id}`, { method: 'DELETE' });
    fecharModal('modal-editar-nota');
    fecharModal('modal-detalhes-nota');
    mostrarToast('Nota excluída com sucesso!');
    await Promise.all([carregarResumo(), carregarNotas(), carregarFornecedores()]);
  } catch (err) {
    mostrarToast(err.message, 'erro');
  }
});

// ---------------- Exportar CSV ----------------
document.getElementById('btn-exportar-csv').addEventListener('click', () => {
  if (!notasCache || !notasCache.length) {
    mostrarToast('Nenhuma nota disponível para exportação.', 'info');
    return;
  }

  const cabecalho = [
    'Numero_NF',
    'Fornecedor',
    'CNPJ',
    'Etapa_Atual',
    'Descricao',
    'Valor_Orcamento_R$',
    'Dias_Em_Aberto',
    'Prazo_Etapa',
    'Atrasado',
    'Nivel_Urgencia',
    'Numero_RC',
    'Data_RC',
    'Numero_PC',
    'Data_PC',
    'Data_Em_Conserto',
    'Previsao_Entrega',
    'Data_Entrega',
    'NF_Retorno',
  ];

  const linhas = notasCache.map((n) => [
    `"${n.numero_nf || ''}"`,
    `"${(n.fornecedor_nome || '').replace(/"/g, '""')}"`,
    `"${n.fornecedor_cnpj || ''}"`,
    `"${STATUS_LABEL[n.status] || n.status}"`,
    `"${(n.descricao || '').replace(/"/g, '""')}"`,
    n.valor_orcamento || 0,
    n.diasEmAberto ?? 0,
    `"${n.prazoLimite ? formatarData(n.prazoLimite) : ''}"`,
    n.atrasado ? 'SIM' : 'NAO',
    `"${URGENCIA_LABEL[n.nivelUrgencia] || n.nivelUrgencia}"`,
    `"${n.numero_rc || ''}"`,
    `"${formatarData(n.data_rc)}"`,
    `"${n.numero_pc || ''}"`,
    `"${formatarData(n.data_pc)}"`,
    `"${formatarData(n.data_em_conserto)}"`,
    `"${formatarData(n.previsao_entrega)}"`,
    `"${formatarData(n.data_entrega)}"`,
    `"${n.nf_retorno || ''}"`,
  ]);

  const csvContent = '\uFEFF' + [cabecalho.join(';'), ...linhas.map((l) => l.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `notas_conserto_${hojeIso()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  mostrarToast('Relatório CSV exportado com sucesso!');
});

// ---------------- Inicialização da Aplicação ----------------
(async function init() {
  await carregarFornecedores();
  await Promise.all([carregarResumo(), carregarNotas()]);
})();
