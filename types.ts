
export interface GroundingChunkWeb {
  uri: string;
  title: string;
}

export interface GroundingChunk {
  web: GroundingChunkWeb;
}

export interface AssistantApiResponse {
  text: string;
  references?: GroundingChunk[];
}

export enum RecordingState {
  Idle = "IDLE",
  Recording = "RECORDING",
  Processing = "PROCESSING",
}
