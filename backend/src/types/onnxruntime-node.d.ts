/**
 * Minimal typings for onnxruntime-node (package ships JS without bundled .d.ts).
 */
declare module 'onnxruntime-node' {
  export class Tensor {
    constructor(type: string, data: Float32Array, dims: readonly number[]);
    readonly data: Float32Array;
    readonly dims: readonly number[];
  }

  export class InferenceSession {
    static create(modelPath: string): Promise<InferenceSession>;
    readonly inputNames: readonly string[];
    readonly outputNames: readonly string[];
    run(feeds: Record<string, Tensor>): Promise<Record<string, Tensor>>;
  }
}
