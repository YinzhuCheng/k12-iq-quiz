export function normalizeMathText(input: string): string {
  let s = input ?? '';

  // Fix common JSON escape issue: "\to" becomes "\t" (tab) + "o"
  // We convert tab followed by 'o' back to '\to' for MathJax.
  s = s.replace(/\t(?=o)/g, '\\to');

  // Convert $...$ and $$...$$ delimiters into MathJax-friendly \( \) / \[ \]
  s = convertDollarDelimiters(s);

  return s;
}

function convertDollarDelimiters(input: string): string {
  let out = '';
  let i = 0;

  while (i < input.length) {
    if (input.startsWith('$$', i)) {
      const j = input.indexOf('$$', i + 2);
      if (j === -1) {
        out += input.slice(i);
        break;
      }
      const content = input.slice(i + 2, j);
      out += `\\[${content}\\]`;
      i = j + 2;
      continue;
    }

    if (input[i] === '$') {
      const j = input.indexOf('$', i + 1);
      if (j === -1) {
        out += input.slice(i);
        break;
      }
      const content = input.slice(i + 1, j);
      out += `\\(${content}\\)`;
      i = j + 1;
      continue;
    }

    out += input[i];
    i += 1;
  }

  return out;
}

