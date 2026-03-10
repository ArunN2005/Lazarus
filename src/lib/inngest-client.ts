import { Inngest } from 'inngest'

export const inngest = new Inngest({
  id: 'lazarus',
  // Fallback so send() works even if INNGEST_EVENT_KEY isn't in Lambda env
  eventKey: process.env.INNGEST_EVENT_KEY ?? '53fqpKVesyz17AZHjbBePHptGUMuMe8Ts7rvEmywO42fOnDPNXAmpDvbYMIKzaDQtO-DM6kVQCpBsYBqX7mRKw',
})
