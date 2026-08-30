const universityAssets = import.meta.glob('../../assets/*.{png,PNG,jpg,JPG,jpeg,JPEG,svg,SVG,webp,WEBP}', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

const logosByPrefix = new Map<string, string>();

for (const [path, url] of Object.entries(universityAssets)) {
  const fileName = path.split('/').at(-1) ?? '';
  const prefix = fileName.replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/gi, '').toUpperCase();
  if (prefix && prefix !== 'MOHELOGO') logosByPrefix.set(prefix, url);
}

export const normalizeUniversityPrefix = (value: string) => value.replace(/[^a-z0-9]/gi, '').toUpperCase();

export const resolveUniversityLogoAsset = (prefix: string) => logosByPrefix.get(normalizeUniversityPrefix(prefix)) ?? null;
