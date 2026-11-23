// Only localize the host's headings, result messages, and built-in validation prefixes.
// The provider name and the native JSON parser diagnostic can contain arbitrary text.
export function translateSettingsActions(element: Element, field: string, english: string): string | undefined {
  if (field !== 'text') return;
  if (element.matches('.provider-onboarding > h2') && english.startsWith('Connect ')) {
    return '连接 ' + english.slice('Connect '.length);
  }
  const accepted = ' accepted the connection check.';
  if (element.matches('.provider-onboarding > p') && english.endsWith(accepted)) {
    return english.slice(0, -accepted.length) + ' 已通过连接检查。';
  }
  if (element.matches('.settings-window-body main [role="dialog"]:has(> div > h3) > div > div[style*="color: var(--color-danger-muted)"]')) {
    for (const [prefix, label] of [
      ['Invalid JSON in file: ', '文件中的 JSON 格式无效：'],
      ['Invalid JSON: ', 'JSON 格式无效：'],
    ]) {
      if (english.startsWith(prefix)) return label + english.slice(prefix.length);
    }
  }
}
