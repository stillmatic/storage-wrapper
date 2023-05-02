import { head, put } from './index.js';
import { config } from 'dotenv';
config();

async function test() {
    try {
        const pathname = 'test.txt';
        const body = 'Hello, world!';
        const options = { access: 'public' };
        const { url } = await put(pathname, body, options);
        console.log(url);
        // test head function
        const headResult = await head(url);
        console.log(headResult);
    } catch (err) {
        console.error(err);
    }
}

test();
