import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Exporta datos a archivo CSV compatible con Excel en español (BOM UTF-8, delimitador punto y coma).
 */
export function exportToCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const escapedHeaders = headers.map((h) => `"${String(h).replace(/"/g, '""')}"`);
  const escapedRows = rows.map((r) =>
    r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(';')
  );
  const csvContent = '\uFEFF' + [escapedHeaders.join(';'), ...escapedRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exporta datos a archivo Excel (.xlsx) nativo con autoajuste de ancho de columnas.
 */
export function exportToExcel(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  const wb = XLSX.utils.book_new();
  // Formatear celdas explícitamente: números como 'n' y textos (como ICCID o teléfonos largos) como 's' (string)
  // para evitar que Excel los convierta automáticamente a notación científica (ej: 8.956e+19)
  const formattedData = [
    headers.map((h) => ({ t: 's' as const, v: String(h) })),
    ...rows.map((r) =>
      r.map((c) =>
        typeof c === 'number'
          ? { t: 'n' as const, v: c }
          : { t: 's' as const, v: String(c ?? '') }
      )
    ),
  ];
  const ws = XLSX.utils.aoa_to_sheet(formattedData);

  // Autoajuste de anchos de columna
  const colWidths = headers.map((h, i) => {
    let maxLen = h.length;
    for (const r of rows) {
      const valStr = String(r[i] ?? '');
      if (valStr.length > maxLen) maxLen = valStr.length;
    }
    return { wch: Math.min(Math.max(maxLen + 3, 10), 45) };
  });
  ws['!cols'] = colWidths;

  const validSheetName = (sheetName || 'Inventario').replace(/[\\/?*[\]]/g, '').slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, validSheetName);
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/**
 * Exporta datos a documento PDF estilizado con orientación inteligente y tabla paginada.
 */
export function exportToPdf(
  filename: string,
  title: string,
  headers: string[],
  rows: (string | number)[][]
): void {
  // Orientación horizontal (landscape) si hay más de 5 columnas para asegurar legibilidad
  const orientation = headers.length > 5 ? 'landscape' : 'portrait';
  const doc = new jsPDF({ orientation, unit: 'pt', format: 'letter' });

  // Encabezado corporativo
  doc.setFontSize(16);
  doc.setTextColor(58, 67, 93); // #3a435d
  doc.text(title, 40, 38);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const dateStr = new Date().toLocaleString('es-CL');
  doc.text(`Fecha de exportación: ${dateStr}  |  Total de registros: ${rows.length}`, 40, 52);

  // Tabla con estilo coherente con el sistema
  autoTable(doc, {
    startY: 65,
    head: [headers],
    body: rows,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 4,
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [0, 172, 238], // #00acee de PlatInvent
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'left',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { left: 40, right: 40, bottom: 40 },
    didDrawPage: (data) => {
      // Pie de página con número de página
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      const str = `Página ${data.pageNumber}`;
      const pageWidth = doc.internal.pageSize.width || doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.height || doc.internal.pageSize.getHeight();
      doc.text(str, pageWidth - 40 - doc.getTextWidth(str), pageHeight - 20);
      doc.text('PlatInvent - Plataforma de Inventario Vtraxx', 40, pageHeight - 20);
    },
  });

  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}
