// Sistema de coleta de informações para criação de tickets via Telegram

export interface DadosTicket {
  nome_solicitante?: string;
  setor_solicitante?: string;
  setor_destino?: string;
  tipo_problema?: string;
  descricao_problema?: string;
  evidencias_enviadas?: string;
  file_ids?: string[]; // IDs dos arquivos enviados pelo Telegram
  media_urls?: string[]; // URLs das mídias enviadas pelo WhatsApp
  afeta_paciente?: boolean; // Para chamados de Manutenção
}

export type CampoColeta = 'nome_solicitante' | 'setor_solicitante' | 'setor_destino' | 'tipo_problema' | 'descricao_problema' | 'afeta_paciente' | 'evidencias';

export interface EstadoColeta {
  ativa: boolean;
  dados: DadosTicket;
  campo_atual: CampoColeta | null;
  mensagem_inicial: string;
}

const CAMPOS_ORDEM: CampoColeta[] = [
  'nome_solicitante',
  'setor_solicitante',
  'setor_destino',
  'tipo_problema',
  'descricao_problema',
  'afeta_paciente',
  'evidencias'
];

const PERGUNTAS: Record<CampoColeta, string> = {
  nome_solicitante: 'Qual é o seu nome completo?',
  setor_solicitante: 'De qual setor você é?',
  setor_destino: 'Para qual setor você deseja abrir este chamado?\n\n1️⃣ Hotelaria\n2️⃣ Rouparia\n3️⃣ Manutenção\n4️⃣ Marketing\n5️⃣ Comercial\n6️⃣ TI\n7️⃣ Central de navegação\n8️⃣ Outro\n\nResponda com o número ou nome do setor.',
  tipo_problema: 'Qual é o tipo do problema?\n\n1️⃣ Hardware (computador, mouse, teclado)\n2️⃣ Software (programas, sistemas)\n3️⃣ Rede (internet, conexão)\n4️⃣ Impressora\n5️⃣ Outro\n\nResponda com o número ou nome da opção.',
  descricao_problema: 'Descreva o problema ou solicitação com o máximo de detalhes possível.',
  afeta_paciente: '🏥 Este problema afeta ou pode afetar os pacientes?\n\n1️⃣ Sim, afeta pacientes (prioridade máxima, SLA de 4 horas)\n2️⃣ Não afeta pacientes (SLA padrão de 6 horas)\n\nResponda com o número ou "sim"/"não".',
  evidencias: '📸 Você tem fotos ou documentos que ajudem a entender o problema?\n\nSe sim, envie agora (pode enviar múltiplas fotos/arquivos).\nSe não, responda "não" ou "pular" para continuar.'
};

const TIPOS_PROBLEMA_MAP: Record<string, string> = {
  '1': 'Hardware',
  '2': 'Software', 
  '3': 'Rede',
  '4': 'Impressora',
  '5': 'Outro',
  'hardware': 'Hardware',
  'software': 'Software',
  'rede': 'Rede',
  'impressora': 'Impressora',
  'outro': 'Outro'
};

const SETORES_DESTINO_MAP: Record<string, string> = {
  '1': 'Hotelaria',
  '2': 'Rouparia',
  '3': 'Manutenção',
  '4': 'Marketing',
  '5': 'Comercial',
  '6': 'TI',
  '7': 'Central de navegação',
  '8': 'Outro',
  'hotelaria': 'Hotelaria',
  'rouparia': 'Rouparia',
  'manutenção predial': 'Manutenção',
  'manutencao predial': 'Manutenção',
  'manutencao': 'Manutenção',
  'manutenção': 'Manutenção',
  'predial': 'Manutenção',
  'marketing': 'Marketing',
  'comercial': 'Comercial',
  'cadastro': 'Comercial',
  'ti': 'TI',
  'central de navegação': 'Central de navegação',
  'central de navegacao': 'Central de navegação',
  'central': 'Central de navegação',
  'navegação': 'Central de navegação',
  'navegacao': 'Central de navegação',
  'outro': 'Outro'
};

