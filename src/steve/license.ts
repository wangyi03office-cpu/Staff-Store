/**
 * 许可证合规（第 9 条之一、Steve §5.3②）：必须允许商业再打包与再分发。
 * 白名单放行；缺证 / 非商用(-NC) / 禁改(-ND) / copyleft(默认) → 否决。
 */
const WHITELIST = new Set([
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "0BSD",
  "Unlicense",
  "CC0-1.0",
]);

export function licenseAllowed(license: string | null | undefined): boolean {
  if (!license) return false; // 无许可证 → 否决
  const l = license.trim();
  if (/-NC|-ND|NonCommercial|NoDerivatives/i.test(l)) return false;
  if (/GPL|AGPL|LGPL/i.test(l)) return false; // copyleft 默认否决（保守，待法务）
  return WHITELIST.has(l);
}
