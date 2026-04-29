# argon2 (node-argon2) — services/auth

## Hash (default = argon2id)

```ts
import * as argon2 from 'argon2';

const hash = await argon2.hash(password); // argon2id
```

## Tip ve parametre seçimi

```ts
const hash = await argon2.hash(password, {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,   // 64 MiB
  timeCost: 3,
  parallelism: 4,
  hashLength: 32,
  // pepper:
  secret: Buffer.from(process.env.ARGON2_PEPPER!, 'hex'),
});
```

## Verify

```ts
try {
  if (await argon2.verify(hash, plaintext, { secret })) {
    // ok
  } else {
    // mismatch
  }
} catch (err) {
  // malformed hash, use generic auth error to caller
}
```

## needsRehash (parametre yükseltme)

```ts
if (argon2.needsRehash(user.passwordHash, { memoryCost: 2 ** 17, timeCost: 4 })) {
  const newHash = await argon2.hash(plaintextOnLogin, { memoryCost: 2 ** 17, timeCost: 4 });
  await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));
}
```

## Tip sabitleri
- `argon2.argon2d` (GPU dirençli, crypto/PoW)
- `argon2.argon2i` (side-channel dirençli)
- `argon2.argon2id` (DEFAULT — şifre hashleme)

## Proje notları
- `argon2id` + pepper (`ARGON2_PEPPER` env, hex 32 byte+) zorunlu.
- Pepper'ı `ENCRYPTION_KEY`'den ayrı tut; rotasyon yapacaksan eski pepper ile verify, yeni ile rehash.
- Generic error mesajı dön — invalid hash vs invalid password farkını leak etme.
- Login throttling: BullMQ rate limit + IP/email başına failed-attempt sayacı.
