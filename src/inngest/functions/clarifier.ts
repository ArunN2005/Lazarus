import { inngest } from '@/lib/inngest-client'
import { updateJob } from '@/lib/dynamodb'

export const clarifier = inngest.createFunction(
  { id: 'clarifier', name: 'Submit Clarifications' },
  { event: 'lazarus/clarification.submitted' },
  async ({ event, step }) => {
    const { jobId, answers } = event.data as {
      jobId: string
      answers: Record<string, string>
    }

    await step.run('save-answers', async () => {
      await updateJob(jobId, {
        clarificationAnswers: answers,
        status: 'scanned',
      })
    })

    return { jobId, answersCount: Object.keys(answers).length }
  }
)
