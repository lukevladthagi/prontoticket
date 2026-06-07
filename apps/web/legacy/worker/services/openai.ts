import OpenAI from 'openai';

interface ExtrairInfoTicketResult {
  titulo: string;
  descricao: string;
  categoria: string | null;
  prioridade: string;
  tipo: 'Incidente' | 'Requisição' | 'Problema' | 'Mudança';
}

export async function extrairInformacaoTicket(
  env: Env,
  mensagens: string[]
): Promise<ExtrairInfoTicketResult> {
  if (!env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não configurada');
  }

  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  const conversaCompleta = mensagens.join('\n');

  const prompt = `Você é um assistente de TI especializado em analisar solicitações e criar tickets de suporte.

Analise a seguinte conversa de WhatsApp e extraia as informações necessárias para criar um chamado de TI:

${conversaCompleta}

Retorne um JSON com as seguintes informações:
- titulo: Um título curto e descritivo (máximo 100 caracteres)
- descricao: Uma descrição detalhada do problema ou solicitação
- categoria: Identifique a categoria mais apropriada entre: "Hardware", "Software", "Rede", "Acesso", "Email", "Impressora", "Telefonia", "Outro" (se não conseguir identificar, retorne null)
- prioridade: Determine a prioridade baseada na urgência: "P1" (crítico), "P2" (alto), "P3" (médio), ou "P4" (baixo)
- tipo: Classifique como "Incidente" (algo quebrado), "Requisição" (pedido de algo novo), "Problema" (causa raiz), ou "Mudança" (alteração planejada)

Seja conciso e objetivo. Se o usuário não forneceu informações suficientes, use seu julgamento para preencher os campos de forma sensata.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um assistente especializado em TI que analisa conversas e extrai informações estruturadas para criar tickets de suporte.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Resposta vazia do OpenAI');
    }

    const resultado = JSON.parse(content) as ExtrairInfoTicketResult;
    
    // Validar e normalizar os dados
    if (!resultado.titulo) resultado.titulo = 'Chamado via WhatsApp';
    if (!resultado.descricao) resultado.descricao = conversaCompleta;
    if (!['Incidente', 'Requisição', 'Problema', 'Mudança'].includes(resultado.tipo)) {
      resultado.tipo = 'Incidente';
    }
    if (!['P1', 'P2', 'P3', 'P4'].includes(resultado.prioridade)) {
      resultado.prioridade = 'P3';
    }

    return resultado;
  } catch (error) {
    console.error('Erro ao processar com OpenAI:', error);
    
    // Fallback: criar ticket básico com as mensagens
    return {
      titulo: 'Chamado via WhatsApp',
      descricao: conversaCompleta,
      categoria: null,
      prioridade: 'P3',
      tipo: 'Incidente',
    };
  }
}

export async function gerarRespostaIA(
  env: Env,
  mensagemUsuario: string,
  contexto: string[]
): Promise<string> {
  // Verificar se é uma saudação básica
  const mensagemLower = mensagemUsuario.toLowerCase().trim();
  const saudacoes = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'start', '/start', 'ola', 'hello', 'hi', 'hey'];
  
  if (saudacoes.includes(mensagemLower) || mensagemLower.length <= 3) {
    return `👋 Olá! Sou o assistente virtual do sistema de chamados.

<b>Como posso te ajudar?</b>

🎫 <b>Para abrir um novo chamado:</b>
• Digite: "novo ticket", "preciso de ajuda" ou "abrir chamado"
• Ou descreva diretamente o problema que está enfrentando

📋 <b>Para ver seus chamados:</b>
• Digite: "meus tickets" ou "meus chamados"

💬 <b>Para adicionar informações a um chamado existente:</b>
• Digite o número do ticket seguido da mensagem
• Exemplo: "TKT-123456 o problema continua"

Como posso te ajudar hoje?`;
  }
  
  if (!env.OPENAI_API_KEY) {
    return 'Olá! Recebi sua mensagem. Estou processando sua solicitação e vou criar um chamado para você. Você receberá o número do chamado em breve.';
  }

  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  const mensagens: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `Você é um assistente virtual de TI de um hospital. Seu objetivo é:
1. Coletar informações sobre problemas ou solicitações de TI
2. Ser educado, profissional e empático
3. Fazer perguntas claras quando precisar de mais detalhes
4. Informar que você vai criar um chamado automaticamente
5. Responder em português brasileiro

Seja breve e objetivo. Use emojis quando apropriado.`,
    },
  ];

  // Adicionar histórico da conversa
  contexto.forEach((msg, index) => {
    mensagens.push({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: msg,
    });
  });

  // Adicionar mensagem atual
  mensagens.push({
    role: 'user',
    content: mensagemUsuario,
  });

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: mensagens,
      max_tokens: 200,
      temperature: 0.7,
    });

    return response.choices[0].message.content || 'Desculpe, não consegui processar sua mensagem.';
  } catch (error) {
    console.error('Erro ao gerar resposta IA:', error);
    return 'Olá! Recebi sua mensagem. Vou criar um chamado para você e nossa equipe entrará em contato em breve.';
  }
}

export async function deveCriarTicket(
  env: Env,
  mensagens: string[]
): Promise<boolean> {
  // Verificar comandos explícitos para criar ticket
  const ultimaMensagem = mensagens[mensagens.length - 1].toLowerCase().trim();
  const comandosNovoTicket = ['novo ticket', 'abrir ticket', 'criar ticket', 'novo', 'criar', 'preciso de ajuda', 'abrir chamado', 'novo chamado'];
  
  if (comandosNovoTicket.some(cmd => ultimaMensagem.includes(cmd))) {
    return true;
  }
  
  // Verificar se é comando para ver tickets (não criar)
  const comandosVerTickets = ['meus tickets', 'meus chamados', 'ver tickets', 'ver chamados', 'listar tickets'];
  if (comandosVerTickets.some(cmd => ultimaMensagem.includes(cmd))) {
    return false;
  }
  
  if (!env.OPENAI_API_KEY) {
    // Se não tem OpenAI, criar ticket para qualquer mensagem que não seja saudação básica
    const saudacoes = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'start', '/start', 'hello', 'hi', 'hey'];
    return !saudacoes.includes(ultimaMensagem) && ultimaMensagem.length > 3;
  }

  const client = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  const conversaCompleta = mensagens.join('\n');

  const prompt = `Analise a seguinte conversa e determine se o usuário está solicitando ajuda de TI, relatando um problema ou fazendo uma requisição que requer a criação de um chamado de suporte.

Conversa:
${conversaCompleta}

Retorne um JSON com:
- deve_criar_ticket: true se o usuário precisa de ajuda/suporte de TI, false se for apenas uma saudação ou conversa casual
- motivo: breve explicação da decisão

Exemplos que DEVEM criar ticket:
- "meu computador não liga"
- "preciso de um mouse novo"
- "a impressora está travada"
- "não consigo acessar o sistema"
- "está com problema no ponto de rede"

Exemplos que NÃO devem criar ticket:
- "oi"
- "olá"
- "bom dia"
- apenas saudações sem pedido de ajuda`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um assistente que analisa conversas para determinar se é necessário criar um ticket de suporte.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return false;
    }

    const resultado = JSON.parse(content) as { deve_criar_ticket: boolean; motivo: string };
    return resultado.deve_criar_ticket;
  } catch (error) {
    console.error('Erro ao analisar se deve criar ticket:', error);
    // Em caso de erro, criar ticket se a mensagem não for uma saudação simples
    const saudacoes = ['oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'start', '/start', 'hello', 'hi', 'hey'];
    return !saudacoes.includes(ultimaMensagem) && ultimaMensagem.length > 3;
  }
}
