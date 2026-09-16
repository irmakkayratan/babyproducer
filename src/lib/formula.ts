/**
 * A tiny, safe expression language for user-authored metric formulas.
 *
 * Users write things like `reach * mediaRate * contentQuality`. That string is
 * parsed into an AST over a fixed whitelist — numbers, identifiers, arithmetic,
 * comparisons, a ternary and a closed set of functions. There is no `eval`, no
 * `Function` constructor, no property access and no way to reach the DOM, the
 * store or the network from a formula. Unknown identifiers fail at edit time
 * with the offending token named, so a bad formula is caught in the editor
 * rather than crashing a table row.
 */

export type Node =
  | { type: 'number'; value: number }
  | { type: 'identifier'; name: string }
  | { type: 'unary'; op: '-'; argument: Node }
  | { type: 'binary'; op: BinaryOp; left: Node; right: Node }
  | { type: 'conditional'; test: Node; consequent: Node; alternate: Node }
  | { type: 'call'; callee: FunctionName; args: Node[] };

type BinaryOp = '+' | '-' | '*' | '/' | '%' | '^' | '<' | '>' | '<=' | '>=' | '==' | '!=';

const FUNCTIONS = {
  min: (...args: number[]) => Math.min(...args),
  max: (...args: number[]) => Math.max(...args),
  round: (value: number, digits = 0) => {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  },
  floor: Math.floor,
  ceil: Math.ceil,
  abs: Math.abs,
  sqrt: Math.sqrt,
  log: (value: number, base = Math.E) => Math.log(value) / Math.log(base),
  clamp: (value: number, low: number, high: number) => Math.min(Math.max(value, low), high),
  coalesce: (...args: number[]) => args.find((value) => Number.isFinite(value)) ?? 0,
} as const;

export type FunctionName = keyof typeof FUNCTIONS;
export const FUNCTION_NAMES = Object.keys(FUNCTIONS) as FunctionName[];

export class FormulaError extends Error {
  constructor(
    message: string,
    readonly token?: string,
    readonly position?: number,
  ) {
    super(message);
    this.name = 'FormulaError';
  }
}

/* ---------------------------------------------------------------- lexing */

type Token =
  | { kind: 'number'; value: number; pos: number }
  | { kind: 'name'; value: string; pos: number }
  | { kind: 'op'; value: string; pos: number }
  | { kind: 'eof'; pos: number };

const OPERATORS = ['<=', '>=', '==', '!=', '+', '-', '*', '/', '%', '^', '(', ')', ',', '<', '>', '?', ':'];

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const char = input[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      const start = i;
      while (i < input.length && /[0-9._]/.test(input[i])) i++;
      const raw = input.slice(start, i).replace(/_/g, '');
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new FormulaError(`"${raw}" is not a number`, raw, start);
      tokens.push({ kind: 'number', value, pos: start });
      continue;
    }

    if (/[A-Za-z_]/.test(char)) {
      const start = i;
      while (i < input.length && /[A-Za-z0-9_.]/.test(input[i])) i++;
      tokens.push({ kind: 'name', value: input.slice(start, i), pos: start });
      continue;
    }

    const op = OPERATORS.find((candidate) => input.startsWith(candidate, i));
    if (!op) throw new FormulaError(`Unexpected character "${char}"`, char, i);
    tokens.push({ kind: 'op', value: op, pos: i });
    i += op.length;
  }

  tokens.push({ kind: 'eof', pos: input.length });
  return tokens;
}

/* --------------------------------------------------------------- parsing */

const BINDING_POWER: Record<string, number> = {
  '?': 1,
  '==': 2,
  '!=': 2,
  '<': 3,
  '>': 3,
  '<=': 3,
  '>=': 3,
  '+': 4,
  '-': 4,
  '*': 5,
  '/': 5,
  '%': 5,
  '^': 6,
};

/**
 * Expressions are parsed by recursive descent, so nesting depth is stack depth.
 * A formula nested past this is not something a person typed, and letting it
 * through would raise a `RangeError` the callers do not catch — the editor
 * reports a depth problem instead.
 */
const MAX_DEPTH = 64;

