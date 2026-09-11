import axios from 'axios'

export interface WidgetCmd {
  action: 'show' | 'hide' | 'toggle'
  widget: string
}

export interface BrainResponse {
  task_id: string
  result: string
  model_used: string
  cost_usd: number
  duration_ms: number
  widget_cmd?: WidgetCmd | null
}

export async function submitToBrain(
  id: string,
  input: string,
  model = 'balanced',
): Promise<BrainResponse> {
  const port = process.env.BRAIN_PORT || '8001'
  try {
    const { data } = await axios.post<BrainResponse>(
      `http://localhost:${port}/task`,
      { id, input, model },
      { timeout: 120_000 },
    )
    return data
  } catch (err: unknown) {
    if (axios.isAxiosError(err) && err.response?.data) {
      const detail = (err.response.data as { detail?: string }).detail
      if (detail) throw new Error(detail)
    }
    throw err
  }
}
