import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '$env/dynamic/private';

function createS3Client(): S3Client {
	return new S3Client({
		endpoint: env.S3_ENDPOINT ?? 'http://localhost:9000',
		region: 'us-east-1',
		credentials: {
			accessKeyId: env.S3_ACCESS_KEY ?? 'minioadmin',
			secretAccessKey: env.S3_SECRET_KEY ?? 'minioadmin'
		},
		forcePathStyle: true
	});
}

let _client: S3Client | null = null;

function getClient(): S3Client {
	if (!_client) {
		_client = createS3Client();
	}
	return _client;
}

const getBucket = () => env.S3_BUCKET ?? 'taskmaster-files';

export async function getPresignedUploadUrl(
	key: string,
	contentType: string,
	maxSize: number = 10 * 1024 * 1024
): Promise<string> {
	const command = new PutObjectCommand({
		Bucket: getBucket(),
		Key: key,
		ContentType: contentType,
		ContentLength: maxSize
	});

	return await getSignedUrl(getClient(), command, { expiresIn: 3600 });
}

export async function getPresignedDownloadUrl(
	key: string,
	expiresIn: number = 3600
): Promise<string> {
	const command = new GetObjectCommand({
		Bucket: getBucket(),
		Key: key
	});

	return await getSignedUrl(getClient(), command, { expiresIn });
}

export async function deleteObject(key: string): Promise<void> {
	const command = new DeleteObjectCommand({
		Bucket: getBucket(),
		Key: key
	});

	await getClient().send(command);
}
