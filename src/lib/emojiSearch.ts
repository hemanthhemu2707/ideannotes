// Curated Technical and Developer-focused Emoji Map
export const EMOJI_MAP: Record<string, string[]> = {
  // Developer/Coding Emojis
  '🚀': ['rocket', 'launch', 'speed', 'performance', 'advanced', 'next', 'nextjs', 'fast', 'deploy', 'optimise'],
  '💾': ['database', 'db', 'storage', 'sql', 'postgres', 'save', 'disk', 'memory', 'mssql', 'ef', 'query'],
  '🗄️': ['database', 'db', 'storage', 'sql', 'postgres', 'mssql', 'ef', 'archive', 'query'],
  '⚡': ['backend', 'thunder', 'fast', 'lightning', 'energy', 'server', 'performance', 'c#', 'dotnet', 'api'],
  '⚛️': ['react', 'frontend', 'ui', 'component', 'javascript', 'js', 'node', 'nextjs'],
  '🛡️': ['security', 'shield', 'auth', 'login', 'secure', 'guard', 'protection', 'encryption', 'token', 'admin'],
  '🌐': ['api', 'web', 'network', 'internet', 'rest', 'http', 'world', 'domain', 'routing'],
  '🧩': ['design-patterns', 'pattern', 'puzzle', 'architecture', 'oops', 'class', 'dependency', 'clean'],
  '🕸️': ['network', 'system-design', 'distributed', 'web', 'routing', 'dns'],
  '💻': ['code', 'computer', 'developer', 'programming', 'software', 'frontend', 'backend'],
  '📚': ['basics', 'book', 'learn', 'read', 'guide', 'study', 'education', 'tutorial', 'intro'],
  '🔧': ['tools', 'config', 'setup', 'build', 'engineering', 'webpack', 'vite', 'npm'],
  '🛠️': ['tools', 'config', 'setup', 'build', 'engineering', 'devops', 'cicd'],
  '🔥': ['hot', 'popular', 'favorite', 'fire', 'cool', 'trending', 'star'],
  '📦': ['package', 'npm', 'nuget', 'dependency', 'container', 'docker', 'deploy'],
  '🧠': ['ai', 'gemini', 'brain', 'copilot', 'smart', 'intelligence', 'llm', 'model', 'draft'],
  '🧪': ['test', 'unit-test', 'testing', 'qa', 'experiment', 'jest', 'cypress', 'verify'],
  '⏱️': ['time', 'timer', 'reading-time', 'schedule', 'clock', 'schedules', 'prep', 'countdown'],
  '📊': ['dashboard', 'stats', 'analytics', 'chart', 'control', 'timeline'],
  '📝': ['note', 'write', 'draft', 'editor', 'text', 'markdown'],
  '🎨': ['theme', 'css', 'design', 'style', 'color', 'palette', 'tailwind'],
  '🔒': ['lock', 'auth', 'login', 'secure', 'password', 'admin', 'protect'],
  '🔓': ['unlock', 'auth', 'logout', 'admin'],
  '⚙️': ['config', 'setup', 'tools', 'settings', 'manage'],
  '📌': ['pin', 'pinned', 'important', 'flag', 'announcement'],
  '💡': ['idea', 'tips', 'trick', 'solution', 'insight'],
  '📁': ['folder', 'category', 'directory'],
  '📂': ['folder', 'category', 'directory', 'open'],
  '🔍': ['search', 'find', 'query'],
  '🏷️': ['tag', 'tags', 'label'],
  '🌟': ['star', 'favorite', 'popular', 'rating'],
  '🎉': ['celebrate', 'congrats', 'success', 'done'],
  '🐛': ['bug', 'error', 'debug', 'fix', 'issue'],
  '🚨': ['alert', 'warning', 'danger', 'error', 'important'],
};

// Bidirectional match between text emojis and query keywords
export function emojiSearchMatch(text: string, query: string): boolean {
  if (!text || !query) return false;
  
  const cleanText = text.toLowerCase();
  const cleanQuery = query.toLowerCase().trim();
  
  if (cleanText.includes(cleanQuery)) return true;

  // 1. Text contains emoji: check if search query matches any keyword for that emoji
  for (const [emoji, keywords] of Object.entries(EMOJI_MAP)) {
    if (cleanText.includes(emoji)) {
      if (keywords.some(keyword => keyword.includes(cleanQuery) || cleanQuery.includes(keyword))) {
        return true;
      }
    }
  }

  // 2. Query contains emoji: check if target text matches any keyword for that emoji
  for (const [emoji, keywords] of Object.entries(EMOJI_MAP)) {
    if (cleanQuery.includes(emoji)) {
      if (keywords.some(keyword => cleanText.includes(keyword))) {
        return true;
      }
    }
  }

  return false;
}
