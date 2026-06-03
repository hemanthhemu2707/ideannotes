/**
 * Utility helper to convert HTML clipboard content to clean, standard Markdown.
 * Used to support rich text pasting (from ChatGPT, Word, websites) directly into the note editor textareas.
 */

export function convertHtmlToMarkdown(html: string): string {
  // SSR Safety Check
  if (typeof window === 'undefined') {
    return '';
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // List of inline tags to prevent extra spacing
  const inlineTags = ['span', 'strong', 'b', 'em', 'i', 'code', 'a', 'del', 's', 'u'];

  function parseNode(node: Node, indentLevel: number = 0): string {
    // 1. Text Node Handling
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      // If it's only formatting/spacing whitespace, collapse it or ignore
      if (/^\s+$/.test(text)) {
        return text.includes('\n') ? '' : ' ';
      }
      // Clean up multiple spaces inside text
      return text.replace(/\s+/g, ' ');
    }

    // 2. Element Node Handling
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const element = node as HTMLElement;
    const tagName = element.tagName.toLowerCase();
    const indent = '    '.repeat(indentLevel);

    // Fenced Code Blocks (e.g. from ChatGPT or GitHub)
    if (tagName === 'pre') {
      const codeElement = element.querySelector('code');
      const codeText = codeElement ? codeElement.textContent : element.textContent;
      let lang = '';
      if (codeElement) {
        const className = codeElement.className || '';
        // Extract language-xxx class names
        const match = className.match(/language-(\w+)/);
        if (match) {
          lang = match[1];
        } else {
          // Fallback if class is language-sql, classList check
          const classListArray = Array.from(codeElement.classList);
          const langClass = classListArray.find(c => c.startsWith('language-') || c.startsWith('lang-'));
          if (langClass) {
            lang = langClass.replace(/^(language-|lang-)/, '');
          }
        }
      }
      return `\n${indent}\`\`\`${lang}\n${codeText || ''}\n${indent}\`\`\`\n`;
    }

    // Inline Code
    if (tagName === 'code') {
      return `\`${element.textContent}\``;
    }

    // Headers
    if (tagName === 'h1') return `\n# ${parseChildren(element, indentLevel)}\n`;
    if (tagName === 'h2') return `\n## ${parseChildren(element, indentLevel)}\n`;
    if (tagName === 'h3') return `\n### ${parseChildren(element, indentLevel)}\n`;
    if (tagName === 'h4') return `\n#### ${parseChildren(element, indentLevel)}\n`;
    if (tagName === 'h5') return `\n##### ${parseChildren(element, indentLevel)}\n`;
    if (tagName === 'h6') return `\n###### ${parseChildren(element, indentLevel)}\n`;

    // Bold / Strong
    if (tagName === 'strong' || tagName === 'b') {
      const content = parseChildren(element, indentLevel);
      return content.trim() ? `**${content}**` : '';
    }

    // Italic / Em
    if (tagName === 'em' || tagName === 'i') {
      const content = parseChildren(element, indentLevel);
      return content.trim() ? `*${content}*` : '';
    }

    // Strikethrough
    if (tagName === 'del' || tagName === 's') {
      const content = parseChildren(element, indentLevel);
      return content.trim() ? `~~${content}~~` : '';
    }

    // Paragraphs / Generic Divisions
    if (tagName === 'p') {
      return `\n${parseChildren(element, indentLevel)}\n`;
    }
    if (tagName === 'div') {
      // Check if this div is a paragraph-like block
      const childrenHtml = parseChildren(element, indentLevel);
      return childrenHtml.trim() ? `\n${childrenHtml}\n` : '';
    }

    // Line Breaks
    if (tagName === 'br') {
      return '\n';
    }

    // Blockquotes
    if (tagName === 'blockquote') {
      const parsed = parseChildren(element, indentLevel).trim();
      const content = parsed.split('\n').map(line => `${indent}> ${line}`).join('\n');
      return `\n${content}\n`;
    }

    // Hyperlinks
    if (tagName === 'a') {
      const href = element.getAttribute('href') || '';
      const text = parseChildren(element, indentLevel);
      return text.trim() ? `[${text}](${href})` : '';
    }

    // Images
    if (tagName === 'img') {
      const src = element.getAttribute('src') || '';
      const alt = element.getAttribute('alt') || 'image';
      return `![${alt}](${src})`;
    }

    // Unordered Lists
    if (tagName === 'ul') {
      return `\n${parseList(element, false, indentLevel)}\n`;
    }

    // Ordered Lists
    if (tagName === 'ol') {
      return `\n${parseList(element, true, indentLevel)}\n`;
    }

    // Tables
    if (tagName === 'table') {
      return `\n${parseTable(element, indentLevel)}\n`;
    }

    // Default: recurse into children for styling / unknown wraps
    return parseChildren(element, indentLevel);
  }

  function parseChildren(element: HTMLElement, indentLevel: number): string {
    let result = '';
    element.childNodes.forEach((child) => {
      result += parseNode(child, indentLevel);
    });
    return result;
  }

  function parseList(listElement: HTMLElement, ordered: boolean, indentLevel: number): string {
    let result = '';
    let index = 1;
    const indent = '    '.repeat(indentLevel);
    listElement.childNodes.forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE && (child as HTMLElement).tagName.toLowerCase() === 'li') {
        const prefix = ordered ? `${index++}. ` : '- ';
        // Nested children should increase the indentation level
        const itemContent = parseChildren(child as HTMLElement, indentLevel + 1).trim();
        result += `${indent}${prefix}${itemContent}\n`;
      }
    });
    return result;
  }

  function parseTable(tableElement: HTMLElement, indentLevel: number): string {
    const rows: string[][] = [];
    const trElements = tableElement.querySelectorAll('tr');
    const indent = '    '.repeat(indentLevel);

    trElements.forEach((tr) => {
      const rowData: string[] = [];
      tr.childNodes.forEach((child) => {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const tagName = (child as HTMLElement).tagName.toLowerCase();
          if (tagName === 'th' || tagName === 'td') {
            // Trim and clean newlines inside a single cell to avoid breaking Markdown formatting
            const cellText = parseChildren(child as HTMLElement, indentLevel).trim().replace(/\r?\n/g, ' ');
            rowData.push(cellText);
          }
        }
      });
      if (rowData.length > 0) {
        rows.push(rowData);
      }
    });

    if (rows.length === 0) return '';

    let markdown = '';
    const headerRow = rows[0];

    // Format headers
    markdown += `${indent}| ${headerRow.join(' | ')} |\n`;
    markdown += `${indent}| ${headerRow.map(() => '---').join(' | ')} |\n`;

    // Format data rows
    for (let i = 1; i < rows.length; i++) {
      const dataRow = rows[i];
      // Normalize columns count if some rows have mismatched sizes
      while (dataRow.length < headerRow.length) {
        dataRow.push('');
      }
      const formattedRow = dataRow.slice(0, headerRow.length);
      markdown += `${indent}| ${formattedRow.join(' | ')} |\n`;
    }

    return markdown;
  }

  const rawMarkdown = parseChildren(doc.body, 0);

  // Post-processing cleanup:
  // - Trim start and end spacing
  // - Collapse 3 or more consecutive newlines down to 2 newlines (preserves paragraph formatting)
  return rawMarkdown
    .trim()
    .replace(/\n{3,}/g, '\n\n');
}
