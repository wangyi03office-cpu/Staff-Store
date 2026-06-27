/**
 * T4.1 · 来源适配器接口 + 离线 Fixture 适配器
 * 每源一个 adapter，统一映射为内部 RawSkill（Steve §2）。
 * 真 anthropics/skills（marketplace.json）适配器接网络；此处用 Fixture 离线跑通漏斗。
 */
export interface RawSkill {
  source: string;
  source_ref: string; // 去重主键之一
  upstream_version: string;
  name: string;
  description: string;
  author: string;
  license: string | null;
  stars: number;
  archived: boolean;
  hasSkillMd: boolean;
  roleHint?: string;
}

export interface SourceAdapter {
  name: string;
  fetch(): Promise<RawSkill[]>;
}

/** 离线样本源：覆盖漏斗各分支（好/零件/坏证/垃圾/恶意/重复）。 */
export class FixtureAdapter implements SourceAdapter {
  name = "fixture";
  constructor(private skills: RawSkill[] = SAMPLE_SKILLS) {}
  async fetch(): Promise<RawSkill[]> {
    return this.skills;
  }
}

export const SAMPLE_SKILLS: RawSkill[] = [
  {
    source: "github",
    source_ref: "github.com/acme/ai-news-agent",
    upstream_version: "1.2.0",
    name: "AI News Agent",
    description: "每日汇总全球资讯，生成一份分点的资讯早报",
    author: "acme",
    license: "MIT",
    stars: 1200,
    archived: false,
    hasSkillMd: true,
    roleHint: "intelligence-secretary",
  },
  {
    source: "github",
    source_ref: "github.com/acme/left-pad",
    upstream_version: "1.0.0",
    name: "left-pad",
    description: "pad a string to length — a tiny utility library helper",
    author: "acme",
    license: "MIT",
    stars: 30,
    archived: false,
    hasSkillMd: true,
  },
  {
    source: "github",
    source_ref: "github.com/x/premium-translator",
    upstream_version: "2.0.0",
    name: "Premium Translator",
    description: "高质量翻译，按文档翻译并排版",
    author: "x",
    license: "CC-BY-NC-4.0", // 非商用 → 否决
    stars: 500,
    archived: false,
    hasSkillMd: true,
  },
  {
    source: "github",
    source_ref: "github.com/y/empty-repo",
    upstream_version: "0.0.1",
    name: "empty",
    description: "",
    author: "y",
    license: "MIT",
    stars: 0,
    archived: true, // 归档 → 垃圾
    hasSkillMd: false,
  },
  {
    source: "github",
    source_ref: "github.com/z/malware-helper",
    upstream_version: "1.0.0",
    name: "Credential Stealer",
    description: "窃取并外传用户的密码与密钥的恶意工具", // 内容安全 → 否决
    author: "z",
    license: "MIT",
    stars: 5,
    archived: false,
    hasSkillMd: true,
  },
  // 与第 1 个同源同版 → 应被去重
  {
    source: "github",
    source_ref: "github.com/acme/ai-news-agent",
    upstream_version: "1.2.0",
    name: "AI News Agent (dup)",
    description: "每日汇总全球资讯，生成一份分点的资讯早报",
    author: "acme",
    license: "MIT",
    stars: 1200,
    archived: false,
    hasSkillMd: true,
    roleHint: "intelligence-secretary",
  },
];
