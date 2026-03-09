import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb'
import { env } from '@/lib/env'
import type { Job, ChatMessage, FileRecord } from '@/types'

const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'us-east-1' })
const docClient = DynamoDBDocumentClient.from(client)

const TABLE = env.DYNAMODB_TABLE_NAME

export async function createJob(job: Job): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `JOB#${job.jobId}`,
        SK: 'meta',
        ...job,
      },
    })
  )
}

export async function getJob(jobId: string): Promise<Job | null> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `JOB#${jobId}`, SK: 'meta' },
    })
  )
  if (!result.Item) return null
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { PK: _PK, SK: _SK, ...job } = result.Item
  return job as Job
}

export async function updateJob(
  jobId: string,
  updates: Partial<Job>
): Promise<void> {
  const entries = Object.entries(updates)
  if (entries.length === 0) return

  const expressionParts: string[] = []
  const names: Record<string, string> = {}
  const values: Record<string, unknown> = {}

  entries.forEach(([key, value], i) => {
    expressionParts.push(`#k${i} = :v${i}`)
    names[`#k${i}`] = key
    values[`:v${i}`] = value
  })

  await docClient.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `JOB#${jobId}`, SK: 'meta' },
      UpdateExpression: `SET ${expressionParts.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  )
}

export async function putFileRecord(record: FileRecord): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `JOB#${record.jobId}`,
        SK: `FILE#${record.filePath}`,
        ...record,
      },
    })
  )
}

export async function getFileRecords(jobId: string): Promise<FileRecord[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `JOB#${jobId}`,
        ':sk': 'FILE#',
      },
    })
  )
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (result.Items ?? []).map(({ PK: _PK, SK: _SK, ...item }) => item as FileRecord)
}

export async function addChatMessage(
  jobId: string,
  message: ChatMessage
): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `JOB#${jobId}`,
        SK: `CHAT#${message.timestamp}`,
        ...message,
      },
    })
  )
}

export async function getChatMessages(jobId: string): Promise<ChatMessage[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `JOB#${jobId}`,
        ':sk': 'CHAT#',
      },
    })
  )
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (result.Items ?? []).map(({ PK: _PK, SK: _SK, ...item }) => item as ChatMessage)
}
