import { sanitizeDescription } from './sanitize-description';

describe('sanitizeDescription', () => {
  it('strips raw HTML tags from markdown descriptions', () => {
    expect(sanitizeDescription('Hello <script>alert("xss")</script><b>world</b>')).toBe('Hello world');
  });

  it('removes dangerous markdown link and image URL schemes', () => {
    expect(sanitizeDescription('[click](javascript:alert(1)) ![x](data:image/svg+xml,<svg></svg>)')).toBe(
      'click x',
    );
  });

  it('preserves legitimate markdown syntax and safe links', () => {
    const markdown = '# Title\n\n- item\n\n[GitHub](https://github.com)\n\n**bold**';

    expect(sanitizeDescription(markdown)).toBe(markdown);
  });

  it('preserves fenced code blocks that contain HTML examples', () => {
    const markdown = 'Example:\n```html\n<script>alert("demo")</script>\n```\nDone';

    expect(sanitizeDescription(markdown)).toBe(markdown);
  });
});
