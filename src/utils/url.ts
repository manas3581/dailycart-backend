import { env } from '../config/env';

export function getLocalUrl(path = ''): string {
    return `http://localhost:${env.PORT}${path}`;
}
