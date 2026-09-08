import axios from 'axios'

export interface BrainResponse {
  task_id: string
  result: string
  model_used: string
  cost_usd: number
  duration_ms: number
}

export async function submitToBrain(
  id: string,
  input: string,
  model = 'balanced',
): Promise<BrainResponse> {
  const port = process.env.BRAIN_PORT || '8001'
  const { data } = await axios.post<BrainResponse>(
    `http://localhost:${port}/task`,
    { id, input, model },
    { timeout: 120_000 },
  )
  return data
}
