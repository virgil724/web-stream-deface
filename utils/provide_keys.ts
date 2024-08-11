import type { InferenceSession } from "onnxruntime-web";
import type { InjectionKey } from "vue";

export interface BackendContext {
    backend: Ref<string>;
    updateBackend: (val: string) => void;
}

export const backend_provide = Symbol('backend') as InjectionKey<BackendContext>

export const onnx_provide = Symbol('onnx') as InjectionKey<Ref<InferenceSession>>
