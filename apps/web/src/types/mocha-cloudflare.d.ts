type D1Result<T = Record<string, unknown>> = {
  results?: T[];
  success?: boolean;
  error?: string;
  meta?: unknown;
};

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  raw<T = unknown[]>(): Promise<T[]>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(
    statements: D1PreparedStatement[]
  ): Promise<Array<D1Result<T>>>;
  exec(query: string): Promise<D1Result>;
  dump(): Promise<ArrayBuffer>;
}

type R2PutValueType =
  | string
  | ArrayBuffer
  | ArrayBufferView
  | Blob
  | ReadableStream;

interface R2Object {
  key: string;
  version: string;
  size: number;
  etag: string;
  httpEtag: string;
  uploaded: Date;
  checksums?: Record<string, unknown>;
  httpMetadata?: Record<string, unknown>;
  customMetadata?: Record<string, string>;
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  bodyUsed: boolean;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  blob(): Promise<Blob>;
}

interface R2Objects {
  objects: R2Object[];
  truncated: boolean;
  cursor?: string;
  delimitedPrefixes: string[];
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: R2PutValueType | null,
    options?: Record<string, unknown>
  ): Promise<R2Object | null>;
  delete(keys: string | string[]): Promise<void>;
  list(options?: Record<string, unknown>): Promise<R2Objects>;
  head(key: string): Promise<R2Object | null>;
}
