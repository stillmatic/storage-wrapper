import { head, put, list, del } from './index.js';
import { config } from 'dotenv';
config();

async function test() {
    try {
        const pathname = 'test.txt';
        const body = 'Hello, world!';
        const options = { access: 'public' };
        // test put
        console.log("Testing put function")
        const { url } = await put(pathname, body, options);
        console.log(url);
        // test head function
        console.log("Testing head function")
        const headResult = await head(url);
        console.log(headResult);
        // test list function
        console.log("Testing list function")
        const listResult = await list();
        console.log(listResult);
        // test delete
        console.log("Testing delete function")
        const deleteResult = await del([url]);
        console.log(deleteResult);

    } catch (err) {
        console.error(err);
    }
}

test();
