import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Chamado } from '@/shared/types';

export const gerarRelatorioPendentes = (
  chamados: Chamado[],
  setoresMap: Map<number, string>
) => {
  const doc = new jsPDF();
  
  // Configurações
  const hoje = new Date();
  const dataHora = hoje.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Filtrar apenas chamados pendentes (não resolvidos/fechados/cancelados)
  const pendentes = chamados.filter(c => 
    !['Resolvido', 'Fechado', 'Cancelado'].includes(c.status)
  );

  // Cabeçalho
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE CHAMADOS PENDENTES', 105, 15, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Gerado em: ${dataHora}`, 105, 22, { align: 'center' });
  doc.text(`Total de chamados pendentes: ${pendentes.length}`, 105, 28, { align: 'center' });

  // Linha separadora
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 32, 196, 32);

  // Preparar dados da tabela
  const tableData = pendentes.map(chamado => [
    chamado.numero,
    chamado.titulo.length > 40 ? chamado.titulo.substring(0, 37) + '...' : chamado.titulo,
    chamado.solicitante_nome,
    chamado.solicitante_setor || '-',
    chamado.setor_destino_id ? setoresMap.get(chamado.setor_destino_id) || '-' : '-',
    chamado.prioridade || '-',
    chamado.status,
    new Date(chamado.data_abertura).toLocaleDateString('pt-BR')
  ]);

  // Gerar tabela
  autoTable(doc, {
    startY: 36,
    head: [['#', 'Título', 'Solicitante', 'Setor Sol.', 'Setor Resp.', 'Prior.', 'Status', 'Abertura']],
    body: tableData,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [67, 56, 202], // Indigo
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 18, halign: 'center' }, // Número
      1: { cellWidth: 45 }, // Título
      2: { cellWidth: 28 }, // Solicitante
      3: { cellWidth: 22 }, // Setor Solicitante
      4: { cellWidth: 22 }, // Setor Responsável
      5: { cellWidth: 12, halign: 'center' }, // Prioridade
      6: { cellWidth: 20, halign: 'center' }, // Status
      7: { cellWidth: 15, halign: 'center' }, // Abertura
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    margin: { top: 36, left: 14, right: 14 },
    didDrawPage: (data) => {
      // Rodapé em cada página
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(
        `Página ${data.pageNumber} de ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }
  });

  // Adicionar resumo por prioridade no final
  const finalY = (doc as any).lastAutoTable.finalY || 36;
  
  if (finalY < doc.internal.pageSize.height - 50) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumo por Prioridade:', 14, finalY + 10);
    
    const resumoPrioridade = {
      P1: pendentes.filter(c => c.prioridade === 'P1').length,
      P2: pendentes.filter(c => c.prioridade === 'P2').length,
      P3: pendentes.filter(c => c.prioridade === 'P3').length,
      P4: pendentes.filter(c => c.prioridade === 'P4').length,
    };
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let yPos = finalY + 16;
    doc.text(`P1 (Crítica): ${resumoPrioridade.P1}`, 14, yPos);
    doc.text(`P2 (Alta): ${resumoPrioridade.P2}`, 14, yPos + 5);
    doc.text(`P3 (Média): ${resumoPrioridade.P3}`, 14, yPos + 10);
    doc.text(`P4 (Baixa): ${resumoPrioridade.P4}`, 14, yPos + 15);
  }

  // Salvar PDF
  const nomeArquivo = `Chamados_Pendentes_${hoje.toISOString().split('T')[0]}_${hoje.getHours()}h${hoje.getMinutes()}.pdf`;
  doc.save(nomeArquivo);
};
