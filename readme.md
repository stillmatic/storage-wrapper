## Simple blob storage API

Want to use a super simple API to upload random blobs of data? Here you go!

```javascript
        const pathname = 'test.txt';
        const body = 'Hello, world!';
        const options = { access: 'public' };
        const { url } = await put(pathname, body, options);
```

Yay! 

## How it works

This is an incredibly simple wrapper around the S3 SDK. It's actually hardcoded to use Cloudflare R2, which is basically the same API but way cheaper. But it does require you to have a few env vars defined

```
AWS_ACCESS_KEY_ID=zzz
AWS_SECRET_ACCESS_KEY=zzz
AWS_ACCOUNT_ID=zzz
AWS_S3_BUCKET_NAME="vercel-test"
```

Chuck that into a dotenv, and you're golden

## Can I pay you more money

If you pay me enough money I'll run a server that exposes this API to you. All I'll do on the backend is have a DB table that has the following mapping

```
user_id, token_value
```

I'll bring my own `secret_access_key` and `access_key`. I'll use the user_id for the bucket name. 

I guess I'll also track your usage so I can bill you.

## but is it serverless? on the edge?

yes? no? If you give me enough money I'll replicate across [multiple regions](https://developers.cloudflare.com/r2/buckets/data-location/#location-hints) by creating multiple buckets. Essentially pick a primary region, write there first, when that's successful, copy the object into your other buckets.

oh, actually if you are already running on the edge in a cloudflare worker, then the default region that a new bucket gets created in would be the caller's region. so I guess we would have to alter the primary region per request, essentially run our own cloudflare worker that first writes to its location then creates a deferred job to replicate to other regions. ok, a bit more complexity, I can see why that might be cool.