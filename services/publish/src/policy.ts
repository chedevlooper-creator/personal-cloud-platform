type PublishKind = 'static' | 'vite' | 'node';

export const PUBLISH_IMAGE_ALLOWLIST = [
  'node:20-alpine',
  'nginxinc/nginx-unprivileged:alpine',
] as const;

const PUBLISH_IMAGE_BY_KIND: Record<PublishKind, (typeof PUBLISH_IMAGE_ALLOWLIST)[number]> = {
  node: 'node:20-alpine',
  vite: 'node:20-alpine',
  static: 'nginxinc/nginx-unprivileged:alpine',
};

export function resolvePublishImage(kind: PublishKind): string {
  const image = PUBLISH_IMAGE_BY_KIND[kind];
  assertPublishImageAllowed(image);
  return image;
}

export function assertPublishImageAllowed(image: string): void {
  if (!PUBLISH_IMAGE_ALLOWLIST.includes(image as (typeof PUBLISH_IMAGE_ALLOWLIST)[number])) {
    throw new Error('Publish image is not allowed');
  }
}
