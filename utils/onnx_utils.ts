import { Tensor } from "onnxruntime-web";
import * as ort from 'onnxruntime-web'

export const bufferToTensor = (buffer: Uint8ClampedArray | undefined, options: any): Tensor => {
  if (buffer === undefined) {
    throw new Error('Image buffer must be defined');
  }
  if (options.height === undefined || options.width === undefined) {
    throw new Error('Image height and width must be defined');
  }
  if (options.tensorLayout === 'NHWC') {
    throw new Error('NHWC Tensor layout is not supported yet');
  }

  const { height, width } = options;

  const norm = options.norm ?? { mean: 255, bias: 0 };
  let normMean: [number, number, number, number];
  let normBias: [number, number, number, number];

  if (typeof (norm.mean) === 'number') {
    normMean = [norm.mean, norm.mean, norm.mean, norm.mean];
  } else {
    normMean = [norm.mean![0], norm.mean![1], norm.mean![2], norm.mean![3] ?? 255];
  }

  if (typeof (norm.bias) === 'number') {
    normBias = [norm.bias, norm.bias, norm.bias, norm.bias];
  } else {
    normBias = [norm.bias![0], norm.bias![1], norm.bias![2], norm.bias![3] ?? 0];
  }

  const inputformat = options.format !== undefined ? options.format : 'RGBA';
  // default value is RGBA since imagedata and HTMLImageElement uses it

  const outputformat =
    options.tensorFormat !== undefined ? (options.tensorFormat !== undefined ? options.tensorFormat : 'RGB') : 'RGB';
  const stride = height * width;
  const float32Data = outputformat === 'RGBA' ? new Float32Array(stride * 4) : new Float32Array(stride * 3);

  // Default pointer assignments
  let step = 4, rImagePointer = 0, gImagePointer = 1, bImagePointer = 2, aImagePointer = 3;
  let rTensorPointer = 0, gTensorPointer = stride, bTensorPointer = stride * 2, aTensorPointer = -1;

  // Updating the pointer assignments based on the input image format
  if (inputformat === 'RGB') {
    step = 3;
    rImagePointer = 0;
    gImagePointer = 1;
    bImagePointer = 2;
    aImagePointer = -1;
  }

  // Updating the pointer assignments based on the output tensor format
  if (outputformat === 'RGBA') {
    aTensorPointer = stride * 3;
  } else if (outputformat === 'RBG') {
    rTensorPointer = 0;
    bTensorPointer = stride;
    gTensorPointer = stride * 2;
  } else if (outputformat === 'BGR') {
    bTensorPointer = 0;
    gTensorPointer = stride;
    rTensorPointer = stride * 2;
  }

  for (let i = 0; i < stride;
    i++, rImagePointer += step, bImagePointer += step, gImagePointer += step, aImagePointer += step) {
    float32Data[rTensorPointer++] = (buffer[rImagePointer] + normBias[0]) / normMean[0];
    float32Data[gTensorPointer++] = (buffer[gImagePointer] + normBias[1]) / normMean[1];
    float32Data[bTensorPointer++] = (buffer[bImagePointer] + normBias[2]) / normMean[2];
    if (aTensorPointer !== -1 && aImagePointer !== -1) {
      float32Data[aTensorPointer++] = (buffer[aImagePointer] + normBias[3]) / normMean[3];
    }
  }

  // Float32Array -> ort.Tensor
  const outputTensor = outputformat === 'RGBA' ? new Tensor('float32', float32Data, [1, 4, height, width]) :
    new Tensor('float32', float32Data, [1, 3, height, width]);
  return outputTensor;
};

export const createSession = async (backend: String) => {
  let executionProviders: string[];
  
  switch (backend) {
    case 'webgpu':
      executionProviders = ['webgpu', 'webgl', 'wasm']; // Fallback chain
      break;
    case 'webgl':
      executionProviders = ['webgl', 'wasm']; // Fallback chain
      break;
    case 'cpu':
    default:
      executionProviders = ['wasm'];
      break;
  }

  // Set WASM paths to CDN for better compatibility
  ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/";
  
  // Configure WebGPU specific settings
  if (backend === 'webgpu') {
    ort.env.webgpu.validateInputContent = false; // For better performance
    ort.env.webgpu.powerPreference = 'high-performance';
  }
  
  const model_options = {
    executionProviders,
    executionMode: 'sequential' as const,
    graphOptimizationLevel: backend === 'webgpu' ? 'all' as const : 'basic' as const
  };
  
  try {
    const sess = await ort.InferenceSession.create('/centerface.onnx', model_options);
    return sess;
  } catch (error) {
    // If WebGPU fails, fallback to WebGL or WASM
    if (backend === 'webgpu' && executionProviders.includes('webgpu')) {
      console.warn('WebGPU failed, falling back to WebGL');
      return createSession('webgl');
    } else if (backend === 'webgl' && executionProviders.includes('webgl')) {
      console.warn('WebGL failed, falling back to CPU');
      return createSession('cpu');
    }
    throw error;
  }
}


export function reshapeArray(data, dims) {
  const [B, C, H, W] = dims;
  let index = 0;
  const reshaped = [];

  for (let b = 0; b < B; b++) {
    const batch = [];
    for (let c = 0; c < C; c++) {
      const channel = [];
      for (let h = 0; h < H; h++) {
        const row = [];
        for (let w = 0; w < W; w++) {
          row.push(data[index]);
          index++;
        }
        channel.push(row);
      }
      batch.push(channel);
    }
    reshaped.push(batch);
  }

  return reshaped;
}
