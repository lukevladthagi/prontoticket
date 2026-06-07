/**
 * Utilitários para cálculo de prazos de SLA considerando horários de atendimento por setor
 */

interface HorarioAtendimento {
  dia_semana: number; // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  hora_inicio: string; // Formato "HH:MM"
  hora_fim: string; // Formato "HH:MM"
}

/**
 * Converte string de hora "HH:MM" para minutos desde meia-noite
 */
function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Converte um timestamp UTC para horário de Brasília e retorna hora em minutos e dia da semana
 */
function getHorarioBrasilia(timestampUTC: number): { diaSemana: number; minutos: number; data: Date } {
  // Brasília é UTC-3, então subtraímos 3 horas para obter a hora local
  const brasiliaTimestamp = timestampUTC - (3 * 60 * 60 * 1000);
  const brasilia = new Date(brasiliaTimestamp);
  
  return {
    diaSemana: brasilia.getUTCDay(),
    minutos: brasilia.getUTCHours() * 60 + brasilia.getUTCMinutes(),
    data: brasilia
  };
}

/**
 * Cria um timestamp UTC para uma hora específica em Brasília no dia atual (Brasília)
 */
function criarTimestampBrasilia(dataBaseBrasilia: Date, horaMinutos: number): number {
  const horas = Math.floor(horaMinutos / 60);
  const minutos = horaMinutos % 60;
  
  // Criar data no horário de Brasília usando componentes UTC
  // dataBaseBrasilia já está em formato Brasília (seus componentes UTC representam hora local)
  const ano = dataBaseBrasilia.getUTCFullYear();
  const mes = dataBaseBrasilia.getUTCMonth();
  const dia = dataBaseBrasilia.getUTCDate();
  
  const novoDia = new Date(Date.UTC(
    ano,
    mes,
    dia,
    horas,
    minutos,
    0,
    0
  ));
  
  // Adicionar 3 horas para converter Brasília -> UTC
  return novoDia.getTime() + (3 * 60 * 60 * 1000);
}

/**
 * Adiciona minutos a uma data considerando apenas horários de atendimento
 * dataInicio deve ser em UTC, e o retorno também será em UTC
 */
