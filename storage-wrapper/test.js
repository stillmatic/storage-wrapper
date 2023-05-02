import { head, put, list, del } from './index.js';
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
        // test list function
        const listResult = await list();
        console.log(listResult);
        // test delete
        const deleteResult = await del([url]);
        console.log(deleteResult);

    } catch (err) {
        console.error(err);
    }
}

test();
