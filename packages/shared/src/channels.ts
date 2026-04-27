import { z } from 'zod';

export const channelLinkResponseSchema = z.object({
  id: z.string().uuid(),
  workspaceId: z.string().uuid().nullable(),
  channel: z.string(),
  externalId: z.string(),
  label: z.string().nullable(),
  enabled: z.boolean(),
  metadata: z.record(z.unknown()).nullable().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createChannelLinkSchema = z.object({
  channel: z.enum(['telegram', 'email', 'discord', 'sms']),
  externalId: z.string().min(1).max(256),
  label: z.string().max(200).nullable().optional(),
  workspaceId: z.string().uuid().nullable().optional(),
});

export const updateChannelLinkSchema = z.object({
  label: z.string().max(200).nullable().optional(),
  workspaceId: z.string().uuid().nullable().optional(),
  enabled: z.boolean().optional(),
});

export type ChannelLinkResponse = z.infer<typeof channelLinkResponseSchema>;
export type CreateChannelLinkDto = z.infer<typeof createChannelLinkSchema>;
export type UpdateChannelLinkDto = z.infer<typeof updateChannelLinkSchema>;
