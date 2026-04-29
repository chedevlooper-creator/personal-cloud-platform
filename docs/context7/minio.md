# MinIO — workspace object storage

## Tenant-scoped policy (per-user prefix)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": ["s3:ListBucket"],
      "Effect": "Allow",
      "Resource": ["arn:aws:s3:::workspace"],
      "Condition": { "StringLike": { "s3:prefix": ["${aws:username}/*"] } }
    },
    {
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Effect": "Allow",
      "Resource": ["arn:aws:s3:::workspace/${aws:username}/*"]
    }
  ]
}
```

## Source IP restriction

```json
{
  "Version": "2012-10-17",
  "Statement": {
    "Effect": "Allow",
    "Action": "s3:ListBucket*",
    "Resource": "arn:aws:s3:::workspace",
    "Condition": { "IpAddress": { "aws:SourceIp": "203.0.113.0/24" } }
  }
}
```

## Bucket versioning (XML)

```xml
<VersioningConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">
  <Status>Enabled</Status>
</VersioningConfiguration>
```

## mc admin commands

```bash
mc alias set local http://localhost:9000 minioadmin minioadmin
mc admin policy create local pcp-tenant ./policy.json
mc admin user add local <accessKey> <secretKey>
mc admin policy attach local pcp-tenant --user <accessKey>
mc mb local/workspace
```

## AWS SDK v3 (Node) — presigned URL örneği

```ts
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: 'us-east-1',
  credentials: { accessKeyId: ..., secretAccessKey: ... },
  forcePathStyle: true, // MinIO için
});

const cmd = new PutObjectCommand({
  Bucket: 'workspace',
  Key: `${userId}/${workspaceId}/${path}`, // tenant prefix
  ContentType,
});
const url = await getSignedUrl(s3, cmd, { expiresIn: 600 });
```

## Multipart upload (büyük dosya)

```ts
import { Upload } from '@aws-sdk/lib-storage';

const u = new Upload({
  client: s3,
  params: { Bucket: 'workspace', Key: `${userId}/${workspaceId}/big.bin`, Body: stream },
  partSize: 8 * 1024 * 1024,
  queueSize: 4,
});
await u.done();
```

## Replication policies (source/target permissions)

Source min izinleri: `admin:SetBucketTarget`, `s3:GetReplicationConfiguration`, `s3:PutReplicationConfiguration`.

Target min izinleri: `s3:ReplicateObject`, `s3:ReplicateDelete`, `s3:GetObjectVersion`, `s3:PutObject`.

## Proje notları
- Tüm storage path'leri ZORUNLU olarak `{userId}/{workspaceId}/...` ile başlamalı (tenant invariant).
- Tenant başına IAM user değil; uygulama tarafı service account + uygulama içi authz.
- Versioning + bucket lifecycle ile snapshot servisinin retention'ını yönet.
- Public file paylaşımı için ayrı `public-share` bucket'ı kullan.
