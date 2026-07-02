import sanitizeHtml = require('sanitize-html');

const FENCED_CODE_BLOCK = /```[\s\S]*?```/g;
const DANGEROUS_MARKDOWN_IMAGE = /!\[([^\]]*)\]\(\s*(?:javascript|data|vbscript):[^)]*\)+/gi;
const DANGEROUS_MARKDOWN_LINK = /\[([^\]]+)\]\(\s*(?:javascript|data|vbscript):[^)]*\)+/gi;

function sanitizeMarkdownSegment(segment: string): string {
  return sanitizeHtml(segment, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  })
    .replace(DANGEROUS_MARKDOWN_IMAGE, '$1')
    .replace(DANGEROUS_MARKDOWN_LINK, '$1');
}

export function sanitizeDescription(description: string): string {
  const codeBlocks: string[] = [];
  const placeholderPrefix = '__STELLAR_BOUNTY_CODE_BLOCK_';

  const withoutCodeBlocks = description.replace(FENCED_CODE_BLOCK, (block) => {
    const placeholder = `${placeholderPrefix}${codeBlocks.length}__`;
    codeBlocks.push(block);
    return placeholder;
  });

  const sanitized = sanitizeMarkdownSegment(withoutCodeBlocks);

  return codeBlocks.reduce(
    (result, block, index) => result.replace(`${placeholderPrefix}${index}__`, block),
    sanitized,
  );
}