// Tipos de problema específicos por setor
const TIPOS_POR_SETOR: Record<string, { opcoes: string[], mapeamento: Record<string, string> }> = {
  'Hotelaria': {
    opcoes: [
      'Higienização terminal de leito',
      'Higienização concorrente de leito',
      'Limpeza de máquina/equipamentos',
      'Higienização de setor/ambiente',
      'Retirar de Poltrona/cadeira',
      'Solicitação de poltrona/cadeira',
      'Abertura de enfermaria/apto',
      'Check in enfermaria/apto',
      'Check out enfermaria/apto',
      'Outros'
    ],
    mapeamento: {
      '1': 'Higienização terminal de leito',
      '2': 'Higienização concorrente de leito',
      '3': 'Limpeza de máquina/equipamentos',
      '4': 'Higienização de setor/ambiente',
      '5': 'Retirar de Poltrona/cadeira',
      '6': 'Solicitação de poltrona/cadeira',
      '7': 'Abertura de enfermaria/apto',
      '8': 'Check in enfermaria/apto',
      '9': 'Check out enfermaria/apto',
      '10': 'Outros',
      'higienização terminal de leito': 'Higienização terminal de leito',
      'higienizacao terminal de leito': 'Higienização terminal de leito',
      'terminal': 'Higienização terminal de leito',
      'higienização concorrente de leito': 'Higienização concorrente de leito',
      'higienizacao concorrente de leito': 'Higienização concorrente de leito',
      'concorrente': 'Higienização concorrente de leito',
      'limpeza de máquina': 'Limpeza de máquina/equipamentos',
      'limpeza de maquina': 'Limpeza de máquina/equipamentos',
      'limpeza de equipamentos': 'Limpeza de máquina/equipamentos',
      'máquina': 'Limpeza de máquina/equipamentos',
      'maquina': 'Limpeza de máquina/equipamentos',
      'equipamentos': 'Limpeza de máquina/equipamentos',
      'higienização de setor': 'Higienização de setor/ambiente',
      'higienizacao de setor': 'Higienização de setor/ambiente',
      'higienização de ambiente': 'Higienização de setor/ambiente',
      'higienizacao de ambiente': 'Higienização de setor/ambiente',
      'setor': 'Higienização de setor/ambiente',
      'ambiente': 'Higienização de setor/ambiente',
      'retirar de poltrona': 'Retirar de Poltrona/cadeira',
      'retirar poltrona': 'Retirar de Poltrona/cadeira',
      'retirar cadeira': 'Retirar de Poltrona/cadeira',
      'retirar': 'Retirar de Poltrona/cadeira',
      'solicitação de poltrona': 'Solicitação de poltrona/cadeira',
      'solicitacao de poltrona': 'Solicitação de poltrona/cadeira',
      'solicitação de cadeira': 'Solicitação de poltrona/cadeira',
      'solicitacao de cadeira': 'Solicitação de poltrona/cadeira',
      'poltrona': 'Solicitação de poltrona/cadeira',
      'cadeira': 'Solicitação de poltrona/cadeira',
      'abertura de enfermaria': 'Abertura de enfermaria/apto',
      'abertura de apto': 'Abertura de enfermaria/apto',
      'abertura': 'Abertura de enfermaria/apto',
      'check in enfermaria': 'Check in enfermaria/apto',
      'check in apto': 'Check in enfermaria/apto',
      'check in': 'Check in enfermaria/apto',
      'check out enfermaria': 'Check out enfermaria/apto',
      'check out apto': 'Check out enfermaria/apto',
      'check out': 'Check out enfermaria/apto',
      'outros': 'Outros',
      'outro': 'Outros'
    }
  },
  'Rouparia': {
    opcoes: [
      'Organização de acomodação',
      'Solicitação enxoval',
      'Solicitação de fardamento',
      'Outros'
    ],
    mapeamento: {
      '1': 'Organização de acomodação',
      '2': 'Solicitação enxoval',
      '3': 'Solicitação de fardamento',
      '4': 'Outros',
      'organização de acomodação': 'Organização de acomodação',
      'organizacao de acomodacao': 'Organização de acomodação',
      'organização': 'Organização de acomodação',
      'organizacao': 'Organização de acomodação',
      'acomodação': 'Organização de acomodação',
      'acomodacao': 'Organização de acomodação',
      'solicitação enxoval': 'Solicitação enxoval',
      'solicitacao enxoval': 'Solicitação enxoval',
      'enxoval': 'Solicitação enxoval',
      'solicitação de fardamento': 'Solicitação de fardamento',
      'solicitacao de fardamento': 'Solicitação de fardamento',
      'fardamento': 'Solicitação de fardamento',
      'outros': 'Outros',
      'outro': 'Outros'
    }
  },
  'Manutenção': {
    opcoes: [
      'Elétrica',
      'Marcenaria',
      'Pintura',
      'Refrigeração',
      'Gesso',
      'Cabeamento',
      'Solda',
      'Engenharia Clínica',
      'Hidráulica',
      'Mecânico'
    ],
    mapeamento: {
      '1': 'Elétrica',
      '2': 'Marcenaria',
      '3': 'Pintura',
      '4': 'Refrigeração',
      '5': 'Gesso',
      '6': 'Cabeamento',
      '7': 'Solda',
      '8': 'Engenharia Clínica',
      '9': 'Hidráulica',
      '10': 'Mecânico',
      'elétrica': 'Elétrica',
      'eletrica': 'Elétrica',
      'marcenaria': 'Marcenaria',
      'pintura': 'Pintura',
      'refrigeração': 'Refrigeração',
      'refrigeracao': 'Refrigeração',
      'gesso': 'Gesso',
      'cabeamento': 'Cabeamento',
      'solda': 'Solda',
      'engenharia clínica': 'Engenharia Clínica',
      'engenharia clinica': 'Engenharia Clínica',
      'clínica': 'Engenharia Clínica',
      'clinica': 'Engenharia Clínica',
      'hidráulica': 'Hidráulica',
      'hidraulica': 'Hidráulica',
      'mecânico': 'Mecânico',
      'mecanico': 'Mecânico'
    }
  },

  'Marketing': {
    opcoes: ['Ações Internas', 'Peças Digitais', 'Peças Gráficas (Impressos)', 'Ações Externas'],
    mapeamento: {
      '1': 'Ações Internas',
      '2': 'Peças Digitais',
      '3': 'Peças Gráficas (Impressos)',
      '4': 'Ações Externas',
      'ações internas': 'Ações Internas',
      'acoes internas': 'Ações Internas',
      'ações': 'Ações Internas',
      'acoes': 'Ações Internas',
      'internas': 'Ações Internas',
      'peças digitais': 'Peças Digitais',
      'pecas digitais': 'Peças Digitais',
      'peças': 'Peças Digitais',
      'pecas': 'Peças Digitais',
      'digitais': 'Peças Digitais',
      'digital': 'Peças Digitais',
      'peças gráficas': 'Peças Gráficas (Impressos)',
      'pecas graficas': 'Peças Gráficas (Impressos)',
      'peças gráficas (impressos)': 'Peças Gráficas (Impressos)',
      'pecas graficas (impressos)': 'Peças Gráficas (Impressos)',
      'gráficas': 'Peças Gráficas (Impressos)',
      'graficas': 'Peças Gráficas (Impressos)',
      'impressos': 'Peças Gráficas (Impressos)',
      'impresso': 'Peças Gráficas (Impressos)',
      'ações externas': 'Ações Externas',
      'acoes externas': 'Ações Externas',
      'externas': 'Ações Externas',
      'externa': 'Ações Externas'
    }
  },

  'Comercial': {
    opcoes: ['Cadastro de cliente', 'Atualização de dados', 'Cadastro de produto', 'Cadastro de fornecedor', 'Exclusão de cadastro', 'Consulta', 'Outro'],
    mapeamento: {
      '1': 'Cadastro de cliente',
      '2': 'Atualização de dados',
      '3': 'Cadastro de produto',
      '4': 'Cadastro de fornecedor',
      '5': 'Exclusão de cadastro',
      '6': 'Consulta',
      '7': 'Outro',
      'cadastro de cliente': 'Cadastro de cliente',
      'cliente': 'Cadastro de cliente',
      'atualização de dados': 'Atualização de dados',
      'atualizacao de dados': 'Atualização de dados',
      'atualização': 'Atualização de dados',
      'atualizacao': 'Atualização de dados',
      'cadastro de produto': 'Cadastro de produto',
      'produto': 'Cadastro de produto',
      'cadastro de fornecedor': 'Cadastro de fornecedor',
      'fornecedor': 'Cadastro de fornecedor',
      'exclusão de cadastro': 'Exclusão de cadastro',
      'exclusao de cadastro': 'Exclusão de cadastro',
      'exclusão': 'Exclusão de cadastro',
      'exclusao': 'Exclusão de cadastro',
      'consulta': 'Consulta',
      'outro': 'Outro'
    }
  },
  'TI': {
    opcoes: [
      'Hardware',
      'Rede',
      'Acesso e Usuários',
      'Software',
      'Sistema',
      'E-mail',
      'Infraestrutura',
      'Arquivos e Compartilhamentos',
      'Dispositivos Móveis',
      'BI',
      'Processos Internos TI',
      'Outros'
    ],
    mapeamento: {
      '1': 'Hardware',
      '2': 'Rede',
      '3': 'Acesso e Usuários',
      '4': 'Software',
      '5': 'Sistema',
      '6': 'E-mail',
      '7': 'Infraestrutura',
      '8': 'Arquivos e Compartilhamentos',
      '9': 'Dispositivos Móveis',
      '10': 'BI',
      '11': 'Processos Internos TI',
      '12': 'Outros',
      'hardware': 'Hardware',
      'rede': 'Rede',
      'acesso e usuários': 'Acesso e Usuários',
      'acesso e usuarios': 'Acesso e Usuários',
      'acesso': 'Acesso e Usuários',
      'usuários': 'Acesso e Usuários',
      'usuarios': 'Acesso e Usuários',
      'software': 'Software',
      'sistema': 'Sistema',
      'sistemas': 'Sistema',
      'e-mail': 'E-mail',
      'email': 'E-mail',
      'infraestrutura': 'Infraestrutura',
      'arquivos e compartilhamentos': 'Arquivos e Compartilhamentos',
      'arquivos': 'Arquivos e Compartilhamentos',
      'compartilhamentos': 'Arquivos e Compartilhamentos',
      'pastas': 'Arquivos e Compartilhamentos',
      'dispositivos móveis': 'Dispositivos Móveis',
      'dispositivos moveis': 'Dispositivos Móveis',
      'móveis': 'Dispositivos Móveis',
      'moveis': 'Dispositivos Móveis',
      'celular': 'Dispositivos Móveis',
      'tablet': 'Dispositivos Móveis',
      'bi': 'BI',
      'power bi': 'BI',
      'powerbi': 'BI',
      'processos internos ti': 'Processos Internos TI',
      'processos internos': 'Processos Internos TI',
      'processos': 'Processos Internos TI',
      'internos': 'Processos Internos TI',
      'outros': 'Outros',
      'outro': 'Outros'
    }
  },
  'Central de navegação': {
    opcoes: [
      'Pacientes particulares',
      'Pacientes com indicações de tratamento prolongado',
      'Pacientes com resistência ao plano terapêutico',
      'Falta de compreensão sobre o fluxo da instituição',
      'Diagnóstico recente de doenças complexas',
      'Internações frequentes ou reinternações',
      'Conflitos familiares relacionados ao cuidado',
      'Risco de eventos adversos por falha de comunicação',
      'Outros'
    ],
    mapeamento: {
      '1': 'Pacientes particulares',
      '2': 'Pacientes com indicações de tratamento prolongado',
      '3': 'Pacientes com resistência ao plano terapêutico',
      '4': 'Falta de compreensão sobre o fluxo da instituição',
      '5': 'Diagnóstico recente de doenças complexas',
      '6': 'Internações frequentes ou reinternações',
      '7': 'Conflitos familiares relacionados ao cuidado',
      '8': 'Risco de eventos adversos por falha de comunicação',
      '9': 'Outros',
      'pacientes particulares': 'Pacientes particulares',
      'particulares': 'Pacientes particulares',
      'particular': 'Pacientes particulares',
      'pacientes com indicações de tratamento prolongado': 'Pacientes com indicações de tratamento prolongado',
      'pacientes com indicacoes de tratamento prolongado': 'Pacientes com indicações de tratamento prolongado',
      'tratamento prolongado': 'Pacientes com indicações de tratamento prolongado',
      'prolongado': 'Pacientes com indicações de tratamento prolongado',
      'pacientes com resistência ao plano terapêutico': 'Pacientes com resistência ao plano terapêutico',
      'pacientes com resistencia ao plano terapeutico': 'Pacientes com resistência ao plano terapêutico',
      'resistência ao plano': 'Pacientes com resistência ao plano terapêutico',
      'resistencia ao plano': 'Pacientes com resistência ao plano terapêutico',
      'resistência': 'Pacientes com resistência ao plano terapêutico',
      'resistencia': 'Pacientes com resistência ao plano terapêutico',
      'falta de compreensão sobre o fluxo da instituição': 'Falta de compreensão sobre o fluxo da instituição',
      'falta de compreensao sobre o fluxo da instituicao': 'Falta de compreensão sobre o fluxo da instituição',
      'falta de compreensão': 'Falta de compreensão sobre o fluxo da instituição',
      'falta de compreensao': 'Falta de compreensão sobre o fluxo da instituição',
      'fluxo da instituição': 'Falta de compreensão sobre o fluxo da instituição',
      'fluxo da instituicao': 'Falta de compreensão sobre o fluxo da instituição',
      'fluxo': 'Falta de compreensão sobre o fluxo da instituição',
      'diagnóstico recente de doenças complexas': 'Diagnóstico recente de doenças complexas',
      'diagnostico recente de doencas complexas': 'Diagnóstico recente de doenças complexas',
      'diagnóstico recente': 'Diagnóstico recente de doenças complexas',
      'diagnostico recente': 'Diagnóstico recente de doenças complexas',
      'doenças complexas': 'Diagnóstico recente de doenças complexas',
      'doencas complexas': 'Diagnóstico recente de doenças complexas',
      'internações frequentes ou reinternações': 'Internações frequentes ou reinternações',
      'internacoes frequentes ou reinternacoes': 'Internações frequentes ou reinternações',
      'internações frequentes': 'Internações frequentes ou reinternações',
      'internacoes frequentes': 'Internações frequentes ou reinternações',
      'reinternações': 'Internações frequentes ou reinternações',
      'reinternacoes': 'Internações frequentes ou reinternações',
      'reinternação': 'Internações frequentes ou reinternações',
      'reinternacao': 'Internações frequentes ou reinternações',
      'conflitos familiares relacionados ao cuidado': 'Conflitos familiares relacionados ao cuidado',
      'conflitos familiares': 'Conflitos familiares relacionados ao cuidado',
      'conflitos': 'Conflitos familiares relacionados ao cuidado',
      'familiares': 'Conflitos familiares relacionados ao cuidado',
      'risco de eventos adversos por falha de comunicação': 'Risco de eventos adversos por falha de comunicação',
      'risco de eventos adversos por falha de comunicacao': 'Risco de eventos adversos por falha de comunicação',
      'eventos adversos': 'Risco de eventos adversos por falha de comunicação',
      'falha de comunicação': 'Risco de eventos adversos por falha de comunicação',
      'falha de comunicacao': 'Risco de eventos adversos por falha de comunicação',
      'comunicação': 'Risco de eventos adversos por falha de comunicação',
      'comunicacao': 'Risco de eventos adversos por falha de comunicação',
      'outros': 'Outros',
      'outro': 'Outros'
    }
  },
  'Outro': {
    opcoes: ['Geral', 'Outro'],
    mapeamento: {
      '1': 'Geral',
      '2': 'Outro',
      'geral': 'Geral',
      'outro': 'Outro'
    }
  }
};

