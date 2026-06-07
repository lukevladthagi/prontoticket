export function asBoolean(value: unknown) {
  return value === true || value === 1 || value === "1";
}

export function asNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeSetor(row: any) {
  return {
    ...row,
    ativo: asBoolean(row.ativo),
    atende_ticket: asBoolean(row.atende_ticket),
    atendimento_24x7: asBoolean(row.atendimento_24x7),
  };
}

export function normalizeUnidade(row: any) {
  return {
    ...row,
    ativo: asBoolean(row.ativo),
  };
}

export function normalizeCategoria(row: any) {
  return {
    ...row,
    ativo: asBoolean(row.ativo),
  };
}

export function normalizeSla(row: any) {
  return {
    ...row,
    horario_comercial: asBoolean(row.horario_comercial),
    ativo: asBoolean(row.ativo),
  };
}

export function normalizeUserProfile(row: any) {
  return {
    ...row,
    ativo: asBoolean(row.ativo),
  };
}

export function normalizeChamado(row: any) {
  return {
    ...row,
    violacao_sla: asBoolean(row.violacao_sla),
    avaliacao_resolveu:
      row.avaliacao_resolveu === null || row.avaliacao_resolveu === undefined
        ? null
        : asBoolean(row.avaliacao_resolveu),
    agendado: asBoolean(row.agendado),
    afeta_paciente: asBoolean(row.afeta_paciente),
    is_projeto: asBoolean(row.is_projeto),
  };
}
