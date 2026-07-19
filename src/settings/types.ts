import { WritableDraft } from "immer"
import { Settings } from "../shared"

export type SetSettings = (
  draftSettings: (draft: WritableDraft<Settings>) => void,
) => void
