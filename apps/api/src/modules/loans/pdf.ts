import { createHash } from "node:crypto"
import { type PDFFont, PDFDocument, rgb, StandardFonts } from "pdf-lib"

export function computeContentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

function wrapText(
  text: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  const paragraphs = text.split("\n")
  const lines: string[] = []

  for (const paragraph of paragraphs) {
    const words = paragraph.split(" ")
    let currentLine = ""

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word

      if (
        font.widthOfTextAtSize(candidate, fontSize) > maxWidth &&
        currentLine
      ) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = candidate
      }
    }

    lines.push(currentLine)
  }

  return lines
}

type DocumentMetadata = {
  type: string
  createdAt: Date
  contentHash: string
}

export async function generateDocumentPdf(
  content: string,
  metadata: DocumentMetadata
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)

  const margin = 50
  const fontSize = 11
  const lineHeight = fontSize + 6

  let page = pdfDoc.addPage()
  let { width, height } = page.getSize()
  let y = height - margin

  page.drawText(metadata.type, { x: margin, y, size: 16, font })
  y -= 30

  const maxWidth = width - margin * 2
  const lines = wrapText(content, font, fontSize, maxWidth)

  for (const line of lines) {
    if (y < margin + lineHeight) {
      page = pdfDoc.addPage()
      const size = page.getSize()
      width = size.width
      height = size.height
      y = height - margin
    }

    page.drawText(line, { x: margin, y, size: fontSize, font })
    y -= lineHeight
  }

  page.drawText(`Generated: ${metadata.createdAt.toISOString()}`, {
    x: margin,
    y: 30,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4)
  })
  page.drawText(`SHA-256: ${metadata.contentHash}`, {
    x: margin,
    y: 18,
    size: 8,
    font,
    color: rgb(0.4, 0.4, 0.4)
  })

  return pdfDoc.save()
}
