import { app } from './app';
import { env } from './config/env';
import { HEALTH_PATH } from './constants/paths';
import { getLocalUrl } from './utils/url';
import { prisma } from './config/database';

app.listen(env.PORT, async () => {
    console.log(`Server running at ${getLocalUrl()}`);
    console.log(`Health: ${getLocalUrl(HEALTH_PATH)}`);
    await prisma.$connect();
    console.log('Database connected');
});