export function iniciarColeta(mensagemInicial: string): EstadoColeta {
  return {
    ativa: true,
    dados: {},
    campo_atual: 'nome_solicitante',
    mensagem_inicial: mensagemInicial
  };
}

export function processarResposta(
  estado: EstadoColeta, 
  resposta: string
): { estado: EstadoColeta; proximaPergunta: string | null; completo: boolean } {
  
  if (!estado.campo_atual) {
    return { estado, proximaPergunta: null, completo: true };
  }

  // Verificar se usuário quer voltar
  const respostaLower = resposta.toLowerCase().trim();
  if (respostaLower === 'voltar' || respostaLower === 'anterior' || respostaLower === 'volta') {
    const indiceAtual = CAMPOS_ORDEM.indexOf(estado.campo_atual);
    if (indiceAtual > 0) {
      // Voltar para o campo anterior
      const campoAnterior = CAMPOS_ORDEM[indiceAtual - 1];
      estado.campo_atual = campoAnterior;
      
      // Remover o dado do campo anterior para que o usuário possa respondê-lo novamente
      if (campoAnterior !== 'evidencias') {
        delete estado.dados[campoAnterior];
      } else {
        delete estado.dados.evidencias_enviadas;
      }
      
      let perguntaAnterior = PERGUNTAS[campoAnterior];
      
      // Se for tipo_problema e há setor definido, gerar pergunta personalizada
      if (campoAnterior === 'tipo_problema' && estado.dados.setor_destino) {
        const tiposSetor = TIPOS_POR_SETOR[estado.dados.setor_destino];
        if (tiposSetor) {
          perguntaAnterior = `Qual é o tipo do problema para ${estado.dados.setor_destino}?\n\n`;
          tiposSetor.opcoes.forEach((opcao, index) => {
            const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '1️⃣1️⃣', '1️⃣2️⃣', '1️⃣3️⃣'];
            const emoji = emojis[index] || `${index + 1}️⃣`;
            perguntaAnterior += `${emoji} ${opcao}\n`;
          });
          perguntaAnterior += '\nResponda com o número ou nome da opção.\n\n💡 Digite "voltar" para retornar à pergunta anterior.';
        }
      } else {
        perguntaAnterior += '\n\n💡 Digite "voltar" para retornar à pergunta anterior.';
      }
      
      return {
        estado,
        proximaPergunta: perguntaAnterior,
        completo: false
      };
    } else {
      // Já está no primeiro campo, não pode voltar mais
      return {
        estado,
        proximaPergunta: 'Você já está na primeira pergunta. Por favor, responda: ' + PERGUNTAS[estado.campo_atual],
        completo: false
      };
    }
  }

  // Salvar resposta no campo atual
  let respostaProcessada = resposta.trim();
  
  // Processar setor de destino especialmente
  if (estado.campo_atual === 'setor_destino') {
    const setorNormalizado = SETORES_DESTINO_MAP[respostaProcessada.toLowerCase()];
    if (setorNormalizado) {
      respostaProcessada = setorNormalizado;
    }
  }
  
  // Processar afeta_paciente especialmente
  if (estado.campo_atual === 'afeta_paciente') {
    const respostaLower = respostaProcessada.toLowerCase();
    if (respostaLower === '1' || respostaLower === 'sim' || respostaLower === 's') {
      estado.dados.afeta_paciente = true;
    } else if (respostaLower === '2' || respostaLower === 'não' || respostaLower === 'nao' || respostaLower === 'n') {
      estado.dados.afeta_paciente = false;
    }
    // Não salvamos o texto processado para este campo
  }
  
  // Processar tipo de problema especialmente baseado no setor
  if (estado.campo_atual === 'tipo_problema') {
    // Verificar se há um setor definido e usar os tipos específicos
    if (estado.dados.setor_destino && TIPOS_POR_SETOR[estado.dados.setor_destino]) {
      const tiposSetor = TIPOS_POR_SETOR[estado.dados.setor_destino];
      const tipoNormalizado = tiposSetor.mapeamento[respostaProcessada.toLowerCase()];
      if (tipoNormalizado) {
        respostaProcessada = tipoNormalizado;
      }
    } else {
      // Fallback para o mapa genérico
      const tipoNormalizado = TIPOS_PROBLEMA_MAP[respostaProcessada.toLowerCase()];
      if (tipoNormalizado) {
        respostaProcessada = tipoNormalizado;
      }
    }
  }
  
  // Para o campo de evidências, não salvamos a resposta textual
  // As evidências são anexadas através do sistema de upload de arquivos
  if (estado.campo_atual !== 'evidencias' && estado.campo_atual !== 'afeta_paciente') {
    estado.dados[estado.campo_atual] = respostaProcessada;
  } else if (estado.campo_atual === 'evidencias') {
    // Marcar que a pergunta foi feita
    estado.dados.evidencias_enviadas = respostaProcessada;
  }
  // Para afeta_paciente, já foi processado acima

  // Encontrar próximo campo
  const indiceAtual = CAMPOS_ORDEM.indexOf(estado.campo_atual);
  let proximoCampo = CAMPOS_ORDEM[indiceAtual + 1];

  // Pular a pergunta de afeta_paciente se o setor não for Manutenção
  if (proximoCampo === 'afeta_paciente' && estado.dados.setor_destino !== 'Manutenção') {
    proximoCampo = CAMPOS_ORDEM[indiceAtual + 2]; // Pular para evidencias
  }

  if (proximoCampo) {
    estado.campo_atual = proximoCampo;
    
    // Se o próximo campo é tipo_problema, gerar pergunta personalizada baseada no setor
    let proximaPergunta = PERGUNTAS[proximoCampo];
    if (proximoCampo === 'tipo_problema' && estado.dados.setor_destino) {
      const tiposSetor = TIPOS_POR_SETOR[estado.dados.setor_destino];
      if (tiposSetor) {
        proximaPergunta = `Qual é o tipo do problema para ${estado.dados.setor_destino}?\n\n`;
        tiposSetor.opcoes.forEach((opcao, index) => {
          const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '1️⃣1️⃣', '1️⃣2️⃣', '1️⃣3️⃣'];
          const emoji = emojis[index] || `${index + 1}️⃣`;
          proximaPergunta += `${emoji} ${opcao}\n`;
        });
        proximaPergunta += '\nResponda com o número ou nome da opção.\n\n💡 Digite "voltar" para retornar à pergunta anterior.';
      }
    } else {
      proximaPergunta += '\n\n💡 Digite "voltar" para retornar à pergunta anterior.';
    }
    
    return {
      estado,
      proximaPergunta,
      completo: false
    };
  } else {
    // Coleta completa
    estado.ativa = false;
    estado.campo_atual = null;
    return {
      estado,
      proximaPergunta: null,
      completo: true
    };
  }
}

export function validarDadosCompletos(dados: DadosTicket): boolean {
  return !!(
    dados.nome_solicitante &&
    dados.setor_solicitante &&
    dados.tipo_problema &&
    dados.descricao_problema
  );
}

export function formatarResumo(dados: DadosTicket, formato: 'html' | 'markdown' = 'html'): string {
  if (formato === 'markdown') {
    return `📋 *Resumo do Chamado*

👤 *Solicitante:* ${dados.nome_solicitante}
🏢 *Setor do Solicitante:* ${dados.setor_solicitante}
🎯 *Setor de Destino:* ${dados.setor_destino}
🔧 *Tipo:* ${dados.tipo_problema}
📝 *Descrição:* ${dados.descricao_problema}`;
  }
  
  return `📋 <b>Resumo do Chamado</b>

👤 <b>Solicitante:</b> ${dados.nome_solicitante}
🏢 <b>Setor do Solicitante:</b> ${dados.setor_solicitante}
🎯 <b>Setor de Destino:</b> ${dados.setor_destino}
🔧 <b>Tipo:</b> ${dados.tipo_problema}
📝 <b>Descrição:</b> ${dados.descricao_problema}`;
}
