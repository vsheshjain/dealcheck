export type Evidence = { claim: string; url: string }

export type Factor = {
  key: string
  name: string
  score: number
  reason: string
  confidence: 'high' | 'medium' | 'low'
  evidence: Evidence[]
}

export type Report = {
  id: string
  mode: 'idea' | 'acquisition'
  name: string
  summary: string
  factors: Factor[]
  total: number
  band: 'pass' | 'maybe' | 'promising'
  zeroFactors: string[]
  redFlags: string[]
  nextQuestions: string[]
  bottomLine: string
  createdAt: number
}

export type Run = { subject: string; steps: string[] } | null

declare module 'claude-code' {
  interface PluginState {
    dealcheck: {
      reports: Shaped<Report[]>
      run: Shaped<Run>
      shown: Shaped<number>
    }
  }
}
