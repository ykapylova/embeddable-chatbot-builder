export type ApiOk<T> = { data: T };

export type ApiErr = { error: string; code?: string };

export type ApiAck = { success: true };
