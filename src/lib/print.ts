export function printTable(title: string, columns: string[], data: string[][]) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print.');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          body {
            font-family: 'Inter', system-ui, sans-serif;
            color: #111827;
            padding: 20px;
          }
          h1 {
            font-size: 24px;
            margin-bottom: 20px;
            color: #111827;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          th, td {
            border: 1px solid #e5e7eb;
            padding: 12px;
            text-align: left;
            font-size: 14px;
          }
          th {
            background-color: #f9fafb;
            font-weight: 600;
            color: #374151;
          }
          tr:nth-child(even) {
            background-color: #f9fafb;
          }
          @media print {
            body {
              padding: 0;
            }
            @page {
              margin: 1cm;
            }
          }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <table>
          <thead>
            <tr>
              ${columns.map(col => `<th>${col}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.map(row => `
              <tr>
                ${row.map(cell => `<td>${cell || ''}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        <script>
          window.onload = () => {
            window.print();
            setTimeout(() => window.close(), 500);
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
