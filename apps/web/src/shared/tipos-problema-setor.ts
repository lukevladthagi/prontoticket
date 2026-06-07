// Tipos de problema específicos por setor

export const TIPOS_PROBLEMA_POR_SETOR: Record<string, string[]> = {
  'Hotelaria': [
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
  'Rouparia': [
    'Organização de acomodação',
    'Solicitação enxoval',
    'Solicitação de fardamento',
    'Outros'
  ],
  'Manutenção': [
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
  'Manutenção Predial': [
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
  'Marketing': [
    'Ações Internas',
    'Peças Digitais',
    'Peças Gráficas (Impressos)',
    'Ações Externas'
  ],
  'Comercial': [
    'Cadastro de cliente',
    'Atualização de dados',
    'Cadastro de produto',
    'Cadastro de fornecedor',
    'Exclusão de cadastro',
    'Consulta',
    'Outros'
  ],
  'TI': [
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
  'Central de navegação': [
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
  'Outros': [
    'Geral',
    'Outros'
  ]
};

// Função helper para obter tipos de problema de um setor
export function getTiposProblemaParaSetor(nomeSetor: string): string[] {
  return TIPOS_PROBLEMA_POR_SETOR[nomeSetor] || TIPOS_PROBLEMA_POR_SETOR['Outro'];
}
