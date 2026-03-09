import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { env } from '@/lib/env'

const s3 = new S3Client({ region: env.AWS_REGION })

export async function uploadRepoFile(
  jobId: string,
  filePath: string,
  content: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET_REPOS,
      Key: `repos/${jobId}/${filePath}`,
      Body: content,
      ContentType: 'text/plain',
    })
  )
}

export async function uploadGeneratedFile(
  jobId: string,
  filePath: string,
  content: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET_GENERATED,
      Key: `generated/${jobId}/${filePath}`,
      Body: content,
      ContentType: 'text/plain',
    })
  )
}

export async function getRepoFile(
  jobId: string,
  filePath: string
): Promise<string> {
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET_REPOS,
      Key: `repos/${jobId}/${filePath}`,
    })
  )
  return (await result.Body?.transformToString()) ?? ''
}

export async function getGeneratedFile(
  jobId: string,
  filePath: string
): Promise<string> {
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET_GENERATED,
      Key: `generated/${jobId}/${filePath}`,
    })
  )
  return (await result.Body?.transformToString()) ?? ''
}

export async function listRepoFiles(jobId: string): Promise<string[]> {
  const prefix = `repos/${jobId}/`
  const result = await s3.send(
    new ListObjectsV2Command({
      Bucket: env.S3_BUCKET_REPOS,
      Prefix: prefix,
    })
  )
  return (result.Contents ?? [])
    .map((obj) => obj.Key?.replace(prefix, '') ?? '')
    .filter((p) => Boolean(p) && !p.startsWith('binary/'))
}

export async function getAllRepoFiles(
  jobId: string
): Promise<Map<string, string>> {
  const filePaths = await listRepoFiles(jobId)
  const files = new Map<string, string>()

  await Promise.all(
    filePaths.map(async (filePath) => {
      const content = await getRepoFile(jobId, filePath)
      files.set(filePath, content)
    })
  )

  return files
}

export async function listGeneratedFiles(jobId: string): Promise<string[]> {
  const prefix = `generated/${jobId}/`
  const result = await s3.send(
    new ListObjectsV2Command({
      Bucket: env.S3_BUCKET_GENERATED,
      Prefix: prefix,
    })
  )
  return (result.Contents ?? [])
    .map((obj) => obj.Key?.replace(prefix, '') ?? '')
    .filter((p) => Boolean(p) && !p.startsWith('images/'))
}

export async function getAllGeneratedFiles(
  jobId: string
): Promise<Map<string, string>> {
  const filePaths = await listGeneratedFiles(jobId)
  const files = new Map<string, string>()

  await Promise.all(
    filePaths.map(async (filePath) => {
      const content = await getGeneratedFile(jobId, filePath)
      files.set(filePath, content)
    })
  )

  return files
}

export async function getPresignedUrl(
  bucket: string,
  key: string,
  expiresIn = 3600
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key })
  return getSignedUrl(s3, command, { expiresIn })
}

export async function getRepoBinaryAssetUrl(
  jobId: string,
  filePath: string
): Promise<string> {
  // 7-day expiry — more than enough for the scan→preview→PR workflow
  return getPresignedUrl(
    env.S3_BUCKET_REPOS,
    `repos/${jobId}/binary/${filePath}`,
    604800
  )
}

// Binary asset helpers — stored under repos/{jobId}/binary/{filePath}
// so they are never conflated with text files in getAllRepoFiles()

export async function uploadRepoBinaryAsset(
  jobId: string,
  filePath: string,
  data: Buffer,
  contentType: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET_REPOS,
      Key: `repos/${jobId}/binary/${filePath}`,
      Body: data,
      ContentType: contentType,
    })
  )
}

export async function getRepoBinaryAsset(
  jobId: string,
  filePath: string
): Promise<Uint8Array> {
  const result = await s3.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET_REPOS,
      Key: `repos/${jobId}/binary/${filePath}`,
    })
  )
  const bytes = await result.Body?.transformToByteArray()
  return bytes ?? new Uint8Array(0)
}

export async function uploadGeneratedImage(
  jobId: string,
  filename: string,
  data: Buffer
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET_GENERATED,
      Key: `generated/${jobId}/images/${filename}`,
      Body: data,
      ContentType: 'image/png',
    })
  )
}

export async function listRepoBinaryAssets(jobId: string): Promise<string[]> {
  const prefix = `repos/${jobId}/binary/`
  const result = await s3.send(
    new ListObjectsV2Command({
      Bucket: env.S3_BUCKET_REPOS,
      Prefix: prefix,
    })
  )
  return (result.Contents ?? [])
    .map((obj) => obj.Key?.replace(prefix, '') ?? '')
    .filter(Boolean)
}
