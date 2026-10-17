require('dotenv').config();

const PRAZO_RC_DIAS = Number(process.env.PRAZO_RC_DIAS || 30);
const PRAZO_PC_DIAS = Number(process.env.PRAZO_PC_DIAS || 15);
const PRAZO_ENVIO_CONSERTO_DIAS = Number(process.env.PRAZO_ENVIO_CONSERTO_DIAS || 10);
const PRAZO_CONSERTO_DIAS = Number(process.env.PRAZO_CONSERTO_DIAS || 45);

const URGENCIA_ATENCAO_MESES = Number(process.env.URGENCIA_ATENCAO_MESES || 4);
const URGENCIA_URGENTE_MESES = Number(process.env.URGENCIA_URGENTE_MESES || 5);
const URGENCIA_MULTA_MESES = Number(process.env.URGENCIA_MULTA_MESES || 6);

const MS_POR_DIA = 1000 * 60 * 60 * 24;

function parseDate(data) {
  if (!data) return null;
  if (data instanceof Date) return data;
  const str = String(data).slice(0, 10);
  const [ano, mes, dia] = str.split('-').map(Number);
  if (!ano || !mes || !dia) return new Date(data);
  return new Date(ano, mes - 1, dia);
}

function formatarDataIso(data) {
  if (!data) return null;
  const d = parseDate(data);
  const ano = d.getFullYear();
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function diasEntre(dataInicio, dataFim = new Date()) {
  if (!dataInicio) return null;
  const inicio = parseDate(dataInicio);
  const fim = parseDate(dataFim);
  if (!inicio || !fim) return null;
  return Math.floor((fim.getTime() - inicio.getTime()) / MS_POR_DIA);
}

/**
 * Retorna os detalhes da etapa atual com base no status da nota:
 * descrição, prazo limite, dias restantes e se está atrasada.
 */
function calcularEtapaAtual(nota) {
  const hoje = new Date();
  const status = nota.status || 'orcamento_enviado';

  if (status === 'cancelado') {
    return {
      etapa: 'cancelado',
      descricaoEtapa: 'Nota Cancelada',
      prazoDias: null,
      prazoLimite: null,
      diasRestantes: null,
      atrasado: false,
    };
  }

  if (status === 'entregue') {
    return {
      etapa: 'entregue',
      descricaoEtapa: 'Material Entregue',
      prazoDias: null,
      prazoLimite: null,
      diasRestantes: null,
      atrasado: false,
    };
  }

  // 1. Aguardando Requisição de Compra (RC)
  if (status === 'orcamento_enviado') {
    const dataRef = nota.data_orcamento || nota.criado_em;
    if (!dataRef) {
      return { etapa: 'orcamento_enviado', descricaoEtapa: 'Aguardando RC', prazoLimite: null, diasRestantes: null, atrasado: false };
    }
    const prazoLimite = parseDate(dataRef);
    prazoLimite.setDate(prazoLimite.getDate() + PRAZO_RC_DIAS);
    const diasRestantes = diasEntre(hoje, prazoLimite);
    return {
      etapa: 'orcamento_enviado',
      descricaoEtapa: 'Aguardando Requisição de Compra (RC)',
      prazoDias: PRAZO_RC_DIAS,
      prazoLimite: formatarDataIso(prazoLimite),
      diasRestantes,
      atrasado: diasRestantes < 0,
    };
  }

  // 2. RC criada - Aguardando Pedido de Compra (PC)
  if (status === 'rc_criada') {
    const dataRef = nota.data_rc || nota.data_orcamento || nota.criado_em;
    const prazoLimite = parseDate(dataRef);
    prazoLimite.setDate(prazoLimite.getDate() + PRAZO_PC_DIAS);
    const diasRestantes = diasEntre(hoje, prazoLimite);
    return {
      etapa: 'rc_criada',
      descricaoEtapa: 'RC criada - Aguardando Pedido de Compra',
      prazoDias: PRAZO_PC_DIAS,
      prazoLimite: formatarDataIso(prazoLimite),
      diasRestantes,
      atrasado: diasRestantes < 0,
    };
  }

  // 3. Pedido de Compra criado - Aguardando envio/início do conserto
  if (status === 'pc_criado') {
    const dataRef = nota.data_pc || nota.data_rc || nota.criado_em;
    const prazoLimite = parseDate(dataRef);
    prazoLimite.setDate(prazoLimite.getDate() + PRAZO_ENVIO_CONSERTO_DIAS);
    const diasRestantes = diasEntre(hoje, prazoLimite);
    return {
      etapa: 'pc_criado',
      descricaoEtapa: 'Pedido criado - Aguardando envio ao conserto',
      prazoDias: PRAZO_ENVIO_CONSERTO_DIAS,
      prazoLimite: formatarDataIso(prazoLimite),
      diasRestantes,
      atrasado: diasRestantes < 0,
    };
  }

  // 4. Em Conserto no fornecedor
  if (status === 'em_conserto') {
    let prazoLimite;
    if (nota.previsao_entrega) {
      prazoLimite = parseDate(nota.previsao_entrega);
    } else {
      const dataRef = nota.data_em_conserto || nota.data_pc || nota.criado_em;
      prazoLimite = parseDate(dataRef);
      prazoLimite.setDate(prazoLimite.getDate() + PRAZO_CONSERTO_DIAS);
    }
    const diasRestantes = diasEntre(hoje, prazoLimite);
    return {
      etapa: 'em_conserto',
      descricaoEtapa: 'Em conserto no fornecedor',
      prazoDias: PRAZO_CONSERTO_DIAS,
      prazoLimite: formatarDataIso(prazoLimite),
      diasRestantes,
      atrasado: diasRestantes < 0,
    };
  }

  return {
    etapa: status,
    descricaoEtapa: status,
    prazoLimite: null,
    diasRestantes: null,
    atrasado: false,
  };
}

/**
 * Nível de urgência global da nota, contado a partir da emissão/orçamento.
 * 4 meses = atenção | 5 meses = urgente | 6+ meses = multa contratual
 */
function calcularUrgencia(nota) {
  const dataRef = nota.data_orcamento || nota.criado_em;
  if (!dataRef) {
    return { nivel: 'normal', diasEmAberto: 0 };
  }

  const dataFim = (nota.status === 'entregue' && nota.data_entrega) ? nota.data_entrega : new Date();
  const diasEmAberto = Math.max(0, diasEntre(dataRef, dataFim));
  const mesesEmAberto = diasEmAberto / 30;

  let nivel = 'normal';
  if (mesesEmAberto >= URGENCIA_MULTA_MESES) {
    nivel = 'multa';
  } else if (mesesEmAberto >= URGENCIA_URGENTE_MESES) {
    nivel = 'urgente';
  } else if (mesesEmAberto >= URGENCIA_ATENCAO_MESES) {
    nivel = 'atencao';
  }

  return { nivel, diasEmAberto };
}

/**
 * Enriquece a nota com as informações de etapas, prazos, linha do tempo e urgência.
 */
function enriquecerNota(nota) {
  const etapaInfo = calcularEtapaAtual(nota);
  const urgenciaInfo = calcularUrgencia(nota);

  // Linha do tempo das 5 etapas para renderização simplificada
  const timeline = [
    {
      etapa: 'orcamento_enviado',
      titulo: '1. Nota Criada / Orçamento',
      data: nota.data_orcamento || nota.criado_em,
      responsavel: nota.responsavel_emissao || 'Elton',
      concluido: !!(nota.data_orcamento || nota.criado_em),
      atual: nota.status === 'orcamento_enviado',
      documento: nota.numero_nf,
    },
    {
      etapa: 'rc_criada',
      titulo: '2. Requisição de Compra (RC)',
      data: nota.data_rc,
      responsavel: nota.responsavel_rc,
      concluido: !!nota.data_rc,
      atual: nota.status === 'rc_criada',
      documento: nota.numero_rc,
    },
    {
      etapa: 'pc_criado',
      titulo: '3. Pedido de Compras (PC)',
      data: nota.data_pc,
      responsavel: nota.responsavel_pc,
      concluido: !!nota.data_pc,
      atual: nota.status === 'pc_criado',
      documento: nota.numero_pc,
    },
    {
      etapa: 'em_conserto',
      titulo: '4. Em Conserto',
      data: nota.data_em_conserto,
      responsavel: nota.fornecedor_nome,
      concluido: !!nota.data_em_conserto || nota.status === 'em_conserto' || nota.status === 'entregue',
      atual: nota.status === 'em_conserto',
      documento: nota.previsao_entrega ? `Previsão: ${formatarDataIso(nota.previsao_entrega)}` : null,
    },
    {
      etapa: 'entregue',
      titulo: '5. Entrega na Empresa',
      data: nota.data_entrega,
      responsavel: nota.responsavel_entrega,
      concluido: nota.status === 'entregue',
      atual: nota.status === 'entregue',
      documento: nota.nf_retorno ? `NF Retorno: ${nota.nf_retorno}` : null,
    },
  ];

  return {
    ...nota,
    ...etapaInfo,
    nivelUrgencia: urgenciaInfo.nivel,
    diasEmAberto: urgenciaInfo.diasEmAberto,
    timeline,
  };
}

module.exports = {
  PRAZO_RC_DIAS,
  PRAZO_PC_DIAS,
  PRAZO_ENVIO_CONSERTO_DIAS,
  PRAZO_CONSERTO_DIAS,
  URGENCIA_ATENCAO_MESES,
  URGENCIA_URGENTE_MESES,
  URGENCIA_MULTA_MESES,
  diasEntre,
  formatarDataIso,
  calcularEtapaAtual,
  calcularUrgencia,
  enriquecerNota,
};
