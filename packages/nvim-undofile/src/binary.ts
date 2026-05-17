export class BinaryReader {
  private offset = 0;

  constructor(private readonly buffer: Buffer) {}

  get position(): number {
    return this.offset;
  }

  get eof(): boolean {
    return this.offset >= this.buffer.length;
  }

  readBuffer(length: number): Buffer {
    if (length < 0 || this.offset + length > this.buffer.length) {
      throw new Error("Unexpected end of undofile.");
    }
    const value = this.buffer.subarray(this.offset, this.offset + length);
    this.offset += length;
    return Buffer.from(value);
  }

  readUInt8(): number {
    return this.readBuffer(1).readUInt8(0);
  }

  readUInt16BE(): number {
    return this.readBuffer(2).readUInt16BE(0);
  }

  readInt32BE(): number {
    return this.readBuffer(4).readInt32BE(0);
  }

  readBigUInt64BE(): bigint {
    return this.readBuffer(8).readBigUInt64BE(0);
  }
}

export class BinaryWriter {
  private readonly chunks: Buffer[] = [];

  writeBuffer(buffer: Buffer): void {
    this.chunks.push(Buffer.from(buffer));
  }

  writeUInt8(value: number): void {
    const buffer = Buffer.alloc(1);
    buffer.writeUInt8(value);
    this.writeBuffer(buffer);
  }

  writeUInt16BE(value: number): void {
    const buffer = Buffer.alloc(2);
    buffer.writeUInt16BE(value & 0xffff);
    this.writeBuffer(buffer);
  }

  writeInt32BE(value: number): void {
    const buffer = Buffer.alloc(4);
    buffer.writeInt32BE(value | 0);
    this.writeBuffer(buffer);
  }

  writeBigUInt64BE(value: bigint): void {
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(value);
    this.writeBuffer(buffer);
  }

  toBuffer(): Buffer {
    return Buffer.concat(this.chunks);
  }
}
