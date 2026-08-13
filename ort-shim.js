// Creator OS Voice Lab: ONNX Runtime Web classic-script bridge.
// Safari can reject the CDN ESM build as a module script. We load the official
// browser bundle with a classic <script> tag and expose the API as an ES module
// so Piper Plus can resolve `onnxruntime-web` through the import map.
const ort = globalThis.ort;
if (!ort) throw new Error('ONNX Runtime Web global (window.ort) is not available.');

export const env = ort.env;
export const InferenceSession = ort.InferenceSession;
export const Tensor = ort.Tensor;
export const TrainingSession = ort.TrainingSession;
export const TRACE = ort.TRACE;
export const TRACE_FUNC_BEGIN = ort.TRACE_FUNC_BEGIN;
export const TRACE_FUNC_END = ort.TRACE_FUNC_END;
export default ort;
