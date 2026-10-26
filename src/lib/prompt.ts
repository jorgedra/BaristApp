import instruction from '../../docs/instruccion-llm.md?raw';

export const LLM_INSTRUCTION = instruction;

/** El JSON de ejemplo de la instrucción, para la demo de importación. */
export function exampleJson(): string {
  const m = /^```json[ \t]*\n([\s\S]*?)^```/m.exec(instruction);
  return m ? m[1].trim() : '';
}
