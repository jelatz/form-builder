import 'dotenv/config';

export interface ServerEnv {
  databaseUrl: string;
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  isProduction: boolean;
  seedSuperadminUsername: string;
  seedSuperadminPassword: string;
  resendApiKey: string;
  emailFrom: string;
  appOrigin: string;
}

export function loadServerEnv(): ServerEnv {
  const rawNodeEnv = process.env.NODE_ENV;
  const nodeEnv: ServerEnv['nodeEnv'] =
    rawNodeEnv === 'production' || rawNodeEnv === 'test'
      ? rawNodeEnv
      : 'development';

  const parsedPort = Number(process.env.PORT ?? '3001');
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 3001;
  const isProduction = nodeEnv === 'production';

  return {
    databaseUrl: process.env.DATABASE_URL ?? '',
    port,
    nodeEnv,
    isProduction,
    seedSuperadminUsername: process.env.SEED_SUPERADMIN_USERNAME ?? 'superadmin',
    seedSuperadminPassword: process.env.SEED_SUPERADMIN_PASSWORD ?? 'admin123',
    resendApiKey: (process.env.RESEND_API_KEY ?? '').trim(),
    emailFrom:
      (process.env.EMAIL_FROM ?? '').trim() ||
      (isProduction ? '' : 'FormBuilder <onboarding@resend.dev>'),
    appOrigin: (process.env.APP_ORIGIN ?? 'http://localhost:5173')
      .trim()
      .replace(/\/+$/, ''),
  };
}
