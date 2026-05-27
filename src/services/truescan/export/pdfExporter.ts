import { DocumentStructure } from '../types/DocumentBlock';
import jsPDF from 'jspdf';
import * as FileSystem from 'expo-file-system';

class PDFExporterService {
  // Export document structure to PDF
  async exportToPDF(
    structure: DocumentStructure,
    outputPath: string
  ): Promise<string> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    let yPosition = 20;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const lineHeight = 7;

    for (const page of structure.pages) {
      // Add new page if not first
      if (page.pageIndex > 0) {
        doc.addPage();
        yPosition = margin;
      }

      for (const block of page.blocks) {
        // Check if we need a new page
        if (yPosition > pageHeight - margin - 20) {
          doc.addPage();
          yPosition = margin;
        }

        switch (block.type) {
          case 'title':
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text(block.text || '', margin, yPosition);
            yPosition += 15;
            break;

          case 'heading':
            doc.setFontSize(18 - (block.readingOrder % 3) * 2);
            doc.setFont('helvetica', 'bold');
            doc.text(block.text || '', margin, yPosition);
            yPosition += 12;
            break;

          case 'paragraph':
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            const paragraphText = doc.splitTextToSize(block.text || '', 170);
            doc.text(paragraphText, margin, yPosition);
            yPosition += paragraphText.length * lineHeight;
            break;

          case 'list':
            if (block.children) {
              doc.setFontSize(12);
              doc.setFont('helvetica', 'normal');
              for (const item of block.children) {
                doc.text(`• ${item.text || ''}`, margin + 5, yPosition);
                yPosition += lineHeight;
              }
            }
            break;

          case 'table':
            // Tables would be rendered here
            doc.setFontSize(10);
            doc.text('[Table]', margin, yPosition);
            yPosition += lineHeight * 2;
            break;

          default:
            if (block.text) {
              doc.setFontSize(12);
              doc.text(block.text, margin, yPosition);
              yPosition += lineHeight;
            }
        }

        yPosition += 5; // Spacing between blocks
      }
    }

    // Save PDF
    const pdfBlob = doc.output('blob');
    const base64 = await this.blobToBase64(pdfBlob);
    await FileSystem.writeAsStringAsync(outputPath, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return outputPath;
  }

  // Convert blob to base64
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export default new PDFExporterService();
