export async function calcularPrazoSLA(
  db: D1Database,
  setorId: number | null,
  dataInicio: Date,
  minutosAdicionar: number
): Promise<Date> {
  // Se não houver setor, usa cálculo simples (24x7)
  if (!setorId) {
    return new Date(dataInicio.getTime() + minutosAdicionar * 60000);
  }

  // Buscar informações do setor
  const setor = await db.prepare(
    "SELECT atendimento_24x7 FROM setores WHERE id = ?"
  ).bind(setorId).first<{ atendimento_24x7: number }>();

  // Se for 24x7, usa cálculo simples
  if (setor?.atendimento_24x7) {
    return new Date(dataInicio.getTime() + minutosAdicionar * 60000);
  }

  // Buscar horários de atendimento do setor
  const { results: horarios } = await db.prepare(
    `SELECT dia_semana, hora_inicio, hora_fim 
     FROM horarios_atendimento_setor 
     WHERE setor_id = ? AND ativo = TRUE
     ORDER BY dia_semana, hora_inicio`
  ).bind(setorId).all<HorarioAtendimento>();

  // Se não houver horários cadastrados, usa cálculo simples
  if (!horarios || horarios.length === 0) {
    return new Date(dataInicio.getTime() + minutosAdicionar * 60000);
  }

  // Criar mapa de horários por dia da semana
  const horariosPorDia = new Map<number, HorarioAtendimento[]>();
  for (const horario of horarios) {
    const dia = horario.dia_semana;
    if (!horariosPorDia.has(dia)) {
      horariosPorDia.set(dia, []);
    }
    horariosPorDia.get(dia)!.push(horario);
  }

  let timestampAtual = dataInicio.getTime();
  let minutosRestantes = minutosAdicionar;
  let iteracoes = 0;
  const MAX_ITERACOES = 1000; // Proteção contra loop infinito

  // Loop até consumir todos os minutos
  while (minutosRestantes > 0 && iteracoes < MAX_ITERACOES) {
    iteracoes++;
    
    // Obter dia da semana e hora em Brasília
    const { diaSemana, minutos: horaAtualMinutos, data: dataBrasilia } = getHorarioBrasilia(timestampAtual);

    // Verificar se há atendimento neste dia
    const horariosHoje = horariosPorDia.get(diaSemana);
    
    if (!horariosHoje || horariosHoje.length === 0) {
      // Não há atendimento hoje, pular para o próximo dia às 00:00 Brasília
      const ano = dataBrasilia.getUTCFullYear();
      const mes = dataBrasilia.getUTCMonth();
      const dia = dataBrasilia.getUTCDate();
      
      const proximoDia = new Date(Date.UTC(
        ano,
        mes,
        dia + 1,
        0, 0, 0, 0
      ));
      timestampAtual = proximoDia.getTime() + (3 * 60 * 60 * 1000); // Converter para UTC
      continue;
    }

    // Encontrar o período de atendimento atual ou próximo
    let periodoAtual: HorarioAtendimento | null = null;
    let proximoPeriodo: HorarioAtendimento | null = null;

    for (const horario of horariosHoje) {
      const inicio = horaParaMinutos(horario.hora_inicio);
      const fim = horaParaMinutos(horario.hora_fim);

      if (horaAtualMinutos >= inicio && horaAtualMinutos < fim) {
        periodoAtual = horario;
        break;
      } else if (horaAtualMinutos < inicio && !proximoPeriodo) {
        proximoPeriodo = horario;
      }
    }

    if (periodoAtual) {
      // Estamos dentro de um período de atendimento
      const fimPeriodo = horaParaMinutos(periodoAtual.hora_fim);
      const minutosAteOFim = fimPeriodo - horaAtualMinutos;

      if (minutosRestantes <= minutosAteOFim) {
        // Conseguimos completar dentro deste período
        timestampAtual += minutosRestantes * 60000;
        minutosRestantes = 0;
      } else {
        // Consumir até o fim do período e continuar
        timestampAtual += minutosAteOFim * 60000;
        minutosRestantes -= minutosAteOFim;
        
        // Verificar se há outro período hoje após este
        const proximoPeriodoHoje = horariosHoje.find(h => 
          horaParaMinutos(h.hora_inicio) > fimPeriodo
        );
        
        if (proximoPeriodoHoje) {
          // Pular para o início do próximo período hoje
          const inicioProximo = horaParaMinutos(proximoPeriodoHoje.hora_inicio);
          timestampAtual = criarTimestampBrasilia(dataBrasilia, inicioProximo);
        } else {
          // Não há mais períodos hoje, pular para amanhã às 00:00 Brasília
          const ano = dataBrasilia.getUTCFullYear();
          const mes = dataBrasilia.getUTCMonth();
          const dia = dataBrasilia.getUTCDate();
          
          const proximoDia = new Date(Date.UTC(
            ano,
            mes,
            dia + 1,
            0, 0, 0, 0
          ));
          timestampAtual = proximoDia.getTime() + (3 * 60 * 60 * 1000);
        }
      }
    } else if (proximoPeriodo) {
      // Pular para o início do próximo período hoje
      const inicioProximo = horaParaMinutos(proximoPeriodo.hora_inicio);
      timestampAtual = criarTimestampBrasilia(dataBrasilia, inicioProximo);
    } else {
      // Não há mais períodos hoje, pular para amanhã às 00:00 Brasília
      const ano = dataBrasilia.getUTCFullYear();
      const mes = dataBrasilia.getUTCMonth();
      const dia = dataBrasilia.getUTCDate();
      
      const proximoDia = new Date(Date.UTC(
        ano,
        mes,
        dia + 1,
        0, 0, 0, 0
      ));
      timestampAtual = proximoDia.getTime() + (3 * 60 * 60 * 1000);
    }
  }

  return new Date(timestampAtual);
}

/**
 * Verifica se um chamado está dentro do prazo de SLA
 */
export function verificarViolacaoSLA(
  prazo: string | null,
  dataAtual: Date
): boolean {
  if (!prazo) return false;
  return new Date(prazo) < dataAtual;
}
