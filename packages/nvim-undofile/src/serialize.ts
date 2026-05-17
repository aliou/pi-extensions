import { BinaryWriter } from "./binary";
import { UND_FILE_CONSTANTS } from "./parse";
import type {
  ExtmarkRecord,
  OptionalField,
  Pos,
  UndoEntry,
  UndoFile,
  UndoHeader,
  VisualInfo,
} from "./types";

function writeOptionalFields(
  writer: BinaryWriter,
  fields: OptionalField[],
): void {
  for (const field of fields) {
    if (field.data.length > 255) {
      throw new Error(`Optional field too large: ${field.data.length}`);
    }
    writer.writeUInt8(field.data.length);
    writer.writeUInt8(field.what);
    writer.writeBuffer(field.data);
  }
  writer.writeUInt8(0);
}

function writePos(writer: BinaryWriter, pos: Pos): void {
  writer.writeInt32BE(pos.lnum);
  writer.writeInt32BE(pos.col);
  writer.writeInt32BE(pos.coladd);
}

function writeVisual(writer: BinaryWriter, visual: VisualInfo): void {
  writePos(writer, visual.start);
  writePos(writer, visual.end);
  writer.writeInt32BE(visual.mode);
  writer.writeInt32BE(visual.curswant);
}

function writeEntry(writer: BinaryWriter, entry: UndoEntry): void {
  writer.writeInt32BE(entry.top);
  writer.writeInt32BE(entry.bot);
  writer.writeInt32BE(entry.lcount);
  writer.writeInt32BE(entry.lines.length);

  for (const line of entry.lines) {
    writer.writeInt32BE(line.length);
    writer.writeBuffer(line);
  }
}

function writeExtmark(writer: BinaryWriter, extmark: ExtmarkRecord): void {
  if (extmark.data.length !== 48) {
    throw new Error(`Expected 48 extmark bytes, got ${extmark.data.length}.`);
  }
  writer.writeUInt16BE(UND_FILE_CONSTANTS.UF_ENTRY_MAGIC);
  writer.writeInt32BE(extmark.type);
  writer.writeBuffer(extmark.data);
}

function writeHeader(writer: BinaryWriter, header: UndoHeader): void {
  writer.writeUInt16BE(UND_FILE_CONSTANTS.UF_HEADER_MAGIC);
  writer.writeInt32BE(header.nextSeq);
  writer.writeInt32BE(header.prevSeq);
  writer.writeInt32BE(header.altNextSeq);
  writer.writeInt32BE(header.altPrevSeq);
  writer.writeInt32BE(header.seq);
  writePos(writer, header.cursor);
  writer.writeInt32BE(header.cursorVcol);
  writer.writeUInt16BE(header.flags);

  if (header.namedMarks.length !== UND_FILE_CONSTANTS.NMARKS) {
    throw new Error(`Expected ${UND_FILE_CONSTANTS.NMARKS} named marks.`);
  }
  for (const mark of header.namedMarks) {
    writePos(writer, mark);
  }

  writeVisual(writer, header.visual);
  writer.writeBigUInt64BE(header.time);
  writeOptionalFields(writer, header.optionalFields);

  for (const entry of header.entries) {
    writer.writeUInt16BE(UND_FILE_CONSTANTS.UF_ENTRY_MAGIC);
    writeEntry(writer, entry);
  }
  writer.writeUInt16BE(UND_FILE_CONSTANTS.UF_ENTRY_END_MAGIC);

  for (const extmark of header.extmarks) {
    writeExtmark(writer, extmark);
  }
  writer.writeUInt16BE(UND_FILE_CONSTANTS.UF_ENTRY_END_MAGIC);
}

export function serializeUndofile(file: UndoFile): Buffer {
  const writer = new BinaryWriter();
  if (file.hash.length !== 32) {
    throw new Error(`Expected 32 hash bytes, got ${file.hash.length}.`);
  }

  writer.writeBuffer(UND_FILE_CONSTANTS.MAGIC);
  writer.writeUInt16BE(UND_FILE_CONSTANTS.VERSION);
  writer.writeBuffer(file.hash);
  writer.writeInt32BE(file.lineCount);
  writer.writeInt32BE(file.uLine.length);
  writer.writeBuffer(file.uLine);
  writer.writeInt32BE(file.uLineLnum);
  writer.writeInt32BE(file.uLineColnr);
  writer.writeInt32BE(file.oldHeadSeq);
  writer.writeInt32BE(file.newHeadSeq);
  writer.writeInt32BE(file.curHeadSeq);
  writer.writeInt32BE(file.headers.length);
  writer.writeInt32BE(file.seqLast);
  writer.writeInt32BE(file.seqCur);
  writer.writeBigUInt64BE(file.timeCur);
  writeOptionalFields(writer, file.optionalFields);

  for (const header of file.headers) {
    writeHeader(writer, header);
  }
  writer.writeUInt16BE(UND_FILE_CONSTANTS.UF_HEADER_END_MAGIC);

  return writer.toBuffer();
}
