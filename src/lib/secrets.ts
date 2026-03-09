import {
  SecretsManagerClient,
  CreateSecretCommand,
  GetSecretValueCommand,
  UpdateSecretCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-secrets-manager'
import { env } from '@/lib/env'

const client = new SecretsManagerClient({ region: process.env.AWS_REGION ?? 'us-east-1' })

function secretName(jobId: string): string {
  return `${env.SECRETS_MANAGER_PREFIX}/jobs/${jobId}/env`
}

export async function storeEnvVars(
  jobId: string,
  vars: Record<string, string>
): Promise<void> {
  const name = secretName(jobId)
  const secretString = JSON.stringify(vars)

  try {
    await client.send(
      new CreateSecretCommand({
        Name: name,
        SecretString: secretString,
      })
    )
  } catch (err) {
    if (
      err instanceof Error &&
      err.name === 'ResourceExistsException'
    ) {
      await client.send(
        new UpdateSecretCommand({
          SecretId: name,
          SecretString: secretString,
        })
      )
    } else {
      throw err
    }
  }
}

export async function getEnvVars(
  jobId: string
): Promise<Record<string, string>> {
  const name = secretName(jobId)

  try {
    const result = await client.send(
      new GetSecretValueCommand({ SecretId: name })
    )
    return JSON.parse(result.SecretString ?? '{}')
  } catch (err) {
    if (err instanceof ResourceNotFoundException) {
      return {}
    }
    throw err
  }
}
