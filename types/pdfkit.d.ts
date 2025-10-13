declare module "pdfkit" {
  import type { Readable } from "stream";

  export interface PDFDocumentOptions {
    margin?: number;
  }

  export default class PDFDocument extends Readable {
    constructor(options?: PDFDocumentOptions);
    fontSize(size: number): this;
    moveDown(lines?: number): this;
    text(text: string, options?: Record<string, unknown>): this;
    underline(x: number, y: number, width: number, height: number): this;
    end(): void;
  }
}
