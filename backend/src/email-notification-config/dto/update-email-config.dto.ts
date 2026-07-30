export class UpdateEmailConfigDto {
  isEnabled: boolean
  triggerWindows: number[]   // will be deduped + filtered in service
  recipientUserIds: number[] // can be empty
}
