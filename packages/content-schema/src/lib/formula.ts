import { Isolate, Reference, ExternalCopy } from 'isolated-vm';

// We'll create a simple formula evaluator that uses isolated-vm.
// We'll only support a subset of JavaScript for safety.
// We'll not allow access to the global object, and we'll set a timeout.

// We'll create a pool of isolates? For simplicity, we'll create one isolate per evaluation.
// But note: creating an isolate is expensive. We'll create a single isolate and reuse it with a context.
// However, isolated-vm does not allow resetting the context easily. We'll create a new isolate for each evaluation.
// For now, we'll do that and then we can optimize later.

// We'll define a safe environment: only allow Math and a few globals.
// We'll also set a timeout for the evaluation.

export interface FormulaContext {
  a: Record<string, any>; // attacker
  b: Record<string, any>; // defender
  v: Record<string, any>; // game variables (if needed)
}

export class FormulaEvaluator {
  private isolate: Isolate;

  constructor() {
    this.isolate = new Isolate({ memoryLimit: 128 }); // 128 MB memory limit
  }

  // We'll evaluate a formula string in the context of a and b.
  // We'll return a number.
  // We'll throw if the formula is invalid or if it times out.
  evaluate(formula: string, context: FormulaContext, timeoutMs: number = 100): number {
    const contextObject = this.isolate.createContextSync();

    try {
      // Create global variables for the evaluation context
      contextObject.global.setSync('a', new ExternalCopy(context.a).copyInto());
      contextObject.global.setSync('b', new ExternalCopy(context.b).copyInto());
      contextObject.global.setSync('v', new ExternalCopy(context.v || {}).copyInto());
      
      const script = this.isolate.compileScriptSync(`(function() { return (${formula}); })()`);
      const result = script.runSync(contextObject, { timeout: timeoutMs });

      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error(`Formula did not return a valid number: ${result}`);
      }

      return result;
    } catch (error: any) {
      if (error.message && error.message.includes('timeout')) {
        throw new Error(`Formula evaluation timed out: ${formula}`);
      }
      throw error;
    }
  }

  dispose() {
    this.isolate.dispose();
  }
}

export function evaluateFormula(formula: string, context: FormulaContext, timeoutMs?: number): number {
  const evaluator = new FormulaEvaluator();
  try {
    return evaluator.evaluate(formula, context, timeoutMs);
  } finally {
    evaluator.dispose();
  }
}
