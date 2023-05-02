import { S3Client, PutObjectCommand, HeadObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import mime from 'mime-types';
import { v4 as uuidv4 } from 'uuid';

function generateUUIDFilename(pathname) {
    const extension = pathname.split('.').pop(); // Get the file extension
    const basename = pathname.split('.').slice(0, -1).join('.'); // Get the basename without extension
    const uuid = uuidv4(); // Generate a UUID
    return `${basename}-${uuid}.${extension}`; // Combine the filename with the UUID
}

const getEndpointURL = () => {
    const accountID = process.env.AWS_ACCOUNT_ID || "";
    return `https://${accountID}.r2.cloudflarestorage.com`;
}

const getS3Client = () => {
    const endpointURL = getEndpointURL();
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set.');
    }
    if (process.env.AWS_ACCESS_KEY_ID === "" || process.env.AWS_SECRET_ACCESS_KEY === "") {
        throw new Error('AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY must be set.');
    }
    return new S3Client({
        region: "auto",
        endpoint: endpointURL,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        }
    });
}

export async function put(pathname, body, options) {
    const s3 = getS3Client();
    const endpointURL = getEndpointURL();

    if (!options || !options.access || options.access !== 'public') {
        throw new Error('Only "public" access is supported at the moment.');
    }

    const contentType = options.contentType || mime.contentType(pathname) || 'application/octet-stream';
    // randKey guarantees uniqueness
    const randKey = generateUUIDFilename(pathname);
    const token = options && options.token ? options.token : process.env.BLOB_READ_WRITE_TOKEN;

    let params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME || "",
        Key: randKey,
        Body: body,
        ContentType: contentType,
        ACL: 'public-read',
    };
    if (token) {
        params = {
            ...params,
            Metadata: {
                'x-read-write-token': token,
            },
        };
    }

    try {
        await s3.send(new PutObjectCommand(params));
        const url = `${endpointURL}/${randKey}`;
        return { url };
    } catch (err) {
        console.error('Error uploading to S3:', err);
        throw err;
    }
}

export async function del(blobUrls, options) {
    const s3 = getS3Client();

    const token = options && options.token ? options.token : process.env.BLOB_READ_WRITE_TOKEN;

    async function deleteBlob(blobUrl) {
        const parsedUrl = new URL(blobUrl);
        const pathname = parsedUrl.pathname?.startsWith('/')
            ? parsedUrl.pathname.slice(1)
            : parsedUrl.pathname;

        const headParams = {
            Bucket: process.env.AWS_S3_BUCKET_NAME,
            Key: pathname,
        };

        try {
            const headData = await s3.send(new HeadObjectCommand(headParams));
            const headToken = headData.Metadata && headData.Metadata['x-read-write-token'];
            if ((headToken && headToken === token) || (!headToken)) {
                await s3.send(new DeleteObjectCommand(headParams));
                return headData.Metadata;
            } else {
                throw new Error('Invalid token.');
            }
        } catch (err) {
            if (err.code === 'NotFound') {
                return null;
            }

            console.error('Error deleting blob:', err);
            throw err;
        }
    }

    if (Array.isArray(blobUrls)) {
        const results = await Promise.all(blobUrls.map(deleteBlob));
        return results.filter((result) => result !== null);
    } else {
        return deleteBlob(blobUrls);
    }
}

export async function list(options) {
    const s3 = getS3Client();

    const token = options && options.token ? options.token : process.env.BLOB_READ_WRITE_TOKEN;
    const limit = options && options.limit
        ? options.limit
        : 1000;
    const prefix = options && options.prefix ? options.prefix : '';
    const cursor = options && options.cursor ? options.cursor : undefined;

    const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Prefix: prefix,
        MaxKeys: limit,
        ContinuationToken: cursor,
    };

    try {
        const data = await s3.send(new ListObjectsV2Command(params));

        const blobs = data.Contents?.map((item) => {
            const headParams = {
                Bucket: process.env.AWS_S3_BUCKET_NAME,
                Key: item.Key,
            };

            return s3.send(new HeadObjectCommand(headParams));
        });

        const blobMetadata = await Promise.all(blobs);

        const accountID = process.env.AWS_ACCOUNT_ID || "";
        const result = {
            blobs: blobMetadata.map((metadata, index) => {
                return {
                    size: metadata.ContentLength,
                    uploadedAt: metadata.LastModified,
                    pathname: data.Contents?.[index].Key,
                    contentType: metadata.ContentType,
                    contentDisposition: metadata.ContentDisposition,
                    contentEncoding: metadata.ContentEncoding,
                    cacheControl: metadata.CacheControl,
                    url: `https://${accountID}.r2.cloudflarestorage.com/${process.env.AWS_S3_BUCKET_NAME}/${data.Contents?.[index].Key}`,
                };
            }),
            cursor: data.NextContinuationToken,
            hasMore: data.IsTruncated,
        };

        return result;
    } catch (err) {
        console.error('Error listing blobs:', err);
        throw err;
    }

}

export async function head(blobUrl, options) {
    const s3 = getS3Client();
    const token = options && options.token ? options.token : process.env.BLOB_READ_WRITE_TOKEN;

    const parsedUrl = new URL(blobUrl);
    const pathname = parsedUrl.pathname?.startsWith('/')
        ? parsedUrl.pathname.slice(1)
        : parsedUrl.pathname;

    const params = {
        Bucket: process.env.AWS_S3_BUCKET_NAME,
        Key: pathname,
    };

    try {
        const headData = await s3.send(new HeadObjectCommand(params));

        if (headData.Metadata?.['x-read-write-token'] === token) {
            return {
                size: headData.ContentLength,
                uploadedAt: headData.LastModified,
                pathname: pathname,
                contentType: headData.ContentType,
                contentDisposition: headData.ContentDisposition,
                contentEncoding: headData.ContentEncoding,
                cacheControl: headData.CacheControl,
                url: blobUrl,
            };
        } else {
            throw new Error('Invalid token.');
        }
    } catch (err) {
        if (err.code === 'NotFound') {
            return null;
        }

        console.error('Error retrieving blob metadata:', err);
        throw err;
    }
}
