import { DocumentStructure, BlockType } from '../types/DocumentBlock';
import * as FileSystem from 'expo-file-system';

class HTMLExporterService {
  // Export document structure to HTML
  async exportToHTML(
    structure: DocumentStructure,
    outputPath: string
  ): Promise<string> {
    const html = this.generateHTML(structure);
    await FileSystem.writeAsStringAsync(outputPath, html);
    return outputPath;
  }

  // Generate HTML from structure
  private generateHTML(structure: DocumentStructure): string {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${structure.metadata.title || 'Document'}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
        }
        h1 { font-size: 2em; font-weight: bold; margin-top: 1em; }
        h2 { font-size: 1.5em; font-weight: bold; margin-top: 0.8em; }
        h3 { font-size: 1.2em; font-weight: bold; margin-top: 0.6em; }
        p { margin: 0.5em 0; }
        ul { margin: 0.5em 0; padding-left: 2em; }
        li { margin: 0.3em 0; }
        table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        img { max-width: 100%; height: auto; margin: 1em 0; }
    </style>
</head>
<body>
`;

    if (structure.metadata.title) {
      html += `    <h1>${this.escapeHtml(structure.metadata.title)}</h1>\n`;
    }

    for (const page of structure.pages) {
      for (const block of page.blocks) {
        html += this.blockToHTML(block);
      }
    }

    html += `</body>
</html>`;

    return html;
  }

  // Convert block to HTML
  private blockToHTML(block: { type: BlockType; text?: string; children?: any[] }): string {
    const text = this.escapeHtml(block.text || '');

    switch (block.type) {
      case 'title':
        return `    <h1>${text}</h1>\n`;

      case 'heading':
        return `    <h2>${text}</h2>\n`;

      case 'paragraph':
        return `    <p>${text}</p>\n`;

      case 'list':
        if (block.children && block.children.length > 0) {
          let listHtml = '    <ul>\n';
          for (const item of block.children) {
            listHtml += `      <li>${this.escapeHtml(item.text || '')}</li>\n`;
          }
          listHtml += '    </ul>\n';
          return listHtml;
        }
        return '';

      case 'table':
        return '    <table>[Table content]</table>\n';

      case 'image':
        return `    <img src="${block.text || ''}" alt="Image" />\n`;

      default:
        if (text) {
          return `    <p>${text}</p>\n`;
        }
        return '';
    }
  }

  // Escape HTML special characters
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}

export default new HTMLExporterService();
