export function parseFormula(input: string): Node {
  const tokens = tokenize(input);
  let index = 0;
  let depth = 0;

  const peek = () => tokens[index];
  const next = () => tokens[index++];

  function expect(value: string) {
    const token = next();
    if (token.kind !== 'op' || token.value !== value) {
      throw new FormulaError(`Expected "${value}"`, value, token.pos);
    }
  }

  function parsePrimary(): Node {
    const token = next();

    if (token.kind === 'number') return { type: 'number', value: token.value };

    if (token.kind === 'name') {
      if (peek().kind === 'op' && (peek() as { value: string }).value === '(') {
        const name = token.value as FunctionName;
        if (!FUNCTION_NAMES.includes(name)) {
          throw new FormulaError(`Unknown function "${token.value}"`, token.value, token.pos);
        }
        expect('(');
        const args: Node[] = [];
        if (!(peek().kind === 'op' && (peek() as { value: string }).value === ')')) {
          args.push(parseExpression(0));
          while (peek().kind === 'op' && (peek() as { value: string }).value === ',') {
            next();
            args.push(parseExpression(0));
          }
        }
        expect(')');
        return { type: 'call', callee: name, args };
      }
      return { type: 'identifier', name: token.value };
    }

    if (token.kind === 'op' && token.value === '(') {
      const node = parseExpression(0);
      expect(')');
      return node;
    }

    if (token.kind === 'op' && token.value === '-') {
      // `-2^2` is -(2^2), not (-2)^2: negation binds looser than
      // exponentiation, so the operand is parsed at `^`'s own power.
      return { type: 'unary', op: '-', argument: parseExpression(BINDING_POWER['^']) };
    }

    throw new FormulaError('Unexpected end of formula', undefined, token.pos);
  }

  function parseExpression(minPower: number): Node {
    if (++depth > MAX_DEPTH) {
      throw new FormulaError('This formula is nested too deeply', undefined, peek().pos);
    }
    try {
      return parseExpressionInner(minPower);
    } finally {
      depth--;
    }
  }

  function parseExpressionInner(minPower: number): Node {
    let left = parsePrimary();

    for (;;) {
      const token = peek();
      if (token.kind !== 'op') break;
      const power = BINDING_POWER[token.value];
      if (power === undefined || power < minPower) break;
      next();

      if (token.value === '?') {
        const consequent = parseExpression(0);
        expect(':');
        const alternate = parseExpression(0);
        left = { type: 'conditional', test: left, consequent, alternate };
        continue;
      }

      // `^` is right-associative; everything else binds left.
      const nextPower = token.value === '^' ? power : power + 1;
      const right = parseExpression(nextPower);
      left = { type: 'binary', op: token.value as BinaryOp, left, right };
    }

    return left;
  }

  const ast = parseExpression(0);
  if (peek().kind !== 'eof') {
    const token = peek();
    throw new FormulaError('Unexpected trailing input', 'value' in token ? String(token.value) : undefined, token.pos);
  }
  return ast;
}

/* ------------------------------------------------------------ evaluation */

export function evaluateNode(node: Node, scope: Record<string, number>): number {
  switch (node.type) {
    case 'number':
      return node.value;
    case 'identifier': {
      // Own properties only: a bare `constructor` or `__proto__` must not
      // resolve through the prototype chain into a function.
      if (!Object.hasOwn(scope, node.name)) {
        throw new FormulaError(`Unknown value "${node.name}"`, node.name);
      }
      const value = scope[node.name];
      // Non-finite values pass through so `coalesce()` can do its job; the
      // caller decides what an unusable result means.
      if (typeof value !== 'number') {
        throw new FormulaError(`"${node.name}" is not a number`, node.name);
      }
      return value;
    }
    case 'unary':
      return -evaluateNode(node.argument, scope);
    case 'conditional':
      return evaluateNode(node.test, scope) ? evaluateNode(node.consequent, scope) : evaluateNode(node.alternate, scope);
    case 'call':
      return (FUNCTIONS[node.callee] as (...args: number[]) => number)(
        ...node.args.map((arg) => evaluateNode(arg, scope)),
      );
    case 'binary': {
      const left = evaluateNode(node.left, scope);
      const right = evaluateNode(node.right, scope);
      switch (node.op) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return right === 0 ? 0 : left / right;
        case '%': return right === 0 ? 0 : left % right;
        case '^': return left ** right;
        case '<': return left < right ? 1 : 0;
        case '>': return left > right ? 1 : 0;
        case '<=': return left <= right ? 1 : 0;
        case '>=': return left >= right ? 1 : 0;
        case '==': return left === right ? 1 : 0;
        case '!=': return left !== right ? 1 : 0;
      }
    }
  }
}

/**
 * Parsed formulas are cached by source.
 *
 * A metric is evaluated once per guest per render — a table of a few thousand
 * rows re-parsed the same handful of characters thousands of times, which
 * measured as the dominant cost of scoring the room. The formula set is small
 * and user-authored, so the cache is bounded rather than unbounded.
 */
const astCache = new Map<string, Node>();
const AST_CACHE_LIMIT = 256;

export function parseFormulaCached(formula: string): Node {
  const cached = astCache.get(formula);
  if (cached) return cached;
  const ast = parseFormula(formula);
  if (astCache.size >= AST_CACHE_LIMIT) astCache.clear();
  astCache.set(formula, ast);
  return ast;
}

export function evaluateFormula(formula: string, scope: Record<string, number>): number {
  return evaluateNode(parseFormulaCached(formula), scope);
}

/** Every identifier a formula depends on — used to validate against variables. */
export function formulaIdentifiers(node: Node, found = new Set<string>()): Set<string> {
  switch (node.type) {
    case 'identifier':
      found.add(node.name);
      break;
    case 'unary':
      formulaIdentifiers(node.argument, found);
      break;
    case 'binary':
      formulaIdentifiers(node.left, found);
      formulaIdentifiers(node.right, found);
      break;
    case 'conditional':
      formulaIdentifiers(node.test, found);
      formulaIdentifiers(node.consequent, found);
      formulaIdentifiers(node.alternate, found);
      break;
    case 'call':
      node.args.forEach((arg) => formulaIdentifiers(arg, found));
      break;
  }
  return found;
}

/** Editor-facing validation: returns the first problem, or null when valid. */
export function validateFormula(
  formula: string,
  knownVariables: string[],
): { message: string; token?: string } | null {
  try {
    const ast = parseFormula(formula);
    const known = new Set(knownVariables);
    for (const identifier of formulaIdentifiers(ast)) {
      if (!known.has(identifier)) {
        return { message: `"${identifier}" is not one of this metric's variables`, token: identifier };
      }
    }
    return null;
  } catch (error) {
    if (error instanceof FormulaError) return { message: error.message, token: error.token };
    return { message: 'Could not read this formula' };
  }
}
