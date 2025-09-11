import { registerAs } from '@nestjs/config';

export default registerAs('tt', () => ({
  baseUrl: process.env.TT_BASE_URL!,
}));


